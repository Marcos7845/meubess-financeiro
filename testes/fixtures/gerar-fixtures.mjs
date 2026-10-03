#!/usr/bin/env node
// AS FIXTURES DA BANCADA DE TESTES — inventadas aqui, linha por linha, e versionadas ao lado deste script.
//
//   node testes/fixtures/gerar-fixtures.mjs      # regrava as três fixtures
//
// Nada aqui foi copiado de `.cache/`, de `dados/` nem da pasta do DFC: bancos, contas, categorias e valores são de
// mentira, números redondos e pequenos, escolhidos para cada caso de `testes/regras.test.mjs` ter uma resposta
// conhecida de antemão. Quem mudar uma linha daqui muda o esperado do teste junto.
//
//   dfc/08 - DFC - AGO2026.xlsx   um `FLUXO DE CAIXA` com dois blocos de banco (saldo corrido, transferência, linha
//                                 não baixada, linha de outro mês, desvio do saldo escrito)
//   omie/                          o cache de `financas/mf` e do cadastro de categorias das empresas 1 e 2, com os
//                                 nomes de arquivo que `lib/regras/cache-omie.mjs` procura
//   dados/contas-correntes-por-negocio.json   o recorte: duas contas da MeuBESS e uma de outro negócio

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- o xlsx de mentira

// Um zip sem compressão (método 0), que é o que `lerZip` lê sem descompactar.
function zipGuardado(arquivos) {
  const locais = [], centrais = [];
  let offset = 0;
  for (const [nome, texto] of arquivos) {
    const n = Buffer.from(nome), dados = Buffer.from(texto, 'utf8'), crc = zlib.crc32(dados);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4);
    l.writeUInt32LE(crc, 14); l.writeUInt32LE(dados.length, 18); l.writeUInt32LE(dados.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(dados.length, 20); c.writeUInt32LE(dados.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    locais.push(l, n, dados); centrais.push(c, n);
    offset += l.length + n.length + dados.length;
  }
  const central = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(central.length, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, central, fim]);
}

const serial = (a, m, d) => (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const COLUNA = { BANCO: 'C', PAGAMENTO: 'D', VENCIMENTO: 'E', 'DIA PG': 'F', 'FORNECEDOR / CLIENTE': 'G', TITULO: 'H', 'CLASS. CONTABIL': 'I', 'SUB 2': 'J', ENTRADA: 'K', SAIDA: 'L', SALDO: 'M' };
const cabecalho = Object.fromEntries(Object.keys(COLUNA).map((k) => [k, k]));

// As linhas do `FLUXO DE CAIXA`, na ordem. Número é célula numérica; texto é `inlineStr`. Valores em unidades.
const LINHAS = [
  [2, cabecalho],
  // Bloco 1, "BANCO A": abre em 1000 e fecha a coluna SALDO em toda linha.
  [3, { BANCO: 'BANCO A', 'SUB 2': 'SALDO INICIAL', SALDO: 1000 }],
  [4, { BANCO: 'BANCO A', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 8, 3), 'FORNECEDOR / CLIENTE': 'CLIENTE X', 'CLASS. CONTABIL': 'RECEITA COM VENDAS', 'SUB 2': 'RECEITA COM VENDAS', ENTRADA: 200, SALDO: 1200 }],
  [5, { BANCO: 'BANCO A', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 8, 4), 'CLASS. CONTABIL': 'TRANSFERENCIA', 'SUB 2': 'TRANSFERENCIAS BANCARIAS - RECEITA', ENTRADA: 50, SALDO: 1250 }],
  [6, { BANCO: 'BANCO A', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 8, 5), 'FORNECEDOR / CLIENTE': 'FORNECEDOR Y', 'CLASS. CONTABIL': 'DESPESA PJ', 'SUB 2': 'DESPESAS PJ', SAIDA: -30, SALDO: 1220 }],
  // Não baixada: a coluna SALDO já a desconta, o fluxo do mês não.
  [7, { BANCO: 'BANCO A', PAGAMENTO: 'A PAGAR', VENCIMENTO: serial(2026, 8, 10), 'CLASS. CONTABIL': 'DESPESA PJ', 'SUB 2': 'DESPESAS PJ', SAIDA: -20, SALDO: 1200 }],
  // De julho e sem SALDO escrito: anda o saldo corrido depois do último saldo escrito.
  [8, { BANCO: 'BANCO A', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 7, 28), 'CLASS. CONTABIL': 'OUTRAS RECEITAS', 'SUB 2': 'OUTRAS RECEITAS', ENTRADA: 5 }],
  [10, cabecalho],
  // Bloco 2, "BANCO B": começa direto num lançamento (abertura = saldo − movimento) e tem um desvio na segunda linha.
  [11, { BANCO: 'BANCO B', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 8, 6), 'CLASS. CONTABIL': 'RECEITA COM SERVICOS', 'SUB 2': 'RECEITA COM SERVICOS', ENTRADA: 100, SALDO: 600 }],
  [12, { BANCO: 'BANCO B', PAGAMENTO: 'PAGO', 'DIA PG': serial(2026, 8, 7), 'CLASS. CONTABIL': 'DESPESA PJ', 'SUB 2': 'DESPESAS PJ', SAIDA: -40, SALDO: 570 }],
];

function abaXml() {
  const linhas = LINHAS.map(([n, cel]) => `<row r="${n}">${Object.entries(cel).map(([k, v]) => {
    const ref = `${COLUNA[k]}${n}`;
    return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhas}</sheetData></worksheet>`;
}

const xlsx = zipGuardado([
  ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="FLUXO DE CAIXA" sheetId="1" r:id="rId1"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml', abaXml()],
]);
fs.mkdirSync(path.join(AQUI, 'dfc'), { recursive: true });
fs.writeFileSync(path.join(AQUI, 'dfc', '08 - DFC - AGO2026.xlsx'), xlsx);

// ---------------------------------------------------------------- o recorte de mentira

const contas = {
  _o_que_e: 'fixture de teste: contas inventadas, sem relação com contas reais',
  recorte_das_telas: 'MeuBESS',
  contas: [
    { chave: '1|111', empresa: 1, nCodCC: 111, descricao: 'BANCO A', negocio: 'MeuBESS', dito_como: 'Banco A' },
    { chave: '2|222', empresa: 2, nCodCC: 222, descricao: 'BANCO A', negocio: 'MeuBESS', dito_como: 'Banco A' },
    { chave: '1|999', empresa: 1, nCodCC: 999, descricao: 'BANCO Z', negocio: 'Outro negócio', dito_como: 'Banco Z' },
  ],
};
fs.mkdirSync(path.join(AQUI, 'dados'), { recursive: true });
fs.writeFileSync(path.join(AQUI, 'dados', 'contas-correntes-por-negocio.json'), `${JSON.stringify(contas, null, 2)}\n`);

// ---------------------------------------------------------------- o cache do Omie de mentira

const omie = path.join(AQUI, 'omie');
process.env.OMIE_CACHE_DIR = omie;
const { arqCacheOmie, leiturasDe } = await import('../../lib/regras/cache-omie.mjs');
fs.rmSync(omie, { recursive: true, force: true });
fs.mkdirSync(omie, { recursive: true });
const gravar = (emp, servico, call, param, json) => fs.writeFileSync(arqCacheOmie(AQUI, emp, servico, call, param), `${JSON.stringify(json, null, 1)}\n`);

// Um lançamento de `ListarMovimentos`: o que a regra lê fica em `detalhes`, o valor pago em `resumo`.
const mov = (d, nValPago) => ({ detalhes: { cStatus: 'PAGO', cOrigem: '', nCodTitulo: 0, dDtPagamento: '05/08/2026', ...d }, resumo: { nValPago } });
const MOVIMENTOS = {
  1: [
    mov({ cGrupo: 'CONTA_A_RECEBER', nCodTitulo: 1, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01', nValorTitulo: 100 }, 100),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodTitulo: 1, nCodMovCC: 9001, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01' }, 100),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9002, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01' }, 30),
    mov({ cGrupo: 'CONTA_A_RECEBER', nCodTitulo: 2, nCodCC: 999, cNatureza: 'R', cCodCateg: '1.01.01', nValorTitulo: 70 }, 70),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9003, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.05.01' }, 40),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9004, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.04.97' }, 15),
    mov({ cGrupo: 'CONTA_A_RECEBER', nCodTitulo: 3, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01', cStatus: 'CANCELADO', nValorTitulo: 60 }, 60),
    mov({ cGrupo: 'CONTA_CORRENTE_PAG', nCodMovCC: 9005, nCodCC: 111, cNatureza: 'P', cCodCateg: '2.01.01', cOrigem: 'ADCR' }, 25),
    mov({ cGrupo: 'CONTA_A_PAGAR', nCodTitulo: 10, nCodCC: 111, cNatureza: 'P', cCodCateg: '2.01.01', cOrigem: 'ADCP', nValorTitulo: 80 }, 80),
    mov({ cGrupo: 'CONTA_CORRENTE_PAG', nCodTitulo: 10, nCodMovCC: 9006, nCodCC: 111, cNatureza: 'P', cCodCateg: '2.01.01', cOrigem: 'BAIXA' }, 80),
    mov({ cGrupo: 'CONTA_A_PAGAR', nCodTitulo: 11, nCodCC: 111, cNatureza: 'P', cCodCateg: '2.01.01', nValorTitulo: 45 }, 45),
    mov({ cGrupo: 'CONTA_CORRENTE_PAG', nCodTitulo: 12, nCodMovCC: 9007, nCodCC: 111, cNatureza: 'P', cCodCateg: '2.01.01' }, 12),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9008, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01', dDtPagamento: '05/07/2026' }, 9),
  ],
  2: [
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9101, nCodCC: 222, cNatureza: 'R', cCodCateg: '1.04.97' }, 20),
    mov({ cGrupo: 'CONTA_CORRENTE_REC', nCodMovCC: 9102, nCodCC: 111, cNatureza: 'R', cCodCateg: '1.01.01' }, 35),
  ],
};
const CATEGORIAS = {
  1: [{ codigo: '1.01.01', descricao: 'Receita de teste' }, { codigo: '1.05.01', descricao: 'Transferência marcada', transferencia: 'S' }, { codigo: '1.04.97', descricao: 'Transferência sem marca' }, { codigo: '2.01.01', descricao: 'Despesa de teste' }],
  2: [{ codigo: '1.01.01', descricao: 'Receita de teste' }, { codigo: '1.04.97', descricao: 'Outra receita de teste' }],
};
const L = leiturasDe(2026);
for (const emp of ['1', '2']) {
  gravar(emp, 'financas/mf', 'ListarMovimentos', L.MF(1), { nPagina: 1, nTotPaginas: 1, movimentos: MOVIMENTOS[emp] });
  gravar(emp, 'geral/categorias', 'ListarCategorias', L.CATEGORIAS(1), { pagina: 1, total_de_paginas: 1, categoria_cadastro: CATEGORIAS[emp] });
}
console.log('fixtures regravadas em', path.relative(process.cwd(), AQUI) || '.');
