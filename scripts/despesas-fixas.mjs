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

// A RESPOSTA, COMO A GESTORA A ESCREVEU. O combinado era a coluna D ("Fixa", "Variável", "Não é despesa"). Na primeira
// resposta (28/09/2026) ela escreveu na coluna C, trocando o cabeçalho "Sugestão" por "CAT DESP." e usando o
// vocabulário dela — "DESPESA FIXAS" e "DESPESA VARIAVEL". Vale a D quando preenchida; senão a C, mas SÓ se o cabeçalho
// da C não for mais "Sugestão" (a sugestão nunca vale como resposta).
const qualResposta = (texto) => {
  const t = norm(texto);
  if (!t) return null;
  if (t === 'NAO E DESPESA') return 'naoEDespesa';
  if (/^(DESPESAS? )?FIXAS?$/.test(t)) return 'fixas';
  if (/^(DESPESAS? )?VARIAVE(L|IS)$/.test(t)) return 'variaveis';
  return undefined;
};
const saida = { fixas: [], variaveis: [], naoEDespesa: [], semResposta: [] };
const invalidas = [];
for (const nome of ['Classificar', 'Fora da classificação']) {
  const aba = abas.find((a) => a.nome === nome);
  if (!aba) { console.error(`a planilha não tem a aba "${nome}"`); process.exit(1); }
  const linhas = lerAba(zip, aba.parte, ss);
  const cabecalhoC = norm(linhas.find((l) => l.n === 1)?.cel.get('C')?.t);
  const cValeComoResposta = cabecalhoC !== '' && cabecalhoC !== 'SUGESTAO';
  for (const l of linhas) {
    if (l.n === 1) continue;
    const conta = l.cel.get('B')?.t?.trim();
    if (!conta) continue;
    const resposta = l.cel.get('D')?.t || (cValeComoResposta ? l.cel.get('C')?.t : '') || '';
    const onde = qualResposta(resposta);
    if (onde) saida[onde].push(conta);
    else if (onde === undefined) invalidas.push(`${nome}, linha ${l.n}: "${resposta}" (${conta})`);
    else saida.semResposta.push(conta);
  }
}
if (invalidas.length) {
  console.error(`resposta que não é Fixa, Variável nem Não é despesa (nem DESPESA FIXAS / DESPESA VARIAVEL) — nada foi gravado:\n  ${invalidas.join('\n  ')}`);
  process.exit(1);
}

// AS CONTAS QUE SUMIRAM DA RESPOSTA: as da planilha que mandamos e que não voltaram em linha nenhuma (a gestora pode
// apagar linhas). Não entram como fixas; ficam anotadas, para alguém perguntar a ela.
const MODELO = path.join(RAIZ, 'docs', 'despesas-fixas-para-classificar.xlsx');
const ausentes = [];
if (path.resolve(ENTRADA) !== MODELO && fs.existsSync(MODELO)) {
  const zm = lerZip(fs.readFileSync(MODELO));
  const ssm = sharedStrings(zm);
  const voltaram = new Set(Object.values(saida).flat().map(norm));
  for (const a of abasDo(zm).filter((x) => x.nome === 'Classificar'))
    for (const l of lerAba(zm, a.parte, ssm)) {
      const conta = l.n > 1 ? l.cel.get('B')?.t?.trim() : null;
      if (conta && !voltaram.has(norm(conta))) ausentes.push(conta);
    }
}

const respondido = saida.fixas.length > 0;
fs.writeFileSync(SAIDA, `${JSON.stringify({
  'o-que-e': 'Quais contas do DFC (coluna SUB 2 da aba FLUXO DE CAIXA) são despesa FIXA. Quem decide é a gestora do financeiro, respondendo docs/despesas-fixas-para-classificar.xlsx; quem grava este arquivo é scripts/despesas-fixas.mjs, lendo a planilha respondida. Enquanto a lista estiver vazia, a tela Fluxo de Caixa não mostra número de despesa fixa: diz que a classificação está pendente.',
  respondido,
  respondidoEm: respondido ? new Date().toISOString().slice(0, 10) : null,
  ...saida,
  ausentesDaResposta: ausentes,
}, null, 2)}\n`);
console.log(`${saida.fixas.length} fixas · ${saida.variaveis.length} variáveis · ${saida.naoEDespesa.length} não são despesa · ${saida.semResposta.length} sem resposta · ${ausentes.length} ausentes da resposta${ausentes.length ? ` (${ausentes.join(', ')})` : ''} → ${path.relative(RAIZ, SAIDA)}`);
