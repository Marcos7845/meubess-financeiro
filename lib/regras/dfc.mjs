// O DFC: o vocabulário da planilha e a leitura do `FLUXO DE CAIXA` — a fonte única dessas regras.
//
// Saiu de `scripts/numeros-das-telas.mjs` quando o app começou. O script da conferência e a camada de dados do app
// leem por AQUI, pela mesma função, com os mesmos filtros. De onde vêm os arquivos é problema de `dfc-fonte.mjs`.
//
// A ÚNICA DIFERENÇA para a versão que vivia no script: esta guarda o VALOR de cada linha, em centavos, porque a tela
// mostra dinheiro. A conferência não lê esse campo — ela conta linhas — e `docs/conferencia.md` segue sem um número
// em reais. Valor lido aqui fica na memória do servidor e vai para a tela; não é gravado em arquivo versionado.

import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula, COLUNAS_DE_DIA, SUB2_SALDO, COLUNAS_DE_DATA, BAIXADO } from './xlsx.mjs';

const norm = (s) => String(s ?? '').toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cent = (v) => Math.round(Number(v ?? 0) * 100);

// O VOCABULÁRIO DO DFC, como `docs/fontes.md` o escreve — já passado pelo `norm` (maiúscula, sem acento), que é como
// as linhas da planilha são guardadas. Nenhuma lista aqui é heurística: cada uma copia a linha do documento.
const DFC_RECEITA = ['RECEITA COM VENDAS', 'RECEITA COM SERVICOS', 'OUTRAS RECEITAS', 'REEMBOLSO RECEITA', 'RENDIMENTO FINANCEIRO'];
const DFC_PESSOAL_CLASSE = ['FOLHA, IMPOSTOS E ADIANTAMENTOS', 'PESSOAL PJ', 'DESPESA CLT', 'DESPESA PJ', 'RESCISAO'];
const DFC_PESSOAL_SUB2 = ['DESPESAS CLT', 'DESPESAS PJ', 'PRO-LABORE ( RETIRADA DE SOCIO )', 'COMISSAO DE VENDAS', 'REEMBOLSO'];
// `FORNECEODORES COGS` é a MESMA conta escrita com erro de digitação na planilha (2 linhas em agosto de 2026, e só
// nesse mês dos doze): conta em custo de vendas do mesmo jeito, e a regra aceita as duas grafias (decisão do dono,
// 25/09/2026, "sim fornecedor COGS é custo de vendas").
const DFC_CUSTO_CLASSE = ['FORNECEDORES COGS', 'FORNECEODORES COGS', 'COMPRA DE MERCADORIA'];
const DFC_CUSTO_SUB2 = ['COMPRAS DE MERCADORIAS', 'FRETE E CARRETO', 'ARMAZENAGEM E MANUSEIO'];
const DFC_IMPOSTO_SUB2 = ['ISS', 'INSS', 'IRPJ / CSLL'];
const DFC_FINANCEIRO_SUB2 = ['JUROS', 'RENDIMENTO FINANCEIRO', 'EMPRESTIMO', 'TARIFAS BANCARIAS'];

// AS LINHAS DE DEDUÇÃO no DFC, como a linha "(−) Deduções" do DRE as define (decisão do dono, 24/09/2026): a
// devolução vem marcada na PRÓPRIA linha, por uma das duas marcas.
const eDeducaoDfc = (l) => l.sub2 === 'DEVOLUCAO' || l.classe === 'ESTORNO';
const ePessoalDfc = (l) => l.natureza === 'P' && (DFC_PESSOAL_CLASSE.includes(l.classe) || DFC_PESSOAL_SUB2.includes(l.sub2));

// O bloco `Inicial` / `Entradas` / `Gastos` / `Final` da primeira aba do arquivo do mês, achado pelo RÓTULO da linha
// (coluna B) e não pelo número dela. Devolve a forma — qual linha tem cada rótulo e quantas colunas de dia existem —
// e, em `porDia`, os valores dessas colunas, que é o que os dois gráficos de "Receita × despesa" desenham.
function blocoDoMes(zip, ss, abas) {
  for (const a of abas) {
    const linhas = lerAba(zip, a.parte, ss);
    if (!linhas) continue;
    const rotulo = new Map();
    for (const l of linhas) for (const [col, c] of l.cel) if (col === 'B' && c.t) rotulo.set(norm(c.t), l.n);
    const nEnt = rotulo.get('ENTRADAS'), nGas = rotulo.get('GASTOS');
    if (!nEnt || !nGas || nEnt === nGas) continue;
    const daLinha = (n) => linhas.find((l) => l.n === n);
    const colunasDe = (n) => [...(daLinha(n)?.cel ?? new Map()).keys()].filter((c) => COLUNAS_DE_DIA.has(c));
    const colunas = colunasDe(nEnt).length;
    // Os valores das colunas de dia, na ordem das colunas — `D` é o dia 1. Em centavos.
    const valoresDe = (n) => {
      const cel = daLinha(n)?.cel ?? new Map();
      return colunasDe(n).map((c) => cent(cel.get(c)?.v ?? 0));
    };
    return {
      aba: a.nome, colunas,
      temInicial: rotulo.has('INICIAL'), temEntradas: true, temGastos: true, temFinal: rotulo.has('FINAL'),
      linhaInicial: rotulo.get('INICIAL') ?? null, linhaEntradas: nEnt, linhaGastos: nGas, linhaFinal: rotulo.get('FINAL') ?? null,
      linhaReceitas: rotulo.get('RECEITAS') ?? null,
      porDia: { entradas: valoresDe(nEnt), gastos: valoresDe(nGas) },
    };
  }
  return null;
}

// Lê o `FLUXO DE CAIXA` do arquivo do mês. Uma linha por lançamento, com a classificação que a própria planilha
// escreve — `CLASS. CONTABIL` (I) e `SUB 2` (J) —, a data em `DIA PG` (F) e o sinal na coluna `ENTRADA` (K). O
// cabeçalho se repete, um bloco por banco, e as colunas são achadas pelo nome, nunca pela letra.
async function lerDfc({ fonte, ano, mes, comSerie = true }) {
  if (!fonte.disponivel()) return { ok: false, motivo: fonte.descrever() };
  let nomes;
  try { nomes = await fonte.arquivos(); } catch (e) { return { ok: false, motivo: `não deu para listar os arquivos do DFC: ${e.message}` }; }
  const arq = nomes.find((f) => new RegExp(`^0?${mes}\\s*-`).test(f));
  if (!arq) return { ok: false, motivo: `a pasta da MeuBESS não tem o arquivo do mês ${String(mes).padStart(2, '0')}` };
  const zip = lerZip(await fonte.ler(arq));
  const ss = sharedStrings(zip);
  const aba = abasDo(zip).find((a) => norm(a.nome) === 'FLUXO DE CAIXA');
  if (!aba) return { ok: false, motivo: `o arquivo ${arq} não tem a aba FLUXO DE CAIXA` };
  const linhas = [];
  let mapa = null;
  for (const l of lerAba(zip, aba.parte, ss)) {
    const textos = [...l.cel.entries()].filter(([, c]) => c.t);
    const rotulos = textos.map(([, c]) => norm(c.t));
    if (rotulos.includes('VENCIMENTO') && rotulos.includes('DIA PG')) { mapa = new Map(textos.map(([col, c]) => [norm(c.t), col])); continue; }
    if (!mapa) continue;
    const texto = (r) => { const c = l.cel.get(mapa.get(r)); return c?.t ? c.t.trim() : ''; };
    const numero = (r) => { const c = l.cel.get(mapa.get(r)); return c?.v !== undefined ? c.v : 0; };
    const sub2 = norm(texto('SUB 2'));
    if (SUB2_SALDO.has(sub2)) continue;
    const k = numero('ENTRADA'), lv = numero('SAIDA');
    const bruto = cent(k) !== 0 ? k : lv;
    if (cent(bruto) === 0) continue;
    const pagamento = norm(texto('PAGAMENTO'));
    if (!BAIXADO(pagamento)) continue;
    let dt = null;
    for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(mapa.get(rot))); if (dt) break; }
    if (!dt || dt.a !== ano || dt.m !== mes) continue;
    linhas.push({ linha: l.n, classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: sub2 || '(vazio)', natureza: bruto > 0 ? 'R' : 'P', pagamento, dia: dt.d, valor: cent(bruto) });
  }
  // A VOLTA, para conferir o caso: relê a MESMA aba do zero, sem filtro nenhum, e guarda uma entrada por número de
  // linha. É o caminho contrário do de cima — como a releitura das páginas cruas do cache no lado do Omie.
  const cruas = new Map();
  {
    let m2 = null;
    for (const l of lerAba(zip, aba.parte, ss)) {
      const textos = [...l.cel.entries()].filter(([, c]) => c.t);
      const rotulos = textos.map(([, c]) => norm(c.t));
      if (rotulos.includes('VENCIMENTO') && rotulos.includes('DIA PG')) { m2 = new Map(textos.map(([col, c]) => [norm(c.t), col])); continue; }
      if (!m2) continue;
      const texto = (r) => { const c = l.cel.get(m2.get(r)); return c?.t ? c.t.trim() : ''; };
      const numero = (r) => { const c = l.cel.get(m2.get(r)); return c?.v !== undefined ? c.v : 0; };
      let dt = null;
      for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(m2.get(rot))); if (dt) break; }
      const k = numero('ENTRADA'), lv = numero('SAIDA');
      const bruto = cent(k) !== 0 ? k : lv;
      cruas.set(l.n, {
        classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: norm(texto('SUB 2')) || '(vazio)',
        pagamento: norm(texto('PAGAMENTO')), natureza: cent(bruto) === 0 ? '(sem)' : (bruto > 0 ? 'R' : 'P'),
        mes: dt ? `${dt.m}/${dt.a}` : '(sem data)', dia: dt?.d ?? null,
      });
    }
  }
  // A ABA DO MÊS: o bloco pronto que os dois gráficos de "Receita × despesa" usam — `Inicial` (42), `Entradas` (43),
  // `Gastos` (44) e `Final` (45), uma coluna por dia.
  const abaDoMes = blocoDoMes(zip, ss, abasDo(zip));
  // A SÉRIE DO ANO: um arquivo por mês na mesma pasta. Só o bloco `Entradas`/`Gastos` de cada um.
  const serie = [];
  if (comSerie) {
    for (let m = 1; m <= 12; m++) {
      const a = nomes.find((f) => new RegExp(`^0?${m}\\s*-`).test(f));
      if (!a) { serie.push({ mes: m, ok: false, motivo: 'sem arquivo na pasta' }); continue; }
      try {
        const z = lerZip(await fonte.ler(a));
        const b = blocoDoMes(z, sharedStrings(z), abasDo(z));
        serie.push({ mes: m, ok: Boolean(b?.temEntradas && b?.temGastos), colunas: b?.colunas ?? 0, motivo: b ? null : 'sem o bloco Entradas/Gastos', porDia: b?.porDia ?? null });
      } catch (e) { serie.push({ mes: m, ok: false, motivo: `não deu para abrir: ${e.message}` }); }
    }
  }
  return { ok: true, arquivo: arq, linhas, cruas, abaDoMes, serie };
}

export {
  norm, cent, blocoDoMes, lerDfc, ePessoalDfc, eDeducaoDfc,
  DFC_RECEITA, DFC_PESSOAL_CLASSE, DFC_PESSOAL_SUB2, DFC_CUSTO_CLASSE, DFC_CUSTO_SUB2, DFC_IMPOSTO_SUB2, DFC_FINANCEIRO_SUB2,
};
