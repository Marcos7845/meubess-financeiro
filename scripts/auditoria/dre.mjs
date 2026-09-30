// Segunda conta do DRE sobre registros brutos. As listas são a fotografia do contrato em docs/fontes.md,
// mantida aqui para que um erro de classificação da camada do dashboard possa aparecer como diferença.
import { centavos, soma } from './core.mjs';

const faixa = (p, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => `${p}${String(de + i).padStart(2, '0')}`);
const vendas = ['1.01.01', '1.01.03', '1.04.01'];
const custo = {
  1: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', ...faixa('2.01.', 82, 97), '2.01.99', '2.04.88'],
  2: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', '2.01.90', '2.01.91', '2.01.93', '2.01.94', '2.01.95', '2.01.97', '2.01.98', '2.01.99', '2.08.99', '2.01.89', '2.01.92', '2.01.96'],
};
const financeiro = {
  1: ['1.01.02', '1.02.02', '1.04.95', '2.05.01', '2.05.02', '2.05.04', '2.06.95'],
  2: ['1.02.02', '1.04.94', '2.05.01', '2.05.02', '2.05.04', '2.05.99', '2.06.95'],
};
const fora = { 1: ['2.08.02', '2.05.99', '1.04.99', '2.04.89', '2.11.95', '1.04.03'],
  2: ['1.04.99', '2.10.98', '2.04.91', '1.04.03'] };
const transf = { 1: ['1.04.96', '1.04.97', '2.05.98'], 2: ['1.04.96', '2.05.98'] };

export function dreIndependente(cru, recorte, dfc, periodo) {
  if (!dfc?.linhas || !cru?.categorias?.length || !cru?.movimentos?.length) return new Map();
  const cad = Object.fromEntries(['1', '2'].map((emp) => [emp, new Map(cru.categorias.filter((c) => c.emp === emp).map((c) => [String(c.codigo), c]))]));
  const dentro = (d) => typeof d === 'string' && `${d.slice(6, 10)}-${d.slice(3, 5)}` === periodo;
  const base = {};
  for (const emp of ['1', '2']) {
    const xs = cru.movimentos.filter((m) => m.emp === emp).map((m) => ({ ...m.detalhes, resumo: m.resumo ?? {}, emp }))
      .filter((d) => dentro(d.dDtPagamento) && d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`));
    const adcp = new Set(xs.filter((d) => d.cOrigem === 'ADCP' && d.nCodTitulo).map((d) => String(d.nCodTitulo)));
    base[emp] = xs.filter((d) => d.cOrigem !== 'ADCR' && (!d.nCodTitulo || !adcp.has(String(d.nCodTitulo))));
  }
  const transferencia = (emp, cod) => cad[emp].get(cod)?.transferencia === 'S' || transf[emp].includes(cod);
  function selecionar(natureza, filtro) {
    const saida = [];
    for (const emp of ['1', '2']) {
      const tit = new Map(), corrente = new Map();
      for (const d of base[emp]) {
        const cod = String(d.cCodCateg ?? '');
        if (d.cNatureza !== natureza || transferencia(emp, cod) || !filtro(emp, cod, cad[emp].get(cod))) continue;
        if (['CONTA_A_RECEBER', 'CONTA_A_PAGAR'].includes(d.cGrupo) && d.nCodTitulo) tit.set(String(d.nCodTitulo), d);
        else if (['CONTA_CORRENTE_REC', 'CONTA_CORRENTE_PAG'].includes(d.cGrupo)) corrente.set(String(d.nCodMovCC ?? `${d.nCodTitulo}|${d.dDtPagamento}|${d.resumo.nValPago}`), d);
      }
      saida.push(...tit.values());
      for (const d of corrente.values()) if (!d.nCodTitulo || !tit.has(String(d.nCodTitulo))) saida.push(d);
    }
    return saida;
  }
  const valor = (d) => centavos(['CONTA_A_RECEBER', 'CONTA_A_PAGAR'].includes(d.cGrupo)
    ? d.nValorTitulo ?? d.resumo?.nValPago : d.resumo?.nValPago ?? d.nValorTitulo);
  const total = (xs) => soma(xs.map(valor));
  const venda = selecionar('R', (_, cod) => vendas.includes(cod));
  const outras = selecionar('R', (emp, cod, c) => c?.conta_receita === 'S' && c?.totalizadora === 'N' && !vendas.includes(cod) && !fora[emp].includes(cod));
  const dg = selecionar('P', (emp, cod, c) => c?.conta_despesa === 'S' && !custo[emp].includes(cod) && !financeiro[emp].includes(cod) && !fora[emp].includes(cod));
  const finR = selecionar('R', (emp, cod) => financeiro[emp].includes(cod));
  const finP = selecionar('P', (emp, cod) => financeiro[emp].includes(cod));
  const semR = selecionar('R', (_emp, _cod, c) => !c?.codigo_dre);
  const semP = selecionar('P', (_emp, _cod, c) => !c?.codigo_dre);
  const rec = total(venda) + total(outras);
  const ded = soma(dfc.linhas.filter((l) => l.sub2 === 'DEVOLUCAO' || l.classe === 'ESTORNO').map((l) => Math.abs(l.movimento)));
  const cv = soma(dfc.linhas.filter((l) => ['FORNECEDORES COGS', 'FORNECEODORES COGS', 'COMPRA DE MERCADORIA'].includes(l.classe)
    && ['COMPRAS DE MERCADORIAS', 'FRETE E CARRETO', 'ARMAZENAGEM E MANUSEIO'].includes(l.sub2)).map((l) => Math.abs(l.movimento)));
  const imp = soma(dfc.linhas.filter((l) => l.classe === 'IMPOSTOS E CONTRIBUICOES' && ['ISS', 'INSS', 'IRPJ / CSLL'].includes(l.sub2)).map((l) => Math.abs(l.movimento)));
  const rl = rec - ded, lb = rl - cv, ebitda = lb - total(dg), fin = total(finR) - total(finP), lucro = ebitda + fin - imp;
  const out = new Map();
  const fonte = 'Omie / financas/mf ListarMovimentos; pagamento no mês, empresas 1+2, contas MeuBESS; categoria da filial';
  const add = (id, v, xs = [], extra = fonte) => out.set(id, { valor: v, linhas: xs, fonte: extra });
  add('dre-receitas', rec, [...venda, ...outras]);
  add('dre-receita-bruta', rec, [...venda, ...outras]);
  add('dre-receita-liquida', rl, [...venda, ...outras], `${fonte}; menos DFC/FLUXO DE CAIXA: deduções`);
  add('dre-lucro-bruto', lb, [...venda, ...outras], `${fonte}; menos DFC: deduções e custos`);
  add('dre-despesas-gerais', total(dg), dg);
  add('dre-ebitda', ebitda, [...venda, ...outras, ...dg], `${fonte}; menos DFC: deduções e custos`);
  add('cartao-ebitda', ebitda, [...venda, ...outras, ...dg], `${fonte}; menos DFC: deduções e custos`);
  add('dre-resultado-financeiro', fin, [...finR, ...finP]);
  add('dre-lucro-liquido', lucro, [...venda, ...outras, ...dg, ...finR, ...finP], `${fonte}; menos DFC: deduções, custos e impostos`);
  add('cartao-lucro-liquido', lucro, [...venda, ...outras, ...dg, ...finR, ...finP], `${fonte}; menos DFC: deduções, custos e impostos`);
  add('cartao-margem', rec ? lucro / rec : null, [...venda, ...outras, ...dg], `${fonte}; lucro ÷ receita bruta`);
  add('dre-sem-conta', total(semR) - total(semP), [...semR, ...semP]);
  return out;
}
