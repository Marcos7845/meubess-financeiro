// CONFERE AS TELAS CONTRA `docs/conferencia.md` e grava `docs/telas-conferidas.md`.
//
// O QUE ESTE TESTE FAZ. Monta as telas já construídas pela camada de dados do app — a mesma que o navegador recebe,
// com os mesmos filtros de `lib/regras/` — e compara, indicador por indicador, a CONTAGEM que elas usaram com a
// contagem que `docs/conferencia.md` publica. Se o filtro de uma tela sair do que `docs/fontes.md` manda, a contagem
// muda e a linha sai "divergente:".
//
// POR QUE A CONTAGEM, E NÃO O VALOR. `docs/conferencia.md` não traz valor em dinheiro, de propósito, e este arquivo
// também não pode trazer. A contagem prende o filtro: dois filtros diferentes quase nunca pegam o mesmo número de
// lançamentos. O valor aparece só na tela, lido na hora.
//
// O LADO DE LÁ É O ARQUIVO, NÃO O CÓDIGO. Os números esperados são LIDOS do texto de `docs/conferencia.md`, que
// `scripts/numeros-das-telas.mjs` gerou antes. Se os dois lados saíssem da mesma função, o teste não provaria nada.
//
//   node scripts/conferir-telas.mjs                 # agosto de 2026
//   node scripts/conferir-telas.mjs --mes 7 --ano 2026

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularTela3 } from '../lib/indicadores/tela-3.mjs';
import { calcularFluxoDeCaixa } from '../lib/indicadores/fluxo-de-caixa.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFERENCIA = path.join(RAIZ, 'docs', 'conferencia.md');
const SAIDA = path.join(RAIZ, 'docs', 'telas-conferidas.md');

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));

// ================================================================ o lado da conferência
//
// Um extrator por indicador, escrito à mão contra o texto que `numeros-das-telas.mjs` produz. `dfc` e `omie` acham,
// cada um, o número daquele lado dentro do trecho "**Entram:** …" da linha.
//
// `extras` é o resto da frase: quando a conferência publica a linha REPARTIDA — quanto veio de venda de produtos e
// quanto de outras receitas, quantos títulos e quantos avulsos, quanto em cada empresa —, cada pedaço vira uma
// comparação a mais. Um total pode bater por acaso com a repartição errada; os extras fecham essa porta.

const num = (s) => Number(String(s).replace(/\./g, ''));

const EXTRATORES = {
  saldo: { dfc: /^([\d.]+) linhas de lançamento baixado/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  receitas: { dfc: /^([\d.]+) linhas de entrada no mês/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  despesas: { dfc: /^([\d.]+) linhas de saída no mês, do lado do DFC/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  'despesas-pagas': { dfc: /^([\d.]+) linhas de saída com/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  'despesas-pendentes': { dfc: null, omie: /^([\d.]+) títulos a pagar em aberto/ },
  'despesas-funcionarios': { dfc: /^([\d.]+) linhas de saída de pessoal/, omie: /; ([\d.]+) lançamentos pagos nas categorias de pessoal/ },
  'percentual-funcionarios': { dfc: /^([\d.]+) linhas de pessoal no mês/, omie: /os ([\d.]+) lançamentos de receita do mês/ },
  'top-10-despesas': { dfc: /^([\d.]+) linhas de saída no mês, em/, omie: /; ([\d.]+) lançamentos de despesa do mês/ },
  'top-10-receitas': { dfc: null, omie: /^([\d.]+) lançamentos de receita/ },
  'receita-despesa-por-dia': { dfc: /^([\d.]+) colunas de dia/, omie: /; ([\d.]+) lançamentos no mês/ },
  'receita-despesa-por-mes': { dfc: /^([\d.]+) dos \d+ meses/, omie: /; ([\d.]+) lançamentos na coluna do mês/ },

  // ---------------------------------------------------------------- Tela 2
  'receita-total': { dfc: /^([\d.]+) linhas de entrada no mês com/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  'custos-e-despesas': { dfc: /^([\d.]+) linhas de saída no mês, agrupáveis/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  // Os três cartões calculados trazem a mesma frase: o total do mês e, entre parênteses, quanto é receita e quanto
  // é despesa. Os dois de dentro dos parênteses são os extras.
  'cartao-ebitda': {
    dfc: null, omie: /^([\d.]+) lançamentos do mês, que passam/,
    extras: { receita: /\(([\d.]+) de receita e/, despesa: /de receita e ([\d.]+) de despesa\)/ },
  },
  'cartao-lucro-liquido': {
    dfc: null, omie: /^([\d.]+) lançamentos do mês, que passam/,
    extras: { receita: /\(([\d.]+) de receita e/, despesa: /de receita e ([\d.]+) de despesa\)/ },
  },
  'cartao-margem': {
    dfc: null, omie: /^([\d.]+) lançamentos do mês, que passam/,
    extras: { receita: /\(([\d.]+) de receita e/, despesa: /de receita e ([\d.]+) de despesa\)/ },
  },
  'dre-receitas': {
    dfc: null, omie: /^([\d.]+) lançamentos —/,
    extras: { venda: /— ([\d.]+) em vendas de produtos/, outras: /e ([\d.]+) em outras receitas/ },
  },
  'dre-receita-bruta': {
    dfc: null, omie: /^([\d.]+) lançamentos — os mesmos/,
    extras: { contasDoDre: /tem ([\d.]+) contas em cada empresa/, totalizadoras: /([\d.]+) delas com `totalizaDRE/ },
  },
  'dre-deducoes': {
    dfc: /^([\d.]+) linhas de dedução no mês/, omie: /; ([\d.]+) lançamentos nas categorias de dedução/,
    extras: { oper13: /mais ([\d.]+) com `cOperacao/ },
  },
  'dre-receita-liquida': { dfc: null, omie: /no minuendo, os ([\d.]+) lançamentos de receita/ },
  'dre-custos-de-vendas': { dfc: /^([\d.]+) linhas de custo no mês/, omie: /; ([\d.]+) lançamentos —/ },
  'dre-lucro-bruto': {
    dfc: null, omie: /^([\d.]+) lançamentos de receita e/,
    extras: { despesa: /lançamentos de receita e ([\d.]+) de despesa do Omie/ },
  },
  'dre-despesas-gerais': {
    dfc: null, omie: /^([\d.]+) lançamentos —/,
    extras: {
      titulos1: /— ([\d.]+) títulos \+/, baixas1: /títulos \+ ([\d.]+) baixas de parcial/,
      avulsos1: /baixas de parcial \+ ([\d.]+) avulsos na empresa 1/,
      titulos2: /na empresa 1 e ([\d.]+) \+ [\d.]+ \+ [\d.]+ na 2/,
      baixas2: /na empresa 1 e [\d.]+ \+ ([\d.]+) \+ [\d.]+ na 2/,
      avulsos2: /na empresa 1 e [\d.]+ \+ [\d.]+ \+ ([\d.]+) na 2/,
    },
  },
  'dre-ebitda': { dfc: null, omie: /^([\d.]+) lançamentos do mês, que passam/ },
  'dre-resultado-financeiro': {
    dfc: null, omie: /^([\d.]+) lançamentos —/,
    extras: {
      receita1: /na receita financeira, ([\d.]+) na empresa 1/,
      receita2: /na receita financeira, [\d.]+ na empresa 1 e ([\d.]+) na 2/,
      despesa1: /na despesa financeira, ([\d.]+) e/,
      despesa2: /na despesa financeira, [\d.]+ e ([\d.]+)/,
    },
  },
  'dre-impostos': {
    dfc: /^([\d.]+) linhas de guia no mês/, omie: /; ([\d.]+) lançamentos —/,
    // A conferência escreve "1 título" e "3 avulsos" — singular e plural —, então o `s` é opcional aqui.
    extras: {
      titulos: /— ([\d.]+) títulos?,/, baixas: /([\d.]+) baixas? de parcial/,
      avulsos: /e ([\d.]+) avulsos?, somando as duas empresas/,
    },
  },
  'dre-lucro-liquido': { dfc: null, omie: /^([\d.]+) lançamentos do mês, que passam/ },
  'dre-sem-conta': {
    dfc: null, omie: /^([\d.]+) lançamentos —/,
    extras: { empresa1: /— ([\d.]+) na empresa 1/, empresa2: /na empresa 1 e ([\d.]+) na 2/ },
  },

  // ---------------------------------------------------------------- Tela 2, o bloco "Compromissos" (29/09/2026)
  'capital-de-giro': {
    dfc: /do Omie e ([\d.]+) linhas? do DFC no fluxo do mês/, omie: /^([\d.]+) lançamentos? do Omie e/,
    extras: {
      pares: /no fluxo do mês, ([\d.]+) deles o mesmo pagamento/, lancamentos: /— ([\d.]+) pagamentos?:/,
      captado: /captado ([\d.]+)/, amortizado: /amortizado ([\d.]+)/, juros: /juros ([\d.]+)/, iof: /IOF ([\d.]+)/,
      contratos: /; ([\d.]+) contratos? na planilha de contratos/,
    },
  },
  'obrigacoes-clientes': {
    dfc: null, omie: /^([\d.]+) sina(?:l|is) `ADVR` em aberto/,
    extras: {
      pedidoCancelado: /, ([\d.]+) deles de pedido cancelado/, noInicio: /; ([\d.]+) no fim do mês anterior/,
      novos: /, ([\d.]+) sina(?:l novo|is novos) no mês/, baixados: /e ([\d.]+) baixados com a NF/,
    },
  },
  'divida-liquida': {
    dfc: /^([\d.]+) blocos? de banco/, omie: null,
    extras: { contratos: /; ([\d.]+) contratos? na planilha de contratos/ },
  },
  'resultado-sem-terceiros': {
    dfc: null, omie: /^([\d.]+) lançamentos do mês do lucro líquido/,
    extras: { divida: /, ([\d.]+) pagamentos? do fluxo da dívida/, sinais: /e ([\d.]+) sina(?:l|is) que mexeram/ },
  },

  // ---------------------------------------------------------------- Tela 3
  // Nenhum indicador desta tela tem lado do DFC: ela fica no Omie inteira (`docs/fontes.md`).
  'valor-previsto': {
    dfc: null, omie: /^([\d.]+) títulos \(/,
    extras: {
      empresa1: /\(([\d.]+) na empresa 1/, empresa2: /na empresa 1 e ([\d.]+) na 2\)/,
      cancelados: /; ([\d.]+) `CANCELADO` fic/,
    },
  },
  'valor-recebido': {
    dfc: null, omie: /^([\d.]+) títulos na faixa pago/,
    extras: { empresa1: /\(([\d.]+) na empresa 1/, empresa2: /na empresa 1 e ([\d.]+) na 2\)/ },
  },
  'valor-pendente': {
    dfc: null, omie: /^([\d.]+) títulos na faixa em aberto/,
    extras: { empresa1: /\(([\d.]+) na empresa 1/, empresa2: /na empresa 1 e ([\d.]+) na 2\)/ },
  },
  'valor-vencido': {
    dfc: null, omie: /^([\d.]+) títulos na faixa atrasado/,
    extras: { empresa1: /\(([\d.]+) na empresa 1/, empresa2: /na empresa 1 e ([\d.]+) na 2\)/ },
  },
  'por-mes-e-status': {
    dfc: null, omie: /^([\d.]+) títulos na coluna de/,
    extras: { pago: /— pago ([\d.]+),/, atrasado: /, atrasado ([\d.]+),/, aberto: /, em aberto ([\d.]+)/ },
  },
  'por-cliente-e-status': {
    dfc: null, omie: /^([\d.]+) títulos, em/,
    // A conferência escreve "1 código de cliente distinto" e "87 códigos … distintos": singular e plural.
    // O TAMANHO DO CADASTRO DE CLIENTES NÃO É COMPARADO, DE PROPÓSITO.
    //
    // A frase da conferência traz, entre parênteses, quantos clientes cada empresa tem cadastrados. Esse número não é
    // título nem indicador: é o tamanho de `geral/clientes`, que cresce toda vez que a MeuBESS cadastra um cliente.
    // `docs/conferencia.md` foi escrito numa leitura do Omie, e o teste roda noutra — comparar os dois derrubava esta
    // linha a cada releitura do cadastro, sem nada de errado ter acontecido (foi o que aconteceu em 28/09/2026: 3.574
    // virou 3.577 e 3.573 virou 3.576, com os 128 títulos intactos). Os dois lados só seriam comparáveis na MESMA
    // leitura, e é a conferência inteira que teria de ser republicada para isso.
    //
    // O QUE É COMPARADO NO LUGAR — e que a mesma frase afirma — é a relação entre a tela e o cadastro, que não se
    // mexe quando o Omie ganha cliente: todos os códigos de cliente da janela estão no cadastro COM NOME. `semNome`
    // é 0 quando a conferência escreve "todos vêm com nome preenchido" e N quando ela escreve "N deles vêm sem
    // nome"; a tela conta o mesmo — quantos clientes do gráfico ficaram sem rótulo. É mais apertado que o tamanho:
    // cadastro sumido ou truncado tira o nome dos clientes da janela e sai divergente.
    extras: {
      clientes: /em ([\d.]+) códigos? de cliente distintos?/,
      semNome: (entram) => {
        const m = /e ([\d.]+) deles vêm sem nome/.exec(entram);
        if (m) return num(m[1]);
        // Sem a frase do cadastro, a conferência não o leu (ela mesma marca a linha "a conferir:"): nada a comparar.
        return /e todos vêm com nome preenchido/.test(entram) ? 0 : null;
      },
    },
  },
  'lista-de-titulos': {
    dfc: null, omie: /^([\d.]+) títulos —/,
    extras: { comPedido: /— ([\d.]+) com pedido de venda/, semPedido: /e ([\d.]+) sem `nCodOS`/ },
  },
  'por-status': {
    dfc: null, omie: /^([\d.]+) títulos na rosca/,
    extras: { pago: /— pago ([\d.]+),/, atrasado: /, atrasado ([\d.]+),/, aberto: /, em aberto ([\d.]+)/ },
  },

  // ---------------------------------------------------------------- Tela 3, os números do Fluxo de Caixa
  // Estes quatro são de fonte DFC (a projeção soma o Omie por cima, e num mês fechado não há projeção: o lado do Omie
  // é 0 e a própria frase da conferência diz por quê).
  fixas: {
    dfc: /^([\d.]+) linhas? de saída fixas? no mês/, omie: null,
    extras: {
      contasFixasNoMes: /em ([\d.]+) contas? fixas? distintas?/,
      contasDaGestora: /distintas? das ([\d.]+) que a gestora marcou/,
      ausentesDaResposta: /; ([\d.]+) contas? de despesa não voltar(?:am|ou) na resposta dela/,
    },
  },
  'peso-fixas': {
    // O numerador é a contagem que o cartão publica; o denominador e as deduções são a repartição, e entram como extras.
    dfc: /^([\d.]+) linhas? fixas? no numerador/, omie: null,
    extras: { receita: /e ([\d.]+) linhas? de receita no denominador/, deducoes: /menos ([\d.]+) linhas? de dedução/ },
  },
  // O extrator do Omie só casa quando a conferência publica um NÚMERO. Num mês fechado ela escreve "sem título do
  // Omie", porque a tela também não mostra contagem ali — e uma ausência não se compara com zero.
  projecao: { dfc: /^([\d.]+) linhas? do `FLUXO DE CAIXA` no mês do lado do DFC/, omie: /; ([\d.]+) títulos do Omie/ },
  'dia-a-dia': {
    dfc: /^([\d.]+) linhas? do `FLUXO DE CAIXA` no mês no consolidado/, omie: /; ([\d.]+) títulos de previsão/,
    extras: {
      diasComMovimento: /em ([\d.]+) dias? com movimento/,
      bancos: /; ([\d.]+) blocos? de banco,/,
      bancosQueFecham: /, ([\d.]+) em que o saldo corrido anda exatamente com o movimento,/,
      linhasNaoBaixadasNoSaldo: /, ([\d.]+) linhas? que o saldo já desconta e não est(?:á|ão) baixada/,
      bancosComLancamentoDepoisDoSaldo: /e ([\d.]+) bancos? em que a planilha lançou depois de parar de escrever o saldo/,
      // A PONTE COM OS BANCOS, como veredito e não como valor: a conferência escreve "fecha sem sobra" ou "não fecha",
      // e a tela calcula a mesma ponte. `true` dos dois lados é o que o dono pediu para conferir.
      ponteFecha: (entram) => (/a ponte com os bancos fecha sem sobra/.test(entram) ? true
        : /a ponte com os bancos não fecha/.test(entram) ? false : null),
    },
  },
};

// Lê `docs/conferencia.md`: a ordem dos indicadores e, de cada um, o trecho "**Entram:** …".
function lerConferencia() {
  if (!fs.existsSync(CONFERENCIA)) {
    console.error(`não achei ${CONFERENCIA}.\nRode antes: node scripts/numeros-das-telas.mjs`);
    process.exit(1);
  }
  const texto = fs.readFileSync(CONFERENCIA, 'utf8');
  const indicadores = [];
  for (const l of texto.split(/\r?\n/)) {
    const m = /^- (?:divergente: |a conferir: )?\*\*(Tela [123]) — (.+?)\.\*\* \*\*Entram:\*\* (.*?)(?: \*\*Fonte:\*\*|$)/.exec(l);
    // `linha` e a linha inteira, com o "**Filtro:**" - e de la que sai a janela de vencimento do "Valor pendente".
    if (m) indicadores.push({ tela: m[1], nome: m[2], entram: m[3], linha: l });
  }
  return indicadores;
}

// ================================================================ a conferência das telas

const doConferencia = lerConferencia();

if (doConferencia.length === 0) {
  console.error('não consegui ler nenhum indicador de docs/conferencia.md — o formato mudou?');
  process.exit(1);
}

const tela1 = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const tela2 = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const tela3 = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES });
// A TELA 3 SÃO DOIS CÁLCULOS DESDE 28/09/2026. `calcularTela3` é a carteira de contas a receber, que virou o cálculo de
// onde sai o "ainda a receber"; `calcularFluxoDeCaixa` é a tela de verdade, e é dela que vêm os quatro números que
// nasceram no Fluxo de Caixa. Os dois entram em `daTela`, e nenhum id se repete entre eles.
const telaFluxo = await calcularFluxoDeCaixa({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const TELAS = { 'Tela 1': tela1, 'Tela 2': tela2, 'Tela 3': tela3 };

// A ÚNICA JANELA QUE NÃO É A DO MÊS: a faixa "em aberto" do cartão "Valor pendente" da Tela 3.
//
// Num mês fechado essa faixa é sempre vazia — os quatro `cStatus` dela são os de um título que ainda não venceu, e
// num mês fechado todo título já venceu. Por isso `docs/conferencia.md` a mede noutra janela de vencimento, a do mês
// seguinte ao da leitura, e diz na própria linha qual foi. O teste lê essa janela DO ARQUIVO — não a calcula — e
// pede à mesma camada de dados a Tela 3 nela: a regra é a mesma, muda só o `dDtVencDe` / `dDtVencAte`.
const linhaPendente = doConferencia.find((i) => i.tela === 'Tela 3' && i.nome === 'Valor pendente');
const naLinha = linhaPendente && /dDtVencAte` em (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/.exec(linhaPendente.linha);
let pendente = null, motivoPendente = null, janelaPendente = null;
if (!linhaPendente) {
  motivoPendente = 'não achei a linha do "Valor pendente" em docs/conferencia.md';
} else if (!naLinha) {
  motivoPendente = 'não achei na linha da conferência a janela de vencimento (`dDtVencDe` / `dDtVencAte`) que ela usou nesta faixa';
} else {
  janelaPendente = [naLinha[1], naLinha[2]];
  const tela3Pendente = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, janela: janelaPendente });
  if (tela3Pendente.janela.leitura !== 'janela') {
    motivoPendente = `a leitura por vencimento de ${janelaPendente[0]} a ${janelaPendente[1]} — a que a conferência usou nesta faixa — não está inteira no cache local, e recortar a leitura do ano daria outros títulos; rode antes \`node scripts/ler-omie-faltante.mjs\``;
  } else {
    pendente = tela3Pendente.cartoes.find((c) => c.id === 'valor-pendente');
  }
}

const daTela = new Map([...tela1.cartoes, ...tela1.blocos, ...tela2.cartoes, ...tela2.tabela, ...tela2.compromissos.itens,
  ...tela3.cartoes, ...tela3.blocos,
  // Só os quatro que nasceram no Fluxo de Caixa: os outros seis cartões dele são cartões das Telas 1 e 3 pelo mesmo
  // cálculo, e já estão comparados pelo id de lá.
  ...telaFluxo.cartoes.filter((c) => ['fixas', 'peso-fixas', 'projecao'].includes(c.id)), ...telaFluxo.blocos,
].map((i) => [i.id, i]));
if (pendente) daTela.set('valor-pendente', pendente);

// Casa o indicador da tela com a linha da conferência pelo nome que a conferência usa. Uma tabela por tela: o mesmo
// nome pode voltar noutra tela querendo dizer outra coisa.
const NOME_NA_CONFERENCIA = {
  'Tela 1': {
    saldo: 'Saldo',
    receitas: 'Receitas',
    despesas: 'Despesas',
    'despesas-pagas': 'Despesas pagas',
    'despesas-pendentes': 'Despesas pendentes',
    'despesas-funcionarios': 'Despesas com funcionários',
    'percentual-funcionarios': '% desp. funcionários / receita líquida',
    'top-10-despesas': 'Top 10 despesas',
    'top-10-receitas': 'Top 10 receitas',
    'receita-despesa-por-dia': 'Receita × despesa por dia',
    'receita-despesa-por-mes': 'Receita × despesa por mês',
  },
  'Tela 2': {
    'receita-total': 'Receita total',
    'custos-e-despesas': 'Custos e despesas',
    'cartao-ebitda': 'EBITDA',
    'cartao-lucro-liquido': 'Lucro líquido',
    'cartao-margem': 'Margem de lucro',
    'dre-receitas': '(+) Receitas: outras receitas, vendas de produtos',
    'dre-receita-bruta': '(=) Receita bruta',
    'dre-deducoes': '(−) Deduções: devoluções, taxas de serviço',
    'dre-receita-liquida': '(=) Receita líquida',
    'dre-custos-de-vendas': '(−) Custos de vendas: custo do produto, outros custos',
    'dre-lucro-bruto': '(=) Lucro bruto',
    'dre-despesas-gerais': '(−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI',
    'dre-ebitda': '(=) EBITDA',
    'dre-resultado-financeiro': '(+/−) Resultado financeiro: receitas e despesas financeiras',
    'dre-impostos': '(−) Impostos pagos (guias)',
    'dre-lucro-liquido': '(=) Lucro líquido',
    'dre-sem-conta': '(=) sem conta',
    // O bloco "Compromissos", abaixo do DRE (decisão do dono, 29/09/2026).
    'capital-de-giro': 'Capital de giro tomado',
    'obrigacoes-clientes': 'Obrigações com clientes',
    'divida-liquida': 'Dívida líquida',
    'resultado-sem-terceiros': 'Resultado sem dinheiro de terceiros',
  },
  'Tela 3': {
    'valor-previsto': 'Valor previsto',
    'valor-recebido': 'Valor recebido',
    'valor-pendente': 'Valor pendente',
    'valor-vencido': 'Valor vencido',
    'por-mes-e-status': 'Lançamentos por mês e status',
    'por-cliente-e-status': 'Valor previsto por cliente e status',
    'lista-de-titulos': 'Lista de títulos',
    'por-status': 'Lançamentos por status',
    // Os quatro que nasceram no Fluxo de Caixa (28/09/2026).
    fixas: 'Despesas fixas pagas',
    'peso-fixas': 'Fixas / receita líquida',
    projecao: 'Projeção do mês',
    'dia-a-dia': 'O mês dia a dia',
  },
};
const idPorNome = new Map(Object.entries(NOME_NA_CONFERENCIA).flatMap(([tela, mapa]) =>
  Object.entries(mapa).map(([id, nome]) => [`${tela}|${nome}`, id])));

const linhas = [];
for (const ind of doConferencia) {
  if (!TELAS[ind.tela]) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** tela ainda não construída.`);
    continue;
  }
  const tela = TELAS[ind.tela];
  const id = idPorNome.get(`${ind.tela}|${ind.nome}`);
  // A faixa "em aberto" do "Valor pendente" só pode ser comparada se a janela que a conferência usou foi lida.
  if (id === 'valor-pendente' && motivoPendente) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** ${motivoPendente}.`);
    continue;
  }
  const naTela = id ? daTela.get(id) : null;
  if (!naTela) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** a ${ind.tela} não mostra este indicador, e o teste não soube com o que comparar.`);
    continue;
  }
  const ex = EXTRATORES[id];
  // Um extrator é uma expressão regular — o primeiro grupo é o número — ou uma função, para o punhado de frases em
  // que a conferência diz o número por extenso ("todos vêm com nome preenchido" quer dizer zero).
  const achar = (re) => {
    if (!re) return null;
    if (typeof re === 'function') return re(ind.entram);
    const m = re.exec(ind.entram);
    return m ? num(m[1]) : null;
  };
  const esperado = { dfc: achar(ex.dfc), omie: achar(ex.omie) };
  const obtido = naTela.contagem;

  // Se o DFC não foi lido nesta rodada, o lado do DFC da tela é vazio: é "a conferir:", não divergência.
  if (tela.dfc && !tela.dfc.ok && esperado.dfc !== null) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** a fonte principal deste indicador é o DFC e as planilhas não foram lidas nesta rodada — ${tela.dfc.motivo}.`);
    continue;
  }

  const partes = [], difs = [];
  for (const lado of ['dfc', 'omie']) {
    if (esperado[lado] === null) continue;
    if (obtido[lado] === null || obtido[lado] === undefined) {
      difs.push(`do lado do ${lado === 'dfc' ? 'DFC' : 'Omie'} a tela não produziu contagem, e a conferência diz ${esperado[lado]}`);
      continue;
    }
    partes.push(`${lado === 'dfc' ? 'DFC' : 'Omie'} ${obtido[lado]}`);
    if (obtido[lado] !== esperado[lado]) {
      difs.push(`do lado do ${lado === 'dfc' ? 'DFC' : 'Omie'} a tela conta ${obtido[lado]} e a conferência diz ${esperado[lado]}`);
    }
  }
  // OS EXTRAS: a repartição que a conferência publica dentro da mesma frase. Cada um vira mais uma comparação; um
  // extra que a conferência tem e a tela não produz é divergência, não silêncio.
  const extras = [];
  for (const [nome, re] of Object.entries(ex.extras ?? {})) {
    const esp = achar(re);
    if (esp === null) continue;
    const obt = obtido.extras?.[nome];
    if (obt === null || obt === undefined) {
      difs.push(`a tela não produziu "${nome}", e a conferência diz ${esp}`);
      continue;
    }
    extras.push(`${nome} ${obt}`);
    if (obt !== esp) difs.push(`em "${nome}" a tela conta ${obt} e a conferência diz ${esp}`);
  }

  if (!partes.length && !difs.length) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** não achei na linha da conferência um número para comparar.`);
    continue;
  }
  const naConferencia = ['dfc', 'omie'].filter((l) => esperado[l] !== null)
    .map((l) => `${l === 'dfc' ? 'DFC' : 'Omie'} ${esperado[l]}`).join(' e ');
  const comum = `**${ind.tela} — ${ind.nome}.** **Na tela:** ${partes.join(' e ')}. **Na conferência:** ${naConferencia}.`
    + `${extras.length ? ` **Também conferido:** ${extras.join(', ')}.` : ''} **Fonte:** ${naTela.fonte}.`;
  linhas.push(difs.length ? `- divergente: ${comum} **Motivo:** ${difs.join('; ')}.` : `- ${comum}`);
}

// ================================================================ a saída
//
// O resumo é contado nas PRÓPRIAS linhas que vão para o arquivo, pelo começo de cada uma — não por uma variável
// paralela, que poderia discordar do que está escrito.
const COMECO = { conferido: '- **', divergente: '- divergente: ', 'a-conferir': '- a conferir: ' };
const quantos = (e) => linhas.filter((l) => l.startsWith(COMECO[e])).length;
const nConferidos = quantos('conferido'), nDivergentes = quantos('divergente'), nAConferir = quantos('a-conferir');
if (nConferidos + nDivergentes + nAConferir !== linhas.length) {
  console.error('uma linha não começa com nenhuma das três marcas conhecidas — o formato quebrou');
  process.exit(1);
}

const md = `# As telas conferidas contra a conferência — ${NOMES_DOS_MESES[MES]} de ${ANO}

Gerado por [\`scripts/conferir-telas.mjs\`](../scripts/conferir-telas.mjs), só leitura. Uma linha por indicador das 3
telas. Para cada um, o número que **a tela mostra** e o número que **[\`docs/conferencia.md\`](conferencia.md) publica**
— e se os dois batem.

**O que é comparado é a CONTAGEM**, não o valor: quantos lançamentos entraram naquele indicador, de cada lado (o DFC e
o Omie). É o que prende o filtro — dois filtros diferentes quase nunca pegam o mesmo número de lançamentos. O valor em
reais aparece só na tela, lido na hora, e não entra nesta página nem em nenhum arquivo versionado.

Os números esperados são **lidos do texto** de [\`docs/conferencia.md\`](conferencia.md), gerado antes por
[\`scripts/numeros-das-telas.mjs\`](../scripts/numeros-das-telas.mjs). Os obtidos saem da **mesma camada de dados que o
navegador recebe** ([\`lib/indicadores/\`](../lib/indicadores/)), que filtra pelas regras de
[\`lib/regras/\`](../lib/regras/) — as mesmas que a conferência usa.

Onde a conferência publica a linha **repartida** — quanto veio de venda de produtos e quanto de outras receitas,
quantos títulos e quantos avulsos, quanto em cada empresa —, cada pedaço também é comparado, e aparece na linha em
**Também conferido**. Um total pode bater por acaso com a repartição errada; é o que esses pedaços fecham.

**O cadastro de clientes é conferido pela relação, não pelo tamanho.** A linha "Valor previsto por cliente e status"
não compara mais quantos clientes cada empresa tem cadastrados — esse número cresce toda vez que a MeuBESS cadastra um
cliente, e derrubava a linha a cada releitura do Omie, com os títulos intactos; o que é comparado é o que a mesma frase
da conferência afirma e que a releitura não mexe: **todos os códigos de cliente da janela estão no cadastro com nome**
(o \`semNome\` da linha, que é 0 quando nenhum cliente do gráfico ficou sem rótulo). O tamanho continua escrito em
[\`docs/conferencia.md\`](conferencia.md), como contexto.

Linha que começa com **divergente:** quer dizer que os dois números não bateram; o motivo está no fim da linha. Linha
que começa com **a conferir:** quer dizer que não deu para comparar; o motivo está no fim da linha.

**${doConferencia.length} indicadores**: ${nConferidos} conferidos, ${nDivergentes} divergentes e ${nAConferir} a conferir.

${nAConferir === 0
    ? 'As três telas estão construídas e nenhum indicador ficou de fora.'
    : `${nAConferir} indicador(es) não puderam ser comparados nesta rodada; o motivo está no fim de cada linha.`}

A **Tela 3 fica no Omie inteira** (\`docs/fontes.md\`): ela é a carteira de títulos a receber, e o DFC, que é caixa,
não registra carteira em aberto nem tem cadastro de cliente. Por isso as linhas dela trazem só o lado do Omie.

**Um indicador não é de ${NOMES_DOS_MESES[MES]}, e a regra dele explica por quê.** A faixa "em aberto" do cartão
"Valor pendente" da Tela 3 é vazia em qualquer mês fechado — os quatro \`cStatus\` dela são os de um título que ainda
não venceu, e num mês fechado todo título já venceu. \`docs/conferencia.md\` mede essa faixa noutra janela de
vencimento${janelaPendente ? `, ${janelaPendente[0]} a ${janelaPendente[1]}` : ''}, e diz na própria linha qual foi;
este teste lê a janela **do arquivo** e pede à camada de dados a mesma Tela 3 nela — a regra não muda, muda a janela.
Os outros ${doConferencia.length - 1} indicadores são de ${NOMES_DOS_MESES[MES]} de ${ANO}.

${tela1.dfc.ok
    ? `O DFC desta rodada saiu de **${tela1.dfc.fonte}**, só para leitura: a Tela 1 leu \`${tela1.dfc.arquivo}\`, e a Tela 2, que tem uma coluna por mês, leu ${tela2.dfc.mesesLidos.length} dos 12 arquivos do ano.`
    : `O DFC **não foi lido** nesta rodada: ${tela1.dfc.motivo}.`}

## Os indicadores

${linhas.join('\n')}
`;

// A MESMA TRAVA DE `numeros-das-telas.mjs`: esta página não pode ganhar dinheiro nem nome de pessoa.
const PROIBIDO = [[/R\$/, 'a marca "R$"'], [/\b\d{1,3}(\.\d{3})*,\d{2}\b/, 'um número com centavos'], [/\b\d+,\d{2}\b/, 'um número com centavos']];
for (const [re, oque] of PROIBIDO) {
  const m = re.exec(md);
  if (m) { console.error(`a página ia sair com ${oque}: ${JSON.stringify(m[0])}`); process.exit(1); }
}

fs.writeFileSync(SAIDA, md);
console.log(`gravado ${path.relative(RAIZ, SAIDA)}`);
console.log(`${doConferencia.length} indicadores: ${nConferidos} conferidos, ${nDivergentes} divergentes, ${nAConferir} a conferir`);
for (const l of linhas.filter((x) => x.startsWith('- divergente: '))) console.log(`  ${l.slice(2, 160)}`);
if (nDivergentes) process.exit(1);
