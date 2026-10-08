// A PÁGINA INICIAL É O FLUXO DE CAIXA (pedido do dono, 08/10/2026). Este endereço só leva a ele, com o mesmo ano, mês,
// empresa, conta, unidade e chave do Omie da URL, como `app/receber/page.js` faz com a antiga Contas a Receber.
//
// A TELA 1 — GESTÃO DE CONTAS — não foi apagada: mudou para `/gestao-de-contas` (`app/gestao-de-contas/page.js`) e só
// deixou de ter botão no menu do topo. Um link antigo `/?cc=TI` abre o Fluxo de Caixa sem os filtros da Tela 1, que o
// Fluxo não tem.

import { redirect } from 'next/navigation';
import { exigirLogin } from './sessao.js';

export const dynamic = 'force-dynamic';

export default async function Pagina({ searchParams }) {
  await exigirLogin();
  const q = await searchParams;
  const leva = new URLSearchParams();
  for (const k of ['ano', 'mes', 'empresa', 'conta', 'unidade', 'omie']) if (q?.[k]) leva.set(k, String(q[k]));
  redirect(`/fluxo-de-caixa${leva.size ? `?${leva}` : ''}`);
}
