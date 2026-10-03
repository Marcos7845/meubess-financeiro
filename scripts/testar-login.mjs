#!/usr/bin/env node
// O TESTE DO LOGIN — sobe o app de verdade (o mesmo `next start` do servidor, com login) e bate nele como um
// navegador bateria.
//
//   npm run testar-login              # constrói em .next-teste e testa
//   npm run testar-login -- --sem-build   # usa o .next-teste que já existe
//
// Confere, e sai com código diferente de 0 se alguma falhar:
//   - as três telas e o POST /api/atualizar SEM login são recusados (tela → /entrar, API → 401);
//   - um e-mail sem cadastro é barrado, e uma senha errada também, com a MESMA resposta e sem cookie;
//   - COM login as três telas abrem e o POST /api/atualizar passa;
//   - a tela de administrador: só administrador entra; ele cadastra uma pessoa, que vê as telas e não vê /admin;
//     desativada, a sessão dela cai e ela não entra mais; um POST vindo de outro site é recusado;
//   - /api/dfc: sem o segredo ou com o errado, 401; com o certo, guarda a planilha, fecha o envio e a tela mostra a
//     hora do envio.
//   - o limite de tentativas não zera trocando o x-forwarded-for, e o mapa de tentativas respeita o teto;
//   - um zip descompactado acima do teto é recusado no /api/dfc e como anexo de pendência.
//
// ISOLADO DE TUDO O QUE É DE VERDADE: o cadastro e o DFC vão para uma pasta temporária (`MEUBESS_DADOS_DIR`),
// apagada no fim; os segredos e a senha do administrador de teste são sorteados na hora e não são impressos;
// `OMIE_RELEITURA=desligada` faz as telas e o "atualizar agora" não chamarem o Omie (leem o cache que já existe, só
// leitura); o build vai para `.next-teste` e a porta é a 4783, sem tocar no app da 4781. Nenhuma planilha é lida: o
// DFC do teste é um arquivo de mentira.

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { criarLimite } from '../lib/acesso/tentativas.mjs';
import { TETO_DESCOMPACTADO } from '../lib/regras/xlsx.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
const DIST = '.next-teste';
const PORTA = 4783;
const BASE = `http://127.0.0.1:${PORTA}`;

const sorteio = (n) => crypto.randomBytes(n).toString('base64url');
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'meubess-teste-login-'));
const ADMIN = { email: 'admin-de-teste@exemplo.com.br', senha: sorteio(18) };
const PESSOA = { email: 'pessoa-de-teste@exemplo.com.br', senha: sorteio(18) };
const DFC_SEGREDO = sorteio(24);
const PENDENCIAS_SEGREDO = sorteio(24);

const env = {
  ...process.env,
  NODE_ENV: 'production',
  MEUBESS_DIST: DIST,
  MEUBESS_DADOS_DIR: dados,
  SESSAO_SEGREDO: sorteio(48),
  DFC_ENVIO_SEGREDO: DFC_SEGREDO,
  PENDENCIAS_PONTE_SEGREDO: PENDENCIAS_SEGREDO,
  MEUBESS_ADMIN_EMAIL: ADMIN.email,
  MEUBESS_ADMIN_SENHA: ADMIN.senha,
  DFC_FONTE: 'servidor',
  OMIE_RELEITURA: 'desligada',
};
delete env.MEUBESS_LOGIN;

if (!process.argv.includes('--sem-build')) {
  console.log(`construindo em ${DIST}…`);
  const b = spawnSync(process.execPath, [NEXT, 'build'], { cwd: RAIZ, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (b.status !== 0) { console.error('o build falhou'); process.exit(1); }
}

const log = fs.openSync(path.join(dados, 'servidor.log'), 'w');
const servidor = spawn(process.execPath, [NEXT, 'start', '-H', '127.0.0.1', '-p', String(PORTA)], { cwd: RAIZ, env, stdio: ['ignore', log, log] });
// No fim: derruba o servidor, mostra o fim do log dele se algo falhou (erro de servidor, sem segredo nenhum: os
// segredos só existem no ambiente), e apaga a pasta temporária.
async function fim(codigo) {
  const saiu = new Promise((r) => servidor.once('exit', r));
  servidor.kill();
  await Promise.race([saiu, new Promise((r) => setTimeout(r, 5000))]);
  fs.closeSync(log);
  if (codigo) {
    const linhas = fs.readFileSync(path.join(dados, 'servidor.log'), 'utf8').split('\n').slice(-40);
    console.log(`\nfim do log do servidor:\n${linhas.join('\n')}`);
  }
  try { fs.rmSync(dados, { recursive: true, force: true }); } catch { /* o Windows às vezes segura um arquivo; é pasta temporária */ }
  process.exit(codigo);
}

// ---------------------------------------------------------------- um navegador mínimo

async function pedir(caminho, { metodo = 'GET', cookie, form, json, cabecalhos = {} } = {}) {
  const headers = { ...cabecalhos };
  if (cookie) headers.Cookie = cookie;
  let body;
  if (form) { body = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded'; headers.Origin ??= BASE; }
  if (json) { body = JSON.stringify(json); headers['Content-Type'] = 'application/json'; }
  if (metodo === 'POST' && !form && !json) headers.Origin ??= BASE;
  const r = await fetch(BASE + caminho, { method: metodo, headers, body, redirect: 'manual' });
  const texto = await r.text();
  const setCookie = r.headers.getSetCookie().find((c) => c.startsWith('meubess_sessao='));
  return { status: r.status, local: r.headers.get('location'), texto, setCookie, cookie: setCookie ? setCookie.split(';')[0] : null };
}

// Um zip de um arquivo só, comprimido (deflate). `declarado` troca o tamanho descompactado que o diretório central
// anuncia, para provar que a recusa lê só o diretório.
function zipCom(nome, conteudo, { declarado = conteudo.length } = {}) {
  const n = Buffer.from(nome), comp = zlib.deflateRawSync(conteudo), crc = zlib.crc32(conteudo);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(conteudo.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(declarado, 24); central.writeUInt16LE(n.length, 28);
  const inicioCentral = local.length + n.length + comp.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(1, 8); fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + n.length, 12); fim.writeUInt32LE(inicioCentral, 16);
  return Buffer.concat([local, n, comp, central, n, fim]);
}

async function entrar({ email, senha }) { return pedir('/api/entrar', { metodo: 'POST', form: { email, senha, volta: '/dre' } }); }

let falhas = 0, total = 0;
function confere(nome, ok, detalhe) {
  total += 1;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok     ' : 'FALHOU '} ${nome} — ${detalhe}`);
}
const redirecionaParaEntrar = (r) => r.status === 307 && String(r.local).startsWith('/entrar');

try {
  // Espera o servidor responder.
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${BASE}/entrar`)).ok) break; } catch { /* ainda subindo */ }
    if (i > 120) throw new Error('o servidor não subiu em 60 s');
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\nsem login');
  for (const tela of ['/', '/dre', '/fluxo-de-caixa', '/pendencias', '/admin']) {
    const r = await pedir(tela);
    confere(`GET ${tela} sem login é recusado`, redirecionaParaEntrar(r), `${r.status} → ${r.local}`);
  }
  let r = await pedir('/api/atualizar', { metodo: 'POST', json: { ano: 2026 } });
  confere('POST /api/atualizar sem login é recusado', r.status === 401, `${r.status} ${r.texto}`);
  r = await pedir('/api/pendencias/responder', { metodo: 'POST' });
  confere('responder sem login é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/pendencias/ponte');
  confere('consultar a ponte sem segredo é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/pendencias/ponte', { cabecalhos: { Authorization: 'Bearer errado' } });
  confere('consultar a ponte com segredo errado é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/pendencias/ponte', { metodo: 'PUT', json: { id: 'sem-segredo' } });
  confere('publicar na ponte sem segredo é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/pendencias/ponte/recebidas', { metodo: 'POST', json: { id: 'qualquer' } });
  confere('marcar recebimento sem segredo é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/pendencias/ponte/anexos/qualquer');
  confere('baixar anexo sem segredo é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/atualizar', { metodo: 'POST', json: { ano: 2026 }, cookie: 'meubess_sessao=forjado.assinatura' });
  confere('POST /api/atualizar com cookie forjado é recusado', r.status === 401, `${r.status}`);

  console.log('\nentrar');
  r = await entrar({ email: 'ninguem-cadastrado@exemplo.com.br', senha: 'qualquer-senha-longa' });
  confere('e-mail sem cadastro é barrado', r.status === 303 && r.local.startsWith('/entrar?erro=1') && !r.cookie, `${r.status} → ${r.local}, cookie: ${r.cookie ? 'sim' : 'não'}`);
  r = await entrar({ email: ADMIN.email, senha: `${ADMIN.senha}x` });
  confere('senha errada é barrada, com a mesma resposta', r.status === 303 && r.local.startsWith('/entrar?erro=1') && !r.cookie, `${r.status} → ${r.local}, cookie: ${r.cookie ? 'sim' : 'não'}`);
  r = await pedir('/api/entrar', { metodo: 'POST', form: { email: ADMIN.email, senha: ADMIN.senha, volta: '//outro-site.exemplo' } });
  confere('o "volta" não leva para outro site', r.status === 303 && r.local === '/', `→ ${r.local}`);
  r = await entrar(ADMIN);
  const flags = r.setCookie ? r.setCookie.split(';').slice(1).map((s) => s.trim().split('=')[0]).join(', ') : '';
  confere('o administrador entra (primeiro admin veio do ambiente)', r.status === 303 && r.local === '/dre' && Boolean(r.cookie), `${r.status} → ${r.local}, cookie com ${flags}`);
  const admin = r.cookie;

  console.log('\nlimite de tentativas');
  // E-mails sem cadastro, só deste teste, para não travar o administrador nem a pessoa.
  const errarCom = (email, xff) => pedir('/api/entrar', { metodo: 'POST', form: { email, senha: 'senha-errada-longa', volta: '/dre' }, cabecalhos: { 'X-Forwarded-For': xff } });
  const alvo1 = 'alvo-1-de-teste@exemplo.com.br', alvo2 = 'alvo-2-de-teste@exemplo.com.br';
  for (let i = 0; i < 8; i++) await errarCom(alvo1, `198.51.100.${i}, 203.0.113.9`);
  r = await errarCom(alvo1, '198.51.100.99, 203.0.113.9');
  confere('x-forwarded-for: trocar o primeiro valor não zera o limite (vale o último salto)', r.local?.startsWith('/entrar?erro=espera'), `9ª tentativa → ${r.local}`);
  for (let i = 0; i < 20; i++) await errarCom(alvo2, `198.51.100.${i}`);
  r = await errarCom(alvo2, '198.51.100.250');
  confere('x-forwarded-for: trocar o cabeçalho inteiro a cada tentativa não zera o limite (teto por e-mail)', r.local?.startsWith('/entrar?erro=espera'), `21ª tentativa → ${r.local}`);
  r = await errarCom(alvo1.replace('1', '3'), '198.51.100.1');
  confere('x-forwarded-for: outro e-mail segue livre', r.local?.startsWith('/entrar?erro=1'), `→ ${r.local}`);

  {
    const limite = criarLimite({ janelaMs: 1000, teto: 50 });
    for (let i = 0; i < 500; i++) { limite.errou(`chave-${i}`, 0); if (i % 5 === 0) limite.errou('atacada', 0); }
    confere('teto do mapa: 500 chaves num mapa de teto 50 deixam 50 entradas', limite.tamanho === 50, `${limite.tamanho} entradas`);
    confere('teto do mapa: a chave atacada agora continua contada e travada', limite.bloqueado('atacada', 8, 0), `travada: ${limite.bloqueado('atacada', 8, 0)}`);
    limite.errou('depois-da-janela', 2000);
    confere('teto do mapa: as entradas vencidas são podadas', limite.tamanho === 1, `${limite.tamanho} entrada depois da janela`);
  }

  console.log('\ncom login');
  for (const tela of ['/', '/dre', '/fluxo-de-caixa']) {
    r = await pedir(tela, { cookie: admin });
    confere(`GET ${tela} com login abre`, r.status === 200 && r.texto.includes('Gestão de Contas'), `${r.status}`);
  }
  r = await pedir('/api/atualizar', { metodo: 'POST', json: { ano: 2026 }, cookie: admin });
  confere('POST /api/atualizar com login passa', r.status === 200 && JSON.parse(r.texto).ok === true, `${r.status}`);
  r = await pedir('/admin', { cookie: admin });
  confere('GET /admin do administrador abre', r.status === 200 && r.texto.includes(ADMIN.email), `${r.status}`);

  console.log('\na tela de administrador');
  r = await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: admin, form: { acao: 'criar', email: PESSOA.email, senha: PESSOA.senha } });
  confere('o administrador cadastra uma pessoa', r.status === 303 && r.local.includes('ok='), `→ ${decodeURIComponent(r.local)}`);
  r = await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: admin, form: { acao: 'criar', email: 'outra@exemplo.com.br', senha: sorteio(18) }, cabecalhos: { Origin: 'https://outro-site.exemplo' } });
  confere('um POST vindo de outro site é recusado', r.status === 403, `${r.status}`);
  r = await entrar(PESSOA);
  const pessoa = r.cookie;
  confere('a pessoa cadastrada entra', Boolean(pessoa), `${r.status} → ${r.local}`);
  r = await pedir('/fluxo-de-caixa', { cookie: pessoa });
  confere('a pessoa vê as telas', r.status === 200, `${r.status}`);
  const ponte = { Authorization: `Bearer ${PENDENCIAS_SEGREDO}` };
  const teste = { id: 'teste-portal', titulo: 'Enviar documento', pedido: 'Enviar o documento de teste', motivo: 'Conferir o pedido', status: 'aberta' };
  r = await pedir('/api/pendencias/ponte', { metodo: 'PUT', json: teste, cabecalhos: ponte });
  confere('a ponte cria a pendência com segredo', r.status === 200 && JSON.parse(r.texto).pendencia?.id === teste.id, `${r.status}`);
  r = await pedir('/pendencias', { cookie: pessoa });
  confere('a pessoa vê a pendência', r.status === 200 && r.texto.includes(teste.titulo), `${r.status}`);
  const formulario = new FormData();
  formulario.set('id', teste.id);
  formulario.set('resposta', 'Segue o arquivo de teste.');
  formulario.append('anexos', new File(['arquivo de teste'], 'documento.txt', { type: 'text/plain' }));
  let resposta = await fetch(`${BASE}/api/pendencias/responder`, { method: 'POST', headers: { Cookie: pessoa, Origin: BASE }, body: formulario, redirect: 'manual' });
  confere('a pessoa responde com anexo', resposta.status === 303, `${resposta.status}`);
  r = await pedir('/pendencias', { cookie: pessoa });
  confere('a resposta aparece na tela', r.status === 200 && r.texto.includes('Segue o arquivo de teste.') && r.texto.includes('documento.txt'), `${r.status}`);
  r = await pedir('/api/pendencias/ponte?desde=0', { cabecalhos: ponte });
  const recebidas = r.status === 200 ? JSON.parse(r.texto).respostas : [];
  const recebida = recebidas.find((x) => x.pendenciaId === teste.id);
  confere('a ponte lê texto, e-mail, hora e anexo', Boolean(recebida?.em && recebida.por === PESSOA.email && recebida.texto && recebida.anexos.length === 1), `${r.status}`);
  resposta = await fetch(`${BASE}/api/pendencias/ponte/anexos/${recebida?.anexos[0]?.id}`, { headers: ponte });
  confere('a ponte baixa o anexo', resposta.status === 200 && await resposta.text() === 'arquivo de teste', `${resposta.status}`);
  r = await pedir('/api/pendencias/ponte/recebidas', { metodo: 'POST', json: { id: recebida?.id }, cabecalhos: ponte });
  confere('a ponte marca a resposta recebida', r.status === 200 && Boolean(JSON.parse(r.texto).resposta?.recebidoEm), `${r.status}`);
  r = await pedir(`/api/pendencias/ponte?desde=${recebida?.marcador}`, { cabecalhos: ponte });
  confere('o marcador não repete a resposta', r.status === 200 && JSON.parse(r.texto).respostas.length === 0, `${r.status}`);
  r = await pedir('/admin', { cookie: pessoa });
  confere('a pessoa não entra na tela de administrador', r.status === 403, `${r.status}`);
  r = await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: pessoa, form: { acao: 'criar', email: 'x@exemplo.com.br', senha: sorteio(18) } });
  confere('a pessoa não cadastra ninguém', r.status === 403, `${r.status}`);
  r = await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: admin, form: { acao: 'desativar', email: PESSOA.email } });
  confere('o administrador desativa a pessoa', r.status === 303 && r.local.includes('ok='), `→ ${decodeURIComponent(r.local)}`);
  r = await pedir('/', { cookie: pessoa });
  confere('a sessão aberta da pessoa desativada cai', redirecionaParaEntrar(r), `${r.status} → ${r.local}`);
  r = await entrar(PESSOA);
  confere('a pessoa desativada não entra mais', r.status === 303 && r.local.startsWith('/entrar?erro=1') && !r.cookie, `→ ${r.local}`);
  const outra = sorteio(18);
  await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: admin, form: { acao: 'ativar', email: PESSOA.email } });
  r = await pedir('/api/admin/usuarios', { metodo: 'POST', cookie: admin, form: { acao: 'senha', email: PESSOA.email, senha: outra } });
  const comAntiga = await entrar(PESSOA), comNova = await entrar({ email: PESSOA.email, senha: outra });
  confere('trocada a senha, a antiga é barrada e a nova entra', !comAntiga.cookie && Boolean(comNova.cookie), `antiga: ${comAntiga.local}, nova: ${comNova.local}`);
  const cadastro = fs.readFileSync(path.join(dados, 'usuarios.json'), 'utf8');
  confere('a senha é guardada só embaralhada (scrypt)', !cadastro.includes(ADMIN.senha) && !cadastro.includes(outra) && (cadastro.match(/"scrypt\$/g) ?? []).length === 2, 'nenhuma senha em claro no usuarios.json');

  console.log('\no DFC mandado pelo PC');
  // Uma planilha de mentira: um zip válido sem planilha dentro. A tela não consegue abri-la, e diz isso junto da hora.
  const planilha = zipCom('xl/workbook.xml', crypto.randomBytes(64));
  const sha = crypto.createHash('sha256').update(planilha).digest('hex');
  const lista = { arquivos: [{ nome: '09 - DFC - SET2026.xlsx', sha256: sha }] };
  const comSegredo = (s) => ({ Authorization: `Bearer ${s}` });
  r = await pedir('/api/dfc', { metodo: 'POST', json: lista });
  confere('POST /api/dfc sem o segredo é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/dfc', { metodo: 'GET', cabecalhos: comSegredo(`${DFC_SEGREDO}x`) });
  confere('GET /api/dfc com o segredo errado é recusado', r.status === 401, `${r.status}`);
  r = await pedir('/api/dfc', { metodo: 'POST', json: lista, cabecalhos: comSegredo(DFC_SEGREDO) });
  confere('fechar um envio sem a planilha dá 409 e diz qual falta', r.status === 409 && JSON.parse(r.texto).faltam?.[0] === sha, `${r.status}`);
  r = await fetch(`${BASE}/api/dfc`, { method: 'PUT', headers: comSegredo(DFC_SEGREDO), body: planilha }).then(async (x) => ({ status: x.status, j: await x.json() }));
  confere('PUT /api/dfc com o segredo guarda a planilha', r.status === 200 && r.j.sha256 === sha, `${r.status}`);
  r = await pedir('/api/dfc', { metodo: 'POST', json: lista, cabecalhos: comSegredo(DFC_SEGREDO) });
  const gravado = r.status === 200 ? JSON.parse(r.texto) : {};
  confere('POST /api/dfc fecha o envio e grava a hora', gravado.ok === true && fs.existsSync(path.join(dados, 'dfc', 'envio.json')), `${r.status}, ${gravado.arquivos} arquivo`);
  r = await pedir('/', { cookie: admin });
  confere('a tela mostra a hora do último envio do PC', r.status === 200 && /envio do PC em|enviado pelo PC em/.test(r.texto), `${r.status}`);

  console.log('\nzip descompactado');
  // Uma bomba de verdade: zeros que descompactam acima do teto e, comprimidos, ocupam poucas centenas de KB.
  const bomba = zipCom('xl/worksheets/sheet1.xml', Buffer.alloc(TETO_DESCOMPACTADO + 1024 * 1024));
  r = await fetch(`${BASE}/api/dfc`, { method: 'PUT', headers: comSegredo(DFC_SEGREDO), body: bomba }).then(async (x) => ({ status: x.status, j: await x.json() }));
  confere(`zip descompactado acima do teto é recusado no /api/dfc (${Math.round(bomba.length / 1024)} KB comprimidos)`, r.status === 413 && !fs.readdirSync(path.join(dados, 'dfc', 'pedacos')).some((f) => f.startsWith(crypto.createHash('sha256').update(bomba).digest('hex'))), `${r.status} ${r.j.erro}`);
  const mentirosa = zipCom('xl/workbook.xml', Buffer.from('pouco'), { declarado: 0xfffffff0 });
  r = await fetch(`${BASE}/api/dfc`, { method: 'PUT', headers: comSegredo(DFC_SEGREDO), body: mentirosa }).then(async (x) => ({ status: x.status, j: await x.json() }));
  confere('zip descompactado: o tamanho declarado no diretório central basta para recusar', r.status === 413, `${r.status} ${r.j.erro}`);
  const comBomba = new FormData();
  comBomba.set('id', teste.id);
  comBomba.set('resposta', 'Resposta com anexo grande demais.');
  comBomba.append('anexos', new File([bomba], 'planilha.xlsx'));
  resposta = await fetch(`${BASE}/api/pendencias/responder`, { method: 'POST', headers: { Cookie: admin, Origin: BASE }, body: comBomba, redirect: 'manual' });
  const recusa = await resposta.text();
  confere('zip descompactado acima do teto é recusado como anexo de pendência', resposta.status === 400 && recusa.includes('teto'), `${resposta.status}`);
} catch (e) {
  confere('o teste rodou até o fim', false, e.message);
}

console.log(`\n${total} verificações: ${total - falhas} passaram, ${falhas} falharam.`);
await fim(falhas ? 1 : 0);
