#!/usr/bin/env node
// Confronta as DUAS fontes das Telas 1 e 2 nos meses fechados de 2026 (janeiro a setembro), por decisão do dono
// (24/09/2026): o DFC (planilhas de fluxo de caixa, pasta DFC/2026 sincronizada pelo OneDrive) e o Omie (empresas 1 e 2
// somadas, regime de caixa). "Para complemento e confronto de informações" — o confronto, não a troca de fonte.
//
// SÓ LEITURA, dos dois lados:
//   - DFC: abre os .xlsx da pasta sincronizada em modo leitura (fs.readFileSync). Nunca grava, move nem abre para
//     edição nenhum arquivo de lá, e nunca copia planilha para o repositório.
//   - Omie: financas/mf ListarMovimentos e geral/categorias ListarCategorias. Nenhum método que inclua, altere ou
//     exclua.
//
// O QUE SAI ONDE:
//   - no CONSOLE: só contagens e percentuais. Nenhum valor em reais, nenhum nome de cliente, fornecedor ou pessoa.
//   - na PÁGINA (docs/confronto-dfc-omie.html, gravada por este script): os valores em reais. A página fica no
//     repositório e não sai da máquina.
//
// CACHE DAS LEITURAS DO OMIE: cada resposta da API é gravada em `.cache/omie/` na raiz do repositório — pasta que o
// `.gitignore` ignora, então ela nunca entra num commit. Rodar o script de novo não chama a API: lê do cache e a
// rodada inteira leva segundos. Para buscar de novo no Omie (fechou mais um mês, mudou a faixa), use `--atualizar`.
//
// Uso:
//   node scripts/confronto-dfc-omie.mjs                 # lê as duas fontes (Omie pelo cache, se houver) e grava a página
//   node scripts/confronto-dfc-omie.mjs --atualizar     # ignora o cache e busca tudo no Omie de novo
//   node scripts/confronto-dfc-omie.mjs --so-dfc        # só o lado DFC (não chama o Omie)
//   DFC_DIR=<caminho> node scripts/confronto-dfc-omie.mjs
// Credencial do Omie: .env da raiz (fora do git), OMIE_MEUBESS_1_APP_KEY/SECRET e OMIE_MEUBESS_2_APP_KEY/SECRET.
// Node 21.7+, sem dependências.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const ANO = 2026;
const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // meses fechados: o DFC só tem movimento até setembro
const NOME_MES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SO_DFC = process.argv.includes("--so-dfc");
const ATUALIZAR = process.argv.includes("--atualizar");   // ignora o cache e busca de novo no Omie

const T0 = Date.now();
const seg = (ms) => `${(ms / 1000).toFixed(1)} s`;

const falhar = (msg) => { console.log(`ERRO: ${msg}`); process.exit(1); };
const cent = (v) => Math.round(v * 100);              // centavos: evita o 0,000001 do ponto flutuante
const pct = (a, b) => (b === 0 ? null : (a / b) * 100);
const fmtPct = (p, casas = 1) => (p === null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(casas)}%`);
const semSinal = (p, casas = 1) => (p === null ? "—" : `${p.toFixed(casas)}%`);

// ============================================================ lado DFC: ler o .xlsx (zip + xml, sem dependência)

function lerZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("não é um zip (EOCD não encontrado)");
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const arquivos = new Map();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    arquivos.set(buf.toString("utf8", p + 46, p + 46 + nomeLen), { metodo, compSize, offset });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return {
    ler(nome) {
      const e = arquivos.get(nome);
      if (!e) return null;
      const lh = e.offset;
      if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error("cabeçalho local inválido: " + nome);
      const ini = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
      const cru = buf.subarray(ini, ini + e.compSize);
      return e.metodo === 0 ? cru : zlib.inflateRawSync(cru);
    },
  };
}

const desescapar = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");

function textoDosT(xml) {
  const out = [];
  for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g)) out.push(m[1] ? desescapar(m[1]) : "");
  return out.join("");
}

function sharedStrings(zip) {
  const b = zip.ler("xl/sharedStrings.xml");
  if (!b) return [];
  const xml = b.toString("utf8");
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) out.push(m[1] ? textoDosT(m[1]) : "");
  return out;
}

function abas(zip) {
  const wb = zip.ler("xl/workbook.xml").toString("utf8");
  const rels = (zip.ler("xl/_rels/workbook.xml.rels") || Buffer.from("")).toString("utf8");
  const alvo = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const t = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) alvo.set(id, t.replace(/^\/?xl\//, "").replace(/^\.\//, ""));
  }
  const lista = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*\/>/g)) {
    const nome = desescapar(/name="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    lista.push({ nome, parte: "xl/" + (alvo.get(rid) ?? "") });
  }
  return lista;
}

const colDeRef = (r) => /^([A-Z]+)/.exec(r)?.[1] ?? "";

// Linhas da aba, cada uma como { n, cel: Map(coluna -> {t?: texto, v?: número}) }.
function lerAbaCompleta(zip, parte, ss) {
  const b = zip.ler(parte);
  if (!b) return null;
  const xml = b.toString("utf8");
  const linhas = [];
  for (const mr of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const attrs = mr[1] ?? mr[3] ?? "";
    const corpo = mr[2] ?? "";
    const n = +(/r="(\d+)"/.exec(attrs)?.[1] ?? 0);
    const cel = new Map();
    for (const mc of corpo.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const ca = mc[1] ?? mc[3] ?? "";
      const cc = mc[2] ?? "";
      const col = colDeRef(/r="([A-Z]+\d+)"/.exec(ca)?.[1] ?? "");
      if (!col) continue;
      const tipo = /t="([^"]*)"/.exec(ca)?.[1] ?? "n";
      const v = /<v>([\s\S]*?)<\/v>/.exec(cc)?.[1];
      if (tipo === "s") { const t = (ss[+v] ?? "").trim(); if (t) cel.set(col, { t }); }
      else if (tipo === "inlineStr") { const t = textoDosT(cc).trim(); if (t) cel.set(col, { t }); }
      else if (tipo === "str") { const t = desescapar(v ?? "").trim(); if (t) cel.set(col, { t }); }
      else if (v !== undefined && v !== "" && Number.isFinite(Number(v))) cel.set(col, { v: Number(v) });
    }
    if (cel.size) linhas.push({ n, cel });
  }
  return linhas;
}

function acharPasta() {
  if (process.env.DFC_DIR) return process.env.DFC_DIR;
  for (const raiz of [path.join(os.homedir(), "Meu Bess"), path.join(os.homedir(), "OneDrive")]) {
    if (!fs.existsSync(raiz)) continue;
    for (const nome of fs.readdirSync(raiz)) {
      if (!/2026\s*$/.test(nome)) continue;
      try { if (fs.statSync(path.join(raiz, nome)).isDirectory()) return path.join(raiz, nome); } catch { /* ignora */ }
    }
  }
  throw new Error("não achei a pasta DFC/2026 sincronizada; use DFC_DIR=<caminho>");
}

// Data: a célula pode vir como serial do Excel ou como texto dd/mm/aaaa.
function dataDaCelula(c) {
  if (!c) return null;
  if (c.v !== undefined) {
    if (!(c.v > 20000 && c.v < 80000)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c.v) * 86400000);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(c.t ?? "");
  if (!m) return null;
  const a = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return { a, m: +m[2], d: +m[1] };
}

const norm = (s) => String(s ?? "").toLocaleUpperCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Contas de SUB 2 que são saldo/controle de bloco, não lançamento.
const SUB2_SALDO = new Set(["SALDO INICIAL", "SALDO FINAL", "SALDO INICIAL PROVISAO", "SALDO FINAL PROVISAO"]);
// Classificações que são dinheiro andando entre contas da própria empresa, não receita nem despesa.
const CLASSE_TRANSFERENCIA = new Set(["TRANSFERENCIA", "REPASSE", "REPASSE CREDITO", "CARTAO DE CREDITO"]);
const SUB2_TRANSFERENCIA = new Set(["TRANSFERENCIAS BANCARIAS - CUSTO", "TRANSFERENCIAS BANCARIAS - RECEITA", "APLICACAO TRANS.", "REPASSE", "REPASSE - CREDITO"]);

// A coluna PAGAMENTO com marca de baixa: a linha aconteceu. "A PAGAR" é provisão e fica fora do confronto de caixa.
const PAGAMENTO_BAIXADO = (p) => p !== "" && p !== "A PAGAR" && p !== "A RECEBER";

function lerDFC() {
  const pasta = acharPasta();
  const arquivos = fs.readdirSync(pasta)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))
    .filter((f) => MESES.some((m) => f.startsWith(String(m).padStart(2, "0") + " ")))
    .sort();
  const lancamentos = [];
  const porArquivo = [];
  for (const arq of arquivos) {
    const mesArquivo = +arq.slice(0, 2);
    const zip = lerZip(fs.readFileSync(path.join(pasta, arq)));
    const ss = sharedStrings(zip);
    const aba = abas(zip).find((a) => norm(a.nome) === "FLUXO DE CAIXA");
    if (!aba) { porArquivo.push({ mes: mesArquivo, linhas: 0, cabecalhos: 0, aproveitadas: 0, foraDoMes: 0, semData: 0, saldo: 0, erro: "sem aba FLUXO DE CAIXA" }); continue; }
    const linhas = lerAbaCompleta(zip, aba.parte, ss);
    let mapa = null;          // rótulo do cabeçalho -> coluna; o cabeçalho se repete, um bloco por banco
    let cabecalhos = 0, aproveitadas = 0, foraDoMes = 0, semData = 0, saldo = 0, provisao = 0, usouSaida = 0, sinalDiverge = 0;
    for (const l of linhas) {
      const textos = [...l.cel.entries()].filter(([, c]) => c.t);
      const rotulos = textos.map(([, c]) => norm(c.t));
      if (rotulos.includes("VENCIMENTO") && rotulos.includes("DIA PG")) {   // linha de cabeçalho de bloco
        mapa = new Map(textos.map(([col, c]) => [norm(c.t), col]));
        cabecalhos++;
        continue;
      }
      if (!mapa) continue;
      const col = (rot) => mapa.get(rot);
      const texto = (rot) => { const c = l.cel.get(col(rot)); return c?.t ? c.t.trim() : ""; };
      const numero = (rot) => { const c = l.cel.get(col(rot)); return c?.v !== undefined ? c.v : 0; };
      const sub2 = norm(texto("SUB 2"));
      if (SUB2_SALDO.has(sub2)) { saldo++; continue; }
      // O RÓTULO DA COLUNA NÃO DESCREVE O CONTEÚDO. Medido nos 9 arquivos: a coluna sob o rótulo `ENTRADA` (K)
      // é o movimento COM SINAL — negativo é saída, positivo é entrada — e a coluna sob `SAIDA` (L) só vem
      // preenchida em linha de recebimento, com o saldo corrido do banco, não com uma saída. Então:
      //   valor    = módulo da coluna K; se K vier vazia, a L (33 linhas em 4.548)
      //   natureza = o SINAL dessa coluna, conferido contra a coluna PAGAMENTO
      const k = numero("ENTRADA");
      const lv = numero("SAIDA");
      const bruto = cent(k) !== 0 ? k : lv;
      if (cent(bruto) === 0) continue;
      if (cent(k) === 0) usouSaida++;
      const pagamento = norm(texto("PAGAMENTO"));
      if (!PAGAMENTO_BAIXADO(pagamento)) { provisao++; continue; }   // provisão e linha sem baixa ficam fora
      const dt = dataDaCelula(l.cel.get(col("DIA PG")));
      if (!dt) { semData++; continue; }
      if (dt.a !== ANO || dt.m !== mesArquivo) { foraDoMes++; continue; }
      const classe = norm(texto("CLASS. CONTABIL"));
      const natureza = bruto > 0 ? "R" : "P";
      if ((pagamento === "PAGO" && natureza === "R") || (pagamento === "RECEBIDO" && natureza === "P")) sinalDiverge++;
      aproveitadas++;
      lancamentos.push({
        mes: dt.m, dia: dt.d, emp: norm(texto("EMP.")) || "(vazio)",
        natureza,
        valor: Math.abs(bruto),
        classe: classe || "(vazio)", sub2: sub2 || "(vazio)", pagamento,
        transferencia: CLASSE_TRANSFERENCIA.has(classe) || SUB2_TRANSFERENCIA.has(sub2)
          || CLASSE_TRANSFERENCIA.has(pagamento) || pagamento === "C. CREDITO",
      });
    }
    porArquivo.push({ mes: mesArquivo, linhas: linhas.length, cabecalhos, aproveitadas, foraDoMes, semData, saldo, provisao, usouSaida, sinalDiverge });
  }
  return { pasta, arquivos: arquivos.length, lancamentos, porArquivo };
}

// ============================================================ lado Omie

const BASE = "https://app.omie.com.br/api/v1/";
const PAUSA_MS = 1200;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache local das respostas do Omie. Fica em `.cache/omie/` na raiz — ignorado pelo git, não sai da máquina e não
// entra em commit nenhum. A chave é a própria pergunta: empresa + serviço + método + parâmetros.
const CACHE_DIR = new URL("../.cache/omie/", import.meta.url);
let cacheLidos = 0, cacheGravados = 0, veioDoCache = false;
const arquivoDeCache = (emp, servico, call, param) => new URL(
  `${emp.n}-${servico.replace(/\W+/g, "-")}-${call}-${crypto.createHash("sha1").update(JSON.stringify(param)).digest("hex").slice(0, 12)}.json`,
  CACHE_DIR);
// A pausa entre chamadas só existe por causa do limite do Omie: quando a resposta veio do cache, não há o que esperar.
const pausaOmie = () => (veioDoCache ? Promise.resolve() : espera(PAUSA_MS));

async function chamar(emp, servico, call, param) {
  const arqCache = arquivoDeCache(emp, servico, call, param);
  if (!ATUALIZAR && fs.existsSync(arqCache)) {
    try {
      const guardado = JSON.parse(fs.readFileSync(arqCache, "utf8"));
      cacheLidos++; veioDoCache = true;
      return guardado;
    } catch { /* cache ilegível: busca no Omie de novo e regrava */ }
  }
  veioDoCache = false;
  let ultimo = "";
  for (let n = 1; n <= 4; n++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call, app_key: process.env[`OMIE_MEUBESS_${emp.n}_APP_KEY`], app_secret: process.env[`OMIE_MEUBESS_${emp.n}_APP_SECRET`], param: [param] }),
        signal: ac.signal,
      });
      let json = null;
      try { json = await resp.json(); } catch { /* corpo não-JSON */ }
      if (json?.faultstring) {
        ultimo = `${emp.rotulo} ${servico} ${call}: ${json.faultcode ?? "?"} ${json.faultstring}`;
        if (!/REDUNDANT|consumo|aguarde|bloquead/i.test(`${json.faultcode} ${json.faultstring}`)) falhar(ultimo);
      } else if (json && resp.ok) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(arqCache, JSON.stringify(json), "utf8");
        cacheGravados++;
        return json;
      } else {
        ultimo = `${emp.rotulo} ${servico} ${call}: HTTP ${resp.status}`;
        if (resp.status < 500 && resp.status !== 425 && resp.status !== 429) falhar(ultimo);
      }
    } catch {
      ultimo = `${emp.rotulo} ${servico} ${call}: sem resposta do Omie (rede ou tempo limite)`;
    } finally { clearTimeout(t); }
    await espera(PAUSA_MS * n * 3);
  }
  return falhar(`${ultimo} (desisti após 4 tentativas)`);
}

const origemTodas = new Map();   // cOrigem -> nº de lançamentos pagos na faixa, SEM filtro de tipo
const origemCPCR = new Map();    // cOrigem -> idem, COM cTpLancamento "CPCR"

const dataBR = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "")); return m ? { a: +m[3], m: +m[2], d: +m[1] } : null; };

async function lerOmie() {
  try { process.loadEnvFile(new URL("../.env", import.meta.url)); }
  catch { falhar("arquivo .env não encontrado ou ilegível na raiz do repositório"); }
  const EMPRESAS = [{ n: 1, rotulo: "Empresa 1", filial: "/0001-42" }, { n: 2, rotulo: "Empresa 2", filial: "/0002-23" }];
  const faltam = EMPRESAS.flatMap((e) => [`OMIE_MEUBESS_${e.n}_APP_KEY`, `OMIE_MEUBESS_${e.n}_APP_SECRET`]).filter((v) => !process.env[v]);
  if (faltam.length) falhar(`${faltam.join(", ")} precisa(m) estar preenchida(s) no .env`);

  const lancamentos = [];
  const porEmpresa = [];
  for (const emp of EMPRESAS) {
    // cadastro de categorias: diz se a categoria é de receita/despesa e se tem conta do DRE
    const cats = new Map();
    let tp = 1;
    for (let n = 1; n <= tp; n++) {
      const r = await chamar(emp, "geral/categorias", "ListarCategorias", { pagina: n, registros_por_pagina: 100 });
      tp = Number(r.total_de_paginas) || 1;
      for (const c of r.categoria_cadastro ?? []) cats.set(String(c.codigo), c);
      await pausaOmie();
    }

    let lidos = 0, cancelados = 0, semDataPagto = 0, foraDaFaixa = 0, semValorPago = 0, aproveitados = 0, totalPaginas = 1;
    for (let n = 1; n <= totalPaginas; n++) {
      const r = await chamar(emp, "financas/mf", "ListarMovimentos", {
        nPagina: n, nRegPorPagina: 100,
        cTpLancamento: "CPCR",
        dDtPagtoDe: `01/01/${ANO}`, dDtPagtoAte: `30/09/${ANO}`,
        cExibirDepartamentos: "S",
      });
      totalPaginas = Number(r.nTotPaginas) || 1;
      for (const mov of r.movimentos ?? []) {
        lidos++;
        const det = mov.detalhes ?? {};
        if (det.cStatus === "CANCELADO") { cancelados++; continue; }
        const dt = dataBR(det.dDtPagamento);
        if (!dt) { semDataPagto++; continue; }
        if (dt.a !== ANO || !MESES.includes(dt.m)) { foraDaFaixa++; continue; }
        const valor = Number(mov.resumo?.nValPago ?? 0);
        if (cent(valor) === 0) { semValorPago++; continue; }
        const origem = String(det.cOrigem ?? "(vazio)");
        origemCPCR.set(origem, (origemCPCR.get(origem) ?? 0) + 1);
        const catCod = String(det.cCodCateg ?? (mov.categorias ?? [])[0]?.cCodCateg ?? "");
        const cat = cats.get(catCod);
        aproveitados++;
        lancamentos.push({
          empresa: emp.n, mes: dt.m, dia: dt.d,
          natureza: det.cNatureza === "R" ? "R" : "P",
          valor,
          temDepartamento: Array.isArray(mov.departamentos) && mov.departamentos.length > 0,
          temCategoria: Boolean(catCod),
          temDre: Boolean(cat?.codigo_dre),
          contaReceita: cat?.conta_receita === "S",
          contaDespesa: cat?.conta_despesa === "S",
          tipoGuia: ["DAS", "DRF", "GUIA"].includes(String(det.cTipo ?? "").toUpperCase()),
          devolucao: String(det.cOperacao ?? "") === "13",
          temRetencao: ["nValorPIS", "nValorCOFINS", "nValorCSLL", "nValorIR", "nValorISS", "nValorINSS"].some((k) => cent(Number(det[k] ?? 0)) > 0),
        });
      }
      if (n % 10 === 0 || n === totalPaginas) console.log(`    ${emp.rotulo}: página ${n}/${totalPaginas}, ${lidos} lançamento(s) lidos`);
      await pausaOmie();
    }
    // Segunda passada, SÓ PARA CONTAR: a mesma faixa sem o filtro cTpLancamento. Serve para medir o que o filtro
    // "CPCR" — o que docs/fontes.md manda usar nas Telas 1 e 2 — deixa de fora. Só contagem por cOrigem; nenhum valor.
    let totalPaginas2 = 1;
    for (let n = 1; n <= totalPaginas2; n++) {
      const r = await chamar(emp, "financas/mf", "ListarMovimentos", {
        nPagina: n, nRegPorPagina: 100,
        dDtPagtoDe: `01/01/${ANO}`, dDtPagtoAte: `30/09/${ANO}`,
      });
      totalPaginas2 = Number(r.nTotPaginas) || 1;
      for (const mov of r.movimentos ?? []) {
        const o = String(mov.detalhes?.cOrigem ?? "(vazio)");
        origemTodas.set(o, (origemTodas.get(o) ?? 0) + 1);
      }
      await pausaOmie();
    }
    porEmpresa.push({ emp, categorias: cats.size, lidos, cancelados, semDataPagto, foraDaFaixa, semValorPago, aproveitados });
  }
  return { lancamentos, porEmpresa };
}

// ============================================================ confronto

function porMes(lancs) {
  const m = new Map(MESES.map((x) => [x, { R: 0, P: 0, nR: 0, nP: 0 }]));
  for (const l of lancs) {
    const a = m.get(l.mes);
    if (!a) continue;
    a[l.natureza] += l.valor;
    a["n" + l.natureza]++;
  }
  return m;
}

// Casamento: multiconjunto por (natureza, data de pagamento, valor em centavos). Cada linha do DFC casa com no máximo
// um lançamento do Omie e vice-versa. Duas réguas:
//   exato  — mesmo dia de pagamento e mesmo valor
//   frouxo — mesmo mês de pagamento e mesmo valor (pega a linha lançada com um ou dois dias de diferença)
function casar(dfc, omie, chave) {
  const balde = new Map();
  for (const o of omie) { const k = chave(o); balde.set(k, (balde.get(k) ?? 0) + 1); }
  let casados = 0;
  const soDfc = [];
  for (const d of dfc) {
    const k = chave(d);
    const q = balde.get(k) ?? 0;
    if (q > 0) { balde.set(k, q - 1); casados++; } else soDfc.push(d);
  }
  // o que sobrou no balde é o que o Omie tem e o DFC não
  const soOmie = [];
  const restante = new Map(balde);
  for (const o of omie) {
    const k = chave(o);
    const q = restante.get(k) ?? 0;
    if (q > 0) { restante.set(k, q - 1); soOmie.push(o); }
  }
  return { casados, soDfc, soOmie };
}

const chaveExata = (l) => `${l.natureza}|${l.mes}-${l.dia}|${cent(l.valor)}`;
const chaveFrouxa = (l) => `${l.natureza}|${l.mes}|${cent(l.valor)}`;

function topN(itens, campo, n = 6) {
  const m = new Map();
  for (const i of itens) { const k = i[campo] || "(vazio)"; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ============================================================ grupos das Telas 1 e 2

const GRUPOS = [
  { id: "funcionarios", nome: "Despesas com funcionários", natureza: "P",
    classes: ["FOLHA, IMPOSTOS E ADIANTAMENTOS", "PESSOAL PJ", "DESPESA CLT", "DESPESA PJ", "RESCISAO"],
    subs: ["DESPESAS CLT", "DESPESAS PJ", "PRO-LABORE ( RETIRADA DE SOCIO )", "COMISSAO DE VENDAS", "REEMBOLSO"],
    omieCampo: "temDepartamento",
    omieComo: "departamentos[] rateados no lançamento (o Omie não marca departamento como de pessoal)" },
  { id: "cogs", nome: "COGS / custos de vendas", natureza: "P",
    classes: ["FORNECEDORES COGS", "COMPRA DE MERCADORIA"],
    subs: ["COMPRAS DE MERCADORIAS", "FRETE E CARRETO", "ARMAZENAGEM E MANUSEIO", "COMPRA PROVISAO", "COMPRAS - PROVISAO", "FRETE - PROVISAO"],
    omieCampo: "temDre",
    omieComo: "codigo_dre da categoria do lançamento (a conta de custo do DRE)" },
  { id: "gerais", nome: "Despesas gerais", natureza: "P",
    classes: ["FORNECEDORES G&A", "OUTRAS DESPESAS", "SEGURO", "ALUGUEL", "ADIANTAMENTO JURIDICO"],
    subs: [],
    omieCampo: "temDre",
    omieComo: "codigo_dre da categoria do lançamento" },
  { id: "impostos", nome: "Impostos", natureza: "P",
    classes: ["IMPOSTOS E CONTRIBUICOES"],
    subs: ["ISS", "INSS", "IRPJ / CSLL"],
    omieCampo: "tipoGuia",
    omieComo: 'detalhes.cTipo em DAS / DRF / GUIA (a leitura "guias pagas")' },
  { id: "deducoes", nome: "Deduções", natureza: "P",
    classes: ["ESTORNO"],
    subs: ["DEVOLUCAO"],
    omieCampo: "devolucao",
    omieComo: "detalhes.cOperacao = 13 (devolução de venda)" },
  { id: "receita", nome: "Receita", natureza: "R",
    classes: ["RECEITA DE CLIENTE"],
    subs: ["RECEITA COM VENDAS", "RECEITA COM SERVICOS", "OUTRAS RECEITAS", "REEMBOLSO RECEITA", "RENDIMENTO FINANCEIRO"],
    omieCampo: "contaReceita",
    omieComo: "categoria com conta_receita = S" },
];

function medirGrupos(dfc, omie) {
  return GRUPOS.map((g) => {
    const dfcNat = dfc.filter((l) => l.natureza === g.natureza);
    const nDfc = dfcNat.filter((l) => g.classes.includes(l.classe) || g.subs.includes(l.sub2)).length;
    const omieNat = omie.filter((l) => l.natureza === g.natureza);
    const nOmie = omieNat.filter((l) => l[g.omieCampo]).length;
    return {
      ...g,
      dfcTotal: dfcNat.length, dfcNoGrupo: nDfc, dfcPct: pct(nDfc, dfcNat.length),
      omieTotal: omieNat.length, omieNoGrupo: nOmie, omiePct: pct(nOmie, omieNat.length),
    };
  });
}

// ============================================================ a proposta, por indicador

const PROPOSTA = [
  ["Tela 1", "Saldo", "Omie", "DFC", "Cartão com o número do Omie; se a diferença do mês passar de 2%, um selo ao lado do valor com a diferença em % contra o DFC"],
  ["Tela 1", "Receitas", "Omie", "DFC", "Cartão do Omie; selo acima de 2% de diferença contra a soma de ENTRADA do DFC no mesmo mês"],
  ["Tela 1", "Despesas", "DFC", "Omie", "Cartão do DFC (a classificação vem na própria linha); selo acima de 2% de diferença contra o Omie"],
  ["Tela 1", "Despesas pagas", "Omie", "DFC", "Cartão do Omie (nValPago cobre o pagamento parcial, que o DFC não separa); selo acima de 2%"],
  ["Tela 1", "Despesas pendentes", "Omie", "DFC (só nos meses fechados)", "Só Omie: o DFC provisiona outubro a dezembro mas não tem carteira. O selo aparece só de janeiro a setembro"],
  ["Tela 1", "Despesas com funcionários", "DFC", "Omie por departamento", "Cartão do DFC; o confronto do Omie só entra depois que o dono fechar a lista de departamentos de pessoal"],
  ["Tela 1", "% desp. funcionários / receita líquida", "DFC (numerador) + Omie (denominador)", "a mesma conta só no Omie", "Segue as duas linhas de que depende; o selo herda a maior diferença das duas"],
  ["Tela 1", "Top 10 despesas", "DFC (por CLASS. CONTABIL / SUB 2)", "Omie por centro de custo", "Barras do DFC, com um seletor “ver por centro de custo (Omie)” ao lado do título"],
  ["Tela 1", "Top 10 receitas", "Omie", "DFC (a descrição já vem na linha)", "Barras do Omie; a descrição cai para o DFC quando o pedido de venda não responder"],
  ["Tela 1", "Receita × despesa por dia", "Omie", "DFC (linhas 43/44 da aba do mês)", "Colunas do Omie; o dia com diferença acima de 5% ganha traço pontilhado e o número do DFC no tooltip"],
  ["Tela 1", "Receita × despesa por mês", "Omie", "DFC", "Duas linhas do Omie, com a série do DFC em cinza claro atrás; a legenda diz a diferença média em %"],
  ["Tela 2", "Receita total", "Omie", "DFC", "Cartão do Omie; selo acima de 2%"],
  ["Tela 2", "Custos e despesas", "DFC (separa COGS de G&A)", "Omie", "Cartão do DFC; selo acima de 2% contra o total do Omie"],
  ["Tela 2", "EBITDA", "Omie", "DFC só no resultado financeiro", "Cartão do Omie; nota de rodapé dizendo que depreciação e amortização não existem no DFC"],
  ["Tela 2", "Lucro líquido", "Omie", "DFC (lucro de caixa, B25)", "Cartão do Omie; o número do DFC aparece como “lucro de caixa” numa segunda linha, sem selo — são contas diferentes"],
  ["Tela 2", "Margem de lucro", "Omie", "DFC", "Segue os dois cartões acima"],
  ["Tela 2", "(+) Receitas", "Omie", "DFC", "Linha do DRE pelo Omie (é a única com quebra por produto); selo acima de 2%"],
  ["Tela 2", "(−) Deduções", "DFC", "Omie por cOperacao 13 e retenções", "Linha do DFC; o Omie entra como segunda coluna “retido no título”"],
  ["Tela 2", "(−) Custos de vendas", "DFC", "Omie por codigo_dre", "Linha do DFC; selo acima de 5% contra a conta de custo do DRE do Omie"],
  ["Tela 2", "(−) Despesas gerais", "Omie (quebra por categoria, decisão de 24/09)", "DFC por SUB 2", "Linha do Omie; o DFC entra numa coluna “no DFC” ao lado, linha a linha"],
  ["Tela 2", "(−) Impostos", "DFC (guias pagas)", "Omie por cTipo e retenções", "Linha do DFC; selo acima de 5%, e a retenção do Omie numa nota"],
];

// ============================================================ execução

console.log(`confronto DFC × Omie — ${ANO}, meses fechados (janeiro a setembro)`);
console.log("(console: só contagens e percentuais; os valores em reais vão só para a página)\n");

console.log("== lendo o DFC (só leitura da pasta sincronizada) ==");
const tAntesDfc = Date.now();
const dfc = lerDFC();
const tDfc = Date.now() - tAntesDfc;
console.log(`  ${dfc.arquivos} arquivo(s) de mês fechado; ${dfc.lancamentos.length} lançamento(s) de caixa aproveitados`);
for (const a of dfc.porArquivo) {
  console.log(`    ${String(a.mes).padStart(2, "0")} ${NOME_MES[a.mes]}: ${a.linhas} linha(s) na aba, ${a.cabecalhos} bloco(s), ${a.aproveitadas} aproveitada(s); provisão ${a.provisao}, fora do mês ${a.foraDoMes}, sem data ${a.semData}, saldo ${a.saldo}; valor tirado da coluna SAIDA ${a.usouSaida}, sinal contra a coluna PAGAMENTO ${a.sinalDiverge}`);
}

console.log(`    (leitura do DFC: ${seg(tDfc)})`);

let omie = { lancamentos: [], porEmpresa: [] };
let tOmie = 0;
if (!SO_DFC) {
  console.log(`\n== lendo o Omie (empresas 1 e 2, regime de caixa)${ATUALIZAR ? ", buscando de novo na API (--atualizar)" : ", pelo cache local quando houver"} ==`);
  const tAntesOmie = Date.now();
  omie = await lerOmie();
  tOmie = Date.now() - tAntesOmie;
  console.log(`  cache .cache/omie/ (fora do git): ${cacheLidos} resposta(s) lida(s) do cache, ${cacheGravados} buscada(s) no Omie e gravada(s); leitura do Omie em ${seg(tOmie)}`);
  for (const p of omie.porEmpresa) {
    console.log(`  ${p.emp.rotulo} (${p.emp.filial}): ${p.categorias} categoria(s); ${p.lidos} lidos, ${p.cancelados} cancelados, ${p.semDataPagto} sem data de pagamento, ${p.foraDaFaixa} fora da faixa, ${p.semValorPago} com valor pago zero, ${p.aproveitados} aproveitados`);
  }
}

const dfcTodos = dfc.lancamentos;
const dfcSemTransf = dfcTodos.filter((l) => !l.transferencia);
const omieTodos = omie.lancamentos;

const mDfc = porMes(dfcTodos);
const mDfcST = porMes(dfcSemTransf);
const mOmie = porMes(omieTodos);

const linhasMes = MESES.map((m) => {
  const d = mDfc.get(m), ds = mDfcST.get(m), o = mOmie.get(m);
  return {
    mes: m, nome: NOME_MES[m],
    dfcR: d.R, dfcP: d.P, dfcNR: d.nR, dfcNP: d.nP,
    dfcStR: ds.R, dfcStP: ds.P,
    omieR: o.R, omieP: o.P, omieNR: o.nR, omieNP: o.nP,
    difR: d.R - o.R, difP: d.P - o.P,
    pctR: pct(d.R - o.R, o.R), pctP: pct(d.P - o.P, o.P),
    pctStR: pct(ds.R - o.R, o.R), pctStP: pct(ds.P - o.P, o.P),
  };
});

console.log("\n== por mês: diferença do DFC contra o Omie (a base do % é o Omie) ==");
console.log("  mês        | linhas DFC | lanç. Omie |  entradas % |  saídas % | entr. % s/ transf. | saíd. % s/ transf.");
for (const l of linhasMes) {
  console.log(`  ${l.nome.padEnd(10)} | ${String(l.dfcNR + l.dfcNP).padStart(10)} | ${String(l.omieNR + l.omieNP).padStart(10)} | ${fmtPct(l.pctR).padStart(11)} | ${fmtPct(l.pctP).padStart(9)} | ${fmtPct(l.pctStR).padStart(18)} | ${fmtPct(l.pctStP).padStart(18)}`);
}

const exato = casar(dfcTodos, omieTodos, chaveExata);
const frouxo = casar(dfcTodos, omieTodos, chaveFrouxa);
console.log("\n== casamento dos lançamentos ==");
console.log(`  critério exato (natureza + dia do pagamento + valor até o centavo): ${exato.casados} de ${dfcTodos.length} linhas do DFC (${semSinal(pct(exato.casados, dfcTodos.length))}) e de ${omieTodos.length} lançamentos do Omie (${semSinal(pct(exato.casados, omieTodos.length))})`);
console.log(`    só no DFC: ${exato.soDfc.length} | só no Omie: ${exato.soOmie.length}`);
console.log(`  critério frouxo (natureza + mês do pagamento + valor): ${frouxo.casados} (${semSinal(pct(frouxo.casados, dfcTodos.length))} do DFC, ${semSinal(pct(frouxo.casados, omieTodos.length))} do Omie)`);
console.log(`    só no DFC: ${frouxo.soDfc.length} | só no Omie: ${frouxo.soOmie.length}`);
console.log("  tipos mais comuns entre as linhas só do DFC (CLASS. CONTABIL, critério exato):");
for (const [k, q] of topN(exato.soDfc, "classe")) console.log(`    ${String(q).padStart(5)}x  ${k}`);
console.log("  tipos mais comuns entre as linhas só do DFC (SUB 2, critério exato):");
for (const [k, q] of topN(exato.soDfc, "sub2")) console.log(`    ${String(q).padStart(5)}x  ${k}`);
const soOmieTipos = [
  ["com departamento rateado", exato.soOmie.filter((l) => l.temDepartamento).length],
  ["sem departamento", exato.soOmie.filter((l) => !l.temDepartamento).length],
  ["categoria com conta do DRE", exato.soOmie.filter((l) => l.temDre).length],
  ["categoria sem conta do DRE", exato.soOmie.filter((l) => l.temCategoria && !l.temDre).length],
  ["sem categoria", exato.soOmie.filter((l) => !l.temCategoria).length],
  ["guia de imposto (cTipo DAS/DRF/GUIA)", exato.soOmie.filter((l) => l.tipoGuia).length],
  ["de receita (cNatureza R)", exato.soOmie.filter((l) => l.natureza === "R").length],
  ["de despesa (cNatureza P)", exato.soOmie.filter((l) => l.natureza === "P").length],
  ["empresa 1", exato.soOmie.filter((l) => l.empresa === 1).length],
  ["empresa 2", exato.soOmie.filter((l) => l.empresa === 2).length],
];
console.log("  tipos mais comuns entre os lançamentos só do Omie (critério exato):");
for (const [k, q] of soOmieTipos) console.log(`    ${String(q).padStart(5)}x  ${k}`);

// EMP. do DFC × empresa do Omie
const emps = [...new Set(dfcTodos.map((l) => l.emp))].sort();
const cruzamento = [];
for (const e of emps) {
  const linhasE = dfcTodos.filter((l) => l.emp === e);
  const linha = { emp: e, linhas: linhasE.length, meses: [...new Set(linhasE.map((l) => l.mes))].sort((a, b) => a - b), porEmpresa: [] };
  for (const n of [1, 2]) {
    const oN = omieTodos.filter((l) => l.empresa === n);
    const c = casar(linhasE, oN, chaveExata);
    linha.porEmpresa.push({ n, casados: c.casados, pctDfc: pct(c.casados, linhasE.length), pctOmie: pct(c.casados, oN.length) });
  }
  cruzamento.push(linha);
}
console.log("\n== a coluna EMP. do DFC contra as empresas do Omie (casamento exato) ==");
for (const c of cruzamento) {
  console.log(`  EMP. "${c.emp}": ${c.linhas} linha(s), nos meses ${c.meses.map((m) => NOME_MES[m]).join(", ")}`);
  for (const p of c.porEmpresa) console.log(`    casa com a empresa ${p.n}: ${p.casados} linha(s) = ${semSinal(p.pctDfc)} das linhas dessa EMP.`);
}

const grupos = medirGrupos(dfcTodos, omieTodos);
console.log("\n== por grupo das Telas 1 e 2: quem classifica mais lançamentos ==");
for (const g of grupos) {
  console.log(`  ${g.nome}`);
  console.log(`    DFC : ${g.dfcNoGrupo} de ${g.dfcTotal} linha(s) de ${g.natureza === "R" ? "entrada" : "saída"} caem no grupo pela classificação da própria linha (${semSinal(g.dfcPct)})`);
  console.log(`    Omie: ${g.omieNoGrupo} de ${g.omieTotal} lançamento(s) trazem o campo que identifica o grupo (${semSinal(g.omiePct)}) — ${g.omieComo}`);
}

// ============================================================ a página

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const classePct = (p) => (p === null ? "" : Math.abs(p) <= 2 ? "ok" : Math.abs(p) <= 5 ? "atencao" : "ruim");
const hoje = new Date().toLocaleDateString("pt-BR");
const soma = (campo) => linhasMes.reduce((s, l) => s + l[campo], 0);
const totDifR = soma("difR"), totDifP = soma("difP"), totOmieR = soma("omieR"), totOmieP = soma("omieP");

const html = `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confronto DFC × Omie — meses fechados de 2026</title>
<style>
  :root { --tinta:#1b2430; --fraca:#5b6878; --linha:#e2e7ee; --fundo:#f6f8fb; --ok:#127a4b; --at:#96650a; --ruim:#b02a2a; }
  * { box-sizing:border-box }
  body { margin:0; padding:32px 24px 64px; font:16px/1.55 -apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:var(--tinta); background:var(--fundo) }
  main { max-width:1140px; margin:0 auto }
  h1 { font-size:28px; margin:0 0 4px }
  h2 { font-size:21px; margin:44px 0 10px; padding-top:18px; border-top:2px solid var(--linha) }
  h3 { font-size:17px; margin:26px 0 8px }
  p, li { max-width:92ch }
  .sub { color:var(--fraca); margin:0 0 24px }
  .cartao { background:#fff; border:1px solid var(--linha); border-radius:10px; padding:16px 20px; margin:16px 0 }
  table { border-collapse:collapse; width:100%; background:#fff; font-size:14px; margin:12px 0 }
  th, td { border:1px solid var(--linha); padding:7px 10px; text-align:left; vertical-align:top }
  th { background:#eef2f7; font-weight:600 }
  td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap }
  .ok { color:var(--ok); font-weight:600 }
  .atencao { color:var(--at); font-weight:600 }
  .ruim { color:var(--ruim); font-weight:600 }
  .nota { background:#fffbe9; border-left:4px solid #e0b700; padding:12px 16px; margin:16px 0; border-radius:0 8px 8px 0 }
  code { background:#eef2f7; padding:1px 5px; border-radius:4px; font-size:13px }
  .barra { display:inline-block; height:9px; background:#3b7dd8; border-radius:3px; vertical-align:middle }
  .barra.b { background:#8a9bb0 }
  footer { color:var(--fraca); font-size:13px; margin-top:48px; border-top:1px solid var(--linha); padding-top:16px }
</style>
<main>
<h1>Confronto DFC × Omie — meses fechados de 2026</h1>
<p class="sub">Janeiro a setembro de ${ANO}. Leitura de ${esc(hoje)} por <code>scripts/confronto-dfc-omie.mjs</code>, só leitura das duas fontes.
Esta página é a única saída com valores em reais; ela fica no repositório e não sai da máquina.</p>

<div class="cartao">
  <strong>O que está sendo comparado.</strong> Do lado do DFC, as linhas da aba <code>FLUXO DE CAIXA</code> dos ${dfc.arquivos} arquivos de mês
  fechado, com <code>DIA PG</code> dentro do próprio mês e marca de baixa em <code>PAGAMENTO</code>:
  <strong>${dfcTodos.length}</strong> linhas. Do lado do Omie, os lançamentos de <code>financas/mf</code> → <code>ListarMovimentos</code>
  das empresas 1 (<code>/0001-42</code>) e 2 (<code>/0002-23</code>) somadas, com <code>dDtPagtoDe</code>/<code>dDtPagtoAte</code> na faixa,
  fora os <code>CANCELADO</code>, valor em <code>resumo.nValPago</code>: <strong>${omieTodos.length}</strong> lançamentos.
  As linhas <code>A PAGAR</code> do DFC e os saldos de bloco ficam de fora — o confronto é de caixa, dos dois lados.
</div>

<div class="nota">
  <strong>Achado novo da leitura: o rótulo da coluna do DFC não descreve o que está na coluna.</strong> O cabeçalho diz
  <code>ENTRADA</code> (K) e <code>SAIDA</code> (L), mas nos nove arquivos a coluna K guarda o movimento <strong>com sinal</strong> —
  negativo é saída, positivo é entrada — e a coluna L só aparece preenchida em linha de recebimento, trazendo o
  <em>saldo corrido do banco</em>, não uma saída. Quem somar a coluna <code>SAIDA</code> como despesa soma saldo, não gasto.
  Este confronto lê o valor pelo módulo de K (a L só nas ${dfc.porArquivo.reduce((s, a) => s + a.usouSaida, 0)} linhas em que K vem vazia) e
  a natureza pelo sinal, conferida contra a coluna <code>PAGAMENTO</code>:
  <strong>${dfc.porArquivo.reduce((s, a) => s + a.sinalDiverge, 0)}</strong> linhas em ${dfcTodos.length} têm sinal e
  <code>PAGAMENTO</code> discordando. A correção disto muda a linha de <code>docs/fontes.md</code> que manda somar <code>ENTRADA</code> (K) e
  <code>SAIDA</code> (L) — mas isso é decisão do dono, e nada foi alterado lá.
</div>

<h2>O que a leitura achou, em cinco linhas</h2>
<ol>
  <li><strong>O Omie só começa em março.</strong> Em janeiro ele tem ${linhasMes[0].omieNR + linhasMes[0].omieNP} lançamento(s) pagos e em fevereiro ${linhasMes[1].omieNR + linhasMes[1].omieNP}, contra ${linhasMes[0].dfcNR + linhasMes[0].dfcNP} e ${linhasMes[1].dfcNR + linhasMes[1].dfcNP} linhas no DFC. Os percentuais de janeiro e fevereiro na tabela abaixo são aritmética sobre quase nada — <strong>ignore-os</strong>. O confronto real é de março a setembro.</li>
  <li><strong>De março a setembro as entradas batem razoavelmente e as saídas não.</strong> Nas entradas a diferença fica quase sempre abaixo de 5%; nas saídas ela é grande e sempre no mesmo sentido: o DFC registra mais que o Omie.</li>
  <li><strong>O rótulo da coluna do DFC engana</strong> (ver o aviso acima): a coluna <code>SAIDA</code> não tem saída.</li>
  <li><strong>${semSinal(pct(exato.casados, omieTodos.length))} dos lançamentos do Omie acham par no DFC</strong> pela data e pelo valor, mas só ${semSinal(pct(exato.casados, dfcTodos.length))} das linhas do DFC acham par no Omie — o DFC é mais miúdo: ele lança frete, tarifa e cartão linha a linha.</li>
  <li><strong>A coluna <code>EMP.</code> não é o recorte de empresa do Omie</strong> (seção 3).</li>
</ol>

<h2>1. Mês a mês: entradas e saídas</h2>
<p>A base do percentual é o Omie. Diferença positiva = o DFC registra mais que o Omie.</p>
<table>
<tr><th rowspan="2">mês</th><th class="n" colspan="4">entradas (recebido)</th><th class="n" colspan="4">saídas (pago)</th></tr>
<tr><th class="n">DFC</th><th class="n">Omie</th><th class="n">dif.</th><th class="n">dif. %</th><th class="n">DFC</th><th class="n">Omie</th><th class="n">dif.</th><th class="n">dif. %</th></tr>
${linhasMes.map((l) => `<tr><td>${l.nome}</td>
<td class="n">${brl(l.dfcR)}</td><td class="n">${brl(l.omieR)}</td><td class="n">${brl(l.difR)}</td><td class="n ${classePct(l.pctR)}">${fmtPct(l.pctR)}</td>
<td class="n">${brl(l.dfcP)}</td><td class="n">${brl(l.omieP)}</td><td class="n">${brl(l.difP)}</td><td class="n ${classePct(l.pctP)}">${fmtPct(l.pctP)}</td></tr>`).join("\n")}
<tr><th>total</th>
<th class="n">${brl(soma("dfcR"))}</th><th class="n">${brl(totOmieR)}</th><th class="n">${brl(totDifR)}</th><th class="n ${classePct(pct(totDifR, totOmieR))}">${fmtPct(pct(totDifR, totOmieR))}</th>
<th class="n">${brl(soma("dfcP"))}</th><th class="n">${brl(totOmieP)}</th><th class="n">${brl(totDifP)}</th><th class="n ${classePct(pct(totDifP, totOmieP))}">${fmtPct(pct(totDifP, totOmieP))}</th></tr>
</table>

<h3>O mesmo mês a mês, com o DFC sem as transferências internas</h3>
<p>Tira do DFC as linhas de <code>TRANSFERENCIA</code>, <code>REPASSE</code>, <code>CARTÃO DE CREDITO</code>, <code>APLICAÇÃO TRANS.</code> e
<code>TRANSFERÊNCIAS BANCÁRIAS</code> — dinheiro andando entre contas da própria empresa, que infla os dois lados do fluxo de caixa.</p>
<table>
<tr><th>mês</th><th class="n">entradas DFC s/ transf.</th><th class="n">dif. % contra o Omie</th><th class="n">saídas DFC s/ transf.</th><th class="n">dif. % contra o Omie</th><th class="n">linhas DFC</th><th class="n">lanç. Omie</th></tr>
${linhasMes.map((l) => `<tr><td>${l.nome}</td>
<td class="n">${brl(l.dfcStR)}</td><td class="n ${classePct(l.pctStR)}">${fmtPct(l.pctStR)}</td>
<td class="n">${brl(l.dfcStP)}</td><td class="n ${classePct(l.pctStP)}">${fmtPct(l.pctStP)}</td>
<td class="n">${l.dfcNR + l.dfcNP}</td><td class="n">${l.omieNR + l.omieNP}</td></tr>`).join("\n")}
</table>

<h2>2. Casamento dos lançamentos</h2>
<p><strong>O critério.</strong> Não existe chave que ligue uma linha do DFC a um título do Omie — a coluna <code>TITULO</code> do DFC guarda o número
do projeto, da PO ou da nota, nunca o <code>nCodTitulo</code>. Então o casamento é por <strong>natureza + data de pagamento + valor até o centavo</strong>,
tratado como multiconjunto: cada linha do DFC casa com no máximo um lançamento do Omie, e vice-versa. É o critério que as duas fontes sustentam
sozinhas. A régua frouxa troca o dia pelo mês, para pegar o lançamento escriturado com um ou dois dias de diferença.</p>
<table>
<tr><th>critério</th><th class="n">casados</th><th class="n">% das linhas do DFC</th><th class="n">% dos lanç. do Omie</th><th class="n">só no DFC</th><th class="n">só no Omie</th></tr>
<tr><td>exato — natureza + dia do pagamento + valor</td><td class="n">${exato.casados}</td><td class="n">${semSinal(pct(exato.casados, dfcTodos.length))}</td><td class="n">${semSinal(pct(exato.casados, omieTodos.length))}</td><td class="n">${exato.soDfc.length}</td><td class="n">${exato.soOmie.length}</td></tr>
<tr><td>frouxo — natureza + mês do pagamento + valor</td><td class="n">${frouxo.casados}</td><td class="n">${semSinal(pct(frouxo.casados, dfcTodos.length))}</td><td class="n">${semSinal(pct(frouxo.casados, omieTodos.length))}</td><td class="n">${frouxo.soDfc.length}</td><td class="n">${frouxo.soOmie.length}</td></tr>
</table>

<h3>Os tipos mais comuns de cada lado (critério exato)</h3>
<table>
<tr><th>só no DFC — <code>CLASS. CONTABIL</code></th><th class="n">linhas</th><th>só no DFC — <code>SUB 2</code></th><th class="n">linhas</th></tr>
${(() => {
  const a = topN(exato.soDfc, "classe"), b = topN(exato.soDfc, "sub2");
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    `<tr><td>${esc(a[i]?.[0] ?? "")}</td><td class="n">${a[i]?.[1] ?? ""}</td><td>${esc(b[i]?.[0] ?? "")}</td><td class="n">${b[i]?.[1] ?? ""}</td></tr>`).join("\n");
})()}
</table>
<table>
<tr><th>só no Omie — como o lançamento se apresenta</th><th class="n">lançamentos</th></tr>
${soOmieTipos.map(([k, q]) => `<tr><td>${esc(k)}</td><td class="n">${q}</td></tr>`).join("\n")}
</table>

<h3>Por que o Omie tem muito menos lançamentos que o DFC</h3>
<p>Boa parte da diferença não é dado faltando: é o filtro. <code>docs/fontes.md</code> manda ler as Telas 1 e 2 com
<code>cTpLancamento: "CPCR"</code>. Medido na faixa inteira, o que esse filtro guarda e o que ele deixa de fora, por
<code>detalhes.cOrigem</code> — contagem de lançamentos pagos, sem nenhum valor:</p>
<table>
<tr><th><code>cOrigem</code></th><th class="n">sem filtro de tipo</th><th class="n">com <code>CPCR</code></th><th>situação</th></tr>
${[...origemTodas.entries()].sort((a, b) => b[1] - a[1]).map(([o, q]) => {
  const c = origemCPCR.get(o) ?? 0;
  return `<tr><td><code>${esc(o)}</code></td><td class="n">${q}</td><td class="n">${c}</td><td>${c === 0 ? "<strong>fora</strong> do filtro" : c >= q ? "dentro" : "parcial"}</td></tr>`;
}).join("\n")}
<tr><th>total</th><th class="n">${[...origemTodas.values()].reduce((a, b) => a + b, 0)}</th><th class="n">${[...origemCPCR.values()].reduce((a, b) => a + b, 0)}</th><th></th></tr>
</table>
<p>As origens <code>BAXP</code> e <code>BAXR</code> — as maiores de todas — são registros de <em>baixa</em>; somá-las junto com o título
contaria o mesmo dinheiro duas vezes, e o <code>CPCR</code> faz bem em tirá-las. Já <code>ADVP</code>, <code>ADCR</code>,
<code>EXTP</code> e <code>EXTR</code> ficam de fora sem que isso esteja escrito em lugar nenhum: são adiantamentos e lançamentos de extrato
que o DFC registra e a Tela 1 não veria. <strong>Vale o dono olhar</strong> — mas nada foi mudado em <code>docs/fontes.md</code>.</p>

<h2>3. A coluna <code>EMP.</code> do DFC (B3W, N3) corresponde a alguma empresa do Omie?</h2>
<table>
<tr><th><code>EMP.</code></th><th class="n">linhas de caixa</th><th>meses em que aparece</th><th class="n">casa com a empresa 1</th><th class="n">casa com a empresa 2</th></tr>
${cruzamento.map((c) => `<tr><td><strong>${esc(c.emp)}</strong></td><td class="n">${c.linhas}</td><td>${c.meses.map((m) => NOME_MES[m]).join(", ")}</td>
${c.porEmpresa.map((p) => `<td class="n">${p.casados} (${semSinal(p.pctDfc)})</td>`).join("")}</tr>`).join("\n")}
</table>
<p>Leia assim: se <code>B3W</code> fosse a empresa 1, quase toda linha <code>B3W</code> deveria achar par entre os lançamentos da empresa 1 e
quase nenhuma entre os da empresa 2. Se as duas colunas ficarem parecidas, ou as duas baixas, a coluna <code>EMP.</code> <strong>não</strong> é o recorte
de filial do Omie — pode ser marca de quem lançou, de rateio ou de banco, e o de-para continua sem resposta nas planilhas.</p>

<h2>4. Por grupo das Telas 1 e 2: quem tem o dado mais completo</h2>
<p>A medida é: de todos os lançamentos de caixa do período (entradas, para a receita; saídas, para o resto),
quantos cada fonte consegue <strong>classificar dentro do grupo com o que ela mesma traz</strong> — no DFC, a classificação está escrita
na própria linha (<code>CLASS. CONTABIL</code> e <code>SUB 2</code>); no Omie, depende de um campo que o lançamento pode ou não trazer.</p>
<table>
<tr><th>grupo</th><th class="n">DFC: linhas no grupo</th><th class="n">% das linhas</th><th class="n">Omie: lanç. com o campo</th><th class="n">% dos lanç.</th><th>o campo do Omie</th><th>mais completo</th></tr>
${grupos.map((g) => {
  const vencedor = g.dfcPct === null || g.omiePct === null ? "—" : g.dfcPct > g.omiePct + 3 ? "DFC" : g.omiePct > g.dfcPct + 3 ? "Omie" : "empatado";
  return `<tr><td><strong>${esc(g.nome)}</strong></td>
<td class="n">${g.dfcNoGrupo} de ${g.dfcTotal}</td><td class="n">${semSinal(g.dfcPct)} <span class="barra" style="width:${Math.round((g.dfcPct ?? 0) * 0.6)}px"></span></td>
<td class="n">${g.omieNoGrupo} de ${g.omieTotal}</td><td class="n">${semSinal(g.omiePct)} <span class="barra b" style="width:${Math.round((g.omiePct ?? 0) * 0.6)}px"></span></td>
<td>${esc(g.omieComo)}</td><td><strong>${vencedor}</strong></td></tr>`;
}).join("\n")}
</table>
<div class="nota"><strong>As duas colunas não medem a mesma coisa — e é esse o ponto.</strong> No DFC o número é
<em>quantas linhas caem neste grupo</em>: a linha já diz a que grupo pertence. No Omie é <em>quantos lançamentos trazem o campo
que poderia colocá-los em algum grupo</em> — repare que “COGS” e “Despesas gerais” mostram exatamente o mesmo número do lado do Omie,
porque o campo é o mesmo (<code>codigo_dre</code>) e <strong>ele não separa os dois</strong> enquanto o dono não disser quais contas do DRE
são custo e quais são despesa geral. É uma lacuna que segue aberta em <code>docs/fontes.md</code>. Ou seja: onde o Omie “ganha” pela
cobertura, ele ainda depende de uma decisão; onde o DFC ganha, o dado já está pronto. Nos dois lados a classificação pode estar errada
na origem — isto mede quem <em>tem</em> o dado, não quem acertou.</div>

<h2>5. Proposta, indicador a indicador</h2>
<p>Para cada um dos 21 indicadores das Telas 1 e 2 que hoje carregam <strong>lacuna: Omie ou DFC</strong> em <code>docs/fontes.md</code>.
<strong>Isto é proposta, não decisão</strong> — nenhuma lacuna foi fechada e nenhuma fonte foi trocada no <code>docs/fontes.md</code>.
A regra que orientou a coluna “fonte principal”: <em>onde a classificação decide o número, o DFC leva</em> (ele escreve a classe na própria linha);
<em>onde o cadastro ou a carteira decide, o Omie leva</em> (ele tem cliente, categoria, departamento, status e pagamento parcial).</p>
<div class="nota"><strong>Uma ressalva que vale para a tabela inteira.</strong> Onde a proposta diz “Omie”, isso só vale
<strong>de março de ${ANO} em diante</strong>: em janeiro e fevereiro o Omie praticamente não tem lançamento pago (seção 1). Para a série
histórica de ${ANO} — os gráficos por mês, o seletor de meses anteriores — <strong>a única fonte que cobre o ano inteiro é o DFC</strong>.
A tela precisa decidir o que fazer com janeiro e fevereiro: mostrar o DFC, ou mostrar o Omie com o mês vazio e dizer por quê.</div>
<table>
<tr><th>tela</th><th>indicador</th><th>fonte principal proposta</th><th>confronto</th><th>como o confronto aparece na tela</th></tr>
${PROPOSTA.map(([t, i, f, c, v]) => `<tr><td>${esc(t)}</td><td><strong>${esc(i)}</strong></td><td>${esc(f)}</td><td>${esc(c)}</td><td>${esc(v)}</td></tr>`).join("\n")}
</table>

<h3>O aviso na tela, em uma regra só</h3>
<p>Todo cartão e toda linha de DRE com fonte principal e confronto mostra o número da fonte principal. Ao lado do valor, um selo pequeno:</p>
<ul>
  <li><strong>sem selo</strong> quando a diferença contra a outra fonte fica em <strong>até 2%</strong> — é ruído de arredondamento e de data de baixa;</li>
  <li><strong>selo âmbar “confere: X%”</strong> entre <strong>2% e 5%</strong>, com o valor da outra fonte no tooltip;</li>
  <li><strong>selo vermelho “diverge: X%”</strong> acima de <strong>5%</strong>, que abre a lista dos lançamentos sem par naquele mês (os “só no DFC” e “só no Omie” da seção 2).</li>
</ul>
<p>Os dois limites saem do que a seção 1 mostrou, e o dono pode mexer neles. Nos blocos de gráfico o selo vira um traço pontilhado no ponto que diverge.
De outubro a dezembro o selo não aparece: ali o DFC só tem provisão, e comparar seria comparar com nada.</p>

<h2>6. O que este confronto não resolve</h2>
<ul>
  <li><strong>Não há chave entre as duas fontes.</strong> O casamento por data e valor é aproximação: dois lançamentos do mesmo valor no mesmo dia são indistinguíveis, e um pagamento agrupado num lado e partido no outro nunca casa.</li>
  <li><strong>Pagamento parcial.</strong> O Omie separa <code>nValPago</code> de <code>nValorTitulo</code>; o DFC tem a coluna <code>STATUS</code> (<code>INTEGRAL</code>, <code>PARCIAL</code>, <code>SINAL</code>) mas o valor da linha é o que entrou. Parte da diferença mora aí.</li>
  <li><strong>Transferências internas.</strong> O DFC as registra como entrada e como saída; ver a segunda tabela da seção 1 para o tamanho do efeito.</li>
  <li><strong>As lacunas de cadastro seguem abertas</strong> — os 77 códigos de categoria com cadastro diferente entre as empresas, as 14 categorias sem <code>codigo_dre</code>, a lista de departamentos de pessoal e a de contas de custo do DRE. Nenhuma delas é fechada por este confronto.</li>
</ul>

<footer>
Gerado por <code>scripts/confronto-dfc-omie.mjs</code> em ${esc(hoje)}. Só leitura das duas fontes: nenhum arquivo da pasta sincronizada foi
gravado, movido ou aberto para edição, nenhuma planilha foi copiada para o repositório e nenhuma escrita foi feita no Omie.
Sem nome de cliente, fornecedor ou pessoa.
As respostas do Omie ficam num cache local em <code>.cache/omie/</code> — pasta ignorada pelo git, fora dos commits; rodar o script de novo
não chama a API (use <code>--atualizar</code> para buscar de novo). Esta rodada: DFC em ${esc(seg(tDfc))}, Omie em ${esc(seg(tOmie))}
(${cacheLidos} resposta(s) do cache, ${cacheGravados} da API).
</footer>
</main>
</html>
`;

fs.writeFileSync(new URL("../docs/confronto-dfc-omie.html", import.meta.url), html, "utf8");
console.log(`\npágina gravada: docs/confronto-dfc-omie.html (${(html.length / 1024).toFixed(1)} kB) — é onde ficam os valores em reais`);
console.log(`tempo total: ${seg(Date.now() - T0)} (DFC ${seg(tDfc)}, Omie ${seg(tOmie)})`);
console.log("FIM");
