// Confere, contra o Omie de verdade, os campos do pedido de venda citados em docs/fontes.md e o campo que liga
// o título a receber ao pedido que o originou.
// Só leitura: ListarPedidos, ConsultarPedido (produtos/pedido), PesquisarLancamentos (financas/pesquisartitulos) e
// ListarMovimentos (financas/mf). Nenhum método que inclua, altere ou exclua.
// Nunca imprime valor em dinheiro, nome/CPF/CNPJ de cliente, descrição de produto nem a chave — nem em erro.
// O que sai: NOMES de campo e se existem, o código/número do pedido e do título usados como caso, e o campo de ligação.
// Saída na tela e em mapa-omie-pedido-titulo.log na raiz (ignorado pelo git); a última linha é FIM.
//
// Uso: node scripts/conferir-pedido-titulo.mjs
// Credencial: OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET no .env da raiz (fora do git) — a chave da filial
// /0002-23, a única com os pedidos da plataforma. Imprime só o NOME da variável que faltar, nunca o valor.
// Node 21.7+, sem dependências.

import { appendFileSync, writeFileSync } from "node:fs";

const LOG = new URL("../mapa-omie-pedido-titulo.log", import.meta.url);
writeFileSync(LOG, "");
const registrar = (linha = "") => {
  console.log(linha);
  appendFileSync(LOG, `${linha}\n`);
};
const falhar = (msg) => {
  registrar(`ERRO: ${msg}`);
  registrar("FIM");
  process.exit(1);
};

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  falhar("arquivo .env não encontrado ou ilegível na raiz do repositório");
}
const APP_KEY = process.env.OMIE_MEUBESS_2_APP_KEY;
const APP_SECRET = process.env.OMIE_MEUBESS_2_APP_SECRET;
// só o NOME da variável que falta, nunca o valor
const faltam = [["OMIE_MEUBESS_2_APP_KEY", APP_KEY], ["OMIE_MEUBESS_2_APP_SECRET", APP_SECRET]]
  .filter(([, v]) => !v)
  .map(([n]) => n);
if (faltam.length) falhar(`${faltam.join(" e ")} precisa(m) estar preenchida(s) no .env`);

const BASE = "https://app.omie.com.br/api/v1/";
const TEMPO_LIMITE_MS = 60000;
const PAUSA_MS = 1200;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(servico, call, param) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TEMPO_LIMITE_MS);
  let resp;
  try {
    resp = await fetch(`${BASE}${servico}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: APP_KEY, app_secret: APP_SECRET, param: [param] }),
      signal: ac.signal,
    });
  } catch {
    clearTimeout(t);
    return { erro: `sem resposta do Omie em ${servico} ${call}` };
  }
  clearTimeout(t);
  let json;
  try {
    json = await resp.json();
  } catch {
    return { erro: `resposta não-JSON de ${servico} ${call} (HTTP ${resp.status})` };
  }
  if (json.faultstring) return { erro: `${servico} ${call}: ${json.faultcode ?? "?"} ${json.faultstring}` };
  if (!resp.ok) return { erro: `${servico} ${call}: HTTP ${resp.status}` };
  return { json };
}

// caminho -> valor, achatado: permite listar os campos pelo NOME e comparar valores sem nunca imprimi-los
function achatar(obj, prefixo = "", saida = new Map()) {
  if (obj === null || typeof obj !== "object") return saida;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefixo ? `${prefixo}.${k}` : k;
    if (Array.isArray(v)) {
      saida.set(`${p}[]`, `(${v.length} item(ns))`);
      if (v.length) achatar(v[0], `${p}[0]`, saida);
    } else if (v && typeof v === "object") {
      achatar(v, p, saida);
    } else {
      saida.set(p, v);
    }
  }
  return saida;
}

// ------------------------------------------------------------ 1. um pedido de venda faturado recente

registrar("== 1. Um pedido de venda faturado recente (filial /0002-23) ==");
const r1 = await chamar("produtos/pedido", "ListarPedidos", { pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N" });
if (r1.erro) falhar(r1.erro);
const totalPaginas = Number(r1.json.total_de_paginas) || 1;
registrar(`  ListarPedidos: ${r1.json.total_de_registros ?? "?"} pedido(s) em ${totalPaginas} pagina(s); a API devolve em ordem crescente de codigo, os recentes ficam na ultima`);
await espera(PAUSA_MS);
const rUlt = totalPaginas > 1
  ? await chamar("produtos/pedido", "ListarPedidos", { pagina: totalPaginas, registros_por_pagina: 50, apenas_importado_api: "N" })
  : r1;
if (rUlt.erro) falhar(rUlt.erro);
const lista = rUlt.json.pedido_venda_produto ?? [];
const etapas = {};
for (const p of lista) etapas[p.cabecalho?.etapa ?? "?"] = (etapas[p.cabecalho?.etapa ?? "?"] ?? 0) + 1;
registrar(`  etapas dos ${lista.length} pedidos mais recentes: ${JSON.stringify(etapas)}`);
// faturado de verdade e infoCadastro.faturado = "S"; a etapa sozinha nao basta (ha etapa 80 com faturado = "N")
const pedidoLista = [...lista].reverse().find((p) => p.infoCadastro?.faturado === "S" && p.infoCadastro?.cancelado !== "S");
if (!pedidoLista) falhar("nenhum pedido com infoCadastro.faturado = S nesta pagina");
const codigoPedido = pedidoLista.cabecalho.codigo_pedido;
const numeroPedido = String(pedidoLista.cabecalho.numero_pedido);
registrar(`  pedido escolhido: codigo_pedido=${codigoPedido} numero_pedido=${numeroPedido} etapa=${pedidoLista.cabecalho.etapa} infoCadastro.faturado=${pedidoLista.infoCadastro.faturado}`);

await espera(PAUSA_MS);
const rc = await chamar("produtos/pedido", "ConsultarPedido", { codigo_pedido: Number(codigoPedido) });
if (rc.erro) falhar(rc.erro);
const pedido = rc.json.pedido_venda_produto ?? rc.json;
const mapaPedido = achatar(pedido);

// ------------------------------------------------------------ 2. os campos citados em docs/fontes.md

registrar("");
registrar("== 2. Campos do pedido citados em docs/fontes.md ==");
const esperados = [
  "cabecalho.codigo_pedido",
  "cabecalho.numero_pedido",
  "cabecalho.codigo_cliente",
  "cabecalho.data_previsao",
  "cabecalho.etapa",
  "det[]",
  "det[0].produto.codigo_produto",
  "det[0].produto.descricao",
  "det[0].produto.quantidade",
  "det[0].produto.valor_unitario",
  "det[0].produto.valor_total",
  "total_pedido.valor_total_pedido",
  "informacoes_adicionais.codigo_categoria",
];
for (const c of esperados) {
  const chave = c.replace(/\[\]$/, "");
  registrar(`  ${mapaPedido.has(chave) || mapaPedido.has(`${chave}[]`) ? "existe     " : "NAO EXISTE "} ${c}`);
}
registrar(`  itens em det[]: ${(pedido.det ?? []).length}; todos com produto.descricao preenchida: ${(pedido.det ?? []).every((d) => !!d.produto?.descricao)}`);
registrar("");
registrar("  todos os campos que o ConsultarPedido devolveu (so os nomes):");
for (const k of [...mapaPedido.keys()].sort()) registrar(`    ${k}`);

// ------------------------------------------------------------ 3. o campo que liga titulo e pedido

registrar("");
registrar("== 3. O titulo a receber que nasceu desse pedido ==");
const alvos = new Map([[String(codigoPedido), "cabecalho.codigo_pedido"], [numeroPedido, "cabecalho.numero_pedido"]]);

// 3a. pedido -> titulo: o nCodOS serve de FILTRO no PesquisarLancamentos?
await espera(PAUSA_MS);
const rf = await chamar("financas/pesquisartitulos", "PesquisarLancamentos", {
  nPagina: 1,
  nRegPorPagina: 20,
  cNatureza: "R",
  nCodOS: Number(codigoPedido),
});
let titulo = null;
if (rf.erro) {
  registrar(`  3a. PesquisarLancamentos com nCodOS=codigo_pedido: NAO aceita o filtro - ${rf.erro}`);
} else {
  const ts = rf.json.titulosEncontrados ?? [];
  titulo = ts[0] ?? null;
  registrar(`  3a. pedido -> titulo: PesquisarLancamentos com nCodOS=${codigoPedido} devolveu ${ts.length} titulo(s); nCodOS do 1o = ${titulo?.cabecTitulo?.nCodOS}`);
}
if (titulo) {
  const c = titulo.cabecTitulo;
  registrar(`      titulo: nCodTitulo=${c.nCodTitulo} cNumOS=${c.cNumOS} cOrigem=${c.cOrigem} cTipo=${c.cTipo} cStatus=${c.cStatus} cNumTitulo=${c.cNumTitulo ?? "(vazio)"}`);
  const m = achatar(titulo);
  const batem = [...m].filter(([, v]) => v != null && v !== "" && alvos.has(String(v)));
  registrar(`      campos do titulo que batem com o pedido: ${batem.map(([caminho, v]) => `${caminho} = ${alvos.get(String(v))}`).join(", ") || "NENHUM"}`);
  registrar("      todos os campos do titulo (so os nomes):");
  for (const k of [...m.keys()].sort()) registrar(`        ${k}`);
}

// 3b. titulo -> pedido: o nCodOS abre mesmo o pedido?
if (titulo?.cabecTitulo?.nCodOS) {
  await espera(PAUSA_MS);
  const rv = await chamar("produtos/pedido", "ConsultarPedido", { codigo_pedido: Number(titulo.cabecTitulo.nCodOS) });
  registrar(rv.erro
    ? `  3b. titulo -> pedido: ERRO ${rv.erro}`
    : `  3b. titulo -> pedido: ConsultarPedido(codigo_pedido=nCodOS) devolveu numero_pedido=${(rv.json.pedido_venda_produto ?? rv.json).cabecalho?.numero_pedido} (cNumOS do titulo = ${titulo.cabecTitulo.cNumOS})`);
}

// 3c. o mesmo campo existe no financas/mf, de onde saem as Telas 1 e 2?
await espera(PAUSA_MS);
const rm = await chamar("financas/mf", "ListarMovimentos", { nPagina: 1, nRegPorPagina: 20, nCodOS: Number(codigoPedido) });
registrar(rm.erro
  ? `  3c. financas/mf ListarMovimentos com nCodOS: NAO aceita o filtro - ${rm.erro}`
  : `  3c. financas/mf ListarMovimentos com nCodOS=${codigoPedido} devolveu ${(rm.json.movimentos ?? []).length} movimento(s); detalhes.nCodOS = ${(rm.json.movimentos ?? [])[0]?.detalhes?.nCodOS}, detalhes.cNumOS = ${(rm.json.movimentos ?? [])[0]?.detalhes?.cNumOS}`);

// ------------------------------------------------------------ 4. quantos titulos tem a ligacao

registrar("");
registrar("== 4. Cobertura da ligacao (amostra: 1 pagina de 100 titulos a receber) ==");
await espera(PAUSA_MS);
const ra = await chamar("financas/pesquisartitulos", "PesquisarLancamentos", { nPagina: 1, nRegPorPagina: 100, cNatureza: "R" });
if (ra.erro) {
  registrar(`  ${ra.erro}`);
} else {
  const ts = ra.json.titulosEncontrados ?? [];
  const tab = {};
  for (const t of ts) {
    const o = t.cabecTitulo?.cOrigem ?? "?";
    const tem = t.cabecTitulo?.nCodOS && Number(t.cabecTitulo.nCodOS) !== 0 ? "com nCodOS" : "sem nCodOS";
    tab[o] = tab[o] ?? {};
    tab[o][tem] = (tab[o][tem] ?? 0) + 1;
  }
  registrar(`  ${ts.length} titulos lidos (total na base: ${ra.json.nTotRegistros}); por cOrigem:`);
  for (const [o, v] of Object.entries(tab)) registrar(`    cOrigem=${o}: ${JSON.stringify(v)}`);
  registrar(`  titulos com cNumTitulo vazio: ${ts.filter((t) => !t.cabecTitulo?.cNumTitulo).length} de ${ts.length}`);
}

registrar("FIM");
