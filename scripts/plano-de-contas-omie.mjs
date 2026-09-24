// Gera docs/plano-de-categorias-omie.html: o plano de categorias e os departamentos do Omie das DUAS empresas que as
// telas somam — empresa 1 (filial /0001-42, escritório) e empresa 2 (filial /0002-23, operação) — lado a lado,
// agrupados pela conta do DRE, cada item com a contagem de lançamentos do ano em cada empresa.
// A página só MOSTRA o cadastro; quem decide o que é dedução, custo, imposto ou centro de pessoal é a MeuBESS.
//
// Mede também o que a soma das duas empresas exige:
//   - se o plano de categorias bate entre as duas (mesmo código, mesma descrição, mesma conta do DRE);
//   - quantos lançamentos do ano são ENTRE as duas empresas (uma como cliente ou fornecedor da outra, ou categoria
//     marcada como transferência), que contariam duas vezes na soma.
//
// Só leitura: geral/empresas ListarEmpresas, geral/categorias ListarCategorias, geral/departamentos
// ListarDepartamentos, geral/dre ListarCadastroDRE e financas/mf ListarMovimentos. Nenhum método que inclua,
// altere ou exclua.
// Dos lançamentos guarda só a CONTAGEM: nunca valor em reais, nome ou documento de cliente, fornecedor ou
// funcionário, nem a chave — nem em erro. O único documento que aparece é o CNPJ das próprias filiais da MeuBESS,
// que é o que identifica um lançamento entre elas. Os nomes na página são os do cadastro de categorias,
// departamentos e contas do DRE da própria MeuBESS.
//
// "Lançamento do ano" = lançamento do financas/mf com emissão (dDtEmisDe / dDtEmisAte) dentro do ano, fora os de
// cStatus = CANCELADO. Cada lançamento conta uma vez por categoria e uma vez por departamento.
//
// Uso: node scripts/plano-de-contas-omie.mjs [ano]     (padrão: 2026)
// Credencial: no .env da raiz (fora do git), os pares OMIE_MEUBESS_1_APP_KEY / OMIE_MEUBESS_1_APP_SECRET e
// OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET. Imprime só o NOME da variável que faltar, nunca o valor.
// Node 21.7+, sem dependências.

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

// As duas empresas que as telas somam (decisão do dono, 24/09/2026). A empresa 3 (/0003-04) fica de fora.
const EMPRESAS = [
  { n: 1, rotulo: "Empresa 1", filial: "/0001-42", papel: "escritório (rotinas administrativas)" },
  { n: 2, rotulo: "Empresa 2", filial: "/0002-23", papel: "operação (compra, venda e logística)" },
];
// só o NOME da variável que falta, nunca o valor
const faltam = EMPRESAS.flatMap((e) => [`OMIE_MEUBESS_${e.n}_APP_KEY`, `OMIE_MEUBESS_${e.n}_APP_SECRET`]).filter((v) => !process.env[v]);
if (faltam.length) falhar(`${faltam.join(", ")} precisa(m) estar preenchida(s) no .env`);

const BASE = "https://app.omie.com.br/api/v1/";
const TEMPO_LIMITE_MS = 60000;
const PAUSA_MS = 1200;
const TENTATIVAS = 4;
const POR_PAGINA = 100;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Uma chamada com nova tentativa em falha de rede, HTTP 5xx/425/429 ou erro de consumo; erro do Omie sai sem a chave.
async function chamar(emp, servico, call, param) {
  let ultimo = "";
  for (let n = 1; n <= TENTATIVAS; n++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TEMPO_LIMITE_MS);
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call,
          app_key: process.env[`OMIE_MEUBESS_${emp.n}_APP_KEY`],
          app_secret: process.env[`OMIE_MEUBESS_${emp.n}_APP_SECRET`],
          param: [param],
        }),
        signal: ac.signal,
      });
      let json = null;
      try {
        json = await resp.json();
      } catch {
        /* corpo não-JSON: tratado abaixo */
      }
      if (json?.faultstring) {
        ultimo = `${emp.rotulo} ${servico} ${call}: ${json.faultcode ?? "?"} ${json.faultstring}`;
        // consumo redundante / limite de requisições: vale esperar e repetir
        if (!/REDUNDANT|consumo|aguarde|bloquead/i.test(`${json.faultcode} ${json.faultstring}`)) falhar(ultimo);
      } else if (json && resp.ok) {
        return json;
      } else {
        ultimo = `${emp.rotulo} ${servico} ${call}: HTTP ${resp.status}`;
        if (resp.status < 500 && resp.status !== 425 && resp.status !== 429) falhar(ultimo);
      }
    } catch {
      ultimo = `${emp.rotulo} ${servico} ${call}: sem resposta do Omie (rede ou tempo limite)`;
    } finally {
      clearTimeout(t);
    }
    await espera(PAUSA_MS * n * 3);
  }
  return falhar(`${ultimo} (desisti após ${TENTATIVAS} tentativas)`);
}

async function todasAsPaginas(emp, servico, call, campo, extra = {}) {
  const itens = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const r = await chamar(emp, servico, call, { pagina: n, registros_por_pagina: POR_PAGINA, ...extra });
    total = Number(r.total_de_paginas) || 1;
    itens.push(...(r[campo] ?? []));
    await espera(PAUSA_MS);
  }
  return itens;
}

// Só os dígitos, para comparar CNPJ sem depender da máscara. A raiz são os 8 primeiros dígitos.
const digitos = (s) => String(s ?? "").replace(/\D/g, "");
const raiz = (s) => digitos(s).slice(0, 8);
const filialDe = (s) => {
  const d = digitos(s);
  return d.length === 14 ? `/${d.slice(8, 12)}-${d.slice(12)}` : "";
};

// ---------------------------------------------------------------- leitura, empresa a empresa

const dados = [];
for (const emp of EMPRESAS) {
  console.log(`== ${emp.rotulo} (${emp.filial}) ==`);
  const rEmp = await chamar(emp, "geral/empresas", "ListarEmpresas", { pagina: 1, registros_por_pagina: 50 });
  await espera(PAUSA_MS);
  const cadastro = rEmp.empresas_cadastro?.[0] ?? {};
  const cnpj = cadastro.cnpj ?? "";
  console.log(`  a chave abre o CNPJ ${cnpj} (filial ${filialDe(cnpj) || "?"})`);
  if (filialDe(cnpj) && filialDe(cnpj) !== emp.filial) {
    falhar(`a chave OMIE_MEUBESS_${emp.n} abre a filial ${filialDe(cnpj)}, não a ${emp.filial} esperada`);
  }

  console.log("  lendo categorias, departamentos e o cadastro do DRE...");
  const categorias = await todasAsPaginas(emp, "geral/categorias", "ListarCategorias", "categoria_cadastro");
  const departamentos = await todasAsPaginas(emp, "geral/departamentos", "ListarDepartamentos", "departamentos");
  const dre = await chamar(emp, "geral/dre", "ListarCadastroDRE", { apenasContasAtivas: "N" });
  await espera(PAUSA_MS);
  const contasDre = dre.dreLista ?? [];
  console.log(`    ${categorias.length} categorias, ${departamentos.length} departamentos, ${contasDre.length} contas do DRE`);

  dados.push({ emp, cnpj, categorias, departamentos, contasDre, porCategoria: new Map(), porDepartamento: new Map() });
}

// As filiais da própria MeuBESS, para reconhecer um lançamento entre elas.
const raizes = new Set(dados.map((d) => raiz(d.cnpj)).filter(Boolean));
const filialPorCnpj = new Map(dados.map((d) => [digitos(d.cnpj), `${d.emp.rotulo} (${d.emp.filial})`]));
if (raizes.size !== 1) console.log(`AVISO: as duas chaves têm raiz de CNPJ diferente (${raizes.size} raízes) — a busca por lançamento entre as empresas usa todas`);

// ---------------------------------------------------------------- contagem dos lançamentos do ano

for (const d of dados) {
  const { emp } = d;
  console.log(`== ${emp.rotulo}: contando os lançamentos emitidos em ${ANO} ==`);
  const transferencia = new Set(d.categorias.filter((c) => c.transferencia === "S").map((c) => String(c.codigo)));
  d.lidos = 0;
  d.cancelados = 0;
  d.semDepartamento = 0;
  d.semCategoria = 0;
  d.entreEmpresas = []; // um item por lançamento entre filiais: { filial, natureza, origem }
  d.porCategoriaTransf = 0;
  let totalPaginas = 1;
  for (let n = 1; n <= totalPaginas; n++) {
    const r = await chamar(emp, "financas/mf", "ListarMovimentos", {
      nPagina: n,
      nRegPorPagina: POR_PAGINA,
      dDtEmisDe: `01/01/${ANO}`,
      dDtEmisAte: `31/12/${ANO}`,
      cExibirDepartamentos: "S",
    });
    totalPaginas = Number(r.nTotPaginas) || 1;
    for (const mov of r.movimentos ?? []) {
      d.lidos++;
      const det = mov.detalhes ?? {};
      if (det.cStatus === "CANCELADO") {
        d.cancelados++;
        continue;
      }
      // categoria: o rateio (categorias[]) quando vier, senão a categoria do próprio lançamento
      const cats = new Set((mov.categorias ?? []).map((c) => c.cCodCateg).filter(Boolean));
      if (!cats.size && det.cCodCateg) cats.add(det.cCodCateg);
      if (!cats.size) d.semCategoria++;
      for (const c of cats) d.porCategoria.set(c, (d.porCategoria.get(c) ?? 0) + 1);
      if ([...cats].some((c) => transferencia.has(String(c)))) d.porCategoriaTransf++;

      const deps = new Set((mov.departamentos ?? []).map((x) => String(x.cCodDepartamento)).filter(Boolean));
      if (!deps.size) d.semDepartamento++;
      for (const x of deps) d.porDepartamento.set(x, (d.porDepartamento.get(x) ?? 0) + 1);

      // lançamento entre as filiais da MeuBESS: a contraparte tem a mesma raiz de CNPJ
      const doc = digitos(det.cCPFCNPJCliente);
      if (doc.length === 14 && raizes.has(raiz(doc)) && doc !== digitos(d.cnpj)) {
        d.entreEmpresas.push({ filial: filialDe(doc), conhecida: filialPorCnpj.has(doc), natureza: det.cNatureza ?? "?", origem: det.cOrigem ?? "?", categoria: det.cCodCateg ?? "" });
      }
    }
    if (n % 10 === 0 || n === totalPaginas) console.log(`    página ${n}/${totalPaginas}: ${d.lidos} lançamentos lidos`);
    await espera(PAUSA_MS);
  }
  d.validos = d.lidos - d.cancelados;
  console.log(`    ${d.lidos} lidos, ${d.cancelados} cancelados (fora), ${d.validos} contados; entre as filiais: ${d.entreEmpresas.length}`);
}

// ---------------------------------------------------------------- comparação dos dois planos de categorias

const [e1, e2] = dados;
const catDe = (d) => new Map(d.categorias.map((c) => [String(c.codigo), c]));
const cat1 = catDe(e1);
const cat2 = catDe(e2);
const codigos = [...new Set([...cat1.keys(), ...cat2.keys()])];

const norm = (s) => String(s ?? "").trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");
const comparacao = { iguais: 0, soEm1: 0, soEm2: 0, divergentes: 0, divDescricao: 0, divDre: 0, exemplos: [] };
const itens = codigos.map((codigo) => {
  const a = cat1.get(codigo);
  const b = cat2.get(codigo);
  const dre1 = a?.codigo_dre ? String(a.codigo_dre) : "";
  const dre2 = b?.codigo_dre ? String(b.codigo_dre) : "";
  let situacao;
  if (a && !b) {
    situacao = "só na empresa 1";
    comparacao.soEm1++;
  } else if (b && !a) {
    situacao = "só na empresa 2";
    comparacao.soEm2++;
  } else {
    const difDesc = norm(a.descricao) !== norm(b.descricao);
    const difDre = dre1 !== dre2;
    if (difDesc || difDre) {
      situacao = difDesc && difDre ? "descrição e conta do DRE diferentes" : difDesc ? "descrição diferente" : "conta do DRE diferente";
      comparacao.divergentes++;
      if (difDesc) comparacao.divDescricao++;
      if (difDre) comparacao.divDre++;
      if (comparacao.exemplos.length < 40) comparacao.exemplos.push({ codigo, desc1: a.descricao, desc2: b.descricao, dre1, dre2, situacao });
    } else {
      situacao = "igual nas duas";
      comparacao.iguais++;
    }
  }
  const ref = b ?? a;
  const receita = ref.conta_receita === "S";
  const despesa = ref.conta_despesa === "S";
  return {
    codigo,
    descricao: ref.descricao ?? "",
    descricao1: a?.descricao ?? "",
    descricao2: b?.descricao ?? "",
    tipo: ref.totalizadora === "S" ? "totalizadora" : ref.transferencia === "S" ? "transferência" : receita ? "receita" : despesa ? "despesa" : "—",
    despesa: despesa && ref.totalizadora !== "S",
    codigoDre: dre2 || dre1,
    dre1,
    dre2,
    situacao,
    divergente: situacao.includes("diferente"),
    ativa1: a ? a.conta_inativa !== "S" : null,
    ativa2: b ? b.conta_inativa !== "S" : null,
    lanc1: e1.porCategoria.get(codigo) ?? 0,
    lanc2: e2.porCategoria.get(codigo) ?? 0,
  };
});

const cadastrados = new Set(codigos);
const foraDoCadastro = dados.map((d) => [...d.porCategoria.keys()].filter((c) => !cadastrados.has(String(c))).length);

// Departamentos: o CÓDIGO é próprio de cada empresa (o Omie gera um id por empresa), então a união por código nunca
// casa. O que dá para casar é o NOME. A tabela é por nome, mostrando o código de cada lado.
const porCodigo1 = new Set(e1.departamentos.map((x) => String(x.codigo)));
const porCodigo2 = new Set(e2.departamentos.map((x) => String(x.codigo)));
const codigosDepEmComum = [...porCodigo1].filter((c) => porCodigo2.has(c)).length;
const nome1 = new Map(e1.departamentos.map((x) => [norm(x.descricao), x]));
const nome2 = new Map(e2.departamentos.map((x) => [norm(x.descricao), x]));
const itensDep = [...new Set([...nome1.keys(), ...nome2.keys()])].map((chave) => {
  const a = nome1.get(chave);
  const b = nome2.get(chave);
  return {
    codigo: [a && `E1 ${a.codigo}`, b && `E2 ${b.codigo}`].filter(Boolean).join(" · "),
    codigo1: a ? String(a.codigo) : "",
    codigo2: b ? String(b.codigo) : "",
    descricao: (b ?? a).descricao ?? "",
    descricao1: a?.descricao ?? "",
    descricao2: b?.descricao ?? "",
    onde: a && b ? "nas duas" : a ? "só na empresa 1" : "só na empresa 2",
    ativo1: a ? a.inativo !== "S" : null,
    ativo2: b ? b.inativo !== "S" : null,
    // o mesmo nome dos dois lados, mas com código diferente: somar por código separaria o que é o mesmo centro
    divergente: !!(a && b && String(a.codigo) !== String(b.codigo)),
    lanc1: a ? e1.porDepartamento.get(String(a.codigo)) ?? 0 : 0,
    lanc2: b ? e2.porDepartamento.get(String(b.codigo)) ?? 0 : 0,
  };
});
const depNasDuas = itensDep.filter((x) => x.onde === "nas duas").length;

// contas do DRE, união das duas
const dreDe = new Map();
for (const d of dados) for (const c of d.contasDre) if (!dreDe.has(String(c.codigoDRE))) dreDe.set(String(c.codigoDRE), c);

const porContaDre = new Map();
for (const c of itens) {
  const chave = c.codigoDre && dreDe.has(c.codigoDre) ? c.codigoDre : c.codigoDre ? `?${c.codigoDre}` : "";
  if (!porContaDre.has(chave)) porContaDre.set(chave, []);
  porContaDre.get(chave).push(c);
}
const ordem = (a, b) => (b.lanc1 + b.lanc2) - (a.lanc1 + a.lanc2) || a.descricao.localeCompare(b.descricao, "pt-BR");
const chavesOrdenadas = [...porContaDre.keys()].sort((a, b) => {
  if (a === "") return 1; // "sem conta do DRE" por último
  if (b === "") return -1;
  return a.localeCompare(b, "pt-BR", { numeric: true });
});
const contasDreSemCategoria = [...dreDe.values()].filter((c) => !porContaDre.has(String(c.codigoDRE)));

// lançamentos entre as filiais, resumidos
const descDe = (codigo) => itens.find((x) => x.codigo === String(codigo))?.descricao ?? "(fora do cadastro)";
const resumoEntre = dados.map((d) => {
  const porFilial = {};
  const porNatureza = {};
  const porCategoria = {};
  for (const x of d.entreEmpresas) {
    porFilial[x.filial] = (porFilial[x.filial] ?? 0) + 1;
    const nat = x.natureza === "R" ? "a receber" : x.natureza === "P" ? "a pagar" : x.natureza;
    porNatureza[nat] = (porNatureza[nat] ?? 0) + 1;
    const cat = x.categoria ? `${x.categoria} ${descDe(x.categoria)}` : "(sem categoria)";
    porCategoria[cat] = (porCategoria[cat] ?? 0) + 1;
  }
  return { emp: d.emp, total: d.entreEmpresas.length, porFilial, porNatureza, porCategoria, transf: d.porCategoriaTransf };
});

// ---------------------------------------------------------------- HTML

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const num = (n) => Number(n).toLocaleString("pt-BR");
const sit = (a) => (a === null ? "—" : a ? "ativa" : "inativa");
const sitD = (a) => (a === null ? "—" : a ? "ativo" : "inativo");

function linhaCat(c) {
  const cls = [
    c.ativa1 !== true && c.ativa2 !== true ? "inativa" : "",
    c.lanc1 + c.lanc2 ? "" : "semuso",
    c.divergente ? "diverge" : "",
    c.situacao.startsWith("só") ? "sofalta" : "",
  ].filter(Boolean).join(" ");
  const nota = c.situacao === "igual nas duas" ? "" :
    c.divergente
      ? `<span class="tag alerta">${esc(c.situacao)}</span>${c.dre1 !== c.dre2 ? ` <span class="sub">DRE ${esc(c.dre1 || "—")} × ${esc(c.dre2 || "—")}</span>` : ""}${c.descricao1 && c.descricao2 && norm(c.descricao1) !== norm(c.descricao2) ? ` <span class="sub">“${esc(c.descricao1)}” × “${esc(c.descricao2)}”</span>` : ""}`
      : `<span class="tag falta">${esc(c.situacao)}</span>`;
  return `<tr class="${cls}"><td class="cod">${esc(c.codigo)}</td><td>${esc(c.descricao)}${nota ? `<br>${nota}` : ""}</td><td>${esc(c.tipo)}</td>` +
    `<td>${sit(c.ativa1)}</td><td class="n">${c.ativa1 === null ? "—" : num(c.lanc1)}</td>` +
    `<td>${sit(c.ativa2)}</td><td class="n">${c.ativa2 === null ? "—" : num(c.lanc2)}</td>` +
    `<td class="n forte">${num(c.lanc1 + c.lanc2)}</td></tr>`;
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
  const t1 = cats.reduce((s, c) => s + c.lanc1, 0);
  const t2 = cats.reduce((s, c) => s + c.lanc2, 0);
  const nDiv = cats.filter((c) => c.divergente).length;
  const nSo = cats.filter((c) => c.situacao.startsWith("só")).length;
  return `<section class="grupo"><h3>${titulo} <span class="sub">${detalhe}</span></h3>
<p class="resumo">${cats.length} categoria(s) · ${num(t1)} lançamento(s) na empresa 1 · ${num(t2)} na empresa 2${nDiv ? ` · <b class="alertatxt">${nDiv} divergente(s)</b>` : ""}${nSo ? ` · ${nSo} só numa das empresas` : ""}</p>
<table><thead><tr><th rowspan="2">código</th><th rowspan="2">descrição</th><th rowspan="2">tipo</th><th colspan="2" class="e1">Empresa 1 · ${esc(EMPRESAS[0].filial)}</th><th colspan="2" class="e2">Empresa 2 · ${esc(EMPRESAS[1].filial)}</th><th rowspan="2" class="n">soma ${ANO}</th></tr>
<tr><th class="e1">situação</th><th class="e1 n">lanç. ${ANO}</th><th class="e2">situação</th><th class="e2 n">lanç. ${ANO}</th></tr></thead><tbody>
${cats.map(linhaCat).join("\n")}
</tbody></table></section>`;
}

const totalLanc = dados.map((d) => d.validos);
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plano de categorias e departamentos do Omie — MeuBESS, empresas 1 e 2 (${ANO})</title>
<style>
  :root { --tinta:#1d2733; --suave:#5b6776; --linha:#dde2e8; --fundo:#f6f8fa; --destaque:#0b6b4f; --alerta:#a4400c; --e1:#eef4fb; --e2:#f0f7f2; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui, "Segoe UI", sans-serif; color:var(--tinta); background:var(--fundo); }
  main { max-width:1140px; margin:0 auto; padding:24px 20px 60px; }
  h1 { font-size:24px; margin:0 0 4px; }
  h2 { font-size:19px; margin:36px 0 6px; padding-top:12px; border-top:2px solid var(--tinta); }
  h3 { font-size:16px; margin:0 0 2px; }
  .sub { font-weight:400; font-size:13px; color:var(--suave); margin-left:4px; }
  .quem { color:var(--suave); margin:0 0 18px; }
  .cartoes { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
  .cartao { background:#fff; border:1px solid var(--linha); border-radius:8px; padding:10px 14px; min-width:150px; }
  .cartao b { display:block; font-size:22px; color:var(--destaque); }
  .cartao span { font-size:13px; color:var(--suave); }
  .nota { background:#fff; border-left:4px solid var(--destaque); padding:10px 14px; margin:14px 0; font-size:14px; }
  .nota.lacuna { border-left-color:var(--alerta); }
  .grupo { background:#fff; border:1px solid var(--linha); border-radius:8px; padding:12px 14px; margin:14px 0; }
  .resumo { margin:0 0 8px; font-size:13px; color:var(--suave); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--linha); vertical-align:top; }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--suave); }
  th.e1, td.e1 { background:var(--e1); } th.e2, td.e2 { background:var(--e2); }
  td.cod { font-variant-numeric:tabular-nums; color:var(--suave); white-space:nowrap; }
  .n { text-align:right; font-variant-numeric:tabular-nums; }
  .forte { font-weight:600; }
  tr.inativa td:nth-child(2) { color:#8a94a1; }
  tr.diverge { background:#fffaf5; }
  .tag { display:inline-block; font-size:11.5px; padding:0 6px; border-radius:10px; background:#eef1f4; color:var(--suave); }
  .tag.alerta { background:#fdead9; color:var(--alerta); }
  .tag.falta { background:#e9eefb; color:#2b4a8b; }
  .alertatxt { color:var(--alerta); }
  body.so-com-uso tr.semuso { display:none; }
  body.so-divergentes tr:not(.diverge):not(.sofalta) { display:none; }
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
<p class="quem">MeuBESS · <b>empresa 1</b> (${esc(EMPRESAS[0].filial)}, ${esc(EMPRESAS[0].papel)}) e <b>empresa 2</b> (${esc(EMPRESAS[1].filial)}, ${esc(EMPRESAS[1].papel)}) — as duas que as telas somam · lançamentos emitidos em ${ANO} · lido em ${new Date().toLocaleDateString("pt-BR")} · só leitura do Omie</p>

<div class="cartoes">
  <div class="cartao"><b>${num(itens.length)}</b><span>códigos de categoria nas duas somadas</span></div>
  <div class="cartao"><b>${num(comparacao.iguais)}</b><span>iguais nas duas (código, descrição e conta do DRE)</span></div>
  <div class="cartao"><b>${num(comparacao.divergentes)}</b><span>mesmo código, cadastro diferente</span></div>
  <div class="cartao"><b>${num(comparacao.soEm1)} · ${num(comparacao.soEm2)}</b><span>só na empresa 1 · só na empresa 2</span></div>
  <div class="cartao"><b>${num(itensDep.length)}</b><span>departamentos nas duas somadas</span></div>
  <div class="cartao"><b>${num(totalLanc[0])} · ${num(totalLanc[1])}</b><span>lançamentos de ${ANO} contados (E1 · E2)</span></div>
</div>

<div class="nota">
  <b>Esta página só mostra o cadastro.</b> Qual categoria é dedução, custo de venda, imposto, depreciação, amortização ou
  resultado financeiro, quais departamentos são "de funcionários" e como tratar um lançamento entre as duas empresas são
  decisões da MeuBESS. A coluna "tipo" repete os marcadores do Omie (<code>conta_receita</code>,
  <code>conta_despesa</code>, <code>totalizadora</code>, <code>transferencia</code>), não uma classificação nossa; quando
  o cadastro diverge entre as empresas, o tipo e a descrição mostrados são os da empresa 2.<br>
  <b>Como ler a contagem:</b> lançamentos do <code>financas/mf</code> com emissão em ${ANO}, sem os cancelados
  (${dados.map((d) => `${num(d.cancelados)} de ${num(d.lidos)} na ${d.emp.rotulo.toLowerCase()}`).join(", ")}). Cada lançamento conta uma
  vez por categoria e uma vez por departamento; um título rateado em vários departamentos aparece em cada um.
  Sem valores em reais e sem nomes de clientes, fornecedores ou funcionários.
</div>

<div class="nota lacuna">
  <b>lacuna — o que a soma das duas empresas ainda pede da MeuBESS.</b>
  <ul>
    <li><b>Categoria que diverge:</b> ${num(comparacao.divergentes)} código(s) existem nas duas com cadastro diferente
      (${num(comparacao.divDescricao)} com descrição diferente, ${num(comparacao.divDre)} com conta do DRE diferente) e
      ${num(comparacao.soEm1)} existem só na empresa 1, ${num(comparacao.soEm2)} só na empresa 2. Somar por código de
      categoria junta, nesses casos, coisas cadastradas de forma diferente. Qual cadastro vale — e se algum par deve
      virar uma linha só do DRE — é decisão da MeuBESS.</li>
    <li><b>Lançamento entre as duas empresas:</b> ${resumoEntre.map((r) => `${num(r.total)} na ${r.emp.rotulo.toLowerCase()}`).join(" e ")}
      ${resumoEntre.some((r) => r.total) ? "têm a outra filial da MeuBESS como cliente ou fornecedor" : "— nenhum lançamento com a outra filial como cliente ou fornecedor"}.
      Somando as duas empresas, o mesmo dinheiro entre elas pode entrar duas vezes (uma como despesa numa, outra como
      receita na outra). Se esses lançamentos saem da soma, entram inteiros, ou entram de um lado só, é decisão da
      MeuBESS. Categorias marcadas como transferência no Omie aparecem em
      ${resumoEntre.map((r) => `${num(r.transf)} lançamento(s) da ${r.emp.rotulo.toLowerCase()}`).join(" e ")}.</li>
    <li><b>Centro de custo entre as empresas:</b> o código do departamento é próprio de cada empresa
      (${num(codigosDepEmComum)} código em comum entre as duas), e ${num(depNasDuas)} nome(s) existem dos dois lados. O
      filtro de centro de custo da Tela 1 precisa casar os dois cadastros por nome, ou tratar cada empresa em separado —
      a MeuBESS decide qual.</li>
  </ul>
</div>

<h2>Lançamentos de ${ANO} entre as duas empresas</h2>
<div class="grupo">
<p class="resumo">Lançamento cuja contraparte (<code>detalhes.cCPFCNPJCliente</code>) é outra filial da própria MeuBESS — mesma raiz de CNPJ, filial diferente. Só a contagem; nenhum valor.</p>
<table><thead><tr><th>lidos na</th><th>contraparte</th><th class="n">lançamentos</th><th>natureza</th><th>categoria</th><th class="n">em categoria de transferência</th></tr></thead><tbody>
${resumoEntre.map((r) => `<tr><td>${esc(r.emp.rotulo)} · ${esc(r.emp.filial)}</td><td>${Object.keys(r.porFilial).length ? Object.entries(r.porFilial).map(([f, q]) => `${esc(f)}: ${num(q)}`).join("<br>") : "—"}</td><td class="n forte">${num(r.total)}</td><td>${Object.keys(r.porNatureza).length ? Object.entries(r.porNatureza).map(([n2, q]) => `${esc(n2)}: ${num(q)}`).join("<br>") : "—"}</td><td>${Object.keys(r.porCategoria).length ? Object.entries(r.porCategoria).map(([c, q]) => `${esc(c)}: ${num(q)}`).join("<br>") : "—"}</td><td class="n">${num(r.transf)}</td></tr>`).join("\n")}
</tbody></table>
</div>

<div class="filtros">
  <label><input type="checkbox" id="so-com-uso"> só com lançamento em ${ANO}</label>
  <label><input type="checkbox" id="so-divergentes"> só o que não bate entre as duas</label>
</div>

<h2>Categorias, agrupadas pela conta do DRE</h2>
<p class="quem">A conta do DRE é a do <code>codigo_dre</code> de cada categoria (a da empresa 2 quando as duas têm), com o nome vindo de <code>ListarCadastroDRE</code>. Dentro de cada conta, da mais usada para a menos usada, somando as duas empresas.</p>
${chavesOrdenadas.map(blocoDre).join("\n")}
${contasDreSemCategoria.length ? `<section class="grupo"><h3>Contas do DRE sem nenhuma categoria ligada <span class="sub">${contasDreSemCategoria.length} conta(s)</span></h3>
<ul class="vazias">${contasDreSemCategoria.map((c) => `<li>${esc(c.codigoDRE)} — ${esc(c.descricaoDRE)}</li>`).join("")}</ul></section>` : ""}

<h2>Departamentos (centros de custo)</h2>
<div class="grupo">
<p class="resumo">${num(itensDep.length)} nome(s) de departamento nas duas empresas · ${num(depNasDuas)} existem nas duas · da mais usada para a menos usada · sem departamento: ${dados.map((d) => `${num(d.semDepartamento)} lançamento(s) na ${d.emp.rotulo.toLowerCase()}`).join(", ")}</p>
<p class="resumo"><b class="alertatxt">A tabela casa os departamentos pelo NOME, não pelo código.</b> O código do departamento é próprio de cada empresa — das ${num(e1.departamentos.length)} da empresa 1 e ${num(e2.departamentos.length)} da empresa 2, ${num(codigosDepEmComum)} código(s) coincidem. Somar as duas empresas por <code>cCodDepartamento</code> separaria em dois o que é o mesmo centro de custo.</p>
<table><thead><tr><th rowspan="2">descrição</th><th rowspan="2">códigos</th><th rowspan="2">onde existe</th><th colspan="2" class="e1">Empresa 1 · ${esc(EMPRESAS[0].filial)}</th><th colspan="2" class="e2">Empresa 2 · ${esc(EMPRESAS[1].filial)}</th><th rowspan="2" class="n">soma ${ANO}</th></tr>
<tr><th class="e1">situação</th><th class="e1 n">lanç. ${ANO}</th><th class="e2">situação</th><th class="e2 n">lanç. ${ANO}</th></tr></thead><tbody>
${[...itensDep].sort(ordem).map((d) => `<tr class="${[d.lanc1 + d.lanc2 ? "" : "semuso", d.divergente ? "diverge" : "", d.onde.startsWith("só") ? "sofalta" : ""].filter(Boolean).join(" ")}"><td>${esc(d.descricao)}${d.divergente ? `<br><span class="tag alerta">mesmo nome, código diferente</span>` : ""}</td><td class="cod">${esc(d.codigo)}</td><td>${d.onde === "nas duas" ? "nas duas" : `<span class="tag falta">${esc(d.onde)}</span>`}</td><td>${sitD(d.ativo1)}</td><td class="n">${d.ativo1 === null ? "—" : num(d.lanc1)}</td><td>${sitD(d.ativo2)}</td><td class="n">${d.ativo2 === null ? "—" : num(d.lanc2)}</td><td class="n forte">${num(d.lanc1 + d.lanc2)}</td></tr>`).join("\n")}
</tbody></table>
</div>

<footer>Gerada por <code>scripts/plano-de-contas-omie.mjs</code>. Fonte: API do Omie (<code>geral/empresas</code>, <code>geral/categorias</code>, <code>geral/departamentos</code>, <code>geral/dre</code>, <code>financas/mf</code>), chaves das filiais ${esc(EMPRESAS.map((e) => e.filial).join(" e "))}. A empresa 3 (<code>/0003-04</code>) fica fora das telas e desta página.</footer>
</main>
<script>
  for (const id of ["so-com-uso", "so-divergentes"]) {
    document.getElementById(id).addEventListener("change", (e) => document.body.classList.toggle(id, e.target.checked));
  }
</script>
</body>
</html>
`;

writeFileSync(new URL("../docs/plano-de-categorias-omie.html", import.meta.url), html);

// ---------------------------------------------------------------- resumo na tela (só nomes do cadastro e contagens)

console.log("");
console.log("== comparação dos dois planos de categorias ==");
console.log(`  códigos nas duas somadas: ${itens.length}`);
console.log(`  iguais (código, descrição e conta do DRE): ${comparacao.iguais}`);
console.log(`  mesmo código, cadastro diferente: ${comparacao.divergentes} (descrição: ${comparacao.divDescricao}, conta do DRE: ${comparacao.divDre})`);
console.log(`  só na empresa 1: ${comparacao.soEm1}; só na empresa 2: ${comparacao.soEm2}`);
console.log(`  categorias da empresa 1: ${e1.categorias.length}; da empresa 2: ${e2.categorias.length}`);
console.log(`  códigos usados em lançamento mas fora do cadastro: E1 ${foraDoCadastro[0]}, E2 ${foraDoCadastro[1]}`);
if (comparacao.exemplos.length) {
  console.log("  divergências (até 40):");
  for (const x of comparacao.exemplos) console.log(`    ${x.codigo}\t${x.situacao}\tDRE ${x.dre1 || "—"} x ${x.dre2 || "—"}\t"${x.desc1}" x "${x.desc2}"`);
}
console.log("");
console.log(`== lançamentos de ${ANO} entre as duas empresas ==`);
for (const r of resumoEntre) {
  console.log(`  ${r.emp.rotulo} (${r.emp.filial}): ${r.total} lançamento(s) com outra filial como contraparte` +
    `${r.total ? ` — por filial ${JSON.stringify(r.porFilial)}, por natureza ${JSON.stringify(r.porNatureza)}, por categoria ${JSON.stringify(r.porCategoria)}` : ""}` +
    `; em categoria de transferência: ${r.transf}`);
}
console.log("");
console.log("== departamentos ==");
for (const d of dados) console.log(`  ${d.emp.rotulo}: ${d.departamentos.length} (${d.departamentos.filter((x) => x.inativo !== "S").length} ativos); com lançamento em ${ANO}: ${[...d.porDepartamento.values()].filter(Boolean).length}; sem departamento: ${d.semDepartamento} lançamento(s)`);
console.log(`  códigos de departamento em comum entre as duas: ${codigosDepEmComum} (o código é próprio de cada empresa)`);
console.log(`  por NOME: ${itensDep.length} nome(s) ao todo; nas duas: ${depNasDuas}; só na empresa 1: ${itensDep.filter((x) => x.onde === "só na empresa 1").length}; só na empresa 2: ${itensDep.filter((x) => x.onde === "só na empresa 2").length}`);
console.log("  departamentos da empresa 1 (código, lançamentos, descrição):");
for (const x of [...itensDep].filter((x) => x.ativo1 !== null).sort((a, b) => b.lanc1 - a.lanc1)) {
  console.log(`    ${x.codigo1}\t${x.lanc1}\t${x.descricao1}${x.ativo1 ? "" : " (inativo)"}\t${x.onde === "nas duas" ? "(mesmo nome na empresa 2)" : "(só na empresa 1)"}`);
}
console.log("");
console.log("== 10 categorias de despesa com mais lançamentos ==");
for (const [rot, campo] of [["empresa 1", "lanc1"], ["empresa 2", "lanc2"]]) {
  console.log(`  ${rot}:`);
  for (const c of itens.filter((x) => x.despesa).sort((a, b) => b[campo] - a[campo]).slice(0, 10)) {
    console.log(`    ${c[campo]}\t${campo === "lanc1" ? (c.descricao1 || c.descricao) : (c.descricao2 || c.descricao)}`);
  }
}
console.log("");
console.log("gravado: docs/plano-de-categorias-omie.html");
console.log("FIM");
