import { segredoDaPonteConfere, recusarPonte } from '../../../../lib/pendencias-acesso.mjs';
import { publicarPendencia, respostasDesde } from '../../../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';
const falha = (e) => Response.json({ ok: false, erro: e.message }, { status: 400 });

export async function PUT(pedido) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  try {
    const corpo = await pedido.json();
    return Response.json({ ok: true, pendencia: await publicarPendencia(corpo) });
  } catch (e) { return falha(e); }
}
export async function GET(pedido) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  try {
    const valor = new URL(pedido.url).searchParams.get('desde') ?? '0';
    if (!/^(0|[1-9]\d*)$/.test(valor)) throw new Error('marcador inválido');
    return Response.json({ ok: true, ...respostasDesde(Number(valor)) });
  } catch (e) { return falha(e); }
}
