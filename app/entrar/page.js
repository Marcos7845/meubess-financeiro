// ENTRAR — e-mail e senha. O formulário vai para `POST /api/entrar`, que grava a sessão e volta para a tela pedida.
// Só o administrador cadastra alguém (tela /admin); não há "criar conta" aqui.

import { redirect } from 'next/navigation';
import { loginLigado } from '../../lib/acesso/sessao.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar · MeuBESS Financeiro' };

const ERROS = {
  1: 'E-mail ou senha não conferem, ou esse acesso não está ativo. Quem cadastra é o administrador.',
  espera: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.',
  config: 'O servidor está sem a configuração de sessão. Avise o administrador.',
};

export default async function Entrar({ searchParams }) {
  if (!loginLigado()) redirect('/');
  const q = await searchParams;
  const volta = typeof q?.volta === 'string' ? q.volta : '/';
  const erro = ERROS[q?.erro];
  return (
    <main className="entrar">
      <header>
        <img src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span>Gestão de Contas</span>
      </header>
      <form action="/api/entrar" method="post">
        {erro ? <p className="aviso">{erro}</p> : null}
        <input type="hidden" name="volta" value={volta} />
        <label>E-mail<input type="email" name="email" autoComplete="username" required autoFocus /></label>
        <label>Senha<input type="password" name="senha" autoComplete="current-password" required /></label>
        <button className="botao" type="submit">entrar</button>
      </form>
    </main>
  );
}
