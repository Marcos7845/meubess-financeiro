// TELA 2 — DRE, DEMONSTRATIVO DE RESULTADOS. Layout de `docs/referencias/tela-2-dre.jpg` (as cores daquela imagem
// não valem; as da marca ficam em `app/globals.css`).
//
// COMPONENTE DE SERVIDOR, como a Tela 1: o cálculo roda no Node e para o navegador vai só o número já pronto.
//
// A TABELA TEM UMA COLUNA POR MÊS, como a referência, e ao lado de cada uma cabem duas leituras:
//   AH — análise horizontal: quanto a coluna variou contra o mês anterior.
//   AV — análise vertical: quanto a linha pesa na receita líquida daquele mês.
// As duas ligam e desligam pelos botões do topo, que são links — o estado mora na URL (`?ah=1&av=1`), não no
// navegador, então a captura da tela e um link colado no chat mostram exatamente a mesma coisa.
//
// O FILTRO DESTA TELA é o de `docs/fontes.md`: MÊS, seleção múltipla. Cada pílula de mês acende e apaga, e o que está
// aceso vai para a URL (`?meses=5,6,7`), no mesmo lugar em que o `ah` e o `av` já moravam. Com meses escolhidos, a
// tabela mostra só aquelas colunas, os cartões do topo somam os meses escolhidos e a coluna "Total" passa a ser o
// total deles — o cabeçalho dela diz isso. "Todos" limpa a escolha e a tela volta ao de sempre: todas as colunas de
// abril em diante, cartões no mês da URL. Onde o filtro não alcança o número, a própria linha diz isso — ver
// `app/filtrado.js` e `docs/filtros.md`.

// `React.Fragment` escrito por extenso: o atalho `<>` não aceita `key`, e aqui cada grupo do DRE precisa de uma.
import React from 'react';

import { dadosDaTela2, mesCorrente } from '../../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../../lib/regras/periodo.mjs';
import { comoLista } from '../../lib/regras/filtros.mjs';
import Atualizar from '../atualizar.js';
import Filtrado from '../filtrado.js';
import UltimaLeitura, { AvisoDoOmie } from '../ultima-leitura.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MeuBESS · Financeiro — DRE',
  description: 'Demonstrativo de resultados por mês, com análise horizontal e vertical.',
};

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O dinheiro é formatado aqui, na hora de desenhar, e só aqui. Nada disso é gravado em arquivo.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
// Sem separador de milhar nos percentuais: uma variação de 1234,5% não pode virar "1.234,5%", que a trava da captura
// leria como valor em dinheiro.
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1, useGrouping: false });
const emReais = (centavos) => dinheiro.format((centavos ?? 0) / 100);
const emPorcento = (x) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : porcento.format(x));

// A fita dos doze meses ao lado do número do cartão, como na tela de referência. SVG no próprio arquivo — a página
// não chama biblioteca de gráfico nenhuma.
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

function Cartao({ c }) {
  const valor = c.tipo === 'percentual'
    ? (c.valor === null ? '—' : emPorcento(c.valor))
    : `${c.negativo ? '-' : ''}${emReais(c.valor)}`;
  return (
    <div className="cartao dre">
      <div className="rotulo" title={c.nome}>{c.nome}</div>
      <div className={`numero${c.negativo ? ' neg' : ''}`}>{valor}</div>
      <Fita serie={c.serie} />
      <div className="pe">
        {c.contagem.dfc !== null ? `${c.contagem.dfc} do DFC · ` : ''}{c.contagem.omie} do Omie
      </div>
      <Filtrado i={c} />
    </div>
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

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  // A tela só tem coluna de abril em diante (decisão do dono, 27/09/2026; ver a nota abaixo do topo e
  // `lib/indicadores/tela-2.mjs`); um `mes` de janeiro a março na URL cai em abril.
  const mes = Math.max(4, Number(q?.mes ?? corrente.mes));
  const comAh = q?.ah !== '0';
  const comAv = q?.av === '1';
  // O FILTRO DE MESES vem da URL como lista de números; quem o normaliza é `lib/regras/filtros.mjs`, no cálculo.
  const d = await dadosDaTela2({ ano, mes, filtro: { meses: comoLista(q?.meses) } });
  const fMeses = d.filtros.meses;

  const url = (troca) => {
    const p = new URLSearchParams({ ano: String(ano), mes: String(mes), ah: comAh ? '1' : '0', av: comAv ? '1' : '0' });
    if (fMeses.escolhidos.length) p.set('meses', fMeses.escolhidos.join(','));
    for (const [k, v] of Object.entries(troca)) {
      if (v === null || v === '') p.delete(k); else p.set(k, String(v));
    }
    return `/dre?${p}`;
  };
  // Clicar num mês acende; clicar de novo apaga. É a mesma pílula de antes, agora com escolha múltipla.
  const alternar = (m) => (fMeses.escolhidos.includes(m)
    ? fMeses.escolhidos.filter((x) => x !== m)
    : [...fMeses.escolhidos, m]).sort((a, b) => a - b);

  const colunas = d.tabela[0]?.porMes ?? [];
  const porColuna = 1 + (comAh ? 1 : 0) + (comAv ? 1 : 0);
  // A coluna em destaque é a do mês da URL, e só existe quando não há escolha de meses: com meses escolhidos, todas
  // as colunas da tabela são as escolhidas e destacar uma delas não diria nada.
  const emFoco = (m) => !fMeses.ativo && m === mes;

  // "(+) Receitas" sobe é bom; "(−) alguma coisa" sobe é ruim. As linhas "(=)" seguem o resultado.
  const bomSubir = (linha) => linha.sinal !== '−';

  return (
    <>
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">DRE — Demonstrativo de Resultados</span>
        <nav className="abas">
          <a href={`/?ano=${ano}&mes=${mes}`}>Gestão de Contas</a>
          <span className="ativa">DRE</span>
          <a href={`/receber?ano=${ano}&mes=${mes}`}>Contas a Receber</a>
        </nav>
      </header>

      <AvisoDoOmie leituras={d.leituras} />

      {!d.dfc.ok && (
        <p className="aviso">
          <strong>O DFC do mês escolhido não foi lido</strong> — {d.dfc.motivo}. As linhas cuja fonte principal é o
          DFC (deduções, custos de vendas e impostos pagos) aparecem zeradas, e com elas todos os totalizadores
          abaixo; o lado do Omie segue valendo.
        </p>
      )}

      <p className="aviso leve">
        <strong>Sem depreciação e sem amortização:</strong> o Omie não tem categoria para elas, então o EBITDA e o
        lucro líquido desta tela não as descontam (decisão do dono, 25/09/2026).
      </p>

      <p className="aviso leve">
        <strong>Janeiro a março de 2026 ficam fora desta tela:</strong> o Omie tem poucos lançamentos da MeuBESS
        nesses três meses (decisão do dono, 27/09/2026).
      </p>

      <section className="cartoes dre">
        {d.cartoes.map((c) => <Cartao c={c} key={c.id} />)}
      </section>

      {fMeses.semColuna.length > 0 && (
        <p className="aviso">
          <strong>Mês escolhido que não tem coluna aqui:</strong>{' '}
          {fMeses.semColuna.map((x) => `${NOMES_DOS_MESES[x.mes]} — ${x.motivo}`).join('; ')}. Ele ficou fora da conta
          dos cartões e da coluna Total, e a tela diz isso em vez de somar um mês vazio como se fosse mês cheio.
        </p>
      )}

      <div className="barra-filtros">
        <span className="rotulo-filtro">meses</span>
        <span className="grupo">
          <a className={`pilula limpar${fMeses.escolhidos.length === 0 ? ' ativa' : ''}`} href={url({ meses: null })}>todos</a>
          {MESES_CURTOS.slice(4).map((m, i) => (
            <a className={`pilula${fMeses.escolhidos.includes(i + 4) || emFoco(i + 4) ? ' ativa' : ''}`}
              href={url({ meses: alternar(i + 4).join(',') || null })} key={m}>{m}</a>
          ))}
        </span>
        <span className="grupo">
          <a className={`pilula${comAh ? ' ativa' : ''}`} href={url({ ah: comAh ? 0 : 1 })}>Análise Horizontal</a>
          <a className={`pilula${comAv ? ' ativa' : ''}`} href={url({ av: comAv ? 0 : 1 })}>Análise Vertical</a>
        </span>
      </div>

      <p className="aviso leve">
        {fMeses.ativo
          ? <>
            <strong>Filtrado por mês:</strong> {fMeses.somados.map((m) => NOMES_DOS_MESES[m]).join(', ')}. A tabela
            mostra só essas colunas, os cartões do topo somam esses meses e a coluna <strong>Total</strong> é o total
            deles — não do ano. A margem de lucro é refeita da soma (lucro líquido dos meses sobre a receita bruta dos
            meses), e nunca a média das margens de cada mês. A <strong>AH</strong> da primeira coluna escolhida não tem
            mês anterior dentro da escolha, e sai “—”.
          </>
          : <>
            <strong>Sem filtro de mês:</strong> a tabela mostra as {fMeses.opcoes.length} colunas que existem
            ({fMeses.opcoes.map((m) => NOMES_DOS_MESES[m]).join(', ')}), a coluna <strong>Total</strong> é a soma
            delas, e os cartões do topo são de {NOMES_DOS_MESES[mes]}. As pílulas de mês escolhem vários de uma vez.
          </>}
      </p>

      <section className="painel larga tabela-dre">
        <h2>
          {fMeses.ativo
            ? `${fMeses.somados.map((m) => NOMES_DOS_MESES[m]).join(' + ')} de ${ano} — as colunas escolhidas, e o total delas`
            : `${NOMES_DOS_MESES[mes]} de ${ano} — a coluna do mês escolhido vem marcada; as outras são o resto do ano`}
        </h2>
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
                  <td className="num" colSpan={porColuna} key={c.mes}>{c.dfc} do DFC · {c.omie} do Omie</td>
                ))}
                <td className="num total" colSpan={1 + (comAv ? 1 : 0)}>
                  {d.cobertura.reduce((s, c) => s + c.dfc, 0)} · {d.cobertura.reduce((s, c) => s + c.omie, 0)}
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
          coluna não se lê como DRE — é por isso que <strong>janeiro a março</strong> não têm coluna aqui (nota acima).
          A leitura do Omie que está no cache vai de <strong>01/01 a 30/09</strong>: mês fora dessa janela também não
          tem coluna.
        </p>
      </section>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora — o Omie pela API, só consulta.
          {d.dfc.ok ? ` DFC: ${d.dfc.fonte}, ${d.dfc.arquivo} (${d.dfc.mesesLidos.length} dos 12 meses do ano lidos).` : ''}
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </>
  );
}
