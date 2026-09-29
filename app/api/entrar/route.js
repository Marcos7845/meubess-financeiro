// O LOGIN — `POST /api/entrar`, com o formulário de `/entrar` (e-mail, senha e para onde voltar).
//
// Certo: grava o cookie da sessão e volta para a tela pedida. Errado: volta para `/entrar?erro=1` — a MESMA resposta
// para e-mail sem cadastro, pessoa desativada e senha errada, para a tela não ensinar quais e-mails existem. Depois de
// 8 tentativas erradas em 15 minutos do mesmo endereço de rede para o mesmo e-mail, recusa até a janela passar.

import { autenticar, normalizar } from '../../../lib/acesso/usuarios.mjs';
import { emitir, cookieDaSessao, segredo } from '../../../lib/acesso/sessao.mjs';

export const dynamic = 'force-dynamic';

const JANELA_MS = 15 * 60 * 1000, TENTATIVAS = 8;
const erradas = new Map();

const destino = (volta) => (typeof volta === 'string' && /^\/(?![/\\])/.test(volta) && !volta.startsWith('/api/') ? volta : '/');
const redirecionar = (para, extra = {}) => new Response(null, { status: 303, headers: { Location: para, ...extra } });

export async function POST(pedido) {
  const form = await pedido.formData().catch(() => null);
  const email = normalizar(form?.get('email'));
  const senha = String(form?.get('senha') ?? '');
  const volta = destino(form?.get('volta'));
  const naVolta = `&volta=${encodeURIComponent(volta)}`;
  if (!segredo()) return redirecionar(`/entrar?erro=config${naVolta}`);

  const ip = (pedido.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  const chave = `${ip}|${email}`;
  const agora = Date.now();
  const r = erradas.get(chave);
  if (r && agora - r.desde < JANELA_MS && r.n >= TENTATIVAS) return redirecionar(`/entrar?erro=espera${naVolta}`);

  const pessoa = email && senha ? await autenticar(email, senha) : null;
  if (!pessoa) {
    erradas.set(chave, r && agora - r.desde < JANELA_MS ? { ...r, n: r.n + 1 } : { desde: agora, n: 1 });
    return redirecionar(`/entrar?erro=1${naVolta}`);
  }
  erradas.delete(chave);
  return redirecionar(volta, { 'Set-Cookie': cookieDaSessao(emitir(pessoa)) });
}
