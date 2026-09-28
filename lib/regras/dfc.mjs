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

// A TRANSFERÊNCIA ENTRE CONTAS NO DFC — **decisão do dono, 27/09/2026:** transferência entre contas não é receita,
// entra numa conta e sai de outra. No Omie a marca é a categoria, e essas já saíam das somas desde 25/09/2026; no DFC
// a marca é o `SUB 2` da própria linha, e o cartão "Receitas" da Tela 1 ainda as contava — 107 linhas em agosto de
// 2026 contra as 101 de "Receita total" da Tela 2, seis a mais, todas com este `SUB 2`.
const DFC_TRANSFERENCIA_RECEITA_SUB2 = ['TRANSFERENCIAS BANCARIAS - RECEITA'];

// A RECEITA DO DFC NO CARTÃO "Receitas" DA TELA 1, NUM LUGAR SÓ: linha de entrada do mês, fora as de transferência.
// Não é a lista `DFC_RECEITA` da Tela 2 — o cartão da Tela 1 é a entrada do caixa, e a decisão de 27/09/2026 tirou
// dele só a transferência.
const eReceitaTela1Dfc = (l) => l.natureza === 'R' && !DFC_TRANSFERENCIA_RECEITA_SUB2.includes(l.sub2);
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
      // A POSIÇÃO DE CAIXA DE CADA DIA, das linhas `Inicial` e `Final` do mesmo quadro (quando existem). É o que o fluxo
      // diário do Fluxo de Caixa usa para começar a linha no caixa que o mês JÁ TINHA no dia 1, e não no zero.
      posicao: {
        inicial: rotulo.has('INICIAL') ? valoresDe(rotulo.get('INICIAL')) : null,
        final: rotulo.has('FINAL') ? valoresDe(rotulo.get('FINAL')) : null,
      },
    };
  }
  return null;
}

// ---------------------------------------------------------------- a pasta, uma vez; o mês, uma vez
//
// POR QUE ESTA PARTE É QUATRO FUNÇÕES, E NÃO UMA. Até 27/09/2026 era só `lerDfc`, e ela fazia tudo a cada chamada:
// listava a pasta, abria o arquivo do mês, e — quando a série do ano era pedida — abria os doze arquivos DE NOVO só
// para pegar o bloco `Entradas`/`Gastos` de cada um. Um clique de filtro na Tela 1 custava treze aberturas de
// planilha (medido: 7,2 s em `docs/desempenho.md`), e a Tela 2, que lê os doze meses, custava outras doze. O filtro
// não muda nada disso — a planilha é a mesma e o recorte é aplicado DEPOIS —, então quem lê passou a poder guardar o
// que leu (`lib/regras/base-local.mjs`). Para isso a leitura foi separada em pedaços que se guardam:
//
//   `arquivosDoDfc`  → a lista de nomes da pasta, uma vez para todos os meses
//   `lerMesDoDfc`    → UM mês, aberto uma vez, com tudo o que sai daquele arquivo
//   `serieDeUmMes`   → a entrada da série do ano de um mês, tirada da leitura acima, sem reabrir nada
//
// `lerDfc` continua existindo e continua devolvendo exatamente o mesmo objeto: é por ela que os scripts da
// conferência leem um mês só.
async function arquivosDoDfc(fonte) {
  if (!fonte.disponivel()) return { ok: false, motivo: fonte.descrever() };
  try { return { ok: true, nomes: await fonte.arquivos() }; }
  catch (e) { return { ok: false, motivo: `não deu para listar os arquivos do DFC: ${e.message}` }; }
}

// Lê o `FLUXO DE CAIXA` do arquivo do mês. Uma linha por lançamento, com a classificação que a própria planilha
// escreve — `CLASS. CONTABIL` (I) e `SUB 2` (J) —, a data em `DIA PG` (F) e o sinal na coluna `ENTRADA` (K). O
// cabeçalho se repete, um bloco por banco, e as colunas são achadas pelo nome, nunca pela letra.
//
// `abaDoMes` SAI DAQUI MESMO QUANDO O ARQUIVO NÃO TEM `FLUXO DE CAIXA`. Ele é o bloco pronto
// `Inicial`/`Entradas`/`Gastos`/`Final` da primeira aba, e é tudo de que a série do ano precisa; devolvê-lo junto do
// motivo é o que deixa a série sair da MESMA abertura do arquivo, como antes ela saía de uma abertura própria.
async function lerMesDoDfc({ fonte, ano, mes, arquivos }) {
  if (!arquivos.ok) return { ok: false, motivo: arquivos.motivo, abaDoMes: null };
  const arq = arquivos.nomes.find((f) => new RegExp(`^0?${mes}\\s*-`).test(f));
  if (!arq) return { ok: false, motivo: `a pasta da MeuBESS não tem o arquivo do mês ${String(mes).padStart(2, '0')}`, abaDoMes: null };
  const zip = lerZip(await fonte.ler(arq));
  const ss = sharedStrings(zip);
  const abas = abasDo(zip);
  // A ABA DO MÊS: o bloco pronto que os dois gráficos de "Receita × despesa" usam — `Inicial` (42), `Entradas` (43),
  // `Gastos` (44) e `Final` (45), uma coluna por dia.
  const abaDoMes = blocoDoMes(zip, ss, abas);
  const aba = abas.find((a) => norm(a.nome) === 'FLUXO DE CAIXA');
  if (!aba) return { ok: false, motivo: `o arquivo ${arq} não tem a aba FLUXO DE CAIXA`, arquivo: arq, abaDoMes };
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
    let dataDe = null;
    for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(mapa.get(rot))); if (dt) { dataDe = rot; break; } }
    if (!dt || dt.a !== ano || dt.m !== mes) continue;
    // `dataDe` diz de que coluna o dia saiu: `DIA PG` (pago naquele dia) ou, sem ele, `VENCIMENTO` / `TIPO`. Não muda
    // conta nenhuma; é o que o diagnóstico do fluxo diário (`scripts/diagnostico-dia-a-dia.mjs`) precisa para dizer
    // quantos lançamentos caíram num dia pelo vencimento, e não pelo pagamento.
    linhas.push({ linha: l.n, classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: sub2 || '(vazio)', natureza: bruto > 0 ? 'R' : 'P', pagamento, dia: dt.d, valor: cent(bruto), dataDe });
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
  return { ok: true, arquivo: arq, linhas, cruas, abaDoMes };
}

// UMA LEITURA DE MÊS QUE NÃO DERRUBA QUEM LÊ VÁRIOS. Arquivo corrompido vira `{ ok: false }` com o motivo, como já
// acontecia na série do ano e na Tela 2 — e não uma exceção no meio dos doze meses.
async function lerMesSemDerrubar(args) {
  try { return await lerMesDoDfc(args); }
  catch (e) { return { ok: false, motivo: `não deu para abrir: ${e.message}`, abaDoMes: null }; }
}

// A ENTRADA DA SÉRIE DO ANO DE UM MÊS: só o bloco `Entradas`/`Gastos`, que é o que o gráfico de "Receita × despesa por
// mês" desenha. Sai do mês JÁ LIDO — e um mês sem `FLUXO DE CAIXA` continua entrando na série se o bloco estiver lá,
// exatamente como quando a série abria o arquivo por conta própria.
function serieDeUmMes(mes, r) {
  const b = r.abaDoMes;
  if (!b) return { mes, ok: false, colunas: 0, motivo: r.motivo ?? 'sem o bloco Entradas/Gastos', porDia: null };
  return { mes, ok: Boolean(b.temEntradas && b.temGastos), colunas: b.colunas, motivo: null, porDia: b.porDia };
}

// UM MÊS, COM A SÉRIE DO ANO SE PEDIDA — a função de sempre, com o mesmo retorno de sempre. Quem lê um mês só (os
// scripts da conferência) chama esta; as telas leem pela base local, que guarda mês por mês.
async function lerDfc({ fonte, ano, mes, comSerie = true }) {
  const arquivos = await arquivosDoDfc(fonte);
  const r = await lerMesDoDfc({ fonte, ano, mes, arquivos });
  if (!r.ok) return r;
  // Sem a série pedida, a chave sai vazia e não ausente: é o que esta função sempre devolveu.
  if (!comSerie) return { ...r, serie: [] };
  // A SÉRIE DO ANO: um arquivo por mês na mesma pasta. O mês pedido já está lido e não é reaberto.
  const serie = [];
  for (let m = 1; m <= 12; m++) serie.push(serieDeUmMes(m, m === mes ? r : await lerMesSemDerrubar({ fonte, ano, mes: m, arquivos })));
  return { ...r, serie };
}

export {
  norm, cent, blocoDoMes, arquivosDoDfc, lerMesDoDfc, lerMesSemDerrubar, serieDeUmMes, lerDfc,
  ePessoalDfc, eDeducaoDfc, eReceitaTela1Dfc,
  DFC_RECEITA, DFC_TRANSFERENCIA_RECEITA_SUB2, DFC_PESSOAL_CLASSE, DFC_PESSOAL_SUB2, DFC_CUSTO_CLASSE, DFC_CUSTO_SUB2, DFC_IMPOSTO_SUB2, DFC_FINANCEIRO_SUB2,
};
