// O LOGIN — `POST /api/entrar`, com o formulário de `/entrar` (e-mail, senha e para onde voltar).
//
// Certo: grava o cookie da sessão e volta para a tela pedida. Errado: volta para `/entrar?erro=1` — a MESMA resposta
// para e-mail sem cadastro, pessoa desativada e senha errada, para a tela não ensinar quais e-mails existem. Recusa até
// a janela de 15 minutos passar depois de 8 tentativas erradas do mesmo endereço para o mesmo e-mail, ou de 20 para o
// mesmo e-mail vindas de qualquer endereço.

import { autenticar, normalizar } from '../../../lib/acesso/usuarios.mjs';
import { emitir, cookieDaSessao, segredo } from '../../../lib/acesso/sessao.mjs';
import { criarLimite } from '../../../lib/acesso/tentativas.mjs';

export const dynamic = 'force-dynamic';

const JANELA_MS = 15 * 60 * 1000, TENTATIVAS = 8, TENTATIVAS_POR_EMAIL = 20, TETO_DO_MAPA = 5000;
const erradas = criarLimite({ janelaMs: JANELA_MS, teto: TETO_DO_MAPA });

const destino = (volta) => (typeof volta === 'string' && /^\/(?![/\\])/.test(volta) && !volta.startsWith('/api/') ? volta : '/');
const redirecionar = (para, extra = {}) => new Response(null, { status: 303, headers: { Location: para, ...extra } });

export async function POST(pedido) {
  const form = await pedido.formData().catch(() => null);
  const email = normalizar(form?.get('email'));
  const senha = String(form?.get('senha') ?? '');
  const volta = destino(form?.get('volta'));
  const naVolta = `&volta=${encodeURIComponent(volta)}`;
  if (!segredo()) return redirecionar(`/entrar?erro=config${naVolta}`);

  // O cliente escreve o x-forwarded-for que quiser; o proxy do Railway acrescenta o endereço real no FIM. Por isso o
  // endereço é o último salto, e não o primeiro. Como fora do Railway nem o último é confiável, há também uma chave só
  // pelo e-mail, com teto próprio, que nenhum cabeçalho zera.
  const ip = (pedido.headers.get('x-forwarded-for') ?? '').split(',').at(-1).trim() || 'local';
  const chaves = [[`ip|${ip}|${email}`, TENTATIVAS], [`email|${email}`, TENTATIVAS_POR_EMAIL]];
  if (chaves.some(([c, limite]) => erradas.bloqueado(c, limite))) return redirecionar(`/entrar?erro=espera${naVolta}`);

  const pessoa = email && senha ? await autenticar(email, senha) : null;
  if (!pessoa) {
    for (const [c] of chaves) erradas.errou(c);
    return redirecionar(`/entrar?erro=1${naVolta}`);
  }
  for (const [c] of chaves) erradas.esquecer(c);
  return redirecionar(volta, { 'Set-Cookie': cookieDaSessao(emitir(pessoa)) });
}
