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

const env = {
  ...process.env,
  NODE_ENV: 'production',
  MEUBESS_DIST: DIST,
  MEUBESS_DADOS_DIR: dados,
  SESSAO_SEGREDO: sorteio(48),
  DFC_ENVIO_SEGREDO: DFC_SEGREDO,
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
  for (const tela of ['/', '/dre', '/fluxo-de-caixa', '/admin']) {
    const r = await pedir(tela);
    confere(`GET ${tela} sem login é recusado`, redirecionaParaEntrar(r), `${r.status} → ${r.local}`);
  }
  let r = await pedir('/api/atualizar', { metodo: 'POST', json: { ano: 2026 } });
  confere('POST /api/atualizar sem login é recusado', r.status === 401, `${r.status} ${r.texto}`);
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
  // Uma planilha de mentira: basta começar como um zip. A tela não consegue abri-la, e diz isso junto da hora.
  const planilha = Buffer.concat([Buffer.from('PK\x03\x04'), crypto.randomBytes(64)]);
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
} catch (e) {
  confere('o teste rodou até o fim', false, e.message);
}

console.log(`\n${total} verificações: ${total - falhas} passaram, ${falhas} falharam.`);
await fim(falhas ? 1 : 0);
