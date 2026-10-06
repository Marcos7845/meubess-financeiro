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
import { comoLista, comoTexto } from '../../lib/regras/filtros.mjs';
import Atualizar from '../atualizar.js';
import ChaveDoOmie, { AvisoSemOmie } from '../chave-omie.js';
import FiltroDeUnidade from '../unidade.js';
import { emPorcento, emReais } from '../dinheiro.js';
import FiltroDeEmpresa, { ExplicaEmpresa } from '../empresa.js';
import { comCodigo } from '../filtrado.js';
import ContaExplodivel from '../conta-explodivel.js';
import { DiaADiaDoFluxo } from '../graficos.js';
import { Kpi, Quadro } from '../quadro.js';
import CartaoExplodivel from '../cartao-explodivel.js';
import Suspensa from '../suspensa.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';
import Sessao, { exigirLogin } from '../sessao.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — Fluxo de Caixa',
  description: 'Quanto entrou, quanto saiu e como o mês vai fechar, com as despesas fixas e a origem de cada número.',
};

// O PESO DE UMA FIXA NA RECEITA LÍQUIDA, com uma casa decimal: com duas casas a menos, quase toda linha da tabela saía
// "0%" (29/09/2026). Sem separador de milhar, pelo mesmo motivo de `app/dinheiro.js` (a trava da captura).
const PCT1 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const pct1 = (r) => (r === null || r === undefined ? '—' : PCT1.format(r));

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
  await exigirLogin();
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  const unidade = comoTexto(q?.unidade);
  // OS MESES DO GRÁFICO DIA A DIA (pedido do dono, 29/09/2026: "abril a agosto"): `?meses=4,5,6,7,8`. Sem nada, ou com um
  // mês só, o gráfico é o do mês escolhido. Os cartões de cima são sempre do mês escolhido.
  const mesesDoDia = comoLista(q?.meses).map(Number).filter((m) => m >= 1 && m <= 12);
  const d = await dadosDoFluxoDeCaixa({ ano, mes, filtro: { empresa: comoLista(q?.empresa), omie: comoLista(q?.omie), unidade,
    saidas: comoTexto(q?.saidas), banco: comoTexto(q?.banco), mesesDoDia } });
  const femp = d.filtros.empresa;
  const comOmie = d.filtros.omie.ligado;
  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const entrou = cartao('entrou'), saiu = cartao('saiu'), resultado = cartao('resultado');
  const projecao = cartao('projecao'), fixas = cartao('fixas'), peso = cartao('peso-fixas');
  const saidas = cartao('saidas');
  const anos = [2026];
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}${unidade ? `&unidade=${encodeURIComponent(unidade)}` : ''}${comOmie ? '' : '&omie=0'}`;
  // LUCRO OU PREJUÍZO SAI DO RESULTADO (entrou − saiu), e só dele: se entrou mais do que saiu, é lucro. A projeção, que
  // soma o que ainda vence no mês, aparece junto só com o mês em andamento.
  const veredito = (v) => (v === null ? null : v >= 0 ? 'lucro' : 'prejuizo');
  const nomeDo = (v) => (v === 'lucro' ? 'lucro' : 'prejuízo');
  const doResultado = veredito(resultado.valor);
  const daProjecao = veredito(projecao.valor);
  const maior = Math.max(1, ...d.fixas.porConta.map((g) => g.valor));
  // A legenda da previsão segue o que o gráfico desenha: o período inteiro, quando há um, e não só o mês dos cartões.
  const temPrevisao = d.periodo ? d.periodo.dias.some((x) => x.fase !== 'consolidado') && comOmie : d.diaADia.comPrevisao;
  // A LINHA CONFERIDA COM OS BANCOS — a ponte de `conferenciaDosBancos` (`lib/indicadores/fluxo-de-caixa.mjs`), escrita
  // em português. Ela NÃO diz "a linha é igual ao último SALDO": o saldo corrido da planilha corre até a última linha
  // digitada do mês, e essas incluem lançamentos que ainda não foram baixados. O que a tela afirma é que a diferença
  // entre os dois está inteira explicada — e, quando não está, mostra o que sobrou.
  const cb = d.diaADia.conferenciaDosBancos;
  // "somando" ou "tirando", pelo SINAL do termo e nunca por um menos escrito na frente do valor: a ponte tem termos que
  // somam (o não baixado, o baixado depois do corte) e um que subtrai (o lançado depois do último saldo), e cada um pode
  // vir positivo ou negativo. `emReais(-13.400)` dentro de "tirando" daria "tirando −R$ 13.400", que ninguém lê.
  const termo = (valor, soma) => `${(soma ? valor : -valor) >= 0 ? 'somando' : 'tirando'} ${emReais(Math.abs(valor))}`;
  const conferencia = !cb ? null : !cb.fecham
    ? `A conferência com os bancos não pode ser feita neste mês: o saldo corrido da planilha PULA — anda por um valor diferente do movimento da linha — em ${cb.naoFecham} ${cb.nBancos === 1 ? 'bloco de banco, o único que este arquivo tem' : `dos ${cb.nBancos} blocos de banco`}, e sem essa coluna mantida não há com o que comparar a posição de caixa. Nos meses em que a planilha a mantém — agosto e setembro de 2026, entre outros — a conferência fecha sem sobra.`
    : `Conferido com os bancos no dia ${cb.corte}: a linha dá ${emReais(cb.posicao)}; ${termo(cb.naoBaixado.valor, true)} que o saldo da planilha já conta e ainda não foi baixado (${cb.naoBaixado.n} ${cb.naoBaixado.n === 1 ? 'linha' : 'linhas'})${cb.baixadoDepois.n ? `, ${termo(cb.baixadoDepois.valor, true)} baixado depois do dia ${cb.corte}` : ''}${cb.depoisDoSaldo.n ? `, e ${termo(cb.depoisDoSaldo.valor, false)} que a planilha lançou depois de parar de escrever o saldo, em ${cb.depoisDoSaldo.n} ${cb.depoisDoSaldo.n === 1 ? 'banco' : 'bancos'}` : ''}, chega-se ao último saldo dos bancos, ${emReais(cb.final)}${cb.diferenca === 0 ? ' — sem um centavo de sobra' : `, com ${emReais(cb.diferenca)} sem explicação`}.`;
  const nomeDoMes = NOMES_DOS_MESES?.[mes] ?? MESES_CURTOS[mes];
  // O PÉ DE CADA CARTÃO: quantas linhas do DFC e quantos títulos do Omie entraram nele — só a fonte que ele usa. Um
  // cartão só do DFC não escreve "sem o Omie", que daria a entender que faltou dado.
  const pe = (c) => [
    c.contagem.dfc !== null && c.contagem.dfc !== undefined ? `${c.contagem.dfc} ${c.contagem.dfc === 1 ? 'linha' : 'linhas'} do DFC` : null,
    c.contagem.omie !== null && c.contagem.omie !== undefined ? `${c.contagem.omie} ${c.contagem.omie === 1 ? 'título' : 'títulos'} do Omie` : null,
    ['a-pagar', 'a-receber'].includes(c.id) && c.contagem.omie === null ? 'sem o Omie' : null,
    c.id === 'projecao' && d.mesFechado ? 'mês fechado' : null,
    c.id === 'projecao' && !d.mesFechado && c.contagem.omie === null ? 'sem o Omie' : null,
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
              {d.mesFechado ? 'Entrou' : 'Até agora entrou'} <b>{emReais(entrou.valor)}</b> e saiu <b>{emReais(saiu.valor)}</b>:{' '}
              {d.mesFechado ? 'o mês fechou com' : 'até aqui,'}{' '}
              <span className={`fluxo-veredito ${doResultado}`}>{nomeDo(doResultado)} de {emReais(Math.abs(resultado.valor))}</span>.
              {!d.mesFechado && (daProjecao
                ? <> Com o que ainda vence no mês, deve fechar com{' '}
                  <span className={`fluxo-veredito ${daProjecao}`}>{nomeDo(daProjecao)} de {emReais(Math.abs(projecao.valor))}</span>.</>
                : <> Sem o Omie não dá para projetar o fechamento.</>)}
            </>}
        </p>
        {d.dfc.aviso && <p className="aviso">{d.dfc.aviso}</p>}
        <p className="para-que">
          Para decidir a estratégia de venda: se o mês fecha no prejuízo, ou as despesas fixas pesam demais na receita,
          o comercial precisa trazer mais receita. Cada número tem, embaixo, &quot;de onde saiu&quot; — a fonte, o
          filtro e as linhas da planilha que o compõem.
        </p>
      </section>

      {comOmie && <AvisoDoOmie leituras={d.leituras} />}
      <AvisoSemOmie ligado={comOmie}>
        <strong>Sem o Omie, sobra o caixa do DFC:</strong> entrou, saiu, o resultado e as despesas fixas continuam. O que
        falta pagar e receber no mês é do Omie, e sem ele não há projeção do fechamento.
      </AvisoSemOmie>

      {/* 2. O RECORTE: os filtros que esta tela divide com as outras duas. */}
      <section className="recorte">
        <form className="barra-filtros filtros-form" method="get" action="/fluxo-de-caixa">
          <Suspensa nome="ano" campo="ano" unica
            opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), marcada: a === ano }))} />
          <Suspensa nome="período (dia a dia e fixas)" campo="meses" vazio="o mês escolhido"
            opcoes={MESES_CURTOS.slice(1).map((m, i) => ({ valor: String(i + 1), rotulo: m, marcada: mesesDoDia.includes(i + 1) }))} />
          <Suspensa nome="mês" campo="mes" unica
            opcoes={MESES_CURTOS.slice(1).map((m, i) => ({ valor: String(i + 1), rotulo: m, marcada: i + 1 === mes }))} />
          <FiltroDeEmpresa f={femp} />
          <FiltroDeUnidade escolhida={unidade} />
          <label className="campo-filtro"><span>Saídas: situação</span>
            <select name="saidas" defaultValue={d.saidasFiltro.situacao}>
              <option value="pago">Pago · DFC</option><option value="a-pagar">A pagar · Omie</option>
            </select>
          </label>
          <label className="campo-filtro"><span>Saídas: banco</span>
            <select name="banco" defaultValue={d.saidasFiltro.banco ?? ''}>
              <option value="">todos os bancos</option>
              {d.saidasFiltro.bancos.map((b) => <option value={b} key={b}>{b}</option>)}
            </select>
          </label>
          <ChaveDoOmie ligado={comOmie} />
          <button className="botao filtro" type="submit">aplicar</button>
        </form>
        <details className="explica">
          <summary>o que cada filtro alcança, e o que ele não alcança</summary>
          <ExplicaEmpresa f={femp}>
            Nesta tela ele vale no que falta pagar e receber (Omie). Entrou, saiu, o resultado e as despesas fixas são do
            DFC, que não separa por empresa — cada um diz isso ao lado quando o filtro está ligado.
          </ExplicaEmpresa>
        </details>
      </section>

      {/* 3. A FILA DE NÚMEROS: a pergunta 1 (o caixa fechou positivo ou negativo, e quanto entrou e saiu) e a 5 (quanto
          falta pagar, e como o mês fecha). */}
      <section className="kpis de-4">
        {[entrou, saiu, resultado, projecao].map((c) => (
          <CartaoExplodivel nome={c.nome} composicao={c.composicao} depois={<Origem c={c} />}
            aviso={c.contagem?.dfc != null ? d.dfc.aviso : null} key={c.id}>
            <Kpi c={c} destaque={c.id === 'resultado'} pe={pe(c)} tom={c.id === 'entrou' ? 'serie-receita' : c.id === 'saiu' ? 'serie-despesa' : null} />
          </CartaoExplodivel>
        ))}
      </section>
      <section className="kpis de-4">
        {[cartao('a-pagar'), cartao('a-receber'), fixas, peso].map((c) => (
          <CartaoExplodivel nome={c.nome} composicao={c.composicao} depois={<Origem c={c} />}
            aviso={c.contagem?.dfc != null ? d.dfc.aviso : null} key={c.id}>
            {/* O peso das fixas sai com UMA casa decimal, a mesma da coluna "% rec. líq." da tabela logo abaixo (6,1%). */}
            <Kpi c={c} pe={pe(c)} texto={c.id === 'peso-fixas' ? pct1(c.valor) : null} />
          </CartaoExplodivel>
        ))}
      </section>
      <section className="kpis">
        <CartaoExplodivel nome={saidas.nome} composicao={saidas.composicao} depois={<Origem c={saidas} />}
          aviso={saidas.contagem?.dfc != null ? d.dfc.aviso : null}>
          <Kpi c={saidas} pe={pe(saidas)} tom="serie-despesa">
            {saidas.recorteB3W && <div className="saidas-recortes">
              <span>Todas as contas (B3W): <strong>{emReais(-saidas.recorteB3W.todas)}</strong></span>
              {saidas.recorteB3W.itau !== null && <span>Itaú (B3W): <strong>{emReais(-saidas.recorteB3W.itau)}</strong></span>}
            </div>}
          </Kpi>
        </CartaoExplodivel>
      </section>
      {comOmie && d.vencidoAReceber.valor > 0 && (
        <p className="aviso leve">
          <strong>{emReais(d.vencidoAReceber.valor)}</strong> a receber deste mês já venceu e ainda não foi recebido
          ({d.vencidoAReceber.contagem.omie} títulos){d.mesFechado ? '' : ': fica fora da projeção. Se entrar, o mês fecha melhor'}.
        </p>
      )}

      {/* 4. O MÊS DIA A DIA (pedido do dono, 28/09/2026): o que já foi e o que ainda vem, num gráfico só. */}
      <div className="grade-g">
        <Quadro className="larga" titulo={d.periodo
            ? `De ${NOMES_DOS_MESES[d.periodo.meses[0]]} a ${NOMES_DOS_MESES[d.periodo.meses.at(-1)]} dia a dia: ${temPrevisao ? 'o que já foi e o que ainda vem' : 'como o caixa andou'}`
            : `${nomeDoMes} dia a dia: ${temPrevisao ? 'o que já foi e o que ainda vem' : 'como o caixa andou'}`} fonte={comCodigo(d.diaADia.fonte)}>
          <p className="legenda">
            <span className="chave serie-receita" />entrou &nbsp;
            {temPrevisao && <><span className="chave previsao" />a receber e a pagar (previsão, em cinza) &nbsp;</>}
            <span className="chave serie-despesa" />saiu &nbsp;

            <span className="chave serie-saldo" />posição de caixa
            {temPrevisao && <> &nbsp;<span className="chave previsao-linha" />posição prevista</>}
            {(d.periodo ? d.periodo.hoje : d.diaADia.hoje) ? ' — à esquerda da marca "hoje", consolidado; à direita, previsão.' : ''}
          </p>
          {d.periodo
            ? <>
              <DiaADiaDoFluxo dias={d.periodo.dias} hoje={d.periodo.hoje} />
              <p className="legenda">
                De {NOMES_DOS_MESES[d.periodo.meses[0]]} a {NOMES_DOS_MESES[d.periodo.meses.at(-1)]}: entrou
                {' '}<b>{emReais(d.periodo.entrou)}</b> e saiu <b>{emReais(d.periodo.saiu)}</b>. A linha começa, em cada
                mês, na abertura dos bancos daquele mês (coluna <code>SALDO</code> do <code>FLUXO DE CAIXA</code>) e soma
                os lançamentos do dia; se a planilha não fecha de um mês para o outro, aparece um degrau na virada.
                {d.periodo.atrasadoAPagar > 0 && <> Fora do gráfico: <b>{emReais(d.periodo.atrasadoAPagar)}</b> a pagar
                  vencido e não baixado no Omie.</>}
              </p>
            </>
            : <DiaADiaDoFluxo dias={d.diaADia.dias} hoje={d.diaADia.hoje ? String(d.diaADia.hoje) : null} />}
          {!d.periodo && <>
          <p className="legenda">
            {d.diaADia.aberturaDosBancos !== null
              ? <>A linha parte de <b>{emReais(d.diaADia.aberturaDosBancos)}</b>, o caixa das contas antes do primeiro
                lançamento do mês — o saldo corrido do <code>FLUXO DE CAIXA</code> na primeira linha do bloco de cada
                banco ({d.diaADia.bancos.map((x) => `${x.banco ?? 'sem nome'} ${emReais(x.abertura)}`).join(' · ')}). </>
              : d.diaADia.finalDoMesAnterior !== null
              ? <>A linha parte de <b>{emReais(d.diaADia.finalDoMesAnterior)}</b>, o <code>Final</code> do último dia do
                quadro do caixa do mês anterior (esta planilha não tem saldo corrido). </>
              : d.diaADia.inicial !== null
              ? <>A linha parte de <b>{emReais(d.diaADia.inicial)}</b>, o <code>Inicial</code> do dia 1 do quadro do caixa. </>
              : <>Sem saldo na planilha, a linha parte do zero e mostra só o que o mês movimentou. </>}
            {d.diaADia.mesFechado
              ? <>Mês fechado, tudo consolidado: o caixa terminou o mês em <b>{emReais(d.diaADia.dias.at(-1).acumulado)}</b>.</>
              : !d.diaADia.comPrevisao
              ? 'Sem o Omie não há previsão: aparece só o consolidado.'
              : <>O caixa termina o mês em <b>{emReais(d.diaADia.dias.at(-1).acumulado)}</b> se tudo o que vence for
                recebido e pago no dia.</>}
            {conferencia && <> {conferencia}</>}
            {d.diaADia.atrasadoAPagar.valor > 0 && (
              <> Fora do gráfico: <b>{emReais(d.diaADia.atrasadoAPagar.valor)}</b> a pagar que venceu antes de hoje e
                não foi baixado no Omie ({d.diaADia.atrasadoAPagar.n} títulos) — não tem dia previsto.
                {projecao.valor !== null && <> Pagando também esse atraso, o mês fecha em {emReais(projecao.valor)}, que
                  é o cartão &quot;Projeção do mês&quot;.</>}</>
            )}
          </p>
          {/* A CONFERÊNCIA DIA A DIA COM A PLANILHA (pedido do dono, 28/09/2026: "tem algo estranho no dia 1"). Para cada
              dia consolidado: o que a tela somou das linhas do FLUXO DE CAIXA, e o que o quadro do caixa da aba do mês
              escreve para o mesmo dia. Onde os dois não batem, a linha fica marcada — e o "de onde saiu" do cartão Saiu
              lista as linhas de cada dia. */}
          <details className="origem">
            <summary>conferir o dia a dia com o quadro do caixa da planilha</summary>
            <div className="rolagem-origem">
              <table>
                <thead><tr>
                  <th>dia</th><th className="num">entrou (tela)</th><th className="num">Entradas (planilha)</th>
                  <th className="num">saiu (tela)</th><th className="num">Gastos (planilha)</th>
                  <th className="num">posição (tela)</th><th className="num">Final (planilha)</th>
                </tr></thead>
                <tbody>
                  {d.diaADia.dias.filter((x) => x.fase !== 'previsao').map((x) => {
                    const difere = (a, b) => a !== null && b !== null && Math.abs(a - b) >= 100;
                    const posicao = x.acumulado - (x.aReceber - x.aPagar);
                    const marca = difere(x.entrou, x.planilha.entradas) || difere(x.saiu, x.planilha.gastos) || difere(posicao, x.planilha.final);
                    return (
                      <tr key={x.dia} className={marca ? 'difere' : ''}>
                        <td>{x.dia}</td>
                        <td className="num">{emReais(x.entrou)} ({x.linhasEntrou})</td>
                        <td className="num">{emReais(x.planilha.entradas)}</td>
                        <td className="num">{emReais(x.saiu)} ({x.linhasSaiu})</td>
                        <td className="num">{emReais(x.planilha.gastos)}</td>
                        <td className="num">{emReais(posicao)}</td>
                        <td className="num">{emReais(x.planilha.final)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>Entre parênteses, quantas linhas do <code>FLUXO DE CAIXA</code> entraram no dia. Linha marcada: a tela e o
              quadro da planilha não batem naquele dia.</p>
          </details>
          </>}
        </Quadro>
      </div>

      {/* 5. O MÊS CONTRA OS ANTERIORES: este mês foi típico dentro do ano ou ficou fora da curva? */}
      <div className="grade-g">
        {/* O MÊS CONTRA A MÉDIA DOS ANTERIORES — só as frases. O gráfico do ano que ficava aqui saiu em 29/09/2026: o dono
            o achou "meio sem propósito", e a comparação no tempo agora é o dia a dia de vários meses, lá em cima. A
            conta continua a mesma (`d.serie.comparacao`), e a conferência ainda a lê. */}
        <Quadro className="larga" titulo={`${nomeDoMes.charAt(0).toUpperCase()}${nomeDoMes.slice(1)} contra a média dos meses anteriores`}
          fonte="cada mês pela conta dos cartões; fora da curva é afastar-se da média mais que a variação típica dos meses anteriores">
          {d.serie.comparacao
            ? <ul className="curva">
              <Curva nome="Entrou" c={d.serie.comparacao.entradas} />
              <Curva nome="Saiu" c={d.serie.comparacao.gastos} />
              <Curva nome="Resultado" c={d.serie.comparacao.saldo} />
              {d.serie.comparacao.fixas && <Curva nome="Despesas fixas" c={d.serie.comparacao.fixas} />}
            </ul>
            : <p className="legenda">Sem a planilha deste mês não há o que comparar.</p>}
          {d.mesEmAndamento && <p className="legenda">O mês está em andamento: a comparação é com o que já aconteceu nele.</p>}
        </Quadro>

        {/* 5. PARA ONDE FOI A DESPESA FIXA: todas as contas fixas, numa tabela só, com uma barra em cada linha. Era um
            gráfico de barras do Recharts ao lado de uma tabela; com as 33 contas da gestora ele ficou gigante e ilegível
            (o SVG é desenhado pequeno e esticado até a largura do quadro). Uma barra de CSS dentro da linha não estica
            o texto, e o nome, a barra, o valor e o peso ficam lado a lado. */}
        {d.periodo?.fixas ? (
          /* AS FIXAS DE VÁRIOS MESES (pedido do dono, 29/09/2026): a mesma escolha "período" do dia a dia. Uma coluna por
             mês, o total do período, o peso sobre a receita líquida do período e quantas linhas do DFC. */
          <Quadro className="larga" titulo={`Para onde foi a despesa fixa — ${NOMES_DOS_MESES[d.periodo.meses[0]]} a ${NOMES_DOS_MESES[d.periodo.meses.at(-1)]}`}
            fonte={`as ${d.periodo.fixas.porConta.length} contas fixas com pagamento no período, da maior para a menor pelo total — clique numa conta para ver os lançamentos`}>
            <div className="rolagem-lista">
              <table className="tabela-fixas">
                <thead><tr>
                  <th>Conta</th>
                  {d.periodo.fixas.meses.map((x) => <th className="num" key={x.mes}>{MESES_CURTOS[x.mes]}</th>)}
                  <th className="barra-col" /><th className="num">Total</th><th className="num">% rec. líq.</th><th className="num">Linhas</th>
                </tr></thead>
                <tbody>
                  {d.periodo.fixas.porConta.map((g) => (
                    <ContaExplodivel key={g.conta} colunas={d.periodo.fixas.meses.length + 5} lancamentos={g.lancamentos}>
                      <td><span className="seta" aria-hidden="true">▸</span>{g.conta}</td>
                      {d.periodo.fixas.meses.map((x) => <td className="num" key={x.mes}>{g.porMes[x.mes] ? emReais(g.porMes[x.mes]) : '—'}</td>)}
                      <td className="barra-col"><span className="barrinha" style={{ width: `${Math.max(1, Math.round((g.total / Math.max(1, d.periodo.fixas.porConta[0].total)) * 100))}%` }} /></td>
                      <td className="num">{emReais(g.total)}</td>
                      <td className="num">{d.periodo.fixas.receitaLiquida ? pct1(g.total / d.periodo.fixas.receitaLiquida) : '—'}</td>
                      <td className="num">{g.n}</td>
                    </ContaExplodivel>
                  ))}
                </tbody>
                <tfoot><tr>
                  <th>Total</th>
                  {d.periodo.fixas.meses.map((x) => <td className="num" key={x.mes}>{emReais(x.total)}</td>)}
                  <td /><td className="num">{emReais(d.periodo.fixas.total)}</td>
                  <td className="num">{d.periodo.fixas.peso === null ? '—' : pct1(d.periodo.fixas.peso)}</td>
                  <td className="num">{d.periodo.fixas.porConta.reduce((n, g) => n + g.n, 0)}</td>
                </tr></tfoot>
              </table>
            </div>
            <p className="legenda">
              % da receita líquida de cada mês: {d.periodo.fixas.meses.map((x) => `${MESES_CURTOS[x.mes]} ${x.receitaLiquida ? pct1(x.total / x.receitaLiquida) : '—'}`).join(' · ')}.
            </p>
          </Quadro>
        ) : (
        <Quadro className="larga" titulo="Para onde foi a despesa fixa"
          fonte={d.fixas.respondido
            ? `as ${d.fixas.porConta.length} contas fixas com pagamento no mês (a gestora marcou ${d.fixas.contas} contas como fixas), da maior para a menor — clique numa conta para ver os lançamentos`
            : 'as contas do DFC que a gestora marcar como fixas'}>
          {!d.fixas.respondido
            ? <p className="aviso leve">
              <strong>A classificação de despesa fixa ainda não foi respondida.</strong> Nem o DFC nem o Omie dizem que
              despesa é fixa: quem decide é a gestora do financeiro, na planilha
              {' '}<code>docs/despesas-fixas-para-classificar.xlsx</code>.
            </p>
            : d.fixas.porConta.length === 0
            ? <p className="legenda">Nenhuma despesa fixa paga neste mês.</p>
            : <table className="tabela-fixas">
              <thead><tr><th>Conta</th><th className="barra-col" /><th className="num">Pago</th><th className="num">% rec. líq.</th><th className="num">Linhas</th></tr></thead>
              <tbody>
                {d.fixas.porConta.map((g) => (
                  <ContaExplodivel key={g.conta} colunas={5} lancamentos={g.lancamentos}>
                    <td><span className="seta" aria-hidden="true">▸</span>{g.conta}</td>
                    <td className="barra-col"><span className="barrinha" style={{ width: `${Math.max(1, Math.round((g.valor / maior) * 100))}%` }} /></td>
                    <td className="num">{emReais(g.valor)}</td>
                    <td className="num">{peso.extras.receitaLiquida ? pct1(g.valor / peso.extras.receitaLiquida) : '—'}</td>
                    <td className="num">{g.n}</td>
                  </ContaExplodivel>
                ))}
              </tbody>
              <tfoot><tr><th>Total</th><td /><td className="num">{emReais(d.fixas.total)}</td><td className="num">{peso.valor === null ? '—' : pct1(peso.valor)}</td><td className="num">{d.fixas.porConta.reduce((n, g) => n + g.n, 0)}</td></tr></tfoot>
            </table>}
        </Quadro>
        )}
      </div>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Caixa pelo DFC (regime de caixa: cada lançamento no mês em que foi pago ou recebido). O que falta pagar e
          receber pelo Omie, recorte da MeuBESS, empresas {femp.somadas.join(' e ')}. A projeção é de caixa, não o lucro
          contábil — esse é a tela DRE.
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <Sessao />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </div>
  );
}
