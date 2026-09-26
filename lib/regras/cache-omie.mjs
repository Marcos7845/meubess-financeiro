// O CACHE LOCAL DAS LEITURAS DO OMIE — a fonte única de como se acha cada leitura.
//
// Saiu de `scripts/numeros-das-telas.mjs` quando o app começou: o script da conferência e a camada de dados do app
// abrem o MESMO cache, pelas MESMAS chaves. As chaves são a própria pergunta: empresa + serviço + método + sha1 dos
// parâmetros. É a mesma conta que `scripts/confronto-dfc-omie.mjs` faz para gravar.
//
// Só leitura de arquivo. Nada aqui chama a API do Omie — quem grava o cache são os scripts de leitura.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EMPRESAS = ['1', '2'];

const sha = (p) => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);

// As leituras, como `docs/fontes.md` as descreve. Cada uma é uma função do ano porque o cache guarda o ano inteiro.
function leiturasDe(ano) {
  return {
    // A LEITURA DAS TELAS 1 E 2, e a única que `docs/fontes.md` conta: `financas/mf` → `ListarMovimentos` SEM
    // `cTpLancamento` (o filtro por tipo deixa de fora o lançamento avulso de conta corrente), por data de pagamento.
    // O cache tem a faixa inteira de 2026 até setembro; o mês pedido é recortado dela pela `dDtPagamento` de cada
    // lançamento, que é exatamente o que `dDtPagtoDe` / `dDtPagtoAte` no mês devolveria.
    MF: (n) => ({ nPagina: n, nRegPorPagina: 100, dDtPagtoDe: `01/01/${ano}`, dDtPagtoAte: `30/09/${ano}` }),
    // A LEITURA DA TELA 3: `financas/pesquisartitulos` → `PesquisarLancamentos`, `cNatureza: "R"`, por vencimento, em
    // duas passadas (até hoje e a vencer).
    TIT_R: (n, de, ate) => ({ nPagina: n, nRegPorPagina: 100, cNatureza: 'R', dDtVencDe: de, dDtVencAte: ate }),
    FAIXAS_TIT_R: [[`01/01/${ano}`, `25/09/${ano}`], [`26/09/${ano}`, `31/12/${ano}`]],
    // A LEITURA DOS TÍTULOS A PAGAR, segunda opinião do cartão "Despesas pendentes".
    TIT_P: (n) => ({ nPagina: n, nRegPorPagina: 100, cNatureza: 'P', dDtVencDe: `01/01/${ano}`, dDtVencAte: `31/12/${ano}` }),
    // A LEITURA DO CARTÃO "Despesas pendentes", como `docs/fontes.md` a pede: `cTpLancamento: "CP"` por VENCIMENTO.
    CP_VENC: (n) => ({ nPagina: n, nRegPorPagina: 100, cTpLancamento: 'CP', dDtVencDe: `01/01/${ano}`, dDtVencAte: `31/12/${ano}` }),
    // A LEITURA DO CONFRONTO DO "Top 10 despesas": a de caixa, COM `cExibirDepartamentos: "S"`, que é o único jeito
    // de o rateio por centro de custo vir no retorno.
    MF_DEP: (n) => ({ nPagina: n, nRegPorPagina: 100, dDtPagtoDe: `01/01/${ano}`, dDtPagtoAte: `30/09/${ano}`, cExibirDepartamentos: 'S' }),
    CLIENTES: (n) => ({ pagina: n, registros_por_pagina: 100, apenas_importado_api: 'N' }),
    DRE: { apenasContasAtivas: 'N' },
  };
}

// Abre o cache e devolve as leituras já carregadas, por empresa. `janelasAberto` são as duas janelas da faixa
// "em aberto" do "Valor pendente" — `{ corrente: [de, ate], seguinte: [de, ate] }`.
function abrirCacheOmie({ raiz, ano, janelasAberto = {}, aoFaltar }) {
  const CACHE = path.join(raiz, '.cache', 'omie');
  const falhar = aoFaltar ?? ((m) => { throw new Error(m); });
  const L = leiturasDe(ano);

  const arqCache = (emp, servico, call, param) =>
    path.join(CACHE, `${emp}-${servico.replace(/\W+/g, '-')}-${call}-${sha(param)}.json`);

  if (!fs.existsSync(CACHE)) falhar(`cache não encontrado em ${CACHE}.\nRode antes: node scripts/confronto-dfc-omie.mjs`);
  const arquivosDoCache = fs.readdirSync(CACHE);

  function paginas(emp, servico, call, param, campo) {
    const primeira = arqCache(emp, servico, call, param(1));
    if (!fs.existsSync(primeira)) return null;
    const itens = [];
    let total = 1;
    for (let n = 1; n <= total; n++) {
      const f = arqCache(emp, servico, call, param(n));
      if (!fs.existsSync(f)) return null;
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      total = Number(j.nTotPaginas ?? j.total_de_paginas) || 1;
      itens.push(...(j[campo] ?? []));
    }
    return itens;
  }

  const movimentos = {}, titulosR = {}, titulosP = {}, categorias = {}, departamentos = {}, pedidos = {};
  // As quatro leituras que `scripts/ler-omie-faltante.mjs` acrescentou ao cache. Se alguma faltar, o indicador que
  // depende dela sai "a conferir:" dizendo isso, e o resto segue.
  const cpVenc = {}, comDep = {}, clientes = {}, contasDre = {};
  const titulosAberto = { corrente: {}, seguinte: {} };

  for (const emp of EMPRESAS) {
    movimentos[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', L.MF, 'movimentos');
    if (!movimentos[emp]) falhar(`empresa ${emp}: a leitura de financas/mf por data de pagamento (sem cTpLancamento, 01/01 a 30/09/${ano}) não está inteira no cache.\nRode antes: node scripts/confronto-dfc-omie.mjs`);

    titulosR[emp] = [];
    for (const [de, ate] of L.FAIXAS_TIT_R) {
      const t = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', (n) => L.TIT_R(n, de, ate), 'titulosEncontrados');
      if (t) titulosR[emp].push(...t);
    }
    titulosP[emp] = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', L.TIT_P, 'titulosEncontrados') ?? [];

    categorias[emp] = new Map();
    for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-geral-categorias`)))
      for (const c of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).categoria_cadastro ?? [])
        categorias[emp].set(String(c.codigo), c);
    departamentos[emp] = new Map();
    for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-geral-departamentos`)))
      for (const d of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).departamentos ?? [])
        departamentos[emp].set(String(d.codigo), d);
    pedidos[emp] = new Map();
    for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-produtos-pedido`)))
      for (const p of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).pedido_venda_produto ?? [])
        pedidos[emp].set(String(p.cabecalho?.codigo_pedido), p);

    cpVenc[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', L.CP_VENC, 'movimentos');
    comDep[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', L.MF_DEP, 'movimentos');
    // DO CADASTRO DE CLIENTES SÓ SAI O CÓDIGO. `clientes[emp]` é o conjunto dos códigos cujo nome está preenchido no
    // cadastro; o nome nunca é guardado nem impresso.
    const cru = paginas(emp, 'geral/clientes', 'ListarClientesResumido', L.CLIENTES, 'clientes_cadastro_resumido');
    clientes[emp] = cru && {
      total: cru.length,
      comNome: new Set(cru.filter((c) => String(c.razao_social ?? '').trim() || String(c.nome_fantasia ?? '').trim())
        .map((c) => String(c.codigo_cliente))),
    };
    const arqDre = arqCache(emp, 'geral/dre', 'ListarCadastroDRE', L.DRE);
    contasDre[emp] = fs.existsSync(arqDre) ? (JSON.parse(fs.readFileSync(arqDre, 'utf8')).dreLista ?? []) : null;
    for (const [qual, [de, ate]] of Object.entries(janelasAberto))
      titulosAberto[qual][emp] = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos',
        (n) => L.TIT_R(n, de, ate), 'titulosEncontrados');
  }

  return {
    CACHE, EMPRESAS, leituras: L, arqCache, arquivosDoCache, paginas,
    movimentos, titulosR, titulosP, categorias, departamentos, pedidos,
    cpVenc, comDep, clientes, contasDre, titulosAberto,
  };
}

export { EMPRESAS, sha, leiturasDe, abrirCacheOmie };
