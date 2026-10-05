#!/usr/bin/env node
// AS LEITURAS DO OMIE QUE FALTAVAM NO CACHE, PARA A CONFERÊNCIA DOS NÚMEROS DAS TELAS
//
// `scripts/numeros-das-telas.mjs` lê só do cache local `.cache/omie/` (fora do git). Alguns indicadores de
// `docs/fontes.md` pedem leituras que `scripts/confronto-dfc-omie.mjs` nunca fez, e por isso saíam "a conferir:".
// Este script faz essas leituras e grava no mesmo cache, com a mesma chave (empresa + serviço + método +
// sha1 dos parâmetros), para que o outro script as ache sozinho.
//
// SÓ LEITURA. Seis leituras, todas por método de consulta, nenhum que inclua, altere ou exclua:
//   0. `financas/mf` → `ListarMovimentos` SEM `cTpLancamento` por data de pagamento (01/01 a 31/12 do ano; as telas
//      cortam o que vem depois de hoje), a leitura que `docs/fontes.md` conta. Entrou aqui em 05/10/2026, quando a
//      faixa deixou de terminar em 30/09 e a chave dela mudou.
//   1. `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` por VENCIMENTO (01/01 a 31/12 do ano)
//      — "Despesas pendentes" da Tela 1.
//   2. `financas/mf` → `ListarMovimentos` SEM `cTpLancamento` por data de pagamento (01/01 a 31/12), a mesma
//      leitura que `docs/fontes.md` conta, mas COM `cExibirDepartamentos: "S"` — "Top 10 despesas" da Tela 1.
//   3. `geral/clientes` → `ListarClientesResumido` — o eixo do "Valor previsto por cliente" da Tela 3.
//   4. `geral/dre` → `ListarCadastroDRE` — o `totalizaDRE` da "Receita bruta" da Tela 2.
//   5. `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"` por VENCIMENTO, em duas janelas que
//      começam HOJE — o que resta do mês corrente e o mês seguinte inteiro — para a faixa **em aberto** do cartão
//      "Valor pendente" da Tela 3. Num mês fechado essa faixa é sempre vazia (título vencido já está pago ou
//      atrasado), então o único caso real dela está em título que ainda não venceu.
//
// NADA DO QUE VEM DO OMIE É IMPRESSO AQUI além de contagens: nem valor em reais, nem nome, nem documento, nem a
// chave — nem em erro. As respostas cruas ficam só no cache local, que o `.gitignore` mantém fora de todo commit.
//
// A CHAMADA E OS PARÂMETROS NÃO MORAM MAIS AQUI. Desde 27/09/2026 o app relê o Omie sozinho, e as duas cópias de
// "como se chama o Omie" viraram uma: `lib/regras/omie-api.mjs`. Os parâmetros de cada leitura vêm de `leiturasDe()`
// em `lib/regras/cache-omie.mjs`, o mesmo arquivo de onde as telas leem — mudar um parâmetro num lugar muda nos dois.
//
//   node scripts/ler-omie-faltante.mjs            # usa o que já está no cache e busca só o que falta
//   node scripts/ler-omie-faltante.mjs --ano 2026
//   node scripts/ler-omie-faltante.mjs --hoje 25/09/2026   # a data de onde partem as duas janelas da leitura 5

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { leiturasDe, pastaDoCacheOmie } from '../lib/regras/cache-omie.mjs';
import { PAUSA_MS, espera, garantirCredenciais, chamarOmie } from '../lib/regras/omie-api.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = pastaDoCacheOmie(RAIZ);

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const EMPRESAS = [1, 2];

// A DATA DE HOJE, de onde partem as duas janelas da leitura 5. `--hoje dd/mm/aaaa` a fixa; sem isso, é o dia de hoje.
const dois = (x) => String(x).padStart(2, '0');
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();
const HOJE = arg('--hoje', (() => { const d = new Date(); return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`; })());
const hj = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(HOJE);
if (!hj) { console.error('--hoje precisa ser dd/mm/aaaa'); process.exit(1); }
const [HD, HM, HA] = [Number(hj[1]), Number(hj[2]), Number(hj[3])];
const [SM, SA] = HM === 12 ? [1, HA + 1] : [HM + 1, HA];
// O que resta do mês corrente (de hoje ao último dia) e o mês seguinte inteiro.
const JANELA_CORRENTE = [`${dois(HD)}/${dois(HM)}/${HA}`, `${ultimoDia(HA, HM)}/${dois(HM)}/${HA}`];
const JANELA_SEGUINTE = [`01/${dois(SM)}/${SA}`, `${ultimoDia(SA, SM)}/${dois(SM)}/${SA}`];

const falhar = (m) => { console.error(m); process.exit(1); };

let doCache = 0, doOmie = 0;

// A chamada é a de `lib/regras/omie-api.mjs` — endereço, credencial, tentativas, pausa do limite de consumo e a
// gravação no cache, tudo lá. Aqui só se conta o que veio de onde, e um erro encerra o script com a mensagem.
async function chamar(emp, servico, call, param) {
  try {
    const { json, doOmie: veio } = await chamarOmie({ raiz: RAIZ, emp, servico, call, param });
    if (veio) doOmie++; else doCache++;
    return { json, veioDoCache: !veio };
  } catch (e) { return falhar(e.message); }
}

// Percorre todas as páginas de uma leitura paginada. `param(n)` monta os parâmetros da página n.
async function todasAsPaginas(emp, servico, call, param, campo, rotulo) {
  let total = 1, itens = 0;
  for (let n = 1; n <= total; n++) {
    const { json, veioDoCache } = await chamar(emp, servico, call, param(n));
    total = Number(json.nTotPaginas ?? json.total_de_paginas) || 1;
    itens += (json[campo] ?? []).length;
    if (n === 1 || n % 10 === 0 || n === total) console.log(`    empresa ${emp} — ${rotulo}: página ${n}/${total}, ${itens} registro(s)`);
    if (!veioDoCache) await espera(PAUSA_MS);
  }
  return itens;
}

// ---------------------------------------------------------------- as seis leituras
//
// TODAS SAEM DE `leiturasDe()` em `lib/regras/cache-omie.mjs`, que é o arquivo por onde as telas ACHAM cada leitura
// no cache. Por isso o que este script grava cai exatamente na chave que a tela vai abrir.
//   0. `MF`       — a leitura de caixa que `docs/fontes.md` conta (de 01/01 a 31/12; as telas cortam em hoje).
//   1. `CP_VENC`  — títulos a pagar em aberto por VENCIMENTO, o "Despesas pendentes" da Tela 1.
//   2. `MF_DEP`   — a leitura de caixa que `docs/fontes.md` conta, COM o rateio por departamento.
//   3. `CLIENTES` — o cadastro de clientes, resumido.
//   4. `DRE`      — o cadastro das contas do DRE.
//   5. `TIT_R`    — títulos a receber por VENCIMENTO nas duas janelas que começam hoje (a faixa "em aberto").
const L = leiturasDe(ANO);

async function principal() {
  try { garantirCredenciais({ raiz: RAIZ, empresas: EMPRESAS }); }
  catch (e) { falhar(e.message); }

  for (const emp of EMPRESAS) {
    console.log(`  empresa ${emp}`);
    await todasAsPaginas(emp, 'financas/mf', 'ListarMovimentos', L.MF, 'movimentos', 'caixa por data de pagamento');
    await todasAsPaginas(emp, 'financas/mf', 'ListarMovimentos', L.CP_VENC, 'movimentos', 'títulos a pagar por vencimento (CP)');
    await todasAsPaginas(emp, 'financas/mf', 'ListarMovimentos', L.MF_DEP, 'movimentos', 'caixa com departamentos');
    await todasAsPaginas(emp, 'geral/clientes', 'ListarClientesResumido', L.CLIENTES, 'clientes_cadastro_resumido', 'clientes (resumido)');
    const { json, veioDoCache } = await chamar(emp, 'geral/dre', 'ListarCadastroDRE', L.DRE);
    console.log(`    empresa ${emp} — cadastro do DRE: ${(json.dreLista ?? []).length} conta(s)`);
    if (!veioDoCache) await espera(PAUSA_MS);
    for (const [rotulo, [de, ate]] of [['resto do mês corrente', JANELA_CORRENTE], ['mês seguinte inteiro', JANELA_SEGUINTE]])
      await todasAsPaginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', (n) => L.TIT_R(n, de, ate),
        'titulosEncontrados', `títulos a receber por vencimento, ${rotulo} (${de} a ${ate})`);
  }
  console.log(`\n${doCache} resposta(s) já estavam no cache, ${doOmie} vieram do Omie agora.`);
  console.log(`Cache: ${path.relative(RAIZ, CACHE)} (fora do git).`);
}

principal();
