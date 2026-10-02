import { segredoDaPonteConfere, recusarPonte } from '../../../../../lib/pendencias-acesso.mjs';
import { marcarRecebida } from '../../../../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';
export async function POST(pedido) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  try { return Response.json({ ok: true, resposta: await marcarRecebida((await pedido.json()).id) }); }
  catch (e) { return Response.json({ ok: false, erro: e.message }, { status: 400 }); }
}
