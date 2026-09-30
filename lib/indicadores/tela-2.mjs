// TELA 2 — DRE GERENCIAL (REGIME DE CAIXA), POR MÊS. Os 17 indicadores de `docs/fontes.md`: 5 cartões e 12 linhas da
// tabela do DRE — e, desde 29/09/2026, os 5 do bloco "Compromissos", abaixo da tabela (o quinto, as provisões por
// projeto da aba `PROVISÃO` do DFC, entrou no fim do mesmo dia).
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
//
// O FILTRO DE CONTA BANCÁRIA (decisão do dono, 27/09/2026), o segundo que atravessa as três telas. Ele é o `nCodCC` do
// lançamento, escolhido pelas contas da MeuBESS de `dados/contas-correntes-por-negocio.json` e juntando as duas
// empresas pelo `dito_como` do dono. Aqui ele entra pelo MESMO gancho `linha` de `lib/regras/movimentos.mjs` que o
// centro de custo usa na Tela 1: um predicado a mais em cada `contar`, e nenhuma regra nova.
//
// ONDE ELE NÃO VALE: exatamente nos mesmos lugares em que o de empresa não vale — nas linhas e nos cartões de fonte
// DFC. A planilha TEM uma coluna `BANCO`, mas os rótulos dela não são as contas do Omie: o cruzamento de 27/09/2026
// (`scripts/de-para-conta-dfc.mjs`) casou o rótulo `ITAU` com quatro contas diferentes. A frase é a mesma nas três
// telas, e mora em `lib/regras/filtros.mjs`.

// DE ONDE VÊM AS FONTES: DA BASE LOCAL (decisão do dono, 27/09/2026, "cada clique num filtro demora uma eternidade").
// O cache do Omie, o recorte da MeuBESS e as doze planilhas do DFC não são lidos aqui a cada cálculo: quem lê é
// `lib/regras/base-local.mjs`, uma vez por ano pedido, e `lib/dados.mjs` guarda essa base e a renova na abertura, na
// virada da hora e no "atualizar agora". O `base` chega por parâmetro; sem ele — como nos scripts da conferência, que
// rodam uma vez e saem — uma base nova é montada aqui mesmo, e a leitura é a de sempre. O filtro não muda nada do que
// se lê: ele recorta DEPOIS, e é por isso que a base pode ser a mesma para todas as combinações de filtro da Tela 2.

import { novaBase } from '../regras/base-local.mjs';
import { criarRegras, valorOmie } from '../regras/movimentos.mjs';
import { noMesDe, NOMES_DOS_MESES } from '../regras/periodo.mjs';
import { fluxoDaDivida, obrigacoesComClientes, saldoDosBancos, saldoDosContratos } from '../regras/passivo.mjs';
import { provisoesDoMes } from '../regras/provisao.mjs';
import {
  eDeducaoDfc,
  DFC_RECEITA, DFC_CUSTO_CLASSE, DFC_CUSTO_SUB2, DFC_IMPOSTO_SUB2,
} from '../regras/dfc.mjs';
import {
  VENDA_DE_PRODUTOS, CUSTO_DE_VENDAS, RESULTADO_FINANCEIRO, DEDUCOES, IMPOSTOS_GUIAS, FORA_DO_DRE,
} from '../regras/listas.mjs';
import {
  filtroDaTela2, filtroDeEmpresa, naoVale, PORQUE_O_DFC_NAO_TEM_EMPRESA,
  contasBancarias, filtroDeConta, PORQUE_O_DFC_NAO_TEM_CONTA,
  filtroDoOmie, contagemSemOmie, semOmie,
} from '../regras/filtros.mjs';

const naLista = (lista) => (cod) => lista.includes(cod);
const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// No DFC a saída já vem negativa; a tabela do DRE mostra o que se subtrai como número positivo.
const modulo = (c) => Math.abs(c);
const valorDe = (b) => somar(b.todos.map(valorOmie));

// A DIVISÃO DA LINHA "(+) Receitas" (decisão do dono, 25/09/2026): venda de produtos são três códigos; outras
// receitas é todo o resto com `conta_receita = "S"` e `totalizadora = "N"`, fora as de transferência e fora as que
// ficam fora do DRE — o Recebimento de Empréstimo Intercompany (`1.04.99`) saiu daqui em 29/09/2026, "como a regra de
// intercompany já manda". É a mesma derivação que `scripts/numeros-das-telas.mjs` faz, a partir do mesmo cadastro.
function outrasReceitasDe(categorias, eTransferencia, emp) {
  return [...categorias[emp].values()]
    .filter((c) => c.conta_receita === 'S' && c.totalizadora === 'N'
      && !eTransferencia(emp, c.codigo) && !VENDA_DE_PRODUTOS.includes(String(c.codigo))
      && !FORA_DO_DRE[emp].includes(String(c.codigo)))
    .map((c) => String(c.codigo));
}

// ================================================================ um mês do DRE
//
// Devolve, para um mês: o valor de cada linha (em centavos) e a contagem de cada indicador, dos dois lados.

// O BALDE VAZIO — o que uma empresa que o filtro de empresa deixou de fora devolve. Assim toda soma e toda contagem
// abaixo continua escrita do mesmo jeito, com as duas empresas: a que ficou fora entra com zero, e nenhuma linha
// precisa saber que existe filtro. Sem filtro, nenhuma empresa é vazia e a tela é a de sempre.
const BALDE_VAZIO = { titulos: new Map(), baixas: new Map(), avulsos: new Map(), total: 0, todos: [] };

function mesDoDre({ ano, mes, EMPRESAS, ATIVAS, categorias, contasDre, regras, OUTRAS_RECEITAS, linhasDfc, daConta }) {
  const noMes = noMesDe(ano, mes);
  const { contar, base } = regras;
  const naSoma = (emp) => ATIVAS.includes(String(emp));
  // O FILTRO DE CONTA, como um predicado a mais em cada `contar` — o mesmo gancho `linha` que a Tela 1 usa. Sem
  // filtro ele é `null`, e toda contagem abaixo é a de sempre.
  const linha = (emp) => daConta(emp);

  // Os três baldes do mês, por natureza — a base do lado do Omie, a mesma da conferência e da Tela 1.
  const R = {}, P = {};
  for (const emp of EMPRESAS) {
    R[emp] = naSoma(emp) ? contar(emp, noMes, 'R', { linha: linha(emp) }) : BALDE_VAZIO;
    P[emp] = naSoma(emp) ? contar(emp, noMes, 'P', { linha: linha(emp) }) : BALDE_VAZIO;
  }
  const totalR = R[1].total + R[2].total, totalP = P[1].total + P[2].total;

  // (+) Receitas, pela categoria do lançamento.
  const venda = {}, outras = {};
  for (const emp of EMPRESAS) {
    venda[emp] = naSoma(emp) ? contar(emp, noMes, 'R', { categoria: naLista(VENDA_DE_PRODUTOS), linha: linha(emp) }) : BALDE_VAZIO;
    outras[emp] = naSoma(emp) ? contar(emp, noMes, 'R', { categoria: naLista(OUTRAS_RECEITAS[emp]), linha: linha(emp) }) : BALDE_VAZIO;
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
    ded[emp] = contar(emp, noMes, 'P', { categoria: naLista(DEDUCOES[emp]), comTransferencia: false, linha: linha(emp) });
    oper13[emp] = base(emp, noMes).linhas.filter((d) => String(d.cOperacao ?? '') === '13'
      && (!linha(emp) || linha(emp)(d)));
    cv[emp] = contar(emp, noMes, 'P', { categoria: naLista(CUSTO_DE_VENDAS[emp]), linha: linha(emp) });
    dg[emp] = contar(emp, noMes, 'P', {
      categoria: (cod) => categorias[emp].get(cod)?.conta_despesa === 'S'
        && !CUSTO_DE_VENDAS[emp].includes(cod) && !RESULTADO_FINANCEIRO[emp].includes(cod) && !FORA_DO_DRE[emp].includes(cod),
      linha: linha(emp),
    });
    fin[emp] = {
      R: contar(emp, noMes, 'R', { categoria: naLista(RESULTADO_FINANCEIRO[emp]), linha: linha(emp) }),
      P: contar(emp, noMes, 'P', { categoria: naLista(RESULTADO_FINANCEIRO[emp]), linha: linha(emp) }),
    };
    imp[emp] = contar(emp, noMes, 'P', { categoria: naLista(IMPOSTOS_GUIAS[emp]), comTransferencia: false, linha: linha(emp) });
    sc[emp] = {
      R: contar(emp, noMes, 'R', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre, linha: linha(emp) }),
      P: contar(emp, noMes, 'P', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre, linha: linha(emp) }),
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

// ================================================================ a chave "incluir dados do Omie", desligada
//
// QUEM DESTA TELA PRECISA DO OMIE, e quem não precisa: é a própria `fonteDoValor` de cada linha e de cada cartão que
// diz, e não uma lista à parte que pudesse desencontrar. São três valores, e só um deles sobrevive sem o Omie:
//
//   `dfc`       o valor sai da planilha — "(−) Deduções", "(−) Custos de vendas", "(−) Impostos pagos (guias)" e os
//               dois primeiros cartões do topo ("Receita total" e "Custos e despesas"). FICAM, inteiros.
//   `omie`      o valor sai do Omie recortado — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais",
//               "(+/−) Resultado financeiro" e "(=) sem conta". SAEM.
//   `mistura`   a linha é aritmética das de cima e soma as duas fontes — "(=) Receita líquida", "(=) Lucro bruto",
//               "(=) EBITDA", "(=) Lucro líquido" e os três últimos cartões. SAEM TAMBÉM, e este é o ponto: sem uma
//               das duas pontas a conta não fecha, e escrever só a ponta do DFC seria um EBITDA que não é o EBITDA.
//
// E A ANÁLISE VERTICAL SAI INTEIRA, de todas as linhas — inclusive das de fonte DFC. Ela é a linha sobre a RECEITA
// LÍQUIDA do mês, e a receita líquida é `mistura`: sem o Omie não há denominador. A análise horizontal de uma linha
// de fonte DFC, essa, continua — ela compara o DFC com o DFC.
const PRECISA_DO_OMIE = (i) => i.fonteDoValor !== 'dfc';
// As chaves de `valores` que continuam existindo sem o Omie: as cinco de fonte DFC, e nenhuma a mais. As outras —
// inclusive as duas do detalhe de "(+) Receitas" e as duas pontas do resultado financeiro — saem.
const SO_DO_DFC = new Set(['deducoes', 'custosDeVendas', 'impostos', 'receitaTotal', 'custosEDespesas']);
// A frase que cada linha e cada cartão de fonte Omie escreve no lugar do número, pela fonte que ela tem.
const SEM_OMIE_DA_FONTE = {
  omie: semOmie('esta linha não tem número',
    'a fonte principal dela é o Omie recortado da MeuBESS — os lançamentos de caixa por categoria —, e o DFC não classifica por `cCodCateg`: não há de onde tirar este número sem o Omie'),
  mistura: semOmie('esta conta não fecha',
    'ela soma e subtrai as DUAS fontes: as linhas de fonte DFC (deduções, custos de vendas e impostos pagos) e as de fonte Omie ("(+) Receitas" e "(−) Despesas gerais"). Sem uma das pontas o resultado não é o resultado, e escrever só a metade do DFC seria pior que não escrever nada'),
};

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

// ================================================================ o bloco "Compromissos"
//
// CINCO NÚMEROS, cada um com os lançamentos de que saiu (a tela os abre no clique). A CONTAGEM de cada um vai na mesma
// forma das linhas do DRE, e é por ela que `scripts/conferir-telas.mjs` o compara com `docs/conferencia.md`.
//
// O QUE O LANÇAMENTO LEVA PARA O NAVEGADOR: só o que a tela mostra. O registro cru do Omie fica aqui — ele traz CPF/CNPJ
// do cliente, que nunca sai do servidor.
const PORQUE_SEM_FILTRO = 'o bloco é das duas empresas inteiras: o saldo devedor, os sinais em aberto e o saldo dos bancos são posições de fim de mês, e o DFC e a planilha de contratos não se repartem por empresa nem pela conta do Omie. Limpe os filtros de empresa e de conta para ver os números';

async function blocoDosCompromissos({ BASE, OMIE, regras, ano, mes, EMPRESAS, linhasDfc, lucroDoMes, filtrado, chaveOmie }) {
  const { categorias, titulosR, pedidos, clientes } = OMIE;
  const noMes = noMesDe(ano, mes);
  const r = await BASE.dfc({ mes }).catch(() => ({ ok: false }));
  const fluxo = fluxoDaDivida({ EMPRESAS, contar: regras.contar, noMes, linhasDfc, categorias });
  const obrig = obrigacoesComClientes({ EMPRESAS, titulosR, pedidos, recorte: BASE.recorte(), ano, mes });
  const bancos = saldoDosBancos(r.ok ? r.saldosPorBanco : null);
  const corte = { a: ano, m: mes, d: new Date(Date.UTC(ano, mes, 0)).getUTCDate() };
  const contratos = saldoDosContratos(await BASE.contratos(), corte);
  const nContratos = contratos.ok ? contratos.porContrato.length : 0;
  // AS PROVISÕES POR PROJETO: a aba `PROVISÃO` do arquivo do mês, lida junto com o `FLUXO DE CAIXA` (`provisao.mjs`).
  const prov = provisoesDoMes(r.ok ? r.provisao : { ok: false, motivo: r.motivo ?? 'o arquivo do DFC deste mês não foi lido' });

  const lucro = lucroDoMes.valores.lucroLiquido;
  const totalOmie = lucroDoMes.contagens['dre-lucro-liquido'].omie;
  const dividaLiquida = contratos.ok && bancos.ok ? contratos.saldo - bancos.valor : null;
  // O RESULTADO SEM DINHEIRO DE TERCEIROS (decisão do dono, 29/09/2026): o lucro menos a variação dos sinais em aberto.
  // Empréstimo, captação e amortização não entram — já estão fora do DRE, e tirá-los de novo somaria a amortização de
  // volta ao lucro. O repasse da aba `PROVISÃO` também não entra (resposta do dono, 29/09/2026): ele é obrigação com
  // clientes, mostrada ao lado dos sinais, e não mexe nesta conta.
  const semTerceiros = lucro - obrig.variacao;

  const nomeDoCliente = (s) => clientes?.[s.empresa]?.nomes?.get(s.nCodCliente) ?? null;
  const dataCurta = (d) => (d ? `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.a}` : null);
  const sinalNaTela = (s) => ({
    empresa: s.empresa, pedido: s.numeroPedido, titulo: s.nCodTitulo, cliente: nomeDoCliente(s),
    pago: dataCurta(s.pago), nf: s.dataDaNf ? dataCurta(s.dataDaNf) : (s.comNf ? 'com NF, sem data' : 'sem NF'),
    cancelado: s.pedidoCancelado ? 'pedido cancelado' : '', valor: s.valor,
  });
  const dividaNaTela = (g) => (l) => ({
    grupo: g.rotulo, fonte: l.fonte, dia: l.dia, empresa: l.empresa ?? '', categoria: l.categoria,
    descricao: l.descricao || '', titulo: l.titulo ?? '', quem: l.quem ?? '', linhaDfc: l.linhaDfc ?? null,
    codigo: l.codigo ?? null, valor: l.valor,
  });

  const itens = [
    {
      id: 'capital-de-giro', nome: 'Capital de giro tomado',
      fonte: 'fluxo do mês: Omie recortado + DFC por `SUB 2`, sem contar duas vezes o mesmo pagamento; saldo devedor: planilha de contratos',
      fonteDoValor: 'mistura',
      valor: contratos.ok ? contratos.saldo : null,
      semValor: contratos.ok ? null : `saldo: ${contratos.motivo}`,
      porque: contratos.ok ? null : contratos.porque,
      fluxo: fluxo.grupos.map((g) => ({ id: g.id, rotulo: g.rotulo, valor: g.total, lancamentos: g.lancamentos.map(dividaNaTela(g)) })),
      faixas: contratos.ok ? contratos.faixas : null,
      antecipacao: contratos.ok ? contratos.antecipacao : null,
      contratos: contratos.ok ? contratos.porContrato.map((c) => ({
        banco: c.banco, contrato: c.contrato, tipo: c.tipo, parcelas: c.parcelas, pagas: c.pagas, saldo: c.saldo,
        ate3: c.faixas.ate3, de3a12: c.faixas.de3a12, mais12: c.faixas.mais12,
      })) : [],
      recusados: contratos.ok ? contratos.recusados : [],
      arquivo: contratos.arquivo ?? null,
      contagem: {
        dfc: fluxo.contagem.dfc, omie: fluxo.contagem.omie,
        extras: {
          pares: fluxo.contagem.pares, lancamentos: fluxo.contagem.lancamentos,
          captado: fluxo.por.captado.contagem.lancamentos, amortizado: fluxo.por.amortizado.contagem.lancamentos,
          juros: fluxo.por.juros.contagem.lancamentos, iof: fluxo.por.iof.contagem.lancamentos, contratos: nContratos,
        },
      },
    },
    {
      id: 'obrigacoes-clientes', nome: 'Obrigações com clientes',
      fonte: 'Omie, sinais `ADVR` recebidos de pedidos ainda sem NF, pelo valor nominal; à parte, o repasse a clientes da aba `PROVISÃO` do DFC',
      fonteDoValor: 'omie',
      valor: obrig.saldo, inicio: obrig.saldoInicio, novos: obrig.novos, baixados: obrig.baixados, variacao: obrig.variacao,
      lancamentos: {
        saldo: obrig.lancamentos.saldo.map(sinalNaTela),
        novos: obrig.lancamentos.novos.map(sinalNaTela),
        baixados: obrig.lancamentos.baixados.map(sinalNaTela),
      },
      contagem: {
        dfc: null, omie: obrig.contagem.emAberto,
        extras: {
          noInicio: obrig.contagem.noInicio, novos: obrig.contagem.novos, baixados: obrig.contagem.baixados,
          pedidoCancelado: obrig.contagem.pedidoCancelado,
        },
      },
    },
    {
      id: 'divida-liquida', nome: 'Dívida líquida',
      fonte: 'capital de giro tomado (planilha de contratos) − saldo dos bancos da Tela 3 (DFC, `FLUXO DE CAIXA` do mês)',
      fonteDoValor: 'dfc',
      valor: dividaLiquida,
      semValor: dividaLiquida !== null ? null : (!contratos.ok ? contratos.motivo : 'o DFC do mês não foi lido, e sem ele não há saldo dos bancos'),
      porque: contratos.ok ? null : contratos.porque,
      saldoDevedor: contratos.ok ? contratos.saldo : null, saldoDosBancos: bancos.valor,
      bancos: bancos.porBanco.map((b) => ({ banco: b.banco || '(sem nome)', valor: b.final })),
      contagem: { dfc: bancos.bancos, omie: null, extras: { contratos: nContratos } },
    },
    {
      // AS RESPOSTAS DO DONO DE 29/09/2026 sobre a aba (`lib/regras/provisao.mjs`): frete, comissão, comissão head,
      // imposto (só a linha que bate com 9,25% do projeto) e compra, das linhas ainda não pagas. O REPASSE não soma
      // aqui: é obrigação com clientes, e vai em `repasse` para o quadro das obrigações — mas a contagem dele fica
      // nesta linha, porque sai da mesma aba e é conferida com ela.
      id: 'provisoes-projetos', nome: 'Provisões por projeto',
      fonte: 'DFC, aba `PROVISÃO` do arquivo do mês: frete, comissão, comissão head, imposto (quando bate com a alíquota sobre o valor do projeto) e compra de cada projeto vendido e ainda não pago',
      fonteDoValor: 'dfc',
      valor: prov.ok ? prov.total : null,
      semValor: prov.ok ? null : 'sem provisão por projeto neste mês',
      porque: prov.ok ? null : prov.motivo,
      data: prov.ok ? dataCurta(prov.data) : null,
      // "provisionado" enquanto a aba não tiver a coluna do pago; com ela, o que sobra é o que ainda não foi pago.
      rotuloDoTotal: prov.ok && prov.temPago ? 'provisionado e ainda não pago' : 'provisionado',
      porProvisao: prov.ok ? prov.porProvisao.map((p) => ({ id: p.id, rotulo: p.rotulo, valor: p.total, projetos: p.projetos })) : [],
      projetos: prov.ok ? prov.projetos.map((p) => ({
        linha: p.linha, projeto: p.projeto, cliente: p.cliente, consultor: p.consultor,
        frete: p.frete ?? 0, comissao: p.comissao ?? 0, comissaoHead: p.comissaoHead ?? 0,
        imposto: p.impostoNaSoma, compra: p.compra ?? 0, total: p.total,
      })) : [],
      impostoAConferir: prov.ok ? prov.impostoAConferir.map((p) => ({
        linha: p.linha, projeto: p.projeto, cliente: p.cliente, motivo: p.motivo,
        valorProjeto: p.valorProjeto ?? 0, imposto: p.imposto ?? 0, esperado: p.esperado,
      })) : [],
      pagos: prov.ok ? prov.pagos.length : 0,
      temPago: prov.ok ? prov.temPago : false,
      repasse: prov.ok ? prov.repasse : null,
      contagem: {
        // Mês cujo arquivo foi lido mas não tem o quadro (abril a agosto): 0 projetos, e o valor sem número.
        dfc: prov.ok ? prov.contagem.projetos : (r.ok ? 0 : null), omie: null,
        extras: prov.ok ? {
          frete: prov.contagem.frete, comissao: prov.contagem.comissao, comissaoHead: prov.contagem.comissaoHead,
          impostoBate: prov.contagem.impostoBate, impostoAConferir: prov.contagem.impostoAConferir,
          compra: prov.contagem.compra, repasse: prov.contagem.repasse, pagos: prov.contagem.pagos,
        } : {},
      },
    },
    {
      id: 'resultado-sem-terceiros', nome: 'Resultado sem dinheiro de terceiros',
      fonte: 'lucro líquido do DRE do mês − variação dos sinais em aberto (sinais recebidos de pedidos sem NF − sinais baixados)',
      fonteDoValor: 'mistura',
      valor: semTerceiros,
      partes: { lucro, variacaoObrigacoes: obrig.variacao, novos: obrig.novos, baixados: obrig.baixados },
      contagem: {
        dfc: null, omie: totalOmie,
        extras: { sinais: obrig.contagem.novos + obrig.contagem.baixados },
      },
    },
  ];

  // COM FILTRO DE EMPRESA OU DE CONTA, OU SEM O OMIE, o bloco não tem número: a contagem fica (é a do bloco inteiro), e
  // o valor dá lugar à frase. Sem filtro e com o Omie, que é o padrão, nada aqui muda.
  //
  // AS PROVISÕES POR PROJETO NÃO DEPENDEM DO OMIE: só o filtro de empresa ou de conta as tira (a aba não tem empresa
  // nem conta). Com a chave do Omie desligada elas continuam, inteiras — `livre` diz isso à tela.
  const semOmie = !chaveOmie.ligado;
  const SO_DO_DFC = ['provisoes-projetos'];
  const motivo = filtrado ? PORQUE_SEM_FILTRO
    : (semOmie ? 'a chave do Omie está desligada, e os outros quatro números do bloco saem sem valor, como sempre saíram (os sinais dos clientes, as parcelas no Omie e o lucro do DRE são do Omie); as provisões por projeto são só do DFC e continuam' : null);
  return {
    mes, nomeDoMes: NOMES_DOS_MESES[mes], ano, bloqueado: motivo,
    itens: motivo
      ? itens.map((i) => ((!filtrado && SO_DO_DFC.includes(i.id)) ? { ...i, livre: true }
        : { id: i.id, nome: i.nome, fonte: i.fonte, fonteDoValor: i.fonteDoValor, contagem: i.contagem, valor: null }))
      : itens.map((i) => (SO_DO_DFC.includes(i.id) ? { ...i, livre: true } : i)),
  };
}

// ================================================================ a Tela 2 inteira

async function calcularTela2({ raiz, ano, mes, fonte, filtro = {}, base = null }) {
  const { meses: fMeses } = filtroDaTela2(filtro);
  const BASE = base ?? novaBase({ raiz, ano, fonte });
  const OMIE = BASE.cacheOmie();
  const { EMPRESAS, movimentos, categorias, contasDre } = OMIE;
  // O FILTRO DE EMPRESA: `ATIVAS` são as que entram na soma do lado do Omie — as duas, sem filtro.
  const { empresa } = filtroDeEmpresa(filtro, EMPRESAS);
  const ATIVAS = EMPRESAS.filter((emp) => empresa.pega(emp));
  // O FILTRO DE CONTA BANCÁRIA, o segundo das três telas. As opções são as contas da MeuBESS, pelo nome que o dono
  // deu a cada uma; o predicado vai para o gancho `linha` de cada `contar`.
  const opcoesDeConta = contasBancarias(BASE.contas());
  const { conta } = filtroDeConta(filtro, opcoesDeConta);
  const daConta = (emp) => (conta.ativo ? (d) => conta.pega(emp, d.nCodCC) : null);
  // A CHAVE "INCLUIR DADOS DO OMIE" (decisão do dono, 28/09/2026). Ela não recorta nada e não muda leitura nenhuma:
  // os doze meses são calculados inteiros, como sempre, e o lado do Omie é apagado no FIM — ver `semOOmie`, embaixo
  // da tabela. Ligada, que é o padrão, ela não toca em linha nenhuma deste arquivo.
  const { omie: chaveOmie } = filtroDoOmie(filtro);
  const recorte = BASE.recorte();
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
      const r = await BASE.dfc({ mes: m, comSerie: false });
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
      linhasDfc: dfcPorMes.get(m) ?? null, daConta,
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

  // ---------------------------------------------------------------- o bloco "Compromissos" (29/09/2026)
  //
  // O PASSIVO, abaixo da tabela do DRE: as regras moram em `lib/regras/passivo.mjs`. É de UM mês — o da URL — e das
  // duas empresas inteiras: o saldo devedor, o saldo dos sinais e o saldo dos bancos são posições de fim de mês, e não
  // se somam entre meses nem se repartem pela conta do Omie.
  const compromissos = await blocoDosCompromissos({
    BASE, OMIE, regras, ano, mes, EMPRESAS,
    linhasDfc: dfcPorMes.get(mes) ?? null, lucroDoMes: meses[mes - 1],
    filtrado: empresa.ativo || conta.ativo, chaveOmie,
  });

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
  const semDfc = (filtroNome, porque) => (i) => {
    if (i.fonteDoValor === 'dfc') {
      return [naoVale(filtroNome, 'o valor deste número e a contagem do DFC ao lado, que são do DFC', porque)];
    }
    if (i.fonteDoValor === 'mistura') {
      return [naoVale(filtroNome, 'a parte desta conta que vem do DFC',
        `ela soma e subtrai linhas de fonte DFC (deduções, custos de vendas e impostos pagos), e ${porque}`)];
    }
    return [];
  };
  const doEmpresa = semDfc('empresa', PORQUE_O_DFC_NAO_TEM_EMPRESA);
  const doConta = semDfc('conta bancária', PORQUE_O_DFC_NAO_TEM_CONTA);
  const naoValeEmpresa = (i) => [
    ...(empresa.ativo ? doEmpresa(i) : []),
    ...(conta.ativo ? doConta(i) : []),
  ];

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
        // E a mesma ressalva para a conta bancária: cadastro do DRE não tem conta corrente nenhuma.
        ...((conta.ativo && linha.id === 'dre-receita-bruta')
          ? [naoVale('conta bancária', 'as duas contagens de cadastro ao lado desta linha (contas do DRE e quantas totalizam)',
            'elas saem de `geral/dre` → `ListarCadastroDRE`, que é o plano de contas do DRE e não tem conta corrente nenhuma: a escolha de conta não as muda')]
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
    // A FONTE DO VALOR VIAJA COM O CARTÃO desde 28/09/2026: é ela que diz se este número precisa do Omie, e é o mesmo
    // campo que as linhas da tabela já levavam. Sem ele aqui, os dois cartões de fonte DFC sairiam junto com os três
    // de mistura quando a chave do Omie fosse desligada.
    fonteDoValor: c.fonteDoValor,
    valor: doMes.valores[c.chave],
    serie: colunas.map((x) => ({ mes: x.mes, valor: x.valores[c.chave] ?? 0 })),
    contagem: doMes.contagens[c.id],
    naoVale: naoValeEmpresa(c),
  }));

  // ---------------------------------------------------------------- a chave "incluir dados do Omie", desligada
  //
  // A ÚLTIMA COISA QUE ACONTECE AQUI, e por isso ligada ela não muda nada: a conta inteira já foi feita acima, com os
  // mesmos filtros de sempre, e o que muda é só o que sai por esta porta. Quem precisa do Omie e quem não precisa é a
  // `fonteDoValor` de cada linha — ver `PRECISA_DO_OMIE`, lá em cima.
  //
  // O QUE SOBRA DESTA TELA SEM O OMIE: os dois primeiros cartões do topo ("Receita total" e "Custos e despesas") e
  // três linhas da tabela ("(−) Deduções", "(−) Custos de vendas" e "(−) Impostos pagos (guias)"), todos do DFC, com
  // o valor de cada mês e a coluna "Total" inteiros. Saem: as outras nove linhas, os três últimos cartões, a coluna
  // AV de TODAS as linhas — ela é a linha sobre a receita líquida, que é mistura — e a contagem "do Omie" de cada
  // indicador e de cada coluna, no pé da tabela.
  const semOOmie = (i) => {
    if (chaveOmie.ligado) return i;
    const semValor = PRECISA_DO_OMIE(i);
    const apagarPonto = (p) => ({ ...p, ...(semValor ? { valor: null, ah: null } : {}), av: null });
    return {
      ...i,
      contagem: contagemSemOmie(i.contagem),
      ...(i.porMes ? { porMes: i.porMes.map(apagarPonto) } : {}),
      ...(i.detalhe ? {
        detalhe: i.detalhe.map((d) => ({
          ...d, porMes: d.porMes.map(apagarPonto), ...(semValor ? { total: null } : {}), totalAv: null,
        })),
      } : {}),
      ...(i.serie && semValor ? { serie: [] } : {}),
      ...(semValor ? { valor: null, total: null, semOmie: [SEM_OMIE_DA_FONTE[i.fonteDoValor]] } : {}),
      ...('totalAv' in i ? { totalAv: null } : {}),
    };
  };
  // A COLUNA "Total" da tabela e os números da frase de 5 segundos: as cinco chaves de fonte DFC ficam; o resto sai.
  const totalSemOmie = chaveOmie.ligado ? totalDoAno
    : Object.fromEntries(Object.entries(totalDoAno).map(([k, v]) => [k, SO_DO_DFC.has(k) ? v : null]));

  return {
    ano, mes, nomeDoMes: NOMES_DOS_MESES[mes],
    dfc: {
      ok: dfcDoMes,
      motivo: dfcDoMes ? null : dfcMotivo,
      arquivo: dfcArquivo,
      fonte: BASE.nomeDaFonte,
      mesesLidos,
    },
    cartoes: cartoes.map(semOOmie), tabela: tabela.map(semOOmie), compromissos,
    totalDoAno: totalSemOmie,
    cobertura: colunas.map((c) => ({
      mes: c.mes, dfc: c.cobertura.dfc, omie: chaveOmie.ligado ? c.cobertura.omie : null,
    })),
    // O FILTRO, DE VOLTA PARA A TELA: quais meses têm coluna, quais foram escolhidos, e os que foram pedidos e não
    // existem aqui — com o motivo de cada um.
    filtros: {
      // A CHAVE "INCLUIR DADOS DO OMIE", de volta para a tela: ligada é o padrão, e ligada a tela é a de sempre.
      omie: { ligado: chaveOmie.ligado },
      empresa: {
        opcoes: EMPRESAS,
        escolhidas: empresa.escolhidas,
        desconhecidos: empresa.desconhecidos,
        ativo: empresa.ativo,
        somadas: ATIVAS,
      },
      conta: {
        opcoes: opcoesDeConta.map((c) => c.nome),
        escolhidas: conta.nomes,
        desconhecidos: conta.desconhecidos,
        ativo: conta.ativo,
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
