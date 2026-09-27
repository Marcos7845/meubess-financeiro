// TELA 3 — CONTAS A RECEBER. Layout de `docs/referencias/tela-3-contas-a-receber.jpg` (as cores daquela imagem não
// valem; as da marca ficam em `app/globals.css`).
//
// COMPONENTE DE SERVIDOR, como as Telas 1 e 2: o cálculo roda no Node e para o navegador vai só o número já pronto.
//
// A JANELA DE VENCIMENTO é o filtro desta tela (`docs/fontes.md`: "data de vencimento (de–até) · status · cliente ·
// categoria"). Aqui ela é o mês escolhido nas pílulas, que é a mesma janela que `docs/conferencia.md` confere. Num
// mês fechado a faixa "em aberto" é sempre vazia — todo título que já venceu está pago ou atrasado —, e é por isso
// que o cartão "Valor Pendente" só tem número quando o mês escolhido ainda está por vir.
//
// NENHUM NÚMERO NASCE AQUI: tudo vem de `lib/indicadores/tela-3.mjs`, pela camada de dados.

import React from 'react';

import { dadosDaTela3, mesCorrente } from '../../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../../lib/regras/periodo.mjs';
import Atualizar from '../atualizar.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — Contas a Receber',
  description: 'Títulos a receber por status, cliente e mês de vencimento.',
};

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O dinheiro é formatado aqui, na hora de desenhar, e só aqui. Nada disso é gravado em arquivo.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
// Sem separador de milhar e com UMA casa nos percentuais: "13,89%" seria lido como dinheiro pela trava da captura.
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, useGrouping: false });
const emReais = (centavos) => dinheiro.format((centavos ?? 0) / 100);

// As três faixas da tela, na ordem em que a referência as empilha, com o rótulo que o dono lê.
const FAIXAS = [
  { chave: 'pago', nome: 'Pago' },
  { chave: 'atrasado', nome: 'Atrasado' },
  { chave: 'aberto', nome: 'Em aberto' },
];

// O NOME DO CLIENTE, sempre com o código ao lado no `data-codigo`: é por ele que `scripts/capturar-tela.mjs` troca o
// nome antes de a captura entrar no repositório. Toda aparição de nome de cliente na tela passa por aqui.
function Cliente({ c }) {
  return <span className="cliente" data-codigo={c.codigo}>{c.nome ?? `cliente ${c.codigo}`}</span>;
}

// Os quatro cartões do topo, com o disco colorido da referência à esquerda do número. O `tom` é a classe da faixa
// (`f-pago`, `f-aberto`, `f-atrasado`), a mesma que pinta a coluna, a barra e a rosca — a cor mora só no CSS.
function Cartao({ c, tom }) {
  return (
    <div className="cartao receber">
      <span className={`disco ${tom}`} aria-hidden="true" />
      <span className="texto">
        <span className="rotulo">{c.nome}</span>
        <span className="numero">{emReais(c.valor)}</span>
        <span className="pe">{c.contagem.omie} títulos do Omie</span>
      </span>
    </div>
  );
}

// Uma barra empilhada, horizontal ou vertical, com as três faixas na ordem da referência.
function Pilha({ item, maior, vertical, altura }) {
  return FAIXAS.map((f) => {
    const parte = maior ? (item[f.chave] / maior) * 100 : 0;
    const estilo = vertical ? { height: `${((parte / 100) * altura).toFixed(1)}px` } : { width: `${parte.toFixed(1)}%` };
    return item[f.chave] ? <span className={`pedaco f-${f.chave}`} style={estilo} key={f.chave} /> : null;
  });
}

function Legenda() {
  return (
    <p className="legenda">
      {FAIXAS.map((f) => (
        <React.Fragment key={f.chave}>
          <span className={`chave f-${f.chave}`} />{f.nome} &nbsp;
        </React.Fragment>
      ))}
    </p>
  );
}

// A rosca de "Lançamentos por status", com o total no centro. SVG no próprio arquivo — a página não chama
// biblioteca de gráfico nenhuma.
function Rosca({ dados }) {
  const R = 54, C = 2 * Math.PI * R;
  let andado = 0;
  return (
    <div className="rosca">
      <svg viewBox="0 0 140 140" role="img" aria-label="quantidade de títulos por faixa de status">
        {FAIXAS.map((f) => {
          const fatia = dados.total ? (dados[f.chave] / dados.total) * C : 0;
          const traco = <circle className={`arco f-${f.chave}`} cx="70" cy="70" r={R} fill="none" strokeWidth="18"
            strokeDasharray={`${fatia.toFixed(1)} ${(C - fatia).toFixed(1)}`}
            strokeDashoffset={(-andado).toFixed(1)} key={f.chave} />;
          andado += fatia;
          return fatia ? traco : null;
        })}
        <text className="centro" x="70" y="76" textAnchor="middle">{dados.total}</text>
      </svg>
      <ul className="fatias">
        {FAIXAS.map((f) => (
          <li key={f.chave}>
            <span className={`chave f-${f.chave}`} />{f.nome}
            <b>{dados[f.chave]}</b>
            <i>{dados.total ? porcento.format(dados[f.chave] / dados.total) : '—'}</i>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  const d = await dadosDaTela3({ ano, mes });

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const bloco = (id) => d.blocos.find((b) => b.id === id);
  const porMes = bloco('por-mes-e-status');
  const porCliente = bloco('por-cliente-e-status');
  const listaBloco = bloco('lista-de-titulos');
  const porStatus = bloco('por-status');
  const maiorMes = Math.max(1, ...porMes.dados.map((x) => x.total));
  const clientes = porCliente.dados.slice(0, 10);
  const maiorCliente = Math.max(1, ...clientes.map((c) => c.total));
  const anos = [2026];
  const pendente = cartao('valor-pendente');

  return (
    <>
      <header className="topo">
        <span className="marca">MeuBESS</span>
        <span className="titulo">Contas a Receber</span>
        <nav className="abas">
          <a href={`/?ano=${ano}&mes=${mes}`}>Gestão de Contas</a>
          <a href={`/dre?ano=${ano}&mes=${mes}`}>DRE</a>
          <span className="ativa">Contas a Receber</span>
          <span>Centro de Custo</span>
          <span>Fluxo de caixa</span>
        </nav>
      </header>

      <AvisoDoOmie leituras={d.leituras} />

      <div className="barra-filtros receber">
        <span className="grupo">
          {anos.map((a) => (
            <a className={`pilula${a === ano ? ' ativa' : ''}`} href={`/receber?ano=${a}&mes=${mes}`} key={a}>{a}</a>
          ))}
        </span>
        <span className="grupo">
          {MESES_CURTOS.slice(1).map((m, i) => (
            <a className={`pilula${i + 1 === mes ? ' ativa' : ''}`} href={`/receber?ano=${ano}&mes=${i + 1}`} key={m}>{m}</a>
          ))}
        </span>
        <span className="grupo">
          <span className="pilula fixa">vencimento de {d.janela.de} a {d.janela.ate}</span>
        </span>
      </div>

      <section className="cartoes receber">
        <Cartao c={cartao('valor-previsto')} tom="marca" />
        <Cartao c={cartao('valor-recebido')} tom="f-pago" />
        <Cartao c={cartao('valor-pendente')} tom="f-aberto" />
        <Cartao c={cartao('valor-vencido')} tom="f-atrasado" />
      </section>

      {pendente.contagem.omie === 0 && (
        <p className="aviso leve">
          <strong>Nenhum título em aberto vencendo em {NOMES_DOS_MESES[mes]} de {ano}.</strong> Num mês já fechado
          essa faixa é sempre vazia: todo título que venceu está pago ou atrasado, e os quatro status da faixa
          (<code>EMABERTO</code>, <code>AVENCER</code>, <code>VENCEHOJE</code>, <code>PAGTO_PARCIAL</code>) são os de
          um título que ainda não venceu. Escolha um mês à frente para ver a carteira a vencer.
        </p>
      )}

      <div className="grade receber">
        <section className="painel">
          <h2>Qtde Lançamentos — por mês e status</h2>
          <div className="corpo">
            <Legenda />
            <div className="colunas">
              {porMes.dados.map((x) => (
                <div className={`coluna${x.mes === d.mesDaJanela ? ' foco' : ''}`} key={x.mes}>
                  <span className="n topo-n">{x.total || ''}</span>
                  <span className="pilha"><Pilha item={x} maior={maiorMes} vertical altura={120} /></span>
                  <span className="n">{MESES_CURTOS[x.mes]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="painel">
          <h2 className="alt">Valor Previsto — por cliente e status</h2>
          <div className="corpo">
            <Legenda />
            <div className="barras">
              {clientes.length === 0 && <p className="legenda">nenhum título vence nesta janela.</p>}
              {clientes.map((c) => (
                <div className="barra" key={`${c.empresa}|${c.codigo}`}>
                  <span className="nome"><Cliente c={c} /></span>
                  <span className="trilho"><Pilha item={c} maior={maiorCliente} /></span>
                  <span className="valor">{emReais(c.total)}</span>
                </div>
              ))}
            </div>
            {porCliente.dados.length > clientes.length && (
              <p className="legenda" style={{ margin: '8px 0 0' }}>
                os 10 maiores dos {porCliente.contagem.extras.clientes} clientes da janela.
              </p>
            )}
          </div>
        </section>

        <section className="painel">
          <h2>Lista de títulos</h2>
          <div className="rolagem-lista">
            <table className="lista-titulos">
              <thead>
                <tr>
                  <th>Código</th><th>Cliente</th><th>Categoria</th><th>Descrição</th>
                  <th className="num">Valor Previsto</th><th>Data Vencimento</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {listaBloco.dados.map((t) => (
                  <tr key={`${t.empresa}|${t.codigo}`}>
                    <td className="cod">{t.codigo}</td>
                    <td><Cliente c={t.cliente} /></td>
                    <td>{t.categoria}</td>
                    <td className="desc">{t.descricao}</td>
                    <td className="num">{emReais(t.valor)}</td>
                    <td>{t.vencimento}</td>
                    <td><span className={`selo f-${t.faixa}`}>{t.status}</span></td>
                  </tr>
                ))}
                {listaBloco.dados.length === 0 && (
                  <tr><td colSpan={7} className="legenda">nenhum título vence nesta janela.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr><th colSpan={4}>Total — {listaBloco.contagem.omie} títulos</th>
                  <td className="num">{emReais(listaBloco.total)}</td><td colSpan={2} /></tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="painel">
          <h2 className="alt">Qtde Lançamentos — por status</h2>
          <div className="corpo"><Rosca dados={porStatus.dados} /></div>
        </section>
      </div>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora — o Omie pela API, só consulta.
          Os `CANCELADO` ficam fora da tela. Leitura desta janela:{' '}
          {d.janela.leitura === 'janela' ? 'a consulta da própria janela' : 'a consulta do ano, recortada'}.
        </span>
        <UltimaLeitura leituras={d.leituras} usaDfc={false} />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </>
  );
}
