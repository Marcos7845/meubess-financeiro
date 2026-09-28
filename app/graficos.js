'use client';
// OS GRÁFICOS DAS TRÊS TELAS, DESENHADOS COM RECHARTS.
//
// DE ONDE VEM O DESENHO. Da skill de visualização de dados que o dono mandou em 28/09/2026, guardada em
// `.claude/skills/visualizacao-de-dados/SKILL.md`; o plano de qual gráfico responde qual pergunta, e por quê, está
// em `docs/layout.md`. Aqui não se decide nada: chega o número já calculado por `lib/indicadores/` e sai o desenho.
//
// ATÉ 28/09/2026 SÓ A TELA 1 DESENHAVA AQUI. As Telas 2 e 3 foram refeitas no mesmo padrão na mesma data, e os
// gráficos delas entraram neste arquivo em vez de num arquivo por tela: as três amarras abaixo, o eixo de dinheiro, a
// grade e a dica são os mesmos para as três, e o que prende o desenho ao que a captura sabe apagar não pode viver em
// três cópias. Nenhum número novo entrou com elas — cada gráfico desenha um número que a tela já mostrava.
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
//      largura do painel.
//   3. NENHUMA COR AQUI. As cores da marca moram todas em `app/globals.css` — é o que o cabeçalho daquele arquivo
//      manda. Cada série recebe uma `className` e pinta com `currentColor`, e é o CSS que diz qual é essa cor.
//
// E O NOME DO CLIENTE. No eixo do "De quem veio a receita" ele sai num `<text class="cliente" data-codigo="…">`, a
// mesma marca que o resto do projeto usa, para `scripts/capturar-tela.mjs` trocar o nome pelo código antes de a
// captura entrar no repositório.

import {
  Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from 'recharts';
import { emPorcento, emReais } from './dinheiro.js';

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O eixo de valor é sempre dinheiro, e sempre com a letra de `app/dinheiro.js` — é ela que a captura sabe apagar.
const EIXO_VALOR = {
  tickFormatter: emReais, tickLine: false, axisLine: false, width: 92,
  className: 'eixo', tick: { fontSize: 10.5 },
};
const EIXO_ROTULO = { tickLine: false, axisLine: false, className: 'eixo', tick: { fontSize: 10.5 } };
// A grade é só horizontal e clara: linha vertical não ajuda a ler valor nenhum destes gráficos.
const GRADE = { vertical: false, className: 'grade-grafico', strokeDasharray: '0' };
const DICA = {
  formatter: (v, n) => [emReais(v), n], separator: ': ', isAnimationActive: false,
  wrapperClassName: 'dica-grafico',
};

// ---------------------------------------------------------------- 1. o ano inteiro (gráfico principal)
//
// A PONTA DA LINHA DIZ QUAL LINHA É. Legenda obriga a ir e voltar; o nome no fim da série, não. A skill chama isso
// de "direct labeling", e é a razão de a margem da direita deste gráfico ser tão larga.
// O `desvio` afasta um nome do outro: em dezembro as duas linhas podem estar no mesmo ponto — as duas em zero, por
// exemplo —, e aí os dois nomes sairiam um em cima do outro.
function PontaDaLinha({ x, y, index, ultimo, texto, desvio }) {
  if (index !== ultimo) return null;
  return <text x={x + 9} y={y} dy={desvio} className="ponta-da-linha">{texto}</text>;
}

export function AnoInteiro({ meses, mesEmFoco }) {
  const dados = meses.map((m) => ({ rotulo: MESES_CURTOS[m.mes], receita: m.entradas, despesa: m.gastos }));
  const ultimo = dados.length - 1;
  const foco = MESES_CURTOS[mesEmFoco];
  return (
    <div className="grafico">
      <LineChart width={760} height={286} data={dados} margin={{ top: 22, right: 74, left: 0, bottom: 4 }}>
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_VALOR} />
        {/* A ÚNICA LINHA DE REFERÊNCIA DESTE GRÁFICO: onde cai o mês que a tela está mostrando. Ela não é número
            novo — é o mês escolhido nas pílulas lá em cima, desenhado. */}
        {dados.some((d) => d.rotulo === foco) && (
          <ReferenceLine x={foco} className="marca-do-mes"
            label={{ value: `${foco} — o mês desta tela`, position: 'top', className: 'marca-do-mes-texto' }} />
        )}
        <Tooltip {...DICA} />
        <Line type="monotone" dataKey="receita" name="receita" className="serie-receita" stroke="currentColor"
          strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'currentColor' }} isAnimationActive={false}>
          <LabelList dataKey="receita" content={(p) => <PontaDaLinha {...p} ultimo={ultimo} texto="receita" desvio={-2} />} />
        </Line>
        <Line type="monotone" dataKey="despesa" name="despesa" className="serie-despesa" stroke="currentColor"
          strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'currentColor' }} isAnimationActive={false}>
          <LabelList dataKey="despesa" content={(p) => <PontaDaLinha {...p} ultimo={ultimo} texto="despesa" desvio={11} />} />
        </Line>
      </LineChart>
    </div>
  );
}

// ---------------------------------------------------------------- 2. o mês, dia a dia
//
// COLUNAS, E NÃO LINHA (a troca está justificada em `docs/layout.md`): pagamento e recebimento acontecem em dias
// certos, e boa parte dos dias é zero. Uma linha ligaria o dia 3 ao dia 9 como se houvesse fluxo no meio.
export function DiaADia({ dias, mes, ano }) {
  const dados = dias.map((d) => ({ rotulo: String(d.dia), receita: d.entradas, despesa: d.gastos }));
  return (
    <div className="grafico">
      <BarChart width={760} height={220} data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={1}>
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} tick={{ fontSize: 8.5 }} />
        <YAxis {...EIXO_VALOR} />
        <ReferenceLine y={0} className="linha-zero" />
        <Tooltip {...DICA} labelFormatter={(d) => `dia ${d}/${String(mes).padStart(2, '0')}/${ano}`} />
        <Bar dataKey="receita" name="receita" className="serie-receita" fill="currentColor" isAnimationActive={false} />
        <Bar dataKey="despesa" name="despesa" className="serie-despesa" fill="currentColor" isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

// ---------------------------------------------------------------- 3 e 4. os dois rankings
//
// BARRA DEITADA, porque o rótulo é um nome comprido — de classificação do DFC ou de cliente — e nome comprido não
// cabe deitado embaixo de uma coluna. O valor vai na ponta da barra, e não num eixo: ler o número é a tarefa aqui.
const corta = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Ranking({ dados, serie, tick }) {
  const altura = Math.max(120, 30 * dados.length + 16);
  return (
    <div className="grafico">
      <BarChart width={430} height={altura} data={dados} layout="vertical"
        margin={{ top: 4, right: 96, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="chave" width={148} {...EIXO_ROTULO} tick={tick} interval={0} />
        <Tooltip {...DICA} labelFormatter={() => ''} />
        <Bar dataKey="valor" name="valor" className={serie} fill="currentColor" isAnimationActive={false}
          barSize={14} radius={[0, 2, 2, 0]}>
          <LabelList dataKey="valor" position="right" formatter={emReais} className="rotulo-valor" />
        </Bar>
      </BarChart>
    </div>
  );
}

export function ParaOndeFoiADespesa({ itens }) {
  const dados = itens.map((i) => ({ chave: i.nome, valor: i.valor }));
  const tick = ({ x, y, payload }) => (
    <text x={x - 6} y={y} dy={3.5} textAnchor="end" className="rotulo-eixo">{corta(String(payload.value), 22)}</text>
  );
  return <Ranking dados={dados} serie="serie-despesa" tick={tick} />;
}

export function DeQuemVeioAReceita({ itens }) {
  // A CHAVE DO EIXO É A POSIÇÃO, e não o nome: dois clientes podem ter o mesmo nome, e o eixo precisa de uma chave
  // única. O nome e o código saem daqui, do `tick`, que é onde a marca `class="cliente" data-codigo` é escrita.
  const dados = itens.map((i, n) => ({
    chave: String(n), valor: i.valor,
    nome: i.cliente.nome ?? `cliente ${i.cliente.codigo}`, codigo: i.cliente.codigo,
  }));
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return (
      <text x={x - 6} y={y} dy={3.5} textAnchor="end" className="cliente rotulo-eixo" data-codigo={i.codigo}>
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
  tickFormatter: emPorcento, tickLine: false, axisLine: false, width: 56,
  className: 'eixo', tick: { fontSize: 10.5 },
};

// ---------------------------------------------------------------- 5. a margem, mês a mês (principal da Tela 2)
//
// UMA SÉRIE SÓ, ORDENADA NO TEMPO, é LINHA (o caminho na árvore da skill está em `docs/layout.md`). A linha do zero é
// a única referência que não inventa número: abaixo dela o mês deu prejuízo. A tracejada no mês em foco é a mesma da
// Tela 1, e pelo mesmo motivo — põe o mês escolhido dentro do ano sem precisar de um segundo gráfico.
export function MargemNoAno({ serie, mesEmFoco }) {
  const dados = serie.map((x) => ({ rotulo: MESES_CURTOS[x.mes], margem: x.valor }));
  const ultimo = dados.length - 1;
  const foco = MESES_CURTOS[mesEmFoco];
  return (
    <div className="grafico">
      <LineChart width={760} height={286} data={dados} margin={{ top: 22, right: 74, left: 0, bottom: 4 }}>
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_PORCENTO} />
        <ReferenceLine y={0} className="linha-zero" />
        {dados.some((d) => d.rotulo === foco) && (
          <ReferenceLine x={foco} className="marca-do-mes"
            label={{ value: `${foco} — o mês dos cartões`, position: 'top', className: 'marca-do-mes-texto' }} />
        )}
        <Tooltip {...DICA} formatter={(v, n) => [emPorcento(v), n]} />
        <Line type="monotone" dataKey="margem" name="margem" className="serie-margem" stroke="currentColor"
          strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: 'currentColor' }} isAnimationActive={false}>
          <LabelList dataKey="margem" content={(p) => <PontaDaLinha {...p} ultimo={ultimo} texto="margem" desvio={-2} />} />
        </Line>
      </LineChart>
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
  const dados = linhas.map((l, n) => ({ chave: String(n), rotulo: l.rotulo, valor: l.av }));
  const altura = Math.max(120, 26 * dados.length + 16);
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return <text x={x - 6} y={y} dy={3.5} textAnchor="end" className="rotulo-eixo">{corta(String(i.rotulo ?? ''), 26)}</text>;
  };
  return (
    <div className="grafico">
      <BarChart width={430} height={altura} data={dados} layout="vertical"
        margin={{ top: 4, right: 78, left: 0, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="chave" width={158} {...EIXO_ROTULO} tick={tick} interval={0} />
        <ReferenceLine x={0} className="linha-zero" />
        <Tooltip {...DICA} formatter={(v) => [emPorcento(v), 'da receita líquida']} labelFormatter={() => ''} />
        <Bar dataKey="valor" name="da receita líquida" className="serie-margem" fill="currentColor"
          isAnimationActive={false} barSize={13} radius={[0, 2, 2, 0]}>
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
const FAIXAS_DA_TELA_3 = [
  { chave: 'pago', nome: 'pago' },
  { chave: 'atrasado', nome: 'atrasado' },
  { chave: 'aberto', nome: 'em aberto' },
];

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
  const dados = clientes.map((c, n) => ({
    chave: String(n), nome: c.nome ?? `cliente ${c.codigo}`, codigo: c.codigo,
    ...Object.fromEntries(FAIXAS_DA_TELA_3.map((f) => [f.chave, c[f.chave]])),
  }));
  const altura = Math.max(120, 30 * dados.length + 26);
  const tick = ({ x, y, payload }) => {
    const i = dados[Number(payload.value)] ?? {};
    return (
      <text x={x - 6} y={y} dy={3.5} textAnchor="end" className="cliente rotulo-eixo" data-codigo={i.codigo}>
        {corta(String(i.nome ?? ''), 22)}
      </text>
    );
  };
  return (
    <div className="grafico">
      <BarChart width={760} height={altura} data={dados} layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid {...GRADE} horizontal={false} vertical />
        <XAxis type="number" {...EIXO_VALOR} height={22} />
        <YAxis type="category" dataKey="chave" width={148} {...EIXO_ROTULO} tick={tick} interval={0} />
        <Tooltip {...DICA} labelFormatter={() => ''} />
        {FAIXAS_DA_TELA_3.map((f, n) => (
          <Bar dataKey={f.chave} name={f.nome} stackId="cliente" className={`serie-${f.chave}`} fill="currentColor"
            isAnimationActive={false} barSize={15} key={f.chave}
            radius={n === FAIXAS_DA_TELA_3.length - 1 ? [0, 2, 2, 0] : 0} />
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
  const dados = porMes.map((x) => ({
    rotulo: MESES_CURTOS[x.mes], total: x.total,
    ...Object.fromEntries(FAIXAS_DA_TELA_3.map((f) => [f.chave, x[f.chave]])),
  }));
  const foco = MESES_CURTOS[mesEmFoco];
  const ultima = FAIXAS_DA_TELA_3.length - 1;
  return (
    <div className="grafico">
      <BarChart width={760} height={230} data={dados} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid {...GRADE} />
        <XAxis dataKey="rotulo" {...EIXO_ROTULO} interval={0} />
        <YAxis {...EIXO_ROTULO} width={34} allowDecimals={false} />
        {dados.some((d) => d.rotulo === foco) && (
          <ReferenceLine x={foco} className="marca-do-mes"
            label={{ value: `${foco} — a janela desta tela`, position: 'top', className: 'marca-do-mes-texto' }} />
        )}
        <Tooltip {...DICA} formatter={(v, n) => [`${v} ${v === 1 ? 'título' : 'títulos'}`, n]} />
        {FAIXAS_DA_TELA_3.map((f, n) => (
          <Bar dataKey={f.chave} name={f.nome} stackId="mes" className={`serie-${f.chave}`} fill="currentColor"
            isAnimationActive={false} key={f.chave}>
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
