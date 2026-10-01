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
  const linhas = [], brutas = [], cabecalhos = [], titulos = new Map();
  let colunas = null, bloco = 0, bancoAtual = '', anterior = null;
  for (const r of lerAba(zip, fluxo.parte, strings)) {
    const textos = [...r.cel].filter(([, c]) => c.t).map(([c, v]) => [normal(v.t), c]);
    if (textos.some(([s]) => s === 'VENCIMENTO') && textos.some(([s]) => s === 'DIA PG')) {
      colunas = new Map(textos); bloco++; bancoAtual = '';
      cabecalhos.push(r.n);
      // O título do bloco ("BANCO STONE", "DINHEIRO"...) fica na linha logo acima do cabeçalho repetido.
      titulos.set(bloco, anterior?.n === r.n - 1 ? [...anterior.cel.values()].map((c) => normal(c.t)).find(Boolean) ?? '' : '');
      anterior = r;
      continue;
    }
    anterior = r;
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
    const linha = { n: r.n, bloco, banco: bancoAtual, empDfc: txt('EMP.'), sub2, classe, pagamento,
      dataPg, vencimento, data, movimento, saldo: num('SALDO') === undefined ? null : centavos(num('SALDO')) };
    brutas.push(linha);
    if (!movimento || ['SALDO INICIAL', 'SALDO FINAL', 'SALDO INICIAL PROVISAO', 'SALDO FINAL PROVISAO'].includes(sub2)) continue;
    if (!pagamento || pagamento === 'A PAGAR' || pagamento === 'A RECEBER') continue;
    if (!data || data.a !== ano || data.m !== mes) continue;
    linhas.push(linha);
  }
  // A conta de cada bloco: o título do bloco ou, sem título, o primeiro BANCO escrito nele, mais a ordem do bloco.
  const bancoDoBloco = new Map();
  for (const l of brutas) if (l.banco && !bancoDoBloco.has(l.bloco)) bancoDoBloco.set(l.bloco, l.banco);
  for (const l of brutas) l.conta = `${titulos.get(l.bloco) || bancoDoBloco.get(l.bloco) || 'SEM NOME'}--${l.bloco}`;
  return { abas: abas.map((a) => a.nome), cabecalhos, linhas, brutas };
}

// Abertura de cada conta do DFC: a primeira linha SALDO INICIAL do bloco (coluna SALDO; vazia, a ENTRADA).
export function aberturasDfc(dfc) {
  const out = new Map(), lidas = new Set();
  for (const l of dfc.brutas ?? []) {
    if (!out.has(l.conta)) out.set(l.conta, 0);
    if (!lidas.has(l.conta) && ['SALDO INICIAL', 'SALDO NICIAL'].includes(l.sub2)) {
      out.set(l.conta, l.saldo ?? l.movimento ?? 0);
      lidas.add(l.conta);
    }
  }
  return out;
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
    return { conta: normal(contaArquivo), data, valor: decimal(get('VALOR'), i, 'VALOR'), saldo: decimal(get('SALDO'), i, 'SALDO'), id: get('ID') || `${i + 2}`,
      historico: get('HISTORICO') || get('DESCRICAO') };
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
    return { conta: normal(conta), data, valor: centavos(valor), id: tag(s, 'FITID') || `${i + 1}`,
      historico: tag(s, 'MEMO') || tag(s, 'NAME') };
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

// Conciliação conta a conta. Cada transação do extrato casa com uma linha do DFC de mesma data e valor; depois com
// uma de mesmo valor e data deslocada até `folga` dias; depois com várias linhas do DFC que somam exatamente o valor
// (o banco junta um lote num débito só), ou o contrário; por último, o que sobra no mesmo dia dos dois lados, se as
// somas forem iguais ao centavo. Diferenças de até cinco centavos usam a folga de data aplicável.
// Um crédito de maquininha que corresponde a venda no DFC pode casar no quinto dia, inclusive em grupo.
// O que não casa fica listado. Abertura e fechamento da conta também precisam fechar.
export function reconciliar(dfc, extratos, { folga = 4, provas = new Map() } = {}) {
  const toleranciaCentavos = 5;
  const contaDe = (l) => normal(l.conta ?? `${l.banco}--${l.bloco}`);
  const diaDe = (l) => (l.data?.a ? l.data.d : Number(String(l.data).slice(8, 10)));
  const aberturas = new Map([...aberturasDfc(dfc)].map(([k, v]) => [normal(k), v]));
  const porConta = new Map(), casadas = new Map();
  for (const conta of new Set(extratos.map((t) => normal(t.conta)))) {
    const dfcL = dfc.linhas.filter((l) => contaDe(l) === conta).map((l) => ({ n: l.n, dia: diaDe(l), v: l.movimento, sub2: l.sub2, par: null }));
    const ext = extratos.filter((t) => normal(t.conta) === conta && t.valor !== 0)
      .map((t) => ({ id: t.id, dia: diaDe(t), v: t.valor, historico: normal(t.historico), par: null }));
    const tipos = { exato: 0, deslocado: 0, agrupado: 0, loteDoDia: 0, centavos: 0 };
    const diferencasCentavos = [], datasMaquininha = [], gruposMaquininha = [], pendenciasData = [];
    const creditoMaquininha = (t) => t.v > 0 && !/\b(PIX|TED)\b/.test(t.historico)
      && (/\b(MAQUININHA|RECEBIVEL|ANTECIPACAO|CARTAO)\b/.test(t.historico)
        || (/\bSTONE\b/.test(conta) && t.historico.startsWith('CREDITO TRANSFERENCIA ENTRE')));
    const casar = (ls, ts, tipo) => {
      for (const l of ls) l.par = ts.map((t) => t.id);
      for (const t of ts) t.par = ls.map((l) => l.n);
      tipos[tipo]++;
      const diferenca = soma(ts.map((t) => t.v)) - soma(ls.map((l) => l.v));
      if (diferenca) diferencasCentavos.push({ linhas: ls.map((l) => l.n), transacoes: ts.map((t) => t.id), diferenca });
      if ((ls.length > 1 || ts.length > 1) && ls.every((l) => l.v > 0 && l.sub2 === 'RECEITA COM VENDAS')
        && ts.every(creditoMaquininha)) gruposMaquininha.push({
        linhas: ls.map((l) => ({ n: l.n, valor: l.v })),
        creditos: ts.map((t) => ({ id: t.id, valor: t.v })),
        diferenca, dias: Math.max(...ls.flatMap((l) => ts.map((t) => Math.abs(l.dia - t.dia))), 0),
      });
    };
    for (const t of ext) { const l = dfcL.find((x) => !x.par && x.dia === t.dia && x.v === t.v); if (l) casar([l], [t], 'exato'); }
    for (const t of ext.filter((x) => !x.par)) {
      const l = dfcL.filter((x) => !x.par && x.v === t.v && Math.abs(x.dia - t.dia) <= folga)
        .sort((a, b) => Math.abs(a.dia - t.dia) - Math.abs(b.dia - t.dia))[0];
      if (l) casar([l], [t], 'deslocado');
    }
    const subconjunto = (cands, alvo) => {
      let somas = new Map([[0, []]]);
      for (const c of cands) {
        const novas = new Map(somas);
        for (const [s, arr] of somas) if (!novas.has(s + c.v) && arr.length < 15) novas.set(s + c.v, [...arr, c]);
        somas = novas;
        if (somas.has(alvo) || somas.size > 200000) break;
      }
      const r = somas.get(alvo);
      return r && r.length > 1 ? r : null;
    };
    for (const [um, muitos, doExtrato] of [[ext, dfcL, true], [dfcL, ext, false]]) {
      for (const u of um.filter((x) => !x.par)) {
        for (let tol = 0; tol <= folga; tol++) {
          const grupo = subconjunto(muitos.filter((x) => !x.par && Math.sign(x.v) === Math.sign(u.v) && Math.abs(x.dia - u.dia) <= tol), u.v);
          if (grupo) { if (doExtrato) casar(grupo, [u], 'agrupado'); else casar([u], grupo, 'agrupado'); break; }
        }
      }
    }
    for (const dia of new Set([...dfcL, ...ext].filter((x) => !x.par).map((x) => x.dia))) {
      const ls = dfcL.filter((x) => !x.par && x.dia === dia), ts = ext.filter((x) => !x.par && x.dia === dia);
      if (ls.length && ts.length && soma(ls.map((x) => x.v)) === soma(ts.map((x) => x.v))) casar(ls, ts, 'loteDoDia');
    }
    // Primeiro preserva todos os casamentos exatos. Depois procura o menor desvio por grupo,
    // sem ampliar a folga de data e sem compensar diferenças entre grupos distintos.
    const subconjuntoProximo = (cands, alvo, minimo = 1) => {
      let somas = new Map([[0, []]]);
      for (const c of cands) {
        const novas = new Map(somas);
        for (const [s, arr] of somas) if (!novas.has(s + c.v) && arr.length < 15) novas.set(s + c.v, [...arr, c]);
        somas = novas;
        if (somas.size > 200000) break;
      }
      return [...somas].filter(([s, arr]) => arr.length >= minimo && s !== alvo
        && Math.abs(s - alvo) <= toleranciaCentavos)
        .sort((a, b) => Math.abs(a[0] - alvo) - Math.abs(b[0] - alvo) || a[1].length - b[1].length)[0]?.[1] ?? null;
    };
    const pares = ext.flatMap((t, i) => ext.slice(i + 1)
      .filter((u) => !t.par && !u.par && t.dia === u.dia && Math.sign(t.v) === Math.sign(u.v))
      .map((u) => [t, u]));
    for (const ts of [...pares, ...ext.map((t) => [t])]) {
      if (ts.some((t) => t.par)) continue;
      const alvo = soma(ts.map((t) => t.v));
      const ls = subconjuntoProximo(dfcL.filter((l) => !l.par && Math.sign(l.v) === Math.sign(alvo)
        && ts.every((t) => Math.abs(l.dia - t.dia) <= folga)), alvo, ts.length === 1 ? 1 : 2);
      if (ls) casar(ls, ts, 'centavos');
    }
    // Só a venda recebida pela maquininha ganha o quinto dia. O histórico do crédito
    // precisa indicar recebível/cartão, ou transferência interna da própria Stone.
    for (const l of dfcL.filter((x) => !x.par && x.v > 0 && x.sub2 === 'RECEITA COM VENDAS')) {
      const candidatos = ext.filter((t) => !t.par && creditoMaquininha(t) && Math.abs(t.dia - l.dia) === 5);
      const grupos = [...candidatos.map((t) => [t]), ...candidatos.flatMap((t, i) => candidatos.slice(i + 1)
        .filter((u) => u.dia === t.dia).map((u) => [t, u]))];
      const ts = grupos.filter((g) => Math.abs(soma(g.map((t) => t.v)) - l.v) <= toleranciaCentavos)
        .sort((a, b) => Math.abs(soma(a.map((t) => t.v)) - l.v) - Math.abs(soma(b.map((t) => t.v)) - l.v)
          || a.length - b.length)[0];
      if (!ts) continue;
      casar([l], ts, soma(ts.map((t) => t.v)) === l.v ? 'deslocado' : 'centavos');
      datasMaquininha.push({ linhas: [l.n], transacoes: ts.map((t) => t.id), dias: 5,
        diferenca: soma(ts.map((t) => t.v)) - l.v });
    }
    // A Stone pode creditar juntas vendas que o DFC separa por projeto, ou dividir
    // um recebimento em mais de um crédito. Cada parte precisa ser venda/maquininha
    // e estar dentro da própria janela; PIX, TED e saídas não entram no grupo.
    const casarGrupoMaquininha = (ls, ts) => {
      const diferenca = soma(ts.map((t) => t.v)) - soma(ls.map((l) => l.v));
      casar(ls, ts, diferenca ? 'centavos' : 'agrupado');
    };
    const subconjuntoMaquininha = (candidatos, alvo) => {
      // Conserva separadamente somas feitas com uma e com várias parcelas.
      // Assim uma parcela isolada não esconde um grupo de mesmo total.
      let somas = new Map([['0|0', { valor: 0, itens: [] }]]);
      for (const candidato of candidatos) {
        const novas = new Map(somas);
        for (const { valor, itens } of somas.values()) {
          if (itens.length >= 15) continue;
          const proxima = { valor: valor + candidato.v, itens: [...itens, candidato] };
          const chave = `${proxima.valor}|${Math.min(proxima.itens.length, 2)}`;
          if (!novas.has(chave)) novas.set(chave, proxima);
        }
        somas = novas;
        if (somas.size > 200000) break;
      }
      return [...somas.values()].filter(({ valor, itens }) => itens.length >= 2
        && Math.abs(valor - alvo) <= toleranciaCentavos)
        .sort((a, b) => Math.abs(a.valor - alvo) - Math.abs(b.valor - alvo)
          || a.itens.length - b.itens.length)[0]?.itens ?? null;
    };
    for (const t of ext.filter((x) => !x.par && creditoMaquininha(x))) {
      const ls = subconjuntoMaquininha(dfcL.filter((l) => !l.par && l.v > 0
        && l.sub2 === 'RECEITA COM VENDAS' && Math.abs(l.dia - t.dia) <= 5), t.v);
      if (ls) casarGrupoMaquininha(ls, [t]);
    }
    for (const l of dfcL.filter((x) => !x.par && x.v > 0 && x.sub2 === 'RECEITA COM VENDAS')) {
      const ts = subconjuntoMaquininha(ext.filter((t) => !t.par && creditoMaquininha(t)
        && Math.abs(l.dia - t.dia) <= 5), l.v);
      if (ts) casarGrupoMaquininha([l], ts);
    }
    // Uma proximidade de valor fora da janela é informativa, mas não produz casamento.
    for (const l of dfcL.filter((x) => !x.par)) {
      const ts = ext.filter((t) => !t.par && Math.sign(t.v) === Math.sign(l.v)
        && Math.abs(t.dia - l.dia) === folga + 1);
      const paresDoDia = ts.flatMap((t, i) => ts.slice(i + 1).filter((u) => u.dia === t.dia).map((u) => [t, u]));
      const par = paresDoDia.find((grupo) => {
        const diferenca = soma(grupo.map((t) => t.v)) - l.v;
        return diferenca && Math.abs(diferenca) <= toleranciaCentavos;
      });
      if (par) pendenciasData.push({ linhas: [l.n], transacoes: par.map((t) => t.id),
        diferenca: soma(par.map((t) => t.v)) - l.v, dias: folga + 1 });
    }
    for (const l of dfcL) if (l.par) casadas.set(l.n, l.par);
    const ordenadas = extratos.filter((t) => normal(t.conta) === conta).sort((a, b) => a.data.localeCompare(b.data));
    const ultimo = ordenadas.at(-1);
    const fechamentoExtrato = ultimo?.saldoFinal ?? ultimo?.saldo ?? null;
    const aberturaExtrato = ordenadas[0]?.saldo !== undefined ? ordenadas[0].saldo - ordenadas[0].valor
      : fechamentoExtrato === null ? null : fechamentoExtrato - soma(ordenadas.map((t) => t.valor));
    let saltos = 0;
    for (let i = 1; i < ordenadas.length; i++)
      if (ordenadas[i].saldo !== undefined && ordenadas[i - 1].saldo !== undefined
        && ordenadas[i].saldo - ordenadas[i - 1].saldo !== ordenadas[i].valor) saltos++;
    const aberturaDfc = aberturas.has(conta) ? aberturas.get(conta) : null;
    const fechamentoDfc = aberturaDfc === null ? null : aberturaDfc + soma(dfcL.map((x) => x.v));
    const prova = provas.get(conta) ?? null;
    const r = {
      conta, tipos, diferencasCentavos, datasMaquininha, gruposMaquininha, pendenciasData, linhasDfc: dfcL.length, transacoes: ext.length, prova,
      soDfc: dfcL.filter((x) => !x.par).map((x) => x.n), soExtrato: ext.filter((x) => !x.par).map((x) => x.id),
      aberturaDfc, aberturaExtrato, fechamentoDfc, fechamentoExtrato, saltos,
      mesInteiro: prova?.cobreMesInteiro !== false,
    };
    const diferencaAceita = soma(diferencasCentavos.map((d) => d.diferenca));
    r.saldosFecham = aberturaDfc !== null && aberturaExtrato !== null && aberturaDfc === aberturaExtrato
      && fechamentoDfc + diferencaAceita === fechamentoExtrato && !saltos;
    r.confere = r.saldosFecham && r.mesInteiro && !r.soDfc.length && !r.soExtrato.length;
    porConta.set(conta, r);
  }
  const lista = [...porConta.values()];
  return {
    confere: lista.length > 0 && lista.every((x) => x.confere), porConta, casadas,
    chavesDivergentes: soma(lista.map((x) => x.soDfc.length + x.soExtrato.length)),
    saldosDivergentes: lista.filter((x) => !x.saldosFecham && x.aberturaExtrato !== null && x.aberturaDfc !== null).length,
    saldosAusentes: lista.filter((x) => x.aberturaExtrato === null || x.aberturaDfc === null).length,
  };
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
