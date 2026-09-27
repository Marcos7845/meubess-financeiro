// TELA 2 — DRE POR MÊS. Os 17 indicadores de `docs/fontes.md`: 5 cartões e 12 linhas da tabela do DRE.
//
// POR QUE O ANO INTEIRO, E NÃO SÓ O MÊS. A tela de referência
// (`docs/referencias/tela-2-dre.jpg`) tem uma COLUNA POR MÊS, com análise horizontal ao lado de cada uma. Então o
// cálculo é feito doze vezes, uma por mês do ano, pelas MESMAS regras — o mês escolhido é só a coluna que os cartões
// do topo mostram. O lado do Omie sai do cache do ano, que já está em memória; o lado do DFC abre um arquivo por mês
// (~7 s para os doze, neste computador), e é por isso que `lib/dados.mjs` guarda o resultado por uma hora.
//
// VALOR E CONTAGEM, como na Tela 1. O valor é dinheiro e nunca entra em arquivo versionado: vive na memória do
// servidor e vai para a tela. A contagem (quantos lançamentos entraram) é o que `docs/conferencia.md` publica, e é
// por ela que `scripts/conferir-telas.mjs` compara a tela com a conferência.
//
// NENHUMA REGRA MORA AQUI. Os filtros, as listas do dono e o vocabulário do DFC vêm de `lib/regras/` — os mesmos
// arquivos que `scripts/numeros-das-telas.mjs` importa.
//
// ANÁLISE HORIZONTAL E VERTICAL SÃO LEITURA DA TELA, NÃO REGRA. `docs/fontes.md` não fala delas; elas vêm do
// layout de referência. AH = variação da coluna contra o mês anterior. AV = a linha como % da receita líquida do
// próprio mês. As duas saem dos valores já calculados pelas regras — não mexem em filtro nenhum.
//
// O FILTRO DE MÊS, SELEÇÃO MÚLTIPLA (`docs/fontes.md`, "Tela 2 — DRE": mês, seleção múltipla). Ele não muda regra
// nenhuma: os doze meses continuam sendo calculados pelas mesmas regras, e o filtro escolhe QUAIS deles a tela mostra.
// O que ele muda, e está escrito na própria tela:
//
//   as COLUNAS da tabela passam a ser só os meses escolhidos;
//   os CARTÕES do topo, que mostravam um mês, passam a somar os meses escolhidos — e a margem de lucro é refeita da
//   soma, nunca a média dos percentuais dos meses;
//   a coluna "Total" passa a ser o total DOS MESES ESCOLHIDOS, e a tela diz isso no cabeçalho dela;
//   a AH da primeira coluna escolhida não tem mês anterior dentro da escolha e sai "—".
//
// Sem escolha nenhuma nada muda: todas as colunas de abril em diante, e os cartões no mês da URL.
//
// O FILTRO DE EMPRESA (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas. Esta tela sempre somou as duas
// filiais do Omie, e o filtro escolhe QUAIS entram na soma. Ele vale em toda linha e todo cartão cuja fonte principal é
// o Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "(=) sem conta" —
// e em TODA contagem do Omie da tela.
//
// ONDE NÃO VALE: nas linhas de fonte DFC ("(−) Deduções", "(−) Custos de vendas", "(−) Impostos pagos (guias)") e nos
// dois primeiros cartões do topo, porque o DFC separa as linhas por `EMP.` (`B3W` / `N3`) e nenhum dos dois é filial do
// Omie (cruzamento de 27/09/2026, em `docs/fontes.md`). E, por consequência, nas linhas "(=)" que somam as duas fontes:
// elas ficam com uma ponta filtrada e a outra das duas empresas, e dizem isso na tela. Cada linha traz a sua fonte em
// `fonteDoValor`, e é dela que a frase sai — nenhuma lista à parte para desencontrar.

import { abrirCacheOmie } from '../regras/cache-omie.mjs';
import { lerRecorte, criarRegras, valorOmie } from '../regras/movimentos.mjs';
import { noMesDe, NOMES_DOS_MESES } from '../regras/periodo.mjs';
import {
  lerDfc, eDeducaoDfc,
  DFC_RECEITA, DFC_CUSTO_CLASSE, DFC_CUSTO_SUB2, DFC_IMPOSTO_SUB2,
} from '../regras/dfc.mjs';
import {
  VENDA_DE_PRODUTOS, CUSTO_DE_VENDAS, RESULTADO_FINANCEIRO, DEDUCOES, IMPOSTOS_GUIAS, FORA_DO_DRE,
} from '../regras/listas.mjs';
import { filtroDaTela2, filtroDeEmpresa, naoVale, PORQUE_O_DFC_NAO_TEM_EMPRESA } from '../regras/filtros.mjs';

const naLista = (lista) => (cod) => lista.includes(cod);
const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// No DFC a saída já vem negativa; a tabela do DRE mostra o que se subtrai como número positivo.
const modulo = (c) => Math.abs(c);
const valorDe = (b) => somar(b.todos.map(valorOmie));

// A DIVISÃO DA LINHA "(+) Receitas" (decisão do dono, 25/09/2026): venda de produtos são três códigos; outras
// receitas é todo o resto com `conta_receita = "S"` e `totalizadora = "N"`, fora as de transferência. É a mesma
// derivação que `scripts/numeros-das-telas.mjs` faz, a partir do mesmo cadastro do cache.
function outrasReceitasDe(categorias, eTransferencia, emp) {
  return [...categorias[emp].values()]
    .filter((c) => c.conta_receita === 'S' && c.totalizadora === 'N'
      && !eTransferencia(emp, c.codigo) && !VENDA_DE_PRODUTOS.includes(String(c.codigo)))
    .map((c) => String(c.codigo));
}

// ================================================================ um mês do DRE
//
// Devolve, para um mês: o valor de cada linha (em centavos) e a contagem de cada indicador, dos dois lados.

// O BALDE VAZIO — o que uma empresa que o filtro de empresa deixou de fora devolve. Assim toda soma e toda contagem
// abaixo continua escrita do mesmo jeito, com as duas empresas: a que ficou fora entra com zero, e nenhuma linha
// precisa saber que existe filtro. Sem filtro, nenhuma empresa é vazia e a tela é a de sempre.
const BALDE_VAZIO = { titulos: new Map(), baixas: new Map(), avulsos: new Map(), total: 0, todos: [] };

function mesDoDre({ ano, mes, EMPRESAS, ATIVAS, categorias, contasDre, regras, OUTRAS_RECEITAS, linhasDfc }) {
  const noMes = noMesDe(ano, mes);
  const { contar, base } = regras;
  const naSoma = (emp) => ATIVAS.includes(String(emp));

  // Os três baldes do mês, por natureza — a base do lado do Omie, a mesma da conferência e da Tela 1.
  const R = {}, P = {};
  for (const emp of EMPRESAS) {
    R[emp] = naSoma(emp) ? contar(emp, noMes, 'R') : BALDE_VAZIO;
    P[emp] = naSoma(emp) ? contar(emp, noMes, 'P') : BALDE_VAZIO;
  }
  const totalR = R[1].total + R[2].total, totalP = P[1].total + P[2].total;

  // (+) Receitas, pela categoria do lançamento.
  const venda = {}, outras = {};
  for (const emp of EMPRESAS) {
    venda[emp] = naSoma(emp) ? contar(emp, noMes, 'R', { categoria: naLista(VENDA_DE_PRODUTOS) }) : BALDE_VAZIO;
    outras[emp] = naSoma(emp) ? contar(emp, noMes, 'R', { categoria: naLista(OUTRAS_RECEITAS[emp]) }) : BALDE_VAZIO;
  }

  // (−) Deduções, (−) Custos de vendas, (−) Despesas gerais, (+/−) Resultado financeiro, (−) Impostos e sem conta.
  const ded = {}, oper13 = {}, cv = {}, dg = {}, fin = {}, imp = {}, sc = {};
  for (const emp of EMPRESAS) {
    if (!naSoma(emp)) {
      ded[emp] = BALDE_VAZIO; oper13[emp] = []; cv[emp] = BALDE_VAZIO; dg[emp] = BALDE_VAZIO;
      fin[emp] = { R: BALDE_VAZIO, P: BALDE_VAZIO }; imp[emp] = BALDE_VAZIO;
      sc[emp] = { R: BALDE_VAZIO, P: BALDE_VAZIO };
      continue;
    }
    ded[emp] = contar(emp, noMes, 'P', { categoria: naLista(DEDUCOES[emp]), comTransferencia: false });
    oper13[emp] = base(emp, noMes).linhas.filter((d) => String(d.cOperacao ?? '') === '13');
    cv[emp] = contar(emp, noMes, 'P', { categoria: naLista(CUSTO_DE_VENDAS[emp]) });
    dg[emp] = contar(emp, noMes, 'P', {
      categoria: (cod) => categorias[emp].get(cod)?.conta_despesa === 'S'
        && !CUSTO_DE_VENDAS[emp].includes(cod) && !RESULTADO_FINANCEIRO[emp].includes(cod) && !FORA_DO_DRE[emp].includes(cod),
    });
    fin[emp] = {
      R: contar(emp, noMes, 'R', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
      P: contar(emp, noMes, 'P', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
    };
    imp[emp] = contar(emp, noMes, 'P', { categoria: naLista(IMPOSTOS_GUIAS[emp]), comTransferencia: false });
    sc[emp] = {
      R: contar(emp, noMes, 'R', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre }),
      P: contar(emp, noMes, 'P', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre }),
    };
  }

  // ---------------------------------------------------------------- o lado do DFC
  const L = linhasDfc ?? [];
  const dfcReceita = L.filter((l) => l.natureza === 'R' && DFC_RECEITA.includes(l.sub2));
  const dfcSaida = L.filter((l) => l.natureza === 'P');
  const dfcDeducoes = L.filter(eDeducaoDfc);
  const dfcCustos = L.filter((l) => DFC_CUSTO_CLASSE.includes(l.classe) && DFC_CUSTO_SUB2.includes(l.sub2));
  const dfcGuias = L.filter((l) => l.classe === 'IMPOSTOS E CONTRIBUICOES' && DFC_IMPOSTO_SUB2.includes(l.sub2));

  // ---------------------------------------------------------------- os valores das linhas, em centavos
  //
  // Cada linha usa a FONTE PRINCIPAL que `docs/fontes.md` lhe dá. As linhas "(=)" são aritmética das de cima — não
  // têm leitura própria, e é por isso que misturam Omie e DFC sem escolher.
  const receitas = valorDe(venda[1]) + valorDe(venda[2]) + valorDe(outras[1]) + valorDe(outras[2]);
  const receitaBruta = receitas;
  const deducoes = somar(dfcDeducoes.map((l) => modulo(l.valor)));
  const receitaLiquida = receitaBruta - deducoes;
  const custosDeVendas = somar(dfcCustos.map((l) => modulo(l.valor)));
  const lucroBruto = receitaLiquida - custosDeVendas;
  const despesasGerais = valorDe(dg[1]) + valorDe(dg[2]);
  const ebitda = lucroBruto - despesasGerais;
  const resultadoFinanceiro = valorDe(fin[1].R) + valorDe(fin[2].R) - valorDe(fin[1].P) - valorDe(fin[2].P);
  const impostos = somar(dfcGuias.map((l) => modulo(l.valor)));
  const lucroLiquido = ebitda + resultadoFinanceiro - impostos;
  const semConta = valorDe(sc[1].R) + valorDe(sc[2].R) - valorDe(sc[1].P) - valorDe(sc[2].P);

  // Os cartões do topo: os dois primeiros são do DFC; os três últimos saem das linhas da tabela.
  const receitaTotal = somar(dfcReceita.map((l) => l.valor));
  const custosEDespesas = somar(dfcSaida.map((l) => modulo(l.valor)));
  const margem = receitaBruta ? lucroLiquido / receitaBruta : null;

  const totalizadoras = EMPRESAS.every((emp) => contasDre[emp])
    ? Object.fromEntries(EMPRESAS.map((emp) => [emp, contasDre[emp].filter((c) => c.totalizaDRE === 'S')]))
    : null;

  // `trio` é a contagem por empresa que a conferência publica em várias linhas.
  const trio = (b) => ({ titulos: b.titulos.size, baixas: b.baixas.size, avulsos: b.avulsos.size });

  return {
    mes,
    // DE QUANTA LEITURA A COLUNA SAIU, dos dois lados. Não é julgamento nenhum: é a mesma contagem que a conferência
    // publica, mês a mês. Serve para o dono ver de olho quando um mês tem o DFC cheio e o Omie quase vazio — em
    // janeiro e fevereiro de 2026 é o caso, porque o recorte da MeuBESS quase não tem lançamento nesses dois meses —,
    // e então saber que os totalizadores daquela coluna misturam um lado cheio com outro vazio.
    cobertura: { dfc: L.length, omie: totalR + totalP },
    valores: {
      receitas, receitaBruta, deducoes, receitaLiquida, custosDeVendas, lucroBruto,
      despesasGerais, ebitda, resultadoFinanceiro, impostos, lucroLiquido, semConta,
      receitaTotal, custosEDespesas, margem,
      vendaDeProdutos: valorDe(venda[1]) + valorDe(venda[2]),
      outrasReceitas: valorDe(outras[1]) + valorDe(outras[2]),
      financeiroR: valorDe(fin[1].R) + valorDe(fin[2].R),
      financeiroP: valorDe(fin[1].P) + valorDe(fin[2].P),
    },
    // As contagens de cada indicador, na mesma forma que `scripts/conferir-telas.mjs` espera.
    contagens: {
      'receita-total': { dfc: dfcReceita.length, omie: totalR },
      'custos-e-despesas': { dfc: dfcSaida.length, omie: totalP },
      'cartao-ebitda': { dfc: null, omie: totalR + totalP, extras: { receita: totalR, despesa: totalP } },
      'cartao-lucro-liquido': { dfc: null, omie: totalR + totalP, extras: { receita: totalR, despesa: totalP } },
      'cartao-margem': { dfc: null, omie: totalR + totalP, extras: { receita: totalR, despesa: totalP } },
      'dre-receitas': {
        dfc: null, omie: venda[1].total + venda[2].total + outras[1].total + outras[2].total,
        extras: { venda: venda[1].total + venda[2].total, outras: outras[1].total + outras[2].total },
      },
      'dre-receita-bruta': {
        dfc: null, omie: venda[1].total + venda[2].total + outras[1].total + outras[2].total,
        extras: {
          contasDoDre: contasDre[1] ? contasDre[1].length : null,
          totalizadoras: totalizadoras ? totalizadoras[1].length : null,
        },
      },
      'dre-deducoes': {
        dfc: dfcDeducoes.length, omie: ded[1].total + ded[2].total,
        extras: { oper13: oper13[1].length + oper13[2].length },
      },
      'dre-receita-liquida': { dfc: null, omie: totalR },
      'dre-custos-de-vendas': { dfc: dfcCustos.length, omie: cv[1].total + cv[2].total },
      'dre-lucro-bruto': { dfc: null, omie: totalR, extras: { despesa: totalP } },
      'dre-despesas-gerais': {
        dfc: null, omie: dg[1].total + dg[2].total,
        extras: {
          titulos1: trio(dg[1]).titulos, baixas1: trio(dg[1]).baixas, avulsos1: trio(dg[1]).avulsos,
          titulos2: trio(dg[2]).titulos, baixas2: trio(dg[2]).baixas, avulsos2: trio(dg[2]).avulsos,
        },
      },
      'dre-ebitda': { dfc: null, omie: totalR + totalP },
      'dre-resultado-financeiro': {
        dfc: null, omie: fin[1].R.total + fin[2].R.total + fin[1].P.total + fin[2].P.total,
        extras: { receita1: fin[1].R.total, receita2: fin[2].R.total, despesa1: fin[1].P.total, despesa2: fin[2].P.total },
      },
      'dre-impostos': {
        dfc: dfcGuias.length, omie: imp[1].total + imp[2].total,
        extras: {
          titulos: imp[1].titulos.size + imp[2].titulos.size,
          baixas: imp[1].baixas.size + imp[2].baixas.size,
          avulsos: imp[1].avulsos.size + imp[2].avulsos.size,
        },
      },
      'dre-lucro-liquido': { dfc: null, omie: totalR + totalP },
      'dre-sem-conta': {
        dfc: null, omie: sc[1].R.total + sc[1].P.total + sc[2].R.total + sc[2].P.total,
        extras: { empresa1: sc[1].R.total + sc[1].P.total, empresa2: sc[2].R.total + sc[2].P.total },
      },
    },
  };
}

// ================================================================ a tabela do DRE
//
// A ORDEM E OS GRUPOS são os da tela de referência: cada linha "(=)" fecha o grupo acima dela. `chave` é o nome do
// valor em `valores`; `sinal` diz como a linha entra na conta (e é só leitura — a aritmética já foi feita acima).

const LINHAS_DO_DRE = [
  { id: 'dre-receitas', chave: 'receitas', rotulo: '(+) Receitas', grupo: 'Descrição da Receita', sinal: '+',
    fonte: 'Omie recortado (principal) / DFC (confronto)', fonteDoValor: 'omie',
    detalhe: [{ rotulo: 'Vendas de produtos', chave: 'vendaDeProdutos' }, { rotulo: 'Outras receitas', chave: 'outrasReceitas' }] },
  { id: 'dre-receita-bruta', chave: 'receitaBruta', rotulo: '(=) Receita bruta', total: true,
    fonte: 'Omie recortado, calculado', fonteDoValor: 'omie' },
  { id: 'dre-deducoes', chave: 'deducoes', rotulo: '(−) Deduções', grupo: 'Deduções da Receita', sinal: '−',
    fonte: 'DFC (principal) / Omie recortado (confronto)', fonteDoValor: 'dfc' },
  { id: 'dre-receita-liquida', chave: 'receitaLiquida', rotulo: '(=) Receita líquida', total: true,
    fonte: 'mistura as duas, calculado', fonteDoValor: 'mistura' },
  { id: 'dre-custos-de-vendas', chave: 'custosDeVendas', rotulo: '(−) Custos de vendas', grupo: 'Custos de Vendas', sinal: '−',
    fonte: 'DFC (principal) / Omie recortado (confronto)', fonteDoValor: 'dfc' },
  { id: 'dre-lucro-bruto', chave: 'lucroBruto', rotulo: '(=) Lucro bruto', total: true,
    fonte: 'mistura as duas, calculado', fonteDoValor: 'mistura' },
  { id: 'dre-despesas-gerais', chave: 'despesasGerais', rotulo: '(−) Despesas gerais', grupo: 'Despesas Gerais', sinal: '−',
    fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)', fonteDoValor: 'omie' },
  { id: 'dre-ebitda', chave: 'ebitda', rotulo: '(=) EBITDA', total: true,
    fonte: 'Omie recortado, calculado', fonteDoValor: 'mistura' },
  { id: 'dre-resultado-financeiro', chave: 'resultadoFinanceiro', rotulo: '(+/−) Resultado financeiro', grupo: 'Resultado Financeiro', sinal: '+/−',
    fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)', fonteDoValor: 'omie' },
  { id: 'dre-impostos', chave: 'impostos', rotulo: '(−) Impostos pagos (guias)', grupo: 'Impostos', sinal: '−',
    fonte: 'DFC, guias pagas (principal) / Omie recortado (confronto)', fonteDoValor: 'dfc' },
  { id: 'dre-lucro-liquido', chave: 'lucroLiquido', rotulo: '(=) Lucro líquido', total: true,
    fonte: 'Omie recortado, calculado', fonteDoValor: 'mistura' },
  { id: 'dre-sem-conta', chave: 'semConta', rotulo: '(=) sem conta', foraDoTotal: true,
    fonte: 'Omie recortado', fonteDoValor: 'omie',
    nota: 'fora dos totalizadores do DRE, de propósito: é o alarme de lançamento em categoria sem conta do DRE (decisão do dono, 24/09/2026)' },
];

const CARTOES_DO_TOPO = [
  { id: 'receita-total', chave: 'receitaTotal', nome: 'Receita total', fonteDoValor: 'dfc', fonte: 'DFC (principal) / Omie recortado (confronto)' },
  { id: 'custos-e-despesas', chave: 'custosEDespesas', nome: 'Custos e despesas', negativo: true, fonteDoValor: 'dfc', fonte: 'DFC (principal) / Omie recortado (confronto)' },
  { id: 'cartao-ebitda', chave: 'ebitda', nome: 'EBITDA', fonteDoValor: 'mistura', fonte: 'Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto)' },
  { id: 'cartao-lucro-liquido', chave: 'lucroLiquido', nome: 'Lucro líquido', fonteDoValor: 'mistura', fonte: 'Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto)' },
  { id: 'cartao-margem', chave: 'margem', nome: 'Margem de lucro', tipo: 'percentual', fonteDoValor: 'mistura', fonte: 'Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto)' },
];

// ANÁLISE HORIZONTAL: a variação da coluna contra o mês anterior. Sem mês anterior, ou com ele zerado, não há AH —
// devolve `null`, e a tela mostra "—" em vez de inventar 100%.
const ah = (atual, anterior) => (anterior === null || anterior === undefined || anterior === 0 ? null
  : (atual - anterior) / Math.abs(anterior));

// ANÁLISE VERTICAL: a linha como fatia da receita líquida do próprio mês.
const av = (valor, base) => (base ? valor / base : null);

// ================================================================ vários meses somados num só
//
// O QUE SE SOMA E O QUE NÃO SE SOMA. Valor de linha soma: o EBITDA de maio mais o de junho é o EBITDA dos dois meses.
// A MARGEM não soma — ela é razão, e é refeita da soma (lucro líquido dos meses / receita bruta dos meses), nunca a
// média das margens. As CONTAGENS somam, uma por uma, porque cada uma conta lançamentos; as duas exceções são as
// contagens de CADASTRO — quantas contas o DRE tem e quantas totalizam —, que não têm mês: somá-las daria "duas vezes
// o cadastro" em dois meses. Essas ficam como estão e o indicador diz que o filtro de meses não as alcança.
const CONTAGEM_DE_CADASTRO = new Set(['contasDoDre', 'totalizadoras']);

const somarContagem = (xs) => (xs.every((x) => x === null || x === undefined) ? null
  : xs.reduce((s, x) => s + (x ?? 0), 0));

function somarMeses(colunas, molde) {
  const chavesDeValor = Object.keys(molde.valores);
  const valores = {};
  for (const c of chavesDeValor) valores[c] = colunas.reduce((s, x) => s + (x.valores[c] ?? 0), 0);
  valores.margem = valores.receitaBruta ? valores.lucroLiquido / valores.receitaBruta : null;
  const contagens = {};
  for (const id of Object.keys(molde.contagens)) {
    const lado = (l) => somarContagem(colunas.map((x) => x.contagens[id][l]));
    const extrasDoMolde = molde.contagens[id].extras;
    const extras = extrasDoMolde ? Object.fromEntries(Object.keys(extrasDoMolde).map((k) => [k,
      CONTAGEM_DE_CADASTRO.has(k)
        ? (colunas.length ? colunas[colunas.length - 1].contagens[id].extras[k] : extrasDoMolde[k])
        : somarContagem(colunas.map((x) => x.contagens[id].extras[k]))])) : undefined;
    contagens[id] = { dfc: lado('dfc'), omie: lado('omie'), ...(extras ? { extras } : {}) };
  }
  return {
    mes: colunas.length === 1 ? colunas[0].mes : null,
    cobertura: { dfc: somarContagem(colunas.map((x) => x.cobertura.dfc)) ?? 0, omie: somarContagem(colunas.map((x) => x.cobertura.omie)) ?? 0 },
    valores, contagens,
  };
}

// ================================================================ a Tela 2 inteira

async function calcularTela2({ raiz, ano, mes, fonte, filtro = {} }) {
  const { meses: fMeses } = filtroDaTela2(filtro);
  const OMIE = abrirCacheOmie({ raiz, ano });
  const { EMPRESAS, movimentos, categorias, contasDre } = OMIE;
  // O FILTRO DE EMPRESA: `ATIVAS` são as que entram na soma do lado do Omie — as duas, sem filtro.
  const { empresa } = filtroDeEmpresa(filtro, EMPRESAS);
  const ATIVAS = EMPRESAS.filter((emp) => empresa.pega(emp));
  const recorte = lerRecorte(raiz);
  const regras = criarRegras({ movimentos, categorias, recorte });
  const OUTRAS_RECEITAS = Object.fromEntries(EMPRESAS.map((emp) =>
    [emp, outrasReceitasDe(categorias, regras.eTransferencia, emp)]));

  // O DFC, um arquivo por mês. A série do ano não é pedida aqui — esta tela lê o `FLUXO DE CAIXA` de cada mês, que é
  // de onde saem as linhas de dedução, de custo e de guia.
  const dfcPorMes = new Map();
  let dfcMotivo = null, dfcArquivo = null;
  const mesesLidos = [];
  for (let m = 1; m <= 12; m++) {
    try {
      const r = await lerDfc({ fonte, ano, mes: m, comSerie: false });
      if (r.ok) {
        dfcPorMes.set(m, r.linhas);
        mesesLidos.push(m);
        if (m === mes) dfcArquivo = r.arquivo;
      } else if (m === mes) dfcMotivo = r.motivo;
    } catch (e) {
      if (m === mes) dfcMotivo = e.message;
    }
  }
  // O que vale para a tela é o mês escolhido: se ELE não foi lido, as linhas do DFC ficam vazias e a tela avisa.
  const dfcDoMes = dfcPorMes.has(mes);
  if (!dfcDoMes && !dfcMotivo) dfcMotivo = `o arquivo do mês ${String(mes).padStart(2, '0')} não foi lido`;

  const meses = [];
  for (let m = 1; m <= 12; m++) {
    meses.push(mesDoDre({
      ano, mes: m, EMPRESAS, ATIVAS, categorias, contasDre, regras, OUTRAS_RECEITAS,
      linhasDfc: dfcPorMes.get(m) ?? null,
    }));
  }
  // AS COLUNAS DO ANO: o mês precisa do arquivo do DFC lido E de alguma leitura de um dos dois lados. Um mês sem
  // planilha sairia com as linhas do DFC zeradas e estragaria o total e a análise horizontal do mês seguinte; um mês
  // vazio dos dois lados (outubro a dezembro de 2026, que ainda não aconteceram) seria coluna de zeros.
  //
  // JANEIRO A MARÇO FICAM FORA (decisão do dono, 27/09/2026): o recorte da MeuBESS quase não tem lançamento no Omie
  // nesses três meses, então os totalizadores da coluna misturariam um lado cheio (DFC) com outro quase vazio
  // (Omie) e não se leriam como DRE. A tela mostra a partir de abril; a nota fica em `app/dre/page.js`.
  const temColuna = (x) => x.mes >= 4 && dfcPorMes.has(x.mes) && (x.cobertura.dfc > 0 || x.cobertura.omie > 0);
  // E ENTÃO O FILTRO DE MESES, por cima: das colunas que existem, só as escolhidas.
  const colunas = meses.filter((x) => temColuna(x) && (!fMeses.ativo || fMeses.lista.includes(x.mes)));
  // MÊS PEDIDO QUE NÃO TEM COLUNA — a tela diz quais e por quê, em vez de calar. Um mês de jan a mar está fora por
  // decisão do dono; um mês sem planilha do DFC ou sem lançamento nenhum dos dois lados nunca teve coluna aqui.
  const pedidosSemColuna = fMeses.lista.filter((m) => !colunas.some((c) => c.mes === m)).map((m) => ({
    mes: m,
    motivo: m < 4 ? 'janeiro a março ficam fora desta tela (decisão do dono, 27/09/2026)'
      : (!dfcPorMes.has(m) ? 'a planilha do DFC deste mês não foi lida nesta rodada'
        : 'nenhum lançamento entrou neste mês, de nenhum dos dois lados'),
  }));

  // O FOCO DOS CARTÕES DO TOPO: sem filtro, o mês da URL, como sempre; com filtro, a soma dos meses escolhidos.
  const doMes = fMeses.ativo ? somarMeses(colunas, meses[mes - 1]) : meses[mes - 1];

  // A COLUNA "Total": a soma das colunas MOSTRADAS nas linhas de valor — o ano inteiro sem filtro, os meses escolhidos
  // com ele; a margem é refeita da soma, não é média de percentuais.
  const totalDoAno = {};
  for (const c of ['receitas', 'receitaBruta', 'deducoes', 'receitaLiquida', 'custosDeVendas', 'lucroBruto',
    'despesasGerais', 'ebitda', 'resultadoFinanceiro', 'impostos', 'lucroLiquido', 'semConta',
    'receitaTotal', 'custosEDespesas', 'vendaDeProdutos', 'outrasReceitas', 'financeiroR', 'financeiroP']) {
    totalDoAno[c] = somar(colunas.map((x) => x.valores[c]));
  }
  totalDoAno.margem = totalDoAno.receitaBruta ? totalDoAno.lucroLiquido / totalDoAno.receitaBruta : null;

  // ---------------------------------------------------------------- onde o filtro de empresa não alcança
  //
  // Sai da PRÓPRIA linha, pelo `fonteDoValor` dela: o que vem do DFC não se recorta por empresa (o de-para de `EMP.`
  // não fecha, ver `docs/fontes.md`), e a linha "(=)" que mistura as duas fontes fica com uma ponta filtrada e a outra
  // não. Só existe quando o filtro está ligado.
  const naoValeEmpresa = (i) => {
    if (!empresa.ativo) return [];
    if (i.fonteDoValor === 'dfc') {
      return [naoVale('empresa', 'o valor deste número e a contagem do DFC ao lado, que são do DFC', PORQUE_O_DFC_NAO_TEM_EMPRESA)];
    }
    if (i.fonteDoValor === 'mistura') {
      return [naoVale('empresa', 'a parte desta conta que vem do DFC',
        `ela soma e subtrai linhas de fonte DFC (deduções, custos de vendas e impostos pagos), e ${PORQUE_O_DFC_NAO_TEM_EMPRESA}`)];
    }
    return [];
  };

  // A TABELA, já com AH e AV por coluna.
  const tabela = LINHAS_DO_DRE.map((linha) => {
    const porMes = colunas.map((c, i) => ({
      mes: c.mes,
      valor: c.valores[linha.chave],
      ah: ah(c.valores[linha.chave], i > 0 ? colunas[i - 1].valores[linha.chave] : null),
      av: av(c.valores[linha.chave], c.valores.receitaLiquida),
    }));
    return {
      ...linha,
      porMes,
      total: totalDoAno[linha.chave],
      totalAv: av(totalDoAno[linha.chave], totalDoAno.receitaLiquida),
      // ONDE O FILTRO DE MESES NÃO ALCANÇA. Só uma linha tem número que não é de mês: "(=) Receita bruta" leva ao lado
      // quantas contas o DRE tem e quantas totalizam, que são contagens do cadastro `geral/dre` — o cadastro não tem
      // mês, e somá-lo em dois meses daria o dobro do cadastro.
      naoVale: [
        ...((fMeses.ativo && linha.id === 'dre-receita-bruta')
          ? [naoVale('meses', 'as duas contagens de cadastro ao lado desta linha (contas do DRE e quantas totalizam)',
            'elas saem de `geral/dre` → `ListarCadastroDRE`, que é cadastro e não tem mês: valem para o ano inteiro, e continuam como estão em qualquer escolha de meses')]
          : []),
        // As MESMAS duas contagens também não seguem a escolha de empresa: elas são o cadastro do DRE da empresa 1, e
        // as duas empresas têm as mesmas 28 contas (`docs/fontes.md`, "A soma das empresas 1 e 2").
        ...((empresa.ativo && linha.id === 'dre-receita-bruta')
          ? [naoVale('empresa', 'as duas contagens de cadastro ao lado desta linha (contas do DRE e quantas totalizam)',
            'elas são o cadastro `geral/dre` da empresa 1, e o cadastro das duas empresas tem as mesmas 28 contas (`docs/fontes.md`): a escolha de empresa não as muda')]
          : []),
        ...naoValeEmpresa(linha),
      ],
      detalhe: (linha.detalhe ?? []).map((d) => ({
        ...d,
        porMes: colunas.map((c, i) => ({
          mes: c.mes,
          valor: c.valores[d.chave],
          ah: ah(c.valores[d.chave], i > 0 ? colunas[i - 1].valores[d.chave] : null),
          av: av(c.valores[d.chave], c.valores.receitaLiquida),
        })),
        total: totalDoAno[d.chave],
        totalAv: av(totalDoAno[d.chave], totalDoAno.receitaLiquida),
      })),
      contagem: doMes.contagens[linha.id],
    };
  });

  // OS CARTÕES DO TOPO, com a fita dos doze meses ao lado do número, como na tela de referência.
  const cartoes = CARTOES_DO_TOPO.map((c) => ({
    id: c.id, nome: c.nome, fonte: c.fonte, tipo: c.tipo ?? 'dinheiro', negativo: Boolean(c.negativo),
    valor: doMes.valores[c.chave],
    serie: colunas.map((x) => ({ mes: x.mes, valor: x.valores[c.chave] ?? 0 })),
    contagem: doMes.contagens[c.id],
    naoVale: naoValeEmpresa(c),
  }));

  return {
    ano, mes, nomeDoMes: NOMES_DOS_MESES[mes],
    dfc: {
      ok: dfcDoMes,
      motivo: dfcDoMes ? null : dfcMotivo,
      arquivo: dfcArquivo,
      fonte: fonte.nome,
      mesesLidos,
    },
    cartoes, tabela,
    totalDoAno,
    cobertura: colunas.map((c) => ({ mes: c.mes, ...c.cobertura })),
    // O FILTRO, DE VOLTA PARA A TELA: quais meses têm coluna, quais foram escolhidos, e os que foram pedidos e não
    // existem aqui — com o motivo de cada um.
    filtros: {
      empresa: {
        opcoes: EMPRESAS,
        escolhidas: empresa.escolhidas,
        desconhecidos: empresa.desconhecidos,
        ativo: empresa.ativo,
        somadas: ATIVAS,
      },
      meses: {
        opcoes: meses.filter(temColuna).map((x) => x.mes),
        escolhidos: fMeses.lista,
        ativo: fMeses.ativo,
        semColuna: pedidosSemColuna,
        // Os cartões e a coluna "Total" somam estes meses; sem filtro, são todos os que a tela mostra.
        somados: colunas.map((c) => c.mes),
      },
    },
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela2, LINHAS_DO_DRE, CARTOES_DO_TOPO };
