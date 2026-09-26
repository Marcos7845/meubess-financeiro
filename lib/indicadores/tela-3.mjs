// TELA 3 — CONTAS A RECEBER. Os 8 indicadores de `docs/fontes.md`: 4 cartões e 4 blocos, cada um com o VALOR que a
// tela mostra e a CONTAGEM que `docs/conferencia.md` publica.
//
// UMA CONSULTA SÓ, como `docs/fontes.md` manda: `financas/pesquisartitulos` → `PesquisarLancamentos` com
// `cNatureza: "R"` e a janela de vencimento em `dDtVencDe` / `dDtVencAte`. Os cartões, a lista, a rosca e o gráfico
// por cliente saem todos dela. O único que olha mais longe é o gráfico "Lançamentos por mês e status", que tem uma
// coluna por mês como a tela de referência e por isso lê a janela do ANO inteiro — é outra janela da mesma consulta,
// e a coluna do mês escolhido é a que `docs/conferencia.md` confere.
//
// DE ONDE VEM CADA JANELA. O cache local guarda a leitura do ano em duas passadas (até hoje e a vencer) e, quando
// algum script pediu, a leitura de uma janela menor. Esta camada prefere a leitura EXATA da janela pedida, se ela
// estiver no cache, e só então recorta a do ano — é o que faz a tela ler os mesmos títulos que a conferência leu
// quando ela mediu a faixa "em aberto" fora do mês fechado. `janela.leitura` diz qual das duas foi usada.
//
// VALOR E CONTAGEM, como nas Telas 1 e 2. O valor é dinheiro e nunca entra em arquivo versionado: vive na memória do
// servidor e vai para a tela. A contagem (quantos títulos entraram) é o que `docs/conferencia.md` publica, e é por
// ela que `scripts/conferir-telas.mjs` compara a tela com a conferência.
//
// O NOME DO CLIENTE É DA TELA, NÃO DO ARQUIVO. Ele vem do cadastro `geral/clientes` porque `docs/fontes.md` põe o
// nome no eixo do gráfico e na lista. Nada aqui grava arquivo; `scripts/capturar-tela.mjs` troca o nome pelo código
// antes de a captura entrar no repositório.
//
// NENHUMA REGRA MORA AQUI. O de-para dos `cStatus` e o recorte da MeuBESS vêm de `lib/regras/` — os mesmos arquivos
// que `scripts/numeros-das-telas.mjs` importa.

import { abrirCacheOmie } from '../regras/cache-omie.mjs';
import { lerRecorte } from '../regras/movimentos.mjs';
import { FAIXA_DO_STATUS } from '../regras/listas.mjs';
import { dataBR, dois, ultimoDia, NOMES_DOS_MESES } from '../regras/periodo.mjs';

// As três faixas da tela, na ordem em que a referência as empilha.
const FAIXAS = ['pago', 'atrasado', 'aberto'];

const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// Dinheiro em CENTAVOS inteiros, como no resto do app — nunca em ponto flutuante.
const centavos = (x) => Math.round(Number(x ?? 0) * 100);
// `dd/mm/aaaa` vira um número comparável, para a janela de vencimento.
const ordem = (s) => { const d = dataBR(s); return d ? d.a * 10000 + d.m * 100 + d.d : null; };
const janelaDoMes = (ano, mes) => [`01/${dois(mes)}/${ano}`, `${ultimoDia(ano, mes)}/${dois(mes)}/${ano}`];

// A DESCRIÇÃO DO TÍTULO (decisão do dono, 25/09/2026, opção 1 de `docs/descricao-do-titulo.html`): os produtos do
// pedido de venda ligado por `nCodOS`; com vários produtos, o primeiro `det[]` e "+N"; sem pedido, a `descricao` da
// categoria, que nunca vem vazia.
function descricaoDoTitulo({ cab, pedido, categoria }) {
  const itens = pedido?.det ?? [];
  if (itens.length) {
    const primeiro = String(itens[0]?.produto?.descricao ?? '').trim();
    if (primeiro) return itens.length > 1 ? `${primeiro} +${itens.length - 1}` : primeiro;
  }
  return categoria?.descricao ?? String(cab.cCodCateg ?? '—');
}

async function calcularTela3({ raiz, ano, mes, janela = null }) {
  const OMIE = abrirCacheOmie({ raiz, ano });
  const { EMPRESAS, titulosR, categorias, pedidos, clientes, paginas, leituras } = OMIE;
  const recorte = lerRecorte(raiz);

  // A JANELA DA CONSULTA. Sem `janela`, é o mês escolhido — o mesmo recorte dos outros indicadores das três telas.
  const [de, ate] = janela ?? janelaDoMes(ano, mes);
  const mesDaJanela = dataBR(de)?.m ?? mes;
  const dentro = (s) => { const o = ordem(s); return o !== null && o >= ordem(de) && o <= ordem(ate); };

  // A leitura exata da janela, se o cache a tiver; senão, a do ano recortada. A conferência faz o mesmo caminho.
  const exata = {};
  let temExata = true;
  for (const emp of EMPRESAS) {
    exata[emp] = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos',
      (n) => leituras.TIT_R(n, de, ate), 'titulosEncontrados');
    if (!exata[emp]) temExata = false;
  }
  const cru = temExata ? exata : titulosR;

  // Os títulos da janela, por empresa: recorte da MeuBESS pelo `cabecTitulo.nCodCC` e vencimento dentro dela. Os
  // `CANCELADO` continuam aqui e saem logo abaixo — é deles que sai a contagem "ficaram fora".
  const daJanela = {};
  for (const emp of EMPRESAS) {
    daJanela[emp] = (cru[emp] ?? []).filter((t) => {
      const c = t.cabecTitulo ?? {};
      return recorte.has(`${emp}|${c.nCodCC}`) && dentro(c.dDtVenc);
    });
  }

  // `CANCELADO` fica fora da tela (decisão do dono, 25/09/2026). O que sobra é o que a tela mostra, e cada título
  // ganha a faixa do de-para.
  const faixaDe = (t) => FAIXA_DO_STATUS(t.cabecTitulo?.cStatus);
  const naTela = {}, cancelados = {};
  for (const emp of EMPRESAS) {
    naTela[emp] = daJanela[emp].filter((t) => faixaDe(t) !== 'fora');
    cancelados[emp] = daJanela[emp].length - naTela[emp].length;
  }
  const todos = EMPRESAS.flatMap((emp) => naTela[emp].map((t) => ({ emp, cab: t.cabecTitulo ?? {}, resumo: t.resumo ?? {}, faixa: faixaDe(t) })));
  const daFaixa = (f) => todos.filter((x) => x.faixa === f);
  const porEmpresa = (xs) => ({ empresa1: xs.filter((x) => x.emp === '1').length, empresa2: xs.filter((x) => x.emp === '2').length });

  const pagos = daFaixa('pago'), abertos = daFaixa('aberto'), atrasados = daFaixa('atrasado');

  // ---------------------------------------------------------------- os 4 cartões do topo
  const FONTE = 'Omie, títulos a receber por vencimento';
  const cartoes = [
    { id: 'valor-previsto', nome: 'Valor Previsto', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(todos.map((x) => centavos(x.cab.nValorTitulo))),
      contagem: { dfc: null, omie: todos.length, extras: { ...porEmpresa(todos), cancelados: cancelados[1] + cancelados[2] } } },
    { id: 'valor-recebido', nome: 'Valor Recebido', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(pagos.map((x) => centavos(x.resumo.nValPago))),
      contagem: { dfc: null, omie: pagos.length, extras: porEmpresa(pagos) } },
    { id: 'valor-pendente', nome: 'Valor Pendente', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(abertos.map((x) => centavos(x.resumo.nValAberto))),
      contagem: { dfc: null, omie: abertos.length, extras: porEmpresa(abertos) } },
    { id: 'valor-vencido', nome: 'Valor Vencido', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(atrasados.map((x) => centavos(x.resumo.nValAberto))),
      contagem: { dfc: null, omie: atrasados.length, extras: porEmpresa(atrasados) } },
  ];

  // ---------------------------------------------------------------- Lançamentos por mês e status
  //
  // UMA COLUNA POR MÊS, como a referência. A janela desta consulta é o ANO inteiro — a leitura que o cache já tem em
  // duas passadas —, e a coluna do mês escolhido é a que a conferência publica.
  const doAno = EMPRESAS.flatMap((emp) => (titulosR[emp] ?? [])
    .filter((t) => recorte.has(`${emp}|${t.cabecTitulo?.nCodCC}`) && dataBR(t.cabecTitulo?.dDtVenc)?.a === ano)
    .map((t) => ({ emp, cab: t.cabecTitulo ?? {}, faixa: faixaDe(t) }))
    .filter((x) => x.faixa !== 'fora'));
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const doMes = doAno.filter((x) => dataBR(x.cab.dDtVenc)?.m === m);
    return {
      mes: m, nome: NOMES_DOS_MESES[m], total: doMes.length,
      ...Object.fromEntries(FAIXAS.map((f) => [f, doMes.filter((x) => x.faixa === f).length])),
    };
  });
  const coluna = porMes[mesDaJanela - 1];

  // ---------------------------------------------------------------- Valor previsto por cliente e status
  //
  // O eixo é o NOME do cliente (`docs/fontes.md`), que sai de `geral/clientes`. O código vai junto porque é por ele
  // que a captura versionada troca o nome.
  const porCliente = new Map();
  for (const x of todos) {
    const cod = String(x.cab.nCodCliente ?? '');
    const k = `${x.emp}|${cod}`;
    if (!porCliente.has(k)) {
      porCliente.set(k, {
        empresa: x.emp, codigo: cod, nome: clientes[x.emp]?.nomes?.get(cod) ?? null,
        total: 0, ...Object.fromEntries(FAIXAS.map((f) => [f, 0])),
      });
    }
    const c = porCliente.get(k);
    const v = centavos(x.cab.nValorTitulo);
    c.total += v;
    c[x.faixa] += v;
  }
  const clientesOrdenados = [...porCliente.values()].sort((a, b) => b.total - a.total);
  const semCadastro = EMPRESAS.filter((emp) => !clientes[emp]);

  // ---------------------------------------------------------------- Lista de títulos
  let comPedido = 0, semPedido = 0, pedidoAusente = 0;
  const lista = todos.map((x) => {
    const os = String(x.cab.nCodOS ?? '');
    const pedido = os && os !== '0' ? pedidos[x.emp].get(os) : null;
    if (!os || os === '0') semPedido++;
    else if (pedido) comPedido++;
    else pedidoAusente++;
    const cod = String(x.cab.nCodCliente ?? '');
    const categoria = categorias[x.emp].get(String(x.cab.cCodCateg));
    return {
      empresa: x.emp,
      codigo: String(x.cab.nCodTitulo ?? ''),
      cliente: { codigo: cod, nome: clientes[x.emp]?.nomes?.get(cod) ?? null },
      categoria: categoria?.descricao ?? String(x.cab.cCodCateg ?? '—'),
      descricao: descricaoDoTitulo({ cab: x.cab, pedido, categoria }),
      valor: centavos(x.cab.nValorTitulo),
      vencimento: x.cab.dDtVenc,
      status: x.cab.cStatus,
      faixa: x.faixa,
    };
  }).sort((a, b) => (ordem(a.vencimento) ?? 0) - (ordem(b.vencimento) ?? 0));

  const blocos = [
    { id: 'por-mes-e-status', nome: 'Lançamentos por mês e status', fonte: FONTE,
      contagem: { dfc: null, omie: coluna.total, extras: { pago: coluna.pago, atrasado: coluna.atrasado, aberto: coluna.aberto } },
      dados: porMes, mesEmFoco: mesDaJanela },
    { id: 'por-cliente-e-status', nome: 'Valor previsto por cliente e status', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: {
        clientes: porCliente.size,
        cadastro1: clientes[1]?.total ?? null,
        cadastro2: clientes[2]?.total ?? null,
      } },
      dados: clientesOrdenados, semCadastro },
    { id: 'lista-de-titulos', nome: 'Lista de títulos', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: { comPedido, semPedido, pedidoAusente } },
      dados: lista, total: somar(lista.map((l) => l.valor)) },
    // A rosca: o total do centro é o da consulta sem os `CANCELADO` — o mesmo que `nTotRegistros` menos eles.
    { id: 'por-status', nome: 'Lançamentos por status', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: { pago: pagos.length, atrasado: atrasados.length, aberto: abertos.length } },
      dados: { total: todos.length, ...Object.fromEntries(FAIXAS.map((f) => [f, daFaixa(f).length])) } },
  ];

  return {
    ano, mes, mesDaJanela,
    janela: { de, ate, leitura: temExata ? 'janela' : 'ano' },
    cartoes, blocos,
    // A Tela 3 não tem lado do DFC: ele é caixa e não tem carteira em aberto nem cadastro de cliente
    // (`docs/fontes.md`, "Esta tela fica no Omie, inteira").
    dfc: null,
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela3, FAIXAS };
