import { segredoDaPonteConfere, recusarPonte } from '../../../../../lib/pendencias-acesso.mjs';
import { listarPendencias } from '../../../../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';

export async function GET(pedido) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  const pendencias = listarPendencias().map(({ id, titulo, status, pedido, motivo }) => ({
    id, titulo, status, pedido, motivo,
  }));
  return Response.json({ ok: true, pendencias });
}
