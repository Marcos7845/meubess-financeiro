// O PASSIVO DA TELA 2 — as regras do bloco "Compromissos" (decisão do dono, 29/09/2026).
//
// Quatro números, abaixo da tabela do DRE, cada um abrindo os lançamentos de que saiu:
//
//   CAPITAL DE GIRO TOMADO     o fluxo do mês da dívida (captado, amortizado, juros e IOF), pelo Omie e pela `SUB 2` do
//                              DFC, sem contar duas vezes o mesmo pagamento; e o saldo devedor, a custo amortizado, da
//                              planilha de contratos que o financeiro mantém na pasta do DFC.
//   OBRIGAÇÕES COM CLIENTES    o saldo, pelo valor nominal, dos sinais `ADVR` recebidos de pedidos ainda sem NF, e o
//                              movimento do mês (sinais novos e sinais baixados com a NF).
//   DÍVIDA LÍQUIDA             capital de giro tomado − o saldo dos bancos da Tela 3 (o último saldo de cada bloco de
//                              banco do `FLUXO DE CAIXA` do mês, o mesmo `saldosPorBanco` que o Fluxo de Caixa soma).
//   RESULTADO SEM DINHEIRO     lucro de caixa (o lucro líquido do DRE do mês) − a variação dos sinais em aberto no mês
//   DE TERCEIROS               (sinais recebidos de pedidos sem NF − sinais baixados). Empréstimo, captação e amortização
//                              NÃO entram: já estão fora do DRE (decisão do dono, 29/09/2026, a segunda do dia — a
//                              primeira fórmula tirava a captação líquida, e assim somava a amortização de volta).
//
// NENHUMA REGRA DE LISTA MORA AQUI: os códigos do Omie vêm de `listas.mjs`, como todas as listas do dono. Aqui moram o
// casamento entre as duas fontes, a leitura da planilha de contratos e as contas. `lib/indicadores/tela-2.mjs` (a tela)
// e `scripts/numeros-das-telas.mjs` (a conferência) importam este arquivo.
//
// SÓ LEITURA, e dinheiro só em memória, em centavos inteiros, como no resto do app.

import {
  AMORTIZACAO_DE_DIVIDA, CAPTACAO_DE_EMPRESTIMO, JUROS_DE_EMPRESTIMO, IOF_DE_EMPRESTIMO, FAIXA_DO_STATUS,
} from './listas.mjs';
import { valorOmie } from './movimentos.mjs';
import { dataBR } from './periodo.mjs';
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula } from './xlsx.mjs';

const somar = (xs) => xs.reduce((s, x) => s + x, 0);
const naLista = (lista) => (cod) => lista.includes(cod);

// ================================================================ o fluxo da dívida
//
// DO LADO DO DFC, pela `SUB 2` (J): `EMPRESTIMO` — entrada é captação, saída é parcela (amortização). E a antecipação de
// recebíveis, que conta como dívida quando existir (decisão do dono, 29/09/2026): nenhuma linha de 2026 tem `SUB 2` nem
// `CLASS. CONTABIL` com "ANTECIPA", mas a regra já a pega no dia em que aparecer. A planilha não separa juros nem IOF da
// parcela — a linha `EMPRESTIMO` é a parcela inteira, e é ela que casa com o `2.04.89` do Omie.
const DFC_DIVIDA_SUB2 = ['EMPRESTIMO'];
const eAntecipacaoDfc = (l) => /ANTECIPA/.test(l.sub2) || /ANTECIPA/.test(l.classe);
const eDividaDfc = (l) => DFC_DIVIDA_SUB2.includes(l.sub2) || eAntecipacaoDfc(l);

// OS QUATRO GRUPOS do fluxo, pela natureza e pela lista do Omie. Juros e IOF não têm linha própria no DFC.
const GRUPOS_DA_DIVIDA = [
  { id: 'captado', rotulo: 'captado', natureza: 'R', omie: CAPTACAO_DE_EMPRESTIMO, dfc: true },
  { id: 'amortizado', rotulo: 'amortizado', natureza: 'P', omie: AMORTIZACAO_DE_DIVIDA, dfc: true },
  { id: 'juros', rotulo: 'juros', natureza: 'P', omie: JUROS_DE_EMPRESTIMO, dfc: false },
  { id: 'iof', rotulo: 'IOF', natureza: 'P', omie: IOF_DE_EMPRESTIMO, dfc: false },
];

// SEM CONTAR DUAS VEZES O MESMO PAGAMENTO. O mesmo débito da parcela está no Omie (o avulso `2.04.89` da conta
// corrente) e no DFC (a linha `EMPRESTIMO` do banco). São o mesmo pagamento quando têm o MESMO sentido, o MESMO dia do
// mês e o MESMO valor em centavos — medido em 29/09/2026: as parcelas de junho e de agosto de 2026 casam uma a uma
// assim, e nenhuma casa com outra por acaso. O casamento é um para um: cada linha do DFC casa com no máximo um
// lançamento do Omie, o de menor código entre os que servem, para ser sempre o mesmo.
function casar(doOmie, doDfc) {
  const livres = [...doDfc].sort((a, b) => a.linha - b.linha);
  const pares = [], soOmie = [];
  const ordem = [...doOmie].sort((a, b) => Number(a.codigo) - Number(b.codigo));
  for (const o of ordem) {
    const i = livres.findIndex((l) => l.natureza === o.natureza && l.dia === o.dia && Math.abs(l.valor) === o.valor);
    if (i < 0) { soOmie.push(o); continue; }
    pares.push({ omie: o, dfc: livres[i] });
    livres.splice(i, 1);
  }
  return { pares, soOmie, soDfc: livres };
}

// O LANÇAMENTO DO OMIE como o bloco o mostra: empresa, código, categoria, dia, valor (positivo) e sentido.
const doOmie = (emp, d, categorias) => ({
  fonte: 'omie', empresa: String(emp), natureza: d.cNatureza,
  codigo: String(d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER' ? d.nCodTitulo : d.nCodMovCC),
  chave: d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER' ? 'nCodTitulo' : 'nCodMovCC',
  categoria: String(d.cCodCateg ?? ''), descricao: categorias?.[emp]?.get(String(d.cCodCateg))?.descricao ?? '',
  dia: dataBR(d.dDtPagamento)?.d ?? null, valor: Math.abs(valorOmie(d)), cru: d,
});

// O FLUXO DE UM MÊS. `contar` é o de `criarRegras` (recorte da MeuBESS, sem cancelados, sem transferência, um por
// título); `linhasDfc` é o `FLUXO DE CAIXA` do mês, já lido. Devolve cada grupo com os lançamentos, o total em centavos
// e as contagens por fonte — `pares` é quantos pagamentos estavam nas duas e contaram uma vez.
function fluxoDaDivida({ EMPRESAS, contar, noMes, linhasDfc, categorias, linha = () => null }) {
  const dfc = (linhasDfc ?? []).filter(eDividaDfc);
  const grupos = GRUPOS_DA_DIVIDA.map((g) => {
    const omie = [];
    for (const emp of EMPRESAS) {
      const b = contar(emp, noMes, g.natureza, { categoria: naLista(g.omie[emp] ?? []), linha: linha(emp) });
      for (const d of b.todos) omie.push(doOmie(emp, d, categorias));
    }
    const linhasDoDfc = g.dfc ? dfc.filter((l) => l.natureza === g.natureza) : [];
    const { pares, soOmie, soDfc } = casar(omie, linhasDoDfc);
    const lancamentos = [
      ...pares.map((p) => ({ ...p.omie, fonte: 'omie e DFC', linhaDfc: p.dfc.linha, titulo: p.dfc.titulo, quem: p.dfc.quem })),
      ...soOmie,
      ...soDfc.map((l) => ({
        fonte: 'DFC', natureza: l.natureza, dia: l.dia, valor: Math.abs(l.valor), linhaDfc: l.linha,
        titulo: l.titulo, quem: l.quem, categoria: l.sub2, descricao: l.classe,
      })),
    ].sort((a, b) => (a.dia ?? 0) - (b.dia ?? 0));
    return {
      id: g.id, rotulo: g.rotulo, natureza: g.natureza,
      total: somar(lancamentos.map((l) => l.valor)),
      lancamentos,
      contagem: { omie: omie.length, dfc: linhasDoDfc.length, pares: pares.length, lancamentos: lancamentos.length },
      pares,
    };
  });
  const por = Object.fromEntries(grupos.map((g) => [g.id, g]));
  return {
    grupos, por,
    captacaoLiquida: por.captado.total - por.amortizado.total,
    contagem: {
      omie: somar(grupos.map((g) => g.contagem.omie)),
      dfc: somar(grupos.map((g) => g.contagem.dfc)),
      pares: somar(grupos.map((g) => g.contagem.pares)),
      lancamentos: somar(grupos.map((g) => g.contagem.lancamentos)),
    },
  };
}

// ================================================================ a planilha de contratos
//
// MANTIDA PELO FINANCEIRO, NA PASTA DO DFC (decisão do dono, 29/09/2026). Um `.xlsx` cujo nome tem "contrato" — o modelo
// é `docs/modelo-contratos.xlsx`, gerado por `scripts/modelo-contratos.mjs`. Por estar na mesma pasta, ela viaja para o
// servidor junto com as planilhas do DFC (`npm run financeiro-enviar-dfc` manda todo `.xlsx` da pasta), e é lida pela
// mesma interface de fonte (`dfc-fonte.mjs`) — nenhum caminho novo.
//
// UMA LINHA POR CONTRATO, com o cabeçalho na primeira linha que tiver `BANCO` escrito. As colunas são achadas pelo
// nome, não pela letra:
//
//   BANCO                 o banco (texto)
//   CONTRATO              o número ou apelido do contrato (texto)
//   TIPO                  CAPITAL DE GIRO, FINANCIAMENTO ou ANTECIPACAO DE RECEBIVEIS (texto; vazio vale capital de giro)
//   VALOR                 o valor tomado, em reais (número)
//   DATA                  o dia em que o dinheiro entrou (data)
//   PARCELAS              quantas parcelas mensais (número; antecipação é 1)
//   TAXA                  a taxa de juros AO MÊS, em % (número: 1,85 quer dizer 1,85% a.m.)
//   PRIMEIRO VENCIMENTO   o vencimento da primeira parcela (data; as outras vencem no mesmo dia dos meses seguintes)
//   VALOR DA PARCELA      opcional — a parcela do contrato; vazio, a parcela é a da tabela Price com a taxa e o prazo
//
// Linha sem VALOR, DATA, PARCELAS ou PRIMEIRO VENCIMENTO não entra, e a tela diz qual e por quê.
const eArquivoDeContratos = (nome) => /contrato/i.test(nome) && nome.toLowerCase().endsWith('.xlsx') && !nome.startsWith('~$');

const COLUNAS_DOS_CONTRATOS = {
  banco: 'BANCO', contrato: 'CONTRATO', tipo: 'TIPO', valor: 'VALOR', data: 'DATA', parcelas: 'PARCELAS', taxa: 'TAXA',
  primeiro: 'PRIMEIRO VENCIMENTO', parcela: 'VALOR DA PARCELA',
};
const semAcento = (s) => String(s ?? '').toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

async function lerContratos({ fonte, arquivos }) {
  if (!arquivos?.ok) return { ok: false, motivo: 'falta a planilha de contratos', porque: arquivos?.motivo ?? 'a pasta do DFC não foi lida' };
  const nome = arquivos.nomes.find(eArquivoDeContratos);
  if (!nome) return { ok: false, motivo: 'falta a planilha de contratos', porque: 'a pasta do DFC não tem nenhum .xlsx com "contrato" no nome (o modelo é docs/modelo-contratos.xlsx)' };
  let linhas;
  try {
    const zip = lerZip(await fonte.ler(nome));
    const ss = sharedStrings(zip);
    const aba = abasDo(zip)[0];
    linhas = aba ? lerAba(zip, aba.parte, ss) : null;
  } catch (e) {
    return { ok: false, motivo: 'a planilha de contratos não abriu', porque: e.message, arquivo: nome };
  }
  if (!linhas) return { ok: false, motivo: 'a planilha de contratos não abriu', porque: 'sem a primeira aba', arquivo: nome };
  const iCab = linhas.findIndex((l) => [...l.cel.values()].some((c) => semAcento(c.t) === 'BANCO'));
  if (iCab < 0) return { ok: false, motivo: 'a planilha de contratos não tem cabeçalho', porque: 'nenhuma linha com BANCO escrito', arquivo: nome };
  const col = {};
  for (const [letra, c] of linhas[iCab].cel) {
    const t = semAcento(c.t);
    for (const [k, rot] of Object.entries(COLUNAS_DOS_CONTRATOS)) if (t === rot || (k === 'taxa' && t.startsWith('TAXA'))) col[k] = letra;
  }
  const contratos = [], recusados = [];
  for (const l of linhas.slice(iCab + 1)) {
    const cel = (k) => (col[k] ? l.cel.get(col[k]) : undefined);
    const texto = (k) => (cel(k)?.t ?? (cel(k)?.v !== undefined ? String(cel(k).v) : '')).trim();
    const numero = (k) => {
      const c = cel(k);
      if (!c) return null;
      if (c.v !== undefined) return c.v;
      const n = Number(String(c.t).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    if (!texto('banco') && numero('valor') === null) continue;
    const c = {
      linha: l.n, banco: texto('banco'), contrato: texto('contrato'), tipo: semAcento(texto('tipo')) || 'CAPITAL DE GIRO',
      valor: numero('valor') === null ? null : Math.round(numero('valor') * 100),
      data: dataDaCelula(cel('data')), parcelas: numero('parcelas'), taxa: numero('taxa'),
      primeiro: dataDaCelula(cel('primeiro')),
      parcela: numero('parcela') === null ? null : Math.round(numero('parcela') * 100),
    };
    const faltam = ['valor', 'data', 'parcelas', 'primeiro'].filter((k) => !c[k]);
    if (c.taxa === null || c.taxa < 0) faltam.push('taxa');
    if (faltam.length) { recusados.push({ linha: l.n, banco: c.banco, contrato: c.contrato, faltam }); continue; }
    contratos.push(c);
  }
  return { ok: true, arquivo: nome, contratos, recusados };
}

// ================================================================ o saldo devedor, a custo amortizado
//
// PRINCIPAL MAIS JUROS JÁ CORRIDOS, SEM JUROS FUTUROS (decisão do dono, 29/09/2026). Para cada contrato, na data de
// corte (o último dia do mês da tela):
//
//   1. as parcelas vencem todo mês no dia do PRIMEIRO VENCIMENTO; a parcela é a do contrato, ou a da tabela Price;
//   2. o saldo anda de evento em evento — da DATA da captação ao primeiro vencimento, e de vencimento em vencimento —
//      crescendo pelos juros compostos da taxa ao mês, pró-rata pelos dias (mês de 30 dias), e caindo da parcela a cada
//      vencimento até o corte. PARCELA VENCIDA ATÉ O CORTE CONTA COMO PAGA: a planilha não diz o que foi pago, e o
//      fluxo do mês (acima) é quem mostra o pagamento de verdade;
//   3. do último vencimento até o corte correm os juros do período — é o "juros já corridos". Nada depois do corte.
//
// OS VENCIMENTOS pelo VALOR NOMINAL das parcelas que faltam (decisão do dono): 0 a 3 meses do corte, 3 a 12, mais de 12.
const DIA = 86400000;
const utc = (d) => Date.UTC(d.a, d.m - 1, d.d);
const mesesDepois = (d, k) => {
  const x = new Date(Date.UTC(d.a, d.m - 1 + k, 1));
  const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  return { a: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: Math.min(d.d, ultimo) };
};
const parcelaPrice = (valor, i, n) => (i === 0 ? valor / n : valor * i / (1 - (1 + i) ** -n));

function saldoDeUmContrato(c, corte) {
  const i = c.taxa / 100;
  const n = Math.round(c.parcelas);
  const pmt = c.parcela ?? Math.round(parcelaPrice(c.valor, i, n));
  const tCorte = utc(corte);
  let saldo = c.valor, desde = utc(c.data), pagas = 0;
  const cresce = (s, de, ate) => s * (1 + i) ** (Math.max(0, ate - de) / DIA / 30);
  const faltam = [];
  for (let k = 0; k < n; k++) {
    const venc = mesesDepois(c.primeiro, k);
    const t = utc(venc);
    if (t <= tCorte && tCorte >= utc(c.data)) {
      saldo = cresce(saldo, desde, t) - pmt;
      desde = t; pagas += 1;
    } else faltam.push({ venc, valor: pmt });
  }
  if (tCorte < utc(c.data)) return { ...c, pmt, pagas: 0, saldo: 0, faixas: { ate3: 0, de3a12: 0, mais12: 0 }, antesDaCaptacao: true };
  const saldoNoCorte = Math.max(0, Math.round(cresce(saldo, desde, tCorte)));
  const limite3 = utc(mesesDepois(corte, 3)), limite12 = utc(mesesDepois(corte, 12));
  const faixas = { ate3: 0, de3a12: 0, mais12: 0 };
  for (const p of faltam) {
    const t = utc(p.venc);
    if (t <= limite3) faixas.ate3 += p.valor;
    else if (t <= limite12) faixas.de3a12 += p.valor;
    else faixas.mais12 += p.valor;
  }
  return { ...c, pmt, pagas, saldo: faltam.length ? saldoNoCorte : 0, faixas };
}

function saldoDosContratos(lidos, corte) {
  if (!lidos.ok) return { ok: false, motivo: lidos.motivo, porque: lidos.porque, arquivo: lidos.arquivo ?? null };
  const porContrato = lidos.contratos.map((c) => saldoDeUmContrato(c, corte));
  return {
    ok: true, arquivo: lidos.arquivo, recusados: lidos.recusados, porContrato,
    saldo: somar(porContrato.map((c) => c.saldo)),
    faixas: {
      ate3: somar(porContrato.map((c) => c.faixas.ate3)),
      de3a12: somar(porContrato.map((c) => c.faixas.de3a12)),
      mais12: somar(porContrato.map((c) => c.faixas.mais12)),
    },
    antecipacao: somar(porContrato.filter((c) => /ANTECIPA/.test(c.tipo)).map((c) => c.saldo)),
  };
}

// ================================================================ obrigações com clientes
//
// O SINAL DO CLIENTE (decisão do dono, 29/09/2026): o título a receber com `cabecTitulo.cOrigem = "ADVR"` (adiantamento
// de venda). Ele continua RECEITA no mês em que foi pago — o DRE é de caixa, e o sinal entra em "(+) Receitas" pela
// categoria dele, como sempre. O que este bloco acrescenta é o outro lado: enquanto a NF do pedido não sai, a MeuBESS
// deve a mercadoria ao cliente. Esse é o saldo.
//
// A LIGAÇÃO COM O PEDIDO é a de `docs/fontes.md`: `cabecTitulo.nCodOS` = `cabecalho.codigo_pedido`. O pedido está COM
// NF quando `infoCadastro.faturado = "S"` e o sinal traz `cabecTitulo.cNumDocFiscal` — medido em 29/09/2026: quando a
// NF sai, o Omie escreve o número dela no próprio sinal, o mesmo número dos títulos `VENR` do pedido. A DATA da NF é a
// emissão (`dDtEmissao`) do primeiro título `VENR` do pedido com esse número; o pedido não guarda a data do faturamento
// na empresa 2 (o `infoCadastro.dFat` só vem na 1, e é o recurso quando não há `VENR`).
//
// NO FIM DE UM DIA, um sinal está EM ABERTO quando já foi recebido (`cStatus` na faixa pago, `dDtPagamento` até o dia)
// e a NF ainda não tinha saído até o dia. PEDIDO CANCELADO NÃO TIRA O SINAL DA CONTA (decisão do dono, 29/09/2026): o
// dinheiro entrou, e sem NF nem devolução registrada no Omie ele continua devido, no saldo, até o financeiro confirmar
// a devolução — a tela mostra quantos são, à parte, para o dono ver.
//
// O MOVIMENTO DO MÊS: SINAIS NOVOS são os recebidos no mês; BAIXADOS COM A NF são os que estavam em aberto no começo do
// mês, ou entraram nele, e não estão mais no fim. Saldo do fim = saldo do começo + novos − baixados, sempre.
//
// A LEITURA é a da carteira: `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"`, por vencimento
// em 2026, com o recorte da MeuBESS por `cabecTitulo.nCodCC` — a mesma da Tela 3. Sinal com vencimento fora de 2026 não
// está no cache.
function obrigacoesComClientes({ EMPRESAS, titulosR, pedidos, recorte, ano, mes, linha = () => null }) {
  const fimDe = (a, m) => ({ a, m, d: new Date(Date.UTC(a, m, 0)).getUTCDate() });
  const fim = fimDe(ano, mes);
  const inicio = mes === 1 ? fimDe(ano - 1, 12) : fimDe(ano, mes - 1);
  const sinais = [];
  for (const emp of EMPRESAS) {
    const doPedido = new Map();
    for (const t of titulosR[emp] ?? []) {
      const c = t.cabecTitulo ?? {};
      if (!c.nCodOS) continue;
      (doPedido.get(String(c.nCodOS)) ?? doPedido.set(String(c.nCodOS), []).get(String(c.nCodOS))).push(t);
    }
    for (const t of titulosR[emp] ?? []) {
      const c = t.cabecTitulo ?? {};
      if (c.cOrigem !== 'ADVR') continue;
      if (!recorte.has(`${emp}|${c.nCodCC}`)) continue;
      if (linha(emp) && !linha(emp)(c)) continue;
      if (FAIXA_DO_STATUS(c.cStatus) !== 'pago') continue;
      const pago = dataBR(c.dDtPagamento);
      if (!pago) continue;
      const pedido = pedidos[emp]?.get(String(c.nCodOS)) ?? null;
      const faturado = pedido?.infoCadastro?.faturado === 'S';
      const comNf = faturado && Boolean(String(c.cNumDocFiscal ?? '').trim());
      let dataDaNf = null;
      if (comNf) {
        const venr = (doPedido.get(String(c.nCodOS)) ?? []).map((x) => x.cabecTitulo)
          .filter((v) => v.cOrigem === 'VENR' && String(v.cNumDocFiscal ?? '').trim() === String(c.cNumDocFiscal).trim())
          .map((v) => dataBR(v.dDtEmissao)).filter(Boolean).sort((a, b) => utc(a) - utc(b));
        dataDaNf = venr[0] ?? dataBR(pedido?.infoCadastro?.dFat) ?? null;
      }
      sinais.push({
        empresa: String(emp), nCodTitulo: String(c.nCodTitulo), nCodOS: String(c.nCodOS),
        numeroPedido: pedido?.cabecalho?.numero_pedido ?? c.cNumOS ?? null, nCodCliente: String(c.nCodCliente ?? ''),
        valor: Math.round(Number(c.nValorTitulo ?? 0) * 100), pago, comNf, dataDaNf,
        // NF sem data achada: o pedido está faturado, mas nem o `VENR` nem o `dFat` dizem quando. Conta como saída
        // antes do corte (a NF existe), e a tela diz quantos são.
        nfSemData: comNf && !dataDaNf,
        semPedido: !pedido, pedidoCancelado: pedido?.infoCadastro?.cancelado === 'S',
        cru: c,
      });
    }
  }
  const emAberto = (s, dia) => utc(s.pago) <= utc(dia) && !(s.comNf && (!s.dataDaNf || utc(s.dataDaNf) <= utc(dia)));
  const noFim = sinais.filter((s) => emAberto(s, fim));
  const noInicio = sinais.filter((s) => emAberto(s, inicio));
  const novos = sinais.filter((s) => s.pago.a === ano && s.pago.m === mes);
  const noFimSet = new Set(noFim);
  const baixados = [...new Set([...noInicio, ...novos])].filter((s) => !noFimSet.has(s));
  const valor = (xs) => somar(xs.map((s) => s.valor));
  return {
    saldo: valor(noFim), saldoInicio: valor(noInicio),
    novos: valor(novos), baixados: valor(baixados),
    variacao: valor(noFim) - valor(noInicio),
    lancamentos: { saldo: noFim, novos, baixados },
    contagem: {
      emAberto: noFim.length, noInicio: noInicio.length, novos: novos.length, baixados: baixados.length,
      pedidoCancelado: noFim.filter((s) => s.pedidoCancelado).length,
      semPedido: noFim.filter((s) => s.semPedido).length,
      nfSemData: sinais.filter((s) => s.nfSemData).length,
      sinaisLidos: sinais.length,
    },
  };
}

// ================================================================ o saldo dos bancos da Tela 3
//
// O MESMO número que o Fluxo de Caixa soma: o último saldo de cada bloco de banco do `FLUXO DE CAIXA` do mês
// (`saldosPorBanco[].final`, lido por `lerMesDoDfc`).
const saldoDosBancos = (saldosPorBanco) => (saldosPorBanco?.length
  ? { ok: true, valor: somar(saldosPorBanco.map((b) => b.final ?? 0)), bancos: saldosPorBanco.length, porBanco: saldosPorBanco }
  : { ok: false, valor: null, bancos: 0, porBanco: [] });

export {
  DFC_DIVIDA_SUB2, eAntecipacaoDfc, eDividaDfc, GRUPOS_DA_DIVIDA, casar, fluxoDaDivida,
  eArquivoDeContratos, COLUNAS_DOS_CONTRATOS, lerContratos, saldoDeUmContrato, saldoDosContratos,
  obrigacoesComClientes, saldoDosBancos,
};
