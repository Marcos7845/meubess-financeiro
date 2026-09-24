// Gera docs/plano-de-categorias-omie.html: o plano de categorias e os departamentos do Omie da filial /0002-23,
// agrupados pela conta do DRE, cada item com a contagem de lançamentos de 2026 que o usam.
// A página só MOSTRA o cadastro; quem decide o que é dedução, custo, imposto ou centro de pessoal é a MeuBESS.
//
// Só leitura: geral/categorias ListarCategorias, geral/departamentos ListarDepartamentos, geral/dre
// ListarCadastroDRE e financas/mf ListarMovimentos. Nenhum método que inclua, altere ou exclua.
// Dos lançamentos guarda só a CONTAGEM por categoria e por departamento: nunca valor em reais, nome ou documento de
// cliente ou fornecedor, nem a chave — nem em erro. Os nomes que aparecem na página são os do cadastro de categorias,
// departamentos e contas do DRE da própria MeuBESS.
//
// "Lançamento de 2026" = lançamento do financas/mf com emissão (dDtEmisDe / dDtEmisAte) entre 01/01 e 31/12/2026,
// fora os de cStatus = CANCELADO. Cada lançamento conta uma vez por categoria e uma vez por departamento.
//
// Uso: node scripts/plano-de-contas-omie.mjs [ano]     (padrão: 2026)
// Credencial: OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET no .env da raiz (fora do git). Imprime só o NOME da
// variável que faltar, nunca o valor. Node 21.7+, sem dependências.

import { writeFileSync } from "node:fs";

const falhar = (msg) => {
  console.log(`ERRO: ${msg}`);
  process.exit(1);
};

const ANO = process.argv[2] ?? "2026";
if (!/^\d{4}$/.test(ANO)) falhar("o ano deve ter 4 dígitos (ex.: 2026)");

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
const TENTATIVAS = 4;
const POR_PAGINA = 100;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Uma chamada com nova tentativa em falha de rede, HTTP 5xx/425/429 ou erro de consumo; erro do Omie sai sem a chave.
async function chamar(servico, call, param) {
  let ultimo = "";
  for (let n = 1; n <= TENTATIVAS; n++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TEMPO_LIMITE_MS);
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call, app_key: APP_KEY, app_secret: APP_SECRET, param: [param] }),
        signal: ac.signal,
      });
      let json = null;
      try {
        json = await resp.json();
      } catch {
        /* corpo não-JSON: tratado abaixo */
      }
      if (json?.faultstring) {
        ultimo = `${servico} ${call}: ${json.faultcode ?? "?"} ${json.faultstring}`;
        // consumo redundante / limite de requisições: vale esperar e repetir
        if (!/REDUNDANT|consumo|aguarde|bloquead/i.test(`${json.faultcode} ${json.faultstring}`)) falhar(ultimo);
      } else if (json && resp.ok) {
        return json;
      } else {
        ultimo = `${servico} ${call}: HTTP ${resp.status}`;
        if (resp.status < 500 && resp.status !== 425 && resp.status !== 429) falhar(ultimo);
      }
    } catch {
      ultimo = `${servico} ${call}: sem resposta do Omie (rede ou tempo limite)`;
    } finally {
      clearTimeout(t);
    }
    await espera(PAUSA_MS * n * 3);
  }
  return falhar(`${ultimo} (desisti após ${TENTATIVAS} tentativas)`);
}

// ---------------------------------------------------------------- cadastros

async function todasAsPaginas(servico, call, campo, extra = {}) {
  const itens = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const r = await chamar(servico, call, { pagina: n, registros_por_pagina: POR_PAGINA, ...extra });
    total = Number(r.total_de_paginas) || 1;
    itens.push(...(r[campo] ?? []));
    await espera(PAUSA_MS);
  }
  return itens;
}

console.log("lendo categorias, departamentos e o cadastro do DRE...");
const categorias = await todasAsPaginas("geral/categorias", "ListarCategorias", "categoria_cadastro");
const departamentos = await todasAsPaginas("geral/departamentos", "ListarDepartamentos", "departamentos");
const dreBruto = await chamar("geral/dre", "ListarCadastroDRE", { apenasContasAtivas: "N" });
const contasDre = dreBruto.dreLista ?? [];
console.log(`  ${categorias.length} categorias, ${departamentos.length} departamentos, ${contasDre.length} contas do DRE`);

// ---------------------------------------------------------------- contagem dos lançamentos do ano

console.log(`contando os lançamentos emitidos em ${ANO} (financas/mf, cExibirDepartamentos = S)...`);
const porCategoria = new Map(); // cCodCateg -> lançamentos
const porDepartamento = new Map(); // cCodDepartamento -> lançamentos
let lidos = 0;
let cancelados = 0;
let semDepartamento = 0;
let semCategoria = 0;
let totalPaginas = 1;
for (let n = 1; n <= totalPaginas; n++) {
  const r = await chamar("financas/mf", "ListarMovimentos", {
    nPagina: n,
    nRegPorPagina: POR_PAGINA,
    dDtEmisDe: `01/01/${ANO}`,
    dDtEmisAte: `31/12/${ANO}`,
    cExibirDepartamentos: "S",
  });
  totalPaginas = Number(r.nTotPaginas) || 1;
  for (const mov of r.movimentos ?? []) {
    lidos++;
    if (mov.detalhes?.cStatus === "CANCELADO") {
      cancelados++;
      continue;
    }
    // categoria: o rateio (categorias[]) quando vier, senão a categoria do próprio lançamento
    const cats = new Set((mov.categorias ?? []).map((c) => c.cCodCateg).filter(Boolean));
    if (!cats.size && mov.detalhes?.cCodCateg) cats.add(mov.detalhes.cCodCateg);
    if (!cats.size) semCategoria++;
    for (const c of cats) porCategoria.set(c, (porCategoria.get(c) ?? 0) + 1);
    const deps = new Set((mov.departamentos ?? []).map((d) => String(d.cCodDepartamento)).filter(Boolean));
    if (!deps.size) semDepartamento++;
    for (const d of deps) porDepartamento.set(d, (porDepartamento.get(d) ?? 0) + 1);
  }
  if (n % 5 === 0 || n === totalPaginas) console.log(`  página ${n}/${totalPaginas}: ${lidos} lançamentos lidos`);
  await espera(PAUSA_MS);
}
const validos = lidos - cancelados;
console.log(`  ${lidos} lidos, ${cancelados} cancelados (fora), ${validos} contados`);

// ---------------------------------------------------------------- monta os dados da página

const dreDe = new Map(contasDre.map((c) => [String(c.codigoDRE), c]));
const itensCat = categorias.map((c) => {
  const codigoDre = c.codigo_dre ? String(c.codigo_dre) : "";
  const receita = c.conta_receita === "S";
  const despesa = c.conta_despesa === "S";
  return {
    codigo: String(c.codigo),
    descricao: c.descricao ?? "",
    tipo: c.totalizadora === "S" ? "totalizadora" : c.transferencia === "S" ? "transferência" : receita ? "receita" : despesa ? "despesa" : "—",
    totalizadora: c.totalizadora === "S",
    codigoDre,
    ativa: c.conta_inativa !== "S",
    lancamentos: porCategoria.get(String(c.codigo)) ?? 0,
  };
});
const codigosCadastrados = new Set(itensCat.map((c) => c.codigo));
const usadasForaDoCadastro = [...porCategoria.keys()].filter((c) => !codigosCadastrados.has(c));

const itensDep = departamentos.map((d) => ({
  codigo: String(d.codigo),
  descricao: d.descricao ?? "",
  ativo: d.inativo !== "S",
  lancamentos: porDepartamento.get(String(d.codigo)) ?? 0,
}));

const porContaDre = new Map();
for (const c of itensCat) {
  const chave = c.codigoDre && dreDe.has(c.codigoDre) ? c.codigoDre : c.codigoDre ? `?${c.codigoDre}` : "";
  if (!porContaDre.has(chave)) porContaDre.set(chave, []);
  porContaDre.get(chave).push(c);
}
const ordem = (a, b) => b.lancamentos - a.lancamentos || a.descricao.localeCompare(b.descricao, "pt-BR");
const chavesOrdenadas = [...porContaDre.keys()].sort((a, b) => {
  if (a === "") return 1; // "sem conta do DRE" por último
  if (b === "") return -1;
  return a.localeCompare(b, "pt-BR", { numeric: true });
});
const contasDreSemCategoria = contasDre.filter((c) => !porContaDre.has(String(c.codigoDRE)));

// ---------------------------------------------------------------- HTML

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const num = (n) => Number(n).toLocaleString("pt-BR");
const nAtivas = itensCat.filter((c) => c.ativa).length;
const nDepAtivos = itensDep.filter((d) => d.ativo).length;
const usadas = itensCat.filter((c) => c.lancamentos > 0).length;
const depUsados = itensDep.filter((d) => d.lancamentos > 0).length;

function linhaCat(c) {
  const cls = [c.ativa ? "" : "inativa", c.lancamentos ? "" : "semuso"].filter(Boolean).join(" ");
  return `<tr class="${cls}"><td class="cod">${esc(c.codigo)}</td><td>${esc(c.descricao)}</td><td>${esc(c.tipo)}</td>` +
    `<td>${c.ativa ? "ativa" : "inativa"}</td><td class="n">${num(c.lancamentos)}</td></tr>`;
}

function blocoDre(chave) {
  const cats = porContaDre.get(chave).sort(ordem);
  let titulo;
  let detalhe = "";
  if (chave === "") {
    titulo = "Sem conta do DRE";
    detalhe = "categorias sem <code>codigo_dre</code> no cadastro";
  } else if (chave.startsWith("?")) {
    titulo = `Conta ${esc(chave.slice(1))} (fora do cadastro do DRE)`;
    detalhe = "o <code>codigo_dre</code> da categoria não existe em <code>ListarCadastroDRE</code>";
  } else {
    const d = dreDe.get(chave);
    titulo = `${esc(d.codigoDRE)} — ${esc(d.descricaoDRE)}`;
    detalhe = `nível ${esc(d.nivelDRE)} · sinal ${esc(d.sinalDRE)} · ${d.totalizaDRE === "S" ? "totalizadora" : "não totalizadora"}${d.naoExibirDRE === "S" ? " · não exibir" : ""}`;
  }
  const total = cats.reduce((s, c) => s + c.lancamentos, 0);
  return `<section class="grupo"><h3>${titulo} <span class="sub">${detalhe}</span></h3>
<p class="resumo">${cats.length} categoria(s), ${cats.filter((c) => c.ativa).length} ativa(s) · ${num(total)} lançamento(s)-categoria em ${ANO}</p>
<table><thead><tr><th>código</th><th>descrição</th><th>tipo</th><th>situação</th><th class="n">lançamentos ${ANO}</th></tr></thead><tbody>
${cats.map(linhaCat).join("\n")}
</tbody></table></section>`;
}

const deps = [...itensDep].sort(ordem);
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plano de categorias e departamentos do Omie — MeuBESS (${ANO})</title>
<style>
  :root { --tinta:#1d2733; --suave:#5b6776; --linha:#dde2e8; --fundo:#f6f8fa; --destaque:#0b6b4f; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui, "Segoe UI", sans-serif; color:var(--tinta); background:var(--fundo); }
  main { max-width:1000px; margin:0 auto; padding:24px 20px 60px; }
  h1 { font-size:24px; margin:0 0 4px; }
  h2 { font-size:19px; margin:36px 0 6px; padding-top:12px; border-top:2px solid var(--tinta); }
  h3 { font-size:16px; margin:0 0 2px; }
  .sub { font-weight:400; font-size:13px; color:var(--suave); margin-left:6px; }
  .quem { color:var(--suave); margin:0 0 18px; }
  .cartoes { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
  .cartao { background:#fff; border:1px solid var(--linha); border-radius:8px; padding:10px 14px; min-width:150px; }
  .cartao b { display:block; font-size:22px; color:var(--destaque); }
  .cartao span { font-size:13px; color:var(--suave); }
  .nota { background:#fff; border-left:4px solid var(--destaque); padding:10px 14px; margin:14px 0; font-size:14px; }
  .grupo { background:#fff; border:1px solid var(--linha); border-radius:8px; padding:12px 14px; margin:14px 0; }
  .resumo { margin:0 0 8px; font-size:13px; color:var(--suave); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--linha); }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--suave); }
  td.cod { font-variant-numeric:tabular-nums; color:var(--suave); white-space:nowrap; }
  .n { text-align:right; font-variant-numeric:tabular-nums; }
  tr.inativa td { color:#8a94a1; }
  tr.inativa td:nth-child(2) { text-decoration:line-through; }
  body.so-com-uso tr.semuso { display:none; }
  body.so-ativas tr.inativa { display:none; }
  .filtros { position:sticky; top:0; background:var(--fundo); padding:8px 0; border-bottom:1px solid var(--linha); z-index:2; }
  .filtros label { margin-right:18px; font-size:14px; }
  code { background:#eef1f4; padding:0 4px; border-radius:3px; font-size:12.5px; }
  ul.vazias { columns:2; font-size:14px; color:var(--suave); }
  footer { margin-top:40px; font-size:13px; color:var(--suave); }
</style>
</head>
<body>
<main>
<h1>Plano de categorias e departamentos do Omie</h1>
<p class="quem">MeuBESS · filial /0002-23 · lançamentos emitidos em ${ANO} · lido em ${new Date().toLocaleDateString("pt-BR")} · só leitura do Omie</p>

<div class="cartoes">
  <div class="cartao"><b>${num(categorias.length)}</b><span>categorias (${num(nAtivas)} ativas, ${num(categorias.length - nAtivas)} inativas)</span></div>
  <div class="cartao"><b>${num(usadas)}</b><span>categorias com lançamento em ${ANO}</span></div>
  <div class="cartao"><b>${num(departamentos.length)}</b><span>departamentos (${num(nDepAtivos)} ativos, ${num(departamentos.length - nDepAtivos)} inativos)</span></div>
  <div class="cartao"><b>${num(depUsados)}</b><span>departamentos com lançamento em ${ANO}</span></div>
  <div class="cartao"><b>${num(validos)}</b><span>lançamentos de ${ANO} contados</span></div>
</div>

<div class="nota">
  <b>Esta página só mostra o cadastro.</b> Qual categoria é dedução, custo de venda, imposto, depreciação, amortização ou
  resultado financeiro, quais departamentos são "de funcionários" e se as despesas gerais do DRE se quebram por categoria ou
  por departamento são decisões da MeuBESS. A coluna "tipo" repete os marcadores do Omie (<code>conta_receita</code>,
  <code>conta_despesa</code>, <code>totalizadora</code>, <code>transferencia</code>), não uma classificação nossa.<br>
  <b>Como ler a contagem:</b> lançamentos do <code>financas/mf</code> com emissão em ${ANO}, sem os cancelados
  (${num(cancelados)} de ${num(lidos)} lidos ficaram de fora). Cada lançamento conta uma vez por categoria e uma vez por
  departamento; um título rateado em vários departamentos aparece em cada um. ${num(semDepartamento)} lançamento(s) não têm
  departamento e ${num(semCategoria)} não trazem categoria${usadasForaDoCadastro.length ? `; ${usadasForaDoCadastro.length} código(s) de categoria usados nos lançamentos não constam no cadastro lido` : ""}.
  Sem valores em reais e sem nomes de clientes ou fornecedores.
</div>

<div class="filtros">
  <label><input type="checkbox" id="so-com-uso"> só com lançamento em ${ANO}</label>
  <label><input type="checkbox" id="so-ativas"> só ativas</label>
</div>

<h2>Categorias, agrupadas pela conta do DRE</h2>
<p class="quem">A conta do DRE é a do <code>codigo_dre</code> de cada categoria, com o nome vindo de <code>ListarCadastroDRE</code>. Dentro de cada conta, da mais usada para a menos usada.</p>
${chavesOrdenadas.map(blocoDre).join("\n")}
${contasDreSemCategoria.length ? `<section class="grupo"><h3>Contas do DRE sem nenhuma categoria ligada <span class="sub">${contasDreSemCategoria.length} conta(s)</span></h3>
<ul class="vazias">${contasDreSemCategoria.map((c) => `<li>${esc(c.codigoDRE)} — ${esc(c.descricaoDRE)}</li>`).join("")}</ul></section>` : ""}

<h2>Departamentos (centros de custo)</h2>
<div class="grupo">
<p class="resumo">${num(departamentos.length)} departamento(s) · da mais usada para a menos usada · ${num(semDepartamento)} lançamento(s) sem departamento</p>
<table><thead><tr><th>código</th><th>descrição</th><th>situação</th><th class="n">lançamentos ${ANO}</th></tr></thead><tbody>
${deps.map((d) => `<tr class="${[d.ativo ? "" : "inativa", d.lancamentos ? "" : "semuso"].filter(Boolean).join(" ")}"><td class="cod">${esc(d.codigo)}</td><td>${esc(d.descricao)}</td><td>${d.ativo ? "ativo" : "inativo"}</td><td class="n">${num(d.lancamentos)}</td></tr>`).join("\n")}
</tbody></table>
</div>

<footer>Gerada por <code>scripts/plano-de-contas-omie.mjs</code>. Fonte: API do Omie (<code>geral/categorias</code>, <code>geral/departamentos</code>, <code>geral/dre</code>, <code>financas/mf</code>), chave da filial /0002-23.</footer>
</main>
<script>
  for (const id of ["so-com-uso", "so-ativas"]) {
    document.getElementById(id).addEventListener("change", (e) => document.body.classList.toggle(id, e.target.checked));
  }
</script>
</body>
</html>
`;

const SAIDA = new URL("../docs/plano-de-categorias-omie.html", import.meta.url);
writeFileSync(SAIDA, html);

// ---------------------------------------------------------------- resumo na tela (só nomes do cadastro e contagens)

const top = (lista, n) => [...lista].sort(ordem).slice(0, n);
console.log("");
console.log(`categorias: ${categorias.length} (${nAtivas} ativas, ${categorias.length - nAtivas} inativas); com lançamento em ${ANO}: ${usadas}`);
console.log(`departamentos: ${departamentos.length} (${nDepAtivos} ativos, ${departamentos.length - nDepAtivos} inativos); com lançamento em ${ANO}: ${depUsados}`);
console.log(`sem departamento: ${semDepartamento} lançamento(s); sem categoria: ${semCategoria}; códigos de categoria fora do cadastro: ${usadasForaDoCadastro.length}`);
console.log("10 categorias de despesa com mais lançamentos (conta_despesa = S, não totalizadora):");
for (const c of top(itensCat.filter((x) => x.tipo === "despesa"), 10)) console.log(`  ${c.lancamentos}\t${c.descricao}${c.ativa ? "" : " (inativa)"}`);
console.log("5 departamentos com mais lançamentos:");
for (const d of top(itensDep, 5)) console.log(`  ${d.lancamentos}\t${d.descricao}${d.ativo ? "" : " (inativo)"}`);
console.log("");
console.log("gravado: docs/plano-de-categorias-omie.html");
console.log("FIM");
