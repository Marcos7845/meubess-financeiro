import test from 'node:test';
import assert from 'node:assert/strict';
import { limparDescricao, sugerirClassificacoes, compararComDfc } from './jev.mjs';

test('limpeza local remove valor, data, CNPJ, CPF, conta, agência, banco, documento e nome inventados', () => {
  const texto = 'Pagamento ALUGUEL para João Silva, R$ 1.234,56 em 18/08/2026; CNPJ 12.345.678/0001-90; CPF 123.456.789-09; conta 12345-6 agência 0999; Banco Jacarandá; doc NF-8457';
  assert.equal(limparDescricao(texto), 'PAGAMENTO ALUGUEL');
  assert.equal(limparDescricao('PIX Ana Pereira 11/08/2026 R$ 50,00'), 'PIX');
  assert.equal(limparDescricao(''), null);
});

test('códigos bancários novos seguem sem dados pessoais ou financeiros', () => {
  const casos = [
    ['PIX RECEBIDO de Ana Pereira, CPF 123.456.789-09, 18/08/2026, R$ 51,70', 'PIX RECEBIDO'],
    ['PAGAMENTOS BOLETO Banco Jacarandá agência 0999 conta 12345-6 documento 8457', 'PAGAMENTOS BOLETO'],
    ['TED para Carlos Oliveira CNPJ 12.345.678/0001-90 valor 940,00', 'TED'],
    ['TARIFA DOC NF-8457 Banco Jacarandá em 19/08/2026', 'TARIFA'],
    ['BOLETOS DARF de Beatriz Monteiro, 20/08/2026', 'BOLETOS DARF'],
    ['DEBITO SEGURO para Diana Nogueira, conta 00321', 'DEBITO SEGURO'],
  ];
  for (const [bruta, esperado] of casos) {
    const limpa = limparDescricao(bruta);
    assert.equal(limpa, esperado);
    assert.match(limpa, /^[A-Z ]+$/);
    for (const segredo of ['Ana', 'Pereira', 'Carlos', 'Oliveira', 'Beatriz', 'Monteiro', 'Diana', 'Nogueira',
      'Jacarandá', '123', '2026', '8457', '0999', '51', '940']) assert.ok(!limpa.includes(segredo));
  }
});

test('requisição tipada contém apenas descrição limpa e categorias, sem histórico bruto', async () => {
  const bruto = 'Tarifa para Maria Souza no Banco Jacarandá, conta 12345-6, R$ 12,00 em 19/08/2026';
  let requisicao;
  const fetcher = async (_url, args) => {
    requisicao = args;
    return { ok: true, json: async () => ({ answers: { categoria: { choice: 'c1', confidence: 0.91 } } }) };
  };
  const r = await sugerirClassificacoes([bruto, bruto], ['TARIFAS BANCARIAS'], { chave: 'chave-ficticia', fetcher });
  const corpo = JSON.parse(requisicao.body);
  assert.deepEqual(corpo.state, { message: 'TARIFA' });
  assert.equal(corpo.model, 'typesafe/jev-1.13');
  assert.equal(corpo.questions.categoria.type, 'choice');
  assert.equal(r.estatisticas.chamadas, 1);
  assert.equal(r.estatisticas.caracteres, 6);
  assert.equal(r.estatisticas.lancamentosEnviados, 2);
  assert.deepEqual(r.resultados.get('TARIFA'), { categoria: 'TARIFAS BANCARIAS', confianca: 0.91 });
  for (const segredo of ['Maria', 'Souza', 'Jacarandá', '12345', '12,00', '19/08/2026']) assert.ok(!requisicao.body.includes(segredo));
});

test('sem chave ou erro segue não classificado e mede somente tentativas', async () => {
  const semChave = await sugerirClassificacoes(['TARIFA'], ['TARIFAS BANCARIAS'], { chave: '' });
  assert.deepEqual(semChave.estatisticas, { chamadas: 0, caracteres: 0, lancamentosEnviados: 0 });
  const falha = await sugerirClassificacoes(['TARIFA'], ['TARIFAS BANCARIAS'], { chave: 'ficticia', fetcher: async () => { throw Error('erro secreto'); } });
  assert.equal(falha.resultados.get('TARIFA'), null);
  assert.deepEqual(falha.estatisticas, { chamadas: 1, caracteres: 6, lancamentosEnviados: 1 });
});

test('concordância usa somente par único com DFC e marca revisão pelo limiar', () => {
  const dfc = { linhas: [{ n: 3, conta: 'ITAU--1', sub2: 'TARIFAS BANCARIAS' }, { n: 4, conta: 'ITAU--1', sub2: 'ALUGUEL' }] };
  const extratos = [{ conta: 'ITAU--1', id: 'a', valor: -1, historico: 'Tarifa' },
    { conta: 'ITAU--1', id: 'b', valor: -2, historico: 'Aluguel' }];
  const resultados = new Map([['TARIFA', { categoria: 'TARIFAS BANCARIAS', confianca: 0.9 }],
    ['ALUGUEL', { categoria: 'TARIFAS BANCARIAS', confianca: 0.7 }]]);
  const r = compararComDfc(dfc, extratos, { casadas: new Map([[3, ['a']], [4, ['b']]]) }, resultados, 0.8);
  assert.deepEqual([r.avaliadas, r.concordantes, r.baixaConfianca, r.naoClassificadas], [2, 1, 1, 0]);
  assert.equal(r.categorias.find((c) => c.categoria === 'ALUGUEL').concordantes, 0);
});

test('dia e valor únicos identificam par sem conciliação; duplicatas ficam sem verdade', () => {
  const l = (n, valor, sub2) => ({ n, conta: 'ITAU--1', data: { a: 2026, m: 8, d: 4 }, movimento: valor, sub2 });
  const e = (id, valor) => ({ id, conta: 'ITAU--1', data: '2026-08-04', valor, historico: 'PIX RECEBIDO' });
  const dfc = { linhas: [l(3, 100, 'RECEITA COM VENDAS'), l(4, 200, 'OUTRAS RECEITAS'), l(5, 200, 'OUTRAS RECEITAS')] };
  const resultados = new Map([['PIX RECEBIDO', { categoria: 'RECEITA COM VENDAS', confianca: 0.9 }]]);
  const r = compararComDfc(dfc, [e('a', 100), e('b', 200), e('c', 200)], null, resultados);
  assert.deepEqual([r.avaliadas, r.concordantes, r.paresPorDiaValor, r.paresPorConciliacao], [1, 1, 1, 0]);
  assert.deepEqual(r.linhas.map((x) => x.linhaDfc), [3, null, null]);
});

test('id de extrato repetido não reutiliza linha do DFC na comparação', () => {
  const dfc = { linhas: [{ n: 3, conta: 'ITAU--1', data: { a: 2026, m: 8, d: 4 }, movimento: 100, sub2: 'RECEITA COM VENDAS' }] };
  const extratos = [4, 5].map((dia) => ({ id: 'mesmo-id', conta: 'ITAU--1', data: `2026-08-0${dia}`, valor: 100, historico: 'PIX RECEBIDO' }));
  const resultados = new Map([['PIX RECEBIDO', { categoria: 'RECEITA COM VENDAS', confianca: 0.9 }]]);
  const r = compararComDfc(dfc, extratos, { casadas: new Map([[3, ['mesmo-id']]]) }, resultados);
  assert.deepEqual(r.linhas.map((x) => x.linhaDfc), [3, null]);
});
