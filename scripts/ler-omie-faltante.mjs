#!/usr/bin/env node
// AS QUATRO LEITURAS DO OMIE QUE FALTAVAM NO CACHE, PARA A CONFERÊNCIA DOS NÚMEROS DAS TELAS
//
// `scripts/numeros-das-telas.mjs` lê só do cache local `.cache/omie/` (fora do git). Quatro indicadores de
// `docs/fontes.md` pedem leituras que `scripts/confronto-dfc-omie.mjs` nunca fez, e por isso saíam "a conferir:".
// Este script faz essas quatro leituras e grava no mesmo cache, com a mesma chave (empresa + serviço + método +
// sha1 dos parâmetros), para que o outro script as ache sozinho.
//
// SÓ LEITURA. Quatro métodos de consulta, nenhum que inclua, altere ou exclua:
//   1. `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` por VENCIMENTO (01/01 a 31/12 do ano)
//      — "Despesas pendentes" da Tela 1.
//   2. `financas/mf` → `ListarMovimentos` SEM `cTpLancamento` por data de pagamento (01/01 a 30/09), a mesma
//      leitura que `docs/fontes.md` conta, mas COM `cExibirDepartamentos: "S"` — "Top 10 despesas" da Tela 1.
//   3. `geral/clientes` → `ListarClientesResumido` — o eixo do "Valor previsto por cliente" da Tela 3.
//   4. `geral/dre` → `ListarCadastroDRE` — o `totalizaDRE` da "Receita bruta" da Tela 2.
//
// NADA DO QUE VEM DO OMIE É IMPRESSO AQUI além de contagens: nem valor em reais, nem nome, nem documento, nem a
// chave — nem em erro. As respostas cruas ficam só no cache local, que o `.gitignore` mantém fora de todo commit.
//
//   node scripts/ler-omie-faltante.mjs            # usa o que já está no cache e busca só o que falta
//   node scripts/ler-omie-faltante.mjs --ano 2026

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.cache', 'omie');
const BASE = 'https://app.omie.com.br/api/v1/';
const PAUSA_MS = 1200;

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const EMPRESAS = [1, 2];

const falhar = (m) => { console.error(m); process.exit(1); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (p) => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const arqCache = (emp, servico, call, param) =>
  path.join(CACHE, `${emp}-${servico.replace(/\W+/g, '-')}-${call}-${sha(param)}.json`);

let doCache = 0, doOmie = 0;

async function chamar(emp, servico, call, param) {
  const arq = arqCache(emp, servico, call, param);
  if (fs.existsSync(arq)) {
    try { const j = JSON.parse(fs.readFileSync(arq, 'utf8')); doCache++; return { json: j, veioDoCache: true }; }
    catch { /* cache ilegível: busca de novo */ }
  }
  let ultimo = '';
  for (let n = 1; n <= 4; n++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call,
          app_key: process.env[`OMIE_MEUBESS_${emp}_APP_KEY`],
          app_secret: process.env[`OMIE_MEUBESS_${emp}_APP_SECRET`],
          param: [param],
        }),
        signal: ac.signal,
      });
      let json = null;
      try { json = await resp.json(); } catch { /* corpo não-JSON */ }
      if (json?.faultstring) {
        ultimo = `empresa ${emp} ${servico} ${call}: ${json.faultcode ?? '?'} ${json.faultstring}`;
        // "não encontrado" não é erro: é lista vazia.
        if (/n[aã]o.*(encontrad|existe)|0 registros/i.test(String(json.faultstring))) {
          fs.mkdirSync(CACHE, { recursive: true });
          fs.writeFileSync(arq, JSON.stringify({ _vazio: true, nTotPaginas: 1, nTotRegistros: 0 }), 'utf8');
          doOmie++;
          return { json: { _vazio: true, nTotPaginas: 1, nTotRegistros: 0 }, veioDoCache: false };
        }
        if (!/REDUNDANT|consumo|aguarde|bloquead/i.test(`${json.faultcode} ${json.faultstring}`)) falhar(ultimo);
      } else if (json && resp.ok) {
        fs.mkdirSync(CACHE, { recursive: true });
        fs.writeFileSync(arq, JSON.stringify(json), 'utf8');
        doOmie++;
        return { json, veioDoCache: false };
      } else {
        ultimo = `empresa ${emp} ${servico} ${call}: HTTP ${resp.status}`;
        if (resp.status < 500 && resp.status !== 425 && resp.status !== 429) falhar(ultimo);
      }
    } catch {
      ultimo = `empresa ${emp} ${servico} ${call}: sem resposta do Omie (rede ou tempo limite)`;
    } finally { clearTimeout(t); }
    await espera(PAUSA_MS * n * 3);
  }
  return falhar(`${ultimo} (desisti após 4 tentativas)`);
}

// Percorre todas as páginas de uma leitura paginada. `param(n)` monta os parâmetros da página n.
async function todasAsPaginas(emp, servico, call, param, campo, rotulo) {
  let total = 1, itens = 0;
  for (let n = 1; n <= total; n++) {
    const { json, veioDoCache } = await chamar(emp, servico, call, param(n));
    total = Number(json.nTotPaginas ?? json.total_de_paginas) || 1;
    itens += (json[campo] ?? []).length;
    if (n === 1 || n % 10 === 0 || n === total) console.log(`    empresa ${emp} — ${rotulo}: página ${n}/${total}, ${itens} registro(s)`);
    if (!veioDoCache) await espera(PAUSA_MS);
  }
  return itens;
}

// ---------------------------------------------------------------- as quatro leituras

// 1. Títulos a pagar por VENCIMENTO. É a leitura que `docs/fontes.md` pede para "Despesas pendentes"; o ano inteiro,
//    para que qualquer mês fechado seja recortado dele pela `dDtVenc` de cada lançamento — o mesmo que a consulta do
//    mês devolveria.
const LEITURA_CP_VENC = (n) => ({
  nPagina: n, nRegPorPagina: 100, cTpLancamento: 'CP',
  dDtVencDe: `01/01/${ANO}`, dDtVencAte: `31/12/${ANO}`,
});
// 2. A leitura de caixa que `docs/fontes.md` conta (sem `cTpLancamento`), agora COM o rateio por departamento.
const LEITURA_MF_DEP = (n) => ({
  nPagina: n, nRegPorPagina: 100,
  dDtPagtoDe: `01/01/${ANO}`, dDtPagtoAte: `30/09/${ANO}`,
  cExibirDepartamentos: 'S',
});
// 3. O cadastro de clientes, resumido.
const LEITURA_CLIENTES = (n) => ({ pagina: n, registros_por_pagina: 100, apenas_importado_api: 'N' });
// 4. O cadastro das contas do DRE — a mesma chamada de `scripts/contas-dre-omie.mjs`.
const LEITURA_DRE = { apenasContasAtivas: 'N' };

async function principal() {
  try { process.loadEnvFile(path.join(RAIZ, '.env')); }
  catch { falhar('arquivo .env não encontrado ou ilegível na raiz do repositório'); }
  const faltam = EMPRESAS.flatMap((e) => [`OMIE_MEUBESS_${e}_APP_KEY`, `OMIE_MEUBESS_${e}_APP_SECRET`]).filter((v) => !process.env[v]);
  if (faltam.length) falhar(`${faltam.join(', ')} precisa(m) estar preenchida(s) no .env`);

  for (const emp of EMPRESAS) {
    console.log(`  empresa ${emp}`);
    await todasAsPaginas(emp, 'financas/mf', 'ListarMovimentos', LEITURA_CP_VENC, 'movimentos', 'títulos a pagar por vencimento (CP)');
    await todasAsPaginas(emp, 'financas/mf', 'ListarMovimentos', LEITURA_MF_DEP, 'movimentos', 'caixa com departamentos');
    await todasAsPaginas(emp, 'geral/clientes', 'ListarClientesResumido', LEITURA_CLIENTES, 'clientes_cadastro_resumido', 'clientes (resumido)');
    const { json, veioDoCache } = await chamar(emp, 'geral/dre', 'ListarCadastroDRE', LEITURA_DRE);
    console.log(`    empresa ${emp} — cadastro do DRE: ${(json.dreLista ?? []).length} conta(s)`);
    if (!veioDoCache) await espera(PAUSA_MS);
  }
  console.log(`\n${doCache} resposta(s) já estavam no cache, ${doOmie} vieram do Omie agora.`);
  console.log(`Cache: ${path.relative(RAIZ, CACHE)} (fora do git).`);
}

principal();
