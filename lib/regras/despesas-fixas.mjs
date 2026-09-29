// QUAIS CONTAS DO DFC SÃO DESPESA FIXA — a lista que a tela Fluxo de Caixa usa, e nenhuma outra.
//
// DE ONDE VEM. Nem o DFC nem o Omie marcam uma despesa como fixa. Quem decide é a gestora do financeiro (pedido do
// dono, 28/09/2026), respondendo `docs/despesas-fixas-para-classificar.xlsx` conta por conta — as 55 contas de despesa
// da coluna `SUB 2` (J) do `FLUXO DE CAIXA`, cadastradas na aba `BASE`. `scripts/despesas-fixas.mjs` lê a planilha
// respondida e grava `dados/despesas-fixas.json`; este arquivo só lê o JSON.
//
// SEM RESPOSTA, SEM NÚMERO. Enquanto `respondido` for `false`, a tela não soma despesa fixa nenhuma e diz que a
// classificação está pendente — uma lista escrita por quem não é da área seria número inventado.

import fs from 'node:fs';
import path from 'node:path';

import { norm } from './dfc.mjs';

function lerDespesasFixas(raiz) {
  const arquivo = path.join(raiz, 'dados', 'despesas-fixas.json');
  let j = null;
  try { j = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { j = null; }
  const fixas = Array.isArray(j?.fixas) ? j.fixas.map(norm).filter(Boolean) : [];
  return {
    respondido: Boolean(j?.respondido) && fixas.length > 0,
    respondidoEm: j?.respondidoEm ?? null,
    // No mesmo formato das linhas do DFC (`norm`: maiúscula, sem acento), que é como `lerMesDoDfc` guarda o `SUB 2`.
    fixas: new Set(fixas),
    semResposta: Array.isArray(j?.semResposta) ? j.semResposta : [],
    // AS TRÊS CONTAS DE DESPESA QUE NÃO VOLTARAM na resposta da gestora (`ausentesDaResposta`), e que por isso ficam
    // fora das fixas até ela dizer. Não confundir com `semResposta`, que são as 14 contas da OUTRA aba — receitas,
    // saldos e transferências —, que não são despesa e nunca foram para ela classificar.
    ausentesDaResposta: Array.isArray(j?.ausentesDaResposta) ? j.ausentesDaResposta : [],
  };
}

export { lerDespesasFixas };
