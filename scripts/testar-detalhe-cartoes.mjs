// O QUE CADA CARTÃO ABRE SOMA O VALOR DO CARTÃO — o teste do clique nos cartões das três telas (01/10/2026).
//
// Para cada cartão das Telas 1, 2 e 3 (Fluxo de Caixa) que tem `composicao`, e em vários recortes (sem filtro, empresa
// 2, chave do Omie desligada, e na Tela 2 também dois meses escolhidos), confere:
//   1. lista: a soma dos itens = o valor do cartão, ao centavo; a soma por categoria = a mesma;
//   2. conta: a conta das partes, com o sinal de cada uma, = o valor do cartão;
//   3. razão: numerador ÷ denominador = o valor do cartão, e cada um dos dois abre certo (1 ou 2, de novo);
//   4. a contagem do lado de que o cartão saiu (DFC ou Omie) = o número de itens, onde o cartão é uma lista de um lado só;
//   5. cartão sem número (sem o Omie, por exemplo) não abre nada.
// E, na Tela 2, o quadro "fora do DRE" pelas mesmas regras.
//
// NÃO IMPRIME DINHEIRO: só contagem e "igual"/"DIFERENTE". Sai com código 1 se alguma conferência falhar.
//
//   node scripts/testar-detalhe-cartoes.mjs              # agosto de 2026
//   DFC_DIR=<pasta local> node scripts/testar-detalhe-cartoes.mjs --mes 7

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularFluxoDeCaixa } from '../lib/indicadores/fluxo-de-caixa.mjs';
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

// Confere uma composição contra o valor que ela diz abrir; devolve uma frase curta para o terminal.
function conferir(nome, c, valor) {
  if (c.razao) {
    const { numerador: n, denominador: d } = c.razao;
    ok(d.valor !== 0 && Math.abs(n.valor / d.valor - valor) < 1e-12, `${nome}: numerador ÷ denominador ≠ o valor do cartão`);
    return `razão (${conferir(`${nome} / numerador`, n, n.valor)}) ÷ (${conferir(`${nome} / denominador`, d, d.valor)})`;
  }
  if (c.partes) {
    ok(somar(c.partes.map((p) => p.sinal * p.valor)) === valor, `${nome}: a conta das partes ≠ o valor`);
    return `conta de ${c.partes.length} linhas`;
  }
  ok(somar(c.itens.map((i) => i.valor)) === valor, `${nome}: a soma dos itens ≠ o valor`);
  ok(somar(c.porCategoria.map((g) => g.valor)) === valor, `${nome}: a soma por categoria ≠ o valor`);
  ok(somar(c.porCategoria.map((g) => g.n)) === c.itens.length, `${nome}: a contagem por categoria ≠ a lista`);
  const fontes = [...new Set(c.itens.map((i) => i.fonte))];
  return `${c.itens.length} itens (${fontes.join(' + ') || 'nenhum'})`;
}

// O lado de que um cartão-lista saiu, para conferir a contagem: só quando a contagem publicada é desse lado e de um só.
const LADO = {
  saldo: 'dfc', receitas: 'dfc', despesas: 'dfc', 'despesas-pagas': 'dfc', 'despesas-pendentes': 'omie',
  'despesas-funcionarios': 'dfc', 'receita-total': 'dfc', 'custos-e-despesas': 'dfc',
  entrou: 'dfc', saiu: 'dfc', 'a-pagar': 'omie', 'a-receber': 'omie', fixas: 'dfc',
  'fora-implantacao-de-saldos': 'omie',
};

function cartoes(tela, lista) {
  for (const c of lista) {
    if (c.valor === null || c.valor === undefined) {
      ok(!c.composicao, `${tela} — ${c.nome ?? c.rotulo}: sem número, mas abre uma lista`);
      console.log(`  ${tela} — ${c.nome ?? c.rotulo}: sem número, não abre`);
      continue;
    }
    if (!ok(Boolean(c.composicao), `${tela} — ${c.nome ?? c.rotulo}: tem número e não abre nada`)) continue;
    const frase = conferir(`${tela} — ${c.nome ?? c.rotulo}`, c.composicao, c.valor);
    const lado = LADO[c.id];
    if (lado && c.composicao.itens && c.contagem?.[lado] !== null && c.contagem?.[lado] !== undefined) {
      ok(c.composicao.itens.length === c.contagem[lado], `${tela} — ${c.nome ?? c.rotulo}: ${c.composicao.itens.length} itens e a contagem do ${lado} é ${c.contagem[lado]}`);
    }
    console.log(`  ${tela} — ${c.nome ?? c.rotulo}: ${frase}`);
  }
}

async function recorte(nome, filtro, { comFluxo = true } = {}) {
  console.log(`\n${nome}`);
  const t1 = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro, base });
  cartoes('Tela 1', t1.cartoes);
  const t2 = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro, base });
  cartoes('Tela 2', t2.cartoes);
  cartoes('Tela 2, fora do DRE', t2.foraDoDre);
  if (comFluxo) {
    const t3 = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro, base });
    cartoes('Tela 3', t3.cartoes);
  }
}

await recorte('sem filtro', {});
await recorte('empresa 2', { empresa: ['2'] });
await recorte('sem o Omie', { omie: ['0'] });
await recorte(`Tela 2 com dois meses (${MES - 1} e ${MES})`, { meses: [String(MES - 1), String(MES)] }, { comFluxo: false });

// O período da Tela 3 deve repetir a soma dos cartões mensais, inclusive no clique.
const anterior = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES - 1, fonte,
  filtro: { omie: ['0'] }, base });
const atual = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES, fonte,
  filtro: { omie: ['0'] }, base });
const periodo = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES, fonte,
  filtro: { omie: ['0'], mesesDoDia: [MES - 1, MES] }, base });
if (anterior.dfc.ok && atual.dfc.ok) {
  const de = (d, id) => d.cartoes.find((c) => c.id === id);
  for (const id of ['entrou', 'saiu', 'resultado', 'fixas']) {
    ok(de(periodo, id).valor === de(anterior, id).valor + de(atual, id).valor,
      `Tela 3, ${id}: dois meses ≠ soma dos meses`);
  }
  ok(de(periodo, 'entrou').valor !== de(anterior, 'entrou').valor,
    'Tela 3, Entrou não muda ao ampliar o período');
  ok(de(periodo, 'saiu').valor !== de(anterior, 'saiu').valor,
    'Tela 3, Saiu não muda ao ampliar o período');
  cartoes('Tela 3, dois meses', periodo.cartoes);
  const comOmie = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES, fonte,
    filtro: { mesesDoDia: [MES - 1, MES] }, base });
  cartoes('Tela 3, dois meses com Omie', comOmie.cartoes);
}

console.log(`\n${conferidas} conferências, ${falhas} diferente(s).`);
process.exit(falhas ? 1 : 0);
