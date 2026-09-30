// Documentos da master de um mês fechado: extratos em PDF (inventário), fiscal, faturamento do contador, notas de
// prestadores PJ, comprovantes de CPA e C.R., e o DFC separado de N3. Só leitura. Nada aqui entra no repositório:
// o HTML que usa estes números é ignorado pelo git.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula } from '../../lib/regras/xlsx.mjs';
import { centavos, normal, soma, lerDfcBruto } from './core.mjs';

export const listar = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((item) => item.isDirectory() ? listar(path.join(dir, item.name)) : [path.join(dir, item.name)]);

// O pdftotext do Git para Windows, quando não está no PATH do processo.
const PDFTOTEXT = [process.env.PDFTOTEXT, 'pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe'].filter(Boolean);
export function textoDoPdf(arq) {
  for (const exe of PDFTOTEXT) {
    try { return execFileSync(exe, ['-layout', '-enc', 'UTF-8', arq, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { /* tenta o próximo */ }
  }
  return null;
}
const valoresDoTexto = (t) => [...String(t ?? '').matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) => centavos(m[1].replace(/\./g, '').replace(',', '.')));

function linhasDa(arq) {
  const zip = lerZip(fs.readFileSync(arq)), s = sharedStrings(zip);
  return lerAba(zip, abasDo(zip)[0].parte, s);
}

// Relatório de saídas do Omie (NF-e): cabeçalho na linha com "Número da NF-e"; situação, valor e chave de acesso.
export function notasDeSaida(arq, periodo) {
  const linhas = linhasDa(arq);
  const cab = linhas.find((l) => [...l.cel.values()].some((c) => normal(c.t) === 'NUMERO DA NF-E'));
  if (!cab) return null;
  const col = Object.fromEntries([...cab.cel].map(([letra, c]) => [normal(c.t), letra]));
  const notas = linhas.filter((l) => l.n > cab.n && l.cel.get(col['NUMERO DA NF-E'])?.t).map((l) => {
    const emissao = dataDaCelula(l.cel.get(col['EMISSAO']));
    return { linha: l.n, numero: l.cel.get(col['NUMERO DA NF-E']).t.trim(), situacao: normal(l.cel.get(col['SITUACAO'])?.t),
      valor: centavos(l.cel.get(col['VALOR DA NF-E'])?.v), chave: String(l.cel.get(col['CHAVE DE ACESSO'])?.t ?? '').trim(),
      mes: emissao ? `${emissao.a}-${String(emissao.m).padStart(2, '0')}` : null };
  });
  const doMes = notas.filter((n) => n.mes === periodo);
  const faturadas = doMes.filter((n) => n.situacao === 'FATURADO');
  return { arquivo: path.basename(arq), total: doMes.length, faturadas: faturadas.length, canceladas: doMes.filter((n) => n.situacao === 'CANCELADO').length,
    outras: doMes.length - faturadas.length - doMes.filter((n) => n.situacao === 'CANCELADO').length,
    valorFaturado: soma(faturadas.map((n) => n.valor)), notas: faturadas };
}

// Relatório de serviços prestados (NFS-e): cabeçalho com "Valor Total"; cancelada tem Data Cancelamento.
export function servicosPrestados(arq, periodo) {
  const linhas = linhasDa(arq);
  const cab = linhas.find((l) => [...l.cel.values()].some((c) => normal(c.t) === 'VALOR TOTAL'));
  if (!cab) return null;
  const col = Object.fromEntries([...cab.cel].map(([letra, c]) => [normal(c.t), letra]));
  const notas = linhas.filter((l) => l.n > cab.n && l.cel.get(col['VALOR TOTAL'])?.v !== undefined).map((l) => {
    const emissao = dataDaCelula(l.cel.get(col['DATA EMISSAO']));
    return { numero: String(l.cel.get(col['NUMERO'])?.t ?? l.cel.get(col['NUMERO'])?.v ?? ''), valor: centavos(l.cel.get(col['VALOR TOTAL'])?.v),
      cancelada: Boolean(l.cel.get(col['DATA CANCELAMENTO'])), mes: emissao ? `${emissao.a}-${String(emissao.m).padStart(2, '0')}` : null };
  }).filter((n) => n.mes === periodo);
  const validas = notas.filter((n) => !n.cancelada);
  return { arquivo: path.basename(arq), total: notas.length, validas: validas.length, canceladas: notas.length - validas.length, valor: soma(validas.map((n) => n.valor)) };
}

// Relatório de faturamento do contador (PDF): a linha do mês traz saídas, serviços, outros e total.
const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export function faturamentoDoContador(arq, periodo) {
  const texto = textoDoPdf(arq);
  if (!texto) return { lido: false, motivo: 'pdftotext indisponível ou PDF ilegível' };
  const [ano, mes] = periodo.split('-').map(Number);
  const linha = texto.split(/\r?\n/).find((l) => new RegExp(`^\\s*${MESES[mes - 1]}\\s+${ano}\\b`).test(normal(l)));
  if (!linha) return { lido: true, achado: false };
  const numeros = [...linha.matchAll(/[\d.]+,\d{2}/g)].map((m) => centavos(m[0].replace(/\./g, '').replace(',', '.')));
  const cnpj = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.exec(texto)?.[0] ?? null;
  return { lido: true, achado: numeros.length >= 2, saidas: numeros[0] ?? null, servicos: numeros.length >= 4 ? numeros[1] : null,
    total: numeros.at(-1) ?? null, cnpj, assinado: /Assinado de forma digital/i.test(texto) };
}

// Notas de prestadores PJ do mês: número da nota (do nome do arquivo) e valores impressos, sem guardar nome.
export function notasPj(dir) {
  return listar(dir).filter((a) => /\.pdf$/i.test(a) && /^NF\s*\d+/i.test(path.basename(a))).map((arq) => {
    const rel = path.relative(dir, arq).split(path.sep);
    return { grupo: rel[0], numero: /^NF\s*(\d+)/i.exec(path.basename(arq))[1], valores: [...new Set(valoresDoTexto(textoDoPdf(arq)))].filter((v) => v > 0), arq };
  });
}

// DFC separado de uma unidade × linhas da mesma unidade (coluna EMP.) no DFC principal: casa por dia, valor e SUB 2.
export function compararUnidade(principal, arqUnidade, unidade, ano, mes) {
  const outro = lerDfcBruto(fs.readFileSync(arqUnidade), ano, mes);
  const chave = (l) => `${l.data.d}|${l.movimento}|${l.sub2}`;
  const daUnidade = principal.linhas.filter((l) => normal(l.empDfc) === unidade);
  const livres = new Map();
  for (const l of daUnidade) livres.set(chave(l), [...(livres.get(chave(l)) ?? []), l]);
  const outrasDoPrincipal = new Set(principal.linhas.filter((l) => normal(l.empDfc) !== unidade).map(chave));
  const pares = [], soSeparado = [], emOutraLinha = [];
  for (const l of outro.linhas) {
    const par = livres.get(chave(l))?.shift();
    if (par) pares.push([par.n, l.n]);
    else if (outrasDoPrincipal.has(chave(l))) emOutraLinha.push(l.n);
    else soSeparado.push(l.n);
  }
  return { linhasSeparado: outro.linhas.length, linhasNoPrincipal: daUnidade.length, pares, soSeparado, emOutraLinha,
    soPrincipal: [...livres.values()].flat().map((l) => l.n), contasSeparado: [...new Set(outro.brutas.map((l) => l.conta))],
    somaSeparado: soma(outro.linhas.map((l) => l.movimento)), somaNoPrincipal: soma(daUnidade.map((l) => l.movimento)) };
}

// Cédula de crédito bancário (Itaú): total financiado, taxa ao mês e o Anexo I (parcela, vencimento, juros, principal).
export function contratoCcb(arq) {
  const t = textoDoPdf(arq);
  if (!t) return null;
  const num = (s) => centavos(s.replace(/\./g, '').replace(',', '.'));
  const achar = (re) => re.exec(t)?.[1] ?? null;
  const financiado = achar(/Valor Total Financiado:\s*R\$\s*([\d.]+,\d{2})/), credito = achar(/Valor do Cr.dito:\s*R\$\s*([\d.]+,\d{2})/);
  const taxa = achar(/Taxa de juros remunerat.rios:\s*([\d,]+)\s*%\s*ao m/);
  const parcelas = [...t.matchAll(/^\s*(\d{1,2})\s+(\d{2})\/(\d{2})\/(\d{4})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/gm)]
    .map((m) => ({ n: +m[1], venc: Date.UTC(+m[4], +m[3] - 1, +m[2]), juros: num(m[5]), principal: num(m[6]) }));
  return { numero: /(\d{6,})/.exec(path.basename(arq))?.[1] ?? null, financiado: financiado && num(financiado),
    credito: credito && num(credito), taxa: taxa && Number(taxa.replace(',', '.')), parcelas };
}

// Saldo devedor da CCB no corte pela mesma regra do dono (principal mais juros já corridos, sem juros futuros): o
// total financiado menos o principal das parcelas vencidas, com os juros da taxa pró-rata desde o último vencimento.
export function saldoCcb(c, corte) {
  const vencidas = c.parcelas.filter((p) => p.venc <= corte);
  if (!vencidas.length || !c.financiado || !c.taxa) return null;
  const saldo = c.financiado - soma(vencidas.map((p) => p.principal));
  return Math.round(saldo * (1 + c.taxa / 100) ** ((corte - vencidas.at(-1).venc) / 86400000 / 30));
}

// A pasta de comprovantes mais recente de CPA e de C.R., pelo número do mês no nome da pasta.
export function ultimaPastaMensal(dir) {
  if (!fs.existsSync(dir)) return null;
  const nomes = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const MES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
  const numero = (n) => { const m = /(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/.exec(normal(n)); return m ? MES[m[1]] : null; };
  const comMes = nomes.map((n) => ({ n, m: numero(n) })).filter((x) => x.m);
  return comMes.length ? comMes.sort((a, b) => a.m - b.m).at(-1) : null;
}
