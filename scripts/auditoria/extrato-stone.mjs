// Converte o extrato de conta da Stone em xlsx ("Comprovante de Extrato.xlsx", aba `Extrato`) no CSV que o auditor
// lê: data;valor;saldo;id;historico. Só grava se cada linha fechar (saldo antes + valor = saldo depois) e se as linhas,
// em ordem cronológica, se encadearem (saldo depois de uma = saldo antes da seguinte). Ao lado do CSV grava um .json
// com a prova da conversão (sem valores nem nomes), no mesmo formato do de `extrato-pdf.py`.
//
//   node scripts/auditoria/extrato-stone.mjs --mes 2026-08 --conta "BANCO STONE--2" --periodo 2026-08-01:2026-08-31 --xlsx <arquivo>
//
// O xlsx não traz o período; `--periodo` é o impresso no PDF do mesmo extrato ("Período: de ... a ..."). O arquivo é só
// lido (exceção do dono de 30/09/2026 para o auditor); nada é copiado para o repositório nem gravado na origem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerZip, sharedStrings, abasDo, lerAba } from '../../lib/regras/xlsx.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const saida = args.saida ?? path.join(raiz, 'extratos');
const falhar = (msg) => { console.error(`extrato-stone: ${msg}; nada gravado`); process.exit(1); };
for (const k of ['mes', 'conta', 'periodo', 'xlsx']) if (!args[k]) falhar(`falta --${k}`);
const [inicio, fim] = args.periodo.split(':');
if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim ?? '')) falhar('--periodo deve ser AAAA-MM-DD:AAAA-MM-DD');

// "R$ 1.234,56", "-1.234,56" → centavos
const cent = (s) => {
  const t = String(s ?? '').replace(/R\$|\s/g, '');
  if (!/^-?[\d.]+,\d{2}$/.test(t)) return null;
  return Math.round(Number(t.replace(/\./g, '').replace(',', '.')) * 100);
};

const zip = lerZip(fs.readFileSync(args.xlsx));
const aba = abasDo(zip).find((a) => a.nome.trim() === 'Extrato') ?? falhar('aba Extrato ausente');
const linhas = lerAba(zip, aba.parte, sharedStrings(zip));
const cab = new Map([...linhas.shift().cel].map(([col, v]) => [v.t, col]));
for (const c of ['Movimentação', 'Tipo', 'Valor', 'Saldo antes', 'Saldo depois', 'Data', 'Situação']) if (!cab.has(c)) falhar(`coluna ${c} ausente`);
const get = (l, c) => l.cel.get(cab.get(c))?.t ?? l.cel.get(cab.get(c))?.v;

let pontos = 0;
const tx = linhas.map((l) => {
  const quando = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})$/.exec(String(get(l, 'Data') ?? ''));
  const valor = cent(get(l, 'Valor')), antes = cent(get(l, 'Saldo antes')), depois = cent(get(l, 'Saldo depois'));
  if (!quando || valor === null || antes === null || depois === null) falhar(`linha ${l.n} sem data, valor ou saldo`);
  if (antes + valor !== depois) falhar(`linha ${l.n}: saldo antes + valor ≠ saldo depois`);
  pontos++;
  const historico = [get(l, 'Movimentação'), get(l, 'Tipo'), get(l, 'Situação')].filter(Boolean).join(' ');
  return { data: `${quando[3]}-${quando[2]}-${quando[1]}`, hora: quando[4], valor, antes, depois, historico, n: l.n };
}).sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`) || b.n - a.n); // o arquivo vem do mais recente para o mais antigo
for (let i = 1; i < tx.length; i++) if (tx[i].antes !== tx[i - 1].depois) falhar(`saldo não encadeia entre ${tx[i - 1].data} e ${tx[i].data}`);
const doMes = tx.filter((t) => t.data.slice(0, 7) === args.mes);
if (doMes.length !== tx.length) falhar('há lançamento fora do mês');
if (!doMes.length) falhar('sem transação no mês');

const titular = new Set(linhas.map((l) => get(l, 'Movimentação') === 'Crédito' ? get(l, 'Destino Documento') : get(l, 'Origem Documento')).filter(Boolean));
fs.mkdirSync(saida, { recursive: true });
const base = path.join(saida, `${args.mes}__${args.conta}`);
fs.writeFileSync(`${base}.csv`, 'data;valor;saldo;id;historico\n'
  + doMes.map((t, i) => `${t.data};${(t.valor / 100).toFixed(2)};${(t.depois / 100).toFixed(2)};xlsx-${i + 1};${t.historico.replace(/[;"]/g, ' ')}`).join('\n') + '\n', 'utf8');
const ultimo = Number(fim.slice(8, 10));
const prova = {
  pdf: path.basename(args.xlsx), modelo: 'stone-xlsx', conta: args.conta, mes: args.mes,
  transacoes: doMes.length, saldosConferidos: pontos, excluidos: {},
  cnpjDoTitular: titular.size === 1 ? [...titular][0] : null, periodoDoPdf: [inicio, fim],
  cobreMesInteiro: inicio <= `${args.mes}-01` && fim.slice(0, 7) >= args.mes && (fim.slice(0, 7) > args.mes || ultimo >= 28),
};
fs.writeFileSync(`${base}.json`, JSON.stringify(prova, null, 1), 'utf8');
console.log(`${args.conta}: ${doMes.length} transações, ${pontos} saldos conferidos, mês inteiro: ${prova.cobreMesInteiro}`);
