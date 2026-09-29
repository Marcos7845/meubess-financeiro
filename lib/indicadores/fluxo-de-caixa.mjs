// TELA 3 — FLUXO DE CAIXA (pedido do dono, 28/09/2026: a tela "Contas a Receber" passa a ser esta).
//
// A HISTÓRIA, em `docs/layout.md`: para o dono e o financeiro; a decisão é a estratégia de venda; a frase de 5
// segundos é "quanto entrou, quanto saiu e como vamos fechar o mês: com lucro ou prejuízo". As fontes, indicador por
// indicador, em `docs/fontes.md`, seção "Tela 3 — Fluxo de Caixa".
//
// QUASE NENHUM NÚMERO NASCE AQUI. Entrou, saiu, o que falta pagar e a receita líquida são os
// MESMOS números da Tela 1 — este arquivo chama `calcularTela1` com o mesmo filtro e pega os cartões dela, e a receita
// líquida é a mesma conta do cartão "% D. Func. / Rec. Líquida". O que falta receber no mês é o cartão "Valor
// Pendente" da antiga Tela 3, pelo mesmo `calcularTela3`. Os números que NASCEM aqui são quatro, todos contas simples
// dos de cima e todos escritos em `docs/fontes.md`:
//
//   as despesas fixas         o `SUB 2` do DFC, pela lista que a gestora respondeu (`dados/despesas-fixas.json`);
//   o peso delas na receita   despesas fixas ÷ receita líquida do mês;
//   o resultado do mês        entrou − saiu: positivo é lucro de caixa, negativo é prejuízo;
//   a projeção do mês         resultado + o que falta receber no mês − o que falta pagar, só com o mês em andamento;
//   a média dos meses         a média dos meses anteriores do ano, para dizer se este mês ficou fora da curva — cada
//                             mês pela mesma conta dos cartões, lida do arquivo daquele mês.
//
// OS FILTROS DESTA TELA são o ano, o mês, a empresa e a chave "incluir dados do Omie" — os que ela divide com as outras
// duas. A empresa só alcança o lado do Omie (o que falta pagar e receber): o DFC não tem coluna de empresa que case
// com a filial do Omie (`docs/fontes.md`), e cada número de fonte DFC diz isso ao lado, como na Tela 1.

import { novaBase } from '../regras/base-local.mjs';
import { DFC_RECEITA, DFC_TRANSFERENCIA_RECEITA_SUB2, eDeducaoDfc } from '../regras/dfc.mjs';
import { lerDespesasFixas } from '../regras/despesas-fixas.mjs';
import { dataBR, ultimoDia } from '../regras/periodo.mjs';
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
  const receitas = c1('receitas'), despesas = c1('despesas'), pendentes = c1('despesas-pendentes');
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
  // O RESULTADO DO MÊS É ENTROU − SAIU, os dois cartões de cima (correção de 28/09/2026: a primeira versão chamava de
  // "lucro/prejuízo" a projeção, e em agosto, com entrou maior que saiu, a frase dizia prejuízo — porque o "falta pagar"
  // de um mês já fechado são títulos vencidos que o Omie ainda mostra em aberto).
  const resultado = receitas.valor - despesas.valor;
  // A PROJEÇÃO SÓ EXISTE COM O MÊS EM ANDAMENTO (ou à frente): num mês fechado não há mais o que vencer nele, e o que
  // ficou em aberto é atraso, não previsão. Aí o cartão mostra o que venceu e não foi pago, e a frase fala do resultado.
  const hojeOrdem = new Date().getFullYear() * 12 + new Date().getMonth();
  const mesFechado = ano * 12 + (mes - 1) < hojeOrdem;
  const projecao = DFC.ok && temOmie && !mesFechado ? resultado + aReceber.valor - aPagar : null;

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
      mes: m, ok: true, entradas, gastos, saldo: entradas - gastos, linhas: ls.length,
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

  // ---------------------------------------------------------------- o mês dia a dia: consolidado e previsão
  //
  // PEDIDO DO DONO, 28/09/2026: ao escolher um mês, o dia a dia do mês inteiro — o que já foi (consolidado) e o que
  // ainda vem (previsão) — num gráfico só.
  //
  //   CONSOLIDADO  as linhas baixadas do `FLUXO DE CAIXA` do mês, pelo dia de `DIA PG` — a mesma conta dos cartões
  //                Entrou e Saiu, dia por dia. Vai até HOJE no mês corrente, e o mês inteiro num mês fechado.
  //   PREVISÃO     de HOJE até o fim do mês corrente (e o mês inteiro num mês à frente): os títulos do Omie pelo dia de
  //                vencimento — a receber em aberto (o cartão "Ainda a receber") e a pagar sem baixa (o cartão "Ainda
  //                a pagar"), os mesmos títulos dos dois cartões. Num mês fechado não há previsão.
  //   ATRASADO     título a pagar que venceu ANTES de hoje e não foi baixado não é previsão de dia nenhum: fica fora do
  //                gráfico e a tela diz quanto é. O a receber vencido já ficava fora (faixa ATRASADO).
  //
  // A LINHA é a POSIÇÃO DE CAIXA: o caixa do dia 1 (a linha `Inicial` da planilha) mais o consolidado até hoje, e daí
  // em diante somando a previsão — é onde o caixa termina o mês se tudo que vence for recebido e pago no dia.
  const agora = new Date();
  const mesCorrente = agora.getFullYear() === ano && agora.getMonth() + 1 === mes;
  const hojeDia = mesCorrente ? agora.getDate() : mesFechado ? ultimoDia(ano, mes) + 1 : 0;
  const nDias = ultimoDia(ano, mes);
  const diaDe = (venc) => { const x = dataBR(venc); return x && x.a === ano && x.m === mes ? x.d : null; };
  const usaOmie = chaveOmie.ligado;
  const previstoReceber = new Map(), previstoPagar = new Map();
  let atrasadoAPagar = 0, nAtrasadoAPagar = 0;
  // Quantos TÍTULOS a previsão desenha — os `Map` acima somam por dia, e a contagem do indicador é de título.
  let nPrevistos = 0;
  if (usaOmie && !mesFechado) {
    for (const t of aReceber.porVencimento ?? []) {
      const dia = diaDe(t.venc);
      if (dia && dia >= hojeDia) { previstoReceber.set(dia, (previstoReceber.get(dia) ?? 0) + t.valor); nPrevistos += 1; }
    }
    for (const t of pendentes.porVencimento ?? []) {
      const dia = diaDe(t.venc);
      if (!dia) continue;
      if (dia >= hojeDia) { previstoPagar.set(dia, (previstoPagar.get(dia) ?? 0) + t.valor); nPrevistos += 1; }
      else { atrasadoAPagar += t.valor; nAtrasadoAPagar += 1; }
    }
  }
  // A POSIÇÃO DE CAIXA DO DIA 1 (pedido do dono, 28/09/2026: sem ela a linha começava no zero, e um mês com mais saída
  // que entrada até aqui parecia uma conta negativa). Sai do quadro do caixa dia a dia da aba do mês do DFC: a linha
  // `Inicial`, coluna `D` (o dia 1) — o caixa de todas as contas da planilha no começo do mês. Sem esse quadro, a linha
  // volta a começar no zero e a tela diz isso.
  const quadro = DFC.ok ? DFC.abaDoMes : null;
  const inicialDoMes = quadro?.posicao?.inicial?.length ? quadro.posicao.inicial[0] : null;
  const finalDaPlanilha = quadro?.posicao?.final ?? null;
  // O PONTO DE PARTIDA É O FECHAMENTO DO DIA ANTERIOR (pedido do dono, 28/09/2026: "a posição de 31/08 deve ser o
  // offset do gráfico de setembro"): o `Final` do último dia do quadro da aba do mês ANTERIOR, no arquivo daquele mês.
  // Em janeiro, ou sem o arquivo anterior, vale o `Inicial` do dia 1 deste mês. A tela mostra os dois lado a lado —
  // numa planilha consistente eles são o mesmo número.
  let finalDoMesAnterior = null;
  if (mes > 1) {
    const anterior = await BASE.mes(mes - 1);
    const fin = anterior?.abaDoMes?.posicao?.final ?? null;
    const n = ultimoDia(ano, mes - 1);
    if (fin && fin.length >= n) finalDoMesAnterior = fin[n - 1];
  }
  // O PONTO DE PARTIDA DE VERDADE: a soma da abertura de cada banco, do saldo corrido do `FLUXO DE CAIXA`
  // (`saldosPorBanco` em `lerMesDoDfc`). O quadro do caixa da aba do mês fica só como reserva — o diagnóstico de
  // 28/09/2026 mostrou que ele não é mantido.
  const bancos = DFC.ok ? (DFC.saldosPorBanco ?? []) : [];
  const aberturaDosBancos = bancos.length ? somar(bancos.map((b) => b.abertura)) : null;
  const finalDosBancos = bancos.length ? somar(bancos.map((b) => b.final)) : null;
  const pontoDePartida = aberturaDosBancos ?? finalDoMesAnterior ?? inicialDoMes;
  const doQuadro = (lista, dia) => (lista && dia <= lista.length ? lista[dia - 1] : null);
  const dias = [];
  let acumulado = pontoDePartida ?? 0;
  for (let dia = 1; dia <= nDias; dia++) {
    const doDia = linhas.filter((l) => l.dia === dia);
    const entrouDia = somar(doDia.filter((l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2)).map((l) => l.valor));
    const saiuDia = somar(doDia.filter((l) => l.natureza === 'P').map((l) => modulo(l.valor)));
    const aReceberDia = previstoReceber.get(dia) ?? 0;
    const aPagarDia = previstoPagar.get(dia) ?? 0;
    // A POSIÇÃO SOMA TODAS AS LINHAS DO DIA, transferência entre contas inclusive, como o saldo do banco faz. As
    // colunas "entrou" e "saiu" continuam a conta dos cartões (a transferência que entra não é receita); mas na posição
    // a que entra tem de compensar a que sai, senão cada transferência derrubava o caixa (achado em 28/09/2026).
    acumulado += somar(doDia.map((l) => l.valor)) + aReceberDia - aPagarDia;
    dias.push({
      dia, entrou: entrouDia, saiu: saiuDia, aReceber: aReceberDia, aPagar: aPagarDia, acumulado,
      // O `Final` que a própria planilha escreve para o dia, para conferir a linha nos dias já consolidados.
      finalDaPlanilha: doQuadro(finalDaPlanilha, dia),
      // O QUE O QUADRO DA PLANILHA ESCREVE PARA O DIA, para a conferência dia a dia: entradas e gastos (a saída vem
      // negativa na planilha; aqui, positiva, como a coluna "saiu") e o saldo inicial do dia.
      planilha: {
        inicial: doQuadro(quadro?.posicao?.inicial, dia),
        entradas: doQuadro(quadro?.porDia?.entradas, dia),
        gastos: doQuadro(quadro?.porDia?.gastos, dia) === null ? null : modulo(doQuadro(quadro?.porDia?.gastos, dia)),
        final: doQuadro(finalDaPlanilha, dia),
      },
      linhasEntrou: doDia.filter((l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2)).length,
      linhasSaiu: doDia.filter((l) => l.natureza === 'P').length,
      fase: dia < hojeDia ? 'consolidado' : dia === hojeDia ? 'hoje' : 'previsao',
    });
  }
  // A CONFERÊNCIA DA LINHA COM O SALDO DOS BANCOS, fechada (medida no computador do dono em 29/09/2026).
  //
  // A posição no último dia consolidado NÃO é o último saldo corrido dos bancos, e não deve ser: o saldo corrido da
  // planilha corre até a ÚLTIMA LINHA DIGITADA do mês, e essas linhas finais incluem lançamentos que ainda não foram
  // baixados (em setembro, 13 com `PAGAMENTO` = A PAGAR e data de 29 e 30/09, mais um com `PAGAMENTO` vazio). O caixa
  // consolidado, com razão, deixa esses de fora. A conferência então é uma PONTE, e o que ela prova é que a ponte fecha:
  //
  //     posição no corte  +  o que o saldo já desconta e não está baixado  +  o baixado depois do corte
  //       −  o movimento que a planilha lançou depois de parar de escrever o saldo  =  o último saldo escrito, somado
  //
  // O ÚLTIMO TERMO é o que faltava (achado em agosto de 2026): a planilha às vezes para de escrever o saldo no meio do
  // bloco e segue lançando, e aí "o último SALDO do banco" não é o fechamento da conta. Em setembro ele é zero nos três
  // bancos — o saldo é escrito até a última linha.
  //
  // `diferenca` é o que sobra dessa conta — zero quer dizer que não há um centavo sem explicação. `fecham` diz se o
  // saldo corrido da própria planilha andou exatamente com o movimento em todos os bancos; onde não anda, a conta acima
  // não se sustenta e a tela diz isso em vez de dar um veredito.
  const corte = mesFechado ? nDias : hojeDia;
  const baixadoAteOCorte = somar(linhas.filter((l) => l.dia <= corte).map((l) => l.valor));
  const depois = linhas.filter((l) => l.dia > corte);
  const naoBaixadoNoSaldo = { valor: somar(bancos.map((b) => b.naoBaixado ?? 0)), n: bancos.reduce((t, b) => t + (b.linhasNaoBaixado ?? 0), 0) };
  const posicaoNoCorte = pontoDePartida === null ? null : pontoDePartida + baixadoAteOCorte;
  const depoisDoSaldo = {
    valor: somar(bancos.map((b) => b.depoisDoUltimoSaldo ?? 0)),
    n: bancos.filter((b) => (b.depoisDoUltimoSaldo ?? 0) !== 0).length,
  };
  const conferenciaDosBancos = finalDosBancos === null || posicaoNoCorte === null ? null : {
    corte, posicao: posicaoNoCorte, final: finalDosBancos, naoBaixado: naoBaixadoNoSaldo, depoisDoSaldo,
    baixadoDepois: { valor: somar(depois.map((l) => l.valor)), n: depois.length },
    diferenca: posicaoNoCorte + naoBaixadoNoSaldo.valor + somar(depois.map((l) => l.valor)) - depoisDoSaldo.valor - finalDosBancos,
    fecham: bancos.every((b) => b.fecha), naoFecham: bancos.filter((b) => !b.fecha).length,
    semSaldoEscrito: bancos.filter((b) => b.semSaldoEscrito).length, nBancos: bancos.length,
  };
  const diaADia = {
    dias, hoje: mesCorrente ? hojeDia : null, mesFechado, comPrevisao: usaOmie && !mesFechado,
    inicial: inicialDoMes, finalDoMesAnterior, pontoDePartida, aberturaDosBancos, finalDosBancos, conferenciaDosBancos,
    bancos: bancos.map((b) => ({ banco: b.banco, abertura: b.abertura, final: b.final, fecha: b.fecha, naoBaixado: b.naoBaixado, linhasNaoBaixado: b.linhasNaoBaixado, semSaldoEscrito: b.semSaldoEscrito, depoisDoUltimoSaldo: b.depoisDoUltimoSaldo })), abaDoQuadro: quadro?.aba ?? null, arquivo: DFC.arquivo ?? null,
    atrasadoAPagar: { valor: atrasadoAPagar, n: nAtrasadoAPagar },
    fonte: 'consolidado: DFC, as linhas baixadas do `FLUXO DE CAIXA` do mês pelo dia de `DIA PG` (a conta dos cartões Entrou e Saiu); previsão: Omie, os títulos a receber em aberto e a pagar sem baixa pelo dia de vencimento (os títulos dos cartões "Ainda a receber" e "Ainda a pagar")',
  };

  // ---------------------------------------------------------------- vários meses dia a dia (pedido do dono, 29/09/2026)
  //
  // "Quero poder selecionar mais de um mês para aparecer o gráfico de fluxo de caixa (exemplo abril a agosto)". Com
  // `filtro.mesesDoDia` (mais de um mês), o gráfico dia a dia passa a ser o período inteiro, os dias em sequência. Cada
  // mês é a MESMA conta do mês sozinho: consolidado pelas linhas baixadas do `FLUXO DE CAIXA` pelo `DIA PG`, previsão
  // pelos títulos do Omie nos meses que ainda não fecharam. A LINHA parte da abertura dos bancos do primeiro mês e segue
  // somando; em cada mês seguinte que tem abertura na planilha, ela recomeça dessa abertura — é o saldo real do banco, e
  // se a planilha não fecha de um mês para o outro, o degrau aparece no gráfico em vez de ser escondido.
  // Os cartões de cima continuam sendo do mês escolhido no filtro "mês".
  const mesesDoDia = [...new Set((filtro.mesesDoDia ?? []).map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  let periodo = null;
  if (mesesDoDia.length > 1) {
    const pontos = [];
    let posicao = null;
    let atrasadoNoPeriodo = 0;
    for (const m of mesesDoDia) {
      const r = await BASE.mes(m);
      const ls = r.ok ? r.linhas : [];
      const fechadoM = ano * 12 + (m - 1) < hojeOrdem;
      const correnteM = agora.getFullYear() === ano && agora.getMonth() + 1 === m;
      const hojeM = correnteM ? agora.getDate() : fechadoM ? 99 : 0;
      const recebe = new Map(), paga = new Map();
      if (usaOmie && !fechadoM) {
        const t1m = m === mes ? t1 : await calcularTela1({ raiz, ano, mes: m, fonte, filtro: comum, base: BASE });
        const t3m = m === mes ? t3 : await calcularTela3({ raiz, ano, mes: m, fonte, filtro: comum, base: BASE });
        const noMes = (venc) => { const x = dataBR(venc); return x && x.a === ano && x.m === m ? x.d : null; };
        for (const t of t3m.cartoes.find((c) => c.id === 'valor-pendente')?.porVencimento ?? []) {
          const d = noMes(t.venc);
          if (d && d >= hojeM) recebe.set(d, (recebe.get(d) ?? 0) + t.valor);
        }
        for (const t of t1m.cartoes.find((c) => c.id === 'despesas-pendentes')?.porVencimento ?? []) {
          const d = noMes(t.venc);
          if (!d) continue;
          if (d >= hojeM) paga.set(d, (paga.get(d) ?? 0) + t.valor);
          else atrasadoNoPeriodo += t.valor;
        }
      }
      const abertura = r.ok && r.saldosPorBanco?.length ? somar(r.saldosPorBanco.map((b) => b.abertura)) : null;
      posicao = abertura ?? posicao ?? 0;
      for (let dia = 1; dia <= ultimoDia(ano, m); dia++) {
        const doDia = ls.filter((l) => l.dia === dia);
        const aReceberDia = recebe.get(dia) ?? 0, aPagarDia = paga.get(dia) ?? 0;
        posicao += somar(doDia.map((l) => l.valor)) + aReceberDia - aPagarDia;
        pontos.push({
          dia, mes: m, rotulo: `${dia}/${String(m).padStart(2, '0')}`,
          entrou: somar(doDia.filter((l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2)).map((l) => l.valor)),
          saiu: somar(doDia.filter((l) => l.natureza === 'P').map((l) => modulo(l.valor))),
          aReceber: aReceberDia, aPagar: aPagarDia, acumulado: posicao,
          fase: dia < hojeM ? 'consolidado' : dia === hojeM ? 'hoje' : 'previsao',
        });
      }
    }
    const hojeNoPeriodo = pontos.find((x) => x.fase === 'hoje');
    periodo = {
      meses: mesesDoDia, dias: pontos, hoje: hojeNoPeriodo?.rotulo ?? null,
      entrou: somar(pontos.map((x) => x.entrou)), saiu: somar(pontos.map((x) => x.saiu)),
      atrasadoAPagar: atrasadoNoPeriodo,
    };
  }

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
    { id: 'resultado', nome: 'Resultado do mês', tipo: 'dinheiro', fonte: 'conta desta tela: Entrou − Saiu',
      valor: resultado, negativo: false,
      contagem: { dfc: receitas.contagem.dfc + despesas.contagem.dfc, omie: null },
      naoVale: doDfcEmpresa('o valor, que é do DFC'),
      origem: `Entrou − Saiu, os dois cartões ao lado. Positivo é lucro de caixa no mês; negativo, prejuízo. As transferências entre contas que entraram (${linhasTransferencia.length} linha(s)) não contam como entrada, como no "Entrou". O cartão "Saldo" da Tela 1 as conta, e por isso pode dar outro número.` },
    { ...pendentes, id: 'a-pagar', nome: mesFechado ? 'Venceu no mês e não foi pago' : 'Ainda a pagar no mês',
      origem: 'Omie — `financas/mf`, títulos a pagar (`cTpLancamento: "CP"`) com vencimento no mês e sem baixa (`cLiquidado = "N"`), soma do valor em aberto, no recorte da MeuBESS. É o cartão "Desp. Pendentes" da Tela 1.' },
    { ...aReceber, id: 'a-receber', nome: mesFechado ? 'A receber do mês, em aberto' : 'Ainda a receber no mês',
      origem: 'Omie — `financas/pesquisartitulos`, títulos a receber com vencimento no mês, faixa EM ABERTO (ainda não venceram), soma do valor em aberto. Os já vencidos ficam fora da projeção e aparecem embaixo. É o cartão "Valor Pendente" da antiga tela Contas a Receber.' },
    { id: 'projecao', nome: 'Projeção do mês', tipo: 'dinheiro', negativo: false,
      fonte: 'conta desta tela: resultado do mês (DFC) + a receber (Omie) − a pagar (Omie)',
      valor: projecao,
      contagem: { dfc: receitas.contagem.dfc + despesas.contagem.dfc, omie: temOmie && !mesFechado ? (pendentes.contagem.omie ?? 0) + (aReceber.contagem.omie ?? 0) : null },
      origem: 'Resultado do mês (entrou − saiu) + ainda a receber no mês − ainda a pagar no mês. Só existe com o mês em andamento: é uma PROJEÇÃO DE CAIXA, não o lucro contábil (esse é a Tela 2, DRE). O que já venceu e não foi recebido não entra.',
      naoVale: doDfcEmpresa('o resultado do mês, a parte do DFC desta conta'),
      ...(mesFechado ? { avisos: ['o mês já fechou: não há projeção, o resultado é o do cartão ao lado.'] }
        : temOmie ? {} : { semOmie: [{ oQue: 'não há projeção', porque: 'o que falta pagar e receber no mês é do Omie, e a chave está desligada' }] }) },
    { id: 'fixas', nome: 'Despesas fixas pagas', tipo: 'dinheiro',
      fonte: 'DFC, pelas contas que a gestora marcou como fixas',
      valor: lista.respondido ? totalFixas : null,
      contagem: {
        dfc: lista.respondido ? linhasFixas.length : null, omie: null,
        extras: {
          contasFixasNoMes: fixasPorConta.length,
          contasDaGestora: lista.fixas.size,
          ausentesDaResposta: lista.ausentesDaResposta.length,
        },
      },
      origem: `DFC — ${doFluxo}, coluna \`SAIDA\`, só as linhas cujo \`SUB 2\` a gestora marcou como Fixa em \`dados/despesas-fixas.json\` (${lista.fixas.size} contas${lista.respondidoEm ? `, respondido em ${lista.respondidoEm}` : ''}).`,
      naoVale: doDfcEmpresa('o valor e a contagem do DFC deste cartão'),
      avisos: lista.respondido ? [] : ['a classificação de despesa fixa ainda não foi respondida pela gestora (`docs/despesas-fixas-para-classificar.xlsx`): sem ela, este cartão não tem número.'],
      linhas: linhasFixas.map(paraOrigem) },
    { id: 'peso-fixas', nome: 'Fixas / receita líquida', tipo: 'percentual',
      fonte: 'DFC nas duas pontas',
      valor: lista.respondido && rl.valor ? totalFixas / rl.valor : null,
      // `extras` reparte o denominador: um total pode bater por acaso com a repartição errada, e é isso que
      // `scripts/conferir-telas.mjs` fecha. Só contagem de linha, nunca o valor.
      contagem: { dfc: lista.respondido ? linhasFixas.length : null, omie: null, extras: { receita: rl.receita.length, deducoes: rl.deducoes.length } },
      origem: `Despesas fixas pagas ÷ receita líquida do mês no DFC. A receita líquida é a mesma conta do cartão "% D. Func. / Rec. Líquida" da Tela 1: linhas de \`SUB 2\` ${DFC_RECEITA.join(', ')} (${rl.receita.length}) menos as de dedução, \`SUB 2\` DEVOLUCÃO ou \`CLASS. CONTABIL\` ESTORNO (${rl.deducoes.length}).`,
      naoVale: doDfcEmpresa('as duas pontas desta razão, que são do DFC'),
      avisos: lista.respondido ? [] : ['sem a classificação da gestora não há despesa fixa para dividir.'],
      extras: { receitaLiquida: rl.valor } },
  ];

  // A CHAVE DO OMIE DESLIGADA: os dois cartões do Omie já chegam de `calcularTela1` / `calcularTela3` sem valor e com a
  // frase de `semOmie`; os de fonte DFC seguem inteiros, como na Tela 1.
  // O BLOCO DO DIA A DIA COMO INDICADOR CONFERÍVEL. Os cartões já dizem a contagem deles; o gráfico diário não dizia, e
  // sem isso `scripts/conferir-telas.mjs` não tinha o que comparar com `docs/conferencia.md`. A contagem é a de sempre:
  // as linhas baixadas do `FLUXO DE CAIXA` do mês (o consolidado) e os títulos do Omie que a previsão desenha.
  const blocos = [
    { id: 'dia-a-dia', nome: 'O mês dia a dia', fonte: diaADia.fonte,
      contagem: {
        dfc: DFC.ok ? linhas.length : null, omie: diaADia.comPrevisao ? nPrevistos : null,
        extras: {
          diasComMovimento: dias.filter((x) => x.linhasEntrou + x.linhasSaiu > 0).length,
          bancos: bancos.length,
          bancosQueFecham: bancos.filter((b) => b.fecha).length,
          linhasNaoBaixadasNoSaldo: naoBaixadoNoSaldo.n,
          bancosComLancamentoDepoisDoSaldo: bancos.filter((b) => (b.depoisDoUltimoSaldo ?? 0) !== 0).length,
          // Só o VEREDITO da ponte, nunca o valor: `true` quer dizer que não sobrou um centavo sem explicação entre a
          // posição de caixa do último dia consolidado e o último saldo somado dos bancos.
          ponteFecha: conferenciaDosBancos ? conferenciaDosBancos.diferenca === 0 : null,
        },
      },
      naoVale: doDfcEmpresa('o consolidado do gráfico, que é do DFC') },
  ];
  return {
    ano, mes, mesEmAndamento, mesFechado, resultado, diaADia, periodo,
    dfc: { ...t1.dfc },
    cartoes, blocos,
    vencidoAReceber: { valor: vencidoAReceber.valor, contagem: vencidoAReceber.contagem },
    fixas: { respondido: lista.respondido, respondidoEm: lista.respondidoEm, contas: lista.fixas.size, porConta: fixasPorConta, total: totalFixas },
    serie: {
      meses: mesesOk, semPlanilha: meses.filter((m) => !m.ok).map((m) => ({ mes: m.mes, motivo: m.motivo })), comparacao,
      fonte: 'DFC — as linhas baixadas da aba `FLUXO DE CAIXA` do arquivo de cada mês, de janeiro ao mês desta tela, pela mesma conta dos cartões: entrou (fora a transferência entre contas), saiu e o resultado (entrou − saiu)',
    },
    filtros: { empresa: t1.filtros.empresa, omie: t1.filtros.omie },
    lidoEm: new Date().toISOString(),
  };
}

export { calcularFluxoDeCaixa };
