// OS NÚMEROS DAS TRÊS TELAS PARA A PONTE — `GET /api/pendencias/ponte/telas?ano=&mes=&unidade=`, com o mesmo segredo
// da ponte (`PENDENCIAS_PONTE_SEGREDO`, Authorization Bearer), sem login de pessoa: fica fora do `proxy.js` pelo
// mesmo prefixo `/api/pendencias/ponte`. Devolve em JSON o mês que cada tela mostra e os cartões dela, com a fonte;
// quem monta é `lib/indicadores/telas-no-ar.mjs`, sobre as mesmas funções de `lib/dados.mjs` que as páginas usam.
// Só leitura: não escreve no Omie, nas planilhas nem nas pendências.

import { dadosDaTela1, dadosDaTela2, dadosDoFluxoDeCaixa, mesCorrente } from '../../../../../lib/dados.mjs';
import { responderTelas } from '../../../../../lib/indicadores/telas-no-ar.mjs';

export const dynamic = 'force-dynamic';

export function GET(pedido) {
  return responderTelas(pedido, { tela1: dadosDaTela1, tela2: dadosDaTela2, fluxo: dadosDoFluxoDeCaixa, mesCorrente });
}
