// A TELA DE ADMINISTRADOR ESCREVENDO NO CADASTRO — `POST /api/admin/usuarios`, com o formulário de `/admin`.
//   acao=criar     email, senha, admin (caixa)  → cria a pessoa, ativa
//   acao=desativar email                        → a pessoa não entra mais, e a sessão aberta dela cai
//   acao=ativar    email                        → volta a entrar
//   acao=senha     email, senha                 → troca a senha, e as sessões abertas com a antiga caem
// Só administrador passa (o proxy já barra, e esta rota confere de novo). A resposta volta para `/admin` com o que
// aconteceu na URL; senha nenhuma vai na URL.

import { quemPediu } from '../../../../lib/acesso/sessao.mjs';
import { criar, mudarAtivo, trocarSenha } from '../../../../lib/acesso/usuarios.mjs';

export const dynamic = 'force-dynamic';

const voltar = (q) => new Response(null, { status: 303, headers: { Location: `/admin?${new URLSearchParams(q)}` } });

export async function POST(pedido) {
  const quem = quemPediu(pedido);
  if (!quem) return Response.json({ ok: false, erro: 'é preciso entrar' }, { status: 401 });
  if (!quem.admin) return Response.json({ ok: false, erro: 'só administrador' }, { status: 403 });
  const f = await pedido.formData().catch(() => null);
  const acao = String(f?.get('acao') ?? '');
  const email = String(f?.get('email') ?? '');
  try {
    if (acao === 'criar') await criar({ email, senha: f.get('senha'), admin: f.get('admin') === 'on' });
    else if (acao === 'desativar') {
      if (email.trim().toLowerCase() === quem.email) throw new Error('não dá para desativar a si mesmo');
      await mudarAtivo(email, false);
    } else if (acao === 'ativar') await mudarAtivo(email, true);
    else if (acao === 'senha') await trocarSenha(email, f.get('senha'));
    else throw new Error('ação desconhecida');
    return voltar({ ok: `${acao}: ${email}` });
  } catch (e) {
    return voltar({ erro: e.message });
  }
}
