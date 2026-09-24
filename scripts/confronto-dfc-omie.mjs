#!/usr/bin/env node
// Confronta as DUAS fontes das Telas 1 e 2 nos meses fechados de 2026 (janeiro a setembro), por decisão do dono
// (24/09/2026): o DFC (planilhas de fluxo de caixa sincronizadas pelo OneDrive) e o Omie (empresas 1 e 2 somadas,
// regime de caixa). "Para complemento e confronto de informações" — o confronto, não a troca de fonte.
//
// O QUE MUDOU NESTA RODADA (24/09/2026, depois do primeiro confronto): o dono explicou que o Omie tem OUTRAS UNIDADES
// DE NEGÓCIO no mesmo CNPJ, que não são a MeuBESS, e mandou o DFC delas. São quatro pastas sincronizadas, lado a lado:
// a da MeuBESS (`... - 2026`) e mais três (`... - 2026 (1)`, `(2)` e `(3)`). Este script lê TODAS, diz que unidade é
// cada pasta pelo que a própria planilha mostra, soma as quatro contra o Omie e procura no Omie o campo que separa a
// MeuBESS das outras.
//
// SÓ LEITURA, dos dois lados:
//   - DFC: abre os .xlsx das pastas sincronizadas em modo leitura (fs.readFileSync). Nunca grava, move nem abre para
//     edição nenhum arquivo de lá, e nunca copia planilha para o repositório.
//   - Omie: financas/mf ListarMovimentos, geral/categorias ListarCategorias, geral/contacorrente
//     ListarContasCorrentes e geral/departamentos ListarDepartamentos. Nenhum método que inclua, altere ou exclua.
//
// O QUE SAI ONDE:
//   - no CONSOLE: só contagens e percentuais. Nenhum valor em reais, nenhum nome de cliente, fornecedor ou pessoa.
//   - na PÁGINA (docs/confronto-dfc-omie.html, gravada por este script): os valores em reais. A página fica no
//     repositório e não sai da máquina. Também sem nome de cliente, fornecedor ou pessoa.
//
// CACHE DAS LEITURAS DO OMIE: cada resposta da API é gravada em `.cache/omie/` na raiz do repositório — pasta que o
// `.gitignore` ignora, então ela nunca entra num commit. Rodar o script de novo não chama a API: lê do cache e a
// rodada inteira leva segundos. Para buscar de novo no Omie (fechou mais um mês, mudou a faixa), use `--atualizar`.
//
// Uso:
//   node scripts/confronto-dfc-omie.mjs                 # lê as duas fontes (Omie pelo cache, se houver) e grava a página
//   node scripts/confronto-dfc-omie.mjs --atualizar     # ignora o cache e busca tudo no Omie de novo
//   node scripts/confronto-dfc-omie.mjs --so-dfc        # só o lado DFC (não chama o Omie)
//   DFC_DIR=<caminho> node scripts/confronto-dfc-omie.mjs   # uma pasta só, para conferência
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
const empilhar = (mapa, chave, valor = 1) => mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
const maiorDe = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];

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

function abasDo(zip) {
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
    const estado = /state="([^"]*)"/.exec(m[0])?.[1] ?? "visible";
    lista.push({ nome, estado, parte: "xl/" + (alvo.get(rid) ?? "") });
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

const norm = (s) => String(s ?? "").toLocaleUpperCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- as quatro pastas

// A raiz sincronizada tem a pasta da MeuBESS e, ao lado dela, as das outras unidades de negócio — o OneDrive numera
// as repetidas com "(1)", "(2)", "(3)". O caminho não fica escrito aqui: o script acha a raiz e pega todas.
function acharPastas() {
  if (process.env.DFC_DIR) return [{ id: "u0", sufixo: "", ordem: 0, caminho: process.env.DFC_DIR, nomeDaPasta: path.basename(process.env.DFC_DIR) }];
  for (const raiz of [path.join(os.homedir(), "Meu Bess"), path.join(os.homedir(), "OneDrive")]) {
    if (!fs.existsSync(raiz)) continue;
    const achadas = [];
    for (const nome of fs.readdirSync(raiz)) {
      const m = /2026\s*(?:\((\d+)\))?\s*$/.exec(nome);
      if (!m) continue;
      // Pasta do OneDrive é reparse point: `Dirent.isDirectory()` devolve false. Usar stat.
      try { if (!fs.statSync(path.join(raiz, nome)).isDirectory()) continue; } catch { continue; }
      const ordem = m[1] ? +m[1] : 0;
      achadas.push({ id: `u${ordem}`, sufixo: m[1] ? `(${m[1]})` : "", ordem, caminho: path.join(raiz, nome), nomeDaPasta: nome });
    }
    if (achadas.length) return achadas.sort((a, b) => a.ordem - b.ordem);
  }
  throw new Error("não achei as pastas do DFC de 2026 sincronizadas; use DFC_DIR=<caminho>");
}

// O mês vem do nome do arquivo. A pasta da MeuBESS numera ("01 - DFC - JAN2026"); as outras três, não
// ("DFC AGOSTO 2026", "DFC - ABRIL2026", "DFC AGOSTO2026").
const MES_POR_NOME = [
  ["JANEIRO", 1], ["FEVEREIRO", 2], ["MARCO", 3], ["ABRIL", 4], ["MAIO", 5], ["JUNHO", 6],
  ["JULHO", 7], ["AGOSTO", 8], ["SETEMBRO", 9], ["OUTUBRO", 10], ["NOVEMBRO", 11], ["DEZEMBRO", 12],
  ["JAN", 1], ["FEV", 2], ["MAR", 3], ["ABR", 4], ["MAI", 5], ["JUN", 6],
  ["JUL", 7], ["AGO", 8], ["SET", 9], ["OUT", 10], ["NOV", 11], ["DEZ", 12],
];
function mesDoArquivo(nome) {
  const m = /^(\d{1,2})\s*-/.exec(nome);
  if (m && +m[1] >= 1 && +m[1] <= 12) return +m[1];
  const n = norm(nome);
  for (const [rot, mes] of MES_POR_NOME) if (n.includes(rot)) return mes;
  return null;
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

// Contas de SUB 2 que são saldo/controle de bloco, não lançamento.
const SUB2_SALDO = new Set(["SALDO INICIAL", "SALDO FINAL", "SALDO INICIAL PROVISAO", "SALDO FINAL PROVISAO"]);
// Classificações que são dinheiro andando entre contas da própria empresa, não receita nem despesa.
const CLASSE_TRANSFERENCIA = new Set(["TRANSFERENCIA", "TRANFERENCIA", "TRANSFERENCIAS ENTRE BANCOS", "REPASSE", "REPASSE CREDITO", "CARTAO DE CREDITO"]);
const SUB2_TRANSFERENCIA = new Set(["TRANSFERENCIAS BANCARIAS - CUSTO", "TRANSFERENCIAS BANCARIAS - RECEITA", "APLICACAO TRANS.", "REPASSE", "REPASSE - CREDITO", "CUSTOS COM CARTAO DE CREDITO"]);

// A coluna PAGAMENTO com marca de baixa: a linha aconteceu. "A PAGAR" é provisão e fica fora do confronto de caixa.
const PAGAMENTO_BAIXADO = (p) => p !== "" && p !== "A PAGAR" && p !== "A RECEBER";

// A data do pagamento mora em `DIA PG` — quando mora. Há arquivo em que quem preencheu escorregou de coluna e a data
// caiu sob `VENCIMENTO`, ou até sob `TIPO`, e a `DIA PG` ficou vazia o mês inteiro (a pasta (1) em setembro é assim:
// as 26 linhas do mês têm a data na coluna D, sob o rótulo `TIPO`). Como o cabeçalho não descreve o conteúdo — já se
// sabia disso pelas colunas ENTRADA/SAIDA —, a data é procurada nessa ordem e a queda é contada.
const COLUNAS_DE_DATA = ["DIA PG", "VENCIMENTO", "TIPO"];

// Lê uma pasta inteira. Devolve os lançamentos de caixa dos meses fechados E a "cara" da pasta — abas, coluna EMP.,
// coluna BANCO, os títulos escritos acima do cabeçalho e as classificações mais usadas —, que é o que identifica a
// unidade de negócio sem precisar perguntar a ninguém.
function lerPasta(p) {
  const arquivos = fs.readdirSync(p.caminho)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.startsWith("~$"))
    .sort();
  const lancamentos = [];
  const porArquivo = [];
  const emps = new Map(), bancos = new Map(), classes = new Map(), titulos = new Map();
  const abasPorArquivo = new Map();   // arquivo -> lista de abas
  let linhasDeDados = 0;
  for (const arq of arquivos) {
    const mesArquivo = mesDoArquivo(arq);
    const zip = lerZip(fs.readFileSync(path.join(p.caminho, arq)));
    const ss = sharedStrings(zip);
    const lista = abasDo(zip);
    abasPorArquivo.set(arq, lista.map((a) => a.nome.trim() + (a.estado !== "visible" ? " [oculta]" : "")));
    const aba = lista.find((a) => norm(a.nome) === "FLUXO DE CAIXA");
    if (!aba) { porArquivo.push({ arq, mes: mesArquivo, erro: "sem aba FLUXO DE CAIXA", linhas: 0, cabecalhos: 0, aproveitadas: 0 }); continue; }
    const linhas = lerAbaCompleta(zip, aba.parte, ss);
    let mapa = null;          // rótulo do cabeçalho -> coluna; o cabeçalho se repete, um bloco por banco
    let cabecalhos = 0, aproveitadas = 0, foraDoMes = 0, semData = 0, saldo = 0, provisao = 0, usouSaida = 0, sinalDiverge = 0, dataDeOutraColuna = 0;
    for (const l of linhas) {
      const textos = [...l.cel.entries()].filter(([, c]) => c.t);
      const rotulos = textos.map(([, c]) => norm(c.t));
      if (rotulos.includes("VENCIMENTO") && rotulos.includes("DIA PG")) {   // linha de cabeçalho de bloco
        mapa = new Map(textos.map(([col, c]) => [norm(c.t), col]));
        cabecalhos++;
        continue;
      }
      if (!mapa) {
        // acima do primeiro cabeçalho moram o título do arquivo e o nome do banco do bloco
        for (const [, c] of textos) if (c.t.length >= 2 && c.t.length <= 40) empilhar(titulos, c.t.trim());
        continue;
      }
      const col = (rot) => mapa.get(rot);
      const texto = (rot) => { const c = l.cel.get(col(rot)); return c?.t ? c.t.trim() : ""; };
      const numero = (rot) => { const c = l.cel.get(col(rot)); return c?.v !== undefined ? c.v : 0; };
      const sub2 = norm(texto("SUB 2"));
      const empRotulo = norm(texto("EMP."));
      const bancoRotulo = norm(texto("BANCO"));
      if (empRotulo) empilhar(emps, empRotulo);
      if (bancoRotulo) empilhar(bancos, bancoRotulo);
      linhasDeDados++;
      if (SUB2_SALDO.has(sub2)) { saldo++; continue; }
      // O RÓTULO DA COLUNA NÃO DESCREVE O CONTEÚDO. Medido nos arquivos das quatro pastas: a coluna sob o rótulo
      // `ENTRADA` (K) é o movimento COM SINAL — negativo é saída, positivo é entrada — e a coluna sob `SAIDA` (L) só
      // vem preenchida em linha de recebimento, com o saldo corrido do banco, não com uma saída. Então:
      //   valor    = módulo da coluna K; se K vier vazia, a L
      //   natureza = o SINAL dessa coluna, conferido contra a coluna PAGAMENTO
      const k = numero("ENTRADA");
      const lv = numero("SAIDA");
      const bruto = cent(k) !== 0 ? k : lv;
      if (cent(bruto) === 0) continue;
      if (cent(k) === 0) usouSaida++;
      const pagamento = norm(texto("PAGAMENTO"));
      if (!PAGAMENTO_BAIXADO(pagamento)) { provisao++; continue; }   // provisão e linha sem baixa ficam fora
      let dt = null, ondeAData = 0;
      for (; ondeAData < COLUNAS_DE_DATA.length; ondeAData++) {
        dt = dataDaCelula(l.cel.get(col(COLUNAS_DE_DATA[ondeAData])));
        if (dt) break;
      }
      if (!dt) { semData++; continue; }
      if (ondeAData > 0) dataDeOutraColuna++;
      if (dt.a !== ANO || dt.m !== mesArquivo || !MESES.includes(dt.m)) { foraDoMes++; continue; }
      const classe = norm(texto("CLASS. CONTABIL"));
      if (classe) empilhar(classes, classe);
      const natureza = bruto > 0 ? "R" : "P";
      if ((pagamento === "PAGO" && natureza === "R") || (pagamento === "RECEBIDO" && natureza === "P")) sinalDiverge++;
      aproveitadas++;
      lancamentos.push({
        unidade: p.id,
        mes: dt.m, dia: dt.d, emp: empRotulo || "(vazio)", banco: bancoRotulo || "(vazio)",
        natureza,
        valor: Math.abs(bruto),
        classe: classe || "(vazio)", sub2: sub2 || "(vazio)", pagamento,
        transferencia: CLASSE_TRANSFERENCIA.has(classe) || SUB2_TRANSFERENCIA.has(sub2)
          || CLASSE_TRANSFERENCIA.has(pagamento) || pagamento === "C. CREDITO",
      });
    }
    porArquivo.push({ arq, mes: mesArquivo, linhas: linhas.length, cabecalhos, aproveitadas, foraDoMes, semData, saldo, provisao, usouSaida, sinalDiverge, dataDeOutraColuna });
  }
  const mesesFechados = [...new Set(porArquivo.filter((a) => MESES.includes(a.mes) && a.aproveitadas > 0).map((a) => a.mes))].sort((a, b) => a - b);
  const mesesNaPasta = [...new Set(porArquivo.map((a) => a.mes).filter(Boolean))].sort((a, b) => a - b);
  // a "cara" das abas sai do arquivo do ULTIMO mes fechado da pasta: o primeiro arquivo do ano ainda e a planilha
  // antiga, com outro conjunto de abas, e nao representa o modelo em uso.
  const arqRef = porArquivo.filter((a) => MESES.includes(a.mes)).sort((a, b) => b.mes - a.mes)[0]?.arq ?? arquivos[0];
  return {
    ...p, arquivos, porArquivo, arqRef, lancamentos, abas: abasPorArquivo.get(arqRef) ?? [], emps, bancos, classes, titulos,
    linhasDeDados, mesesFechados, mesesNaPasta,
    emp: maiorDe(emps)[0], banco: maiorDe(bancos)[0],
  };
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
const contaTodas = new Map();    // "empresa|nCodCC" -> nº de lançamentos pagos na faixa, SEM filtro de tipo

const dataBR = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? "")); return m ? { a: +m[3], m: +m[2], d: +m[1] } : null; };

async function lerOmie() {
  try { process.loadEnvFile(new URL("../.env", import.meta.url)); }
  catch { falhar("arquivo .env não encontrado ou ilegível na raiz do repositório"); }
  const EMPRESAS = [{ n: 1, rotulo: "Empresa 1", filial: "/0001-42" }, { n: 2, rotulo: "Empresa 2", filial: "/0002-23" }];
  const faltam = EMPRESAS.flatMap((e) => [`OMIE_MEUBESS_${e.n}_APP_KEY`, `OMIE_MEUBESS_${e.n}_APP_SECRET`]).filter((v) => !process.env[v]);
  if (faltam.length) falhar(`${faltam.join(", ")} precisa(m) estar preenchida(s) no .env`);

  const lancamentos = [];
  const porEmpresa = [];
  const contas = new Map();        // "empresa|nCodCC" -> cadastro da conta corrente
  const departamentos = new Map(); // "empresa|codigo"  -> cadastro do departamento
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
    // cadastro de contas correntes: é o candidato número um a separar as unidades de negócio, porque cada unidade
    // opera o próprio banco. O cadastro traz `descricao` e `codigo_banco`.
    let tcc = 1;
    for (let n = 1; n <= tcc; n++) {
      const r = await chamar(emp, "geral/contacorrente", "ListarContasCorrentes", { pagina: n, registros_por_pagina: 100 });
      tcc = Number(r.total_de_paginas) || 1;
      for (const c of r.ListarContasCorrentes ?? []) contas.set(`${emp.n}|${c.nCodCC}`, c);
      await pausaOmie();
    }
    // cadastro de departamentos: o outro candidato. Se as unidades estivessem separadas por departamento, a árvore
    // teria uma raiz por unidade.
    let tdp = 1;
    for (let n = 1; n <= tdp; n++) {
      const r = await chamar(emp, "geral/departamentos", "ListarDepartamentos", { pagina: n, registros_por_pagina: 100 });
      tdp = Number(r.total_de_paginas) || 1;
      for (const d of r.departamentos ?? []) departamentos.set(`${emp.n}|${d.codigo}`, d);
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
        empilhar(origemCPCR, origem);
        const catCod = String(det.cCodCateg ?? (mov.categorias ?? [])[0]?.cCodCateg ?? "");
        const cat = cats.get(catCod);
        const deps = Array.isArray(mov.departamentos) ? mov.departamentos : [];
        aproveitados++;
        lancamentos.push({
          empresa: emp.n, mes: dt.m, dia: dt.d,
          natureza: det.cNatureza === "R" ? "R" : "P",
          valor,
          conta: `${emp.n}|${det.nCodCC ?? "(vazio)"}`,
          departamento: deps.length ? `${emp.n}|${deps[0].cCodDepartamento}` : `${emp.n}|(sem)`,
          categoria: `${emp.n}|${catCod || "(sem)"}`,
          projeto: `${emp.n}|${det.cCodProjeto ?? "(sem)"}`,
          vendedor: `${emp.n}|${det.cCodVendedor ?? "(sem)"}`,
          temDepartamento: deps.length > 0,
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
        empilhar(origemTodas, String(mov.detalhes?.cOrigem ?? "(vazio)"));
        empilhar(contaTodas, `${emp.n}|${mov.detalhes?.nCodCC ?? "(vazio)"}`);
      }
      await pausaOmie();
    }
    porEmpresa.push({ emp, categorias: cats.size, lidos, cancelados, semDataPagto, foraDaFaixa, semValorPago, aproveitados });
  }
  return { lancamentos, porEmpresa, contas, departamentos };
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
// Agora com ATRIBUIÇÃO DE UNIDADE: cada lançamento do Omie que casa leva a marca da unidade (pasta) de onde veio a
// linha do DFC que o achou. `disputados` conta os lançamentos do Omie cuja chave é reivindicada por mais de uma
// unidade — nesses a atribuição é arbitrária, e é o tamanho da dúvida.
function casar(dfc, omie, chave) {
  const balde = new Map();
  omie.forEach((o, i) => {
    const k = chave(o);
    if (!balde.has(k)) balde.set(k, []);
    balde.get(k).push(i);
  });
  const unidadesPorChave = new Map();
  for (const d of dfc) {
    const k = chave(d);
    if (!unidadesPorChave.has(k)) unidadesPorChave.set(k, new Set());
    unidadesPorChave.get(k).add(d.unidade);
  }
  let disputados = 0;
  for (const [k, s] of unidadesPorChave) if (s.size > 1) disputados += balde.get(k)?.length ?? 0;

  const unidadeDoOmie = new Array(omie.length).fill(null);
  const soDfc = [];
  let casados = 0;
  for (const d of dfc) {
    const fila = balde.get(chave(d));
    if (fila && fila.length) { unidadeDoOmie[fila.shift()] = d.unidade; casados++; }
    else soDfc.push(d);
  }
  const soOmie = omie.filter((_, i) => unidadeDoOmie[i] === null);
  return { casados, soDfc, soOmie, unidadeDoOmie, disputados };
}

const chaveExata = (l) => `${l.natureza}|${l.mes}-${l.dia}|${cent(l.valor)}`;
const chaveFrouxa = (l) => `${l.natureza}|${l.mes}|${cent(l.valor)}`;

function topN(itens, campo, n = 6) {
  const m = new Map();
  for (const i of itens) empilhar(m, i[campo] || "(vazio)");
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------------------------------------------------------------- o recorte: que campo do Omie separa as unidades
//
// A pergunta do dono: no Omie, o que separa o que é MeuBESS do que é das outras unidades? O teste é empírico. Entre
// os lançamentos do Omie que CASARAM com uma linha do DFC, já se sabe de que unidade cada um é. Então, para cada
// campo candidato (conta corrente, departamento, categoria, projeto, vendedor, empresa), pergunta-se: cada valor do
// campo pertence a uma unidade só? Um valor é "exclusivo" de uma unidade quando PUREZA_MINIMA dos lançamentos
// casados daquele valor são dela — e quando há casados suficientes para a conta querer dizer alguma coisa.
const PUREZA_MINIMA = 0.95;
const CASADOS_MINIMOS = 3;

function medirRecorte(omie, unidadeDoOmie, campo, unidadeAlvo) {
  const porValor = new Map();   // valor do campo -> { total, casados, porUnidade: Map }
  omie.forEach((o, i) => {
    const v = String(o[campo]);
    if (!porValor.has(v)) porValor.set(v, { total: 0, casados: 0, porUnidade: new Map() });
    const a = porValor.get(v);
    a.total++;
    const u = unidadeDoOmie[i];
    if (u) { a.casados++; empilhar(a.porUnidade, u); }
  });
  const valores = [];
  for (const [v, a] of porValor) {
    const dono = maiorDe(a.porUnidade);
    const pureza = a.casados ? dono[1] / a.casados : null;
    valores.push({
      valor: v, total: a.total, casados: a.casados,
      dono: a.casados ? dono[0] : null, donoCasados: a.casados ? dono[1] : 0, pureza,
      exclusivo: a.casados >= CASADOS_MINIMOS && pureza !== null && pureza >= PUREZA_MINIMA,
      porUnidade: a.porUnidade,
    });
  }
  valores.sort((a, b) => b.total - a.total);
  const doAlvo = valores.filter((v) => v.exclusivo && v.dono === unidadeAlvo);
  const noRecorte = new Set(doAlvo.map((v) => v.valor));
  const totalOmie = omie.length;
  const dentro = omie.filter((o) => noRecorte.has(String(o[campo]))).length;
  // quantos dos lançamentos casados com a unidade alvo o recorte pega, e quanto de outra unidade ele leva junto
  let alvoCasados = 0, alvoDentro = 0, intrusos = 0;
  omie.forEach((o, i) => {
    const u = unidadeDoOmie[i];
    const noR = noRecorte.has(String(o[campo]));
    if (u === unidadeAlvo) { alvoCasados++; if (noR) alvoDentro++; }
    else if (u && noR) intrusos++;
  });
  return {
    campo, valores, distintos: valores.length,
    exclusivos: valores.filter((v) => v.exclusivo).length,
    valoresDoAlvo: doAlvo, noRecorte,
    dentro, pctDentro: pct(dentro, totalOmie),
    alvoCasados, alvoDentro, cobertura: pct(alvoDentro, alvoCasados),
    intrusos, pctIntrusos: pct(intrusos, dentro),
  };
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
//
// Sexta coluna nova: o que muda quando a tela é SÓ da MeuBESS — que é o caso, porque as outras unidades de negócio
// não são o assunto das três telas. Enquanto o recorte da MeuBESS no Omie não fechar, todo indicador cuja fonte
// principal proposta é o Omie precisa dizer como corta.

const PROPOSTA = [
  ["Tela 1", "Saldo", "Omie", "DFC", "Cartão com o número do Omie; se a diferença do mês passar de 2%, um selo ao lado do valor com a diferença em % contra o DFC",
    "Saldo é por conta corrente: some só as contas do recorte da MeuBESS. É o indicador em que o recorte funciona melhor, porque o campo do recorte é o próprio campo do indicador."],
  ["Tela 1", "Receitas", "Omie", "DFC", "Cartão do Omie; selo acima de 2% de diferença contra a soma de ENTRADA do DFC no mesmo mês",
    "Precisa do recorte: as outras unidades faturam serviço no mesmo CNPJ. Sem o recorte, a receita da tela é a do grupo, não a da MeuBESS."],
  ["Tela 1", "Despesas", "DFC", "Omie", "Cartão do DFC (a classificação vem na própria linha); selo acima de 2% de diferença contra o Omie",
    "Não muda: a fonte principal é a pasta do DFC da MeuBESS, que já é só dela. O confronto do Omie é que precisa do recorte."],
  ["Tela 1", "Despesas pagas", "Omie", "DFC", "Cartão do Omie (nValPago cobre o pagamento parcial, que o DFC não separa); selo acima de 2%",
    "Precisa do recorte, pelo mesmo motivo das Receitas."],
  ["Tela 1", "Despesas pendentes", "Omie", "DFC (só nos meses fechados)", "Só Omie: o DFC provisiona outubro a dezembro mas não tem carteira. O selo aparece só de janeiro a setembro",
    "Precisa do recorte e é o caso mais frágil: a carteira em aberto não casa com nada no DFC, então não dá nem para medir quanto do pendente é de outra unidade."],
  ["Tela 1", "Despesas com funcionários", "DFC", "Omie por departamento", "Cartão do DFC; o confronto do Omie só entra depois que o dono fechar a lista de departamentos de pessoal",
    "O departamento do Omie NÃO separa unidade: a árvore inteira pende de uma raiz só, MEU BESS, e os filhos são setores. Serve para dizer que gasto é de pessoal, não de quem é o gasto."],
  ["Tela 1", "% desp. funcionários / receita líquida", "DFC (numerador) + Omie (denominador)", "a mesma conta só no Omie", "Segue as duas linhas de que depende; o selo herda a maior diferença das duas",
    "O denominador vem do Omie e precisa do recorte; o numerador já é só da MeuBESS. Sem recorte o percentual sai menor do que é."],
  ["Tela 1", "Top 10 despesas", "DFC (por CLASS. CONTABIL / SUB 2)", "Omie por centro de custo", "Barras do DFC, com um seletor “ver por centro de custo (Omie)” ao lado do título",
    "Não muda no principal. No seletor do Omie, o recorte precisa entrar antes de agrupar, ou uma unidade grande de fora entra no Top 10."],
  ["Tela 1", "Top 10 receitas", "Omie", "DFC (a descrição já vem na linha)", "Barras do Omie; a descrição cai para o DFC quando o pedido de venda não responder",
    "Precisa do recorte. É o indicador que mais expõe o problema: cliente de outra unidade apareceria nomeado no Top 10 da MeuBESS."],
  ["Tela 1", "Receita × despesa por dia", "Omie", "DFC (linhas 43/44 da aba do mês)", "Colunas do Omie; o dia com diferença acima de 5% ganha traço pontilhado e o número do DFC no tooltip",
    "Precisa do recorte."],
  ["Tela 1", "Receita × despesa por mês", "Omie", "DFC", "Duas linhas do Omie, com a série do DFC em cinza claro atrás; a legenda diz a diferença média em %",
    "Precisa do recorte. E a série do DFC atrás tem de ser só a da pasta da MeuBESS — somar as quatro pastas aqui seria comparar grupo com unidade."],
  ["Tela 2", "Receita total", "Omie", "DFC", "Cartão do Omie; selo acima de 2%",
    "Precisa do recorte."],
  ["Tela 2", "Custos e despesas", "DFC (separa COGS de G&A)", "Omie", "Cartão do DFC; selo acima de 2% contra o total do Omie",
    "Não muda no principal; o confronto precisa do recorte."],
  ["Tela 2", "EBITDA", "Omie", "DFC só no resultado financeiro", "Cartão do Omie; nota de rodapé dizendo que depreciação e amortização não existem no DFC",
    "Precisa do recorte por conta corrente. Sem ele o EBITDA da tela é do CNPJ inteiro — e este é o indicador em que a contaminação menos aparece na conferência, porque não há número do DFC para confrontar."],
  ["Tela 2", "Lucro líquido", "Omie", "DFC (lucro de caixa, B25)", "Cartão do Omie; o número do DFC aparece como “lucro de caixa” numa segunda linha, sem selo — são contas diferentes",
    "Precisa do recorte. O “lucro de caixa” do DFC continua sendo o da pasta da MeuBESS."],
  ["Tela 2", "Margem de lucro", "Omie", "DFC", "Segue os dois cartões acima",
    "Precisa do recorte nos dois termos — e um recorte parcial distorce a margem duas vezes."],
  ["Tela 2", "(+) Receitas", "Omie", "DFC", "Linha do DRE pelo Omie (é a única com quebra por produto); selo acima de 2%",
    "Precisa do recorte. A quebra por produto é do Omie e produto de outra unidade entraria na linha."],
  ["Tela 2", "(−) Deduções", "DFC", "Omie por cOperacao 13 e retenções", "Linha do DFC; o Omie entra como segunda coluna “retido no título”",
    "Não muda no principal; o confronto precisa do recorte."],
  ["Tela 2", "(−) Custos de vendas", "DFC", "Omie por codigo_dre", "Linha do DFC; selo acima de 5% contra a conta de custo do DRE do Omie",
    "Não muda no principal. Repare que as outras unidades quase não têm custo de mercadoria — elas vendem serviço —, então esta linha é a menos contaminada de todas."],
  ["Tela 2", "(−) Despesas gerais", "Omie (quebra por categoria, decisão de 24/09)", "DFC por SUB 2", "Linha do Omie; o DFC entra numa coluna “no DFC” ao lado, linha a linha",
    "Precisa do recorte. As categorias são as mesmas nas quatro unidades: a categoria NÃO separa unidade."],
  ["Tela 2", "(−) Impostos", "DFC (guias pagas)", "Omie por cTipo e retenções", "Linha do DFC; selo acima de 5%, e a retenção do Omie numa nota",
    "Não muda no principal; o confronto precisa do recorte."],
];

// ============================================================ execução

console.log(`confronto DFC × Omie — ${ANO}, meses fechados (janeiro a setembro)`);
console.log("(console: só contagens e percentuais; os valores em reais vão só para a página)\n");

console.log("== lendo o DFC (só leitura das pastas sincronizadas) ==");
const tAntesDfc = Date.now();
const pastas = acharPastas();
const unidades = pastas.map(lerPasta);
const tDfc = Date.now() - tAntesDfc;
const U0 = unidades[0]?.id ?? "u0";   // a pasta sem sufixo é a da MeuBESS
console.log(`  ${unidades.length} pasta(s) achada(s) na raiz sincronizada`);
for (const u of unidades) {
  const titulos = [...u.titulos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, q]) => `"${t}" (${q}x)`);
  console.log(`\n  PASTA ${u.sufixo || "(sem sufixo)"} — ${u.arquivos.length} arquivo(s), meses ${u.mesesNaPasta.map((m) => NOME_MES[m]).join(", ") || "—"}`);
  console.log(`    abas do 1º arquivo (${u.abas.length}): ${u.abas.join(" | ")}`);
  console.log(`    coluna EMP.: ${[...u.emps.entries()].sort((a, b) => b[1] - a[1]).map(([e, q]) => `${e} ${q}x`).join(", ")}`);
  console.log(`    coluna BANCO: ${[...u.bancos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e, q]) => `${e} ${q}x`).join(", ")}`);
  console.log(`    títulos acima do cabeçalho: ${titulos.join(", ") || "—"}`);
  console.log(`    CLASS. CONTABIL mais usada: ${[...u.classes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e, q]) => `${e} ${q}x`).join(", ")}`);
  console.log(`    lançamentos de caixa nos meses fechados: ${u.lancamentos.length} (meses ${u.mesesFechados.map((m) => NOME_MES[m]).join(", ") || "—"})`);
  for (const a of u.porArquivo) {
    if (!MESES.includes(a.mes)) continue;
    console.log(`      ${String(a.mes).padStart(2, "0")} ${NOME_MES[a.mes]}: ${a.linhas} linha(s), ${a.cabecalhos} bloco(s), ${a.aproveitadas} aproveitada(s); provisão ${a.provisao}, fora do mês ${a.foraDoMes}, sem data ${a.semData}, saldo ${a.saldo}; valor tirado da coluna SAIDA ${a.usouSaida}, data fora de DIA PG ${a.dataDeOutraColuna}, sinal contra PAGAMENTO ${a.sinalDiverge}`);
  }
}
console.log(`\n    (leitura do DFC: ${seg(tDfc)})`);

let omie = { lancamentos: [], porEmpresa: [], contas: new Map(), departamentos: new Map() };
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

const nomeDaConta = (chave) => {
  const c = omie.contas.get(chave);
  if (!c) return chave.endsWith("|(vazio)") ? "(sem conta corrente)" : `conta ${chave}`;
  return `${c.descricao} — banco ${c.codigo_banco} (${c.tipo_conta_corrente})`;
};
const nomeDoDepartamento = (chave) => {
  const d = omie.departamentos.get(chave);
  if (!d) return chave.endsWith("|(sem)") ? "(sem departamento)" : `departamento ${chave}`;
  return `${d.descricao} — estrutura ${d.estrutura}`;
};
const rotuloUnidade = (id) => {
  const u = unidades.find((x) => x.id === id);
  if (!u) return id ?? "—";
  return u.id === U0 ? `pasta base · EMP. ${u.emp}` : `pasta ${u.sufixo} · EMP. ${u.emp}`;
};
const curtoUnidade = (id) => {
  const u = unidades.find((x) => x.id === id);
  if (!u) return "sem par";
  return u.id === U0 ? "MeuBESS" : `outra ${u.sufixo}`;
};

const dfcTodos = unidades.flatMap((u) => u.lancamentos);
const dfcMeuBess = dfcTodos.filter((l) => l.unidade === U0);
const dfcOutras = dfcTodos.filter((l) => l.unidade !== U0);
const dfcSemTransf = dfcTodos.filter((l) => !l.transferencia);
const omieTodos = omie.lancamentos;

const mDfc = porMes(dfcTodos);
const mDfcMB = porMes(dfcMeuBess);
const mDfcST = porMes(dfcSemTransf);
const mOmie = porMes(omieTodos);

const linhasMes = MESES.map((m) => {
  const d = mDfc.get(m), b = mDfcMB.get(m), ds = mDfcST.get(m), o = mOmie.get(m);
  const unidadesNoMes = unidades.filter((u) => u.mesesFechados.includes(m));
  return {
    mes: m, nome: NOME_MES[m],
    unidades: unidadesNoMes.length, quaisUnidades: unidadesNoMes.map((u) => u.sufixo || "base"),
    dfcR: d.R, dfcP: d.P, dfcNR: d.nR, dfcNP: d.nP,
    mbR: b.R, mbP: b.P, mbNR: b.nR, mbNP: b.nP,
    dfcStR: ds.R, dfcStP: ds.P,
    omieR: o.R, omieP: o.P, omieNR: o.nR, omieNP: o.nP,
    difR: d.R - o.R, difP: d.P - o.P,
    pctR: pct(d.R - o.R, o.R), pctP: pct(d.P - o.P, o.P),
    pctMbR: pct(b.R - o.R, o.R), pctMbP: pct(b.P - o.P, o.P),
    pctStR: pct(ds.R - o.R, o.R), pctStP: pct(ds.P - o.P, o.P),
  };
});

console.log("\n== por mês: diferença do DFC contra o Omie (a base do % é o Omie) ==");
console.log("  mês        | un. | linhas DFC | lanç. Omie |  entr. % (4 pastas) | saíd. % (4 pastas) | entr. % (só MeuBESS) | saíd. % (só MeuBESS)");
for (const l of linhasMes) {
  console.log(`  ${l.nome.padEnd(10)} | ${String(l.unidades).padStart(3)} | ${String(l.dfcNR + l.dfcNP).padStart(10)} | ${String(l.omieNR + l.omieNP).padStart(10)} | ${fmtPct(l.pctR).padStart(19)} | ${fmtPct(l.pctP).padStart(18)} | ${fmtPct(l.pctMbR).padStart(20)} | ${fmtPct(l.pctMbP).padStart(20)}`);
}

const exato = casar(dfcTodos, omieTodos, chaveExata);
const frouxo = casar(dfcTodos, omieTodos, chaveFrouxa);
const soMeuBess = casar(dfcMeuBess, omieTodos, chaveExata);
console.log("\n== casamento dos lançamentos ==");
console.log(`  critério exato (natureza + dia do pagamento + valor até o centavo), as ${unidades.length} pastas somadas: ${exato.casados} de ${dfcTodos.length} linhas do DFC (${semSinal(pct(exato.casados, dfcTodos.length))}) e de ${omieTodos.length} lançamentos do Omie (${semSinal(pct(exato.casados, omieTodos.length))})`);
console.log(`    só no DFC: ${exato.soDfc.length} | só no Omie: ${exato.soOmie.length} | com chave disputada por mais de uma pasta: ${exato.disputados}`);
console.log(`  só a pasta da MeuBESS, mesmo critério: ${soMeuBess.casados} de ${dfcMeuBess.length} linhas (${semSinal(pct(soMeuBess.casados, dfcMeuBess.length))}) e ${semSinal(pct(soMeuBess.casados, omieTodos.length))} do Omie`);
console.log(`  critério frouxo (natureza + mês do pagamento + valor): ${frouxo.casados} (${semSinal(pct(frouxo.casados, dfcTodos.length))} do DFC, ${semSinal(pct(frouxo.casados, omieTodos.length))} do Omie)`);

const casadosPorUnidade = unidades.map((u) => {
  const n = exato.unidadeDoOmie.filter((x) => x === u.id).length;
  const doDfc = dfcTodos.filter((l) => l.unidade === u.id).length;
  return { u, casados: n, doDfc, pctDfc: pct(n, doDfc), pctOmie: pct(n, omieTodos.length) };
});
console.log("\n== a que unidade pertence cada lançamento do Omie que casou (critério exato) ==");
for (const c of casadosPorUnidade) {
  console.log(`  ${rotuloUnidade(c.u.id).padEnd(34)}: ${String(c.casados).padStart(5)} lanç. do Omie = ${semSinal(c.pctOmie)} do Omie; ${semSinal(c.pctDfc)} das ${c.doDfc} linhas dessa pasta`);
}
console.log(`  ${"sem par no DFC".padEnd(34)}: ${String(exato.soOmie.length).padStart(5)} lanç. do Omie = ${semSinal(pct(exato.soOmie.length, omieTodos.length))} do Omie`);

// ---- o recorte
const CANDIDATOS = [
  ["conta", "conta corrente (detalhes.nCodCC)", nomeDaConta],
  ["departamento", "departamento (departamentos[].cCodDepartamento)", nomeDoDepartamento],
  ["categoria", "categoria (detalhes.cCodCateg)", (v) => `categoria ${v.split("|")[1]}`],
  ["projeto", "projeto (detalhes.cCodProjeto)", (v) => `projeto ${v.split("|")[1]}`],
  ["vendedor", "vendedor (detalhes.cCodVendedor)", (v) => `vendedor ${v.split("|")[1]}`],
  ["empresa", "empresa / filial (a chave do Omie)", (v) => `empresa ${v}`],
];
const recortes = omieTodos.length
  ? CANDIDATOS.map(([campo, nome, rot]) => ({ nome, rot, ...medirRecorte(omieTodos, exato.unidadeDoOmie, campo, U0) }))
  : [];
console.log("\n== o que, no Omie, separa a MeuBESS das outras unidades ==");
console.log(`  (um valor do campo é "exclusivo" de uma unidade quando ≥${Math.round(PUREZA_MINIMA * 100)}% dos seus lançamentos casados são dela, com ao menos ${CASADOS_MINIMOS} casados)`);
console.log("  campo                                            | valores | exclusivos | % do Omie no recorte | cobertura da MeuBESS | intrusos no recorte");
for (const r of recortes) {
  console.log(`  ${r.nome.padEnd(48)} | ${String(r.distintos).padStart(7)} | ${String(r.exclusivos).padStart(10)} | ${semSinal(r.pctDentro).padStart(20)} | ${semSinal(r.cobertura).padStart(20)} | ${String(r.intrusos).padStart(6)} (${semSinal(r.pctIntrusos)})`);
}
const melhor = recortes.slice().sort((a, b) => (b.cobertura ?? 0) - (a.cobertura ?? 0))[0];
if (melhor) {
  console.log(`\n  melhor candidato: ${melhor.nome}`);
  for (const v of melhor.valoresDoAlvo.slice(0, 12)) {
    console.log(`    ${String(v.total).padStart(5)} lanç. | ${semSinal(v.pureza * 100)} puro | ${melhor.rot(v.valor)}`);
  }
}

const grupos = medirGrupos(dfcMeuBess, omieTodos);
console.log("\n== por grupo das Telas 1 e 2: quem classifica mais lançamentos (DFC só da MeuBESS) ==");
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
const totMbDifR = soma("mbR") - totOmieR, totMbDifP = soma("mbP") - totOmieP;
const contaRecorte = recortes.find((r) => r.campo === "conta");
const deptRecorte = recortes.find((r) => r.campo === "departamento");

// A tabela de contas correntes junta as duas leituras: a do filtro `CPCR` (a que as Telas 1 e 2 usam) e a da faixa
// inteira sem filtro de tipo. É a segunda que mostra por que duas das unidades novas somem do confronto: o dinheiro
// delas até existe no Omie, mas em origem que o `CPCR` descarta.
const linhasConta = [...new Set([...contaTodas.keys(), ...(contaRecorte?.valores ?? []).map((v) => v.valor)])]
  .map((chave) => {
    const v = contaRecorte?.valores.find((x) => x.valor === chave);
    return { chave, semFiltro: contaTodas.get(chave) ?? 0, total: 0, casados: 0, pureza: null, exclusivo: false, dono: null, porUnidade: new Map(), ...(v ?? {}) };
  })
  .filter((l) => l.semFiltro >= 3 || l.total >= 3)
  .sort((a, b) => b.semFiltro - a.semFiltro || b.total - a.total);
// o que o recorte explica, em valor — a página é o único lugar em que valor em reais pode aparecer
const valorTotalOmie = omieTodos.reduce((s, l) => s + l.valor, 0);
const valorNoRecorte = contaRecorte ? omieTodos.filter((l) => contaRecorte.noRecorte.has(l.conta)).reduce((s, l) => s + l.valor, 0) : 0;

const html = `<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confronto DFC × Omie — as quatro unidades e o recorte da MeuBESS (2026)</title>
<style>
  :root { --tinta:#1b2430; --fraca:#5b6878; --linha:#e2e7ee; --fundo:#f6f8fb; --ok:#127a4b; --at:#96650a; --ruim:#b02a2a; }
  * { box-sizing:border-box }
  body { margin:0; padding:32px 24px 64px; font:16px/1.55 -apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:var(--tinta); background:var(--fundo) }
  main { max-width:1180px; margin:0 auto }
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
  .lacuna { background:#fdeeee; border-left:4px solid #b02a2a; padding:12px 16px; margin:16px 0; border-radius:0 8px 8px 0 }
  code { background:#eef2f7; padding:1px 5px; border-radius:4px; font-size:13px }
  .barra { display:inline-block; height:9px; background:#3b7dd8; border-radius:3px; vertical-align:middle }
  .barra.b { background:#8a9bb0 }
  .tag { display:inline-block; font-size:12px; padding:1px 7px; border-radius:10px; background:#eef2f7; color:var(--fraca) }
  footer { color:var(--fraca); font-size:13px; margin-top:48px; border-top:1px solid var(--linha); padding-top:16px }
</style>
<main>
<h1>Confronto DFC × Omie — as quatro unidades e o recorte da MeuBESS</h1>
<p class="sub">Janeiro a setembro de ${ANO}. Leitura de ${esc(hoje)} por <code>scripts/confronto-dfc-omie.mjs</code>, só leitura das duas fontes.
Esta página é a única saída com valores em reais; ela fica no repositório e não sai da máquina. Sem nome de cliente, fornecedor ou pessoa.</p>

<div class="cartao">
  <strong>O que mudou desde o primeiro confronto.</strong> Aquela leitura comparou o DFC da MeuBESS com o Omie das empresas 1 e 2
  e achou poucas linhas em comum. O dono explicou por quê: <strong>no Omie há outras unidades de negócio, no mesmo CNPJ</strong>, que não são a
  MeuBESS. Ele mandou o DFC dessas unidades — mais três pastas sincronizadas, ao lado da primeira. Esta página lê as
  <strong>${unidades.length}</strong> pastas, diz que unidade é cada uma pelo que a própria planilha mostra, soma as quatro contra o Omie e
  mede o que, dentro do Omie, separa a MeuBESS das demais.
</div>

<h2>1. As ${unidades.length} pastas: que unidade é cada uma</h2>
<p>Nada aqui vem de fora da planilha. Cada linha é o que o próprio arquivo mostra: o nome das abas, o valor da coluna
<code>EMP.</code>, o da coluna <code>BANCO</code>, o texto escrito acima do cabeçalho do bloco e a classificação contábil mais usada.</p>
<table>
<tr><th>pasta</th><th class="n">arquivos</th><th>meses</th><th><code>EMP.</code></th><th><code>BANCO</code></th><th>título acima do cabeçalho</th><th><code>CLASS. CONTABIL</code> mais usada</th></tr>
${unidades.map((u) => `<tr>
<td><strong>${esc(u.sufixo || "sem sufixo")}</strong>${u.id === U0 ? ' <span class="tag">MeuBESS</span>' : ""}</td>
<td class="n">${u.arquivos.length}</td>
<td>${u.mesesNaPasta.map((m) => NOME_MES[m]).join(", ") || "—"}</td>
<td>${[...u.emps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, q]) => `<code>${esc(e)}</code> ${q}×`).join("<br>") || "—"}</td>
<td>${[...u.bancos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e, q]) => `${esc(e)} ${q}×`).join("<br>") || "—"}</td>
<td>${[...u.titulos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, q]) => `${esc(t)} <span class="tag">${q}×</span>`).join("<br>") || "—"}</td>
<td>${[...u.classes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, q]) => `${esc(c)} ${q}×`).join("<br>") || "—"}</td>
</tr>`).join("\n")}
</table>

<h3>O modelo é o mesmo?</h3>
<p><strong>É.</strong> Os quatro arquivos abrem a mesma planilha-modelo: a aba de trabalho se chama <code>FLUXO DE CAIXA</code> nas quatro,
com o mesmo cabeçalho de 17 colunas (<code>EMP.</code>, <code>VER.</code>, <code>BANCO</code>, <code>TIPO</code>, <code>VENCIMENTO</code>,
<code>DIA PG</code>, <code>FORNECEDOR / CLIENTE</code>, <code>TITULO</code>, <code>CLASS. CONTABIL</code>, <code>SUB 2</code>, <code>ENTRADA</code>,
<code>SAIDA</code>, <code>SALDO</code>, <code>PAGAMENTO</code>, <code>STATUS</code>, <code>CONCILIADO</code>, <code>OBS:</code>), repetido um bloco por
banco; a mesma aba <code>&nbsp;2026</code> com <code>Saldo Inicial</code>, <code>Provisões</code>, <code>Receitas</code>, <code>Gastos</code> e
<code>Lucro Liquido</code>; a mesma aba <code>BASE</code> com o vocabulário de <code>SUBCATEGORIA 2</code>; e as mesmas abas ocultas
<code>PJ VENDAS</code>, <code>RATEIO B3NXB3W</code> e <code>COMISSÃO PJ</code>, que denunciam a cópia de um arquivo para o outro. Abaixo, as abas do
arquivo do <strong>último mês fechado</strong> de cada pasta — o primeiro arquivo do ano ainda é a planilha antiga e não representa o modelo em
uso —, com as comuns às ${unidades.length} pastas em negrito:</p>
${(() => {
  const comuns = unidades.reduce((acc, u) => acc.filter((a) => u.abas.includes(a)), unidades[0]?.abas ?? []);
  return `<p>Abas presentes nas ${unidades.length} pastas: ${comuns.map((a) => `<code>${esc(a)}</code>`).join(" · ") || "—"}</p>
<table>
<tr><th>pasta</th><th>arquivo de referência</th><th>abas</th></tr>
${unidades.map((u) => `<tr><td><strong>${esc(u.sufixo || "sem sufixo")}</strong></td><td>${esc(u.arqRef ?? "—")}</td><td>${u.abas.map((a) => (comuns.includes(a) ? `<strong><code>${esc(a)}</code></strong>` : `<code>${esc(a)}</code>`)).join(" · ")}</td></tr>`).join("\n")}
</table>`;
})()}
<div class="nota"><strong>A coluna <code>EMP.</code> não identifica a unidade, e é importante dizer isso.</strong> O mesmo rótulo
<code>B3W</code> aparece na pasta da MeuBESS e na pasta <code>(2)</code>, que é outro negócio; a pasta <code>(2)</code> ainda troca de
<code>B3N</code> para <code>B3W</code> no meio do ano, quando troca de banco; e <code>3N</code> e <code>N3</code> são rótulos de pastas diferentes.
Quem identifica a pasta com segurança é o conjunto <em>banco + o que ela vende</em>, não a sigla. As três pastas novas trazem ainda, acima do
cabeçalho, o nome do banco do bloco escrito à mão.</div>

<h2>2. Mês a mês, depois de somar as ${unidades.length} unidades</h2>
<p>A base do percentual é o Omie (empresas 1 e 2 somadas). Diferença positiva = o DFC registra mais que o Omie. A coluna
<strong>un.</strong> diz quantas pastas têm aquele mês: <strong>as pastas novas não cobrem o ano inteiro</strong> — só a partir de abril, e três
delas só nos últimos meses —, então a soma só melhora onde há o que somar.</p>
<table>
<tr><th rowspan="2">mês</th><th class="n" rowspan="2">un.</th><th class="n" colspan="4">entradas (recebido)</th><th class="n" colspan="4">saídas (pago)</th></tr>
<tr><th class="n">DFC (${unidades.length} pastas)</th><th class="n">Omie</th><th class="n">dif.</th><th class="n">dif. %</th><th class="n">DFC (${unidades.length} pastas)</th><th class="n">Omie</th><th class="n">dif.</th><th class="n">dif. %</th></tr>
${linhasMes.map((l) => `<tr><td>${l.nome}</td><td class="n">${l.unidades}</td>
<td class="n">${brl(l.dfcR)}</td><td class="n">${brl(l.omieR)}</td><td class="n">${brl(l.difR)}</td><td class="n ${classePct(l.pctR)}">${fmtPct(l.pctR)}</td>
<td class="n">${brl(l.dfcP)}</td><td class="n">${brl(l.omieP)}</td><td class="n">${brl(l.difP)}</td><td class="n ${classePct(l.pctP)}">${fmtPct(l.pctP)}</td></tr>`).join("\n")}
<tr><th>total</th><th class="n"></th>
<th class="n">${brl(soma("dfcR"))}</th><th class="n">${brl(totOmieR)}</th><th class="n">${brl(totDifR)}</th><th class="n ${classePct(pct(totDifR, totOmieR))}">${fmtPct(pct(totDifR, totOmieR))}</th>
<th class="n">${brl(soma("dfcP"))}</th><th class="n">${brl(totOmieP)}</th><th class="n">${brl(totDifP)}</th><th class="n ${classePct(pct(totDifP, totOmieP))}">${fmtPct(pct(totDifP, totOmieP))}</th></tr>
</table>

<h3>O que a soma das outras unidades mudou</h3>
<p>Lado a lado: a diferença contra o Omie com só a pasta da MeuBESS (como no confronto anterior) e com as ${unidades.length} pastas somadas.</p>
<table>
<tr><th>mês</th><th class="n">entr. % só MeuBESS</th><th class="n">entr. % ${unidades.length} pastas</th><th class="n">saíd. % só MeuBESS</th><th class="n">saíd. % ${unidades.length} pastas</th><th class="n">linhas DFC (MeuBESS)</th><th class="n">linhas DFC (outras)</th><th class="n">lanç. Omie</th></tr>
${linhasMes.map((l) => `<tr><td>${l.nome}</td>
<td class="n ${classePct(l.pctMbR)}">${fmtPct(l.pctMbR)}</td><td class="n ${classePct(l.pctR)}">${fmtPct(l.pctR)}</td>
<td class="n ${classePct(l.pctMbP)}">${fmtPct(l.pctMbP)}</td><td class="n ${classePct(l.pctP)}">${fmtPct(l.pctP)}</td>
<td class="n">${l.mbNR + l.mbNP}</td><td class="n">${(l.dfcNR + l.dfcNP) - (l.mbNR + l.mbNP)}</td><td class="n">${l.omieNR + l.omieNP}</td></tr>`).join("\n")}
<tr><th>total</th>
<th class="n ${classePct(pct(totMbDifR, totOmieR))}">${fmtPct(pct(totMbDifR, totOmieR))}</th><th class="n ${classePct(pct(totDifR, totOmieR))}">${fmtPct(pct(totDifR, totOmieR))}</th>
<th class="n ${classePct(pct(totMbDifP, totOmieP))}">${fmtPct(pct(totMbDifP, totOmieP))}</th><th class="n ${classePct(pct(totDifP, totOmieP))}">${fmtPct(pct(totDifP, totOmieP))}</th>
<th class="n">${dfcMeuBess.length}</th><th class="n">${dfcOutras.length}</th><th class="n">${omieTodos.length}</th></tr>
</table>

<h3>O mesmo mês a mês, com o DFC sem as transferências internas</h3>
<p>Tira do DFC das ${unidades.length} pastas as linhas de <code>TRANSFERÊNCIA</code>, <code>REPASSE</code>, <code>CARTÃO DE CRÉDITO</code>,
<code>APLICAÇÃO TRANS.</code> e <code>TRANSFERÊNCIAS BANCÁRIAS</code> — dinheiro andando entre contas da própria empresa, que infla os dois
lados do fluxo de caixa. Com quatro unidades no mesmo grupo, a transferência de uma para a outra aparece <em>duas vezes</em> na soma.</p>
<table>
<tr><th>mês</th><th class="n">entradas DFC s/ transf.</th><th class="n">dif. % contra o Omie</th><th class="n">saídas DFC s/ transf.</th><th class="n">dif. % contra o Omie</th></tr>
${linhasMes.map((l) => `<tr><td>${l.nome}</td>
<td class="n">${brl(l.dfcStR)}</td><td class="n ${classePct(l.pctStR)}">${fmtPct(l.pctStR)}</td>
<td class="n">${brl(l.dfcStP)}</td><td class="n ${classePct(l.pctStP)}">${fmtPct(l.pctStP)}</td></tr>`).join("\n")}
</table>

<h2>3. Casamento dos lançamentos, agora dizendo de que unidade é cada um</h2>
<p><strong>O critério.</strong> Não existe chave que ligue uma linha do DFC a um título do Omie — a coluna <code>TITULO</code> do DFC guarda o número
do projeto, da PO ou da nota, nunca o <code>nCodTitulo</code>. Então o casamento é por <strong>natureza + data de pagamento + valor até o centavo</strong>,
tratado como multiconjunto: cada linha do DFC casa com no máximo um lançamento do Omie, e vice-versa. Cada lançamento do Omie que casa
<strong>leva a marca da pasta de onde veio a linha que o achou</strong> — é essa marca que a seção 4 usa.</p>
<table>
<tr><th>critério</th><th class="n">casados</th><th class="n">% das linhas do DFC</th><th class="n">% dos lanç. do Omie</th><th class="n">só no DFC</th><th class="n">só no Omie</th></tr>
<tr><td>exato — natureza + dia do pagamento + valor, <strong>as ${unidades.length} pastas</strong></td><td class="n">${exato.casados}</td><td class="n">${semSinal(pct(exato.casados, dfcTodos.length))}</td><td class="n">${semSinal(pct(exato.casados, omieTodos.length))}</td><td class="n">${exato.soDfc.length}</td><td class="n">${exato.soOmie.length}</td></tr>
<tr><td>exato — <strong>só a pasta da MeuBESS</strong> (o confronto anterior)</td><td class="n">${soMeuBess.casados}</td><td class="n">${semSinal(pct(soMeuBess.casados, dfcMeuBess.length))}</td><td class="n">${semSinal(pct(soMeuBess.casados, omieTodos.length))}</td><td class="n">${soMeuBess.soDfc.length}</td><td class="n">${soMeuBess.soOmie.length}</td></tr>
<tr><td>frouxo — natureza + mês do pagamento + valor, as ${unidades.length} pastas</td><td class="n">${frouxo.casados}</td><td class="n">${semSinal(pct(frouxo.casados, dfcTodos.length))}</td><td class="n">${semSinal(pct(frouxo.casados, omieTodos.length))}</td><td class="n">${frouxo.soDfc.length}</td><td class="n">${frouxo.soOmie.length}</td></tr>
</table>

<h3>A que unidade pertence cada lançamento do Omie que casou</h3>
<table>
<tr><th>unidade (pasta do DFC)</th><th class="n">lanç. do Omie que casaram</th><th class="n">% do Omie</th><th class="n">linhas do DFC da pasta</th><th class="n">% das linhas da pasta que acharam par</th></tr>
${casadosPorUnidade.map((c) => `<tr><td><strong>${esc(rotuloUnidade(c.u.id))}</strong>${c.u.id === U0 ? ' <span class="tag">MeuBESS</span>' : ""}</td>
<td class="n">${c.casados}</td><td class="n">${semSinal(c.pctOmie)}</td><td class="n">${c.doDfc}</td><td class="n">${semSinal(c.pctDfc)}</td></tr>`).join("\n")}
<tr><td><em>sem par em pasta nenhuma</em></td><td class="n">${exato.soOmie.length}</td><td class="n">${semSinal(pct(exato.soOmie.length, omieTodos.length))}</td><td class="n">—</td><td class="n">—</td></tr>
</table>
<div class="nota"><strong>O tamanho da dúvida.</strong> ${exato.disputados} lançamento(s) do Omie têm chave (natureza + dia + valor)
reivindicada por linhas de <strong>mais de uma</strong> pasta. Neles a atribuição de unidade é arbitrária — o script entrega a quem pediu
primeiro, na ordem das pastas. É ${semSinal(pct(exato.disputados, Math.max(exato.casados, 1)))} dos casados: a leitura das seções
seguintes não muda por causa disso, mas o número não é zero.</div>

<h3>Os tipos mais comuns de cada lado (critério exato, as ${unidades.length} pastas)</h3>
<table>
<tr><th>só no DFC — <code>CLASS. CONTABIL</code></th><th class="n">linhas</th><th>só no DFC — <code>SUB 2</code></th><th class="n">linhas</th></tr>
${(() => {
  const a = topN(exato.soDfc, "classe"), b = topN(exato.soDfc, "sub2");
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    `<tr><td>${esc(a[i]?.[0] ?? "")}</td><td class="n">${a[i]?.[1] ?? ""}</td><td>${esc(b[i]?.[0] ?? "")}</td><td class="n">${b[i]?.[1] ?? ""}</td></tr>`).join("\n");
})()}
</table>

<h2>4. O recorte: o que, no Omie, separa a MeuBESS das outras unidades</h2>
<p><strong>Como isto foi medido.</strong> Entre os lançamentos do Omie que casaram com uma linha do DFC, já se sabe de que unidade cada um é
(seção 3). Então, para cada campo candidato, a pergunta é: <em>cada valor desse campo pertence a uma unidade só?</em> Um valor conta como
<strong>exclusivo</strong> de uma unidade quando ao menos ${Math.round(PUREZA_MINIMA * 100)}% dos seus lançamentos casados são dela, e quando há
pelo menos ${CASADOS_MINIMOS} casados para a conta querer dizer alguma coisa. O <strong>recorte da MeuBESS</strong> é o conjunto dos valores
exclusivos dela; <em>% do Omie no recorte</em> é quanto do Omie inteiro esse recorte explica.</p>
<table>
<tr><th>campo do Omie</th><th class="n">valores distintos</th><th class="n">exclusivos de alguma unidade</th><th class="n">% dos lanç. do Omie que o recorte da MeuBESS pega</th><th class="n">quanto dos lanç. da MeuBESS o recorte cobre</th><th class="n">intrusos (lanç. de outra unidade dentro do recorte)</th></tr>
${recortes.map((r) => `<tr><td><strong>${esc(r.nome)}</strong></td><td class="n">${r.distintos}</td><td class="n">${r.exclusivos}</td>
<td class="n ${r.pctDentro !== null && r.pctDentro >= 50 ? "ok" : "atencao"}">${semSinal(r.pctDentro)}</td>
<td class="n ${r.cobertura !== null && r.cobertura >= 90 ? "ok" : r.cobertura !== null && r.cobertura >= 60 ? "atencao" : "ruim"}">${semSinal(r.cobertura)}</td>
<td class="n">${r.intrusos} (${semSinal(r.pctIntrusos)})</td></tr>`).join("\n")}
</table>

${contaRecorte ? `<h3>O único campo que separa alguma coisa: a conta corrente</h3>
<p>Cada unidade opera o próprio banco, e o Omie guarda a conta corrente em <code>detalhes.nCodCC</code>. Abaixo, todas as contas correntes
com movimento no período, com a unidade a que os lançamentos casados daquela conta pertencem. Uma conta "pura" é uma conta que só uma
unidade usa.</p>
<table>
<tr><th>conta corrente no Omie</th><th class="n">lanç. na faixa, sem filtro de tipo</th><th class="n">lanç. com o filtro <code>CPCR</code> (o das telas)</th><th class="n">destes, casaram com o DFC</th><th>unidade dona dos casados</th><th class="n">pureza</th><th>no recorte da MeuBESS?</th></tr>
${linhasConta.map((v) => `<tr>
<td>${esc(nomeDaConta(v.chave))} <span class="tag">emp. ${esc(v.chave.split("|")[0])}</span></td>
<td class="n">${v.semFiltro}</td>
<td class="n">${v.total}</td><td class="n">${v.casados}</td>
<td>${v.casados ? [...v.porUnidade.entries()].sort((a, b) => b[1] - a[1]).map(([u, q]) => `${esc(curtoUnidade(u))} ${q}`).join(" · ") : "—"}</td>
<td class="n">${v.pureza === null ? "—" : semSinal(v.pureza * 100)}</td>
<td>${v.exclusivo && v.dono === U0 ? '<strong class="ok">sim</strong>' : v.exclusivo ? `não — ${esc(curtoUnidade(v.dono))}` : '<span class="ruim">não dá para dizer</span>'}</td></tr>`).join("\n")}
</table>
<p><strong>Duas coisas saltam desta tabela.</strong> A primeira: a conta <code>Sicoob - B3N</code> da empresa 1 <em>se identifica sozinha</em> —
o nome dela traz a sigla <code>B3N</code>, a mesma sigla da coluna <code>EMP.</code> da pasta <code>(2)</code>, e ${(() => {
  const l = linhasConta.find((x) => /B3N/i.test(nomeDaConta(x.chave)));
  return l && l.casados ? `${semSinal(pct(l.porUnidade.get("u2") ?? 0, l.casados))} dos ${l.casados} lançamentos dela que casaram com o DFC casaram com essa pasta` : "os lançamentos dela casam com essa pasta";
})()}. É o único ponto do Omie em que uma unidade de negócio está escrita.
A segunda: as contas das pastas <code>(1)</code> (Safra) e <code>(3)</code> (Bradesco) <strong>quase não existem no que as telas leem</strong> —
o movimento delas aparece na faixa sem filtro de tipo e some com o <code>cTpLancamento: "CPCR"</code>. É por isso que as duas casaram zero
lançamento na seção 3: não é que o Omie não as tenha, é que a leitura das Telas 1 e 2 não as alcança.</p>
<p>Em valor: o recorte da MeuBESS por conta corrente pega <strong>${brl(valorNoRecorte)}</strong> dos <strong>${brl(valorTotalOmie)}</strong>
movimentados no Omie no período — ${semSinal(pct(valorNoRecorte, valorTotalOmie))} do dinheiro, contra ${semSinal(contaRecorte.pctDentro)}
dos lançamentos.</p>` : ""}

<div class="lacuna">
  <strong>A resposta: o campo é a conta corrente — e só ela. Mas o que ela separa foi verificado em ${semSinal(pct(exato.casados, Math.max(omieTodos.length, 1)))} do Omie, não no Omie inteiro.</strong>
  <ul>
    <li><strong>A conta corrente separa.</strong> ${contaRecorte?.exclusivos ?? 0} das ${contaRecorte?.distintos ?? 0} contas com movimento no
      período são exclusivas de uma unidade; as da MeuBESS pegam <strong>${semSinal(contaRecorte?.pctDentro)} dos lançamentos</strong> do Omie e
      cobrem ${semSinal(contaRecorte?.cobertura)} do que se sabe ser da MeuBESS, levando junto ${contaRecorte?.intrusos ?? 0} lançamento(s) de
      outra unidade (${semSinal(contaRecorte?.pctIntrusos)} do recorte). O Itaú das duas empresas — que é quase todo o movimento — é da
      MeuBESS; o <code>Sicoob - B3N</code> da empresa 1 é da pasta <code>(2)</code>, e o nome da conta diz isso sozinho.</li>
    <li><strong>O departamento não serve.</strong> A árvore de departamentos do Omie tem <em>uma raiz só</em> — <code>MEU BESS</code>, estrutura
      <code>001</code> — e abaixo dela setores (<code>ADMINISTRATIVO</code>, <code>OPERACIONAL</code>, <code>COMERCIAL</code> e seus filhos), iguais nas
      duas empresas. É um organograma, não uma divisão de unidades de negócio. Além disso só
      ${semSinal(pct(omieTodos.filter((l) => l.temDepartamento).length, Math.max(omieTodos.length, 1)))} dos lançamentos trazem departamento
      rateado${deptRecorte ? `, e o recorte por departamento cobriria só ${semSinal(deptRecorte.cobertura)} da MeuBESS` : ""}.</li>
    <li><strong>A categoria não serve.</strong> As quatro unidades usam o mesmo plano de categorias — é o mesmo cadastro da empresa. Uma
      categoria como "Compras de mercadorias" não diz de quem é a compra. O recorte por categoria só parece funcionar
      (${semSinal(recortes.find((r) => r.campo === "categoria")?.pctDentro)}) porque as unidades novas quase não aparecem no teste, e não
      porque a categoria carregue a unidade.</li>
    <li><strong>O projeto e o vendedor não servem</strong>: a maioria esmagadora dos lançamentos vem sem projeto e sem vendedor.</li>
    <li><strong>A empresa/filial não serve</strong>: as duas filiais têm lançamento das duas coisas.</li>
  </ul>
  <strong>A ressalva que impede chamar isto de resolvido.</strong> ${semSinal(pct(exato.soOmie.length, Math.max(omieTodos.length, 1)))} dos
  lançamentos do Omie <em>não acharam par em pasta nenhuma</em> — a unidade deles é desconhecida, e o teste de pureza nada diz sobre eles. Pior:
  as pastas <code>(1)</code> e <code>(3)</code> casaram <strong>zero</strong> lançamento, então o teste nunca chegou a ver essas duas unidades.
  Elas movimentam dinheiro no Omie (a tabela acima mostra o Safra com ${linhasConta.find((x) => /Safra/i.test(nomeDaConta(x.chave)))?.semFiltro ?? 0}
  lançamentos na faixa), mas <strong>fora do filtro <code>cTpLancamento: "CPCR"</code></strong> que as Telas 1 e 2 usam.
  <strong>Portanto: há um recorte por conta corrente, ele explica a maior parte do Omie e é o melhor que existe hoje — mas ele não é um campo
  que diga "esta linha é da MeuBESS". É uma lista de contas mantida à mão, que quebra no dia em que uma unidade lançar na conta da outra
  (já há ${contaRecorte?.intrusos ?? 0} caso(s) assim).</strong> Fechar isto é decisão do dono e pede uma marca nova no Omie — um
  departamento-raiz por unidade é o caminho mais barato, porque o campo já existe e já é rateável. <strong>Nada foi alterado no Omie, e nenhuma
  lacuna de <code>docs/fontes.md</code> foi fechada por esta leitura.</strong>
</div>

<h2>5. Por que o Omie tem menos lançamentos que o DFC somado</h2>
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

<h2>6. Por grupo das Telas 1 e 2: quem tem o dado mais completo</h2>
<p>Agora com o DFC <strong>só da pasta da MeuBESS</strong> — as telas são da MeuBESS, não do grupo. A medida é: de todos os lançamentos de
caixa do período (entradas, para a receita; saídas, para o resto), quantos cada fonte consegue <strong>classificar dentro do grupo com o que ela
mesma traz</strong>. No DFC a classificação está escrita na própria linha (<code>CLASS. CONTABIL</code> e <code>SUB 2</code>); no Omie depende de
um campo que o lançamento pode ou não trazer.</p>
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
que poderia colocá-los em algum grupo</em> — e o lado do Omie está contando o CNPJ inteiro, as quatro unidades, porque o recorte da seção 4
não fecha. "COGS" e "Despesas gerais" mostram exatamente o mesmo número do lado do Omie, porque o campo é o mesmo
(<code>codigo_dre</code>) e <strong>ele não separa os dois</strong> enquanto o dono não disser quais contas do DRE são custo e quais são despesa
geral. É uma lacuna que segue aberta em <code>docs/fontes.md</code>.</div>

<h2>7. Proposta, indicador a indicador, considerando só a MeuBESS</h2>
<p>Para cada um dos ${PROPOSTA.length} indicadores das Telas 1 e 2 que hoje carregam <strong>lacuna: Omie ou DFC</strong> em <code>docs/fontes.md</code>.
<strong>Isto é proposta, não decisão</strong> — nenhuma lacuna foi fechada e nenhuma fonte foi trocada no <code>docs/fontes.md</code>.
A regra que orientou a coluna "fonte principal" segue a mesma: <em>onde a classificação decide o número, o DFC leva</em> (ele escreve a classe na
própria linha); <em>onde o cadastro ou a carteira decide, o Omie leva</em> (ele tem cliente, categoria, departamento, status e pagamento parcial).
A coluna nova — <strong>o que muda considerando só a MeuBESS</strong> — é a revisão desta leitura.</p>
<div class="lacuna"><strong>A ressalva que agora vale para a tabela inteira.</strong> Onde a proposta diz "Omie", o número sai do CNPJ inteiro,
com as outras unidades de negócio dentro, <em>a menos que a consulta filtre por conta corrente</em>. A seção 4 mostrou que a conta corrente é o
único campo que separa, que o recorte dela pega ${semSinal(contaRecorte?.pctDentro)} dos lançamentos — e que ele foi verificado só nos
${semSinal(pct(exato.casados, Math.max(omieTodos.length, 1)))} que casaram com o DFC. Então a instrução prática para as telas é:
<strong>toda consulta ao Omie nas Telas 1 e 2 passa a levar a lista de contas correntes da MeuBESS</strong> (a coluna "no recorte da MeuBESS?"
da seção 4), e todo número que vier de lá mostra que é um recorte por conta, não uma marca de unidade. Onde o recorte pesa mais que o
cadastro, vale trocar para o DFC: a pasta do DFC da MeuBESS <strong>já é só dela</strong>. As duas escolhas são do dono.</div>
<div class="nota">E a ressalva antiga continua de pé: onde a proposta diz "Omie", isso só vale <strong>de março de ${ANO} em diante</strong> —
em janeiro e fevereiro o Omie quase não tem lançamento pago. Para a série histórica de ${ANO}, a única fonte que cobre o ano inteiro é o DFC.</div>
<table>
<tr><th>tela</th><th>indicador</th><th>fonte principal proposta</th><th>confronto</th><th>como o confronto aparece na tela</th><th>o que muda considerando só a MeuBESS</th></tr>
${PROPOSTA.map(([t, i, f, c, v, r]) => `<tr><td>${esc(t)}</td><td><strong>${esc(i)}</strong></td><td>${esc(f)}</td><td>${esc(c)}</td><td>${esc(v)}</td><td>${esc(r)}</td></tr>`).join("\n")}
</table>

<h3>O aviso na tela, em uma regra só</h3>
<p>Todo cartão e toda linha de DRE com fonte principal e confronto mostra o número da fonte principal. Ao lado do valor, um selo pequeno:</p>
<ul>
  <li><strong>sem selo</strong> quando a diferença contra a outra fonte fica em <strong>até 2%</strong> — é ruído de arredondamento e de data de baixa;</li>
  <li><strong>selo âmbar "confere: X%"</strong> entre <strong>2% e 5%</strong>, com o valor da outra fonte no tooltip;</li>
  <li><strong>selo vermelho "diverge: X%"</strong> acima de <strong>5%</strong>, que abre a lista dos lançamentos sem par naquele mês.</li>
  <li><strong>selo cinza "sem recorte"</strong> — <em>novo</em> — em todo número que vem do Omie enquanto o recorte da MeuBESS não existir, dizendo
    no tooltip que aquele valor inclui as outras unidades de negócio do mesmo CNPJ.</li>
</ul>
<p>Os três primeiros limites saem do que a seção 2 mostrou, e o dono pode mexer neles. De outubro a dezembro o selo de diferença não aparece:
ali o DFC só tem provisão, e comparar seria comparar com nada.</p>

<h2>8. O que este confronto não resolve</h2>
<ul>
  <li><strong>O recorte da MeuBESS no Omie é uma lista de contas, não um campo</strong> (seção 4). É a lacuna nova desta leitura: enquanto
    o Omie não tiver uma marca de unidade, o recorte é mantido à mão, vale ${semSinal(contaRecorte?.pctDentro)} dos lançamentos e foi
    verificado só nos ${semSinal(pct(exato.casados, Math.max(omieTodos.length, 1)))} que casaram com o DFC.</li>
  <li><strong>Duas das unidades novas não aparecem no que as telas leem.</strong> As pastas <code>(1)</code> e <code>(3)</code> casaram zero
    lançamento: o movimento delas fica fora do filtro <code>cTpLancamento: "CPCR"</code>. Isso é bom para a tela — menos contaminação — e ruim
    para a conferência: não dá para medir o que não se vê.</li>
  <li><strong>Não há chave entre as duas fontes.</strong> O casamento por data e valor é aproximação: dois lançamentos do mesmo valor no mesmo dia
    são indistinguíveis, e um pagamento agrupado num lado e partido no outro nunca casa. Com quatro pastas, isso piora: ${exato.disputados}
    lançamento(s) do Omie têm a chave disputada por mais de uma unidade.</li>
  <li><strong>As pastas novas não cobrem o ano.</strong> Elas começam em abril, agosto e agosto; de janeiro a março a soma das quatro é igual à
    da MeuBESS sozinha. Comparar o total do ano é comparar coisas diferentes mês a mês.</li>
  <li><strong>Pagamento parcial.</strong> O Omie separa <code>nValPago</code> de <code>nValorTitulo</code>; o DFC tem a coluna <code>STATUS</code>
    (<code>INTEGRAL</code>, <code>PARCIAL</code>, <code>SINAL</code>) mas o valor da linha é o que entrou.</li>
  <li><strong>Transferências entre as unidades.</strong> Uma transferência de uma unidade do grupo para outra aparece duas vezes na soma das
    quatro pastas — uma como saída, outra como entrada. A terceira tabela da seção 2 mostra o tamanho do efeito.</li>
  <li><strong>As lacunas de cadastro seguem abertas</strong> — os 77 códigos de categoria com cadastro diferente entre as empresas, as 14
    categorias sem <code>codigo_dre</code>, a lista de departamentos de pessoal e a de contas de custo do DRE.</li>
</ul>

<footer>
Gerado por <code>scripts/confronto-dfc-omie.mjs</code> em ${esc(hoje)}. Só leitura das duas fontes: nenhum arquivo das ${unidades.length} pastas
sincronizadas foi gravado, movido ou aberto para edição, nenhuma planilha foi copiada para o repositório e nenhuma escrita foi feita no Omie.
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
