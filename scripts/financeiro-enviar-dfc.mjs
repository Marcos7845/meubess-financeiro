#!/usr/bin/env node
// Envia o DFC selecionado neste PC para /api/dfc. A tarefa do Windows roda às 10:00 e 18:00.
// Depois da confirmação do servidor, atualiza o espelho local. Nunca escreve na origem.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fonteDaPastaSincronizada, UNIDADES } from '../lib/regras/dfc-fonte.mjs';
import { espelharDfc } from './espelhar-dfc.mjs';
import { registrarEnvio } from './envio-dfc-log.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(RAIZ, '.cache', 'logs', 'envio-dfc.log');
const seco = process.argv.includes('--seco');
let etapa = 'início';

function falhar(mensagem, codigo = 1) {
  const erro = new Error(mensagem);
  erro.codigo = codigo;
  throw erro;
}

function limpar(mensagem) {
  let texto = String(mensagem);
  for (const segredo of [process.env.DFC_ENVIO_SEGREDO, process.env.MEUBESS_SERVIDOR_URL].filter(Boolean)) {
    texto = texto.replaceAll(segredo, '[oculto]');
  }
  return texto.replace(/[\r\n\t]+/g, ' ').slice(0, 1000);
}

async function executar() {
  etapa = 'configuração';
  if (!process.env.MEUBESS_SERVIDOR_URL || !process.env.DFC_ENVIO_SEGREDO) {
    try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* a checagem abaixo explica o que falta */ }
  }

  etapa = 'seleção da fonte';
  const fonte = fonteDaPastaSincronizada();
  if (!fonte.disponivel()) falhar(fonte.descrever(), 2);
  const nomes = await fonte.arquivos();
  if (!nomes.length) falhar('a pasta do DFC não tem nenhum .xlsx', 2);
  const porUnidade = Object.fromEntries(UNIDADES.map((u) =>
    [u, nomes.filter((nome) => nome.startsWith(`${u}__`) && /DFC/i.test(nome)).length]));
  if (Object.values(porUnidade).some((n) => n === 0)) {
    falhar('o envio exige DFC das quatro unidades (3N, B3N, B3W, N3)', 2);
  }
  console.log(`fontes DFC por unidade: ${Object.entries(porUnidade).map(([u, n]) => `${u}=${n}`).join(', ')}.`);

  etapa = 'leitura das planilhas';
  const arquivos = [];
  for (const nome of nomes) {
    const conteudo = await fonte.ler(nome);
    arquivos.push({ nome, conteudo, sha256: crypto.createHash('sha256').update(conteudo).digest('hex') });
  }
  const bytes = arquivos.reduce((s, a) => s + a.conteudo.length, 0);
  console.log(`${arquivos.length} planilhas lidas da ${fonte.nome} (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
  if (seco) { console.log('--seco: nada foi enviado nem espelhado.'); return; }

  etapa = 'validação do servidor';
  const faltam = ['MEUBESS_SERVIDOR_URL', 'DFC_ENVIO_SEGREDO'].filter((v) => !process.env[v]);
  if (faltam.length) falhar(`${faltam.join(' e ')} precisa(m) estar no ambiente ou no .env`);
  let url;
  try { url = new URL('/api/dfc', process.env.MEUBESS_SERVIDOR_URL); }
  catch { falhar('MEUBESS_SERVIDOR_URL não é um endereço'); }
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    falhar('o endereço do servidor precisa ser https');
  }

  async function pedir(metodo, corpo, tipo) {
    let resposta, json;
    try {
      resposta = await fetch(url, {
        method: metodo,
        headers: { Authorization: `Bearer ${process.env.DFC_ENVIO_SEGREDO}`, ...(tipo ? { 'Content-Type': tipo } : {}) },
        body: corpo,
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });
      json = await resposta.json().catch(() => ({}));
    } catch (e) {
      falhar(`o servidor não respondeu (${e.message})`, 3);
    }
    return { status: resposta.status, ...json };
  }

  etapa = 'consulta ao servidor';
  const tem = await pedir('GET');
  if (!tem.ok) falhar(`o servidor recusou (${tem.status}${tem.erro ? `: ${tem.erro}` : ''})`, 4);
  const jaTem = new Set((tem.envio?.arquivos ?? []).map((a) => a.sha256));

  async function mandar(arquivo) {
    const resposta = await pedir('PUT', arquivo.conteudo, 'application/octet-stream');
    if (!resposta.ok || resposta.sha256 !== arquivo.sha256) {
      falhar(`o servidor recusou ${arquivo.nome} (${resposta.status}${resposta.erro ? `: ${resposta.erro}` : ''})`, 4);
    }
  }

  etapa = 'envio das planilhas';
  let mandadas = 0;
  for (const arquivo of arquivos) {
    if (!jaTem.has(arquivo.sha256)) { await mandar(arquivo); mandadas += 1; }
  }
  const lista = JSON.stringify({ arquivos: arquivos.map(({ nome, sha256 }) => ({ nome, sha256 })) });
  etapa = 'confirmação do envio';
  let fechado = await pedir('POST', lista, 'application/json');
  if (fechado.status === 409 && Array.isArray(fechado.faltam)) {
    etapa = 'reenvio das planilhas faltantes';
    for (const arquivo of arquivos) {
      if (fechado.faltam.includes(arquivo.sha256)) { await mandar(arquivo); mandadas += 1; }
    }
    etapa = 'segunda confirmação do envio';
    fechado = await pedir('POST', lista, 'application/json');
  }
  if (!fechado.ok) {
    falhar(`o servidor recusou (${fechado.status}${fechado.erro ? `: ${fechado.erro}` : ''})`, 4);
  }
  console.log(`${mandadas} planilha(s) mandada(s), ${arquivos.length - mandadas} o servidor já tinha; ele vale com ${fechado.arquivos}. Hora do envio: ${fechado.em}.`);

  etapa = 'atualização do espelho';
  const espelho = await espelharDfc({ fonte, nomes, destino: path.join(RAIZ, '.cache', 'dfc-2026') });
  console.log(`espelho DFC: ${Object.entries(espelho).map(([u, n]) => `${u}=${n}`).join(', ')}.`);
}

try {
  await executar();
  etapa = 'registro do resultado';
  await registrarEnvio({ arquivo: LOG, resultado: seco ? 'seco' : 'sucesso', etapa });
} catch (erro) {
  const mensagem = limpar(erro?.message ?? erro);
  console.error(`${etapa === 'registro do resultado' ? 'não registrei o resultado' : 'não enviei'}: ${etapa}: ${mensagem}`);
  try {
    await registrarEnvio({ arquivo: LOG, resultado: 'erro', etapa, erro: mensagem });
  } catch (erroDoLog) {
    console.error(`não gravei o log: ${limpar(erroDoLog?.message ?? erroDoLog)}`);
  }
  process.exitCode = erro.codigo ?? 1;
}
