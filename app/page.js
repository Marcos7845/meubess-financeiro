// TELA 1 — GESTÃO DE CONTAS. Layout de `docs/referencias/tela-1-gestao-de-contas.jpg` (as cores daquela imagem não
// valem; as da marca ficam em `app/globals.css`).
//
// COMPONENTE DE SERVIDOR: o cálculo roda aqui, no Node, e para o navegador vai só o número já pronto. Nenhuma chave,
// nenhum caminho de pasta e nenhum arquivo cruzam essa linha.

import { dadosDaTela1, mesCorrente } from '../lib/dados.mjs';
import { NOMES_DOS_MESES, dois } from '../lib/regras/periodo.mjs';
import Atualizar from './atualizar.js';

// Sem cache do Next: quem decide quando reler é `lib/dados.mjs`, de hora em hora.
export const dynamic = 'force-dynamic';

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O dinheiro é formatado aqui, na hora de desenhar, e só aqui. Nada disso é gravado em arquivo.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const emReais = (centavos) => dinheiro.format((centavos ?? 0) / 100);

function Cartao({ c }) {
  const valor = c.tipo === 'percentual'
    ? (c.valor === null ? '—' : porcento.format(c.valor))
    : emReais(c.valor);
  return (
    <div className="cartao">
      <div className="rotulo" title={c.nome}>{c.nome}</div>
      <div className={`numero${c.negativo ? ' neg' : ''}`}>{c.negativo ? `-${valor}` : valor}</div>
      <div className="pe">
        {c.contagem.dfc !== null ? `${c.contagem.dfc} do DFC · ` : ''}{c.contagem.omie} do Omie
      </div>
    </div>
  );
}

function Barras({ itens, rotulo = (i) => i.nome }) {
  const maior = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
  return (
    <div className="barras">
      {itens.length === 0 && <p className="legenda">nenhum lançamento entrou neste mês.</p>}
      {itens.map((i, n) => (
        <div className="barra" key={n}>
          <span className="nome" title={rotulo(i)}>{rotulo(i)}</span>
          <span className="trilho"><span className="preenche" style={{ width: `${(Math.abs(i.valor) / maior) * 100}%` }} /></span>
          <span className="valor">{emReais(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  const d = await dadosDaTela1({ ano, mes });

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const bloco = (id) => d.blocos.find((b) => b.id === id);
  const dias = bloco('receita-despesa-por-dia').dados;
  const meses = bloco('receita-despesa-por-mes').dados;
  const maiorDia = Math.max(1, ...dias.flatMap((x) => [x.entradas, x.gastos]));
  const maiorMes = Math.max(1, ...meses.flatMap((x) => [x.entradas, x.gastos]));
  const anos = [2026];

  return (
    <>
      <header className="topo">
        <span className="marca">MeuBESS</span>
        <span className="titulo">Gestão de Contas</span>
        <nav className="abas">
          <span className="ativa">Dashboard</span>
          <a href={`/dre?ano=${ano}&mes=${mes}`}>DRE</a>
          <a href={`/receber?ano=${ano}&mes=${mes}`}>Contas a Receber</a>
          <span>Centro de Custo</span>
          <span>Fluxo de caixa</span>
        </nav>
      </header>

      {!d.dfc.ok && (
        <p className="aviso">
          <strong>O DFC não foi lido nesta rodada</strong> — {d.dfc.motivo}. Os cartões cuja fonte principal é o DFC
          aparecem zerados; o lado do Omie segue valendo.
        </p>
      )}

      <section className="cartoes">
        {['saldo', 'receitas', 'despesas', 'despesas-pagas', 'despesas-pendentes', 'despesas-funcionarios', 'percentual-funcionarios']
          .map((id) => <Cartao c={cartao(id)} key={id} />)}
      </section>

      <div className="grade">
        <section className="painel">
          <h2 className="alt">Top 10 despesas</h2>
          <div className="corpo"><Barras itens={bloco('top-10-despesas').dados} /></div>
        </section>

        <section className="painel">
          <h2>Top 10 receitas</h2>
          <div className="corpo"><Barras itens={bloco('top-10-receitas').dados} rotulo={(i) => i.descricao} /></div>
        </section>

        <section className="painel">
          <h2>Receita × despesa por dia</h2>
          <div className="corpo">
            <div className="filtros" style={{ marginBottom: '9px' }}>
              <span className="grupo">
                {anos.map((a) => (
                  <a className={`pilula${a === ano ? ' ativa' : ''}`} href={`/?ano=${a}&mes=${mes}`} key={a}>{a}</a>
                ))}
              </span>
              <span className="grupo">
                {MESES_CURTOS.slice(1).map((m, i) => (
                  <a className={`pilula${i + 1 === mes ? ' ativa' : ''}`} href={`/?ano=${ano}&mes=${i + 1}`} key={m}>{m}</a>
                ))}
              </span>
            </div>
            <p className="legenda">
              <span className="chave rec" />receita &nbsp; <span className="chave desp" />despesa &nbsp;
              — {NOMES_DOS_MESES[mes]} de {ano}
            </p>
            <div className="dias">
              {dias.map((x) => (
                <div className="dia" key={x.dia} title={`dia ${dois(x.dia)}: ${emReais(x.entradas)} / ${emReais(x.gastos)}`}>
                  <span className="rec" style={{ height: `${(x.entradas / maiorDia) * 55}px` }} />
                  <span className="desp" style={{ height: `${(x.gastos / maiorDia) * 55}px` }} />
                  <span className="n">{x.dia}</span>
                </div>
              ))}
              {dias.length === 0 && <p className="legenda">o bloco por dia do arquivo do mês não foi lido.</p>}
            </div>
          </div>
        </section>

        <section className="painel larga">
          <h2>Receita × despesa por mês — {ano}</h2>
          <div className="corpo">
            <p className="legenda"><span className="chave rec" />receita &nbsp; <span className="chave desp" />despesa</p>
            <div className="dias" style={{ height: '150px' }}>
              {meses.map((x) => (
                <div className="dia" key={x.mes} title={`${MESES_CURTOS[x.mes]}: ${emReais(x.entradas)} / ${emReais(x.gastos)}`}>
                  <span className="rec" style={{ height: `${(x.entradas / maiorMes) * 65}px` }} />
                  <span className="desp" style={{ height: `${(x.gastos / maiorMes) * 65}px` }} />
                  <span className="n">{MESES_CURTOS[x.mes]}</span>
                </div>
              ))}
              {meses.length === 0 && <p className="legenda">a série do ano não foi lida.</p>}
            </div>
          </div>
        </section>
      </div>

      <footer className="rodape">
        <Atualizar />
        <span>
          Empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora.
          {d.dfc.ok ? ` DFC: ${d.dfc.fonte}, ${d.dfc.arquivo}.` : ''}
        </span>
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </>
  );
}
