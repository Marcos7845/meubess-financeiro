// Compara as CONTAS DO DRE das empresas 1 (/0001-42) e 2 (/0002-23) do Omie, para a soma pela conta do DRE de cada
// empresa (decisão do dono, 24/09/2026): cada lançamento cai na linha do DRE pelo codigo_dre da categoria dele, na
// própria empresa. Mede:
//   - as contas do DRE de cada empresa (código e descrição) e quantas são iguais, têm o mesmo código com descrição
//     diferente, ou existem só numa;
//   - dessas iguais, quantas diferem no nível, no sinal ou no "totaliza" (mudam a soma mesmo com o mesmo nome);
//   - quantas categorias usadas em lançamentos do ano não têm codigo_dre, ou têm um codigo_dre que não está no cadastro
//     do DRE da própria empresa.
//
// Só leitura: geral/empresas ListarEmpresas, geral/categorias ListarCategorias, geral/dre ListarCadastroDRE e
// financas/mf ListarMovimentos. Nenhum método que inclua, altere ou exclua.
// Imprime só contagens, códigos e descrições do cadastro (de categorias e de contas do DRE) da própria MeuBESS: nunca
// valor em reais, nome ou documento de cliente/fornecedor/funcionário, nem a chave — nem em erro.
//
// "Lançamento do ano" = lançamento do financas/mf com emissão (dDtEmisDe / dDtEmisAte) dentro do ano, fora os de
// cStatus = CANCELADO. Cada lançamento conta uma vez por categoria.
//
// Uso: node scripts/contas-dre-omie.mjs [ano]     (padrão: 2026)
// Credencial: no .env da raiz (fora do git), os pares OMIE_MEUBESS_1_APP_KEY / OMIE_MEUBESS_1_APP_SECRET e
// OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET. Imprime só o NOME da variável que faltar, nunca o valor.
// Node 21.7+, sem dependências.

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

const EMPRESAS = [
  { n: 1, rotulo: "Empresa 1", filial: "/0001-42" },
  { n: 2, rotulo: "Empresa 2", filial: "/0002-23" },
];
const faltam = EMPRESAS.flatMap((e) => [`OMIE_MEUBESS_${e.n}_APP_KEY`, `OMIE_MEUBESS_${e.n}_APP_SECRET`]).filter((v) => !process.env[v]);
if (faltam.length) falhar(`${faltam.join(", ")} precisa(m) estar preenchida(s) no .env`);

const BASE = "https://app.omie.com.br/api/v1/";
const TEMPO_LIMITE_MS = 60000;
const PAUSA_MS = 1200;
const TENTATIVAS = 4;
const POR_PAGINA = 100;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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

const digitos = (s) => String(s ?? "").replace(/\D/g, "");
const filialDe = (s) => {
  const d = digitos(s);
  return d.length === 14 ? `/${d.slice(8, 12)}-${d.slice(12)}` : "";
};
// o Omie devolve alguns textos já com entidades HTML (&lt;Disponível&gt;)
const limpa = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
const norm = (s) => limpa(s).toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");

// ---------------------------------------------------------------- leitura, empresa a empresa

const dados = [];
for (const emp of EMPRESAS) {
  console.log(`== ${emp.rotulo} (${emp.filial}) ==`);
  const rEmp = await chamar(emp, "geral/empresas", "ListarEmpresas", { pagina: 1, registros_por_pagina: 50 });
  await espera(PAUSA_MS);
  const cnpj = rEmp.empresas_cadastro?.[0]?.cnpj ?? "";
  console.log(`  a chave abre a filial ${filialDe(cnpj) || "?"}`);
  if (filialDe(cnpj) && filialDe(cnpj) !== emp.filial) {
    falhar(`a chave OMIE_MEUBESS_${emp.n} abre a filial ${filialDe(cnpj)}, não a ${emp.filial} esperada`);
  }

  const categorias = await todasAsPaginas(emp, "geral/categorias", "ListarCategorias", "categoria_cadastro");
  const dre = await chamar(emp, "geral/dre", "ListarCadastroDRE", { apenasContasAtivas: "N" });
  await espera(PAUSA_MS);
  const contasDre = dre.dreLista ?? [];
  console.log(`  ${categorias.length} categorias, ${contasDre.length} contas do DRE`);

  const usadas = new Map(); // codigo da categoria -> nº de lançamentos do ano
  let lidos = 0;
  let cancelados = 0;
  let semCategoria = 0;
  let totalPaginas = 1;
  for (let n = 1; n <= totalPaginas; n++) {
    const r = await chamar(emp, "financas/mf", "ListarMovimentos", {
      nPagina: n,
      nRegPorPagina: POR_PAGINA,
      dDtEmisDe: `01/01/${ANO}`,
      dDtEmisAte: `31/12/${ANO}`,
    });
    totalPaginas = Number(r.nTotPaginas) || 1;
    for (const mov of r.movimentos ?? []) {
      lidos++;
      const det = mov.detalhes ?? {};
      if (det.cStatus === "CANCELADO") {
        cancelados++;
        continue;
      }
      const cats = new Set((mov.categorias ?? []).map((c) => c.cCodCateg).filter(Boolean));
      if (!cats.size && det.cCodCateg) cats.add(det.cCodCateg);
      if (!cats.size) semCategoria++;
      for (const c of cats) usadas.set(String(c), (usadas.get(String(c)) ?? 0) + 1);
    }
    if (n % 10 === 0 || n === totalPaginas) console.log(`    página ${n}/${totalPaginas}: ${lidos} lançamentos lidos`);
    await espera(PAUSA_MS);
  }
  console.log(`  ${lidos} lidos, ${cancelados} cancelados (fora), ${lidos - cancelados} contados; sem categoria: ${semCategoria}`);
  dados.push({ emp, categorias, contasDre, usadas, contados: lidos - cancelados, semCategoria });
}

// ---------------------------------------------------------------- comparação das contas do DRE

const [e1, e2] = dados;
const contaDe = (d) => new Map(d.contasDre.map((c) => [String(c.codigoDRE), c]));
const c1 = contaDe(e1);
const c2 = contaDe(e2);
const todos = [...new Set([...c1.keys(), ...c2.keys()])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
const estrutura = (c) => `nível ${c.nivelDRE ?? "?"}, sinal ${c.sinalDRE ?? "?"}, totaliza ${c.totalizaDRE ?? "?"}, ${c.naoExibirDRE === "S" ? "não exibe" : "exibe"}`;

const iguais = [];
const iguaisEstruturaDiferente = [];
const mesmoCodigoDescDiferente = [];
const so1 = [];
const so2 = [];
for (const cod of todos) {
  const a = c1.get(cod);
  const b = c2.get(cod);
  if (a && !b) so1.push({ cod, d1: limpa(a.descricaoDRE) });
  else if (!a && b) so2.push({ cod, d2: limpa(b.descricaoDRE) });
  else if (norm(a.descricaoDRE) !== norm(b.descricaoDRE)) mesmoCodigoDescDiferente.push({ cod, d1: limpa(a.descricaoDRE), d2: limpa(b.descricaoDRE) });
  else {
    iguais.push(cod);
    if (estrutura(a) !== estrutura(b)) iguaisEstruturaDiferente.push({ cod, d: limpa(a.descricaoDRE), s1: estrutura(a), s2: estrutura(b) });
  }
}

console.log("\n== contas do DRE, empresa a empresa (código — descrição) ==");
for (const d of dados) {
  console.log(`  ${d.emp.rotulo}: ${d.contasDre.length} conta(s)`);
  for (const c of [...d.contasDre].sort((a, b) => String(a.codigoDRE).localeCompare(String(b.codigoDRE), "pt-BR", { numeric: true }))) {
    console.log(`    ${c.codigoDRE}\t${limpa(c.descricaoDRE)}\t(${estrutura(c)})`);
  }
}

console.log("\n== comparação das contas do DRE ==");
console.log(`  códigos de conta nas duas somadas: ${todos.length} (empresa 1: ${c1.size}, empresa 2: ${c2.size})`);
console.log(`  iguais (mesmo código e mesma descrição): ${iguais.length}`);
console.log(`  mesmo código, descrição diferente: ${mesmoCodigoDescDiferente.length}`);
console.log(`  só na empresa 1: ${so1.length}; só na empresa 2: ${so2.length}`);
console.log(`  das iguais, com nível/sinal/totaliza/exibição diferente: ${iguaisEstruturaDiferente.length}`);
if (mesmoCodigoDescDiferente.length) {
  console.log("  mesmo código, descrição diferente (código, empresa 1, empresa 2):");
  for (const x of mesmoCodigoDescDiferente) console.log(`    ${x.cod}\t"${x.d1}"\t"${x.d2}"`);
}
if (so1.length) {
  console.log("  só na empresa 1 (código, descrição):");
  for (const x of so1) console.log(`    ${x.cod}\t"${x.d1}"`);
}
if (so2.length) {
  console.log("  só na empresa 2 (código, descrição):");
  for (const x of so2) console.log(`    ${x.cod}\t"${x.d2}"`);
}
if (iguaisEstruturaDiferente.length) {
  console.log("  iguais no código e na descrição, mas com estrutura diferente (código, descrição, empresa 1, empresa 2):");
  for (const x of iguaisEstruturaDiferente) console.log(`    ${x.cod}\t"${x.d}"\t${x.s1}\t|\t${x.s2}`);
}

console.log(`\n== categorias usadas em lançamentos de ${ANO}, por codigo_dre ==`);
for (const d of dados) {
  const cad = new Map(d.categorias.map((c) => [String(c.codigo), c]));
  const dreDaEmpresa = new Set(d.contasDre.map((c) => String(c.codigoDRE)));
  const foraDoCadastro = [...d.usadas.keys()].filter((k) => !cad.has(k));
  const semDre = [];
  const dreInexistente = [];
  for (const [cod, n] of d.usadas) {
    const c = cad.get(cod);
    if (!c) continue;
    const dre = c.codigo_dre ? String(c.codigo_dre) : "";
    if (!dre) semDre.push({ cod, desc: limpa(c.descricao), n });
    else if (!dreDaEmpresa.has(dre)) dreInexistente.push({ cod, desc: limpa(c.descricao), dre, n });
  }
  const ord = (a, b) => a.cod.localeCompare(b.cod, "pt-BR", { numeric: true });
  semDre.sort(ord);
  dreInexistente.sort(ord);
  console.log(`  ${d.emp.rotulo}: ${d.usadas.size} categoria(s) usada(s) em ${d.contados} lançamento(s) contados`);
  console.log(`    usadas fora do cadastro de categorias: ${foraDoCadastro.length}`);
  console.log(`    usadas SEM codigo_dre: ${semDre.length} categoria(s), em ${semDre.reduce((s, x) => s + x.n, 0)} lançamento(s)`);
  for (const x of semDre) console.log(`      ${x.cod}\t${x.desc}\t${x.n} lançamento(s)`);
  console.log(`    usadas com codigo_dre que NÃO está no cadastro do DRE da própria empresa: ${dreInexistente.length} categoria(s), em ${dreInexistente.reduce((s, x) => s + x.n, 0)} lançamento(s)`);
  for (const x of dreInexistente) console.log(`      ${x.cod}\t${x.desc}\tDRE ${x.dre}\t${x.n} lançamento(s)`);
}
console.log("\nFIM");
