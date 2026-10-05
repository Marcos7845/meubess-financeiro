#!/usr/bin/env node
// O QUE O PORTAL MOSTRA, SEM NAVEGADOR — chama `GET /api/pendencias/ponte/telas` e imprime, para cada uma das três
// telas, o mês exibido e os cartões, com valor e fonte.
//
//   npm run conferir-no-ar -- 2026 10              # um mês
//   npm run conferir-no-ar -- 2026 9 --unidade B3W # uma unidade do DFC
//   npm run conferir-no-ar                         # sem mês: o que a tela abre sozinha
//
// O ENDEREÇO vem de `MEUBESS_SERVIDOR_URL` e o segredo de `PENDENCIAS_PONTE_SEGREDO`, do ambiente ou do `.env` da raiz
// (o mesmo de `scripts/pendencias-ponte.mjs`). O segredo vai só no cabeçalho e nunca é impresso. Os valores saem só
// no terminal, como em `scripts/conferir-dfc-consolidado.mjs`: não grava arquivo nenhum.
//
// QUANDO O MÊS ESTÁ EM `docs/telas-conferidas.md`, compara a CONTAGEM de cada cartão (DFC e Omie) com a que aquele
// documento publica — é o que ele publica; valor em reais não entra em arquivo versionado. Termina com 0 quando tudo
// bate (ou não há o que comparar), 1 quando alguma contagem diverge e ≠ 0 em qualquer falha da ponte.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDoAmbiente, FalhaDaPonte } from './pendencias-ponte.mjs';
import { emReais, emPorcento } from '../app/dinheiro.js';
import { NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const falha = (msg, codigo = 1) => { throw new FalhaDaPonte(msg, codigo); };

function baseDe(url) {
  if (!url) falha('MEUBESS_SERVIDOR_URL precisa estar no ambiente ou no .env');
  let u;
  try { u = new URL(url); } catch { falha('MEUBESS_SERVIDOR_URL não é um endereço'); }
  const local = ['127.0.0.1', 'localhost'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) falha('o endereço do servidor precisa ser https');
  return u;
}

export async function lerNoAr(cfg, { ano, mes, unidade } = {}) {
  if (!cfg.segredo) falha('PENDENCIAS_PONTE_SEGREDO precisa estar no ambiente ou no .env', 6);
  const url = new URL('/api/pendencias/ponte/telas', baseDe(cfg.url));
  if (ano) url.searchParams.set('ano', String(ano));
  if (mes) url.searchParams.set('mes', String(mes));
  if (unidade) url.searchParams.set('unidade', unidade);
  let r;
  try {
    r = await (cfg.fetch ?? fetch)(url, { headers: { Authorization: `Bearer ${cfg.segredo}` }, signal: AbortSignal.timeout(5 * 60 * 1000) });
  } catch (e) {
    falha(`o servidor não respondeu (${e.message})`, 3);
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) falha('404 — o portal publicado ainda não tem a rota /api/pendencias/ponte/telas', 5);
  if (r.status === 401) falha('401 — segredo ausente ou diferente (PENDENCIAS_PONTE_SEGREDO nos dois lados)', 6);
  if (!r.ok || j.ok === false) falha(`o servidor recusou (${r.status}${j.erro ? `: ${j.erro}` : ''})`, 4);
  return j;
}

// ---------------------------------------------------------------- docs/telas-conferidas.md

const norm = (s) => String(s ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// Os cartões cujo nome curto na tela não é o nome da linha do documento.
const NOME_NO_DOCUMENTO = {
  'despesas-pagas': 'Despesas pagas', 'despesas-pendentes': 'Despesas pendentes',
  'despesas-funcionarios': 'Despesas com funcionários', 'percentual-funcionarios': '% desp. funcionários / receita líquida',
};

// Lê do texto do documento o mês conferido e, de cada linha "- **Tela N — Nome.** **Na tela:** DFC a e Omie b.", a
// contagem que a tela mostrava.
export function lerConferidas(texto) {
  const titulo = /—\s*([a-zç]+) de (\d{4})/i.exec(texto.split('\n')[0] ?? '');
  const mes = titulo ? NOMES_DOS_MESES.indexOf(titulo[1].toLocaleLowerCase('pt-BR')) : -1;
  const linhas = new Map();
  for (const m of texto.matchAll(/^- \*\*(Tela \d) — (.+?)\.\*\* \*\*Na tela:\*\* ([^*]+?)\.\s/gm)) {
    const dfc = /DFC (\d+)/.exec(m[3]), omie = /Omie (\d+)/.exec(m[3]);
    linhas.set(`${m[1]}|${norm(m[2])}`, { dfc: dfc ? Number(dfc[1]) : null, omie: omie ? Number(omie[1]) : null });
  }
  return { ano: titulo ? Number(titulo[2]) : null, mes: mes > 0 ? mes : null, linhas };
}

// Para cada cartão: `bate`, `difere` (com o esperado) ou `sem linha` (o documento não publica aquele cartão).
export function comparar(tela, conferidas) {
  if (!conferidas || conferidas.ano !== tela.ano || conferidas.mes !== tela.mes) return null;
  return tela.cartoes.map((c) => {
    const e = conferidas.linhas.get(`${tela.tela}|${norm(NOME_NO_DOCUMENTO[c.id] ?? c.nome)}`);
    if (!e) return { id: c.id, estado: 'sem linha' };
    const bate = e.dfc === c.contagem.dfc && e.omie === c.contagem.omie;
    return { id: c.id, estado: bate ? 'bate' : 'difere', esperado: e };
  });
}

const contagem = (c) => [c.dfc !== null ? `DFC ${c.dfc}` : null, c.omie !== null ? `Omie ${c.omie}` : null].filter(Boolean).join(', ') || '—';
const valor = (c) => {
  if (c.valor === null) return '—';
  return c.tipo === 'percentual' ? emPorcento(c.valor) : emReais(c.negativo && c.valor ? -c.valor : c.valor);
};

// O texto do terminal: mês, cartões e fonte; e, quando o mês está no documento, a comparação das contagens.
export function relatorio(r, conferidas) {
  const out = [];
  let divergentes = 0;
  out.push(`pedido: ${r.mesPadrao ? 'sem ?mes= (o mês que a tela abre sozinha)' : `?ano=${r.ano}&mes=${r.mes}`}${r.unidade ? `, unidade ${r.unidade}` : ''}`);
  for (const t of r.telas) {
    out.push('', `${t.tela} (${t.rota}) — mês exibido: ${NOMES_DOS_MESES[t.mes]} de ${t.ano}; DFC ${t.dfc.ok ? `lido (${t.dfc.arquivo ?? 'consolidado'})` : 'sem planilha do mês'}${t.dfc.unidadesFaltantes.length ? `, faltam ${t.dfc.unidadesFaltantes.join(', ')}` : ''}`);
    // O documento confere a tela aberta sem filtro; com unidade escolhida não há o que comparar.
    const cmp = r.unidade ? null : comparar(t, conferidas);
    const porId = new Map((cmp ?? []).map((x) => [x.id, x]));
    for (const c of t.cartoes) {
      const x = porId.get(c.id);
      const conf = !x ? '' : x.estado === 'bate' ? ' · conferido: bate'
        : x.estado === 'difere' ? ` · conferido: DIFERE (documento: ${contagem(x.esperado)})` : ' · conferido: sem linha no documento';
      if (x?.estado === 'difere') divergentes += 1;
      out.push(`  ${c.nome}: ${valor(c)} [${c.fontes.join('+')}] (${contagem(c.contagem)})${conf}`);
      if (c.recorteB3W) out.push(`    recorte B3W: todas as contas ${emReais(-c.recorteB3W.todas)}; Itaú ${c.recorteB3W.itau === null ? '—' : emReais(-c.recorteB3W.itau)}`);
    }
    if (!cmp) out.push(r.unidade ? '  (sem comparação: docs/telas-conferidas.md confere a tela sem unidade escolhida)'
      : `  (sem comparação: docs/telas-conferidas.md é de ${conferidas?.mes ? `${NOMES_DOS_MESES[conferidas.mes]} de ${conferidas.ano}` : 'mês nenhum'})`);
  }
  return { texto: out.join('\n'), divergentes };
}

// ---------------------------------------------------------------- linha de comando

async function principal(argv) {
  const numeros = argv.filter((a) => /^\d+$/.test(a)).map(Number);
  const i = argv.indexOf('--unidade');
  const unidade = i >= 0 ? argv[i + 1] : null;
  const [ano, mes] = numeros;
  const r = await lerNoAr(configDoAmbiente(), { ano, mes, unidade });
  let conferidas = null;
  try { conferidas = lerConferidas(fs.readFileSync(path.join(RAIZ, 'docs', 'telas-conferidas.md'), 'utf8')); } catch { /* sem o documento: só imprime */ }
  const { texto, divergentes } = relatorio(r, conferidas);
  console.log(texto);
  if (divergentes) { console.log(`\n${divergentes} cartão(ões) com contagem diferente de docs/telas-conferidas.md.`); return 1; }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.error(`falhou: ${e.message}`);
    process.exit(e instanceof FalhaDaPonte ? e.codigo : 1);
  });
}
