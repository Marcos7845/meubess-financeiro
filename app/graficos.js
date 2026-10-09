'use client';
// OS GRÁFICOS DAS TRÊS TELAS, DESENHADOS COM RECHARTS.
//
// DE ONDE VEM O DESENHO. Da skill de visualização de dados que o dono mandou em 28/09/2026, guardada em
// `.claude/skills/visualizacao-de-dados/SKILL.md`; o plano de qual gráfico responde qual pergunta, e por quê, está
// em `docs/layout.md`. Aqui não se decide nada: chega o número já calculado por `lib/indicadores/` e sai o desenho.
//
// O ESTILO (08/10/2026). O dono mandou o modelo de um gráfico de linha shadcn/Recharts e pediu a mesma linguagem em
// todos os gráficos do portal. O que veio dele, e onde mora:
//   - curva suave (`monotone`) de 2 px, com sombra suave da cor da linha (`<filter>` em `ESTILO`) e um degradê quase
//     transparente sob ela (`<Area>`);
//   - fundo de grade pontilhada (`<pattern>` em `ESTILO`) e régua horizontal tracejada `4 8`, sem linha vertical;
//   - eixos sem linha nem traço, rótulo pequeno (12 px) e margem folgada;
//   - pontos só nos destaques — o maior, o menor e o selecionado (`pontosDeDestaque`) —, com borda branca e sombra;
//   - linha de referência vertical tracejada no selecionado, cursor tracejado e a dica em cartão arredondado
//     (`Dica`), com o título e o valor em negrito.
// Nas barras vale a mesma linguagem: a mesma grade e os mesmos eixos, cantos arredondados, cursor em faixa clara e a
// mesma dica. Só o desenho mudou: os dados de cada gráfico saem de `app/graficos-dados.mjs`, com a mesma conta de
// antes (`testes/graficos-dados.test.mjs`), e os formatos em R$, os rótulos e os nomes das séries são os de sempre.
// Não entrou biblioteca nova: o modelo é Recharts + Tailwind, e o projeto já tem o Recharts 2 e as cores em CSS.
//
// COMPONENTE DE NAVEGADOR, e é o único da tela. O que atravessa a linha é só o que já ia para o HTML de qualquer
// jeito: rótulo, valor em centavos e código de cliente. Nenhuma chave, nenhum caminho de pasta, nenhum arquivo.
//
// TRÊS AMARRAS QUE PARECEM DETALHE E NÃO SÃO:
//
//   1. `isAnimationActive={false}` em tudo. Com animação, o primeiro desenho é o quadro zero — barra de altura 0 —,
//      e é justamente ele que o servidor manda no HTML. `scripts/capturar-tela.mjs` joga fora todo `<script>`, então
//      a captura ficaria com os gráficos vazios. Sem animação, o SVG já sai pronto do servidor.
//   2. LARGURA E ALTURA FIXAS, sem `ResponsiveContainer`. O `ResponsiveContainer` mede o elemento no navegador e por
//      isso não desenha nada no servidor — mesmo problema. Os números abaixo são só a PROPORÇÃO: o `viewBox` do SVG
//      mais a regra `.grafico .recharts-wrapper { width: 100% }` de `app/globals.css` fazem o desenho acompanhar a
//      largura do painel (é o que mantém o gráfico legível em tela pequena).
//   3. NENHUMA COR AQUI. As cores da marca moram todas em `app/globals.css` — é o que o cabeçalho daquele arquivo
//      manda. Cada série recebe uma `className` e pinta com `currentColor`; o degradê, a sombra e o ponto de destaque
//      também são classes, e é o CSS que diz qual é a cor.
//
// E O NOME DO CLIENTE. No eixo do "De quem veio a receita" ele sai num `<text class="cliente" data-codigo="…">`, a
// mesma marca que o resto do projeto usa, para `scripts/capturar-tela.mjs` trocar o nome pelo código antes de a
// captura entrar no repositório.

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, Rectangle, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useEffect, useRef, useState } from 'react';

import { emPorcento, emReais } from './dinheiro.js';
import {
  FAIXAS_DA_TELA_3, MESES_CURTOS, dadosAnoInteiro, dadosDiaADia, dadosFluxo, dadosMargem, dadosPesoNaReceita,
  dadosPorCliente, dadosPorMes, dadosRankingDespesa, dadosRankingReceita, linhasDaDica, pontosDeDestaque,
} from './graficos-dados.mjs';

// A LARGURA DE VERDADE DO GRÁFICO (correção de 28/09/2026: o dono passava o mouse e não via os valores). O gráfico é
// desenhado no SERVIDOR com largura fixa — `scripts/capturar-tela.mjs` joga fora todo `<script>`, e a captura precisa do
// SVG pronto — e o CSS o esticava até a largura do quadro. Esticado, o Recharts lê o mouse na escala errada: medido,
// numa janela de 1280 px o mouse na barra do dia 12 mostrava o dia 14, e numa de 1920 px não mostrava nada. Agora, no
// navegador, cada gráfico mede o quadro e se redesenha naquela largura, e o mouse cai no ponto certo. No servidor (e na
// captura) continua a largura fixa de sempre, e a primeira pintura é idêntica — sem diferença de hidratação.
function useLargura(padrao) {
  const ref = useRef(null);
  const [largura, setLargura] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setLargura(w); };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}

// O eixo de valor é sempre dinheiro, e sempre com a letra de `app/dinheiro.js` — é ela que a captura sabe apagar.
// Sem linha nem traço, rótulo de 12 px e um respiro (`tickMargin`) entre o texto e o desenho.
const EIXO_VALOR = {
  tickFormatter: emReais, tickLine: false, axisLine: false, width: 98, tickMargin: 12,
  className: 'eixo', tick: { fontSize: 12 },
};
const EIXO_ROTULO = { tickLine: false, axisLine: false, tickMargin: 12, className: 'eixo', tick: { fontSize: 12 } };
// A grade é só horizontal e tracejada `4 8`: linha vertical não ajuda a ler valor nenhum destes gráficos.
const GRADE = { vertical: false, className: 'grade-grafico', strokeDasharray: '4 8' };
// O cursor da dica: tracejado nas linhas, uma faixa clara e arredondada nas barras. A cor é do CSS.
const CURSOR_LINHA = { className: 'cursor-linha', strokeDasharray: '4 4' };
const CURSOR_BARRA = { className: 'cursor-barra', radius: 6 };
const LINHA_DE_REFERENCIA = { strokeDasharray: '4 4' };

// O QUE O ESTILO DESENHA ANTES DAS SÉRIES, no `<defs>` de cada gráfico: o pontilhado do fundo, a sombra dos pontos e,
// para cada série de linha, a sombra da linha e o degradê da área. As cores não estão aqui — cada peça leva uma classe
// (`app/globals.css`, "o estilo dos gráficos"). Os ids repetem de um gráfico para outro e o conteúdo é sempre o mesmo.
const SERIES_DE_LINHA = ['receita', 'despesa', 'margem', 'saldo', 'previsao'];
const ESTILO = (
  <defs>
    <pattern id="pontilhado" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle className="ponto-do-fundo" cx="10" cy="10" r="1.1" />
    </pattern>
    <filter id="sombra-ponto" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow className="sombra-ponto" dx="0" dy="2" stdDeviation="2.5" />
    </filter>
    {SERIES_DE_LINHA.map((s) => (
      <filter id={`sombra-${s}`} key={`f-${s}`} x="-20%" y="-60%" width="140%" height="260%">
        <feDropShadow className={`sombra-linha de-${s}`} dx="0" dy="5" stdDeviation="5" />
      </filter>
    ))}
    {SERIES_DE_LINHA.map((s) => (
      <linearGradient id={`degrade-${s}`} key={`g-${s}`} className={`degrade de-${s}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopOpacity="0.16" />
        <stop offset="100%" stopOpacity="0" />
      </linearGradient>
    ))}
  </defs>
);
const FUNDO_PONTILHADO = <rect x="0" y="0" width="100%" height="100%" fill="url(#pontilhado)" style={{ pointerEvents: 'none' }} />;

// A DICA: um cartão arredondado com o título (o dia, o mês) e, por série, o nome e o valor em negrito. O texto é o de
// sempre — `formato(valor, nome)` devolve `[valor em texto, nome]`, como o `formatter` da dica antiga —, só a caixa
// mudou. `classes` liga a chave da série à classe que pinta a bolinha ao lado do nome. As séries que só ajudam a
// desenhar (degradê, contorno) e as repetidas ficam de fora: `linhasDaDica`, em `app/graficos-dados.mjs`.
function Dica({ active, payload, label, formato, titulo, classes, omitir }) {
  const linhas = linhasDaDica(payload).filter((p, _i, todas) => !omitir?.(p, todas));
  if (!active || !linhas.length) return null;
  const t = titulo ? titulo(label) : label;
  return (
    <div className="dica-cartao">
      {t ? <div className="dica-titulo">{t}</div> : null}
      {linhas.map((p) => {
        const [valor, nome] = formato(p.value, p.name, p);
        return (
          <div className="dica-linha" key={String(p.dataKey)}>
            <i className={`dica-chip ${classes?.[p.dataKey] ?? ''}`} />
            <span className="dica-nome">{nome}</span>
            <b className="dica-valor">{valor}</b>
          </div>
        );
      })}
    </div>
  );
}
const dica = (props, cursor) => (
  <Tooltip content={<Dica {...props} />} cursor={cursor} isAnimationActive={false} wrapperClassName="dica-grafico" />
);
const FORMATO_REAIS = (v, n) => [emReais(v), n];
const FORMATO_PORCENTO = (v, n) => [emPorcento(v), n];

// O PONTO DE DESTAQUE: só o maior, o menor e o selecionado ganham círculo (borda branca e sombra, no CSS). Os outros
// pontos da linha não se desenham — a curva já os liga.
const pontoDe = (destaques, classe) => ({ cx, cy, index }) => (
  destaques.has(index) && Number.isFinite(cx) && Number.isFinite(cy)
    ? <circle key={`ponto-${index}`} cx={cx} cy={cy} r={6} className={`ponto-destaque ${classe}`} filter="url(#sombra-ponto)" />
    : <g key={`ponto-${index}`} />
);
// O ponto que acompanha o mouse: o mesmo círculo.
const pontoAtivo = (classe) => ({ r: 6, className: `ponto-destaque ${classe}`, filter: 'url(#sombra-ponto)' });

// A ÁREA SOB A LINHA, quase transparente. Fora da dica e da legenda: não é número, é sombra de luz.
const areaSuave = ({ dataKey, serie }) => (
  <Area type="monotone" dataKey={dataKey} stroke="none" fill={`url(#degrade-${serie})`} tooltipType="none" legendType="none"
    dot={false} activeDot={false} isAnimationActive={false} key={`area-${dataKey}`} />
);
// A LINHA: curva suave de 2 px, com a sombra da própria cor.
const linhaSuave = ({ dataKey, serie, classe, destaques, nome, extra, children }) => (
  <Line type="monotone" dataKey={dataKey} name={nome ?? dataKey} className={classe} stroke="currentColor" strokeWidth={2}
    filter={`url(#sombra-${serie})`} dot={pontoDe(destaques, classe)} activeDot={pontoAtivo(classe)}
    isAnimationActive={false} key={`linha-${dataKey}`} {...extra}>
    {children}
  </Line>
);

// ---------------------------------------------------------------- 1. o ano inteiro (gráfico principal)
//
// A PONTA DA LINHA DIZ QUAL LINHA É. Legenda obriga a ir e voltar; o nome no fim da série, não. A skill chama isso
// de "direct labeling", e é a razão de a margem da direita deste gráfico ser tão larga.
// O `desvio` afasta um nome do outro: em dezembro as duas linhas podem estar no mesmo ponto — as duas em zero, por
// exemplo —, e aí os dois nomes sairiam um em cima do outro.
function PontaDaLinha({ x, y, index, ultimo, texto, desvio, classe = 'ponta-da-linha', dx = 9, ancora }) {
  if (index !== ultimo) return null;
  return <text x={x + dx} y={y} dy={desvio} className={classe} textAnchor={ancora}>{texto}</text>;
}

// A linha de referência do mês escolhido nas pílulas, tracejada. Não é número novo: é o mês da tela, desenhado.
const marcaDoMes = (foco, dados, texto) => dados.some((d) => d.rotulo === foco) && (
  <ReferenceLine x={foco} className="marca-do-mes" {...LINHA_DE_REFERENCIA}
    label={{ value: texto, position: 'top', className: 'marca-do-mes-texto' }} />
);

export function AnoInteiro({ meses, mesEmFoco }) {
  const medida = useLargura(760);
  const dados = dadosAnoInteiro(meses);
  const ultimo = dados.length - 1;
  const foco = MESES_CURTOS[mesEmFoco];
  const selecionado = dados.findIndex((d) => d.rotulo === foco);
  const serie = (dataKey, desvio) => linhaSuave({
    dataKey, serie: dataKey, classe: `serie-${dataKey}`,
    destaques: pontosDeDestaque(dados.map((d) => d[dataKey]), selecionado),
    children: <LabelList dataKey={dataKey} content={(p) => <PontaDaLinha {...p} ultimo={ultimo} texto={dataKey} desvio={desvio} />} />,
  });
  return (
    <div className="grafico" ref={medida.ref}>
      <ComposedChart width={medida.largura} height={300} data={dados} margin={{ top: 30, right: 84, left: 8, bottom: 16 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_VALOR} />
        {marcaDoMes(foco, dados, `${foco} — o mês desta tela`)}
        {dica({ formato: FORMATO_REAIS, classes: { receita: 'serie-receita', despesa: 'serie-despesa' } }, CURSOR_LINHA)}
        {areaSuave({ dataKey: 'receita', serie: 'receita' })}
        {areaSuave({ dataKey: 'despesa', serie: 'despesa' })}
        {serie('receita', -2)}
        {serie('despesa', 11)}
      </ComposedChart>
    </div>
  );
}

// ---------------------------------------------------------------- 2. o mês, dia a dia
//
// COLUNAS, E NÃO LINHA (a troca está justificada em `docs/layout.md`): pagamento e recebimento acontecem em dias
// certos, e boa parte dos dias é zero. Uma linha ligaria o dia 3 ao dia 9 como se houvesse fluxo no meio.
export function DiaADia({ dias, mes, ano }) {
  const medida = useLargura(760);
  const dados = dadosDiaADia(dias);
  return (
    <div className="grafico" ref={medida.ref}>
      <BarChart width={medida.largura} height={240} data={dados} margin={{ top: 16, right: 12, left: 8, bottom: 12 }} barGap={2}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} tick={{ fontSize: 10 }} tickMargin={10} />
        <YAxis {...EIXO_VALOR} />
        <ReferenceLine y={0} className="linha-zero" />
        {dica({
          formato: FORMATO_REAIS, titulo: (d) => `dia ${d}/${String(mes).padStart(2, '0')}/${ano}`,
          classes: { receita: 'serie-receita', despesa: 'serie-despesa' },
        }, CURSOR_BARRA)}
        <Bar dataKey="receita" name="receita" className="serie-receita" fill="currentColor" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="despesa" name="despesa" className="serie-despesa" fill="currentColor" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

// ---------------------------------------------------------------- 3 e 4. os dois rankings
//
// BARRA DEITADA, porque o rótulo é um nome comprido — de classificação do DFC ou de cliente — e nome comprido não
// cabe deitado embaixo de uma coluna. O valor vai na ponta da barra, e não num eixo: ler o número é a tarefa aqui.
// Sem régua: o eixo do valor é escondido (o número está na ponta da barra), e uma régua sem escala não diria nada.
const corta = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const GRADE_DEITADA = { ...GRADE, horizontal: false, vertical: true };

function Ranking({ dados, serie, tick }) {
  const medida = useLargura(430);
  const altura = Math.max(130, 32 * dados.length + 20);
  return (
    <div className="grafico" ref={medida.ref}>
      <BarChart width={medida.largura} height={altura} data={dados} layout="vertical"
        margin={{ top: 8, right: 100, left: 4, bottom: 8 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="chave" width={152} {...EIXO_ROTULO} tick={tick} interval={0} />
        {dica({ formato: FORMATO_REAIS, titulo: () => '', classes: { valor: serie } }, CURSOR_BARRA)}
        <Bar dataKey="valor" name="valor" className={serie} fill="currentColor" isAnimationActive={false}
          barSize={14} radius={[0, 7, 7, 0]}>
          <LabelList dataKey="valor" position="right" formatter={emReais} className="rotulo-valor" />
        </Bar>
      </BarChart>
    </div>
  );
}

export function ParaOndeFoiADespesa({ itens }) {
  const dados = dadosRankingDespesa(itens);
  const tick = ({ x, y, payload }) => (
    <text x={x - 6} y={y} dy={4} textAnchor="end" className="rotulo-eixo">{corta(String(payload.value), 22)}</text>
  );
  return <Ranking dados={dados} serie="serie-despesa" tick={tick} />;
}

export function DeQuemVeioAReceita({ itens }) {
  // A CHAVE DO EIXO É A POSIÇÃO, e não o nome: dois clientes podem ter o mesmo nome, e o eixo precisa de uma chave
  // única. O nome e o código saem daqui, do `tick`, que é onde a marca `class="cliente" data-codigo` é escrita.
  const dados = dadosRankingReceita(itens);
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return (
      <text x={x - 6} y={y} dy={4} textAnchor="end" className="cliente rotulo-eixo" data-codigo={i.codigo}>
        {corta(String(i.nome ?? ''), 22)}
      </text>
    );
  };
  return <Ranking dados={dados} serie="serie-receita" tick={tick} />;
}

// ================================================================ TELA 2 — DRE
//
// Os dois gráficos desta tela desenham números que a tela JÁ MOSTRAVA: a margem de cada mês é a mesma série que a
// fita do cartão "Margem de lucro" desenha desde sempre, e o peso de cada linha sobre a receita líquida é a coluna
// AV da tabela. Nenhum número novo nasce aqui — `lib/indicadores/tela-2.mjs` não foi tocado.

// O eixo de percentual. Ele existe porque `EIXO_VALOR` escreve dinheiro, e margem e AV são razão, não dinheiro.
const EIXO_PORCENTO = {
  tickFormatter: emPorcento, tickLine: false, axisLine: false, width: 64, tickMargin: 12,
  className: 'eixo', tick: { fontSize: 12 },
};

// ---------------------------------------------------------------- 5. a margem, mês a mês (principal da Tela 2)
//
// UMA SÉRIE SÓ, ORDENADA NO TEMPO, é LINHA (o caminho na árvore da skill está em `docs/layout.md`). A linha do zero é
// a única referência que não inventa número: abaixo dela o mês deu prejuízo. A tracejada no mês em foco é a mesma da
// Tela 1, e pelo mesmo motivo — põe o mês escolhido dentro do ano sem precisar de um segundo gráfico.
export function MargemNoAno({ serie, mesEmFoco }) {
  const medida = useLargura(760);
  const dados = dadosMargem(serie);
  const ultimo = dados.length - 1;
  const foco = MESES_CURTOS[mesEmFoco];
  const selecionado = dados.findIndex((d) => d.rotulo === foco);
  return (
    <div className="grafico" ref={medida.ref}>
      <ComposedChart width={medida.largura} height={300} data={dados} margin={{ top: 30, right: 84, left: 8, bottom: 16 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_PORCENTO} />
        <ReferenceLine y={0} className="linha-zero" />
        {marcaDoMes(foco, dados, `${foco} — o mês dos cartões`)}
        {dica({ formato: FORMATO_PORCENTO, classes: { margem: 'serie-margem' } }, CURSOR_LINHA)}
        {areaSuave({ dataKey: 'margem', serie: 'margem' })}
        {linhaSuave({
          dataKey: 'margem', serie: 'margem', classe: 'serie-margem',
          destaques: pontosDeDestaque(dados.map((d) => d.margem), selecionado),
          children: <LabelList dataKey="margem" content={(p) => <PontaDaLinha {...p} ultimo={ultimo} texto="margem" desvio={-2} />} />,
        })}
      </ComposedChart>
    </div>
  );
}

// ---------------------------------------------------------------- 6. o peso de cada linha sobre a receita (AV)
//
// BARRA DEITADA a partir do zero, que é a leitura mais direta de uma proporção. A ORDEM É A DO DRE, e não a do
// tamanho: aqui a cascata é o sentido — "(+) Receitas" vem antes de "(−) Deduções" porque uma se subtrai da outra —,
// e ordenar por tamanho, como se faz num ranking, desmontaria a conta. O valor vai na ponta, como nos rankings da
// Tela 1: ler o número é a tarefa.
export function PesoNaReceita({ linhas }) {
  const medida = useLargura(430);
  const dados = dadosPesoNaReceita(linhas);
  const altura = Math.max(130, 28 * dados.length + 20);
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return <text x={x - 6} y={y} dy={4} textAnchor="end" className="rotulo-eixo">{corta(String(i.rotulo ?? ''), 26)}</text>;
  };
  return (
    <div className="grafico" ref={medida.ref}>
      <BarChart width={medida.largura} height={altura} data={dados} layout="vertical"
        margin={{ top: 8, right: 82, left: 4, bottom: 8 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="chave" width={162} {...EIXO_ROTULO} tick={tick} interval={0} />
        <ReferenceLine x={0} className="linha-zero" />
        {dica({
          formato: (v) => [emPorcento(v), 'da receita líquida'], titulo: () => '',
          classes: { valor: 'serie-margem' },
        }, CURSOR_BARRA)}
        <Bar dataKey="valor" name="da receita líquida" className="serie-margem" fill="currentColor"
          isAnimationActive={false} barSize={13} radius={[0, 7, 7, 0]}>
          <LabelList dataKey="valor" position="right" formatter={emPorcento} className="rotulo-valor" />
        </Bar>
      </BarChart>
    </div>
  );
}

// ================================================================ TELA 3 — CONTAS A RECEBER
//
// As três faixas — pago, atrasado, em aberto — são as de `lib/regras/listas.mjs` (de-para do dono, 25/09/2026), e a
// cor de cada uma é a MESMA da rosca, da legenda e do selo da lista: `.serie-pago`, `.serie-atrasado` e
// `.serie-aberto` em `app/globals.css`. Mesma cor, mesma coisa, nos três desenhos da tela.
const CLASSES_DAS_FAIXAS = Object.fromEntries(FAIXAS_DA_TELA_3.map((f) => [f.chave, `serie-${f.chave}`]));

// ---------------------------------------------------------------- 7. de quem é o vencido (principal da Tela 3)
//
// CATEGÓRICO COM SUBGRUPO (cliente e status) é BARRA EMPILHADA. Empilhada, e não agrupada, porque a soma das três
// faixas é o total daquele cliente, e é essa soma que ordena a lista de quem ligar.
//
// O VALOR VAI NO EIXO, e não na ponta da barra como nos rankings da Tela 1: numa pilha de três, um número na ponta
// se confunde com o último pedaço dela. Este é o único gráfico das três telas em que o eixo de dinheiro aparece numa
// barra deitada.
//
// E O NOME DO CLIENTE sai num `text` com `class="cliente"` e `data-codigo`, a mesma marca da Tela 1, para
// `scripts/capturar-tela.mjs` trocar o nome pelo código antes de a captura entrar no repositório.
export function PorClienteEStatus({ clientes }) {
  const medida = useLargura(760);
  const dados = dadosPorCliente(clientes);
  const altura = Math.max(130, 32 * dados.length + 36);
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return (
      <text x={x - 6} y={y} dy={4} textAnchor="end" className="cliente rotulo-eixo" data-codigo={i.codigo}>
        {corta(String(i.nome ?? ''), 22)}
      </text>
    );
  };
  return (
    <div className="grafico" ref={medida.ref}>
      <BarChart width={medida.largura} height={altura} data={dados} layout="vertical"
        margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE_DEITADA} />
        <XAxis type="number" {...EIXO_VALOR} height={26} />
        <YAxis type="category" dataKey="chave" width={152} {...EIXO_ROTULO} tick={tick} interval={0} />
        {dica({ formato: FORMATO_REAIS, titulo: () => '', classes: CLASSES_DAS_FAIXAS }, CURSOR_BARRA)}
        {FAIXAS_DA_TELA_3.map((f, n) => (
          <Bar dataKey={f.chave} name={f.nome} stackId="cliente" className={`serie-${f.chave}`} fill="currentColor"
            isAnimationActive={false} barSize={16} key={f.chave}
            radius={n === FAIXAS_DA_TELA_3.length - 1 ? [0, 6, 6, 0] : 0} />
        ))}
      </BarChart>
    </div>
  );
}

// ---------------------------------------------------------------- 8. o que vence quando
//
// COLUNAS EMPILHADAS, uma por mês do ano. A troca da multi-linha por coluna é a mesma da Tela 1 e pelo mesmo motivo
// (`docs/layout.md`): vencimento é evento de um mês, não fluxo contínuo — uma linha ligaria agosto a outubro como se
// houvesse alguma coisa em setembro. Empilhado porque a soma das três faixas é o total do mês.
//
// O EIXO É CONTAGEM DE TÍTULOS, e não dinheiro: é o que este bloco sempre mostrou ("Qtde Lançamentos"), e é a
// contagem que `docs/conferencia.md` confere.
export function PorMesEStatus({ porMes, mesEmFoco }) {
  const medida = useLargura(760);
  const dados = dadosPorMes(porMes);
  const foco = MESES_CURTOS[mesEmFoco];
  const ultima = FAIXAS_DA_TELA_3.length - 1;
  return (
    <div className="grafico" ref={medida.ref}>
      <BarChart width={medida.largura} height={250} data={dados} margin={{ top: 30, right: 12, left: 8, bottom: 12 }}>
        {ESTILO}
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_ROTULO} width={40} allowDecimals={false} />
        {marcaDoMes(foco, dados, `${foco} — a janela desta tela`)}
        {dica({
          formato: (v, n) => [`${v} ${v === 1 ? 'título' : 'títulos'}`, n], classes: CLASSES_DAS_FAIXAS,
        }, CURSOR_BARRA)}
        {FAIXAS_DA_TELA_3.map((f, n) => (
          <Bar dataKey={f.chave} name={f.nome} stackId="mes" className={`serie-${f.chave}`} fill="currentColor"
            isAnimationActive={false} key={f.chave} radius={n === ultima ? [5, 5, 0, 0] : 0}>
            {/* O total do mês, em cima da pilha: é o número que a coluna já trazia antes desta reforma. Ele vai na
                ÚLTIMA faixa da pilha, que é o topo dela. */}
            {n === ultima && <LabelList dataKey="total" position="top" className="rotulo-valor"
              formatter={(v) => (v || '')} />}
          </Bar>
        ))}
      </BarChart>
    </div>
  );
}

// ================================================================ TELA 3 — FLUXO DE CAIXA
//
// O MÊS DIA A DIA: o que já foi (consolidado) e o que ainda vem (previsão), num gráfico só. Entrada para cima e saída
// para baixo, cada dia uma coluna; a parte prevista é a mesma cor, mais clara (`.previsao`). A linha é o acumulado do
// mês — consolidado até hoje, e daí em diante somando a previsão. A marca tracejada é hoje. Nenhum número nasce aqui:
// cada dia chega pronto de `lib/indicadores/fluxo-de-caixa.mjs`.
//
// PARA FUNCIONAR IMPRESSO EM CINZA (29/09/2026): a cor sozinha não separa a linha das colunas — `--marca` contra
// `--marca-escura` dá 1,75 para 1. Então a linha leva um CONTORNO da cor do fundo (`.contorno-da-posicao`, uma segunda
// linha por baixo dela) e o NOME NA PONTA, e a previsão leva um contorno tracejado (`.serie-previsao`, em
// `app/globals.css`). As duas coisas são forma, e forma sobrevive ao cinza. No estilo novo (08/10/2026) o contorno e o
// nome ficam como estavam: a curva só passou de reta a suave, a mesma nas duas camadas.
//
// A COLUNA ARREDONDADA só na ponta de fora da pilha do dia: a entrada que ainda tem previsão em cima não arredonda o
// topo, para as duas peças da pilha não se desencontrarem. Positiva arredonda em cima, negativa embaixo.
function colunaDoDia(acima) {
  return (p) => {
    const coberta = acima && p.payload?.[acima];
    return <Rectangle {...p} radius={coberta ? 0 : (p.height < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0])} />;
  };
}

export function DiaADiaDoFluxo({ dias, hoje }) {
  const medida = useLargura(1100);
  const dados = dadosFluxo(dias, hoje);
  // ONDE O NOME DA LINHA VAI (rotulagem direta): na ponta de cada uma. A consolidada termina em "hoje", e aí o nome sai
  // para a esquerda e para cima, para não cair em cima da parte prevista.
  const ultimoCom = (k) => dados.reduce((u, x, i) => (x[k] !== null ? i : u), -1);
  const fimDaPosicao = ultimoCom('posicao');
  const fimDaPrevista = ultimoCom('posicaoPrevista');
  const posicaoVaiAteOFim = fimDaPosicao === dados.length - 1;
  // Os pontos de destaque: o maior e o menor da posição de caixa (consolidada e prevista juntas, que é a curva que o
  // dono lê) e hoje. Cada ponto é desenhado na linha a que pertence.
  const selecionado = hoje ? dados.findIndex((d) => d.rotulo === String(hoje)) : -1;
  const curva = dados.map((d) => (d.posicao ?? d.posicaoPrevista));
  const destaques = pontosDeDestaque(curva);
  const daPosicao = new Set([...destaques].filter((i) => dados[i].posicao !== null));
  if (selecionado >= 0 && dados[selecionado].posicao !== null) daPosicao.add(selecionado);
  const daPrevista = new Set([...destaques].filter((i) => dados[i].posicao === null));
  // A saída é desenhada para baixo (negativa), mas na dica ela é dita positiva, como no cartão "Saiu". A POSIÇÃO DE
  // CAIXA, não: ela vai com o sinal que tem — um caixa negativo é dito negativo (correção de 28/09/2026: a primeira
  // versão tirava o sinal de tudo, e uma posição negativa aparecia positiva).
  // Os nomes do quadro, em português e com acento; as duas de previsão só aparecem nos dias futuros.
  const formato = (v, n, p) => [emReais(p.dataKey === 'posicao' || p.dataKey === 'posicaoPrevista' ? v : Math.abs(v)), n];
  // No dia de hoje as duas posições existem, e valem o mesmo: fica só a de caixa. A prevista é só dos dias futuros.
  const omitir = (p, todas) => p.dataKey === 'posicaoPrevista' && todas.some((x) => x.dataKey === 'posicao');
  const classes = {
    entrou: 'serie-receita', aReceber: 'serie-previsao', saiu: 'serie-despesa', aPagar: 'serie-previsao',
    posicao: 'serie-saldo', posicaoPrevista: 'serie-previsao-linha',
  };
  return (
    <div className="grafico" ref={medida.ref}>
      <ComposedChart width={medida.largura} height={340} data={dados} margin={{ top: 30, right: 108, left: 8, bottom: 16 }}
        stackOffset="sign" barCategoryGap={2}>
        {/* A PREVISÃO EM DEGRADÊ CINZA (pedido do dono, 28/09/2026): o que ainda não aconteceu não usa as cores de
            entrou e saiu. Mais escuro perto do zero, mais claro na ponta — o degradê é por barra, e não por valor. */}
        {ESTILO}
        <defs>
          <linearGradient id="previsao-entrada" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" className="previsao-escuro" />
            <stop offset="100%" className="previsao-claro" />
          </linearGradient>
          <linearGradient id="previsao-saida" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="previsao-escuro" />
            <stop offset="100%" className="previsao-claro" />
          </linearGradient>
        </defs>
        {FUNDO_PONTILHADO}
        <CartesianGrid {...GRADE} />
        {/* Num período de vários meses são mais de cem dias: o eixo escreve o mês no dia 1 e o dia de cinco em cinco. */}
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} tick={{ fontSize: 11 }}
          tickFormatter={dados.length > 31 ? (v) => {
            const [dd, mm] = String(v).split('/');
            return dd === '1' ? MESES_CURTOS[Number(mm)] : Number(dd) % 5 === 0 ? dd : '';
          } : undefined} />
        {/* UM EIXO SÓ, para colunas e linha (correção de 28/09/2026). Com dois, o zero de um ficava noutra altura que o
            do outro, e o dono leu uma posição positiva, desenhada no eixo da direita, como negativa no da
            esquerda. Com o caixa partindo da abertura dos bancos, linha e colunas são da mesma ordem de grandeza. */}
        <YAxis yAxisId="dia" {...EIXO_VALOR} />
        <ReferenceLine yAxisId="dia" y={0} className="linha-zero" />
        {hoje && (
          <ReferenceLine yAxisId="dia" x={String(hoje)} className="marca-do-mes" {...LINHA_DE_REFERENCIA}
            label={{ value: 'hoje', position: 'top', className: 'marca-do-mes-texto' }} />
        )}
        {dica({ formato, titulo: (d) => `dia ${d}`, classes, omitir }, CURSOR_LINHA)}
        <Area yAxisId="dia" type="monotone" dataKey="posicao" stroke="none" fill="url(#degrade-saldo)" tooltipType="none"
          legendType="none" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
        <Area yAxisId="dia" type="monotone" dataKey="posicaoPrevista" stroke="none" fill="url(#degrade-previsao)" tooltipType="none"
          legendType="none" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />
        <Bar yAxisId="dia" dataKey="entrou" name="Entrou" stackId="dia" className="serie-receita" fill="currentColor"
          shape={colunaDoDia('aReceber')} isAnimationActive={false} />
        <Bar yAxisId="dia" dataKey="aReceber" name="A receber (previsão)" stackId="dia" className="serie-previsao"
          fill="url(#previsao-entrada)" shape={colunaDoDia(null)} isAnimationActive={false} />
        <Bar yAxisId="dia" dataKey="saiu" name="Saiu" stackId="dia" className="serie-despesa" fill="currentColor"
          shape={colunaDoDia('aPagar')} isAnimationActive={false} />
        <Bar yAxisId="dia" dataKey="aPagar" name="A pagar (previsão)" stackId="dia" className="serie-previsao"
          fill="url(#previsao-saida)" shape={colunaDoDia(null)} isAnimationActive={false} />
        {/* O CONTORNO: a mesma linha, mais grossa e na cor do fundo, por baixo. Fora da dica e da legenda. */}
        <Line yAxisId="dia" type="monotone" dataKey="posicao" className="contorno-da-posicao" stroke="currentColor"
          strokeWidth={5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none" tooltipType="none" />
        <Line yAxisId="dia" type="monotone" dataKey="posicaoPrevista" className="contorno-da-posicao" stroke="currentColor"
          strokeWidth={5} dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none" tooltipType="none" />
        <Line yAxisId="dia" type="monotone" dataKey="posicao" name="Posição de caixa" className="serie-saldo" stroke="currentColor"
          strokeWidth={2} filter="url(#sombra-saldo)" dot={pontoDe(daPosicao, 'serie-saldo')} activeDot={pontoAtivo('serie-saldo')}
          isAnimationActive={false} connectNulls={false}>
          <LabelList dataKey="posicao" content={(p) => (posicaoVaiAteOFim
            ? <PontaDaLinha {...p} ultimo={fimDaPosicao} texto="posição de caixa" desvio={4} classe="rotulo-da-linha" />
            : <PontaDaLinha {...p} ultimo={fimDaPosicao} texto="posição de caixa" desvio={-9} dx={-6} ancora="end" classe="rotulo-da-linha" />)} />
        </Line>
        <Line yAxisId="dia" type="monotone" dataKey="posicaoPrevista" name="Posição de caixa (prevista)" className="serie-previsao-linha"
          stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" dot={pontoDe(daPrevista, 'serie-previsao-linha')}
          activeDot={pontoAtivo('serie-previsao-linha')} isAnimationActive={false} connectNulls={false}>
          <LabelList dataKey="posicaoPrevista" content={(p) => (
            <PontaDaLinha {...p} ultimo={fimDaPrevista} texto="posição prevista" desvio={4} classe="rotulo-da-linha" />)} />
        </Line>
      </ComposedChart>
    </div>
  );
}
