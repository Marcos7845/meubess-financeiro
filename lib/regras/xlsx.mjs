// Ler uma planilha .xlsx sem dependência: zip, sharedStrings, abas, células e datas.
//
// Saiu inteiro de `scripts/numeros-das-telas.mjs` quando o app passou a ler o mesmo DFC. É código de FORMATO, não de
// regra: não sabe o que é receita nem despesa. A regra do DFC mora em `dfc.mjs`; o vocabulário, em `dfc-vocabulario.mjs`.

import zlib from 'node:zlib';

function lerZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('não é um zip (EOCD não encontrado)');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const arquivos = new Map();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), comentLen = buf.readUInt16LE(p + 32);
    arquivos.set(buf.toString('utf8', p + 46, p + 46 + nomeLen), { metodo, compSize, offset: buf.readUInt32LE(p + 42) });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return {
    ler(nome) {
      const e = arquivos.get(nome);
      if (!e) return null;
      const lh = e.offset;
      const ini = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
      const cru = buf.subarray(ini, ini + e.compSize);
      return e.metodo === 0 ? cru : zlib.inflateRawSync(cru);
    },
  };
}
const desescapar = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const textoDosT = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g)].map((m) => (m[1] ? desescapar(m[1]) : '')).join('');
function sharedStrings(zip) {
  const b = zip.ler('xl/sharedStrings.xml');
  if (!b) return [];
  return [...b.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] ? textoDosT(m[1]) : ''));
}
function abasDo(zip) {
  const wb = zip.ler('xl/workbook.xml').toString('utf8');
  const rels = (zip.ler('xl/_rels/workbook.xml.rels') || Buffer.from('')).toString('utf8');
  const alvo = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) alvo.set(id, t.replace(/^\/?xl\//, '').replace(/^\.\//, ''));
  }
  return [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => ({
    nome: desescapar(/name="([^"]*)"/.exec(m[0])?.[1] ?? ''),
    parte: 'xl/' + (alvo.get(/r:id="([^"]+)"/.exec(m[0])?.[1]) ?? ''),
  }));
}
// AS LINHAS E AS CÉLULAS DE UMA ABA, CRUAS — o único lugar deste repositório que parte o XML de uma aba em linhas e
// células. `lerAba`, abaixo, e `inventariarAba`, de `scripts/estrutura-dfc.mjs`, leem por aqui.
//
// A ORDEM DAS DUAS ALTERNATIVAS É A CORREÇÃO DE 29/09/2026. Antes, a expressão tentava primeiro `<c\b([^>]*)>…<\/c>` e
// só depois a célula fechada em si mesma. Só que `[^>]*` aceita a barra, então uma célula vazia como
// `<c r="I7" s="634"/>` casava como célula ABERTA, e o conteúdo dela ia até o `</c>` da célula SEGUINTE: a vazia
// ficava com o valor da vizinha, e a vizinha sumia. Na linha 3 do `FLUXO DE CAIXA` de agosto de 2026, `TIPO` (vazio)
// ficava com a data de `VENCIMENTO`, `TITULO` (vazio) com a `CLASS. CONTABIL` e `ENTRADA` (vazia) com a `SAIDA`. A
// linha vazia `<row r="5" .../>` fazia o mesmo com a linha seguinte inteira — e ela existe de fato nas planilhas: 68
// na primeira aba dos arquivos de abril a julho, 287 na `BASE` de abril, e outras nas abas de cartão, comissão e vendas PJ. Agora a forma
// fechada em si mesma é casada PRIMEIRO, e sai vazia. O que isso mudou nas telas está em `docs/telas-conferidas.md`,
// na tabela "antes e depois da correção do leitor".
//
// Devolve `[{ n, attrs, celulas: [{ ref, attrs, corpo }] }]`, sem interpretar nada; célula vazia vem com `corpo` ''.
function linhasCruas(xml) {
  const linhas = [];
  for (const mr of xml.matchAll(/<row\b([^>]*?)\/>|<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attrs = mr[1] ?? mr[2] ?? '';
    const celulas = [];
    for (const mc of (mr[3] ?? '').matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ca = mc[1] ?? mc[2] ?? '';
      celulas.push({ ref: /r="([A-Z]+\d+)"/.exec(ca)?.[1] ?? '', attrs: ca, corpo: mc[3] ?? '' });
    }
    linhas.push({ n: +(/r="(\d+)"/.exec(attrs)?.[1] ?? 0), attrs, celulas });
  }
  return linhas;
}
// UMA ABA, CÉLULA POR CÉLULA: `[{ n, cel: Map(coluna → { t } | { v }) }]`, só as linhas com alguma célula preenchida.
// É a leitura de planilha de todo o repositório — telas, conferência e scripts.
function lerAba(zip, parte, ss) {
  const b = zip.ler(parte);
  if (!b) return null;
  const linhas = [];
  for (const { n, celulas } of linhasCruas(b.toString('utf8'))) {
    const cel = new Map();
    for (const { ref, attrs: ca, corpo: cc } of celulas) {
      const col = /^([A-Z]+)/.exec(ref)?.[1];
      if (!col) continue;
      const tipo = /t="([^"]*)"/.exec(ca)?.[1] ?? 'n';
      const v = /<v>([\s\S]*?)<\/v>/.exec(cc)?.[1];
      if (tipo === 's') { const t = (ss[+v] ?? '').trim(); if (t) cel.set(col, { t }); }
      else if (tipo === 'inlineStr') { const t = textoDosT(cc).trim(); if (t) cel.set(col, { t }); }
      else if (tipo === 'str') { const t = desescapar(v ?? '').trim(); if (t) cel.set(col, { t }); }
      else if (v !== undefined && v !== '' && Number.isFinite(Number(v))) cel.set(col, { v: Number(v) });
    }
    if (cel.size) linhas.push({ n, cel });
  }
  return linhas;
}
function dataDaCelula(c) {
  if (!c) return null;
  if (c.v !== undefined) {
    if (!(c.v > 20000 && c.v < 80000)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c.v) * 86400000);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(c.t ?? '');
  if (!m) return null;
  return { a: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: +m[2], d: +m[1] };
}
// As colunas de dia do bloco pronto da aba do mês: de `D` a `AH`, como `docs/fontes.md` escreve.
const COLUNAS_DE_DIA = new Set([
  ...'DEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'ABCDEFGH'.split('').map((c) => `A${c}`),
]);
const SUB2_SALDO = new Set(['SALDO INICIAL', 'SALDO FINAL', 'SALDO INICIAL PROVISAO', 'SALDO FINAL PROVISAO']);
// O dia de uma linha do `FLUXO DE CAIXA`: `DIA PG`, e sem ele `VENCIMENTO`. Até 29/09/2026 a lista tinha também
// `TIPO`, que só trazia data porque a célula vazia dele engolia a de `VENCIMENTO` ao lado; lida certa, `TIPO` não
// tem data em linha nenhuma dos doze arquivos de 2026 (traz `PRIMEIRO DIA`, `ULTIMO DIA`, "cartão itau"…).
const COLUNAS_DE_DATA = ['DIA PG', 'VENCIMENTO'];
const BAIXADO = (p) => p !== '' && p !== 'A PAGAR' && p !== 'A RECEBER';

export { lerZip, sharedStrings, abasDo, linhasCruas, lerAba, dataDaCelula, desescapar, textoDosT, COLUNAS_DE_DIA, SUB2_SALDO, COLUNAS_DE_DATA, BAIXADO };
