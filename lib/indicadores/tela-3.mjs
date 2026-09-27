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
//
// OS QUATRO FILTROS DA TELA (`docs/fontes.md`, "Tela 3 — Contas a receber": data de vencimento de–até · status ·
// cliente · categoria). Eles são os campos da própria consulta, e é assim que entram:
//
//   VENCIMENTO de–até  é a JANELA da consulta, `dDtVencDe` / `dDtVencAte`. Sem ele, a janela é o mês escolhido.
//   STATUS             fala a língua da tela — pago · atrasado · em aberto —, e cada faixa é o conjunto de `cStatus`
//                      que o de-para do dono (25/09/2026) lhe dá. `CANCELADO` não é opção: fica fora da tela, inteiro.
//   CLIENTE            é o par EMPRESA + `nCodCliente`, porque o código é próprio de cada empresa.
//   CATEGORIA          é o `cCodCateg` do título.
//
// ONDE ELES NÃO VALEM, e por quê: o gráfico "Lançamentos por mês e status" tem uma coluna por mês e por isso lê o ANO
// inteiro — a janela de vencimento não o alcança (os outros três, sim); e as duas contagens do cadastro de clientes que
// o gráfico por cliente leva ao lado são cadastro, não título, e nenhum dos quatro as alcança. Sai daqui em `naoVale[]`,
// a tela escreve junto do número, e `docs/filtros.md` lista todas.

import { abrirCacheOmie } from '../regras/cache-omie.mjs';
import { lerRecorte } from '../regras/movimentos.mjs';
import { FAIXA_DO_STATUS } from '../regras/listas.mjs';
import { dataBR, dois, ultimoDia, NOMES_DOS_MESES } from '../regras/periodo.mjs';
import { FAIXAS_DE_STATUS, chaveDoCliente, filtroDaTela3, naoVale } from '../regras/filtros.mjs';

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

async function calcularTela3({ raiz, ano, mes, janela = null, filtro = {} }) {
  const OMIE = abrirCacheOmie({ raiz, ano });
  const { EMPRESAS, titulosR, categorias, pedidos, clientes, paginas, leituras } = OMIE;
  const recorte = lerRecorte(raiz);

  // OS FILTROS DA TELA, lidos do que a página passou (a query crua) por `lib/regras/filtros.mjs`. Filtro vazio é a
  // janela do mês e mais nada — exatamente o que a tela fazia antes de os filtros existirem.
  const f = filtroDaTela3(filtro, { ano, mes });

  // A JANELA DA CONSULTA. `janela` é a janela crua que a conferência pede e tem precedência; sem ela vale o filtro de
  // vencimento, que sem escolha nenhuma já é o mês — o mesmo recorte dos outros indicadores das três telas.
  const [de, ate] = janela ?? [f.vencimento.de, f.vencimento.ate];
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
  const naTela = {};
  for (const emp of EMPRESAS) naTela[emp] = daJanela[emp].filter((t) => faixaDe(t) !== 'fora');
  const naJanela = EMPRESAS.flatMap((emp) => naTela[emp].map((t) => ({ emp, cab: t.cabecTitulo ?? {}, resumo: t.resumo ?? {}, faixa: faixaDe(t) })));

  // ---------------------------------------------------------------- os outros três filtros
  //
  // AS OPÇÕES SAEM DA PRÓPRIA JANELA, e não do cadastro inteiro: cliente e categoria que não têm título vencendo aqui
  // não viram opção, porque escolhê-los só daria tela vazia. São montadas ANTES de status, cliente e categoria serem
  // aplicados — senão escolher um cliente apagaria os outros da lista e não haveria como trocar.
  const { status: fStatus, cliente: fCliente, categoria: fCategoria } = f;
  // Quando a conferência pede uma `janela` crua, ela manda na janela e o filtro de vencimento da URL não vale.
  const fVenc = janela ? { ativo: false, de, ate } : f.vencimento;

  const opcoesDeCliente = [...new Map(naJanela.map((x) => {
    const cod = String(x.cab.nCodCliente ?? '');
    return [chaveDoCliente(x.emp, cod), { chave: chaveDoCliente(x.emp, cod), empresa: x.emp, codigo: cod, nome: clientes[x.emp]?.nomes?.get(cod) ?? null }];
  })).values()].sort((a, b) => (a.nome ?? a.codigo).localeCompare(b.nome ?? b.codigo, 'pt-BR'));
  const opcoesDeCategoria = [...new Map(naJanela.map((x) => {
    const cod = String(x.cab.cCodCateg ?? '');
    return [cod, { codigo: cod, descricao: categorias[x.emp].get(cod)?.descricao ?? cod }];
  })).values()].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const passa = (x) => (!fStatus.ativo || fStatus.faixas.includes(x.faixa))
    && (!fCliente.ativo || (x.emp === fCliente.empresa && String(x.cab.nCodCliente ?? '') === fCliente.codigo))
    && (!fCategoria.ativo || String(x.cab.cCodCateg ?? '') === fCategoria.codigo);
  // O mesmo recorte de cliente e categoria, sem o de status: é o que vale para a contagem dos `CANCELADO`, que o
  // filtro de status não alcança porque `CANCELADO` nunca é opção dele.
  const passaSemStatus = (t, emp) => (!fCliente.ativo || (emp === fCliente.empresa && String(t.cabecTitulo?.nCodCliente ?? '') === fCliente.codigo))
    && (!fCategoria.ativo || String(t.cabecTitulo?.cCodCateg ?? '') === fCategoria.codigo);

  const todos = naJanela.filter(passa);
  const daFaixa = (f) => todos.filter((x) => x.faixa === f);
  const porEmpresa = (xs) => ({ empresa1: xs.filter((x) => x.emp === '1').length, empresa2: xs.filter((x) => x.emp === '2').length });

  const pagos = daFaixa('pago'), abertos = daFaixa('aberto'), atrasados = daFaixa('atrasado');

  // ---------------------------------------------------------------- as frases de "aqui este filtro não vale"
  const ativos = [
    fVenc.ativo ? 'vencimento' : null, fStatus.ativo ? 'status' : null,
    fCliente.ativo ? 'cliente' : null, fCategoria.ativo ? 'categoria' : null,
  ].filter(Boolean);
  // Um cartão que É uma faixa fica vazio quando o filtro de status não escolheu a faixa dele. O filtro vale — o cartão
  // é que não tem mais nada para mostrar —, e a tela diz isso em vez de deixar um zero sem explicação.
  const foraDoStatus = (f) => (fStatus.ativo && !fStatus.faixas.includes(f)
    ? [`o filtro de status não escolheu a faixa ${f === 'aberto' ? 'em aberto' : f}, que é a deste cartão: por isso ele está vazio.`]
    : []);
  const cadastroDeClientes = ativos.length
    ? [naoVale(ativos.join(' e '), 'as duas contagens do cadastro de clientes ao lado deste gráfico',
      'elas são o tamanho do cadastro `geral/clientes` de cada empresa, não títulos: nenhum dos quatro filtros da tela as alcança')]
    : [];

  // OS `CANCELADO` DA JANELA: cliente e categoria os recortam, o status não — `CANCELADO` nunca é opção dele.
  const cancelados = EMPRESAS.reduce((s, emp) => s
    + daJanela[emp].filter((t) => faixaDe(t) === 'fora' && passaSemStatus(t, emp)).length, 0);

  // ---------------------------------------------------------------- os 4 cartões do topo
  const FONTE = 'Omie, títulos a receber por vencimento';
  const cartoes = [
    { id: 'valor-previsto', nome: 'Valor Previsto', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(todos.map((x) => centavos(x.cab.nValorTitulo))),
      contagem: { dfc: null, omie: todos.length, extras: { ...porEmpresa(todos), cancelados } },
      naoVale: fStatus.ativo
        ? [naoVale('status', 'a contagem de `CANCELADO` que ficaram fora, ao lado',
          '`CANCELADO` fica fora da tela inteira (decisão do dono, 25/09/2026) e por isso nunca é opção do filtro de status: essa contagem é a da janela, recortada só por cliente e categoria')]
        : [] },
    { id: 'valor-recebido', nome: 'Valor Recebido', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(pagos.map((x) => centavos(x.resumo.nValPago))),
      contagem: { dfc: null, omie: pagos.length, extras: porEmpresa(pagos) },
      naoVale: [], avisos: foraDoStatus('pago') },
    { id: 'valor-pendente', nome: 'Valor Pendente', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(abertos.map((x) => centavos(x.resumo.nValAberto))),
      contagem: { dfc: null, omie: abertos.length, extras: porEmpresa(abertos) },
      naoVale: [], avisos: foraDoStatus('aberto') },
    { id: 'valor-vencido', nome: 'Valor Vencido', fonte: FONTE, tipo: 'dinheiro',
      valor: somar(atrasados.map((x) => centavos(x.resumo.nValAberto))),
      contagem: { dfc: null, omie: atrasados.length, extras: porEmpresa(atrasados) },
      naoVale: [], avisos: foraDoStatus('atrasado') },
  ];

  // ---------------------------------------------------------------- Lançamentos por mês e status
  //
  // UMA COLUNA POR MÊS, como a referência. A janela desta consulta é o ANO inteiro — a leitura que o cache já tem em
  // duas passadas —, e a coluna do mês escolhido é a que a conferência publica.
  //
  // O FILTRO DE VENCIMENTO NÃO ALCANÇA ESTE GRÁFICO, de propósito: ele tem uma coluna por mês do ano, e recortá-lo pela
  // janela deixaria uma coluna só. Os outros três filtros — status, cliente e categoria — valem aqui como em todo o
  // resto da tela, e por isso `passa` também é aplicado nesta leitura.
  const doAno = EMPRESAS.flatMap((emp) => (titulosR[emp] ?? [])
    .filter((t) => recorte.has(`${emp}|${t.cabecTitulo?.nCodCC}`) && dataBR(t.cabecTitulo?.dDtVenc)?.a === ano)
    .map((t) => ({ emp, cab: t.cabecTitulo ?? {}, faixa: faixaDe(t) }))
    .filter((x) => x.faixa !== 'fora').filter(passa));
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
      dados: porMes, mesEmFoco: mesDaJanela,
      naoVale: fVenc.ativo
        ? [naoVale('vencimento de–até', 'as doze colunas deste gráfico',
          'ele tem uma coluna por mês do ano, como a tela de referência, e recortá-lo pela janela de vencimento deixaria uma coluna só; a coluna em destaque é a do mês em que a janela começa. Status, cliente e categoria valem aqui')]
        : [] },
    { id: 'por-cliente-e-status', nome: 'Valor previsto por cliente e status', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: {
        clientes: porCliente.size,
        cadastro1: clientes[1]?.total ?? null,
        cadastro2: clientes[2]?.total ?? null,
      } },
      dados: clientesOrdenados, semCadastro, naoVale: cadastroDeClientes },
    { id: 'lista-de-titulos', nome: 'Lista de títulos', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: { comPedido, semPedido, pedidoAusente } },
      dados: lista, total: somar(lista.map((l) => l.valor)), naoVale: [] },
    // A rosca: o total do centro é o da consulta sem os `CANCELADO` — o mesmo que `nTotRegistros` menos eles.
    { id: 'por-status', nome: 'Lançamentos por status', fonte: FONTE,
      contagem: { dfc: null, omie: todos.length, extras: { pago: pagos.length, atrasado: atrasados.length, aberto: abertos.length } },
      dados: { total: todos.length, ...Object.fromEntries(FAIXAS.map((f) => [f, daFaixa(f).length])) },
      naoVale: [] },
  ];

  return {
    ano, mes, mesDaJanela,
    janela: { de, ate, leitura: temExata ? 'janela' : 'ano' },
    cartoes, blocos,
    // O FILTRO, DE VOLTA PARA A TELA: as opções que a janela tem, o que foi escolhido, e se a janela sai do ano lido.
    filtros: {
      vencimento: { de, ate, ativo: fVenc.ativo, foraDoAnoLido: [de, ate].some((d) => dataBR(d)?.a !== ano) },
      status: { opcoes: FAIXAS_DE_STATUS, escolhidos: fStatus.faixas, ativo: fStatus.ativo },
      cliente: { opcoes: opcoesDeCliente, escolhido: fCliente.ativo ? chaveDoCliente(fCliente.empresa, fCliente.codigo) : null, ativo: fCliente.ativo },
      categoria: { opcoes: opcoesDeCategoria, escolhido: fCategoria.codigo, ativo: fCategoria.ativo },
      naJanela: naJanela.length,
    },
    // A Tela 3 não tem lado do DFC: ele é caixa e não tem carteira em aberto nem cadastro de cliente
    // (`docs/fontes.md`, "Esta tela fica no Omie, inteira").
    dfc: null,
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela3, FAIXAS };
