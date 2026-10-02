import crypto from 'node:crypto';

export function segredoDaPonteConfere(pedido) {
  const esperado = process.env.PENDENCIAS_PONTE_SEGREDO;
  const cabecalho = pedido.headers.get('authorization') ?? '';
  if (!esperado || !/^Bearer\s+\S+$/i.test(cabecalho)) return false;
  const veio = cabecalho.replace(/^Bearer\s+/i, '');
  const hash = (valor) => crypto.createHash('sha256').update(valor).digest();
  return crypto.timingSafeEqual(hash(veio), hash(esperado));
}
export const recusarPonte = () => Response.json({ ok: false, erro: 'segredo ausente ou errado' }, { status: 401 });
