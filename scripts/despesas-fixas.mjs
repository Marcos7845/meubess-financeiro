// LÊ A PLANILHA DAS DESPESAS FIXAS RESPONDIDA PELA GESTORA E GRAVA `dados/despesas-fixas.json`.
//
//   node scripts/despesas-fixas.mjs <caminho da planilha respondida>
//   node scripts/despesas-fixas.mjs                    # lê docs/despesas-fixas-para-classificar.xlsx
//
// A planilha é a que `docs/despesas-fixas-para-classificar.xlsx` mandou: aba "Classificar" (as 55 contas de despesa
// do `SUB 2` do DFC) e aba "Fora da classificação" (as 14 que deixamos de fora por não serem despesa). Vale a coluna D,
// "Resposta da gestora" — Fixa, Variável ou Não é despesa. A coluna C (a sugestão) NÃO conta: conta sem resposta fica
// em `semResposta` e não entra como fixa. Só nomes de conta: a planilha não tem, e este script não grava, valor nenhum.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lerZip, sharedStrings, abasDo, lerAba } from '../lib/regras/xlsx.mjs';
import { norm } from '../lib/regras/dfc.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = path.resolve(process.argv[2] ?? path.join(RAIZ, 'docs', 'despesas-fixas-para-classificar.xlsx'));
const SAIDA = path.join(RAIZ, 'dados', 'despesas-fixas.json');

const zip = lerZip(fs.readFileSync(ENTRADA));
const ss = sharedStrings(zip);
const abas = abasDo(zip);

const RESPOSTAS = { FIXA: 'fixas', VARIAVEL: 'variaveis', 'NAO E DESPESA': 'naoEDespesa' };
const saida = { fixas: [], variaveis: [], naoEDespesa: [], semResposta: [] };
const invalidas = [];
for (const nome of ['Classificar', 'Fora da classificação']) {
  const aba = abas.find((a) => a.nome === nome);
  if (!aba) { console.error(`a planilha não tem a aba "${nome}"`); process.exit(1); }
  for (const l of lerAba(zip, aba.parte, ss)) {
    if (l.n === 1) continue;
    const conta = l.cel.get('B')?.t;
    if (!conta) continue;
    const resposta = l.cel.get('D')?.t ?? '';
    const onde = RESPOSTAS[norm(resposta)];
    if (onde) saida[onde].push(conta);
    else if (resposta) invalidas.push(`${nome}, linha ${l.n}: "${resposta}" (${conta})`);
    else saida.semResposta.push(conta);
  }
}
if (invalidas.length) {
  console.error(`resposta que não é Fixa, Variável nem Não é despesa — nada foi gravado:\n  ${invalidas.join('\n  ')}`);
  process.exit(1);
}

const respondido = saida.fixas.length > 0;
fs.writeFileSync(SAIDA, `${JSON.stringify({
  'o-que-e': 'Quais contas do DFC (coluna SUB 2 da aba FLUXO DE CAIXA) são despesa FIXA. Quem decide é a gestora do financeiro, respondendo docs/despesas-fixas-para-classificar.xlsx; quem grava este arquivo é scripts/despesas-fixas.mjs, lendo a planilha respondida. Enquanto a lista estiver vazia, a tela Fluxo de Caixa não mostra número de despesa fixa: diz que a classificação está pendente.',
  respondido,
  respondidoEm: respondido ? new Date().toISOString().slice(0, 10) : null,
  ...saida,
}, null, 2)}\n`);
console.log(`${saida.fixas.length} fixas · ${saida.variaveis.length} variáveis · ${saida.naoEDespesa.length} não são despesa · ${saida.semResposta.length} sem resposta → ${path.relative(RAIZ, SAIDA)}`);
