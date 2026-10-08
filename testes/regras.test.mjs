// A BANCADA DAS REGRAS — `node --test testes/regras.test.mjs`, parte do `npm test`.
//
// Roda as regras de `lib/regras/` contra as fixtures de `testes/fixtures/` (inventadas por `gerar-fixtures.mjs`, sem
// dinheiro real e sem nada copiado de `.cache/`, `dados/` ou da pasta do DFC). Não lê `.env`, não abre `.cache/`, não
// chama a rede: roda igual num clone limpo e no CI. O esperado de cada caso está escrito à mão a partir das linhas da
// fixture; divergência é defeito da regra ou da fixture, nunca motivo para trocar o número esperado.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
process.env.OMIE_CACHE_DIR = path.join(FIXTURES, 'omie');

const { abrirCacheOmie } = await import('../lib/regras/cache-omie.mjs');
const { lerRecorte, lerContas, criarRegras, valorOmie, TRANSFERENCIA_SEM_MARCA } = await import('../lib/regras/movimentos.mjs');
const { contasBancarias, filtroDeConta, mesesDoFluxo } = await import('../lib/regras/filtros.mjs');
const { selecionarSaidas, titulosAPagarNoMes } = await import('../lib/regras/saidas.mjs');

test('Fluxo: link antigo escolhe um mês e meses prevalece quando presente', () => {
  assert.deepEqual(mesesDoFluxo({ ano: '2026', mes: '9' }, 8), [9]);
  assert.deepEqual(mesesDoFluxo({ mes: '9', meses: '8,9' }, 7), [8, 9]);
  assert.deepEqual(mesesDoFluxo({ meses: ['9', '8', '8'] }, 7), [8, 9]);
  assert.deepEqual(mesesDoFluxo({}, 7), [7]);
});

test('A pagar: só CP do recorte, vencido no mês e sem baixa; Saiu segue as linhas pagas', () => {
  const titulo = (id, { conta = 11, venc = '10/09/2026', status = 'EMABERTO', liquidado = 'N' } = {}) => ({
    detalhes: { nCodTitulo: id, nCodCC: conta, dDtVenc: venc, cStatus: status, cCodCateg: '2.01' },
    resumo: { cLiquidado: liquidado, nValAberto: 30 },
  });
  const movimentos = [titulo(1), titulo(2, { conta: 22 }), titulo(3, { venc: '10/10/2026' }),
    titulo(4, { status: 'CANCELADO' }), titulo(5, { liquidado: 'S' }),
    titulo(6, { status: 'PAGTOPARCIAL' })];
  const filtrar = (empresa, conta) => titulosAPagarNoMes(movimentos, {
    empresa, recorte: new Set(['1|11']), noMes: (d) => d.endsWith('/09/2026'),
    conta: { pega: (_e, cod) => !conta || cod === conta },
    categoria: { ativo: false }, fornecedor: { pega: () => true },
  }).map((d) => d.nCodTitulo);
  assert.deepEqual(filtrar('1'), [1, 6], 'o saldo de título pago em parte continua a pagar');
  assert.deepEqual(filtrar('2'), []);
  assert.deepEqual(filtrar('1', 22), []);
  const pagas = [{ natureza: 'P', pagamento: 'PAGO', banco: 'ITAU', valor: -500, linha: 1 }];
  assert.equal(selecionarSaidas({ linhas: pagas }).valor, 500);
  assert.equal(selecionarSaidas({ situacao: 'a-pagar', linhas: pagas, pendentes: { valor: 3000, contagem: { omie: 1 } } }).valor, 3000);
});
const { lerDfc, eReceitaTela1Dfc, serieDoFluxo } = await import('../lib/regras/dfc.mjs');
const { eDeConsulta, chamarOmie } = await import('../lib/regras/omie-api.mjs');
const { leiturasDasTelas } = await import('../lib/regras/omie-releitura.mjs');

// ---------------------------------------------------------------- as fontes de mentira

const cache = abrirCacheOmie({ raiz: FIXTURES, ano: 2026 });
const recorte = lerRecorte(FIXTURES);
const regras = criarRegras({ movimentos: cache.movimentos, categorias: cache.categorias, recorte });
const agosto = (data) => /^\d{2}\/08\/2026$/.test(String(data ?? ''));
const codigos = (b) => ({
  titulos: [...b.titulos.keys()].sort(), baixas: [...b.baixas.keys()].sort(), avulsos: [...b.avulsos.keys()].sort(),
});

const PASTA_DFC = path.join(FIXTURES, 'dfc');
const fonte = {
  disponivel: () => true,
  descrever: () => 'fixture',
  arquivos: async () => fs.readdirSync(PASTA_DFC),
  ler: async (nome) => fs.readFileSync(path.join(PASTA_DFC, nome)),
};
const dfc = await lerDfc({ fonte, ano: 2026, mes: 8, comSerie: false });
const bloco = (n) => dfc.saldosPorBanco.find((b) => b.bloco === n);

// ---------------------------------------------------------------- recorte de conta

test('recorte de conta: só as contas da MeuBESS entram, pela chave empresa|nCodCC', () => {
  assert.deepEqual([...recorte].sort(), ['1|111', '2|222']);
  const b1 = regras.base('1', agosto);
  assert.ok(b1.linhas.every((d) => d.nCodCC === 111), 'a conta 999 (outro negócio) fica fora');
  // A conta 111 existe na empresa 2, mas a chave 2|111 não é da MeuBESS: o recorte é por empresa e conta juntas.
  assert.deepEqual(regras.base('2', agosto).linhas.map((d) => d.nCodMovCC), [9101]);
});

test('recorte de conta: cancelado e lançamento fora do período ficam fora da base', () => {
  const b1 = regras.base('1', agosto);
  assert.ok(!b1.linhas.some((d) => d.nCodTitulo === 3), 'título cancelado');
  assert.ok(!b1.linhas.some((d) => d.nCodMovCC === 9008), 'pago em julho');
});

test('recorte de conta: o filtro de conta bancária junta as duas empresas pelo nome dito pelo dono', () => {
  const opcoes = contasBancarias(lerContas(FIXTURES));
  assert.deepEqual(opcoes, [{ nome: 'Banco A', codigos: { 1: ['111'], 2: ['222'] } }]);
  const { conta } = filtroDeConta({ conta: 'Banco A' }, opcoes);
  assert.equal(conta.ativo, true);
  assert.equal(conta.pega('1', 111), true);
  assert.equal(conta.pega('2', 222), true);
  assert.equal(conta.pega('1', 999), false);
  assert.deepEqual(filtroDeConta({ conta: 'Banco Z' }, opcoes).conta.desconhecidos, ['Banco Z'], 'conta de outro negócio não é opção');
  const filtrado = regras.contar('1', agosto, 'R', { linha: (d) => conta.pega('1', d.nCodCC) });
  assert.equal(filtrado.total, regras.contar('1', agosto, 'R').total, 'na empresa 1 só a 111 sobra, e ela é do Banco A');
});

// ---------------------------------------------------------------- transferência

test('transferência: no Omie sai pela marca do cadastro e pela lista sem marca, por empresa', () => {
  assert.equal(regras.eTransferencia('1', '1.05.01'), true, 'marca transferencia = "S"');
  assert.equal(regras.eTransferencia('1', '1.04.97'), true, 'sem marca, empresa 1');
  assert.equal(regras.eTransferencia('2', '1.04.97'), false, 'na empresa 2 o mesmo código é outra receita');
  assert.ok(!TRANSFERENCIA_SEM_MARCA[2].includes('1.04.97'));
  assert.deepEqual(codigos(regras.contar('1', agosto, 'R')).avulsos, [9002]);
  assert.deepEqual(codigos(regras.contar('1', agosto, 'R', { comTransferencia: false })).avulsos, [9002, 9003, 9004]);
  assert.equal(regras.contar('2', agosto, 'R').total, 1, 'a 1.04.97 da empresa 2 conta');
});

test('transferência: no DFC a linha de TRANSFERENCIAS BANCARIAS - RECEITA não é receita da Tela 1', () => {
  const transferencia = dfc.linhas.find((l) => l.linha === 5);
  assert.equal(transferencia.natureza, 'R');
  assert.equal(eReceitaTela1Dfc(transferencia), false);
  assert.deepEqual(dfc.linhas.filter(eReceitaTela1Dfc).map((l) => l.linha), [4, 11]);
  const dias = serieDoFluxo(dfc.linhas, 2026, 8);
  assert.equal(dias[3].entradas, 0, 'dia 4: só a transferência, que não entra');
  assert.equal(dias[2].entradas, 20000);
});

// ---------------------------------------------------------------- adiantamento

test('adiantamento: ADCR sai, e o título com ADCP sai junto com a baixa dele', () => {
  const b1 = regras.base('1', agosto);
  assert.deepEqual([...b1.adcp], [10]);
  const pagar = regras.contar('1', agosto, 'P');
  const c = codigos(pagar);
  assert.deepEqual(c.titulos, [11]);
  assert.ok(!c.avulsos.includes(9005), 'ADCR');
  assert.ok(!c.baixas.includes(9006), 'baixa do título com ADCP');
  assert.deepEqual(c.baixas, [9007], 'baixa de título quitado só em parte, sem o título na leitura, entra');
  assert.equal(pagar.total, 2);
});

test('adiantamento: título baixado conta uma vez só, e o valor vem do campo certo', () => {
  const receber = regras.contar('1', agosto, 'R');
  assert.deepEqual(codigos(receber), { titulos: [1], baixas: [], avulsos: [9002] });
  const porCodigo = new Map(receber.todos.map((d) => [d.nCodTitulo || d.nCodMovCC, valorOmie(d)]));
  assert.equal(porCodigo.get(1), 10000, 'título: nValorTitulo, em centavos');
  assert.equal(porCodigo.get(9002), 3000, 'avulso: nValPago, em centavos');
});

// ---------------------------------------------------------------- saldo corrido

test('saldo corrido: as linhas que entram no fluxo são as baixadas, com movimento e no mês', () => {
  assert.equal(dfc.ok, true);
  assert.deepEqual(dfc.linhas.map((l) => l.linha), [4, 5, 6, 11, 12]);
  assert.deepEqual(dfc.linhas.map((l) => l.valor), [20000, 5000, -3000, 10000, -4000]);
});

test('saldo corrido: bloco que fecha, com não baixado e movimento depois do último saldo escrito', () => {
  const a = bloco(1);
  assert.equal(a.banco, 'BANCO A');
  assert.equal(a.abertura, 100000);
  assert.equal(a.linhaAbertura, 3);
  assert.equal(a.final, 120000);
  assert.equal(a.linhaFinal, 7);
  assert.equal(a.movimentoUsado, 22000);
  assert.equal(a.naoBaixado, -1500, 'a linha A PAGAR (−20) e a de julho (+5)');
  assert.equal(a.linhasNaoBaixado, 2);
  assert.equal(a.depoisDoUltimoSaldo, 500);
  assert.equal(a.desvios, 0);
  assert.equal(a.fecha, true);
  assert.equal(a.abertura + a.movimento, a.final + a.depoisDoUltimoSaldo, 'a ponte do saldo fecha');
});

test('saldo corrido: bloco sem linha de abertura e com desvio reancora no saldo escrito', () => {
  const b = bloco(2);
  assert.equal(b.abertura, 50000, 'saldo da primeira linha menos o movimento dela');
  assert.equal(b.final, 57000, 'reancora no SALDO escrito, não no esperado de 56000');
  assert.equal(b.desvios, 1);
  assert.equal(b.fecha, false);
});

// ---------------------------------------------------------------- só consulta

test('só consulta: o guarda aceita só Listar, Pesquisar, Consultar e Obter', () => {
  for (const call of ['ListarMovimentos', 'PesquisarLancamentos', 'ConsultarCliente', 'ObterDocumento']) assert.equal(eDeConsulta(call), true, call);
  for (const call of ['IncluirLancamento', 'AlterarCliente', 'ExcluirContaReceber', 'UpsertPedido', 'LancarPagamento', 'listarMovimentos', '']) assert.equal(eDeConsulta(call), false, call);
});

test('só consulta: método de escrita é barrado antes do fetch, e nenhuma chamada sai', async (t) => {
  const chamadas = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { chamadas.push(args); throw new Error('a bancada não chama a rede'); });
  for (const call of ['IncluirLancamento', 'AlterarCliente', 'ExcluirContaReceber']) {
    await assert.rejects(
      chamarOmie({ raiz: FIXTURES, emp: '1', servico: 'financas/mf', call, param: {}, forcar: true, gravar: false }),
      /não é método de consulta/,
    );
  }
  assert.equal(chamadas.length, 0);
  // Uma consulta que está no cache volta dele, sem rede nenhuma.
  const { json, doOmie } = await chamarOmie({ raiz: FIXTURES, emp: '1', servico: 'financas/mf', call: 'ListarMovimentos', param: cache.leituras.MF(1) });
  assert.equal(doOmie, false);
  assert.equal(json.movimentos.length, cache.movimentos['1'].length);
  assert.equal(chamadas.length, 0);
});

test('só consulta: toda leitura que a releitura das telas pede é de consulta', () => {
  const leituras = leiturasDasTelas(2026);
  assert.ok(leituras.length > 0);
  for (const l of leituras) assert.equal(eDeConsulta(l.call), true, `${l.servico} ${l.call}`);
});
