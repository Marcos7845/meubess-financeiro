import { exigirLogin } from '../sessao.js';
import { listarPendencias } from '../../lib/pendencias.mjs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pendências · MeuBESS Financeiro' };
const data = (iso) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export default async function Pendencias({ searchParams }) {
  await exigirLogin();
  const q = await searchParams;
  const todas = listarPendencias();
  const abertas = todas.filter((p) => p.status === 'aberta' && p.respostas.length === 0);
  const encerradas = todas.filter((p) => p.status !== 'aberta' || p.respostas.length > 0);
  const item = (p) => (
    <article className="pendencia" key={p.id}>
      <h3>{p.titulo}</h3>
      <p><strong>O que precisamos:</strong> {p.pedido}</p>
      <p><strong>Por quê:</strong> {p.motivo}</p>
      {p.respostas.map((r) => <div className="pendencia-resposta" key={r.id}>
        <strong>Resposta de {r.por} · {data(r.em)}</strong>
        <p>{r.texto}</p>
        {r.anexos.length ? <p>{r.anexos.length} {r.anexos.length === 1 ? 'arquivo enviado' : 'arquivos enviados'}: {r.anexos.map((a) => a.nome).join(', ')}</p> : null}
        <small>{r.recebidoEm ? 'Resposta recebida' : 'Aguardando recebimento'}</small>
      </div>)}
      {p.status === 'aberta' ? <form action="/api/pendencias/responder" method="post" encType="multipart/form-data" className="pendencia-form">
        <input type="hidden" name="id" value={p.id} />
        <label htmlFor={`resposta-${p.id}`}>Sua resposta</label>
        <textarea id={`resposta-${p.id}`} name="resposta" rows={4} maxLength={20000} required />
        <label htmlFor={`anexos-${p.id}`}>Arquivos, se precisar (até 5; 15 MB cada)</label>
        <input id={`anexos-${p.id}`} name="anexos" type="file" multiple accept=".xlsx,.xls,.ods,.csv,.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.zip" />
        <button className="botao" type="submit">Enviar resposta</button>
      </form> : null}
    </article>
  );
  return <div className="tela">
    <header className="topo">
      <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
      <span className="titulo">Pendências</span>
    </header>
    <main className="pendencias">
      <h1>Pendências do financeiro</h1>
      <p>Veja o que falta responder. Sua resposta vai para quem está acompanhando o assunto.</p>
      {q?.enviado ? <p className="pendencia-aviso">Resposta enviada.</p> : null}
      <h2>Aguardando resposta ({abertas.length})</h2>
      {abertas.length ? abertas.map(item) : <p>Nenhuma pendência em aberto.</p>}
      <h2>Respondidas ou encerradas ({encerradas.length})</h2>
      {encerradas.length ? encerradas.map(item) : <p>Nenhuma pendência encerrada.</p>}
    </main>
  </div>;
}
