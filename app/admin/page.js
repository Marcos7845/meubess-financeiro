// AS PESSOAS COM ACESSO — a tela do administrador. Cria, desativa (e reativa) e troca a senha de cada pessoa.
// Todo mundo cadastrado e ativo vê as três telas; "administrador" é só quem, além disso, entra aqui.
// Os formulários vão para `POST /api/admin/usuarios`. Nenhuma senha é mostrada, nem a embaralhada.

import { exigirLogin } from '../sessao.js';
import { listar, SENHA_MINIMA } from '../../lib/acesso/usuarios.mjs';
import { diaEmBrasilia as dia } from '../horario-brasilia.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pessoas com acesso · MeuBESS Financeiro' };

export default async function Admin({ searchParams }) {
  const quem = await exigirLogin({ admin: true });
  const q = await searchParams;
  const pessoas = listar();
  return (
    <div className="tela">
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">Pessoas com acesso</span>
        <nav className="abas"><a href="/">voltar às telas</a></nav>
      </header>
      <main className="admin">
        {q?.ok ? <p className="ok">Feito — {String(q.ok)}.</p> : null}
        {q?.erro ? <p className="aviso">Não deu: {String(q.erro)}.</p> : null}

        <h2>Quem entra</h2>
        <table>
          <thead><tr><th>e-mail</th><th>papel</th><th>situação</th><th>senha trocada em</th><th /></tr></thead>
          <tbody>
            {pessoas.length === 0 ? <tr><td colSpan={5}>Ninguém cadastrado ainda.</td></tr> : null}
            {pessoas.map((p) => (
              <tr key={p.email}>
                <td>{p.email}{p.email === quem.email ? ' (você)' : ''}</td>
                <td>{p.admin ? 'administrador' : 'vê as telas'}</td>
                <td>{p.ativo ? 'ativo' : 'desativado'}</td>
                <td>{dia(p.senhaTrocadaEm)}</td>
                <td>
                  <form action="/api/admin/usuarios" method="post">
                    <input type="hidden" name="email" value={p.email} />
                    <input type="hidden" name="acao" value={p.ativo ? 'desativar' : 'ativar'} />
                    <button className="botao" type="submit" disabled={p.email === quem.email}>{p.ativo ? 'desativar' : 'reativar'}</button>
                  </form>{' '}
                  <form action="/api/admin/usuarios" method="post">
                    <input type="hidden" name="email" value={p.email} />
                    <input type="hidden" name="acao" value="senha" />
                    <input type="password" name="senha" placeholder="senha nova" minLength={SENHA_MINIMA} required autoComplete="new-password" />
                    <button className="botao" type="submit">trocar senha</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Cadastrar alguém</h2>
        <form className="bloco" action="/api/admin/usuarios" method="post">
          <input type="hidden" name="acao" value="criar" />
          <label>E-mail<input type="email" name="email" required autoComplete="off" /></label>
          <label>Senha inicial (pelo menos {SENHA_MINIMA} caracteres; passe à pessoa por um canal seu)
            <input type="password" name="senha" minLength={SENHA_MINIMA} required autoComplete="new-password" /></label>
          <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" name="admin" /> administrador (também cadastra pessoas)</label>
          <button className="botao" type="submit">cadastrar</button>
        </form>
      </main>
    </div>
  );
}
