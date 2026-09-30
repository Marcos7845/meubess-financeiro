// Cálculo de auditoria: recebe células e lançamentos crus. Não importa indicadores ou regras do dashboard.
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula } from '../../lib/regras/xlsx.mjs';

export const normal = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const centavos = (v) => Math.round(Number(v ?? 0) * 100);
export const soma = (xs) => xs.reduce((a, x) => a + x, 0);
export const mesDe = (d) => `${d.a}-${String(d.m).padStart(2, '0')}`;

export function lerDfcBruto(bytes, ano, mes) {
  const zip = lerZip(bytes), strings = sharedStrings(zip), abas = abasDo(zip);
  const fluxo = abas.find((a) => normal(a.nome) === 'FLUXO DE CAIXA');
  if (!fluxo) throw new Error('aba FLUXO DE CAIXA ausente');
  const linhas = [], brutas = [], cabecalhos = [];
  let colunas = null, bloco = 0, bancoAtual = '';
  for (const r of lerAba(zip, fluxo.parte, strings)) {
    const textos = [...r.cel].filter(([, c]) => c.t).map(([c, v]) => [normal(v.t), c]);
    if (textos.some(([s]) => s === 'VENCIMENTO') && textos.some(([s]) => s === 'DIA PG')) {
      colunas = new Map(textos); bloco++; bancoAtual = '';
      cabecalhos.push(r.n);
      continue;
    }
    if (!colunas) continue;
    const cel = (nome) => r.cel.get(colunas.get(nome));
    const txt = (nome) => cel(nome)?.t?.trim() ?? '';
    const num = (nome) => cel(nome)?.v;
    const entrada = num('ENTRADA') ?? 0, saida = num('SAIDA') ?? 0;
    const movimento = centavos(entrada) !== 0 ? centavos(entrada) : centavos(saida);
    const dataPg = dataDaCelula(cel('DIA PG'));
    const vencimento = dataDaCelula(cel('VENCIMENTO'));
    const data = dataPg ?? vencimento;
    const sub2 = normal(txt('SUB 2')), classe = normal(txt('CLASS. CONTABIL'));
    const pagamento = normal(txt('PAGAMENTO'));
    bancoAtual = normal(txt('BANCO')) || bancoAtual;
    const linha = { n: r.n, bloco, banco: bancoAtual, sub2, classe, pagamento,
      dataPg, vencimento, data, movimento, saldo: num('SALDO') === undefined ? null : centavos(num('SALDO')) };
    brutas.push(linha);
    if (!movimento || ['SALDO INICIAL', 'SALDO FINAL', 'SALDO INICIAL PROVISAO', 'SALDO FINAL PROVISAO'].includes(sub2)) continue;
    if (!pagamento || pagamento === 'A PAGAR' || pagamento === 'A RECEBER') continue;
    if (!data || data.a !== ano || data.m !== mes) continue;
    linhas.push(linha);
  }
  return { abas: abas.map((a) => a.nome), cabecalhos, linhas, brutas };
}

export const eReceita = (l) => l.movimento > 0 && l.sub2 !== 'TRANSFERENCIAS BANCARIAS - RECEITA';
export const eDeducao = (l) => l.sub2 === 'DEVOLUCAO' || l.classe === 'ESTORNO';
export const receitaDre = (l) => l.movimento > 0 && ['RECEITA COM VENDAS', 'RECEITA COM SERVICOS', 'OUTRAS RECEITAS', 'REEMBOLSO RECEITA', 'RENDIMENTO FINANCEIRO'].includes(l.sub2);
export const custoDre = (l) => ['FORNECEDORES COGS', 'FORNECEODORES COGS', 'COMPRA DE MERCADORIA'].includes(l.classe) && ['COMPRAS DE MERCADORIAS', 'FRETE E CARRETO', 'ARMAZENAGEM E MANUSEIO'].includes(l.sub2);
export const guiaDre = (l) => l.classe === 'IMPOSTOS E CONTRIBUICOES' && ['ISS', 'INSS', 'IRPJ / CSLL'].includes(l.sub2);
export const pessoal = (l) => ['FOLHA, IMPOSTOS E ADIANTAMENTOS', 'PESSOAL PJ', 'DESPESA CLT', 'DESPESA PJ', 'RESCISAO'].includes(l.classe)
  || ['DESPESAS CLT', 'DESPESAS PJ', 'PRO-LABORE ( RETIRADA DE SOCIO )', 'COMISSAO DE VENDAS', 'REEMBOLSO'].includes(l.sub2);

export function indicadoresDfc(dfc, fixas = []) {
  const l = dfc.linhas;
  const entradas = l.filter(eReceita), saidas = l.filter((x) => x.movimento < 0);
  const rDre = l.filter(receitaDre), ded = l.filter(eDeducao), custos = l.filter(custoDre), guias = l.filter(guiaDre);
  const funcionarios = saidas.filter(pessoal), fixasPagas = saidas.filter((x) => fixas.includes(x.sub2));
  const receitaLiquidaDfc = soma(rDre.map((x) => x.movimento)) - soma(ded.map((x) => Math.abs(x.movimento)));
  const out = new Map();
  const add = (id, valor, linhas, fonte) => out.set(id, { valor, linhas, fonte });
  add('saldo', soma(l.map((x) => x.movimento)), l, 'DFC / FLUXO DE CAIXA; PAGAMENTO baixado; DIA PG ou VENCIMENTO no mês');
  add('receitas', soma(entradas.map((x) => x.movimento)), entradas, 'DFC / FLUXO DE CAIXA; entrada sem transferência');
  add('despesas', soma(saidas.map((x) => -x.movimento)), saidas, 'DFC / FLUXO DE CAIXA; saída baixada');
  const pagas = saidas.filter((x) => x.pagamento === 'PAGO');
  add('despesas-pagas', soma(pagas.map((x) => -x.movimento)), pagas, 'DFC / FLUXO DE CAIXA; saída com PAGAMENTO=PAGO');
  add('despesas-funcionarios', soma(funcionarios.map((x) => -x.movimento)), funcionarios, 'DFC / FLUXO DE CAIXA; classe ou SUB 2 de pessoal');
  add('percentual-funcionarios', receitaLiquidaDfc ? out.get('despesas-funcionarios').valor / receitaLiquidaDfc : null, funcionarios, 'DFC / FLUXO DE CAIXA; pessoal ÷ receita líquida');
  add('receita-total', soma(rDre.map((x) => x.movimento)), rDre, 'DFC / FLUXO DE CAIXA; SUB 2 de receita');
  add('custos-e-despesas', out.get('despesas').valor, saidas, 'DFC / FLUXO DE CAIXA; saídas');
  add('dre-deducoes', soma(ded.map((x) => Math.abs(x.movimento))), ded, 'DFC / FLUXO DE CAIXA; DEVOLUCAO ou ESTORNO');
  add('dre-custos-de-vendas', soma(custos.map((x) => Math.abs(x.movimento))), custos, 'DFC / FLUXO DE CAIXA; CLASS. CONTABIL e SUB 2 de custo');
  add('dre-impostos', soma(guias.map((x) => Math.abs(x.movimento))), guias, 'DFC / FLUXO DE CAIXA; guias pagas');
  add('fixas', soma(fixasPagas.map((x) => -x.movimento)), fixasPagas, 'DFC / FLUXO DE CAIXA; SUB 2 na resposta da gestora');
  add('peso-fixas', receitaLiquidaDfc ? out.get('fixas').valor / receitaLiquidaDfc : null, fixasPagas, 'DFC / FLUXO DE CAIXA; fixas ÷ receita líquida');
  return out;
}

export function lerCsvExtrato(texto, contaArquivo, mes) {
  const linhas = texto.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (!linhas.length) throw new Error('CSV vazio');
  const sep = linhas[0].includes(';') ? ';' : ',';
  const header = linhas.shift().split(sep).map((s) => normal(s));
  for (const col of ['DATA', 'VALOR', 'SALDO']) if (!header.includes(col)) throw new Error(`CSV sem coluna ${col}`);
  const decimal = (valor, i, col) => {
    const bruto = valor.replace(/^"|"$/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(bruto)) throw new Error(`CSV linha ${i + 2}: ${col} inválido`);
    return centavos(bruto);
  };
  return linhas.filter(Boolean).map((s, i) => {
    const campos = s.split(sep), get = (col) => campos[header.indexOf(col)]?.trim() ?? '';
    const data = get('DATA');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`CSV linha ${i + 2}: DATA deve ser AAAA-MM-DD`);
    if (data.slice(0, 7) !== mes) throw new Error(`CSV linha ${i + 2}: fora do mês`);
    return { conta: normal(contaArquivo), data, valor: decimal(get('VALOR'), i, 'VALOR'), saldo: decimal(get('SALDO'), i, 'SALDO'), id: get('ID') || `${i + 2}` };
  });
}

export function lerOfxExtrato(texto, conta, mes) {
  const transacoes = [...texto.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>))/gi)];
  const tag = (s, nome) => new RegExp(`<${nome}>([^<\r\n]+)`, 'i').exec(s)?.[1]?.trim() ?? '';
  const resultado = transacoes.map((m, i) => {
    const s = m[1], d = tag(s, 'DTPOSTED').slice(0, 8), valor = tag(s, 'TRNAMT');
    if (!/^\d{8}$/.test(d) || !/^-?\d+(?:\.\d{1,2})?$/.test(valor)) throw new Error(`OFX transação ${i + 1}: data ou valor inválido`);
    const data = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
    if (data.slice(0, 7) !== mes) throw new Error(`OFX transação ${i + 1}: fora do mês`);
    return { conta: normal(conta), data, valor: centavos(valor), id: tag(s, 'FITID') || `${i + 1}` };
  });
  const ledger = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|$)/i.exec(texto)?.[1] ?? '';
  const fechamento = tag(ledger, 'BALAMT');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(fechamento)) throw new Error('OFX sem LEDGERBAL/BALAMT');
  if (!resultado.length) {
    const d = tag(ledger, 'DTASOF').slice(0, 8);
    if (!/^\d{8}$/.test(d) || `${d.slice(0, 4)}-${d.slice(4, 6)}` !== mes) throw new Error('OFX sem transações: DTASOF fora do mês');
    return [{ conta: normal(conta), data: `${mes}-${d.slice(6)}`, valor: 0, id: 'saldo', saldoFinal: centavos(fechamento) }];
  }
  resultado[resultado.length - 1].saldoFinal = centavos(fechamento);
  return resultado;
}

export function reconciliar(dfc, extratos) {
  const chave = (l) => `${normal(l.conta ?? `${l.banco}--${l.bloco}`)}|${l.data?.a ? `${mesDe(l.data)}-${String(l.data.d).padStart(2, '0')}` : l.data}|${l.movimento ?? l.valor}`;
  const saldo = new Map();
  for (const l of dfc.linhas) saldo.set(chave(l), (saldo.get(chave(l)) ?? 0) + 1);
  for (const t of extratos) if (t.valor !== 0) saldo.set(chave(t), (saldo.get(chave(t)) ?? 0) - 1);
  const diferencas = [...saldo].filter(([, n]) => n !== 0);
  const porConta = new Map();
  for (const t of extratos) porConta.set(t.conta, [...(porConta.get(t.conta) ?? []), t]);
  let saldosDivergentes = 0, saldosAusentes = 0;
  for (const [conta, transacoes] of porConta) {
    const bruto = (dfc.brutas ?? []).filter((l) => normal(`${l.banco}--${l.bloco}`) === conta && l.saldo !== null);
    if (!bruto.length || !transacoes.length) { saldosAusentes++; continue; }
    const primeiras = bruto[0], aberturaDfc = primeiras.saldo - (dfc.linhas.includes(primeiras) ? primeiras.movimento : 0);
    const fechamentoDfc = aberturaDfc + soma(dfc.linhas.filter((l) => normal(`${l.banco}--${l.bloco}`) === conta).map((l) => l.movimento));
    const ordenadas = [...transacoes].sort((a, b) => a.data.localeCompare(b.data));
    const ultimo = ordenadas.at(-1);
    const saldoFinal = ultimo.saldoFinal ?? ultimo.saldo;
    const aberturaExtrato = ordenadas[0].saldo !== undefined
      ? ordenadas[0].saldo - ordenadas[0].valor
      : saldoFinal === undefined ? null : saldoFinal - soma(transacoes.map((t) => t.valor));
    if (saldoFinal === undefined || aberturaExtrato === null) { saldosAusentes++; continue; }
    for (let i = 1; i < ordenadas.length; i++) {
      if (ordenadas[i].saldo !== undefined && ordenadas[i - 1].saldo !== undefined
        && ordenadas[i].saldo - ordenadas[i - 1].saldo !== ordenadas[i].valor) saldosDivergentes++;
    }
    if (aberturaDfc !== aberturaExtrato || fechamentoDfc !== saldoFinal) saldosDivergentes++;
  }
  return { confere: diferencas.length === 0 && saldosDivergentes === 0 && saldosAusentes === 0,
    chavesDivergentes: diferencas.length, saldosDivergentes, saldosAusentes };
}

export function estado(expected, shown, motivo = null, tolerancia = 0) {
  if (motivo) {
    const diferenca = expected === null || expected === undefined || shown === null || shown === undefined ? null : shown - expected;
    return { estado: diferenca !== null && Math.abs(diferenca) > tolerancia ? 'divergente' : 'não auditável', diferenca, motivo };
  }
  if (expected === null || expected === undefined || shown === null || shown === undefined) return { estado: 'não auditável', diferenca: null, motivo: 'valor esperado ou mostrado indisponível' };
  const diferenca = shown - expected;
  return { estado: Math.abs(diferenca) <= tolerancia ? 'conferido' : 'divergente', diferenca, motivo: null };
}
