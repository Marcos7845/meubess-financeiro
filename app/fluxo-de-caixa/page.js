// TELA 3 — FLUXO DE CAIXA (pedido do dono, 28/09/2026: a tela "Contas a Receber" passa a ser esta, com outro nome e
// outro propósito).
//
// A HISTÓRIA, pedida pelo dono e escrita em `docs/layout.md`:
//   para quem       o dono da empresa e o departamento financeiro;
//   a decisão       a estratégia de venda — com estes números, o que o comercial precisa fazer;
//   5 segundos      quanto entrou, quanto saiu e como vamos fechar o mês: com lucro ou prejuízo?
//
// A ORDEM DA PÁGINA É A DO "F" das outras duas telas: título e frase; o recorte (filtros); a fila de números; o gráfico
// principal (o mês contra os anteriores); as despesas fixas; e, no pé, de onde saiu cada número.
//
// NENHUM NÚMERO NASCE AQUI: tudo vem de `lib/indicadores/fluxo-de-caixa.mjs`, que pega a maior parte dos cartões da
// Tela 1 e da antiga Tela 3, e escreve a origem de cada um. Esta página só desenha — e mostra a origem junto de cada
// número, porque "de onde saiu cada número" é uma das perguntas da tela.
//
// COMPONENTE DE SERVIDOR, como as outras duas: o gráfico é o único pedaço de navegador (`app/graficos.js`).

import React from 'react';

import { dadosDoFluxoDeCaixa, mesCorrente } from '../../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../../lib/regras/periodo.mjs';
import { comoLista } from '../../lib/regras/filtros.mjs';
import Atualizar from '../atualizar.js';
import ChaveDoOmie, { AvisoSemOmie } from '../chave-omie.js';
import { emPorcento, emReais } from '../dinheiro.js';
import FiltroDeEmpresa, { ExplicaEmpresa } from '../empresa.js';
import { comCodigo } from '../filtrado.js';
import { DespesasFixas, FluxoNoAno } from '../graficos.js';
import { Kpi, Quadro } from '../quadro.js';
import Suspensa from '../suspensa.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — Fluxo de Caixa',
  description: 'Quanto entrou, quanto saiu e como o mês vai fechar, com as despesas fixas e a origem de cada número.',
};

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// A ORIGEM DE UM NÚMERO: a frase de onde ele sai e, quando o número é soma de linhas do DFC, as linhas — uma por uma,
// com o número da linha na aba `FLUXO DE CAIXA`, para achar de volta na planilha. Fica fechada; abre com um clique.
function Origem({ c }) {
  const linhas = c.linhas ?? [];
  return (
    <details className="origem">
      <summary>de onde saiu{linhas.length ? ` · ${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'} do DFC` : ''}</summary>
      <p>{comCodigo(c.origem)}</p>
      {linhas.length > 0 && (
        <div className="rolagem-origem">
          <table>
            <thead><tr><th>linha</th><th>dia</th><th>classificação</th><th>conta (SUB 2)</th><th className="num">valor</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.linha}>
                  <td>{l.linha}</td><td>{l.dia}</td><td>{l.classe}</td><td>{l.sub2}</td><td className="num">{emReais(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

// "FORA DA CURVA", em português: acima ou abaixo da média dos meses anteriores, e se passou de um desvio-padrão deles.
function Curva({ nome, c, dinheiro = true }) {
  if (!c || c.media === null) return <li><strong>{nome}:</strong> ainda não há mês anterior neste ano para comparar.</li>;
  const media = dinheiro ? emReais(Math.round(c.media)) : c.media;
  if (c.fora === null) return <li><strong>{nome}:</strong> média dos {c.n} meses anteriores {media} — poucos meses para dizer se está fora da curva.</li>;
  return (
    <li>
      <strong>{nome}:</strong> {c.fora ? <b>fora da curva, {c.acima ? 'acima' : 'abaixo'}</b> : 'dentro do normal'} da média
      dos {c.n} meses anteriores ({media}{c.desvio !== null ? `, variação típica de ${emReais(Math.round(c.desvio))}` : ''}).
    </li>
  );
}

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  const d = await dadosDoFluxoDeCaixa({ ano, mes, filtro: { empresa: comoLista(q?.empresa), omie: comoLista(q?.omie) } });
  const femp = d.filtros.empresa;
  const comOmie = d.filtros.omie.ligado;
  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const entrou = cartao('entrou'), saiu = cartao('saiu'), saldo = cartao('saldo');
  const projecao = cartao('projecao'), fixas = cartao('fixas'), peso = cartao('peso-fixas');
  const anos = [2026];
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}${comOmie ? '' : '&omie=0'}`;
  const fechaCom = projecao.valor === null ? null : projecao.valor >= 0 ? 'lucro' : 'prejuizo';
  const nomeDoMes = NOMES_DOS_MESES?.[mes] ?? MESES_CURTOS[mes];
  // O PÉ DE CADA CARTÃO: quantas linhas do DFC e quantos títulos do Omie entraram nele — só a fonte que ele usa. Um
  // cartão só do DFC não escreve "sem o Omie", que daria a entender que faltou dado.
  const pe = (c) => [
    c.contagem.dfc !== null && c.contagem.dfc !== undefined ? `${c.contagem.dfc} ${c.contagem.dfc === 1 ? 'linha' : 'linhas'} do DFC` : null,
    c.contagem.omie !== null && c.contagem.omie !== undefined ? `${c.contagem.omie} ${c.contagem.omie === 1 ? 'título' : 'títulos'} do Omie` : null,
    ['a-pagar', 'a-receber', 'projecao'].includes(c.id) && c.contagem.omie === null ? 'sem o Omie' : null,
  ].filter(Boolean).join(' · ') || '—';

  return (
    <div className="tela">
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">Fluxo de Caixa</span>
        <nav className="abas">
          <a href={`/?ano=${ano}&mes=${mes}${paraOutraTela}`}>Gestão de Contas</a>
          <a href={`/dre?ano=${ano}&mes=${mes}${paraOutraTela}`}>DRE</a>
          <span className="ativa">Fluxo de Caixa</span>
          <span>Centro de Custo</span>
        </nav>
      </header>

      {/* 1. O TÍTULO E A FRASE DE 5 SEGUNDOS: quanto entrou, quanto saiu, e como o mês fecha. */}
      <section className="chamada">
        <h1>{nomeDoMes} de {ano}{d.mesEmAndamento ? ' — mês em andamento' : ''}</h1>
        <p className="frase">
          {!d.dfc.ok
            ? <>Sem a planilha do DFC deste mês não há caixa para mostrar: {d.dfc.motivo}.</>
            : <>
              Entrou <b>{emReais(entrou.valor)}</b>, saiu <b>{emReais(saiu.valor)}</b>
              {fechaCom
                ? <> e o mês caminha para fechar com{' '}
                  <span className={`fluxo-veredito ${fechaCom}`}>{fechaCom === 'lucro' ? 'lucro' : 'prejuízo'} de {emReais(Math.abs(projecao.valor))}</span>.</>
                : <>; sem o Omie não dá para projetar o fechamento.</>}
            </>}
        </p>
        <p className="para-que">
          Para decidir a estratégia de venda: se o mês fecha no prejuízo, ou as despesas fixas pesam demais na receita,
          o comercial precisa trazer mais receita. Cada número tem, embaixo, &quot;de onde saiu&quot; — a fonte, o
          filtro e as linhas da planilha que o compõem.
        </p>
      </section>

      {comOmie && <AvisoDoOmie leituras={d.leituras} />}
      <AvisoSemOmie ligado={comOmie}>
        <strong>Sem o Omie, sobra o caixa do DFC:</strong> entrou, saiu, o saldo e as despesas fixas continuam. O que
        falta pagar e receber no mês é do Omie, e sem ele não há projeção do fechamento.
      </AvisoSemOmie>

      {/* 2. O RECORTE: os filtros que esta tela divide com as outras duas. */}
      <section className="recorte">
        <form className="barra-filtros filtros-form" method="get" action="/fluxo-de-caixa">
          <Suspensa nome="ano" campo="ano" unica
            opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), marcada: a === ano }))} />
          <Suspensa nome="mês" campo="mes" unica
            opcoes={MESES_CURTOS.slice(1).map((m, i) => ({ valor: String(i + 1), rotulo: m, marcada: i + 1 === mes }))} />
          <FiltroDeEmpresa f={femp} />
          <ChaveDoOmie ligado={comOmie} />
          <button className="botao filtro" type="submit">aplicar</button>
        </form>
        <details className="explica">
          <summary>o que cada filtro alcança, e o que ele não alcança</summary>
          <ExplicaEmpresa f={femp}>
            Nesta tela ele vale no que falta pagar e receber (Omie). Entrou, saiu, o saldo e as despesas fixas são do
            DFC, que não separa por empresa — cada um diz isso ao lado quando o filtro está ligado.
          </ExplicaEmpresa>
        </details>
      </section>

      {/* 3. A FILA DE NÚMEROS: a pergunta 1 (o caixa fechou positivo ou negativo, e quanto entrou e saiu) e a 5 (quanto
          falta pagar, e como o mês fecha). */}
      <section className="kpis de-4">
        {[entrou, saiu, saldo, projecao].map((c) => (
          <div key={c.id}>
            <Kpi c={c} destaque={c.id === 'projecao'} pe={pe(c)} tom={c.id === 'entrou' ? 'serie-receita' : c.id === 'saiu' ? 'serie-despesa' : null} />
            <Origem c={c} />
          </div>
        ))}
      </section>
      <section className="kpis de-4">
        {[cartao('a-pagar'), cartao('a-receber'), fixas, peso].map((c) => (
          <div key={c.id}>
            <Kpi c={c} pe={pe(c)} />
            <Origem c={c} />
          </div>
        ))}
      </section>
      {comOmie && d.vencidoAReceber.valor > 0 && (
        <p className="aviso leve">
          Fora da projeção: <strong>{emReais(d.vencidoAReceber.valor)}</strong> a receber deste mês já venceu e ainda
          não foi recebido ({d.vencidoAReceber.contagem.omie} títulos). Se entrar, o mês fecha melhor que a projeção.
        </p>
      )}

      {/* 4. O GRÁFICO PRINCIPAL: este mês foi típico dentro do ano ou ficou fora da curva? */}
      <div className="grade-g">
        <Quadro className="larga" titulo="Este mês foi típico ou ficou fora da curva?" fonte={comCodigo(d.serie.fonte)}>
          <p className="legenda">
            <span className="chave serie-receita" />entrou &nbsp;<span className="chave serie-despesa" />saiu &nbsp;
            <span className="chave serie-saldo" />saldo do mês &nbsp;— a linha tracejada é a média do saldo dos meses
            anteriores a {MESES_CURTOS[mes]}.
          </p>
          <FluxoNoAno meses={d.serie.meses} mesEmFoco={mes} mediaDoSaldo={d.serie.comparacao?.saldo?.media ?? null} />
          {d.serie.comparacao && (
            <ul className="curva">
              <Curva nome="Entrou" c={d.serie.comparacao.entradas} />
              <Curva nome="Saiu" c={d.serie.comparacao.gastos} />
              <Curva nome="Saldo" c={d.serie.comparacao.saldo} />
              {d.serie.comparacao.fixas && <Curva nome="Despesas fixas" c={d.serie.comparacao.fixas} />}
            </ul>
          )}
          {d.mesEmAndamento && (
            <p className="legenda">O mês está em andamento: o que ainda vai entrar e sair não está nas colunas dele.</p>
          )}
        </Quadro>

        {/* 5. PARA ONDE FOI A DESPESA FIXA: todas as contas fixas, com o total. */}
        <Quadro className="principal" titulo="Para onde foi a despesa fixa"
          fonte={d.fixas.respondido
            ? `todas as ${d.fixas.porConta.length} contas fixas com pagamento no mês, das ${d.fixas.contas} que a gestora marcou como fixas`
            : 'as contas do DFC que a gestora marcar como fixas'}>
          {d.fixas.respondido
            ? <>
              <DespesasFixas itens={d.fixas.porConta} />
              <p className="legenda">
                Total: <b>{emReais(d.fixas.total)}</b>
                {peso.valor !== null ? <> — {emPorcento(peso.valor)} da receita líquida do mês ({emReais(peso.extras.receitaLiquida)})</> : null}.
              </p>
            </>
            : <p className="aviso leve">
              <strong>A classificação de despesa fixa ainda não foi respondida.</strong> Nem o DFC nem o Omie dizem que
              despesa é fixa: quem decide é a gestora do financeiro, na planilha
              {' '}<code>docs/despesas-fixas-para-classificar.xlsx</code>. Com ela respondida,
              {' '}<code>node scripts/despesas-fixas.mjs &lt;planilha&gt;</code> grava a lista e este bloco passa a mostrar
              todas as despesas fixas do mês, com o total e o peso na receita líquida.
            </p>}
        </Quadro>

        {/* O CONTROLE DAS FIXAS, conta por conta: o mesmo número das barras ao lado, com o peso de cada uma na receita
            líquida e quantas linhas do DFC a compõem. */}
        <Quadro titulo="As fixas, conta por conta" fonte="valor pago no mês, peso na receita líquida e linhas do DFC">
          {d.fixas.respondido && d.fixas.porConta.length > 0
            ? <table className="tabela-fixas">
              <thead><tr><th>Conta</th><th className="num">Pago</th><th className="num">% rec. líq.</th><th className="num">Linhas</th></tr></thead>
              <tbody>
                {d.fixas.porConta.map((g) => (
                  <tr key={g.conta}>
                    <td>{g.conta}</td><td className="num">{emReais(g.valor)}</td>
                    <td className="num">{peso.extras.receitaLiquida ? emPorcento(g.valor / peso.extras.receitaLiquida) : '—'}</td>
                    <td className="num">{g.n}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th>Total</th><td className="num">{emReais(d.fixas.total)}</td><td className="num">{emPorcento(peso.valor)}</td><td className="num">{d.fixas.porConta.reduce((s, g) => s + g.n, 0)}</td></tr></tfoot>
            </table>
            : <p className="legenda">{d.fixas.respondido ? 'Nenhuma despesa fixa paga neste mês.' : 'Aguardando a classificação da gestora.'}</p>}
        </Quadro>
      </div>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Caixa pelo DFC (regime de caixa: cada lançamento no mês em que foi pago ou recebido). O que falta pagar e
          receber pelo Omie, recorte da MeuBESS, empresas {femp.somadas.join(' e ')}. A projeção é de caixa, não o lucro
          contábil — esse é a tela DRE.
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </div>
  );
}
