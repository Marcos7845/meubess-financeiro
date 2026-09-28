// TELA 3 — CONTAS A RECEBER.
//
// O LAYOUT É O DA SKILL DE VISUALIZAÇÃO DE DADOS que o dono mandou em 28/09/2026 — guardada em
// `.claude/skills/visualizacao-de-dados/SKILL.md`, com as adaptações deste repositório no topo dela. A história desta
// tela (para quem é, que decisão ajuda a tomar, a frase de 5 segundos, as perguntas que ela responde), o plano de
// gráficos pergunta por pergunta e o checklist da fase 5 respondido estão em `docs/layout.md`. Quais BLOCOS a tela tem
// continua sendo `docs/referencias/tela-3-contas-a-receber.jpg`; o que mudou em 28/09/2026 foi só como eles são
// desenhados — o dono aprovou o padrão da Tela 1 naquele dia e pediu as outras duas no mesmo padrão.
//
// A ORDEM DA PÁGINA É A DO "F" da skill, a mesma das outras duas telas:
//   1. título e a frase de 5 segundos;  2. o recorte (os filtros);  3. a fila de números do topo;
//   4. o gráfico principal, maior e à esquerda;  5. os gráficos de apoio;  6. a tabela de detalhe.
//
// QUAL É O GRÁFICO PRINCIPAL, E POR QUÊ. O de cliente e status. A decisão desta tela é "para quem eu ligo hoje", e é
// ele que responde: quem deve mais, e quanto disso já venceu. Por isso ele ocupa o canto de cima à esquerda, que é
// por onde o olho entra.
//
// NENHUM NÚMERO, INDICADOR, FILTRO OU REGRA MUDOU nesta reforma: os 8 indicadores continuam vindo inteiros de
// `lib/indicadores/tela-3.mjs`, que não foi tocado, e `npm run conferir-telas` e `npm run conferir-filtros` continuam
// conferindo os mesmos 36 e 19. Os dois gráficos que viraram SVG do Recharts desenham exatamente o que as barras e as
// colunas de CSS desenhavam antes: o mesmo valor por cliente e a mesma contagem por mês.
//
// COMPONENTE DE SERVIDOR, como as outras duas: o cálculo roda no Node e para o navegador vai só o número já pronto.
// Os gráficos são o único pedaço de navegador da tela (`app/graficos.js`), e o que atravessa é rótulo, valor e código
// de cliente — nada mais.
//
// OS QUATRO FILTROS DESTA TELA são os de `docs/fontes.md`: "data de vencimento (de–até) · status · cliente ·
// categoria". Os quatro moram na URL, ao lado do ano e do mês:
//
//   ?de=2026-08-01&ate=2026-09-30   a janela de vencimento (`dDtVencDe` / `dDtVencAte`); sem ela, é o mês escolhido
//   ?status=pago,atrasado           as faixas do de-para do dono (25/09/2026); `CANCELADO` nunca é opção
//   ?cliente=2-1234567              empresa + `nCodCliente`, porque o código é próprio de cada empresa
//   ?categoria=1.01.01              o `cCodCateg` do título
//
// E O SEXTO, A CONTA BANCÁRIA (decisão do dono, 27/09/2026): `?conta=Caixinha,Stone`, seleção múltipla pelas contas
// da MeuBESS, desenhada por `app/conta.js` — o segundo filtro que as três telas dividem. Aqui ele vale INTEIRO: a
// conta é o `cabecTitulo.nCodCC`, o mesmo campo do recorte da MeuBESS.
//
// E O QUINTO FILTRO, O DE EMPRESA (decisão do dono, 27/09/2026): `?empresa=2`, três escolhas exclusivas — empresa 1,
// empresa 2 ou as duas —, desenhado por `app/empresa.js`, que as três telas usam. Nesta tela ele vale INTEIRO: os 4
// cartões e os 4 blocos são do Omie, lido uma vez por empresa.
//
// O DESENHO DELES É O DE 28/09/2026, pedido do dono ao rever a Tela 1 e valendo para as três: as etiquetas saíram e
// cada filtro de escolha — ano, mês, status, empresa e conta bancária — virou uma LISTA SUSPENSA COM CAIXAS DE MARCAR
// (`app/suspensa.js`). Eles e os quatro campos (as duas datas, o cliente e a categoria) vão num formulário `GET` só:
// apertar "aplicar" escreve tudo na URL de uma vez. Nenhum estado mora no navegador — a captura da tela e um link
// colado no chat mostram exatamente a mesma coisa.
//
// OS DOIS CAMPOS DE DATA VÊM VAZIOS quando a janela é a do mês, e é o mesmo filtro de sempre: vazio quer dizer "a
// janela do mês escolhido" (`lib/regras/filtros.mjs` já lia assim). Antes eles vinham preenchidos com as datas do mês,
// e agora que o mês e as datas estão no MESMO formulário, um campo preenchido venceria a troca de mês.
//
// A FRASE DE 5 SEGUNDOS, embaixo do título (decisão do dono, 28/09/2026): "X venceu e ainda não foi recebido". Ela não
// traz número novo — é o cartão "Valor Vencido", logo abaixo, dito em português. A primeira escrita dela dizia "já
// venceu e não entrou", e o dono trocou: "não entrou" é vago, porque não diz se o título foi cancelado, renegociado ou
// só não pago. "Venceu e ainda não foi recebido" é o que o número é: o valor em aberto dos títulos na faixa
// ATRASADO — vencidos, não cancelados e sem baixa.
//
// NENHUM NÚMERO NASCE AQUI: tudo vem de `lib/indicadores/tela-3.mjs`, pela camada de dados. Onde um dos quatro filtros
// não alcança o número, o bloco diz isso ali mesmo — ver `app/filtrado.js` e `docs/filtros.md`.

import React from 'react';

import { dadosDaTela3, mesCorrente } from '../../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../../lib/regras/periodo.mjs';
import { comoLista, comoTexto, paraCampoDeData } from '../../lib/regras/filtros.mjs';
import Atualizar from '../atualizar.js';
import FiltroDeConta, { ExplicaConta } from '../conta.js';
import { emReais } from '../dinheiro.js';
import FiltroDeEmpresa, { ExplicaEmpresa } from '../empresa.js';
import Filtrado from '../filtrado.js';
import { PorClienteEStatus, PorMesEStatus } from '../graficos.js';
import { Kpi, Quadro } from '../quadro.js';
import Suspensa from '../suspensa.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — Contas a Receber',
  description: 'Títulos a receber por status, cliente e mês de vencimento.',
};

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O dinheiro sai de `app/dinheiro.js`, o único formato das duas pontas da linha — o número que o servidor escreve no
// cartão e o que o Recharts escreve no eixo têm de sair com a mesma letra, que é a que a captura sabe apagar.
//
// O percentual da rosca fica aqui, com UMA casa decimal e sem separador de milhar: "13,89%" seria lido como dinheiro
// pela trava da captura, e a fatia de uma faixa merece a casa decimal.
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, useGrouping: false });

// As três faixas da tela, na ordem em que a referência as empilha, com o rótulo que o dono lê.
const FAIXAS = [
  { chave: 'pago', nome: 'Pago' },
  { chave: 'atrasado', nome: 'Atrasado' },
  { chave: 'aberto', nome: 'Em aberto' },
];

// O NOME DO CLIENTE, sempre com o código ao lado no `data-codigo`: é por ele que `scripts/capturar-tela.mjs` troca o
// nome antes de a captura entrar no repositório. Toda aparição de nome de cliente na tela passa por aqui ou pelo
// `tick` do gráfico em `app/graficos.js` — inclusive a lista do filtro, que é `<option data-codigo>`.
function Cliente({ c }) {
  return <span className="cliente" data-codigo={c.codigo}>{c.nome ?? `cliente ${c.codigo}`}</span>;
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

// A rosca de "Lançamentos por status", com o total no centro. SVG no próprio arquivo, e não Recharts: são três arcos
// de um círculo, e o desenho todo cabe em doze linhas — chamar a biblioteca para isso não pagaria.
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
  // OS QUATRO FILTROS vão crus para o cálculo; quem os normaliza é `lib/regras/filtros.mjs`, que sabe o formato de
  // cada um e devolve a janela do mês quando nenhum veio.
  const d = await dadosDaTela3({
    ano,
    mes,
    filtro: {
      de: comoTexto(q?.de), ate: comoTexto(q?.ate),
      status: comoLista(q?.status), cliente: comoTexto(q?.cliente), categoria: comoTexto(q?.categoria),
      empresa: comoLista(q?.empresa), conta: comoLista(q?.conta),
    },
  });
  const f = d.filtros;
  const femp = f.empresa;
  const fconta = f.conta;

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const bloco = (id) => d.blocos.find((b) => b.id === id);
  const porMes = bloco('por-mes-e-status');
  const porCliente = bloco('por-cliente-e-status');
  const listaBloco = bloco('lista-de-titulos');
  const porStatus = bloco('por-status');
  const clientes = porCliente.dados.slice(0, 10);
  const anos = [2026];
  const pendente = cartao('valor-pendente');
  // O NÚMERO DA FRASE DE 5 SEGUNDOS: o cartão "Valor Vencido", que é o valor em aberto dos títulos na faixa ATRASADO.
  const vencido = cartao('valor-vencido');

  // A COR DE CADA CARTÃO é a da faixa de que ele fala, a mesma do gráfico e da rosca. O "Valor previsto" não é faixa
  // nenhuma — é a soma das três —, e leva a cor da marca.
  const TOM = {
    'valor-previsto': 'marca', 'valor-recebido': 'f-pago', 'valor-pendente': 'f-aberto', 'valor-vencido': 'f-atrasado',
  };

  // O ÚNICO LINK DE FILTRO QUE SOBROU. Todo o resto é o formulário: as caixas de marcar e os quatro campos escrevem a
  // escolha na URL quando o "aplicar" é apertado. "limpar" volta a tela ao sem-filtro, guardando o mês que está sendo
  // lido — e é por isso que ele é só a URL com ano e mês.
  const semFiltro = `/receber?ano=${ano}&mes=${mes}`;
  const algumFiltro = f.vencimento.ativo || f.status.ativo || f.cliente.ativo || f.categoria.ativo;
  // A EMPRESA ESCOLHIDA ATRAVESSA AS ABAS: ela é o filtro das três telas, e trocar de tela não pode desfazê-la.
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}`
    + `${fconta.ativo ? `&conta=${encodeURIComponent(fconta.escolhidas.join(','))}` : ''}`;

  return (
    <div className="tela">
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">Contas a Receber</span>
        <nav className="abas">
          <a href={`/?ano=${ano}&mes=${mes}${paraOutraTela}`}>Gestão de Contas</a>
          <a href={`/dre?ano=${ano}&mes=${mes}${paraOutraTela}`}>DRE</a>
          <span className="ativa">Contas a Receber</span>
          <span>Centro de Custo</span>
          <span>Fluxo de caixa</span>
        </nav>
      </header>

      {/* 1. O TÍTULO E A FRASE DE 5 SEGUNDOS — o que quem cobra tem de levar daqui se olhar a tela e sair. Nenhum
          número novo: é o cartão "Valor Vencido", logo abaixo, dito em português. */}
      <section className="chamada">
        <h1>Vencendo de {d.janela.de} a {d.janela.ate}, empresas 1 e 2 somadas</h1>
        <p className="frase">
          {vencido.contagem.omie > 0
            ? <><b>{emReais(vencido.valor)}</b> venceu e ainda não foi recebido ({vencido.contagem.omie}{' '}
              {vencido.contagem.omie === 1 ? 'título' : 'títulos'} nesta janela).</>
            : <>Nenhum título desta janela venceu sem ser recebido.</>}
        </p>
        <p className="para-que">
          Para decidir para quem ligar hoje. Cada número diz, embaixo, quantos títulos entraram nele; os
          {' '}<code>CANCELADO</code> ficam fora da tela inteira (decisão do dono, 25/09/2026), e onde um filtro não
          alcança o número, o bloco diz isso ali mesmo.
        </p>
      </section>

      <AvisoDoOmie leituras={d.leituras} />

      {/* 2. O RECORTE: os sete filtros desta tela, os cinco de escolha em listas suspensas com caixas de marcar
          (decisão do dono, 28/09/2026) e os quatro campos como sempre foram, no mesmo formulário `GET`. O que cada um
          alcança ficou num bloco que abre e fecha, como na Tela 1. */}
      <section className="recorte">
        <form className="barra-filtros filtros-form" method="get" action="/receber">
          <Suspensa nome="ano" campo="ano" unica
            opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), marcada: a === ano }))} />

          <Suspensa nome="mês" campo="mes" unica
            opcoes={MESES_CURTOS.slice(1).map((m, i) => ({ valor: String(i + 1), rotulo: m, marcada: i + 1 === mes }))} />

          <Suspensa nome="status" campo="status"
            opcoes={f.status.opcoes.map((o) => ({
              valor: o.chave, rotulo: o.nome, marcada: f.status.escolhidos.includes(o.chave),
              dica: `${o.nome}: ${o.status.join(', ')}`,
            }))} />

          <FiltroDeEmpresa f={femp} />

          <FiltroDeConta f={fconta} />

          <label className="campo-filtro">
            <span>vencimento de</span>
            <input type="date" name="de" defaultValue={f.vencimento.ativo ? paraCampoDeData(f.vencimento.de) : ''} />
          </label>
          <label className="campo-filtro">
            <span>até</span>
            <input type="date" name="ate" defaultValue={f.vencimento.ativo ? paraCampoDeData(f.vencimento.ate) : ''} />
          </label>
          <label className="campo-filtro">
            <span>cliente ({f.cliente.opcoes.length} na janela)</span>
            <select name="cliente" defaultValue={f.cliente.escolhido ?? ''}>
              <option value="">todos</option>
              {f.cliente.opcoes.map((o) => (
                <option value={o.chave} key={o.chave} data-codigo={o.codigo}>
                  {o.nome ?? `cliente ${o.codigo}`}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-filtro">
            <span>categoria ({f.categoria.opcoes.length} na janela)</span>
            <select name="categoria" defaultValue={f.categoria.escolhido ?? ''}>
              <option value="">todas</option>
              {f.categoria.opcoes.map((o) => (
                <option value={o.codigo} key={o.codigo}>{o.codigo} — {o.descricao}</option>
              ))}
            </select>
          </label>
          <button className="botao filtro" type="submit">aplicar</button>
          <a className="limpar-tudo" href={semFiltro}>limpar</a>
        </form>

        <details className="explica">
          <summary>o que cada filtro alcança, e o que ele não alcança</summary>

          <ExplicaEmpresa f={femp}>
            Nesta tela ele vale nos 4 cartões e nos 4 blocos, no valor e na contagem: a tela é do Omie inteira. A lista
            de clientes do filtro passa a ser só a desta empresa, porque o <code>nCodCliente</code> é próprio de cada
            uma.
          </ExplicaEmpresa>

          <ExplicaConta f={fconta}>
            Nesta tela ele vale nos 4 cartões e nos 4 blocos, no valor e na contagem: a conta é o
            {' '}<code>cabecTitulo.nCodCC</code>, o mesmo campo pelo qual a tela já faz o recorte da MeuBESS.
          </ExplicaConta>

          <p>
            <strong>Janela de vencimento: {d.janela.de} a {d.janela.ate}</strong> ({d.filtros.naJanela} títulos, fora
            os <code>CANCELADO</code>).{' '}
            {algumFiltro
              ? <>
                Filtrado por {[f.vencimento.ativo ? 'vencimento' : null, f.status.ativo ? `status (${f.status.escolhidos.join(', ')})` : null,
                  f.cliente.ativo ? 'cliente' : null, f.categoria.ativo ? `categoria ${f.categoria.escolhido}` : null].filter(Boolean).join(' · ')}.
                Os quatro filtros valem para os quatro cartões e para os quatro blocos, com duas exceções que cada bloco
                diz ali mesmo: o gráfico por mês e status tem uma coluna por mês do ano e não se recorta pela janela de
                vencimento, e as contagens do cadastro de clientes não são títulos.
              </>
              : <>Sem filtro de status, cliente nem categoria: a tela mostra a janela inteira. Os dois campos de data
                vêm vazios, e vazio quer dizer “a janela do mês escolhido”.</>}
            {f.vencimento.foraDoAnoLido && (
              <> <strong>A janela sai de {ano}</strong>, e a leitura do Omie que está no cache é a de {ano}: título que
                vence fora do ano não aparece aqui.</>
            )}
          </p>
        </details>
      </section>

      {/* 3. A FILA DE NÚMEROS DO TOPO. Os 4 cartões de sempre, na ordem de sempre — que é a cascata da carteira, e é
          dela que vem o sentido: previsto, recebido, pendente, vencido. O "Valor Vencido" é o destacado porque é dele
          que a frase de 5 segundos fala; o que o destaca é o corpo do número, não a posição. O quadradinho ao lado do
          rótulo é a cor da faixa daquele cartão, a mesma do gráfico e da rosca. */}
      <section className="kpis de-4">
        {['valor-previsto', 'valor-recebido', 'valor-pendente', 'valor-vencido'].map((id) => {
          const c = cartao(id);
          return (
            <Kpi c={c} tom={TOM[id]} destaque={id === 'valor-vencido'} key={id}
              pe={`${c.contagem.omie} ${c.contagem.omie === 1 ? 'título' : 'títulos'} do Omie`} />
          );
        })}
      </section>

      {pendente.contagem.omie === 0 && !f.status.ativo && (
        <p className="aviso leve">
          <strong>Nenhum título em aberto vencendo de {d.janela.de} a {d.janela.ate}.</strong> Numa janela já fechada
          essa faixa é sempre vazia: todo título que venceu está pago ou atrasado, e os quatro status da faixa
          (<code>EMABERTO</code>, <code>AVENCER</code>, <code>VENCEHOJE</code>, <code>PAGTO_PARCIAL</code>) são os de
          um título que ainda não venceu. Escolha uma janela à frente para ver a carteira a vencer.
        </p>
      )}

      {/* 4 e 5. O GRÁFICO PRINCIPAL E OS DE APOIO. */}
      <div className="grade-g">
        <Quadro className="principal" titulo="De quem é o vencido"
          fonte={`os 10 maiores dos ${porCliente.contagem.extras.clientes} clientes da janela, cada um repartido pelas três faixas de status`}>
          <Legenda />
          <PorClienteEStatus clientes={clientes} />
          {clientes.length === 0 && <p className="legenda">nenhum título vence nesta janela.</p>}
          <Filtrado i={porCliente} />
        </Quadro>

        <Quadro titulo="Como está a carteira desta janela"
          fonte="quantos títulos em cada faixa, e o total no centro">
          <Rosca dados={porStatus.dados} />
          <Filtrado i={porStatus} />
        </Quadro>

        <Quadro className="larga" titulo="O que vence quando"
          fonte={`quantos títulos vencem em cada mês de ${ano}, repartidos pelas três faixas de status`}>
          <Legenda />
          <PorMesEStatus porMes={porMes.dados} mesEmFoco={d.mesDaJanela} />
          <Filtrado i={porMes} />
        </Quadro>
      </div>

      {/* 6. A TABELA DE DETALHE: os títulos, um a um. É a mesma lista de sempre; o que mudou é a moldura, que saiu. */}
      <section className="quadro detalhe">
        <h2>Os títulos, um a um</h2>
        <p className="fonte-do-quadro">
          os {listaBloco.contagem.omie} títulos da janela, fora os <code>CANCELADO</code> — a descrição vem dos
          produtos do pedido de venda ligado ao título, ou da categoria quando ele nasceu à mão
        </p>
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
                <tr><td colSpan={7} className="legenda">nenhum título passa pelos filtros escolhidos.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr><th colSpan={4}>Total — {listaBloco.contagem.omie} títulos</th>
                <td className="num">{emReais(listaBloco.total)}</td><td colSpan={2} /></tr>
            </tfoot>
          </table>
        </div>
      </section>

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
    </div>
  );
}
