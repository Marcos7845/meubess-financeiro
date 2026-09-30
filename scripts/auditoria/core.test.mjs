import test from 'node:test';
import assert from 'node:assert/strict';
import { lerCsvExtrato, lerOfxExtrato, reconciliar, estado, indicadoresDfc } from './core.mjs';
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
  const linha = { banco: 'ITAU', bloco: 1, data: { a: 2026, m: 9, d: 3 }, movimento: -125 };
  const extrato = { conta: 'ITAU--1', data: '2026-09-03', valor: -125, saldo: 875 };
  const dfc = { linhas: [linha], brutas: [{ banco: 'ITAU', bloco: 1, saldo: 1000, movimento: 0 }] };
  assert.equal(reconciliar(dfc, [extrato]).confere, true);
  assert.equal(reconciliar({ ...dfc, linhas: [linha, linha] }, [extrato]).chavesDivergentes, 1);
  assert.equal(reconciliar(dfc, [{ ...extrato, saldo: 900 }]).saldosDivergentes, 1);
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
