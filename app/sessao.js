// A SESSÃO DENTRO DAS TELAS — a segunda tranca (a primeira é o `proxy.js`) e o "quem está aqui" do rodapé.
//
// `exigirLogin()` é chamada no começo de cada tela: sem sessão válida, manda para /entrar. `Sessao` mostra no rodapé
// o e-mail de quem entrou, o link da tela de administrador para quem é, e o botão de sair. Com o login desligado
// (`npm run local`), não mostra nada.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, loginLigado, quemE } from '../lib/acesso/sessao.mjs';

async function quemEstaAqui() {
  if (!loginLigado()) return { email: 'local', admin: true, local: true };
  return quemE((await cookies()).get(COOKIE)?.value);
}

export async function exigirLogin({ admin = false } = {}) {
  const quem = await quemEstaAqui();
  if (!quem) redirect('/entrar');
  if (admin && !quem.admin) redirect('/');
  return quem;
}

export default async function Sessao() {
  const quem = await quemEstaAqui();
  if (!quem || quem.local) return null;
  return (
    <span className="sessao">
      {quem.email} · <a href="/pendencias">pendências</a>
      {quem.admin ? <> · <a href="/admin">pessoas com acesso</a></> : null}
      {' · '}
      <form action="/api/sair" method="post" className="sair"><button type="submit">sair</button></form>
    </span>
  );
}
