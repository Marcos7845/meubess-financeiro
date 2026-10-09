// OS VALORES PLOTADOS NÃO MUDARAM COM O ESTILO NOVO DOS GRÁFICOS (08/10/2026).
//
// Cada "antes" abaixo é a conta que o componente fazia DENTRO de `app/graficos.js` até 07/10/2026, copiada sem
// mudança; o "depois" é `app/graficos-dados.mjs`, de onde o componente passou a tirar os dados. Os dois recebem a mesma
// entrada, com valores inventados (nenhum número real entra em arquivo versionado), e têm de devolver o mesmo.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESES_CURTOS, dadosAnoInteiro, dadosDiaADia, dadosFluxo, dadosMargem, dadosPesoNaReceita, dadosPorCliente,
  dadosPorMes, dadosRankingDespesa, dadosRankingReceita, linhasDaDica, pontosDeDestaque,
} from '../app/graficos-dados.mjs';

// ------------------------------------------------ o código de antes (verbatim de app/graficos.js @ 732ff97)
const FAIXAS = [{ chave: 'pago', nome: 'pago' }, { chave: 'atrasado', nome: 'atrasado' }, { chave: 'aberto', nome: 'em aberto' }];
const antes = {
  anoInteiro: (meses) => meses.map((m) => ({ rotulo: MESES_CURTOS[m.mes], receita: m.entradas, despesa: m.gastos })),
  diaADia: (dias) => dias.map((d) => ({ rotulo: String(d.dia), receita: d.entradas, despesa: d.gastos })),
  despesa: (itens) => itens.map((i) => ({ chave: i.nome, valor: i.valor })),
  receita: (itens) => itens.map((i, n) => ({
    chave: String(n), valor: i.valor,
    nome: i.cliente.nome ?? `cliente ${i.cliente.codigo}`, codigo: i.cliente.codigo,
  })),
  margem: (serie) => serie.map((x) => ({ rotulo: MESES_CURTOS[x.mes], margem: x.valor })),
  peso: (linhas) => linhas.map((l, n) => ({ chave: String(n), rotulo: l.rotulo, valor: l.av })),
  porCliente: (clientes) => clientes.map((c, n) => ({
    chave: String(n), nome: c.nome ?? `cliente ${c.codigo}`, codigo: c.codigo,
    ...Object.fromEntries(FAIXAS.map((f) => [f.chave, c[f.chave]])),
  })),
  porMes: (porMes) => porMes.map((x) => ({
    rotulo: MESES_CURTOS[x.mes], total: x.total,
    ...Object.fromEntries(FAIXAS.map((f) => [f.chave, x[f.chave]])),
  })),
  fluxo: (dias, hoje) => {
    const dados = dias.map((d) => ({
      rotulo: d.rotulo ?? String(d.dia),
      entrou: d.entrou || null, aReceber: d.aReceber || null, saiu: d.saiu ? -d.saiu : null, aPagar: d.aPagar ? -d.aPagar : null,
      posicao: d.fase === 'previsao' ? null : d.acumulado,
      posicaoPrevista: d.fase === 'consolidado' ? null : d.acumulado,
    }));
    if (!hoje && dados.length && dias.every((d) => d.fase === 'previsao')) for (const x of dados) x.posicao = null;
    return dados;
  },
};

// ------------------------------------------------ entradas inventadas (centavos)
const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, entradas: 1_000_00 * (i + 3) % 777_700, gastos: i % 4 === 0 ? 0 : 55_500 * (i + 1) }));
const dias = Array.from({ length: 31 }, (_, i) => ({ dia: i + 1, entradas: i % 3 ? 0 : 12_345_00 + i, gastos: i % 5 ? 9_870 * i : 0 }));
const dias2 = (fase, hoje) => Array.from({ length: 10 }, (_, i) => ({
  dia: i + 1, rotulo: i % 2 ? `${i + 1}/05` : undefined,
  fase: !hoje ? fase : (i + 1 < hoje ? 'consolidado' : i + 1 === hoje ? 'hoje' : 'previsao'),
  entrou: i % 2 ? 1_100 * i : 0, aReceber: i % 3 ? 0 : 777 * i, saiu: i % 4 ? 0 : 5_000 + i, aPagar: i % 5 ? 0 : 42 * i,
  acumulado: (i - 4) * 31_337,
}));

test('Tela 1: ano inteiro, dia a dia e os dois rankings', () => {
  assert.deepEqual(dadosAnoInteiro(meses), antes.anoInteiro(meses));
  assert.deepEqual(dadosDiaADia(dias), antes.diaADia(dias));
  const desp = [{ nome: 'Folha', valor: 100 }, { nome: 'Aluguel', valor: 60 }, { nome: 'Folha', valor: 5 }];
  assert.deepEqual(dadosRankingDespesa(desp), antes.despesa(desp));
  const rec = [
    { valor: 90, cliente: { nome: 'Cliente A', codigo: 11 } },
    { valor: 70, cliente: { nome: null, codigo: 12 } },
    { valor: 70, cliente: { nome: 'Cliente A', codigo: 13 } },
  ];
  assert.deepEqual(dadosRankingReceita(rec), antes.receita(rec));
});

test('Tela 2: margem mês a mês e peso sobre a receita', () => {
  const serie = meses.map((m) => ({ mes: m.mes, valor: m.mes % 3 ? -0.125 * m.mes : null }));
  assert.deepEqual(dadosMargem(serie), antes.margem(serie));
  const linhas = [{ rotulo: '(+) Receitas', av: 1 }, { rotulo: '(−) Deduções', av: -0.08 }, { rotulo: '(=) Lucro', av: null }];
  assert.deepEqual(dadosPesoNaReceita(linhas), antes.peso(linhas));
});

test('Tela 3: por cliente, por mês e fluxo de caixa dia a dia', () => {
  const clientes = [
    { nome: 'Cliente A', codigo: 1, pago: 10, atrasado: 20, aberto: 30 },
    { nome: null, codigo: 2, pago: 0, atrasado: 5, aberto: 0 },
  ];
  assert.deepEqual(dadosPorCliente(clientes), antes.porCliente(clientes));
  const porMes = meses.map((m) => ({ mes: m.mes, total: 6, pago: 1, atrasado: 2, aberto: 3 }));
  assert.deepEqual(dadosPorMes(porMes), antes.porMes(porMes));
  for (const [fase, hoje] of [['consolidado', 0], ['previsao', 0], ['previsao', 5], ['consolidado', 10]]) {
    const d = dias2(fase, hoje || undefined);
    assert.deepEqual(dadosFluxo(d, hoje || null), antes.fluxo(d, hoje || null));
  }
});

test('o fluxo de um mês à frente (sem hoje) fica com a posição toda nula', () => {
  const d = dias2('previsao', undefined);
  assert.ok(dadosFluxo(d, null).every((x) => x.posicao === null));
});

test('pontos de destaque: maior, menor e selecionado — e nada mais', () => {
  assert.deepEqual([...pontosDeDestaque([3, 9, 1, 5], 3)].sort(), [1, 2, 3]);
  assert.deepEqual([...pontosDeDestaque([3, 9, 1, 5])].sort(), [1, 2]);
  // Série toda igual (tudo zero): não há máximo nem mínimo a destacar; só o selecionado fica.
  assert.deepEqual([...pontosDeDestaque([0, 0, 0], 1)], [1]);
  assert.deepEqual([...pontosDeDestaque([0, 0, 0])], []);
  // Lacunas não contam, nem como máximo nem como mínimo.
  assert.deepEqual([...pontosDeDestaque([null, 4, undefined, 2, NaN])].sort(), [1, 3]);
  assert.deepEqual([...pontosDeDestaque([])], []);
  // Valor negativo (prejuízo) entra normalmente.
  assert.deepEqual([...pontosDeDestaque([-5, 2, -1])].sort(), [0, 1]);
});

test('o quadro da dica: só as séries de verdade, uma linha por série, sem lacuna e sem tocar no valor', () => {
  // O que o Recharts entrega no Fluxo de Caixa: áreas e contornos auxiliares ("none") repetem a posição de caixa.
  const aux = (dataKey, value) => ({ dataKey, name: dataKey, type: 'none', value });
  const payload = [
    aux('posicao', 11), aux('posicaoPrevista', null),
    { dataKey: 'entrou', name: 'Entrou', value: 223 },
    { dataKey: 'aReceber', name: 'A receber (previsão)', value: null },
    { dataKey: 'saiu', name: 'Saiu', value: -1077 },
    { dataKey: 'aPagar', name: 'A pagar (previsão)', value: undefined },
    aux('posicao', 12), aux('posicaoPrevista', null), aux('posicao', 13),
    { dataKey: 'posicao', name: 'Posição de caixa', value: 327 },
    { dataKey: 'posicao', name: 'Posição de caixa', value: 328 },
    { dataKey: 'posicaoPrevista', name: 'Posição de caixa (prevista)', value: null },
    { dataKey: 'oculta', name: 'x', value: 5, hide: true },
  ];
  const linhas = linhasDaDica(payload);
  assert.deepEqual(linhas.map((p) => [p.name, p.value]), [['Entrou', 223], ['Saiu', -1077], ['Posição de caixa', 327]]);
  // Zero é valor (um dia sem movimento continua na dica); lista vazia ou ausente não quebra.
  assert.equal(linhasDaDica([{ dataKey: 'receita', name: 'receita', value: 0 }]).length, 1);
  assert.deepEqual(linhasDaDica(undefined), []);
});
