// TELA 3 — CONTAS A RECEBER. Layout de `docs/referencias/tela-3-contas-a-receber.jpg` (as cores daquela imagem não
// valem; as da marca ficam em `app/globals.css`).
//
// COMPONENTE DE SERVIDOR, como as Telas 1 e 2: o cálculo roda no Node e para o navegador vai só o número já pronto.
//
// OS QUATRO FILTROS DESTA TELA são os de `docs/fontes.md`: "data de vencimento (de–até) · status · cliente ·
// categoria". Os quatro moram na URL, ao lado do ano e do mês:
//
//   ?de=2026-08-01&ate=2026-09-30   a janela de vencimento (`dDtVencDe` / `dDtVencAte`); sem ela, é o mês das pílulas
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
// cartões e os 4 blocos são do Omie, lido uma vez por empresa. As duas contagens do cadastro de clientes são a única
// ressalva, e o bloco delas diz isso.
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
import FiltroDeEmpresa, { ExplicaEmpresa } from '../empresa.js';
import Filtrado from '../filtrado.js';
import Suspensa from '../suspensa.js';
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
// nome antes de a captura entrar no repositório. Toda aparição de nome de cliente na tela passa por aqui — inclusive a
// lista do filtro, que é `<option data-codigo>` e a mesma troca alcança.
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
        <Filtrado i={c} />
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
  const maiorMes = Math.max(1, ...porMes.dados.map((x) => x.total));
  const clientes = porCliente.dados.slice(0, 10);
  const maiorCliente = Math.max(1, ...clientes.map((c) => c.total));
  const anos = [2026];
  const pendente = cartao('valor-pendente');
  // O NÚMERO DA FRASE DE 5 SEGUNDOS: o cartão "Valor Vencido", que é o valor em aberto dos títulos na faixa ATRASADO.
  const vencido = cartao('valor-vencido');

  // O ÚNICO LINK DE FILTRO QUE SOBROU. Todo o resto é o formulário: as caixas de marcar e os quatro campos escrevem a
  // escolha na URL quando o "aplicar" é apertado. "limpar" volta a tela ao sem-filtro, guardando o mês que está sendo
  // lido — e é por isso que ele é só a URL com ano e mês.
  const semFiltro = `/receber?ano=${ano}&mes=${mes}`;
  const algumFiltro = f.vencimento.ativo || f.status.ativo || f.cliente.ativo || f.categoria.ativo;
  // A EMPRESA ESCOLHIDA ATRAVESSA AS ABAS: ela é o filtro das três telas, e trocar de tela não pode desfazê-la.
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}`
    + `${fconta.ativo ? `&conta=${encodeURIComponent(fconta.escolhidas.join(','))}` : ''}`;

  return (
    <>
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

      <AvisoDoOmie leituras={d.leituras} />

      {/* A FRASE DE 5 SEGUNDOS — o que quem cobra tem de levar daqui se olhar a tela e sair. Nenhum número novo: é o
          cartão "Valor Vencido", logo abaixo, dito em português. */}
      <section className="chamada">
        <p className="frase">
          {vencido.contagem.omie > 0
            ? <><b>{emReais(vencido.valor)}</b> venceu e ainda não foi recebido ({vencido.contagem.omie}{' '}
              {vencido.contagem.omie === 1 ? 'título' : 'títulos'} nesta janela).</>
            : <>Nenhum título desta janela venceu sem ser recebido.</>}
        </p>
      </section>

      {/* O RECORTE, numa faixa só: os sete filtros desta tela, os cinco de escolha em listas suspensas com caixas de
          marcar (decisão do dono, 28/09/2026) e os quatro campos como sempre foram, no mesmo formulário `GET`. As
          opções e o que cada um alcança são as mesmas de antes. */}
      <form className="barra-filtros receber filtros-form" method="get" action="/receber">
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

      <ExplicaEmpresa f={femp}>
        Nesta tela ele vale nos 4 cartões e nos 4 blocos, no valor e na contagem: a tela é do Omie inteira. As duas
        contagens do cadastro de clientes continuam as duas, lado a lado, e o bloco delas diz isso. A lista de clientes
        do filtro passa a ser só a desta empresa, porque o <code>nCodCliente</code> é próprio de cada uma.
      </ExplicaEmpresa>

      <ExplicaConta f={fconta}>
        Nesta tela ele vale nos 4 cartões e nos 4 blocos, no valor e na contagem: a conta é o
        {' '}<code>cabecTitulo.nCodCC</code>, o mesmo campo pelo qual a tela já faz o recorte da MeuBESS. Só as duas
        contagens do cadastro de clientes ficam de fora, e o bloco delas diz isso.
      </ExplicaConta>

      <p className="aviso leve">
        <strong>Janela de vencimento: {d.janela.de} a {d.janela.ate}</strong> ({d.filtros.naJanela} títulos, fora os
        {' '}<code>CANCELADO</code>).{' '}
        {algumFiltro
          ? <>
            Filtrado por {[f.vencimento.ativo ? 'vencimento' : null, f.status.ativo ? `status (${f.status.escolhidos.join(', ')})` : null,
              f.cliente.ativo ? 'cliente' : null, f.categoria.ativo ? `categoria ${f.categoria.escolhido}` : null].filter(Boolean).join(' · ')}.
            Os quatro filtros valem para os quatro cartões e para os quatro blocos, com duas exceções que cada bloco
            diz ali mesmo: o gráfico por mês e status tem uma coluna por mês do ano e não se recorta pela janela de
            vencimento, e as contagens do cadastro de clientes não são títulos.
          </>
          : <>Sem filtro de status, cliente nem categoria: a tela mostra a janela inteira.</>}
        {f.vencimento.foraDoAnoLido && (
          <> <strong>A janela sai de {ano}</strong>, e a leitura do Omie que está no cache é a de {ano}: título que
            vence fora do ano não aparece aqui.</>
        )}
      </p>

      <section className="cartoes receber">
        <Cartao c={cartao('valor-previsto')} tom="marca" />
        <Cartao c={cartao('valor-recebido')} tom="f-pago" />
        <Cartao c={cartao('valor-pendente')} tom="f-aberto" />
        <Cartao c={cartao('valor-vencido')} tom="f-atrasado" />
      </section>

      {pendente.contagem.omie === 0 && !f.status.ativo && (
        <p className="aviso leve">
          <strong>Nenhum título em aberto vencendo de {d.janela.de} a {d.janela.ate}.</strong> Numa janela já fechada
          essa faixa é sempre vazia: todo título que venceu está pago ou atrasado, e os quatro status da faixa
          (<code>EMABERTO</code>, <code>AVENCER</code>, <code>VENCEHOJE</code>, <code>PAGTO_PARCIAL</code>) são os de
          um título que ainda não venceu. Escolha uma janela à frente para ver a carteira a vencer.
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
            <Filtrado i={porMes} />
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
            <Filtrado i={porCliente} />
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

        <section className="painel">
          <h2 className="alt">Qtde Lançamentos — por status</h2>
          <div className="corpo">
            <Rosca dados={porStatus.dados} />
            <Filtrado i={porStatus} />
          </div>
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
