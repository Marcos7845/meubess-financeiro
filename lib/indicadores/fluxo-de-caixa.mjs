// TELA 3 — FLUXO DE CAIXA (pedido do dono, 28/09/2026: a tela "Contas a Receber" passa a ser esta).
//
// A HISTÓRIA, em `docs/layout.md`: para o dono e o financeiro; a decisão é a estratégia de venda; a frase de 5
// segundos é "quanto entrou, quanto saiu e como vamos fechar o mês: com lucro ou prejuízo". As fontes, indicador por
// indicador, em `docs/fontes.md`, seção "Tela 3 — Fluxo de Caixa".
//
// QUASE NENHUM NÚMERO NASCE AQUI. Entrou, saiu, o saldo, o que falta pagar e a receita líquida são os
// MESMOS números da Tela 1 — este arquivo chama `calcularTela1` com o mesmo filtro e pega os cartões dela, e a receita
// líquida é a mesma conta do cartão "% D. Func. / Rec. Líquida". O que falta receber no mês é o cartão "Valor
// Pendente" da antiga Tela 3, pelo mesmo `calcularTela3`. Os números que NASCEM aqui são quatro, todos contas simples
// dos de cima e todos escritos em `docs/fontes.md`:
//
//   as despesas fixas         o `SUB 2` do DFC, pela lista que a gestora respondeu (`dados/despesas-fixas.json`);
//   o peso delas na receita   despesas fixas ÷ receita líquida do mês;
//   a projeção do mês         saldo do caixa + o que falta receber no mês − o que falta pagar no mês;
//   a média dos meses         a média dos meses anteriores do ano, para dizer se este mês ficou fora da curva — cada
//                             mês pela mesma conta dos cartões, lida do arquivo daquele mês.
//
// OS FILTROS DESTA TELA são o ano, o mês, a empresa e a chave "incluir dados do Omie" — os que ela divide com as outras
// duas. A empresa só alcança o lado do Omie (o que falta pagar e receber): o DFC não tem coluna de empresa que case
// com a filial do Omie (`docs/fontes.md`), e cada número de fonte DFC diz isso ao lado, como na Tela 1.

import { novaBase } from '../regras/base-local.mjs';
import { DFC_RECEITA, DFC_TRANSFERENCIA_RECEITA_SUB2, eDeducaoDfc } from '../regras/dfc.mjs';
import { lerDespesasFixas } from '../regras/despesas-fixas.mjs';
import { filtroDeEmpresa, filtroDoOmie, naoVale, PORQUE_O_DFC_NAO_TEM_EMPRESA } from '../regras/filtros.mjs';
import { calcularTela1 } from './tela-1.mjs';
import { calcularTela3 } from './tela-3.mjs';

const somar = (xs) => xs.reduce((s, x) => s + x, 0);
const modulo = (c) => Math.abs(c);

// A LINHA DO DFC COMO A TELA A MOSTRA NA "ORIGEM": o número da linha na aba `FLUXO DE CAIXA` do arquivo do mês, o
// dia, as duas classificações da própria planilha e o valor. É o bastante para achar a linha de volta na planilha.
const paraOrigem = (l) => ({ linha: l.linha, dia: l.dia, classe: l.classe, sub2: l.sub2, pagamento: l.pagamento, valor: modulo(l.valor) });

// A RECEITA LÍQUIDA DO MÊS NO DFC — a MESMA conta do cartão "% D. Func. / Rec. Líquida" da Tela 1: as linhas de
// receita (`SUB 2` em `DFC_RECEITA`) menos as de dedução (`DEVOLUCÃO` / `ESTORNO`).
function receitaLiquidaDoDfc(linhas) {
  const receita = linhas.filter((l) => l.natureza === 'R' && DFC_RECEITA.includes(l.sub2));
  const deducoes = linhas.filter(eDeducaoDfc);
  return { valor: somar(receita.map((l) => l.valor)) - somar(deducoes.map((l) => modulo(l.valor))), receita, deducoes };
}

// FORA DA CURVA: o mês se afasta da média dos anteriores mais que um desvio-padrão deles. Só com três meses
// anteriores ou mais — com menos, a média não diz nada e a tela não julga.
function comparar(valor, anteriores) {
  if (anteriores.length < 3) return { media: anteriores.length ? somar(anteriores) / anteriores.length : null, desvio: null, fora: null, n: anteriores.length };
  const media = somar(anteriores) / anteriores.length;
  const desvio = Math.sqrt(somar(anteriores.map((x) => (x - media) ** 2)) / anteriores.length);
  return { media, desvio, fora: desvio > 0 ? Math.abs(valor - media) > desvio : valor !== media, acima: valor > media, n: anteriores.length };
}

async function calcularFluxoDeCaixa({ raiz, ano, mes, fonte, filtro = {}, base = null }) {
  const BASE = base ?? novaBase({ raiz, ano, fonte });
  // O MESMO FILTRO NAS DUAS TELAS DE ONDE OS NÚMEROS VÊM: só a empresa e a chave do Omie, que são os desta tela.
  const comum = { empresa: filtro.empresa ?? [], omie: filtro.omie ?? [] };
  const t1 = await calcularTela1({ raiz, ano, mes, fonte, filtro: comum, base: BASE });
  const t3 = await calcularTela3({ raiz, ano, mes, fonte, filtro: comum, base: BASE });
  const DFC = await BASE.dfc({ mes, comSerie: true });
  const linhas = DFC.ok ? DFC.linhas : [];

  const OMIE = BASE.cacheOmie();
  const { empresa } = filtroDeEmpresa(filtro, OMIE.EMPRESAS);
  const { omie: chaveOmie } = filtroDoOmie(filtro);
  const doDfcEmpresa = (oQue) => (empresa.ativo ? [naoVale('empresa', oQue, PORQUE_O_DFC_NAO_TEM_EMPRESA)] : []);

  const c1 = (id) => t1.cartoes.find((c) => c.id === id);
  const c3 = (id) => t3.cartoes.find((c) => c.id === id);

  // ---------------------------------------------------------------- entrou, saiu e o saldo: os cartões da Tela 1
  const receitas = c1('receitas'), despesas = c1('despesas'), saldo = c1('saldo'), pendentes = c1('despesas-pendentes');
  const linhasEntrou = linhas.filter((l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2));
  const linhasSaiu = linhas.filter((l) => l.natureza === 'P');
  const linhasTransferencia = linhas.filter((l) => l.natureza === 'R' && DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2));
  const transferencias = somar(linhasTransferencia.map((l) => l.valor));

  // ---------------------------------------------------------------- as despesas fixas
  const lista = lerDespesasFixas(raiz);
  const eFixa = (l) => l.natureza === 'P' && lista.fixas.has(l.sub2);
  const linhasFixas = lista.respondido ? linhas.filter(eFixa) : [];
  const porConta = new Map();
  for (const l of linhasFixas) {
    const g = porConta.get(l.sub2) ?? { conta: l.sub2, valor: 0, n: 0 };
    g.valor += modulo(l.valor); g.n += 1;
    porConta.set(l.sub2, g);
  }
  const fixasPorConta = [...porConta.values()].sort((a, b) => b.valor - a.valor);
  const totalFixas = somar(fixasPorConta.map((g) => g.valor));
  const rl = receitaLiquidaDoDfc(linhas);

  // ---------------------------------------------------------------- o que falta pagar e receber no mês (Omie)
  const aPagar = pendentes.valor;                     // Tela 1, "Desp. Pendentes": a pagar, vencendo no mês, sem baixa
  const aReceber = c3('valor-pendente');              // antiga Tela 3: a receber, vencendo no mês, em aberto
  const vencidoAReceber = c3('valor-vencido');        // a receber que já venceu: NÃO entra na projeção
  const temOmie = chaveOmie.ligado && aPagar !== null && aReceber.valor !== null;
  const projecao = DFC.ok && temOmie ? saldo.valor + aReceber.valor - aPagar : null;

  // ---------------------------------------------------------------- o mês contra os anteriores
  //
  // A SÉRIE SAI DAS MESMAS LINHAS DOS CARTÕES (correção de 28/09/2026, depois de o dono ver o gráfico "não mudar" e
  // mostrar número "pouco confiável"). A primeira versão desenhava o bloco pronto `Entradas`/`Gastos` da aba do mês —
  // o do gráfico da Tela 1 —, que é a conta da própria planilha, dia a dia, e não as linhas baixadas do `FLUXO DE
  // CAIXA` que os cartões somam: a coluna do mês não batia com os cartões logo acima dela. Agora cada mês é a MESMA
  // conta dos cartões — entrou (fora a transferência), saiu e o saldo —, lida do arquivo daquele mês. E a série vai do
  // janeiro ATÉ O MÊS ESCOLHIDO: trocar o mês muda o gráfico, e o que vem depois dele não aparece como se já tivesse
  // acontecido.
  const meses = [];
  for (let m = 1; m <= mes; m++) {
    const r = await BASE.mes(m);
    if (!r.ok) { meses.push({ mes: m, ok: false, motivo: r.motivo ?? 'sem a planilha do mês' }); continue; }
    const ls = r.linhas;
    const entradas = somar(ls.filter((l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2)).map((l) => l.valor));
    const gastos = somar(ls.filter((l) => l.natureza === 'P').map((l) => modulo(l.valor)));
    meses.push({
      mes: m, ok: true, entradas, gastos, saldo: somar(ls.map((l) => l.valor)), linhas: ls.length,
      fixas: lista.respondido ? somar(ls.filter(eFixa).map((l) => modulo(l.valor))) : null,
    });
  }
  const mesesOk = meses.filter((m) => m.ok);
  const doMes = mesesOk.find((m) => m.mes === mes) ?? null;
  const anteriores = mesesOk.filter((m) => m.mes < mes);
  const comparacao = doMes ? {
    entradas: comparar(doMes.entradas, anteriores.map((m) => m.entradas)),
    gastos: comparar(doMes.gastos, anteriores.map((m) => m.gastos)),
    saldo: comparar(doMes.saldo, anteriores.map((m) => m.saldo)),
    ...(lista.respondido ? { fixas: comparar(doMes.fixas ?? 0, anteriores.filter((m) => m.fixas !== null).map((m) => m.fixas)) } : {}),
  } : null;
  const hoje = new Date();
  const mesEmAndamento = hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes;

  // ---------------------------------------------------------------- os cartões desta tela, cada um com a origem
  const arquivo = DFC.arquivo ?? '(arquivo do mês não achado)';
  const doFluxo = `aba \`FLUXO DE CAIXA\` do arquivo ${arquivo}, linhas baixadas (\`PAGAMENTO\` diferente de A PAGAR / A RECEBER) com \`DIA PG\` no mês`;
  const cartoes = [
    { ...receitas, id: 'entrou', nome: 'Entrou',
      origem: `DFC — ${doFluxo}, coluna \`ENTRADA\`, fora as de \`SUB 2\` = TRANSFERENCIAS BANCARIAS - RECEITA (decisão do dono, 27/09/2026). É o cartão "Receitas" da Tela 1.`,
      linhas: linhasEntrou.map(paraOrigem) },
    { ...despesas, id: 'saiu', nome: 'Saiu',
      origem: `DFC — ${doFluxo}, coluna \`SAIDA\`, todas as classificações. É o cartão "Despesas" da Tela 1.`,
      linhas: linhasSaiu.map(paraOrigem) },
    { ...saldo, id: 'saldo', nome: 'Saldo do caixa no mês',
      origem: `DFC — ${doFluxo}: \`ENTRADA\` menos \`SAIDA\`, todas as linhas. É o cartão "Saldo" da Tela 1. Difere de "entrou − saiu" pelas transferências entre contas que entraram (${linhasTransferencia.length} linha(s)), que o "Entrou" não conta como receita.`,
      extras: { transferencias } },
    { ...pendentes, id: 'a-pagar', nome: 'Ainda a pagar no mês',
      origem: 'Omie — `financas/mf`, títulos a pagar (`cTpLancamento: "CP"`) com vencimento no mês e sem baixa (`cLiquidado = "N"`), soma do valor em aberto, no recorte da MeuBESS. É o cartão "Desp. Pendentes" da Tela 1.' },
    { ...aReceber, id: 'a-receber', nome: 'Ainda a receber no mês',
      origem: 'Omie — `financas/pesquisartitulos`, títulos a receber com vencimento no mês, faixa EM ABERTO (ainda não venceram), soma do valor em aberto. Os já vencidos ficam fora da projeção e aparecem embaixo. É o cartão "Valor Pendente" da antiga tela Contas a Receber.' },
    { id: 'projecao', nome: 'Projeção do mês', tipo: 'dinheiro', negativo: false,
      fonte: 'conta desta tela: saldo (DFC) + a receber (Omie) − a pagar (Omie)',
      valor: projecao,
      contagem: { dfc: saldo.contagem.dfc, omie: temOmie ? (pendentes.contagem.omie ?? 0) + (aReceber.contagem.omie ?? 0) : null },
      origem: 'Saldo do caixa no mês + ainda a receber no mês − ainda a pagar no mês. É uma PROJEÇÃO DE CAIXA, não o lucro contábil (esse é a Tela 2, DRE): mostra se, recebendo e pagando o que vence no mês, o caixa do mês fecha positivo ou negativo. O que já venceu e não foi recebido não entra.',
      naoVale: doDfcEmpresa('o saldo do caixa, a parte do DFC desta conta'),
      ...(temOmie ? {} : { semOmie: [{ oQue: 'não há projeção', porque: 'o que falta pagar e receber no mês é do Omie, e a chave está desligada' }] }) },
    { id: 'fixas', nome: 'Despesas fixas pagas', tipo: 'dinheiro',
      fonte: 'DFC, pelas contas que a gestora marcou como fixas',
      valor: lista.respondido ? totalFixas : null,
      contagem: { dfc: lista.respondido ? linhasFixas.length : null, omie: null },
      origem: `DFC — ${doFluxo}, coluna \`SAIDA\`, só as linhas cujo \`SUB 2\` a gestora marcou como Fixa em \`dados/despesas-fixas.json\` (${lista.fixas.size} contas${lista.respondidoEm ? `, respondido em ${lista.respondidoEm}` : ''}).`,
      naoVale: doDfcEmpresa('o valor e a contagem do DFC deste cartão'),
      avisos: lista.respondido ? [] : ['a classificação de despesa fixa ainda não foi respondida pela gestora (`docs/despesas-fixas-para-classificar.xlsx`): sem ela, este cartão não tem número.'],
      linhas: linhasFixas.map(paraOrigem) },
    { id: 'peso-fixas', nome: 'Fixas / receita líquida', tipo: 'percentual',
      fonte: 'DFC nas duas pontas',
      valor: lista.respondido && rl.valor ? totalFixas / rl.valor : null,
      contagem: { dfc: lista.respondido ? linhasFixas.length : null, omie: null },
      origem: `Despesas fixas pagas ÷ receita líquida do mês no DFC. A receita líquida é a mesma conta do cartão "% D. Func. / Rec. Líquida" da Tela 1: linhas de \`SUB 2\` ${DFC_RECEITA.join(', ')} (${rl.receita.length}) menos as de dedução, \`SUB 2\` DEVOLUCÃO ou \`CLASS. CONTABIL\` ESTORNO (${rl.deducoes.length}).`,
      naoVale: doDfcEmpresa('as duas pontas desta razão, que são do DFC'),
      avisos: lista.respondido ? [] : ['sem a classificação da gestora não há despesa fixa para dividir.'],
      extras: { receitaLiquida: rl.valor } },
  ];

  // A CHAVE DO OMIE DESLIGADA: os dois cartões do Omie já chegam de `calcularTela1` / `calcularTela3` sem valor e com a
  // frase de `semOmie`; os de fonte DFC seguem inteiros, como na Tela 1.
  return {
    ano, mes, mesEmAndamento,
    dfc: { ...t1.dfc },
    cartoes,
    vencidoAReceber: { valor: vencidoAReceber.valor, contagem: vencidoAReceber.contagem },
    fixas: { respondido: lista.respondido, respondidoEm: lista.respondidoEm, contas: lista.fixas.size, porConta: fixasPorConta, total: totalFixas },
    serie: {
      meses: mesesOk, semPlanilha: meses.filter((m) => !m.ok).map((m) => ({ mes: m.mes, motivo: m.motivo })), comparacao,
      fonte: 'DFC — as linhas baixadas da aba `FLUXO DE CAIXA` do arquivo de cada mês, de janeiro ao mês desta tela, pela mesma conta dos cartões: entrou (fora a transferência entre contas), saiu e o saldo',
    },
    filtros: { empresa: t1.filtros.empresa, omie: t1.filtros.omie },
    lidoEm: new Date().toISOString(),
  };
}

export { calcularFluxoDeCaixa };
