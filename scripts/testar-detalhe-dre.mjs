// O DETALHAMENTO DE CADA LINHA DO DRE SOMA O VALOR DA LINHA — o teste do clique da Tela 2 (30/09/2026).
//
// Para cada linha da tabela do DRE, e em vários recortes (sem filtro, empresa 2, uma conta bancária, meses escolhidos,
// chave do Omie desligada), confere:
//   1. linha com leitura própria: a soma dos lançamentos que ela abre = o valor da linha, ao centavo; e a soma por
//      categoria = a mesma;
//   2. linha "(=)": a conta das linhas que ela abre, com o sinal de cada uma, = o valor da linha; e cada parte = o
//      valor daquela linha na mesma coluna;
//   3. o valor do detalhamento = o número que a tabela escreve (a coluna do mês, ou a coluna "Total" com meses
//      escolhidos);
//   4. o filtro vale: com a empresa 2 escolhida, nenhum lançamento do Omie é da empresa 1; com uma conta escolhida,
//      a contagem do Omie de cada linha é a que a própria linha publica;
//   5. sem o Omie, só as três linhas de fonte DFC abrem.
//
// NÃO IMPRIME DINHEIRO: só contagem e "igual"/"DIFERENTE". Sai com código 1 se alguma conferência falhar.
//
//   node scripts/testar-detalhe-dre.mjs                  # agosto de 2026
//   DFC_DIR=<pasta local> node scripts/testar-detalhe-dre.mjs --mes 7

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { novaBase } from '../lib/regras/base-local.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
// Sem `DFC_DIR`, a cópia local das planilhas, se existir: este teste não precisa abrir a pasta sincronizada.
const copia = path.join(RAIZ, '.cache', `dfc-${ANO}`);
if (!process.env.DFC_DIR && fs.existsSync(copia)) process.env.DFC_DIR = copia;

const fonte = fonteDoDfc();
const base = novaBase({ raiz: RAIZ, ano: ANO, fonte });
let falhas = 0, conferidas = 0;
const ok = (cond, texto) => { conferidas += 1; if (!cond) { falhas += 1; console.log(`  DIFERENTE  ${texto}`); } return cond; };
const somar = (xs) => xs.reduce((s, x) => s + x, 0);

async function recorte(nome, filtro) {
  const t = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro, base });
  const comOmie = t.filtros.omie.ligado;
  const mesesFiltro = t.filtros.meses.ativo;
  console.log(`\n${nome} — DFC: ${t.dfc.ok ? t.dfc.arquivo : `não lido (${t.dfc.motivo})`}`);
  const porId = Object.fromEntries(t.tabela.map((l) => [l.id, l]));
  for (const l of t.tabela) {
    const c = l.composicao;
    const naTela = mesesFiltro ? l.total : l.porMes.find((p) => p.mes === MES)?.valor ?? null;
    if (!c) {
      ok(!comOmie && l.fonteDoValor !== 'dfc', `${l.rotulo}: não abre, e deveria`);
      console.log(`  ${l.rotulo.padEnd(34)} não abre (sem o Omie a linha não tem número)`);
      continue;
    }
    ok(naTela === null || c.valor === naTela, `${l.rotulo}: o valor do detalhamento não é o da tabela`);
    if (c.partes) {
      const conta = somar(c.partes.map((p) => p.sinal * p.valor));
      ok(conta === c.valor, `${l.rotulo}: a conta das partes não fecha`);
      for (const p of c.partes) ok(porId[p.id].composicao?.valor === p.valor, `${l.rotulo}: a parte ${p.rotulo} não é o valor daquela linha`);
      console.log(`  ${l.rotulo.padEnd(34)} abre ${c.partes.length} linha(s): ${c.partes.map((p) => `${p.sinal > 0 ? '+' : '−'} ${p.rotulo}`).join(' ')} — conta ${conta === c.valor ? 'igual' : 'DIFERENTE'}`);
      continue;
    }
    const soma = somar(c.itens.map((i) => i.valor));
    const somaCat = somar(c.porCategoria.map((g) => g.valor));
    ok(soma === c.valor, `${l.rotulo}: a soma dos lançamentos não é o valor da linha`);
    ok(somaCat === c.valor, `${l.rotulo}: a soma por categoria não é o valor da linha`);
    ok(somar(c.porCategoria.map((g) => g.n)) === c.itens.length, `${l.rotulo}: a contagem por categoria não fecha`);
    const omie = c.itens.filter((i) => i.fonte === 'Omie'), dfc = c.itens.filter((i) => i.fonte === 'DFC');
    // A contagem que a própria linha publica (e que `conferir-telas` compara com a conferência): o lado da fonte do valor.
    if (!mesesFiltro && l.contagem) {
      if (l.fonteDoValor === 'omie' && l.contagem.omie !== null) ok(omie.length === l.contagem.omie, `${l.rotulo}: ${omie.length} lançamentos do Omie, a linha publica ${l.contagem.omie}`);
      if (l.fonteDoValor === 'dfc' && l.contagem.dfc !== null) ok(dfc.length === l.contagem.dfc, `${l.rotulo}: ${dfc.length} linhas do DFC, a linha publica ${l.contagem.dfc}`);
    }
    if (t.filtros.empresa.ativo) ok(omie.every((i) => t.filtros.empresa.somadas.includes(i.empresa)), `${l.rotulo}: lançamento de empresa fora do filtro`);
    ok(c.itens.every((i) => c.meses.includes(i.mes)), `${l.rotulo}: lançamento fora dos meses do foco`);
    console.log(`  ${l.rotulo.padEnd(34)} ${String(omie.length).padStart(3)} do Omie + ${String(dfc.length).padStart(3)} do DFC em ${String(c.porCategoria.length).padStart(2)} categorias — soma ${soma === c.valor ? 'igual' : 'DIFERENTE'} à linha`);
  }
}

console.log(`O detalhamento das linhas do DRE — ${String(MES).padStart(2, '0')}/${ANO}`);
await recorte('sem filtro', {});
await recorte('empresa 2', { empresa: ['2'] });
// Uma conta com lançamento no mês: a primeira da lista que tenha despesa geral no Omie (conta vazia não prova o filtro).
const opcoes = (await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro: {}, base })).filtros.conta.opcoes;
let comMovimento = null;
for (const [n, c] of opcoes.entries()) {
  const t = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro: { conta: [c] }, base });
  if (t.tabela.find((l) => l.id === 'dre-despesas-gerais').composicao.itens.length) { comMovimento = { c, n: n + 1 }; break; }
}
if (comMovimento) await recorte(`uma conta bancária (a ${comMovimento.n}ª da lista, a primeira com despesa no mês)`, { conta: [comMovimento.c] });
else ok(false, 'nenhuma conta bancária tem despesa geral no mês');
await recorte(`meses ${MES - 1} e ${MES} somados`, { meses: [String(MES - 1), String(MES)] });
await recorte('chave do Omie desligada', { omie: ['0'] });

console.log(`\n${conferidas} conferências, ${falhas} diferentes.`);
process.exit(falhas ? 1 : 0);
