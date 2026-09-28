// A ANTIGA TELA 3 — CONTAS A RECEBER — VIROU O FLUXO DE CAIXA (pedido do dono, 28/09/2026). Este endereço continua
// existindo para um link antigo não dar em página vazia: ele leva ao Fluxo de Caixa, com o mesmo ano, mês, empresa e
// chave do Omie. Os outros filtros daqui (vencimento, status, cliente, categoria, conta) não existem lá e ficam para trás.
//
// O CÁLCULO DA ANTIGA TELA CONTINUA (`lib/indicadores/tela-3.mjs`): é dele que o Fluxo de Caixa tira o "ainda a receber
// no mês", e as conferências (`npm run conferir-telas`, `conferir-filtros`, `conferir-chave-omie`) seguem conferindo-o.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const leva = new URLSearchParams();
  for (const k of ['ano', 'mes', 'empresa', 'omie']) if (q?.[k]) leva.set(k, String(q[k]));
  redirect(`/fluxo-de-caixa${leva.size ? `?${leva}` : ''}`);
}
