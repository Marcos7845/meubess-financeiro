// DIAGNÓSTICO DO FLUXO DIÁRIO — roda NESTE computador e escreve SÓ NO TERMINAL. Nada é gravado em arquivo.
//
//   node scripts/diagnostico-dia-a-dia.mjs --mes 9                 # setembro de 2026, todos os dias com movimento
//   node scripts/diagnostico-dia-a-dia.mjs --mes 8 --dias 31       # e as linhas, uma a uma, do dia 31
//   node scripts/diagnostico-dia-a-dia.mjs --mes 9 --dias 1,2 --ano 2026
//
// POR QUE EXISTE (28/09/2026). A posição de caixa que o Fluxo de Caixa calcula das linhas do `FLUXO DE CAIXA` não bate
// com o `Final` que o quadro do caixa da própria planilha escreve para o dia: em 31/08 a tela dava R$ 757 mil e a
// planilha, R$ 215 mil. Este script põe, dia a dia, os dois lados lado a lado, e diz de que coluna saiu o dia de cada
// lançamento — `DIA PG` (o dia do pagamento) ou `VENCIMENTO` (quando o `DIA PG` está vazio). A suspeita é essa: um
// pagamento sem `DIA PG` cai no dia do vencimento, e o dia fica com saída que não aconteceu nele.
//
// TRAZ VALOR EM DINHEIRO, e por isso só escreve no terminal: número financeiro não sai desta máquina (README).

import { lerMesDoDfc, arquivosDoDfc } from '../lib/regras/dfc.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { ultimoDia } from '../lib/regras/periodo.mjs';

const arg = (nome, padrao) => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : padrao; };
const ANO = Number(arg('--ano', 2026));
const MES = Number(arg('--mes', new Date().getMonth() + 1));
const DIAS = String(arg('--dias', '')).split(',').map(Number).filter(Boolean);

const R = (c) => (c === null || c === undefined ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const col = (s, n) => String(s).padStart(n);

const fonte = fonteDoDfc();
const arquivos = await arquivosDoDfc(fonte);
const ler = (mes) => lerMesDoDfc({ fonte, ano: ANO, mes, arquivos });
const r = await ler(MES);
if (!r.ok && !r.abaDoMes) { console.error(`não li o mês ${MES}: ${r.motivo}`); process.exitCode = 1; }
else {
  const q = r.abaDoMes;
  let partida = q?.posicao?.inicial?.[0] ?? null;
  let deOnde = 'Inicial do dia 1 deste mês';
  if (MES > 1) {
    const ant = await ler(MES - 1);
    const fin = ant.abaDoMes?.posicao?.final;
    const n = ultimoDia(ANO, MES - 1);
    if (fin && fin.length >= n) { partida = fin[n - 1]; deOnde = `Final do dia ${n} do mês anterior`; }
  }
  console.log(`\n${r.arquivo} — aba do quadro: ${q?.aba ?? '(sem quadro)'}`);
  console.log(`ponto de partida: ${R(partida)} (${deOnde}); Inicial do dia 1 deste mês: ${R(q?.posicao?.inicial?.[0])}\n`);
  console.log(`${col('dia', 3)} | ${col('entrou tela', 14)} ${col('Entradas plan.', 15)} | ${col('saiu tela', 14)} ${col('Gastos plan.', 14)} | ${col('posição tela', 14)} ${col('Final plan.', 14)} | linhas (pelo vencimento)`);
  const linhas = r.ok ? r.linhas : [];
  let pos = partida ?? 0;
  for (let d = 1; d <= ultimoDia(ANO, MES); d++) {
    const doDia = linhas.filter((l) => l.dia === d);
    const entrou = doDia.filter((l) => l.natureza === 'R' && l.sub2 !== 'TRANSFERENCIAS BANCARIAS - RECEITA').reduce((s, l) => s + l.valor, 0);
    const saiu = doDia.filter((l) => l.natureza === 'P').reduce((s, l) => s + Math.abs(l.valor), 0);
    pos += entrou - saiu;
    const pe = q?.porDia?.entradas?.[d - 1] ?? null, pg = q?.porDia?.gastos?.[d - 1] ?? null, pf = q?.posicao?.final?.[d - 1] ?? null;
    if (!doDia.length && !pe && !pg) continue;
    const pelaData = doDia.filter((l) => l.dataDe && l.dataDe !== 'DIA PG').length;
    console.log(`${col(d, 3)} | ${col(R(entrou), 14)} ${col(R(pe), 15)} | ${col(R(saiu), 14)} ${col(R(pg === null ? null : Math.abs(pg)), 14)} | ${col(R(pos), 14)} ${col(R(pf), 14)} | ${doDia.length} (${pelaData})`);
  }
  for (const d of DIAS) {
    console.log(`\nas linhas do dia ${d}, da maior para a menor:`);
    for (const l of linhas.filter((x) => x.dia === d).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)))
      console.log(`  linha ${col(l.linha, 5)}  ${l.natureza === 'R' ? 'entrada' : 'saída  '}  ${col(R(Math.abs(l.valor)), 14)}  dia pelo ${l.dataDe ?? '?'}  ${l.pagamento}  ${l.classe} / ${l.sub2}`);
  }
  console.log('\n"linhas (pelo vencimento)": entre parênteses, quantas linhas do dia não tinham DIA PG e caíram nele pelo VENCIMENTO.');
}
