// A PORTA DAS TRÊS TELAS — todo pedido passa aqui antes de chegar a uma tela ou a uma rota de API.
//
// (No Next 16 o antigo `middleware` se chama `proxy` e roda no Node.js — ver node_modules/next/dist/docs/01-app/
// 01-getting-started/16-proxy.md.)
//
//   sem login          → tela: vai para /entrar (e volta depois); API: 401
//   logado, não admin  → /admin e /api/admin/*: 403
//   livres             → /entrar e /api/entrar (é por onde se entra); /api/dfc nem passa aqui (ver `matcher`) e
//                        tem o segredo próprio, para o PC
//
// As rotas de API conferem o login de novo por conta própria (o proxy não é a única tranca). Com
// `MEUBESS_LOGIN=desligado` — só o `npm run local`, que atende 127.0.0.1 — tudo passa, como antes.

import { NextResponse } from 'next/server';
import { loginLigado, quemPediu, segredo } from './lib/acesso/sessao.mjs';

const LIVRES = new Set(['/entrar', '/api/entrar']);

const recusa = (status, erro) => Response.json({ ok: false, erro }, { status });

export function proxy(pedido) {
  if (!loginLigado()) return;
  const caminho = pedido.nextUrl.pathname;

  // Um POST de formulário vindo de outro site não passa, mesmo que o navegador levasse o cookie.
  if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
    const origem = pedido.headers.get('origin');
    const host = pedido.headers.get('x-forwarded-host') ?? pedido.headers.get('host');
    if (origem) {
      let deOutro = true;
      try { deOutro = new URL(origem).host !== host; } catch { /* origem malformada ou "null": recusa */ }
      if (deOutro) return recusa(403, 'pedido de outro site');
    }
  }

  if (LIVRES.has(caminho)) return;

  const eApi = caminho.startsWith('/api/');
  if (!segredo()) return recusa(503, 'o servidor está sem SESSAO_SEGREDO; ninguém entra até ela ser configurada');

  const quem = quemPediu(pedido);
  if (!quem) {
    if (eApi) return recusa(401, 'é preciso entrar');
    const para = pedido.nextUrl.clone();
    para.pathname = '/entrar';
    para.search = `?volta=${encodeURIComponent(caminho + pedido.nextUrl.search)}`;
    return NextResponse.redirect(para, 307);
  }
  if ((caminho === '/admin' || caminho.startsWith('/api/admin/')) && !quem.admin) return recusa(403, 'só administrador');
}

export const config = {
  // Tudo, menos os arquivos do próprio Next, a pasta pública da marca (o logo aparece na tela de entrar) e
  // `/api/dfc`: o proxy guardaria só os primeiros 10 MB do corpo (`proxyClientMaxBodySize`), e o envio do DFC é
  // maior que isso. Ela não fica aberta: a própria rota exige o segredo do envio.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|marca/|api/dfc$).*)'],
};
