import { quemPediu } from '../../../../lib/acesso/sessao.mjs';
import { responderPendencia } from '../../../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';
const MAX_CORPO = 5 * 15 * 1024 * 1024 + 1024 * 1024;
export async function POST(pedido) {
  const quem = quemPediu(pedido);
  if (!quem) return Response.json({ ok: false, erro: 'é preciso entrar' }, { status: 401 });
  const origem = pedido.headers.get('origin');
  const host = pedido.headers.get('x-forwarded-host') ?? pedido.headers.get('host');
  if (!origem || !host || (() => { try { return new URL(origem).host !== host; } catch { return true; } })())
    return Response.json({ ok: false, erro: 'pedido de outro site' }, { status: 403 });
  if (Number(pedido.headers.get('content-length') ?? 0) > MAX_CORPO)
    return Response.json({ ok: false, erro: 'envio grande demais' }, { status: 413 });
  try {
    const f = await pedido.formData();
    const anexos = f.getAll('anexos').filter((a) => a && typeof a !== 'string' && a.size);
    await responderPendencia({ pendenciaId: f.get('id'), resposta: f.get('resposta'), anexos, email: quem.email });
    return new Response(null, { status: 303, headers: { Location: '/pendencias?enviado=1' } });
  } catch (e) {
    return Response.json({ ok: false, erro: e.message }, { status: 400 });
  }
}
