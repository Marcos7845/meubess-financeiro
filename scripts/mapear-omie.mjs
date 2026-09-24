// Compara as filiais do Omie: para cada par de chave e segredo do .env, a empresa que a chave abre,
// quantos pedidos de venda, contas a receber e contas a pagar existem nela, a data do registro mais recente
// de cada um, e se os códigos da plataforma MeuBESS passados na linha de comando existem ali.
// Só métodos de listagem e consulta. Nunca imprime valor, nome/CPF/CNPJ de cliente, descrição, nem a chave —
// nem em erro; de cada código consultado sai só "encontrado" ou "não encontrado".
// A única identificação impressa é a da própria empresa que a chave abre (geral/empresas), que é o que se quer saber.
// A saída vai para a tela e para mapa-omie.log na raiz (ignorado pelo git); a última linha é FIM.
//
// Uso: node scripts/mapear-omie.mjs [--descobrir] [pedido=CODIGO ...] [cliente=CODIGO ...] [produto=CODIGO ...]
//   ex.: node scripts/mapear-omie.mjs pedido=123 pedido=456 cliente=789
// Os códigos são os external_id da plataforma MeuBESS; passe-os na linha de comando, nada fica no repositório.
// Credencial: no .env da raiz (fora do git) o script descobre sozinho os pares de chave e segredo do Omie:
// variáveis com OMIE no nome, uma com KEY e outra com SECRET, que só diferem por essa palavra
// (ex.: OMIE_APP_KEY/OMIE_APP_SECRET, OMIE_APP_KEY_FILIAL1/OMIE_APP_SECRET_FILIAL1). Imprime só os NOMES e se estão
// preenchidas, nunca o valor. Se os nomes não formarem pares claros, imprime os nomes achados e para.
// --descobrir: só lista os pares, sem chamar o Omie. Sem ele, mapeia cada par, um depois do outro.
// Node 21.7+, sem dependências.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Toda linha vai para a tela e para o log dentro do repositório (mapa-omie.log, ignorado pelo git).
// O log guarda exatamente o que a tela mostra: nunca chave, segredo, valor, nome ou documento de cliente.
const LOG = new URL("../mapa-omie.log", import.meta.url);
writeFileSync(LOG, "");
const registrar = (linha = "") => {
  console.log(linha);
  appendFileSync(LOG, `${linha}\n`);
};

const BASE = "https://app.omie.com.br/api/v1/";
const POR_PAGINA = 100;
const MAX_PAGINAS = 50;
const PAUSA_MS = 2500;
const TENTATIVAS = 4;

let env;
try {
  env = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"));
} catch {
  registrar("ERRO: arquivo .env não encontrado ou ilegível na raiz do repositório");
  process.exit(1);
}

// Descobre os pares pelos nomes. Devolve { pares: [{ base, chave, segredo }] } ou { motivo, nomes }.
function descobrirPares(vars) {
  const nomes = Object.keys(vars).filter((n) => /omie/i.test(n));
  const chaves = nomes.filter((n) => /key/i.test(n) && !/secret/i.test(n));
  const segredos = nomes.filter((n) => /secret/i.test(n) && !/key/i.test(n));
  const base = (n) => n.replace(/key|secret/i, "#");
  if (!nomes.length) return { motivo: "nenhuma variável com OMIE no nome", nomes: Object.keys(vars) };
  const soltas = nomes.filter((n) => !chaves.includes(n) && !segredos.includes(n));
  const pares = [];
  const sobra = [...soltas];
  for (const k of chaves) {
    const ss = segredos.filter((s) => base(s) === base(k));
    if (ss.length === 1) pares.push({ base: base(k), chave: k, segredo: ss[0] });
    else sobra.push(k);
  }
  for (const s of segredos) if (!pares.some((p) => p.segredo === s)) sobra.push(s);
  if (!pares.length || sobra.length) {
    return { motivo: "os nomes não formam pares claros de chave e segredo", nomes };
  }
  return { pares };
}

const achado = descobrirPares(env);
if (!achado.pares) {
  registrar(`ERRO: ${achado.motivo}. Nomes encontrados: ${achado.nomes.join(", ") || "(nenhum)"}`);
  process.exit(1);
}
registrar(`== PARES DE CHAVE E SEGREDO DO OMIE NO .env (${achado.pares.length}) ==`);
for (const p of achado.pares) {
  const st = (n) => (String(env[n] ?? "").trim() ? "preenchida" : "VAZIA");
  registrar(`  - ${p.chave} (${st(p.chave)}) + ${p.segredo} (${st(p.segredo)})`);
}
registrar("");
const argumentos = process.argv.slice(2);
if (argumentos.includes("--descobrir")) process.exit(0);

let OMIE_APP_KEY;
let OMIE_APP_SECRET;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Uma chamada, com as pausas que o Omie pede. Devolve { json } ou { erro } — o erro traz só código e mensagem do Omie.
async function chamar(servico, metodo, param) {
  for (let t = 1; t <= TENTATIVAS; t++) {
    await dormir(PAUSA_MS * t);
    let json;
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call: metodo, app_key: OMIE_APP_KEY, app_secret: OMIE_APP_SECRET, param: [param] }),
      });
      json = await resp.json();
    } catch {
      return { erro: "sem resposta utilizável do Omie" };
    }
    const code = String(json.faultcode ?? "");
    // Client-1880: o Omie ainda processa a requisição anterior deste método; espera e repete
    if (/Client-1880/.test(code)) continue;
    // MISUSE_API_PROCESS / Client-6 (redundante): bloqueio temporário; espera o tempo que o Omie pede
    if (code === "MISUSE_API_PROCESS" || /Client-6$/.test(code)) {
      const s = Number(/(?:em|Aguarde) (\d+) segundos/.exec(json.faultstring ?? "")?.[1]) || 60;
      registrar(`(Omie pediu pausa de ${s}s; aguardando)`);
      await dormir((s + 5) * 1000);
      continue;
    }
    if (json.faultcode || json.faultstring) {
      return { erro: `${json.faultcode ?? "?"}: ${json.faultstring ?? "?"}`, code: code || "?" };
    }
    return { json };
  }
  return { erro: "o Omie não liberou o método depois de várias tentativas" };
}


const num = (o, ...ks) => {
  for (const k of ks) if (o?.[k] != null) return Number(o[k]);
  return null;
};

// A lista de registros é o único array do retorno; só usamos o comprimento dela.
const tamanhoLista = (o) => {
  let n = 0;
  for (const v of Object.values(o ?? {})) if (Array.isArray(v)) n += v.length;
  return n;
};

// Data mais recente entre os campos de data do retorno (emissão, inclusão, pagamento), em ISO para comparar.
// Só lê campos cujo NOME é de data; nenhum outro campo do registro é lido, guardado ou impresso.
const CAMPO_DATA = /^(dInc|dDtInc|data_inclusao|dDtEmissao|data_emissao|dEmissao|dDtPagamento|data_pagamento|dDtCredito|dDtLanc|dData|data_previsao)$/i;
function maiorData(o, atual = "") {
  if (Array.isArray(o)) {
    for (const v of o) atual = maiorData(v, atual);
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      const m = typeof v === "string" && CAMPO_DATA.test(k) ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v) : null;
      if (m) {
        const iso = `${m[3]}-${m[2]}-${m[1]}`;
        if (iso > atual) atual = iso;
      } else if (v && typeof v === "object") atual = maiorData(v, atual);
    }
  }
  return atual;
}
const dataBr = (iso) => (iso ? iso.split("-").reverse().join("/") : null);

// Conta os registros de um método de listagem e acha a data mais recente, com o mínimo de chamadas:
// a página 1 traz o total declarado pelo Omie; se houver mais de uma página, lê também a última,
// que é onde ficam os registros mais novos (o Omie devolve em ordem crescente de código).
async function resumir(servico, metodo, paramBase, estilo) {
  const [kPag, kQtd] = estilo === "v2" ? ["nPagina", "nRegPorPagina"] : ["pagina", "registros_por_pagina"];
  const p1 = await chamar(servico, metodo, { ...paramBase, [kPag]: 1, [kQtd]: POR_PAGINA });
  if (p1.erro) {
    if (/n[ãa]o (existem|foram encontrados|h[áa]) registros|nenhum registro/i.test(p1.erro)) {
      return { registros: 0, recente: "", paginasLidas: 0, totalPaginas: 0 };
    }
    return { erro: p1.erro };
  }
  const totalPaginas = num(p1.json, "total_de_paginas", "nTotPaginas") || 1;
  const declarado = num(p1.json, "total_de_registros", "nTotRegistros");
  let recente = maiorData(p1.json);
  let paginasLidas = 1;
  if (totalPaginas > 1) {
    const pn = await chamar(servico, metodo, { ...paramBase, [kPag]: totalPaginas, [kQtd]: POR_PAGINA });
    if (!pn.erro) {
      recente = maiorData(pn.json, recente);
      paginasLidas++;
    }
  }
  return { registros: declarado ?? tamanhoLista(p1.json), recente, paginasLidas, totalPaginas };
}

// serviço, método, param extra, estilo de paginação, papel do método
const LISTAGENS = [
  ["produtos/pedido", "ListarPedidos", { apenas_importado_api: "N" }, "v1", "pedidos de venda"],
  ["financas/contareceber", "ListarContasReceber", { apenas_importado_api: "N" }, "v1", "contas a receber"],
  ["financas/contapagar", "ListarContasPagar", { apenas_importado_api: "N" }, "v1", "contas a pagar"],
];

// método de consulta por código, por tipo de external_id do arquivo de integrações da MeuBESS
const CONSULTAS = {
  pedido: ["produtos/pedido", "ConsultarPedido", (c) => ({ codigo_pedido: Number(c) })],
  cliente: ["geral/clientes", "ConsultarCliente", (c) => ({ codigo_cliente_omie: Number(c) })],
  produto: ["geral/produtos", "ConsultarProduto", (c) => ({ codigo_produto: Number(c) })],
};

const aConsultar = [];
for (const arg of argumentos) {
  const m = /^(pedido|cliente|produto)=(\d+)$/.exec(arg);
  if (!m) {
    registrar("ERRO: argumento inválido (use pedido=CODIGO, cliente=CODIGO, produto=CODIGO ou --descobrir)");
    process.exit(1);
  }
  aConsultar.push([m[1], m[2]]);
}

async function mapear() {
  const emp = await chamar("geral/empresas", "ListarEmpresas", { pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N" });
  if (emp.erro) {
    registrar(`empresa: ERRO Omie ${emp.erro}`);
  } else {
    const lista = emp.json.empresas_cadastro ?? [];
    for (const e of lista) {
      registrar(`empresa: ${e.razao_social ?? e.nome_fantasia ?? "(sem nome)"} · CNPJ ${e.cnpj ?? "(sem CNPJ)"}`);
    }
    if (!lista.length) registrar("empresa: o Omie não devolveu nenhuma empresa para esta chave");
  }

  for (const [servico, metodo, param, estilo, papel] of LISTAGENS) {
    const r = await resumir(servico, metodo, param, estilo);
    if (r.registros == null) {
      registrar(`${papel}: ERRO Omie ${r.erro}`);
      continue;
    }
    const data = r.recente ? `mais recente ${dataBr(r.recente)}` : "sem data nos campos de data";
    const parcial = r.paginasLidas < r.totalPaginas ? " (data vista na 1ª e na última página)" : "";
    registrar(`${papel}: ${r.registros} registro(s), ${data}${parcial}`);
  }

  for (const [tipo, codigo] of aConsultar) {
    const [servico, metodo, monta] = CONSULTAS[tipo];
    const r = await chamar(servico, metodo, monta(codigo));
    // o faultcode inteiro do Omie (ex.: SOAP-ENV:Client-8020) — nunca a mensagem, que pode trazer dado do cadastro
    registrar(`${tipo} ${codigo}: ${r.erro ? `não encontrado (Omie ${r.code ?? "?"})` : "encontrado"}`);
  }
}

registrar(`Só leitura. Pausa de ${PAUSA_MS / 1000}s entre chamadas; se o Omie pedir mais, o script espera.`);
for (const p of achado.pares) {
  const k = String(env[p.chave] ?? "").trim();
  const s = String(env[p.segredo] ?? "").trim();
  registrar("");
  registrar(`######## ${p.chave} + ${p.segredo} ########`);
  if (!k || !s) {
    registrar("pulado: uma das duas variáveis está vazia");
    continue;
  }
  OMIE_APP_KEY = k;
  OMIE_APP_SECRET = s;
  await mapear();
}
registrar("");
registrar("FIM");
