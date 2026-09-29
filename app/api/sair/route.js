// SAIR — apaga o cookie da sessão e volta para `/entrar`.
import { cookieQueApaga } from '../../../lib/acesso/sessao.mjs';

export const dynamic = 'force-dynamic';

export async function POST() {
  return new Response(null, { status: 303, headers: { Location: '/entrar', 'Set-Cookie': cookieQueApaga() } });
}
