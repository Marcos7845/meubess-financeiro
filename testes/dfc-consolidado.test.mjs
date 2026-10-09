import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { lerDfc, deduzirN3, saidasPagasDoDfc, eReceitaTela1Dfc, conferirCasoDfc } from '../lib/regras/dfc.mjs';
import { selecionarSaidas } from '../lib/regras/saidas.mjs';
import { novaBase } from '../lib/regras/base-local.mjs';

// Planilhas pequenas, inventadas e montadas na memória; nenhuma cópia do financeiro entra no teste.
function zip(arquivos) {
  const locais = [], centrais = [];
  let offset = 0;
  for (const [nome, conteudo] of arquivos) {
    const n = Buffer.from(nome), d = Buffer.from(conteudo), crc = zlib.crc32(d);
    const l = Buffer.alloc(30), c = Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(d.length, 18); l.writeUInt32LE(d.length, 22); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(d.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    locais.push(l, n, d); centrais.push(c, n); offset += l.length + n.length + d.length;
  }
  const central = Buffer.concat(centrais), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(central.length, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, central, fim]);
}
const esc = (s) => String(s).replaceAll('&', '&amp;');
const celula = (col, n, v) => typeof v === 'number'
  ? `<c r="${col}${n}"><v>${v}</v></c>`
  : `<c r="${col}${n}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
const cabecalho = ['BANCO', 'PAGAMENTO', 'VENCIMENTO', 'DIA PG', 'FORNECEDOR / CLIENTE', 'TITULO', 'CLASS. CONTABIL', 'SUB 2', 'ENTRADA', 'SAIDA', 'SALDO'];
const cols = 'CDEFGHIJKLM';
function arquivo(blocos, { saldoFinal = false, mes = 8 } = {}) {
  const dia = Math.round((Date.UTC(2026, mes - 1, 5) - Date.UTC(1899, 11, 30)) / 86400000);
  let n = 1;
  const rows = [];
  for (const [banco, movimentos] of blocos) {
    rows.push(`<row r="${++n}">${celula('B', n, banco)}</row>`);
    rows.push(`<row r="${++n}">${cabecalho.map((v, i) => celula(cols[i], n, v)).join('')}</row>`);
    for (const [historico, valor] of movimentos) {
      rows.push(`<row r="${++n}">${[
        celula('C', n, banco.replace(/^BANCO /, '')), celula('D', n, 'PAGO'), celula('F', n, dia),
        celula('H', n, historico), celula('I', n, 'DESPESA PJ'), celula('J', n, 'DESPESAS PJ'),
        celula('L', n, valor),
      ].join('')}</row>`);
    }
    if (saldoFinal) {
      const saldo = movimentos.reduce((total, [, valor]) => total + valor, 0);
      rows.push(`<row r="${++n}">${[
        celula('J', n, 'SALDO FINAL'), celula('L', n, saldo), celula('M', n, saldo),
      ].join('')}</row>`);
    }
  }
  return zip([
    ['xl/workbook.xml', '<workbook><sheets><sheet name="FLUXO DE CAIXA" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`],
  ]);
}
const arquivos = new Map([
  ['3N__DFC AGOSTO 2026.xlsx', arquivo([['BANCO SAFRA', [['primeira', -10]]]])],
  ['B3N__08 - DFC - AGOSTO2026.xlsx', arquivo([
    ['BANCO ITAÚ', [['fora', -20]]], ['BANCO SICOOB', [['fica', -30], ['Itaú no histórico', -40]]],
  ])],
  ['B3W__08 - DFC AGOSTO 2026.xlsx', arquivo([
    ['BANCO ITAÚ', [['igual', -50], ['igual', -50]]], ['BANCO DO BRASIL', [['outra conta', -15]]],
  ])],
  ['N3__DFC AGOSTO2026.xlsx', arquivo([['BANCO BRADESCO', [['igual', -50], ['igual', -50], ['igual', -50], ['outro', -60]]]])],
]);
for (const mes of [1, 2, 3, 4, 5, 6, 7, 9]) {
  for (const unidade of ['3N', 'B3N', 'B3W']) {
    arquivos.set(`${unidade}__${String(mes).padStart(2, '0')} - DFC 2026.xlsx`,
      arquivo([['BANCO TESTE', [[`${unidade}-${mes}`, -10]]]], { mes }));
  }
}
const fonte = { disponivel: () => true, arquivos: async () => [...arquivos.keys()], ler: async (nome) => arquivos.get(nome) };

test('janeiro a julho: três unidades, N3 ainda inexistente e nenhum aviso', async () => {
  for (let mes = 1; mes <= 7; mes++) {
    const r = await lerDfc({ fonte, ano: 2026, mes, comSerie: false });
    assert.equal(r.ok, true);
    assert.deepEqual(Object.keys(r.porUnidade), ['3N', 'B3N', 'B3W']);
    assert.equal(r.linhas.length, 3);
    assert.deepEqual(r.unidadesFaltantes, []);
    assert.equal(r.aviso, null);
  }
  const base = novaBase({ raiz: process.cwd(), ano: 2026, fonte });
  for (const unidade of ['3N', 'B3N', 'B3W']) {
    const escolhida = await base.porUnidade(unidade).dfc({ mes: 7 });
    assert.equal(escolhida.ok, true);
    assert.deepEqual(escolhida.linhas.map((l) => l.unidade), [unidade]);
    assert.equal(escolhida.aviso, null);
  }
  assert.equal((await base.porUnidade('N3').dfc({ mes: 7 })).ok, false);
});

test('agosto: quatro unidades e dedução N3 preservadas', async () => {
  const r = await lerDfc({ fonte, ano: 2026, mes: 8, comSerie: false });
  assert.deepEqual(Object.keys(r.porUnidade), ['3N', 'B3N', 'B3W', 'N3']);
  assert.equal(r.linhas.length, 8);
  assert.equal(r.repetidasN3, 2);
  assert.deepEqual(r.unidadesFaltantes, []);
  assert.equal(r.aviso, null);
});

test('setembro: consolida as três planilhas disponíveis e avisa falta da N3', async () => {
  const base = novaBase({ raiz: process.cwd(), ano: 2026, fonte });
  const r = await base.dfc({ mes: 9 });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.porUnidade), ['3N', 'B3N', 'B3W']);
  assert.deepEqual(Object.fromEntries(['3N', 'B3N', 'B3W'].map((u) => [u, r.linhas.filter((l) => l.unidade === u).length])),
    { '3N': 1, B3N: 1, B3W: 1 });
  assert.deepEqual(r.unidadesFaltantes, ['N3']);
  assert.equal(r.aviso, 'sem planilha da N3 neste mês; números sem ela');
  for (const unidade of ['3N', 'B3N', 'B3W']) {
    const escolhida = await base.porUnidade(unidade).dfc({ mes: 9 });
    assert.equal(escolhida.ok, true);
    assert.deepEqual(escolhida.linhas.map((l) => l.unidade), [unidade]);
    assert.equal(escolhida.aviso, null);
  }
  const escolhida = await base.porUnidade('N3').dfc({ mes: 9 });
  assert.equal(escolhida.ok, false);
  assert.match(escolhida.motivo, /sem planilha da N3/);
});

test('caso da Projeção do mês acha entrada por conteúdo entre unidades com a mesma linha', async () => {
  const copias = new Map([
    ['B3N__08 - DFC AGOSTO 2026.xlsx', arquivo([['BANCO SICOOB', [['entrada', 25]]]])],
    ['B3W__08 - DFC AGOSTO 2026.xlsx', arquivo([['BANCO ITAÚ', [['saída', -30]]]])],
  ]);
  const origem = { disponivel: () => true, arquivos: async () => [...copias.keys()], ler: async (nome) => copias.get(nome) };
  const r = await lerDfc({ fonte: origem, ano: 2026, mes: 8, comSerie: false });
  const caso = conferirCasoDfc(r.linhas, r.cruas, eReceitaTela1Dfc, 2026, 8);
  assert.equal(caso.quantas, 1);
  assert.equal(caso.linha.unidade, 'B3N');
  assert.equal(caso.ok, true, caso.dif.join('; '));
});

test('SALDO FINAL que repete saldo em SAIDA não cria desvio nem movimento', async () => {
  const nome = 'B3W__08 - DFC AGOSTO 2026.xlsx';
  const origem = { disponivel: () => true, arquivos: async () => [nome],
    ler: async () => arquivo([['BANCO SICOOB', [['pagamento', -10]]]], { saldoFinal: true }) };
  const r = await lerDfc({ fonte: origem, ano: 2026, mes: 8, comSerie: false });
  assert.equal(r.linhas.length, 1);
  assert.equal(r.saldosPorBanco[0].desvios, 0);
  assert.equal(r.saldosPorBanco[0].movimento, -1000);
});

test('B3N exclui somente o bloco do cabeçalho BANCO ITAÚ e conserva Sicoob', async () => {
  const r = await lerDfc({ fonte, ano: 2026, mes: 8, comSerie: false });
  assert.equal(r.ok, true, r.motivo);
  assert.deepEqual(r.porUnidade.B3N.linhas.map((l) => l.historico), ['FICA', 'ITAU NO HISTORICO']);
  assert.equal(r.porUnidade.B3N.saldosPorBanco.some((b) => b.banco === 'BANCO ITAU'), false);
});

test('N3 deduz por data, valor e histórico com multiplicidade', async () => {
  const r = await lerDfc({ fonte, ano: 2026, mes: 8, comSerie: false });
  assert.equal(r.repetidasN3, 2);
  assert.deepEqual(r.linhas.filter((l) => l.unidade === 'N3').map((l) => l.historico), ['IGUAL', 'OUTRO']);
  assert.equal(deduzirN3([{ dia: 5, valor: -5, historico: 'A' }], [{ dia: 5, valor: -5, historico: 'B' }], 2026, 8).repetidas, 0);
});

test('agosto: B3W 223 e 224 (sufixo "-N3") repetem N3 14 e 15; B3W 71 (outra nota) não repete N3 7', () => {
  const b3w = [
    { linha: 40, dia: 6, valor: -10, historico: 'COMISSAO - N3' },
    { linha: 71, dia: 7, valor: -20, historico: 'NF 07' },
    { linha: 223, dia: 20, valor: 30, historico: '20260811-42040373 -N3' },
    { linha: 224, dia: 20, valor: 40, historico: '20260820-76875065 -N3' },
  ];
  const n3 = [
    { linha: 6, dia: 6, valor: -10, historico: 'COMISSAO - N3' },
    { linha: 7, dia: 7, valor: -20, historico: 'NF 06' },
    { linha: 14, dia: 20, valor: 30, historico: '20260811-42040373' },
    { linha: 15, dia: 20, valor: 40, historico: '20260820-76875065' },
  ];
  const r = deduzirN3(b3w, n3, 2026, 8);
  assert.equal(r.repetidas, 3);
  assert.deepEqual(r.exclusivas.map((l) => l.linha), [7]);
  // O sufixo só vale no fim do histórico; dia ou valor diferente segue exclusivo.
  assert.equal(deduzirN3([{ dia: 21, valor: 30, historico: '20260811-42040373 -N3' }], [n3[2]], 2026, 8).repetidas, 0);
  assert.equal(deduzirN3([{ dia: 20, valor: 30, historico: 'N3 - 20260811-42040373' }], [n3[2]], 2026, 8).repetidas, 0);
});

test('filtro de unidade conserva só as linhas exclusivas da origem física', async () => {
  const base = novaBase({ raiz: process.cwd(), ano: 2026, fonte });
  const consolidado = await base.dfc({ mes: 8 });
  const n3 = await base.porUnidade('N3').dfc({ mes: 8 });
  const b3n = await base.porUnidade('B3N').dfc({ mes: 8 });
  assert.equal(consolidado.linhas.length, 8);
  assert.equal(n3.linhas.length, 2);
  assert.equal(b3n.linhas.length, 2);
  assert.ok(n3.linhas.every((l) => l.unidade === 'N3'));
});

test('Saídas: PAGO soma todas as contas e recorta Itaú da B3W; A PAGAR usa Omie', async () => {
  const r = await lerDfc({ fonte, ano: 2026, mes: 8, comSerie: false });
  assert.equal(saidasPagasDoDfc(r.linhas).length, 8);
  assert.equal(saidasPagasDoDfc(r.linhas, 'BANCO SICOOB').length, 2);
  assert.equal(saidasPagasDoDfc(r.linhas, 'BANCO ITAÚ').length, 2);
  const b3w = r.porUnidade.B3W.linhas;
  assert.equal(selecionarSaidas({ linhas: b3w }).valor, 11500);
  assert.equal(selecionarSaidas({ linhas: b3w, banco: 'BANCO ITAÚ' }).valor, 10000);
  assert.equal(selecionarSaidas({ linhas: b3w, banco: 'BANCO DO BRASIL' }).valor, 1500);
  const pago = selecionarSaidas({ linhas: r.linhas, banco: 'BANCO SICOOB' });
  assert.equal(pago.fonte, 'DFC');
  assert.equal(pago.contagem, 2);
  assert.equal(pago.valor, 7000);
  const aPagar = selecionarSaidas({ situacao: 'a-pagar', linhas: r.linhas,
    banco: 'ITAU', pendentes: { valor: 123, contagem: { omie: 1 } } });
  assert.deepEqual({ fonte: aPagar.fonte, valor: aPagar.valor, contagem: aPagar.contagem },
    { fonte: 'Omie', valor: 123, contagem: 1 });
});
