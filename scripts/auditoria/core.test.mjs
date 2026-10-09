import test from 'node:test';
import assert from 'node:assert/strict';
import { lerCsvExtrato, lerOfxExtrato, reconciliar, estado, indicadoresDfc, chaveOmie, compararOmie, descreverOmie, compararCategorias } from './core.mjs';
import { dreIndependente } from './dre.mjs';

test('extrato CSV e OFX conservam sinal, data e centavos', () => {
  const c = lerCsvExtrato('data;valor;saldo;id\n2026-09-03;-1,25;8,75;abc\n', 'Itaú', '2026-09');
  const o = lerOfxExtrato('<STMTTRN><DTPOSTED>20260903<TRNAMT>-1.25<FITID>abc</STMTTRN><LEDGERBAL><BALAMT>8.75</LEDGERBAL>', 'Itaú', '2026-09');
  assert.equal(c[0].valor, o[0].valor);
  assert.equal(c[0].saldo, o[0].saldoFinal);
  assert.equal(lerCsvExtrato('data;valor;saldo\n2026-09-03;1.25;2.25\n', 'Itaú', '2026-09')[0].valor, 125);
  assert.equal(lerOfxExtrato('<LEDGERBAL><BALAMT>8.75<DTASOF>20260930</LEDGERBAL>', 'Itaú', '2026-09')[0].valor, 0);
  assert.throws(() => lerCsvExtrato('data;valor;saldo\n2026-08-03;1,00;2,00', 'Itaú', '2026-09'), /fora do mês/);
});

test('conciliação preserva multiplicidade e mostra diferença', () => {
  const linha = { n: 3, conta: 'ITAU--1', data: { a: 2026, m: 9, d: 3 }, movimento: -125 };
  const extrato = { conta: 'ITAU--1', data: '2026-09-03', valor: -125, saldo: 875, id: 'a' };
  const dfc = { linhas: [linha], brutas: [{ conta: 'ITAU--1', sub2: 'SALDO INICIAL', saldo: 1000, movimento: 100000 }] };
  assert.equal(reconciliar(dfc, [extrato]).confere, true);
  assert.equal(reconciliar({ ...dfc, linhas: [linha, { ...linha, n: 4 }] }, [extrato]).chavesDivergentes, 1);
  assert.equal(reconciliar(dfc, [{ ...extrato, saldo: 900 }]).saldosDivergentes, 1);
  assert.equal(reconciliar(dfc, [extrato], { provas: new Map([['ITAU--1', { cobreMesInteiro: false }]]) }).confere, false);
});

test('conciliação aceita lote do banco e data deslocada, e nada além disso', () => {
  const l = (n, d, movimento) => ({ n, conta: 'ITAU--1', data: { a: 2026, m: 8, d }, movimento });
  const dfc = { linhas: [l(3, 3, -100), l(4, 3, -50), l(5, 14, 20)], brutas: [{ conta: 'ITAU--1', sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const ext = [{ conta: 'ITAU--1', data: '2026-08-03', valor: -150, saldo: 850, id: 'lote' },
    { conta: 'ITAU--1', data: '2026-08-17', valor: 20, saldo: 870, id: 'depois' }];
  const r = reconciliar(dfc, ext);
  assert.equal(r.confere, true);
  assert.deepEqual(r.porConta.get('ITAU--1').tipos, { exato: 0, deslocado: 1, agrupado: 1, loteDoDia: 0, centavos: 0 });
  assert.deepEqual(r.casadas.get(3), ['lote']);
  const longe = reconciliar(dfc, [ext[0], { ...ext[1], data: '2026-08-25' }]);
  assert.equal(longe.confere, false);
  assert.deepEqual(longe.porConta.get('ITAU--1').soDfc, [5]);
});

test('lote dentro de cinco centavos casa e conserva a diferença; seis centavos não casa', () => {
  const linha = (n, movimento) => ({ n, conta: 'ITAU--1', data: { a: 2026, m: 8, d: 3 }, movimento });
  const dfc = { linhas: [linha(3, 100), linha(4, 50)], brutas: [{ conta: 'ITAU--1', sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const transacao = (id, valor, saldoFinal) => ({ id, conta: 'ITAU--1', data: '2026-08-06', valor, saldoFinal });
  const dentro = reconciliar(dfc, [transacao('a', 71), transacao('b', 81, 1152)]);
  assert.deepEqual(dentro.porConta.get('ITAU--1').diferencasCentavos,
    [{ linhas: [3, 4], transacoes: ['a', 'b'], diferenca: 2 }]);
  assert.deepEqual(dentro.porConta.get('ITAU--1').soDfc, []);
  assert.equal(dentro.confere, true);
  const fora = reconciliar(dfc, [transacao('a', 71), transacao('b', 85, 1156)]);
  assert.equal(fora.porConta.get('ITAU--1').tipos.centavos, 0);
  assert.deepEqual(fora.porConta.get('ITAU--1').soDfc, [3, 4]);
  assert.equal(fora.confere, false);
});

test('diferença de centavos fora da folga de data é apontada, sem casar', () => {
  const dfc = { linhas: [{ n: 409, conta: 'ITAU--1', data: { a: 2026, m: 8, d: 20 }, movimento: 100 }],
    brutas: [{ conta: 'ITAU--1', sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const ext = [51, 50].map((valor, i) => ({ id: String(i), conta: 'ITAU--1', data: '2026-08-25', valor }));
  const r = reconciliar(dfc, ext).porConta.get('ITAU--1');
  assert.deepEqual(r.soDfc, [409]);
  assert.deepEqual(r.pendenciasData, [{ linhas: [409], transacoes: ['0', '1'], diferenca: 1, dias: 5 }]);
});

test('recebimento de maquininha casa em cinco dias; PIX em cinco dias não casa', () => {
  const linha = { n: 409, conta: 'BANCO STONE--2', data: { a: 2026, m: 8, d: 20 },
    movimento: 100, sub2: 'RECEITA COM VENDAS' };
  const dfc = { linhas: [linha], brutas: [{ conta: linha.conta, sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const credito = (id, valor, historico) => ({ id, conta: linha.conta, data: '2026-08-25', valor, historico });
  const maquininha = reconciliar(dfc, [credito('a', 51, 'Crédito Transferência entre contas'),
    credito('b', 50, 'Crédito Transferência entre contas')]).porConta.get(linha.conta);
  assert.deepEqual(maquininha.datasMaquininha, [{ linhas: [409], transacoes: ['a', 'b'], dias: 5, diferenca: 1 }]);
  assert.deepEqual(maquininha.diferencasCentavos,
    [{ linhas: [409], transacoes: ['a', 'b'], diferenca: 1 }]);
  assert.deepEqual(maquininha.soDfc, []);
  const pix = reconciliar(dfc, [credito('a', 51, 'Crédito PIX recebido'),
    credito('b', 50, 'Crédito PIX recebido')]).porConta.get(linha.conta);
  assert.deepEqual(pix.datasMaquininha, []);
  assert.deepEqual(pix.soDfc, [409]);
  assert.deepEqual(pix.pendenciasData, [{ linhas: [409], transacoes: ['a', 'b'], diferenca: 1, dias: 5 }]);
});

test('um crédito de maquininha casa com duas vendas do DFC e expõe cada parcela', () => {
  const conta = 'BANCO STONE--2';
  const linha = (n, movimento) => ({ n, conta, data: { a: 2026, m: 8, d: 3 }, movimento, sub2: 'RECEITA COM VENDAS' });
  const dfc = { linhas: [linha(3, 100), linha(4, 50)],
    brutas: [{ conta, sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const credito = (valor, historico = 'Crédito Transferência entre contas') => ({
    id: 'c', conta, data: '2026-08-08', valor, saldo: 1000 + valor, historico,
  });
  const exato = reconciliar(dfc, [credito(150)]).porConta.get(conta);
  assert.deepEqual(exato.gruposMaquininha[0].linhas.map((l) => l.n), [3, 4]);
  assert.equal(exato.gruposMaquininha[0].diferenca, 0);
  assert.equal(exato.confere, true);
  const dentro = reconciliar(dfc, [credito(152)]).porConta.get(conta);
  assert.deepEqual(dentro.gruposMaquininha, [{ linhas: [{ n: 3, valor: 100 }, { n: 4, valor: 50 }],
    creditos: [{ id: 'c', valor: 152 }], diferenca: 2, dias: 5 }]);
  assert.deepEqual(dentro.soDfc, []);
  assert.deepEqual(dentro.soExtrato, []);
  assert.equal(dentro.confere, true);
  const fora = reconciliar(dfc, [credito(156)]).porConta.get(conta);
  assert.deepEqual(fora.gruposMaquininha, []);
  assert.deepEqual(fora.soDfc, [3, 4]);
  assert.deepEqual(fora.soExtrato, ['c']);
  for (const historico of ['PIX recebido', 'TED recebido'])
    assert.deepEqual(reconciliar(dfc, [credito(150, historico)]).porConta.get(conta).gruposMaquininha, []);
});

test('duas parcelas da Stone casam com uma venda; saída não ganha a janela da maquininha', () => {
  const conta = 'BANCO STONE--2';
  const dfc = { linhas: [{ n: 9, conta, data: { a: 2026, m: 8, d: 3 }, movimento: 150,
    sub2: 'RECEITA COM VENDAS' }], brutas: [{ conta, sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const credito = (id, valor) => ({ id, conta, data: '2026-08-08', valor,
    historico: 'Crédito Transferência entre contas' });
  const r = reconciliar(dfc, [credito('a', 70), credito('b', 80)]).porConta.get(conta);
  assert.deepEqual(r.gruposMaquininha, [{ linhas: [{ n: 9, valor: 150 }],
    creditos: [{ id: 'a', valor: 70 }, { id: 'b', valor: 80 }], diferenca: 0, dias: 5 }]);
  assert.deepEqual(r.soDfc, []);
  const saida = { ...dfc, linhas: [{ ...dfc.linhas[0], movimento: -150 }] };
  assert.deepEqual(reconciliar(saida, [credito('a', -70), credito('b', -80)]).porConta.get(conta).soDfc, [9]);
});

test('lote de maquininha já casado por centavos também expõe créditos e vendas', () => {
  const conta = 'BANCO STONE--2';
  const dfc = { linhas: [3, 4].map((n, i) => ({ n, conta, data: { a: 2026, m: 8, d: 3 },
    movimento: i ? 50 : 100, sub2: 'RECEITA COM VENDAS' })),
  brutas: [{ conta, sub2: 'SALDO INICIAL', saldo: 1000 }] };
  const ext = [71, 81].map((valor, i) => ({ id: String(i), conta, data: '2026-08-06', valor,
    historico: 'Crédito Transferência entre contas' }));
  const r = reconciliar(dfc, ext).porConta.get(conta);
  assert.deepEqual(r.gruposMaquininha, [{ linhas: [{ n: 3, valor: 100 }, { n: 4, valor: 50 }],
    creditos: [{ id: '0', valor: 71 }, { id: '1', valor: 81 }], diferenca: 2, dias: 3 }]);
});

test('nenhuma fonte ou extrato não vira conferido por coincidência', () => {
  assert.equal(estado(100, 100, 'faltam extratos').estado, 'não auditável');
  assert.equal(estado(100, 101, 'faltam extratos').estado, 'divergente');
  assert.deepEqual(estado(100, 101), { estado: 'divergente', diferenca: 1, motivo: null });
  assert.equal(estado(100, 100).estado, 'conferido');
});

test('DRE de caixa distingue receita, transferência, saída e dedução', () => {
  const l = (movimento, sub2, classe = '') => ({ movimento, sub2, classe, pagamento: 'PAGO' });
  const calculado = indicadoresDfc({ linhas: [l(1000, 'RECEITA COM VENDAS'), l(100, 'TRANSFERENCIAS BANCARIAS - RECEITA'), l(-200, 'DESPESAS PJ'), l(-50, 'DEVOLUCAO')] });
  assert.equal(calculado.get('saldo').valor, 850);
  assert.equal(calculado.get('receitas').valor, 1000);
  assert.equal(calculado.get('despesas').valor, 250);
  assert.equal(calculado.get('dre-deducoes').valor, 50);
});

test('DRE bruto elimina a baixa espelho e corta por data de pagamento', () => {
  const d = (grupo, pago) => ({ detalhes: { cGrupo: grupo, cNatureza: 'R', cCodCateg: '1.01.01',
    nCodCC: 100, nCodTitulo: 7, nCodMovCC: grupo === 'CONTA_CORRENTE_REC' ? 9 : undefined,
    nValorTitulo: 10, cStatus: 'RECEBIDO', dDtPagamento: pago }, resumo: { nValPago: 10 }, emp: '1' });
  const cru = { categorias: [{ emp: '1', codigo: '1.01.01', conta_receita: 'S', totalizadora: 'N' }],
    movimentos: [d('CONTA_A_RECEBER', '02/09/2026'), d('CONTA_CORRENTE_REC', '02/09/2026'), d('CONTA_A_RECEBER', '31/08/2026')] };
  const r = dreIndependente(cru, new Set(['1|100']), { linhas: [] }, '2026-09');
  assert.equal(r.get('dre-receitas').valor, 1000);
  assert.equal(r.get('dre-receitas').linhas.length, 1);
});

test('baixa em lote: um nCodMovCC com vários títulos não vira uma linha só', () => {
  const baixa = (titulo, baixaId, pago) => ({ emp: '1', resumo: { nValPago: pago }, detalhes: { cGrupo: 'CONTA_CORRENTE_PAG',
    cNatureza: 'P', cCodCateg: '2.02.01', nCodCC: 100, nCodMovCC: 55, nCodTitulo: titulo, nCodBaixa: baixaId,
    nValorMovCC: 30, cStatus: 'PAGO', dDtPagamento: '10/09/2026' } });
  const cru = { categorias: [{ emp: '1', codigo: '2.02.01', conta_despesa: 'S', codigo_dre: 'x' }, { emp: '1', codigo: '1.01.01' }],
    movimentos: [baixa(1, 11, 10), baixa(2, 12, 20)] };
  const r = dreIndependente(cru, new Set(['1|100']), { linhas: [] }, '2026-09');
  assert.equal(r.get('dre-despesas-gerais').valor, 3000);
  assert.equal(r.get('dre-despesas-gerais').linhas.length, 2);
});

test('sinal de cliente fica em aberto até a NF do pedido sair', async () => {
  const { sinaisDeClientes } = await import('./compromissos.mjs');
  const t = (cod, origem, extra) => ({ emp: '2', cabecTitulo: { nCodTitulo: cod, cOrigem: origem, nCodCC: 9, nCodOS: 77, nValorTitulo: 10, ...extra } });
  const titulos = [t(1, 'ADVR', { cStatus: 'RECEBIDO', dDtPagamento: '10/08/2026', cNumDocFiscal: '55' }),
    t(2, 'VENR', { cNumDocFiscal: '55', dDtEmissao: '05/09/2026' })];
  const pedidos = [{ emp: '2', cabecalho: { codigo_pedido: 77 }, infoCadastro: { faturado: 'S' } }];
  const ago = sinaisDeClientes({ titulos, pedidos, recorte: new Set(['2|9']), ano: 2026, mes: 8 });
  assert.deepEqual([ago.saldo, ago.inicio, ago.variacao], [1000, 0, 1000]);
  assert.equal(sinaisDeClientes({ titulos, pedidos, recorte: new Set(['2|9']), ano: 2026, mes: 9 }).saldo, 0);
});

test('saldo da CCB: principal vencido sai, juros correm desde a última parcela', async () => {
  const { saldoCcb } = await import('./documentos.mjs');
  const c = { financiado: 100000, taxa: 2, parcelas: [{ n: 1, venc: Date.UTC(2026, 7, 1), juros: 2000, principal: 0 },
    { n: 2, venc: Date.UTC(2026, 8, 1), juros: 2000, principal: 50000 }] };
  assert.equal(saldoCcb(c, Date.UTC(2026, 7, 31)), Math.round(100000 * 1.02 ** 1));
  assert.equal(saldoCcb(c, Date.UTC(2026, 8, 1)), 50000);
  assert.equal(saldoCcb(c, Date.UTC(2026, 6, 1)), null);
});

test('repetidas: transação própria, possível dobra e sem extrato', async () => {
  const { repetidasComProva } = await import('./core.mjs');
  const l = (n) => ({ n, conta: 'BANCO SAFRA--1', data: { a: 2026, m: 8, d: 20 }, movimento: 500, sub2: 'RECEITA EM SERVICOS' });
  const dfc = { linhas: [l(10), l(11)], brutas: [{ conta: 'BANCO SAFRA--1', sub2: 'SALDO INICIAL', saldo: 0, movimento: 0 }] };
  const t = (id) => ({ conta: 'BANCO SAFRA--1', data: '2026-08-20', valor: 500, id });
  assert.deepEqual(repetidasComProva(dfc, reconciliar(dfc, [t('a'), t('b')])).map((g) => g.veredito), ['transação própria']);
  assert.deepEqual(repetidasComProva(dfc, reconciliar(dfc, [t('a')])).map((g) => g.veredito), ['possível dobra']);
  assert.deepEqual(repetidasComProva(dfc, null).map((g) => g.veredito), ['sem extrato']);
});

test('Omie atual × cache: linhas de uma baixa em lote não colidem e a baixa retroativa aparece por título', () => {
  const lote = (titulo, baixa, pago) => ({ emp: '2', detalhes: { cGrupo: 'CONTA_CORRENTE_PAG', nCodMovCC: 900, nCodTitulo: titulo, nCodBaixa: baixa,
    dDtPagamento: '28/08/2026', cCodCateg: '2.04.01' }, resumo: { nValPago: pago } });
  const [a, b] = [lote(1, 11, 10), lote(2, 12, 20)];
  assert.notEqual(chaveOmie(a), chaveOmie(b));
  // A mesma baixa em lote, em ordem diferente nas páginas, não é alteração.
  const noMes = (x) => String(x.pagamento ?? x.vencimento ?? '').slice(3, 10) === '08/2026';
  assert.deepEqual(compararOmie([a, b], [b, a], noMes).alterados, []);
  // Título pago depois da gravação do cache: no cache estava atrasado; agora tem a linha do título e a da baixa.
  const titulo = (status, pagamento) => ({ emp: '1', detalhes: { cGrupo: 'CONTA_A_PAGAR', nCodTitulo: 7, cCodCateg: '2.01',
    dDtVenc: '25/08/2026', dDtPagamento: pagamento, cStatus: status }, resumo: { cLiquidado: pagamento ? 'S' : 'N' } });
  const baixa = { emp: '1', detalhes: { cGrupo: 'CONTA_CORRENTE_PAG', nCodMovCC: 8, nCodTitulo: 7, nCodBaixa: 9,
    cCodCateg: '2.01', dDtVenc: '25/08/2026', dDtPagamento: '25/08/2026', cStatus: 'PAGO' }, resumo: {} };
  const pago = titulo('PAGO', '25/08/2026');
  const mov = compararOmie([a, b, pago, baixa], [a, b], noMes);
  assert.deepEqual(mov.somenteAtual, [chaveOmie(pago), chaveOmie(baixa)]);
  const pend = compararOmie([pago], [titulo('ATRASADO', undefined)], (x) => x.vencimento?.slice(3, 10) === '08/2026');
  assert.deepEqual(pend.alterados[0].campos, ['pagamento', 'status', 'liquidado']);
  assert.equal(descreverOmie(pago), 'empresa 1, título 7 (CONTA_A_PAGAR), categoria 2.01, vencimento 25/08/2026, pagamento 25/08/2026, status PAGO');
});

test('categorias atual × cache: conta do DRE preenchida depois da gravação aparece, marcada se tem lançamento', () => {
  const cache = [{ emp: '1', codigo: '2.08.01', codigo_dre: '', conta_despesa: 'S' }, { emp: '1', codigo: '2.01', codigo_dre: '' }];
  const atual = [{ emp: '1', codigo: '2.08.01', codigo_dre: '2.01.01', conta_despesa: 'S' }, { emp: '1', codigo: '2.01', codigo_dre: '' }];
  assert.deepEqual(compararCategorias(atual, cache, new Set(['1|2.08.01'])), [{ emp: '1', codigo: '2.08.01', campos: ['codigo_dre'],
    usada: true, antes: { codigo_dre: '' }, depois: { codigo_dre: '2.01.01' } }]);
});
