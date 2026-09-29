#!/usr/bin/env node
// MANDA O DFC DESTE PC PARA O SERVIDOR — lê as planilhas como o app sempre leu (a pasta que o OneDrive espelha, ou
// `DFC_DIR`) e as manda inteiras para `POST <MEUBESS_SERVIDOR_URL>/api/dfc`, que as guarda no volume do servidor.
//
//   npm run financeiro-enviar-dfc            # manda
//   npm run financeiro-enviar-dfc -- --seco  # só diz quantos arquivos mandaria; não precisa de endereço nem segredo
//
// PRONTO PARA SER AGENDADO DE HORA EM HORA (Agendador de Tarefas do Windows, por exemplo) — mas não está agendado.
// Termina com código 0 quando o servidor confirmou o envio, e diferente de 0 em qualquer falha, para o agendador ver.
//
// O ENDEREÇO NÃO É FIXO: vem de `MEUBESS_SERVIDOR_URL`, e o segredo de `DFC_ENVIO_SEGREDO` — do ambiente ou do `.env`
// da raiz. O segredo vai só no cabeçalho, e nunca é impresso. Só vai pela rede a planilha que o servidor ainda não tem
// (comparada pelo sha256): as doze juntas pesam dezenas de MB. O endereço tem de ser https (http só para 127.0.0.1 e
// localhost, nos testes). Não escreve nas planilhas.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fonteDaPastaSincronizada } from '../lib/regras/dfc-fonte.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seco = process.argv.includes('--seco');
const falhar = (msg, codigo = 1) => { console.error(`não enviei: ${msg}`); process.exit(codigo); };

if (!process.env.MEUBESS_SERVIDOR_URL || !process.env.DFC_ENVIO_SEGREDO) {
  try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* sem .env: a checagem abaixo diz o que falta */ }
}

const fonte = fonteDaPastaSincronizada();
if (!fonte.disponivel()) falhar(fonte.descrever(), 2);
const nomes = await fonte.arquivos();
if (!nomes.length) falhar('a pasta do DFC não tem nenhum .xlsx', 2);

const arquivos = [];
for (const nome of nomes) {
  const conteudo = await fonte.ler(nome);
  arquivos.push({ nome, conteudo, sha256: crypto.createHash('sha256').update(conteudo).digest('hex') });
}
const bytes = arquivos.reduce((s, a) => s + a.conteudo.length, 0);
console.log(`${arquivos.length} planilhas lidas da ${fonte.nome} (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
if (seco) { console.log('--seco: nada foi enviado.'); process.exit(0); }

const faltam = ['MEUBESS_SERVIDOR_URL', 'DFC_ENVIO_SEGREDO'].filter((v) => !process.env[v]);
if (faltam.length) falhar(`${faltam.join(' e ')} precisa(m) estar no ambiente ou no .env`);

let url;
try { url = new URL('/api/dfc', process.env.MEUBESS_SERVIDOR_URL); } catch { falhar('MEUBESS_SERVIDOR_URL não é um endereço'); }
const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) falhar('o endereço do servidor precisa ser https');

// Um pedido ao servidor, com o segredo no cabeçalho. Qualquer falha de rede ou recusa encerra com código ≠ 0.
async function pedir(metodo, corpo, tipo) {
  let r, j;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${process.env.DFC_ENVIO_SEGREDO}`, ...(tipo ? { 'Content-Type': tipo } : {}) },
      body: corpo,
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    falhar(`o servidor não respondeu (${e.message})`, 3);
  }
  return { status: r.status, ...j };
}

// 1. O que o servidor já tem. 2. Manda só as planilhas que mudaram (ou que ele não tem). 3. Fecha o envio com a lista
// inteira da pasta — é isso que grava a hora, mesmo quando nenhuma planilha mudou.
const tem = await pedir('GET');
if (!tem.ok) falhar(`o servidor recusou (${tem.status}${tem.erro ? `: ${tem.erro}` : ''})`, 4);
const jaTem = new Set((tem.envio?.arquivos ?? []).map((a) => a.sha256));

async function mandar(a) {
  const r = await pedir('PUT', a.conteudo, 'application/octet-stream');
  if (!r.ok || r.sha256 !== a.sha256) falhar(`o servidor recusou ${a.nome} (${r.status}${r.erro ? `: ${r.erro}` : ''})`, 4);
}

let mandadas = 0;
for (const a of arquivos) if (!jaTem.has(a.sha256)) { await mandar(a); mandadas += 1; }
const lista = JSON.stringify({ arquivos: arquivos.map(({ nome, sha256 }) => ({ nome, sha256 })) });
let fechado = await pedir('POST', lista, 'application/json');
if (fechado.status === 409 && Array.isArray(fechado.faltam)) {
  // O servidor jogou fora um pedaço entre o GET e o POST: manda de novo os que faltam, uma vez.
  for (const a of arquivos) if (fechado.faltam.includes(a.sha256)) { await mandar(a); mandadas += 1; }
  fechado = await pedir('POST', lista, 'application/json');
}
if (!fechado.ok) falhar(`o servidor recusou (${fechado.status}${fechado.erro ? `: ${fechado.erro}` : ''})`, 4);
console.log(`${mandadas} planilha(s) mandada(s), ${arquivos.length - mandadas} o servidor já tinha; ele vale com ${fechado.arquivos}. Hora do envio: ${fechado.em}.`);
