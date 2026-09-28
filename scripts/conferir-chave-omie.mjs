// CONFERE A CHAVE "INCLUIR DADOS DO OMIE" das três telas — o caso real que `docs/filtros.md` cita.
//
// O QUE ESTE TESTE AFIRMA, e são três coisas. Nenhuma delas é "o número está certo": quem prova isso é
// `scripts/conferir-telas.mjs`, contra `docs/conferencia.md`, e `scripts/conferir-filtros.mjs`, contra os arquivos
// crus do cache. O que a chave precisa provar é outra coisa — que ela não inventa nada e não esconde o que não é dela:
//
//   1. LIGADA, ELA NÃO EXISTE. A tela com `?omie=1` e a tela sem `omie` nenhum na URL têm de sair IDÊNTICAS, indicador
//      por indicador, no valor e nas duas contagens. É o que garante que `npm run conferir-telas` continua dando 36 e
//      `npm run conferir-filtros` continua dando 19: os dois chamam o cálculo sem a chave, e a chave é transparente.
//   2. DESLIGADA, O LADO DO DFC NÃO SE MOVE. A contagem do DFC de cada indicador e o valor de cada indicador cuja
//      fonte principal é o DFC têm de ser, número por número, os mesmos de quando a chave está ligada. O pedido do
//      dono é ver a tela SEM o Omie, e não ver outra tela.
//   3. DESLIGADA, O LADO DO OMIE SAI INTEIRO — e sai como AUSÊNCIA, não como zero. Toda `contagem.omie` tem de ser
//      `null`, e todo indicador cuja fonte principal é o Omie tem de ficar com `valor === null` E com uma frase em
//      `semOmie[]` dizendo por quê. Um zero ali seria dado — "a despesa pendente do mês é zero" —, e o zero é
//      exatamente o que esta tarefa existe para não mostrar.
//
// SÓ CONTAGEM, nunca dinheiro e nunca nome — a mesma regra dos outros dois conferidores. O valor é comparado como
// "igual ou diferente" e como "existe ou é `null`"; nenhum número em reais é impresso.
//
//   node scripts/conferir-chave-omie.mjs
//   node scripts/conferir-chave-omie.mjs --mes 8 --ano 2026

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularTela3 } from '../lib/indicadores/tela-3.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));

let conferidos = 0;
const divergentes = [];
const linhas = [];

function confere(oQue, certo, comoEsta) {
  if (certo) { conferidos += 1; linhas.push(`ok          ${oQue}`); return; }
  divergentes.push(oQue);
  linhas.push(`divergente: ${oQue} — ${comoEsta}`);
}

// ================================================================ as três telas, dos três jeitos

const comum1 = { raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() };
const t1Nada = await calcularTela1({ ...comum1 });
const t1Liga = await calcularTela1({ ...comum1, filtro: { omie: ['1'] } });
const t1Sem = await calcularTela1({ ...comum1, filtro: { omie: ['0'] } });

const t2Nada = await calcularTela2({ ...comum1 });
const t2Liga = await calcularTela2({ ...comum1, filtro: { omie: ['1'] } });
const t2Sem = await calcularTela2({ ...comum1, filtro: { omie: ['0'] } });

const comum3 = { raiz: RAIZ, ano: ANO, mes: MES };
const t3Nada = await calcularTela3({ ...comum3 });
const t3Liga = await calcularTela3({ ...comum3, filtro: { omie: ['1'] } });
const t3Sem = await calcularTela3({ ...comum3, filtro: { omie: ['0'] } });

// Os indicadores de uma tela, numa lista só — cartões e blocos, na ordem em que a tela os mostra.
const todosDe = (d) => [...d.cartoes, ...(d.blocos ?? []), ...(d.tabela ?? [])];

// A FONTE PRINCIPAL DE UM INDICADOR, lida do próprio indicador e nunca de uma lista escrita aqui:
//   Telas 1 e 3  `contagem.dfc === null` quer dizer "este indicador não tem lado do DFC" — o valor dele é do Omie.
//   Tela 2       a `fonteDoValor` de cada linha e de cada cartão, que a própria tela leva.
const valorEDoOmie = (i) => (i.fonteDoValor ? i.fonteDoValor !== 'dfc' : i.contagem.dfc === null);
// O valor que a tela mostra: cartão e linha do DRE guardam em campos diferentes, e nas Telas 1 e 3 um bloco guarda
// `dados` em vez de valor. `undefined` é "este indicador não tem valor nenhum", e não entra na conta.
const valorDe = (i) => (i.valor !== undefined ? i.valor : (i.total !== undefined ? i.total : undefined));

// ================================================================ 1. ligada, ela não existe

for (const [tela, nada, liga] of [['Tela 1', t1Nada, t1Liga], ['Tela 2', t2Nada, t2Liga], ['Tela 3', t3Nada, t3Liga]]) {
  const a = todosDe(nada), b = todosDe(liga);
  const iguais = a.length === b.length && a.every((x, n) => {
    const y = b[n];
    return x.id === y.id && valorDe(x) === valorDe(y)
      && x.contagem.dfc === y.contagem.dfc && x.contagem.omie === y.contagem.omie
      && (x.semOmie ?? null) === null && (y.semOmie ?? null) === null;
  });
  confere(`${tela}: com a chave LIGADA (\`?omie=1\`) os ${a.length} indicadores são idênticos aos de sem \`omie\` na URL`,
    iguais, 'algum indicador mudou de valor, de contagem ou ganhou frase de "sem o Omie"');
}

// ================================================================ 2. desligada, o lado do DFC não se move

for (const [tela, liga, sem] of [['Tela 1', t1Liga, t1Sem], ['Tela 2', t2Liga, t2Sem], ['Tela 3', t3Liga, t3Sem]]) {
  const a = todosDe(liga), b = todosDe(sem);
  const contagensIguais = a.every((x, n) => x.contagem.dfc === b[n].contagem.dfc);
  confere(`${tela}: com a chave DESLIGADA a contagem do DFC dos ${a.length} indicadores é a mesma de quando ela está ligada`,
    contagensIguais, 'alguma contagem do DFC mudou — a chave mexeu no que não é dela');

  const doDfc = a.map((x, n) => [x, b[n]]).filter(([x]) => !valorEDoOmie(x) && valorDe(x) !== undefined);
  const valoresIguais = doDfc.every(([x, y]) => valorDe(x) === valorDe(y));
  confere(`${tela}: com a chave DESLIGADA o valor dos ${doDfc.length} indicadores de fonte DFC é o mesmo de quando ela está ligada`,
    valoresIguais, 'algum valor de fonte DFC mudou');
}

// ================================================================ 3. desligada, o lado do Omie sai como ausência

for (const [tela, sem] of [['Tela 1', t1Sem], ['Tela 2', t2Sem], ['Tela 3', t3Sem]]) {
  const b = todosDe(sem);
  confere(`${tela}: com a chave DESLIGADA a contagem do Omie dos ${b.length} indicadores sai (é \`null\`, e nunca zero)`,
    b.every((y) => y.contagem.omie === null),
    `${b.filter((y) => y.contagem.omie !== null).map((y) => y.id).join(', ')} ainda trazem contagem do Omie`);

  const doOmie = b.filter(valorEDoOmie);
  confere(`${tela}: com a chave DESLIGADA os ${doOmie.length} indicadores de fonte Omie ficam sem valor (\`null\`, e nunca zero)`,
    doOmie.every((y) => valorDe(y) === null),
    `${doOmie.filter((y) => valorDe(y) !== null).map((y) => y.id).join(', ')} ainda trazem valor`);

  confere(`${tela}: com a chave DESLIGADA os ${doOmie.length} indicadores de fonte Omie dizem por quê, ali mesmo (\`semOmie[]\`)`,
    doOmie.every((y) => (y.semOmie ?? []).length > 0),
    `${doOmie.filter((y) => !(y.semOmie ?? []).length).map((y) => y.id).join(', ')} ficaram sem número e sem frase`);
}

// ================================================================ o caso real que `docs/filtros.md` cita
//
// Um indicador de cada lado da Tela 1, no mesmo mês, para o dono ver a chave fazendo as duas coisas de uma vez.

const acha = (d, id) => todosDe(d).find((x) => x.id === id);
const despesasLiga = acha(t1Liga, 'despesas'), despesasSem = acha(t1Sem, 'despesas');
const pendLiga = acha(t1Liga, 'despesas-pendentes'), pendSem = acha(t1Sem, 'despesas-pendentes');

console.log(linhas.join('\n'));
console.log('');
console.log(`O CASO REAL — Tela 1, ${String(MES).padStart(2, '0')}/${ANO}, dois cartões vizinhos:`);
console.log(`  "Despesas" (fonte DFC)         ligada: ${despesasLiga.contagem.dfc} do DFC · ${despesasLiga.contagem.omie} do Omie`);
console.log(`                                 desligada: ${despesasSem.contagem.dfc} do DFC · sem o Omie`
  + `  (valor ${despesasLiga.valor === despesasSem.valor ? 'INTACTO' : 'MUDOU'})`);
console.log(`  "Desp. Pendentes" (fonte Omie) ligada: ${pendLiga.contagem.omie} títulos a pagar do Omie`);
console.log(`                                 desligada: sem o Omie, valor ${pendSem.valor === null ? '`null`' : pendSem.valor}`
  + `, com ${(pendSem.semOmie ?? []).length} frase(s) no lugar do número`);
console.log('');
console.log(`${conferidos + divergentes.length} afirmações: ${conferidos} conferidas, ${divergentes.length} divergentes`);
if (divergentes.length) process.exit(1);
