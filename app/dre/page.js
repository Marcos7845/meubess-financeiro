// TELA 2 — DRE, DEMONSTRATIVO DE RESULTADOS.
//
// O LAYOUT É O DA SKILL DE VISUALIZAÇÃO DE DADOS que o dono mandou em 28/09/2026 — guardada em
// `.claude/skills/visualizacao-de-dados/SKILL.md`, com as adaptações deste repositório no topo dela. A história desta
// tela (para quem é, que decisão ajuda a tomar, a frase de 5 segundos, as perguntas que ela responde), o plano de
// gráficos pergunta por pergunta e o checklist da fase 5 respondido estão em `docs/layout.md`. Quais BLOCOS a tela tem
// continua sendo `docs/referencias/tela-2-dre.jpg`; o que mudou em 28/09/2026 foi só como eles são desenhados — o dono
// aprovou o padrão da Tela 1 naquele dia e pediu as outras duas no mesmo padrão.
//
// A ORDEM DA PÁGINA É A DO "F" da skill, a mesma das outras duas telas:
//   1. título e a frase de 5 segundos;  2. o recorte (os filtros);  3. a fila de números do topo;
//   4. o gráfico principal, maior e à esquerda;  5. os gráficos de apoio;  6. a tabela de detalhe.
//
// NENHUM NÚMERO, INDICADOR, FILTRO OU REGRA MUDOU nesta reforma: os 17 indicadores continuam vindo inteiros de
// `lib/indicadores/tela-2.mjs`, que não foi tocado, e `npm run conferir-telas` e `npm run conferir-filtros` continuam
// conferindo os mesmos 36 e 19. Os dois gráficos novos desenham números que a tela já mostrava: a margem de cada mês
// é a série que a fita do cartão "Margem de lucro" desenha desde sempre, e o peso de cada linha sobre a receita
// líquida é a coluna AV da tabela.
//
// A FRASE DE 5 SEGUNDOS, aprovada pelo dono em 28/09/2026: "o lucro líquido do ano até aqui é X, e a margem é Y".
// Ela esperava esta passagem para entrar, e o motivo está escrito em `docs/layout.md`: "o ano até aqui" não é nenhum
// dos cinco cartões, que são do mês. Os dois números dela são a COLUNA "Total" da tabela, logo abaixo — `totalDoAno`
// de `lib/indicadores/tela-2.mjs`, que já a calculava para a tabela —, e por isso a frase não traz número novo. Com
// meses escolhidos no filtro, "o ano até aqui" vira "os meses escolhidos", que é o que a coluna Total passa a ser.
//
// COMPONENTE DE SERVIDOR, como as outras duas: o cálculo roda no Node e para o navegador vai só o número já pronto.
// Os gráficos são o único pedaço de navegador da tela (`app/graficos.js`).
//
// A TABELA TEM UMA COLUNA POR MÊS, como a referência, e ao lado de cada uma cabem duas leituras:
//   AH — análise horizontal: quanto a coluna variou contra o mês anterior.
//   AV — análise vertical: quanto a linha pesa na receita líquida daquele mês.
// As duas ligam e desligam por duas caixas de marcar — o estado mora na URL (`?ah=1&av=1`), não no navegador, então a
// captura da tela e um link colado no chat mostram exatamente a mesma coisa. Sem `ah` na URL, a AH vem ligada, como
// sempre veio; é por isso que o formulário manda `ah=0` junto e a caixa marcada acrescenta o `ah=1`.
//
// O FILTRO DE EMPRESA (decisão do dono, 27/09/2026) mora na mesma URL — `?empresa=2` —, e o desenho dele está em
// `app/empresa.js`, que as três telas usam. Ele vale nas linhas e nos cartões de fonte Omie e em toda contagem do Omie;
// nas linhas de fonte DFC e nas linhas "(=)" que misturam as duas fontes, a própria linha diz que não vale.
//
// O FILTRO DESTA TELA é o de `docs/fontes.md`: MÊS, seleção múltipla, na URL como `?meses=5,6,7`. Com meses escolhidos,
// a tabela mostra só aquelas colunas, os cartões do topo somam os meses escolhidos e a coluna "Total" passa a ser o
// total deles — o cabeçalho dela diz isso. Sem escolha nenhuma a tela é a de sempre: todas as colunas de abril em
// diante, cartões no mês da URL. Onde o filtro não alcança o número, a própria linha diz isso — ver `app/filtrado.js`
// e `docs/filtros.md`.
//
// O DESENHO DOS FILTROS É O DE 28/09/2026, pedido do dono ao rever a Tela 1 e valendo para as três: as etiquetas
// saíram e cada filtro de escolha virou uma LISTA SUSPENSA COM CAIXAS DE MARCAR (`app/suspensa.js`). Os quatro — meses,
// empresa, conta bancária e as duas leituras da tabela — vão num formulário `GET` só, e o "aplicar" escreve todas as
// escolhas na URL de uma vez. Nenhum número, filtro ou opção mudou com isso.

// `React.Fragment` escrito por extenso: o atalho `<>` não aceita `key`, e aqui cada grupo do DRE precisa de uma.
import React from 'react';

import { dadosDaTela2, mesCorrente } from '../../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../../lib/regras/periodo.mjs';
import { comoLista } from '../../lib/regras/filtros.mjs';
import Atualizar from '../atualizar.js';
import ChaveDoOmie, { AvisoSemOmie } from '../chave-omie.js';
import FiltroDeConta, { ExplicaConta } from '../conta.js';
import { emReais } from '../dinheiro.js';
import FiltroDeEmpresa, { ExplicaEmpresa } from '../empresa.js';
import Filtrado from '../filtrado.js';
import Lancamentos from '../lancamentos.js';
import { MargemNoAno, PesoNaReceita } from '../graficos.js';
import { Kpi, Quadro } from '../quadro.js';
import Suspensa from '../suspensa.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';
import Sessao, { exigirLogin } from '../sessao.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — DRE gerencial (regime de caixa)',
  description: 'Demonstrativo de resultados por mês, com análise horizontal e vertical.',
};

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O DINHEIRO SAI DE `app/dinheiro.js`, o único formato das duas pontas da linha (ver o cabeçalho daquele arquivo).
//
// O PERCENTUAL DESTA TELA, NÃO: ele fica aqui, com UMA casa decimal e sem separador de milhar. A análise horizontal
// de uma linha pequena pode dar 1234,5%, e "1.234,5%" seria lido como dinheiro pela trava de
// `scripts/capturar-tela.mjs`. O `emPorcento` de `app/dinheiro.js`, que os gráficos usam, arredonda para inteiro —
// serve para o eixo, não para a célula da tabela, onde meio ponto percentual conta.
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, useGrouping: false });
const emPorcento = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : porcento.format(x));

// A fita dos doze meses embaixo do número do cartão, como na tela de referência. SVG no próprio arquivo: é uma linha
// de doze pontos, e chamar o Recharts para isso seria desenhar um gráfico dentro de um número.
function Fita({ serie }) {
  const pts = serie.filter((x) => Number.isFinite(x.valor));
  if (pts.length < 2) return null;
  const vs = pts.map((x) => x.valor);
  const min = Math.min(...vs), max = Math.max(...vs), faixa = max - min || 1;
  // Os pares vão separados por ESPAÇO, e não por vírgula: "M0.0,13.0" traria um "0,13" para dentro do HTML, e a
  // trava de `scripts/capturar-tela.mjs` — que recusa qualquer número com centavos — leria aquilo como dinheiro.
  const d = pts.map((x, i) => {
    const px = (i / (pts.length - 1)) * 100;
    const py = 22 - ((x.valor - min) / faixa) * 20;
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="fita" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Uma seta e uma cor para a análise horizontal: subir receita é bom, subir despesa não é. Quem sabe o sinal da linha
// é a própria linha, por isso `bom` vem de fora.
function Variacao({ x, bom }) {
  if (x === null || x === undefined || !Number.isFinite(x)) return <span className="ah vazio">—</span>;
  const positiva = x > 0;
  const classe = x === 0 ? '' : (positiva === bom ? ' up' : ' down');
  return <span className={`ah${classe}`}>{positiva ? '▲' : (x < 0 ? '▼' : '')} {emPorcento(x)}</span>;
}

function Celulas({ ponto, bom, comAh, comAv }) {
  return (
    <>
      <td className="num">{emReais(ponto.valor)}</td>
      {comAh && <td className="num ah-col"><Variacao x={ponto.ah} bom={bom} /></td>}
      {comAv && <td className="num av-col">{emPorcento(ponto.av)}</td>}
    </>
  );
}

// O BLOCO "COMPROMISSOS" (decisão do dono, 29/09/2026) — o passivo, abaixo da tabela do DRE. Cinco números do mês da
// URL — o quinto, as provisões por projeto da aba `PROVISÃO` do DFC, desde o fim do mesmo dia —, e cada um abre as linhas de que saiu (`app/lancamentos.js`). Nenhum número nasce aqui: tudo chega pronto de
// `lib/indicadores/tela-2.mjs`, que usa as regras de `lib/regras/passivo.mjs`.
const COLUNAS_DA_DIVIDA = [
  { rotulo: 'dia', chave: 'dia', tipo: 'num' }, { rotulo: 'fonte', chave: 'fonte' }, { rotulo: 'empresa', chave: 'empresa' },
  { rotulo: 'categoria / SUB 2', chave: 'categoria' }, { rotulo: 'descrição', chave: 'descricao' },
  { rotulo: 'título no DFC', chave: 'titulo' }, { rotulo: 'linha da planilha', chave: 'linhaDfc', tipo: 'num' },
  { rotulo: 'valor', chave: 'valor', tipo: 'reais' },
];
const COLUNAS_DOS_SINAIS = [
  { rotulo: 'pedido', chave: 'pedido' }, { rotulo: 'cliente', chave: 'cliente' }, { rotulo: 'pago em', chave: 'pago' },
  { rotulo: 'NF', chave: 'nf' }, { rotulo: '', chave: 'cancelado' }, { rotulo: 'valor', chave: 'valor', tipo: 'reais' },
];
const COLUNAS_DOS_CONTRATOS = [
  { rotulo: 'banco', chave: 'banco' }, { rotulo: 'contrato', chave: 'contrato' }, { rotulo: 'tipo', chave: 'tipo' },
  { rotulo: 'parcelas pagas', chave: 'pagas', tipo: 'num' }, { rotulo: 'de', chave: 'parcelas', tipo: 'num' },
  { rotulo: 'saldo', chave: 'saldo', tipo: 'reais' }, { rotulo: 'vence em até 3 meses', chave: 'ate3', tipo: 'reais' },
  { rotulo: '3 a 12 meses', chave: 'de3a12', tipo: 'reais' }, { rotulo: 'mais de 12', chave: 'mais12', tipo: 'reais' },
];
const COLUNAS_DOS_BANCOS = [{ rotulo: 'banco', chave: 'banco' }, { rotulo: 'último saldo do mês', chave: 'valor', tipo: 'reais' }];
const COLUNAS_DAS_PROVISOES = [
  { rotulo: 'projeto', chave: 'projeto' }, { rotulo: 'cliente', chave: 'cliente' }, { rotulo: 'consultor', chave: 'consultor' },
  { rotulo: 'frete', chave: 'frete', tipo: 'reais' }, { rotulo: 'repasse', chave: 'repasse', tipo: 'reais' },
  { rotulo: 'comissão', chave: 'comissao', tipo: 'reais' }, { rotulo: 'comissão head', chave: 'comissaoHead', tipo: 'reais' },
  { rotulo: 'soma', chave: 'total', tipo: 'reais' }, { rotulo: 'linha da planilha', chave: 'linha', tipo: 'num' },
];

// AS PROVISÕES POR PROJETO, o quadro que abre embaixo do bloco. Ele aparece também com a chave do Omie desligada: a aba
// `PROVISÃO` é só do DFC (`livre`, de `lib/indicadores/tela-2.mjs`).
function ProvisoesPorProjeto({ p }) {
  return (
    <div className="compromisso">
      <h3>Provisões por projeto</h3>
      <p className="fonte-do-quadro">{p.fonte}</p>
      {p.valor === null
        ? <p className="legenda"><strong>{p.semValor}</strong> — {p.porque}.</p>
        : (
          <>
            <table className="conta-do-compromisso">
              <tbody>
                {p.porProvisao.map((x) => (
                  <tr key={x.id}><th>{x.rotulo}</th><td className="num">{emReais(x.valor)}</td><td>{x.projetos} projetos</td></tr>
                ))}
                <tr className="total">
                  <th>= provisionado{p.data ? ` em ${p.data}` : ''}</th>
                  <td className="num">{emReais(p.valor)}</td>
                  <td><Lancamentos rotulo="projetos" um="projeto" colunas={COLUNAS_DAS_PROVISOES} linhas={p.projetos} /></td>
                </tr>
              </tbody>
            </table>
            <p className="legenda">
              o que o financeiro provisionou para pagar a terceiros por projeto já vendido: frete, repasse, comissão e
              comissão head. A aba não diz o que já foi pago, e a compra, o imposto e o valor final dela ficam fora
              daqui (ver <code>docs/fontes.md</code>).
            </p>
          </>
        )}
    </div>
  );
}

function Compromissos({ c }) {
  const item = (id) => c.itens.find((i) => i.id === id);
  const giro = item('capital-de-giro'), obrig = item('obrigacoes-clientes');
  const liquida = item('divida-liquida'), semTerceiros = item('resultado-sem-terceiros');
  const prov = item('provisoes-projetos');
  const pe = (i) => `${i.contagem.dfc !== null ? `${i.contagem.dfc} do DFC · ` : ''}${i.contagem.omie !== null ? `${i.contagem.omie} do Omie` : ''}`.replace(/ · $/, '');
  return (
    <section className="quadro detalhe compromissos">
      <h2>Compromissos — {c.nomeDoMes} de {c.ano}</h2>
      <p className="fonte-do-quadro">
        o que a empresa deve e a quem, no fim do mês — fora do DRE: a parcela de empréstimo não é despesa e o sinal do
        cliente já contou como receita no mês em que entrou. Cada número abre os lançamentos de que saiu.
      </p>
      {c.bloqueado && <p className="aviso leve"><strong>Sem números neste recorte:</strong> {c.bloqueado}.</p>}
      <div className="kpis de-5">
        <div className="kpi">
          <div className="rotulo">{giro.nome}</div>
          <div className="numero">{giro.valor === null ? '—' : emReais(giro.valor)}</div>
          {!c.bloqueado && giro.semValor && <div className="pe"><strong>{giro.semValor}</strong></div>}
          <div className="pe">{pe(giro)}</div>
        </div>
        <div className="kpi">
          <div className="rotulo">{obrig.nome}</div>
          <div className="numero">{emReais(obrig.valor)}</div>
          <div className="pe">{obrig.contagem.omie} sinais em aberto, do Omie</div>
        </div>
        <div className="kpi">
          <div className="rotulo">{liquida.nome}</div>
          <div className="numero">{liquida.valor === null ? '—' : emReais(liquida.valor)}</div>
          {!c.bloqueado && liquida.semValor && <div className="pe"><strong>{liquida.semValor}</strong></div>}
          <div className="pe">{pe(liquida)}</div>
        </div>
        <div className="kpi">
          <div className="rotulo">{semTerceiros.nome}</div>
          <div className="numero">{emReais(semTerceiros.valor)}</div>
          <div className="pe">{pe(semTerceiros)}</div>
        </div>
        <div className="kpi">
          <div className="rotulo">{prov.nome}</div>
          <div className="numero">{prov.valor === null ? '—' : emReais(prov.valor)}</div>
          {prov.livre && prov.semValor && <div className="pe"><strong>{prov.semValor}</strong></div>}
          <div className="pe">{prov.contagem.dfc === null ? 'da aba PROVISÃO do DFC' : `${prov.contagem.dfc} projetos, da aba PROVISÃO do DFC`}</div>
        </div>
      </div>

      {!c.bloqueado && (
        <div className="compromissos-detalhe">
          <div className="compromisso">
            <h3>Capital de giro tomado</h3>
            <p className="fonte-do-quadro">{giro.fonte}</p>
            <table className="conta-do-compromisso">
              <tbody>
                {giro.fluxo.map((g) => (
                  <tr key={g.id}>
                    <th>{g.rotulo} no mês</th>
                    <td className="num">{emReais(g.valor)}</td>
                    <td><Lancamentos colunas={COLUNAS_DA_DIVIDA} linhas={g.lancamentos} /></td>
                  </tr>
                ))}
                <tr className="total">
                  <th>saldo devedor no fim do mês</th>
                  <td className="num">{giro.valor === null ? '—' : emReais(giro.valor)}</td>
                  <td>{giro.valor === null
                    ? <span className="legenda">{giro.semValor} — {giro.porque}</span>
                    : <Lancamentos rotulo="contratos" um="contrato" colunas={COLUNAS_DOS_CONTRATOS} linhas={giro.contratos} />}</td>
                </tr>
                {giro.faixas && (
                  <tr>
                    <th>vencimentos, pelo valor das parcelas</th>
                    <td colSpan="2">
                      até 3 meses <b>{emReais(giro.faixas.ate3)}</b> · 3 a 12 meses <b>{emReais(giro.faixas.de3a12)}</b>
                      {' '}· mais de 12 meses <b>{emReais(giro.faixas.mais12)}</b>
                      {giro.antecipacao ? <> · antecipação de recebíveis no saldo <b>{emReais(giro.antecipacao)}</b></> : null}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="legenda">
              o mesmo pagamento no Omie e no DFC (mesmo sentido, mesmo dia, mesmo valor) conta uma vez: foram{' '}
              {giro.contagem.extras.pares} neste mês. Juros e IOF continuam no resultado financeiro do DRE; aqui eles só
              aparecem.{giro.recusados?.length ? ` ${giro.recusados.length} linha(s) da planilha de contratos ficaram de fora por falta de ${[...new Set(giro.recusados.flatMap((r) => r.faltam))].join(', ')}.` : ''}
            </p>
          </div>

          <div className="compromisso">
            <h3>Obrigações com clientes</h3>
            <p className="fonte-do-quadro">{obrig.fonte}</p>
            <table className="conta-do-compromisso">
              <tbody>
                <tr><th>no começo do mês</th><td className="num">{emReais(obrig.inicio)}</td><td>{obrig.contagem.extras.noInicio} sinais</td></tr>
                <tr><th>+ sinais novos</th><td className="num">{emReais(obrig.novos)}</td><td><Lancamentos rotulo="sinais" um="sinal" colunas={COLUNAS_DOS_SINAIS} linhas={obrig.lancamentos.novos} /></td></tr>
                <tr><th>− baixados com a NF</th><td className="num">{emReais(obrig.baixados)}</td><td><Lancamentos rotulo="sinais" um="sinal" colunas={COLUNAS_DOS_SINAIS} linhas={obrig.lancamentos.baixados} /></td></tr>
                <tr className="total"><th>= no fim do mês</th><td className="num">{emReais(obrig.valor)}</td><td><Lancamentos rotulo="sinais" um="sinal" colunas={COLUNAS_DOS_SINAIS} linhas={obrig.lancamentos.saldo} /></td></tr>
              </tbody>
            </table>
            <p className="legenda">
              {obrig.contagem.extras.pedidoCancelado} dos {obrig.contagem.omie} sinais em aberto são de pedido que o Omie
              marca como cancelado, sem NF — o dinheiro entrou e nenhuma devolução está registrada, e eles continuam no
              saldo até o financeiro confirmar a devolução.
            </p>
          </div>

          <div className="compromisso">
            <h3>Dívida líquida</h3>
            <p className="fonte-do-quadro">{liquida.fonte}</p>
            <table className="conta-do-compromisso">
              <tbody>
                <tr><th>capital de giro tomado</th><td className="num">{liquida.saldoDevedor === null ? '—' : emReais(liquida.saldoDevedor)}</td><td>{liquida.saldoDevedor === null ? <span className="legenda">{liquida.semValor}</span> : null}</td></tr>
                <tr><th>− saldo dos bancos</th><td className="num">{emReais(liquida.saldoDosBancos)}</td><td><Lancamentos rotulo="bancos" um="banco" colunas={COLUNAS_DOS_BANCOS} linhas={liquida.bancos} /></td></tr>
                <tr className="total"><th>= dívida líquida</th><td className="num">{liquida.valor === null ? '—' : emReais(liquida.valor)}</td><td /></tr>
              </tbody>
            </table>
          </div>

          <div className="compromisso">
            <h3>Resultado sem dinheiro de terceiros</h3>
            <p className="fonte-do-quadro">{semTerceiros.fonte}</p>
            <table className="conta-do-compromisso">
              <tbody>
                <tr><th>lucro líquido do DRE (caixa)</th><td className="num">{emReais(semTerceiros.partes.lucro)}</td><td>a linha &quot;(=) Lucro líquido&quot;, acima</td></tr>
                <tr><th>− variação dos sinais em aberto</th><td className="num">{emReais(semTerceiros.partes.variacaoObrigacoes)}</td><td>sinais recebidos de pedidos sem NF {emReais(semTerceiros.partes.novos)} − sinais baixados {emReais(semTerceiros.partes.baixados)}</td></tr>
                <tr><td colSpan={3} className="legenda">empréstimo, captação e amortização não entram: já estão fora do DRE</td></tr>
                <tr className="total"><th>= resultado sem dinheiro de terceiros</th><td className="num">{emReais(semTerceiros.valor)}</td><td /></tr>
              </tbody>
            </table>
          </div>

          <ProvisoesPorProjeto p={prov} />
        </div>
      )}

      {/* Com a chave do Omie desligada, só as provisões ficam: elas são do DFC. */}
      {c.bloqueado && prov.livre && (
        <div className="compromissos-detalhe">
          <ProvisoesPorProjeto p={prov} />
        </div>
      )}
    </section>
  );
}

export default async function Pagina({ searchParams }) {
  await exigirLogin();
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  // A tela só tem coluna de abril em diante (decisão do dono, 27/09/2026; ver a nota abaixo do topo e
  // `lib/indicadores/tela-2.mjs`); um `mes` de janeiro a março na URL cai em abril.
  const mes = Math.max(4, Number(q?.mes ?? corrente.mes));
  // AS DUAS LEITURAS DA TABELA, lidas como lista porque agora elas vêm de caixa de marcar: o formulário manda sempre
  // o `ah=0` e o `av=0`, e a caixa marcada acrescenta o `1`. Sem nada na URL, a AH vem ligada e a AV desligada — é o
  // que `?ah=1` e `?ah=0` sempre quiseram dizer, e um link antigo continua abrindo a mesma tela.
  const lidoAh = comoLista(q?.ah);
  const comAh = lidoAh.length === 0 || lidoAh.includes('1');
  const comAv = comoLista(q?.av).includes('1');
  // O FILTRO DE MESES vem da URL como lista de números; quem o normaliza é `lib/regras/filtros.mjs`, no cálculo.
  const d = await dadosDaTela2({
    ano,
    mes,
    // A CHAVE "INCLUIR DADOS DO OMIE" (decisão do dono, 28/09/2026) vai crua, como os filtros: quem a lê é
    // `lib/regras/filtros.mjs`, e sem nada na URL ela está LIGADA — a tela é a de sempre.
    filtro: {
      meses: comoLista(q?.meses), empresa: comoLista(q?.empresa), conta: comoLista(q?.conta),
      omie: comoLista(q?.omie),
    },
  });
  const fMeses = d.filtros.meses;
  const femp = d.filtros.empresa;
  const fconta = d.filtros.conta;
  const comOmie = d.filtros.omie.ligado;

  // O ÚNICO LINK DE FILTRO QUE SOBROU. Todo o resto é o formulário: as caixas de marcar escrevem a escolha na URL
  // quando o "aplicar" é apertado. "limpar" volta a tela ao sem-filtro, guardando o mês lido e as duas leituras.
  // A CHAVE DO OMIE ATRAVESSA O "limpar", como as duas leituras da tabela: ela não é filtro, é uma forma de ver.
  const semFiltro = `/dre?ano=${ano}&mes=${mes}&ah=${comAh ? '1' : '0'}&av=${comAv ? '1' : '0'}`
    + `${comOmie ? '' : '&omie=0'}`;

  const colunas = d.tabela[0]?.porMes ?? [];
  const porColuna = 1 + (comAh ? 1 : 0) + (comAv ? 1 : 0);
  // A coluna em destaque é a do mês da URL, e só existe quando não há escolha de meses: com meses escolhidos, todas
  // as colunas da tabela são as escolhidas e destacar uma delas não diria nada.
  const emFoco = (m) => !fMeses.ativo && m === mes;

  // "(+) Receitas" sobe é bom; "(−) alguma coisa" sobe é ruim. As linhas "(=)" seguem o resultado.
  const bomSubir = (linha) => linha.sinal !== '−';
  // A EMPRESA ESCOLHIDA ATRAVESSA AS ABAS: ela é o filtro das três telas, e trocar de tela não pode desfazê-la.
  // E A CHAVE DO OMIE TAMBÉM: ela vale nas três telas, e trocar de tela não pode religá-la.
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}`
    + `${fconta.ativo ? `&conta=${encodeURIComponent(fconta.escolhidas.join(','))}` : ''}`
    + `${comOmie ? '' : '&omie=0'}`;

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  // A SÉRIE DO GRÁFICO PRINCIPAL é a do cartão "Margem de lucro": a mesma que a fita dele desenha, mês a mês.
  const margem = cartao('cartao-margem');
  // O PESO DE CADA LINHA SOBRE A RECEITA LÍQUIDA: a coluna AV do mês em foco, ou a da coluna "Total" quando há meses
  // escolhidos — é a mesma AV que a tabela escreve, lida da mesma linha.
  const colunaDaAv = fMeses.ativo ? null : colunas.find((c) => c.mes === mes);
  const pesos = d.tabela.map((l) => ({
    rotulo: l.rotulo,
    av: colunaDaAv ? (l.porMes.find((p) => p.mes === mes)?.av ?? null) : l.totalAv,
  })).filter((l) => l.av !== null && Number.isFinite(l.av));
  const mesesDaSoma = fMeses.ativo ? fMeses.somados : colunas.map((c) => c.mes);

  return (
    <div className="tela">
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">DRE gerencial (regime de caixa)</span>
        <nav className="abas">
          <a href={`/?ano=${ano}&mes=${mes}${paraOutraTela}`}>Gestão de Contas</a>
          <span className="ativa">DRE</span>
          <a href={`/fluxo-de-caixa?ano=${ano}&mes=${mes}${paraOutraTela}`}>Fluxo de Caixa</a>
        </nav>
      </header>

      {/* 1. O TÍTULO E A FRASE DE 5 SEGUNDOS. Os dois números dela são a coluna "Total" da tabela, logo abaixo. */}
      <section className="chamada">
        <h1>
          {fMeses.ativo
            ? `${fMeses.somados.map((m) => NOMES_DOS_MESES[m]).join(' + ')} de ${ano}, empresas 1 e 2 somadas`
            : `${ano} até aqui, empresas 1 e 2 somadas`}
        </h1>
        <p className="frase">
          {comOmie
            ? <>O lucro líquido {fMeses.ativo ? 'dos meses escolhidos' : 'do ano até aqui'} é
              {' '}<b>{emReais(d.totalDoAno.lucroLiquido)}</b>, e a margem é
              {' '}<b>{emPorcento(d.totalDoAno.margem)}</b>.</>
            : <>Sem o Omie não há lucro líquido nem margem: as duas descem de
              {' '}<b>&quot;(+) Receitas&quot;</b> e <b>&quot;(−) Despesas gerais&quot;</b>, que são do Omie.</>}
        </p>
        <p className="para-que">
          Para ver em que linha do resultado o dinheiro está escapando, e desde quando. Os dois números da frase são a
          coluna <strong>Total</strong> da tabela lá embaixo — {mesesDaSoma.length}{' '}
          {mesesDaSoma.length === 1 ? 'mês' : 'meses'} ({mesesDaSoma.map((m) => NOMES_DOS_MESES[m]).join(', ')}) —, e a
          margem é o lucro líquido dessa soma sobre a receita bruta dela, nunca a média das margens de cada mês. Os
          cinco números do topo são do mês escolhido.
        </p>
      </section>

      {/* O aviso da releitura do Omie só faz sentido com o Omie na conta. */}
      {comOmie && <AvisoDoOmie leituras={d.leituras} />}

      <AvisoSemOmie ligado={comOmie}>
        <strong>O que sobra desta tela:</strong> os dois primeiros cartões do topo —
        &quot;Receita total&quot; e &quot;Custos e despesas&quot; — e três linhas da tabela,
        &quot;(−) Deduções&quot;, &quot;(−) Custos de vendas&quot; e &quot;(−) Impostos pagos (guias)&quot;, com o
        valor de cada mês e a coluna <strong>Total</strong> inteiros: as cinco são do DFC.
        {' '}<strong>O que sai:</strong> as outras nove linhas, os três últimos cartões, os dois gráficos, a coluna
        <strong> AV</strong> de todas as linhas — ela é a linha sobre a receita líquida, e a receita líquida mistura as
        duas fontes — e a contagem &quot;do Omie&quot; de cada indicador e de cada coluna. As linhas
        &quot;(=)&quot; saem porque somam as DUAS fontes: escrever só a metade do DFC daria um EBITDA que não é o
        EBITDA.
      </AvisoSemOmie>

      {!d.dfc.ok && (
        <p className="aviso">
          <strong>O DFC do mês escolhido não foi lido</strong> — {d.dfc.motivo}. As linhas cuja fonte principal é o
          DFC (deduções, custos de vendas e impostos pagos) aparecem zeradas, e com elas todos os totalizadores
          abaixo; o lado do Omie segue valendo.
        </p>
      )}

      {fMeses.semColuna.length > 0 && (
        <p className="aviso">
          <strong>Mês escolhido que não tem coluna aqui:</strong>{' '}
          {fMeses.semColuna.map((x) => `${NOMES_DOS_MESES[x.mes]} — ${x.motivo}`).join('; ')}. Ele ficou fora da conta
          dos cartões e da coluna Total, e a tela diz isso em vez de somar um mês vazio como se fosse mês cheio.
        </p>
      )}

      {/* 2. O RECORTE. Os mesmos quatro filtros de sempre, com as mesmas opções e na mesma URL; o que cada um alcança
          ficou num bloco que abre e fecha, como na Tela 1, para não empurrar os números para baixo da dobra. */}
      <section className="recorte">
        <form className="barra-filtros filtros-form" method="get" action="/dre">
          <input type="hidden" name="ano" value={ano} />
          <input type="hidden" name="mes" value={mes} />
          {/* Sem estes dois, uma caixa desmarcada não mandaria nada e a AH voltaria a ligar sozinha. */}
          <input type="hidden" name="ah" value="0" />
          <input type="hidden" name="av" value="0" />

          <Suspensa nome="meses" campo="meses"
            opcoes={MESES_CURTOS.slice(4).map((m, i) => ({
              valor: String(i + 4), rotulo: m, marcada: fMeses.escolhidos.includes(i + 4),
            }))} />

          <FiltroDeEmpresa f={femp} />

          <FiltroDeConta f={fconta} />

          <ChaveDoOmie ligado={comOmie} />

          <Suspensa nome="leituras da tabela" campo="leituras" vazio="nenhuma"
            opcoes={[
              { campo: 'ah', valor: '1', rotulo: 'Análise Horizontal', marcada: comAh, dica: 'variação contra o mês anterior' },
              { campo: 'av', valor: '1', rotulo: 'Análise Vertical', marcada: comAv, dica: 'a linha como fatia da receita líquida do mês' },
            ]} />

          <button className="botao filtro" type="submit">aplicar</button>
          <a className="limpar-tudo" href={semFiltro}>limpar</a>
        </form>

        <details className="explica">
          <summary>o que cada filtro alcança, e o que ele não alcança</summary>

          {/* A CHAVE DO OMIE NÃO É FILTRO, mas é aqui que o dono vem perguntar o que ela faz. */}
          <p>
            <strong>A chave &quot;incluir dados do Omie&quot;</strong>{' '}
            {comOmie
              ? <>está ligada, que é o padrão: os 17 indicadores são os de sempre. Desligá-la tira da conta todo número
                cuja fonte é o Omie e deixa as cinco de fonte DFC — dois cartões e três linhas — intactas. Ela não é
                filtro: não recorta lançamento nenhum, tira uma FONTE inteira.</>
              : <>está desligada. Os filtros de <strong>empresa</strong> e de <strong>conta bancária</strong> só
                alcançavam o lado do Omie desta tela, e por isso não alcançam número nenhum enquanto ela estiver assim;
                o de <strong>meses</strong> continua valendo, porque escolhe QUAIS colunas a tabela mostra, e as três
                linhas do DFC seguem essa escolha. Eles continuam na tela, com as mesmas opções, para a escolha não se
                perder quando a chave voltar.</>}
          </p>

          <ExplicaEmpresa f={femp}>
            Ele vale em &quot;(+) Receitas&quot;, &quot;(=) Receita bruta&quot;, &quot;(−) Despesas gerais&quot;,
            &quot;(+/−) Resultado financeiro&quot; e &quot;(=) sem conta&quot;, e em toda contagem do Omie da tabela. As
            linhas de fonte DFC — deduções, custos de vendas e impostos pagos — e os dois primeiros cartões do topo
            dizem, cada um, que o número é das duas empresas somadas; e as linhas &quot;(=)&quot; que misturam as duas
            fontes dizem que uma das pontas não é filtrada. A última linha da tabela também: o lado do DFC dela é das
            duas empresas.
          </ExplicaEmpresa>

          <ExplicaConta f={fconta}>
            Ele vale nas mesmas linhas e nos mesmos cartões que o de empresa — &quot;(+) Receitas&quot;,
            &quot;(=) Receita bruta&quot;, &quot;(−) Despesas gerais&quot;, &quot;(+/−) Resultado financeiro&quot; e
            &quot;(=) sem conta&quot; — e em toda contagem do Omie da tabela. As linhas de fonte DFC e os dois primeiros
            cartões do topo dizem, cada um, que o número é de todas as contas somadas.
          </ExplicaConta>

          <p>
            {fMeses.ativo
              ? <>
                <strong>Filtrado por mês:</strong> {fMeses.somados.map((m) => NOMES_DOS_MESES[m]).join(', ')}. A tabela
                mostra só essas colunas, os cartões do topo somam esses meses e a coluna <strong>Total</strong> é o
                total deles — não do ano. A margem de lucro é refeita da soma (lucro líquido dos meses sobre a receita
                bruta dos meses), e nunca a média das margens de cada mês. A <strong>AH</strong> da primeira coluna
                escolhida não tem mês anterior dentro da escolha, e sai “—”.
              </>
              : <>
                <strong>Sem filtro de mês:</strong> a tabela mostra as {fMeses.opcoes.length} colunas que existem
                ({fMeses.opcoes.map((m) => NOMES_DOS_MESES[m]).join(', ')}), a coluna <strong>Total</strong> é a soma
                delas, e os cartões do topo são de {NOMES_DOS_MESES[mes]}. A lista suspensa de meses escolhe vários de
                uma vez.
              </>}
          </p>

          <p>
            <strong>Sem depreciação e sem amortização:</strong> o Omie não tem categoria para elas, então o EBITDA e o
            lucro líquido desta tela não as descontam (decisão do dono, 25/09/2026).
            {' '}<strong>Janeiro a março de 2026 ficam fora desta tela:</strong> o Omie tem poucos lançamentos da
            MeuBESS nesses três meses (decisão do dono, 27/09/2026).
          </p>
        </details>
      </section>

      {/* 3. A FILA DE NÚMEROS DO TOPO. Os 5 cartões de sempre, na ordem de sempre — que é a cascata do DRE, e é dela
          que vem o sentido: receita, custo, EBITDA, lucro, margem. O "Lucro líquido" é o destacado porque é dele que
          a frase de 5 segundos fala; o que o destaca é o corpo do número, não a posição. */}
      <section className="kpis de-5">
        {d.cartoes.map((c) => (
          <Kpi c={c} destaque={c.id === 'cartao-lucro-liquido'} key={c.id}
            texto={c.tipo === 'percentual' ? emPorcento(c.valor) : null}>
            <Fita serie={c.serie} />
          </Kpi>
        ))}
      </section>

      {/* 4 e 5. O GRÁFICO PRINCIPAL E OS DE APOIO. */}
      <div className="grade-g">
        <Quadro className="principal" titulo="Em que mês a margem caiu"
          fonte={`a margem de lucro de cada uma das ${colunas.length} colunas do ano — a mesma série que a fita do cartão "Margem de lucro" desenha`}>
          <MargemNoAno serie={margem.serie} mesEmFoco={fMeses.ativo ? null : mes} />
          {margem.serie.length === 0 && <p className="legenda">nenhuma coluna do ano foi lida.</p>}
          <Filtrado i={margem} />
        </Quadro>

        <Quadro titulo={`Quanto cada linha pesa sobre a receita${fMeses.ativo ? '' : ` em ${NOMES_DOS_MESES[mes]}`}`}
          fonte={fMeses.ativo
            ? 'a análise vertical da coluna Total — cada linha como fatia da receita líquida dos meses escolhidos'
            : `a análise vertical da coluna de ${NOMES_DOS_MESES[mes]} — cada linha como fatia da receita líquida do mês`}>
          <PesoNaReceita linhas={pesos} />
          {pesos.length === 0 && <p className="legenda">não há receita líquida nesta coluna para repartir.</p>}
        </Quadro>

      </div>

      {/* 6. A TABELA DE DETALHE: o DRE inteiro, linha por linha e mês a mês. É a mesma tabela de sempre; o que mudou
          é a moldura, que saiu. */}
      <section className="quadro detalhe tabela-dre">
        <h2>
          {fMeses.ativo
            ? `${fMeses.somados.map((m) => NOMES_DOS_MESES[m]).join(' + ')} de ${ano} — as colunas escolhidas, e o total delas`
            : `${NOMES_DOS_MESES[mes]} de ${ano} — a coluna do mês escolhido vem marcada; as outras são o resto do ano`}
        </h2>
        <p className="fonte-do-quadro">
          os {d.tabela.length} grupos do DRE, com o valor exato de cada mês — o mesmo que
          <code> npm run conferir-telas </code> compara com <code>docs/conferencia.md</code>
        </p>
        <div className="rolagem">
          <table className="dre-tabela">
            <thead>
              <tr>
                <th className="grupo-col" rowSpan="2">Grupo</th>
                {colunas.map((c) => (
                  <th className={`mes-col${emFoco(c.mes) ? ' escolhido' : ''}`} colSpan={porColuna} key={c.mes}>
                    {MESES_CURTOS[c.mes]} | {ano}
                  </th>
                ))}
                <th className="mes-col total" colSpan={1 + (comAv ? 1 : 0)}>
                  {fMeses.ativo ? `Total dos ${fMeses.somados.length} meses` : 'Total'}
                </th>
              </tr>
              <tr>
                {colunas.map((c) => (
                  <React.Fragment key={c.mes}>
                    <th className={`sub${emFoco(c.mes) ? ' escolhido' : ''}`}>Realizado</th>
                    {comAh && <th className={`sub ah-col${emFoco(c.mes) ? ' escolhido' : ''}`}>AH</th>}
                    {comAv && <th className={`sub av-col${emFoco(c.mes) ? ' escolhido' : ''}`}>AV</th>}
                  </React.Fragment>
                ))}
                <th className="sub total">Realizado</th>
                {comAv && <th className="sub av-col total">AV</th>}
              </tr>
            </thead>
            <tbody>
              {d.tabela.map((linha) => (
                <React.Fragment key={linha.id}>
                  {linha.grupo && (
                    <tr className="cabeca-grupo">
                      <td colSpan={1 + colunas.length * porColuna + 1 + (comAv ? 1 : 0)}>{linha.grupo}</td>
                    </tr>
                  )}
                  <tr className={linha.total ? 'linha-total' : (linha.foraDoTotal ? 'linha-fora' : '')}>
                    <th className="grupo-col" title={linha.nota ?? linha.rotulo}>
                      {linha.rotulo}
                      <Filtrado i={linha} />
                    </th>
                    {linha.porMes.map((p) => (
                      <Celulas ponto={p} bom={bomSubir(linha)} comAh={comAh} comAv={comAv} key={p.mes} />
                    ))}
                    <td className="num total">{emReais(linha.total)}</td>
                    {comAv && <td className="num av-col total">{emPorcento(linha.totalAv)}</td>}
                  </tr>
                  {linha.detalhe.map((det) => (
                    <tr className="linha-detalhe" key={det.chave}>
                      <th className="grupo-col">{det.rotulo}</th>
                      {det.porMes.map((p) => (
                        <Celulas ponto={p} bom={bomSubir(linha)} comAh={comAh} comAv={comAv} key={p.mes} />
                      ))}
                      <td className="num total">{emReais(det.total)}</td>
                      {comAv && <td className="num av-col total">{emPorcento(det.totalAv)}</td>}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="cobertura">
                <th className="grupo-col">De quanta leitura a coluna saiu</th>
                {d.cobertura.map((c) => (
                  <td className="num" colSpan={porColuna} key={c.mes}>
                    {c.dfc} do DFC · {c.omie === null ? 'sem o Omie' : `${c.omie} do Omie`}
                  </td>
                ))}
                <td className="num total" colSpan={1 + (comAv ? 1 : 0)}>
                  {d.cobertura.reduce((s, c) => s + c.dfc, 0)}
                  {' · '}
                  {comOmie ? d.cobertura.reduce((s, c) => s + c.omie, 0) : 'sem o Omie'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="legenda rodape-tabela">
          <strong>AH</strong> = variação contra o mês anterior. <strong>AV</strong> = a linha como fatia da receita
          líquida do próprio mês. As duas são leitura desta tela, não regra de <code>docs/fontes.md</code>: saem dos
          valores que as regras já calcularam. A linha <strong>(=) sem conta</strong> fica fora dos totalizadores, de
          propósito — é o alarme de lançamento em categoria sem conta do DRE.
        </p>
        <p className="legenda rodape-tabela">
          <strong>A última linha diz de quanta leitura cada coluna saiu</strong>, dos dois lados. Onde os dois números
          estiverem muito distantes, os totalizadores daquele mês misturam um lado cheio com outro quase vazio, e a
          coluna não se lê como DRE — é por isso que <strong>janeiro a março</strong> não têm coluna aqui. A leitura do
          Omie que está no cache vai de <strong>01/01 a 30/09</strong>: mês fora dessa janela também não tem coluna.
        </p>
      </section>

      {/* 7. OS COMPROMISSOS (decisão do dono, 29/09/2026): o passivo, abaixo do DRE e fora dele. */}
      <Compromissos c={d.compromissos} />

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora — o Omie pela API, só consulta.
          {d.dfc.ok ? ` DFC: ${d.dfc.fonte}, ${d.dfc.arquivo} (${d.dfc.mesesLidos.length} dos 12 meses do ano lidos).` : ''}
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <Sessao />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </div>
  );
}
