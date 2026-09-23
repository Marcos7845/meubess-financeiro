// Mapa de onde estão os dados desta chave do Omie: só métodos de listagem e consulta.
// Para cada serviço/método imprime apenas o número de páginas e de registros (ou o código de erro do Omie);
// para cada código consultado imprime só "encontrado" ou "não encontrado".
// Nunca imprime valor, nome/CPF/CNPJ de cliente, descrição, nem a chave — nem em erro.
// A única identificação impressa é a da própria empresa que a chave abre (geral/empresas), que é o que se quer saber.
//
// Uso: node scripts/mapear-omie.mjs [pedido=CODIGO ...] [cliente=CODIGO ...] [produto=CODIGO ...]
//   ex.: node scripts/mapear-omie.mjs pedido=123 pedido=456 cliente=789
// Os códigos são os external_id da plataforma MeuBESS; passe-os na linha de comando, nada fica no repositório.
// Credencial: OMIE_APP_KEY e OMIE_APP_SECRET no .env da raiz (fora do git). Node 21.7+, sem dependências.

const BASE = "https://app.omie.com.br/api/v1/";
const POR_PAGINA = 100;
const MAX_PAGINAS = 50;
const PAUSA_MS = 2500;
const TENTATIVAS = 4;

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  console.log("ERRO: arquivo .env não encontrado ou ilegível na raiz do repositório");
  process.exit(1);
}
const { OMIE_APP_KEY, OMIE_APP_SECRET } = process.env;
if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
  console.log("ERRO: OMIE_APP_KEY e OMIE_APP_SECRET precisam estar preenchidas no .env");
  process.exit(1);
}

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
      console.log(`(Omie pediu pausa de ${s}s; aguardando)`);
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

// Percorre todas as páginas de um método de listagem e devolve só as contagens.
async function contar(servico, metodo, paramBase, estilo) {
  const [kPag, kQtd] = estilo === "v2" ? ["nPagina", "nRegPorPagina"] : ["pagina", "registros_por_pagina"];
  let paginas = 0;
  let registros = 0;
  let total = 1;
  let declarado = null;
  for (let n = 1; n <= total && n <= MAX_PAGINAS; n++) {
    const r = await chamar(servico, metodo, { ...paramBase, [kPag]: n, [kQtd]: POR_PAGINA });
    if (r.erro) {
      // consulta vazia é resposta normal do Omie, não erro de método
      if (/n[ãa]o (existem|foram encontrados|h[áa]) registros|nenhum registro/i.test(r.erro)) {
        return { paginas, registros, declarado: 0 };
      }
      if (n > 1) return { paginas, registros, declarado, erro: r.erro };
      return { erro: r.erro };
    }
    total = num(r.json, "total_de_paginas", "nTotPaginas") || 1;
    declarado = num(r.json, "total_de_registros", "nTotRegistros");
    paginas++;
    registros += tamanhoLista(r.json);
  }
  return { paginas, registros, declarado, cortado: total > MAX_PAGINAS, totalPaginas: total };
}

// serviço, método, param extra, estilo de paginação, papel do método como origem de dado
const LISTAGENS = [
  ["produtos/pedido", "ListarPedidos", { apenas_importado_api: "N" }, "v1", "pedidos de venda"],
  ["financas/contareceber", "ListarContasReceber", { apenas_importado_api: "N" }, "v1", "contas a receber"],
  ["financas/contapagar", "ListarContasPagar", { apenas_importado_api: "N" }, "v1", "contas a pagar"],
  ["financas/contacorrentelancamentos", "ListarLancamentos", {}, "v2", "lançamentos de conta corrente"],
  ["geral/clientes", "ListarClientes", { apenas_importado_api: "N" }, "v1", "clientes"],
  ["geral/produtos", "ListarProdutos", { apenas_importado_api: "N", filtrar_apenas_omiepdv: "N" }, "v1", "produtos"],
  ["financas/mf", "ListarMovimentos", { cTpLancamento: "CPCR" }, "v2", "movimentos financeiros (fonte das telas hoje)"],
  ["financas/pesquisartitulos", "PesquisarLancamentos", {}, "v2", "títulos a pagar e a receber"],
  ["financas/contacorrente", "ListarContasCorrentes", { apenas_importado_api: "N" }, "v1", "contas correntes cadastradas"],
  ["geral/categorias", "ListarCategorias", {}, "v1", "plano de contas"],
  ["geral/departamentos", "ListarDepartamentos", {}, "v1", "centros de custo"],
  ["servicos/os", "ListarOS", { apenas_importado_api: "N" }, "v1", "ordens de serviço (receita de serviço)"],
  ["produtos/nfconsultar", "ListarNF", { apenas_importado_api: "N" }, "v1", "notas fiscais de venda emitidas"],
  ["produtos/pedidocompra", "ListarPedCompra", {}, "v2", "pedidos de compra (origem de despesa)"],
  ["geral/empresas", "ListarEmpresas", { apenas_importado_api: "N" }, "v1", "empresas da chave"],
];

// método de consulta por código, por tipo de external_id do arquivo de integrações da MeuBESS
const CONSULTAS = {
  pedido: ["produtos/pedido", "ConsultarPedido", (c) => ({ codigo_pedido: Number(c) })],
  cliente: ["geral/clientes", "ConsultarCliente", (c) => ({ codigo_cliente_omie: Number(c) })],
  produto: ["geral/produtos", "ConsultarProduto", (c) => ({ codigo_produto: Number(c) })],
};

const aConsultar = [];
for (const arg of process.argv.slice(2)) {
  const m = /^(pedido|cliente|produto)=(\d+)$/.exec(arg);
  if (!m) {
    console.log("ERRO: argumento inválido (use pedido=CODIGO, cliente=CODIGO ou produto=CODIGO)");
    process.exit(1);
  }
  aConsultar.push([m[1], m[2]]);
}

console.log(`Só leitura. ${POR_PAGINA} registros por página, teto de ${MAX_PAGINAS} páginas, pausa de ${PAUSA_MS / 1000}s entre chamadas.`);
console.log("");
console.log("== LISTAGENS (páginas e registros por serviço e método) ==");
const comDados = [];
for (const [servico, metodo, param, estilo, papel] of LISTAGENS) {
  const r = await contar(servico, metodo, param, estilo);
  const rot = `${servico} → ${metodo} (${papel})`;
  if (r.paginas == null) {
    console.log(`${rot}: ERRO Omie ${r.erro}`);
    continue;
  }
  const decl = r.declarado == null ? "" : ` (o Omie declara ${r.declarado} registro(s))`;
  const corte = r.cortado ? ` — cortado no teto; o Omie declara ${r.totalPaginas} página(s)` : "";
  const parou = r.erro ? ` — parou com erro Omie ${r.erro}` : "";
  console.log(`${rot}: ${r.paginas} página(s), ${r.registros} registro(s)${decl}${corte}${parou}`);
  if (r.registros > 0) comDados.push(rot);
}

console.log("");
console.log("== EMPRESA QUE A CHAVE ABRE ==");
const emp = await chamar("geral/empresas", "ListarEmpresas", { pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N" });
if (emp.erro) {
  console.log(`geral/empresas → ListarEmpresas: ERRO Omie ${emp.erro}`);
} else {
  const lista = emp.json.empresas_cadastro ?? [];
  console.log(`geral/empresas → ListarEmpresas: ${lista.length} empresa(s)`);
  for (const e of lista) {
    console.log(`  - ${e.razao_social ?? e.nome_fantasia ?? "(sem nome)"} · CNPJ ${e.cnpj ?? "(sem CNPJ)"}`);
  }
}

console.log("");
console.log("== CONSULTA POR CÓDIGO (external_id da plataforma MeuBESS) ==");
for (const [tipo, codigo] of aConsultar) {
  const [servico, metodo, monta] = CONSULTAS[tipo];
  const r = await chamar(servico, metodo, monta(codigo));
  const rot = `${tipo} ${codigo} em ${servico} → ${metodo}`;
  // o faultcode inteiro do Omie (ex.: SOAP-ENV:Client-8020) — nunca a mensagem, que pode trazer dado do cadastro
  console.log(r.erro ? `${rot}: não encontrado (Omie ${r.code ?? "?"})` : `${rot}: encontrado`);
}

// Controle: consulta um código que existe nesta empresa, pegue-o da própria listagem.
// Serve para separar "o registro não existe" de "a chamada está errada" — os dois voltam com faultcode.
// Imprime só se achou ou não; nunca o código nem qualquer dado do cadastro.
console.log("");
console.log("== CONTROLE (o mesmo método de consulta num código que existe nesta empresa) ==");
const lc = await chamar("geral/clientes", "ListarClientes", { pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N" });
const codigoLocal = lc.json?.clientes_cadastro?.[0]?.codigo_cliente_omie;
if (codigoLocal == null) {
  console.log("geral/clientes → ConsultarCliente: sem cliente nesta empresa para usar de controle");
} else {
  const c = await chamar("geral/clientes", "ConsultarCliente", { codigo_cliente_omie: Number(codigoLocal) });
  console.log(`geral/clientes → ConsultarCliente com um código desta empresa: ${c.erro ? `não encontrado (Omie ${c.code ?? "?"})` : "encontrado"}`);
}

console.log("");
console.log("== SERVIÇOS COM DADOS ==");
console.log(comDados.length ? comDados.map((s) => `  - ${s}`).join("\n") : "  (nenhum)");
