// TELA 1 — GESTÃO DE CONTAS. Os 11 indicadores de `docs/fontes.md`, cada um com o VALOR que a tela mostra e a
// CONTAGEM que `docs/conferencia.md` publica.
//
// POR QUE OS DOIS JUNTOS. O valor é dinheiro e nunca entra em arquivo versionado — vive na memória do servidor e vai
// para a tela. A contagem (quantos lançamentos entraram) é o que a conferência já publica, e é por ela que
// `scripts/conferir-telas.mjs` compara a tela com a conferência: se o filtro da tela sair do que `docs/fontes.md`
// manda, a contagem muda e a linha sai "divergente:".
//
// NENHUMA REGRA MORA AQUI. Os filtros vêm de `lib/regras/` — os mesmos que `scripts/numeros-das-telas.mjs` usa.

import { abrirCacheOmie } from '../regras/cache-omie.mjs';
import { lerRecorte, criarRegras, valorOmie } from '../regras/movimentos.mjs';
import { noMesDe, ultimoDia } from '../regras/periodo.mjs';
import { lerDfc, ePessoalDfc, eDeducaoDfc, eReceitaTela1Dfc, DFC_RECEITA } from '../regras/dfc.mjs';
import { PESSOAL } from '../regras/listas.mjs';

const naLista = (lista) => (cod) => lista.includes(cod);
const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// No DFC a saída já vem negativa; a tela mostra despesa como número positivo.
const modulo = (c) => Math.abs(c);

async function calcularTela1({ raiz, ano, mes, fonte }) {
  const noMes = noMesDe(ano, mes);
  const OMIE = abrirCacheOmie({ raiz, ano });
  const { EMPRESAS, movimentos, categorias, cpVenc, clientes } = OMIE;
  const recorte = lerRecorte(raiz);
  const { contar } = criarRegras({ movimentos, categorias, recorte });
  const DFC = await lerDfc({ fonte, ano, mes });

  // Os três baldes do mês, por empresa e natureza — a base do lado do Omie, igual à da conferência.
  const R = {}, P = {};
  for (const emp of EMPRESAS) { R[emp] = contar(emp, noMes, 'R'); P[emp] = contar(emp, noMes, 'P'); }
  const totalR = R[1].total + R[2].total, totalP = P[1].total + P[2].total;
  const todosR = [...R[1].todos, ...R[2].todos], todosP = [...P[1].todos, ...P[2].todos];

  // Pessoal, do lado do Omie (confronto): categorias de pessoal, pagas no mês, em qualquer departamento.
  const pes = {};
  for (const emp of EMPRESAS) pes[emp] = contar(emp, noMes, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false });
  const pessoalPagos = [...pes[1].todos, ...pes[2].todos].filter((d) => d.cStatus === 'PAGO');

  // Despesas pendentes — a exceção ao caixa: por VENCIMENTO, sem baixa (`cLiquidado = "N"`).
  const pend = {};
  const faltaCp = EMPRESAS.filter((emp) => !cpVenc[emp]);
  for (const emp of EMPRESAS) {
    pend[emp] = (cpVenc[emp] ?? []).map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} })).filter((d) =>
      d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`) && noMes(d.dDtVenc) && (d._resumo.cLiquidado ?? 'N') === 'N');
  }
  const pendTodos = [...pend[1], ...pend[2]];

  // ---------------------------------------------------------------- o lado do DFC
  const L = DFC.ok ? DFC.linhas : [];
  // As entradas que contam como receita: `eReceitaTela1Dfc` tira as linhas de transferência entre contas
  // (decisão do dono, 27/09/2026), que não são receita. A regra mora em `lib/regras/dfc.mjs`, num lugar só.
  const dfcR = L.filter(eReceitaTela1Dfc);
  const dfcP = L.filter((l) => l.natureza === 'P');
  const dfcPagas = dfcP.filter((l) => l.pagamento === 'PAGO');
  const dfcPessoal = L.filter(ePessoalDfc);
  const dfcReceitaLinhas = dfcR.filter((l) => DFC_RECEITA.includes(l.sub2));
  const dfcDeducoes = L.filter(eDeducaoDfc);
  const receitaLiquida = somar(dfcReceitaLinhas.map((l) => l.valor)) - somar(dfcDeducoes.map((l) => modulo(l.valor)));
  const pessoalTotal = somar(dfcPessoal.map((l) => modulo(l.valor)));

  // Top 10 despesas: o DFC agrupado por `CLASS. CONTABIL` — cada linha tem UMA classificação, não há rateio.
  const porClasse = new Map();
  for (const l of dfcP) porClasse.set(l.classe, (porClasse.get(l.classe) ?? 0) + modulo(l.valor));
  const top10Despesas = [...porClasse.entries()].map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor).slice(0, 10);

  // Top 10 receitas: o Omie é a fonte principal aqui. A descrição sai da categoria do lançamento — o caminho que a
  // decisão do dono de 25/09/2026 manda usar quando não há pedido de venda atrás do título — mas a TELA mostra o
  // cliente no lugar dela (decisão do dono, 27/09/2026): o nome sai de `geral/clientes`, como na Tela 3, com o
  // código junto porque é por ele que `scripts/capturar-tela.mjs` troca o nome antes de a captura entrar no
  // repositório.
  const descricaoDe = (emp, d) => categorias[emp].get(String(d.cCodCateg))?.descricao ?? String(d.cCodCateg ?? '—');
  const clienteDe = (emp, d) => {
    const cod = String(d.nCodCliente ?? '');
    return { codigo: cod, nome: clientes[emp]?.nomes?.get(cod) ?? null };
  };
  const receitasComValor = [
    ...R[1].todos.map((d) => ({ d, emp: '1' })), ...R[2].todos.map((d) => ({ d, emp: '2' })),
  ].map(({ d, emp }) => ({
    descricao: descricaoDe(emp, d), cliente: clienteDe(emp, d), data: d.dDtPagamento, status: d.cStatus, valor: valorOmie(d),
  })).sort((a, b) => b.valor - a.valor).slice(0, 10);

  // Os dois gráficos de "Receita × despesa" leem o BLOCO PRONTO da aba do mês, não o `FLUXO DE CAIXA`.
  const bloco = DFC.ok ? DFC.abaDoMes : null;
  const dias = bloco?.porDia
    ? bloco.porDia.entradas.map((e, i) => ({ dia: i + 1, entradas: e, gastos: modulo(bloco.porDia.gastos[i] ?? 0) }))
      .slice(0, ultimoDia(ano, mes))
    : [];
  const serieOk = DFC.ok ? DFC.serie.filter((x) => x.ok) : [];
  const meses = serieOk.map((x) => ({
    mes: x.mes,
    entradas: somar(x.porDia?.entradas ?? []),
    gastos: modulo(somar(x.porDia?.gastos ?? [])),
  }));

  // ---------------------------------------------------------------- os 11 indicadores
  // `contagem.dfc` e `contagem.omie` são os números que `docs/conferencia.md` publica para este indicador.
  const cartoes = [
    { id: 'saldo', nome: 'Saldo', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(L.map((l) => l.valor)), tipo: 'dinheiro',
      contagem: { dfc: L.length, omie: totalR + totalP } },
    { id: 'receitas', nome: 'Receitas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcR.map((l) => l.valor)), tipo: 'dinheiro',
      contagem: { dfc: dfcR.length, omie: totalR } },
    { id: 'despesas', nome: 'Despesas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcP.map((l) => modulo(l.valor))), tipo: 'dinheiro', negativo: true,
      contagem: { dfc: dfcP.length, omie: totalP } },
    { id: 'despesas-pagas', nome: 'Desp. Pagas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcPagas.map((l) => modulo(l.valor))), tipo: 'dinheiro',
      contagem: { dfc: dfcPagas.length, omie: totalP } },
    { id: 'despesas-pendentes', nome: 'Desp. Pendentes', fonte: 'Omie recortado (principal) / DFC (confronto)',
      valor: somar(pendTodos.map((d) => Math.round(Number(d._resumo.nValAberto ?? 0) * 100))), tipo: 'dinheiro',
      semDfc: true, faltaLeitura: faltaCp.length > 0,
      contagem: { dfc: null, omie: pendTodos.length } },
    { id: 'despesas-funcionarios', nome: 'Desp. Funcionários', fonte: 'DFC (principal) / Omie recortado por categoria de pessoal (confronto)',
      valor: pessoalTotal, tipo: 'dinheiro',
      contagem: { dfc: dfcPessoal.length, omie: pessoalPagos.length } },
    { id: 'percentual-funcionarios', nome: '% D. Func. / Rec. Líquida', fonte: 'DFC nas duas pontas (principal) / a mesma razão no Omie recortado (confronto)',
      valor: receitaLiquida ? pessoalTotal / receitaLiquida : null, tipo: 'percentual',
      contagem: { dfc: dfcPessoal.length, omie: totalR } },
  ];

  const blocos = [
    { id: 'top-10-despesas', nome: 'Top 10 despesas', fonte: 'DFC (principal) / Omie recortado por centro de custo (confronto)',
      contagem: { dfc: dfcP.length, omie: totalP }, dados: top10Despesas },
    { id: 'top-10-receitas', nome: 'Top 10 receitas', fonte: 'Omie recortado (principal) / DFC (confronto)',
      contagem: { dfc: null, omie: totalR }, semDfc: true, dados: receitasComValor },
    { id: 'receita-despesa-por-dia', nome: 'Receita × despesa por dia', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: bloco?.colunas ?? 0, omie: totalR + totalP }, dados: dias },
    { id: 'receita-despesa-por-mes', nome: 'Receita × despesa por mês', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: serieOk.length, omie: totalR + totalP }, dados: meses },
  ];

  return {
    ano, mes,
    dfc: { ok: DFC.ok, motivo: DFC.motivo ?? null, arquivo: DFC.arquivo ?? null, fonte: fonte.nome },
    cartoes, blocos,
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela1 };
