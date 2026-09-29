#!/usr/bin/env node
// GRAVA O MODELO DA PLANILHA DE CONTRATOS — `docs/modelo-contratos.xlsx` (decisão do dono, 29/09/2026).
//
// O saldo devedor do cartão "Capital de giro tomado" (Tela 2, bloco "Compromissos") sai de uma planilha que o
// financeiro mantém: um contrato por linha, com banco, valor, data, parcelas e taxa. Este script grava o MODELO dela —
// só o cabeçalho e uma aba com a explicação de cada coluna, sem contrato nenhum. O financeiro copia o modelo para a
// pasta do DFC, com "contrato" no nome (por exemplo `CONTRATOS DE EMPRESTIMO.xlsx`), e preenche. Quem lê é
// `lib/regras/passivo.mjs` (`lerContratos`), pelos nomes das colunas escritos aqui.
//
//   node scripts/modelo-contratos.mjs
//
// Não precisa de biblioteca: o `.xlsx` é um zip de XML, e o zip aqui é o mais simples que existe (sem compressão).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { COLUNAS_DOS_CONTRATOS } from '../lib/regras/passivo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(RAIZ, 'docs', 'modelo-contratos.xlsx');

// ---------------------------------------------------------------- um zip sem compressão
function zip(arquivos) {
  const locais = [], centrais = [];
  let pos = 0;
  for (const [nome, texto] of arquivos) {
    const dados = Buffer.from(texto, 'utf8');
    const nomeB = Buffer.from(nome, 'utf8');
    const crc = zlib.crc32(dados);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(0x0800, 6); cab.writeUInt16LE(0, 8);
    cab.writeUInt32LE(0, 10); cab.writeUInt32LE(crc, 14); cab.writeUInt32LE(dados.length, 18); cab.writeUInt32LE(dados.length, 22);
    cab.writeUInt16LE(nomeB.length, 26); cab.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10); cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(dados.length, 20);
    cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(nomeB.length, 28); cen.writeUInt32LE(pos, 42);
    locais.push(cab, nomeB, dados);
    centrais.push(cen, nomeB);
    pos += cab.length + nomeB.length + dados.length;
  }
  const central = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(central.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...locais, central, fim]);
}

// ---------------------------------------------------------------- um .xlsx de texto e número
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const letra = (i) => String.fromCharCode(65 + i);

// `abas` é [{ nome, linhas: [[célula, …], …], larguras: [n, …] }]; célula é texto, número ou `{ data: 'aaaa-mm-dd' }`.
// A primeira linha de cada aba sai em negrito.
function xlsx(abas) {
  const serial = (iso) => { const [a, m, d] = iso.split('-').map(Number); return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
  const folha = (aba) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${(aba.larguras ?? []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${aba.linhas.map((l, r) => `<row r="${r + 1}">${l.map((c, i) => {
    const ref = `${letra(i)}${r + 1}`, s = r === 0 ? ' s="1"' : '';
    if (c === null || c === undefined || c === '') return '';
    if (typeof c === 'number') return `<c r="${ref}"${s}><v>${c}</v></c>`;
    if (c.data) return `<c r="${ref}" s="2"><v>${serial(c.data)}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(c)}</t></is></c>`;
  }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${esc(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...abas.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, folha(a)]),
  ]);
}

// ---------------------------------------------------------------- o modelo
const C = COLUNAS_DOS_CONTRATOS;
const CABECALHO = [C.banco, C.contrato, C.tipo, C.valor, C.data, C.parcelas, `${C.taxa} (% AO MES)`, C.primeiro, C.parcela];
const EXPLICACAO = [
  ['coluna', 'o que escrever', 'obrigatória?'],
  [C.banco, 'o banco do contrato', 'sim'],
  [C.contrato, 'o número ou um apelido do contrato', 'não'],
  [C.tipo, 'CAPITAL DE GIRO, FINANCIAMENTO ou ANTECIPACAO DE RECEBIVEIS (vazio vale capital de giro). Antecipação de recebíveis conta como dívida', 'não'],
  [C.valor, 'o valor tomado, em reais, como número', 'sim'],
  [C.data, 'o dia em que o dinheiro entrou na conta, como data', 'sim'],
  [C.parcelas, 'quantas parcelas mensais (antecipação é 1)', 'sim'],
  [`${C.taxa} (% AO MES)`, 'a taxa de juros ao mês, em %: 1,85 quer dizer 1,85% ao mês', 'sim'],
  [C.primeiro, 'o vencimento da primeira parcela, como data; as outras vencem no mesmo dia dos meses seguintes', 'sim'],
  [C.parcela, 'a parcela do contrato, em reais; vazia, o app usa a parcela da tabela Price com a taxa e o prazo', 'não'],
  ['', '', ''],
  ['como o app usa', 'o saldo devedor no fim do mês da tela é o principal mais os juros já corridos, sem juros futuros; parcela vencida até o fim do mês conta como paga. Os vencimentos (0 a 3 meses, 3 a 12, mais de 12) são o valor das parcelas que faltam', ''],
  ['onde guardar', 'na pasta do DFC da MeuBESS, com "contrato" no nome do arquivo (por exemplo CONTRATOS DE EMPRESTIMO.xlsx). O npm run financeiro-enviar-dfc a manda para o servidor junto com as planilhas do mês', ''],
  ['o que não fazer', 'não mude o nome das colunas da aba CONTRATOS: o app as acha pelo nome. Uma linha por contrato; contrato quitado pode sair da planilha', ''],
];

const modelo = () => xlsx([
  { nome: 'CONTRATOS', linhas: [CABECALHO], larguras: [18, 16, 26, 16, 14, 11, 18, 22, 18] },
  { nome: 'COMO PREENCHER', linhas: EXPLICACAO, larguras: [24, 110, 12] },
]);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(SAIDA, modelo());
  console.log(`gravado ${path.relative(RAIZ, SAIDA)} (${CABECALHO.length} colunas, nenhum contrato)`);
}

export { xlsx, modelo, CABECALHO };
