import { segredoDaPonteConfere, recusarPonte } from '../../../../../../lib/pendencias-acesso.mjs';
import { obterAnexo } from '../../../../../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';
export async function GET(pedido, { params }) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  try {
    const { nome, conteudo } = obterAnexo((await params).id);
    return new Response(conteudo, { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'Cache-Control': 'private, no-store',
    } });
  } catch { return Response.json({ ok: false, erro: 'anexo não encontrado' }, { status: 404 }); }
}
