#!/usr/bin/env node
// SUGESTÃO DE GRUPOS DO DRE, A PARTIR DO PLANO DE CATEGORIAS DO OMIE
//
// Lê o cadastro de categorias das empresas 1 e 2 que já está no cache local (`.cache/omie/`, fora do git) e sugere,
// pelo NOME da categoria e pela CONTA DO DRE dela, quais são: (a) dedução da receita, (b) custo de vendas,
// (c) depreciação e amortização, (d) resultado financeiro. Grava `docs/categorias-do-dre.html`.
//
// SÓ LEITURA, E NEM ISSO NA API: este script não chama o Omie. Ele lê as respostas que o
// `scripts/confronto-dfc-omie.mjs` já gravou no cache. Nada é escrito no Omie nem nas planilhas.
//
// O QUE ELE NÃO FAZ: ele não decide nada. As lacunas de dedução, custo de vendas, EBITDA e resultado financeiro de
// `docs/fontes.md` seguem abertas — quem fecha é o dono. Esta página é material para essa decisão, não a decisão.
//
//   node scripts/categorias-do-dre.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.cache', 'omie');
const SAIDA = path.join(RAIZ, 'docs', 'categorias-do-dre.html');
const LEITURA = '24/09/2026';
const FAIXA = '01/01/2026 a 30/09/2026';

// O Omie devolve a descrição com entidades HTML dentro (`&lt;Disponível&gt;`); e nomes de terceiros saem mascarados,
// com a mesma convenção de `docs/fontes.md`.
const deesc = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const mascarar = s => s.replace(/Pacianotto/gi, '[terceiro]').replace(/\bB3N\b/g, '[terceiro]').replace(/Sanepar/gi, '[terceiro]');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- leitura do cache

if (!fs.existsSync(CACHE)) {
  console.error(`cache não encontrado em ${CACHE}.\nRode antes: node scripts/confronto-dfc-omie.mjs`);
  process.exit(1);
}
const arquivos = fs.readdirSync(CACHE);

const categorias = { 1: [], 2: [] };
for (const emp of ['1', '2'])
  for (const f of arquivos.filter(x => x.startsWith(`${emp}-geral-categorias`)))
    categorias[emp].push(...(JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).categoria_cadastro ?? []));

// Contagem de lançamentos por categoria. O cache tem duas passadas da mesma faixa (uma com `cTpLancamento: "CPCR"` e
// outra sem), então cada título é contado uma vez só, pelo `nCodTitulo`. Fora os `CANCELADO`.
const lancamentos = { 1: new Map(), 2: new Map() };
const vistos = { 1: new Set(), 2: new Set() };
for (const f of arquivos.filter(x => /-financas-mf-/.test(x))) {
  const emp = f[0];
  if (!vistos[emp]) continue;
  for (const mov of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).movimentos ?? []) {
    const d = mov.detalhes ?? {};
    if (d.cStatus === 'CANCELADO' || vistos[emp].has(d.nCodTitulo)) continue;
    vistos[emp].add(d.nCodTitulo);
    const c = d.cCodCateg || '(sem categoria)';
    lancamentos[emp].set(c, (lancamentos[emp].get(c) ?? 0) + 1);
  }
}

// ---------------------------------------------------------------- as duas pistas

// PISTA 1 — a conta do DRE em que a categoria está pendurada (`codigo_dre`).
const CONTAS_DRE = {
  a: new Set(['1.01.02', '1.01.03', '1.11.03']),   // Impostos, Deduções de Receita, Outras Deduções de Receita
  b: new Set(['1.21.01', '1.21.02', '1.21.03']),   // Custo Médio (CMC), Custo dos Serviços Prestados, Outros Custos
  c: new Set(),                                     // nenhuma conta do DRE da MeuBESS é de depreciação/amortização
  d: new Set(['1.11.02', '2.11.03']),              // Receitas Financeiras, Despesas Financeiras
};

// PISTA 2 — o nome da categoria. "Devolução de compra" não é dedução da receita (é devolução ao fornecedor), e
// "ajuda de custo" não é custo de venda — as duas exceções são tiradas de propósito.
const PELO_NOME = {
  a: (t) => !/devolu\S*\s+de\s+compra/i.test(t)
         && (/devolu\S*\s+de\s+venda|estorno de venda|reembolso por cancelamento/i.test(t)
             || /\b(icms|pis|cofins|ipi|iss)\b/i.test(t)
             || /simples nacional/i.test(t)),
  b: (t, c) => c.conta_receita !== 'S' && !/devolu/i.test(t) && !/ajuda de custo/i.test(t)
         && /(^|\s)compras?\b|custo|mercadoria|mat[eé]ria.?prima|frete s\/|frete sobre|armazenag|armanezag|manuseio|produtos vendidos/i.test(t),
  // Depreciação e amortização não aparecem só no nome curto: a busca varre também a descrição padrão do plano do
  // Omie e o texto de "natureza", que é a explicação que o próprio ERP dá para a categoria.
  c: (t, c) => /deprecia|amortiza|exaust/i.test(`${t} ${deesc(c.descricao_padrao)} ${deesc(c.natureza)}`),
  d: (t) => /juros|tarifa|rendiment|\biof\b|financeir|empr[eé]stim|financiamento/i.test(t),
};

const GRUPOS = {
  a: {
    titulo: 'Dedução da receita',
    ondeEntra: 'Na Tela 2, na linha <strong>(−) Deduções</strong> — logo abaixo da receita bruta.',
    paraQue: 'É o dinheiro que entrou como venda mas não é seu: imposto que incide sobre a venda e venda que voltou '
      + '(devolução, cancelamento). Tirando isso da receita bruta você chega na <em>receita líquida</em>, que é a '
      + 'receita de verdade — e é sobre ela que a tela calcula o peso de cada despesa.',
  },
  b: {
    titulo: 'Custo de vendas',
    ondeEntra: 'Na Tela 2, na linha <strong>(−) Custos de vendas</strong>.',
    paraQue: 'É o que você gastou para ter o que vendeu: a mercadoria comprada para revenda, a matéria-prima, o frete '
      + 'que trouxe a carga, a armazenagem. Não é despesa de escritório. Receita líquida menos custo de vendas é o '
      + '<em>lucro bruto</em> — quanto sobra da venda antes de pagar a estrutura da empresa.',
  },
  c: {
    titulo: 'Depreciação e amortização',
    ondeEntra: 'No cartão de <strong>EBITDA</strong> da Tela 2 — é uma das duas coisas que o EBITDA tira da conta.',
    paraQue: 'É o desgaste do que a empresa comprou para durar (máquina, veículo, instalação) espalhado ao longo dos '
      + 'anos de uso. É a única despesa da lista que <strong>não sai dinheiro do caixa no mês</strong>: você pagou a '
      + 'máquina uma vez e a contabilidade reparte esse valor por vários anos.',
  },
  d: {
    titulo: 'Resultado financeiro',
    ondeEntra: 'No cartão de <strong>EBITDA</strong> da Tela 2 — é a outra coisa que o EBITDA tira da conta.',
    paraQue: 'É o que o dinheiro custou ou rendeu, e não a operação: juros de empréstimo, tarifa do banco, IOF de um '
      + 'lado; rendimento de aplicação do outro. O EBITDA tira isso porque ele quer mostrar se a operação em si dá '
      + 'lucro, separado de como a empresa se financia.',
  },
};

// ---------------------------------------------------------------- classificação

const sugeridas = { a: [], b: [], c: [], d: [] };
const emDuvida = { a: [], b: [], c: [], d: [] };
let consideradas = 0, slotsVazios = 0, totalizadoras = 0, transferencias = 0;
const ativos = [];   // categorias na conta do DRE 3.01.01 "Ativos" — a compra do bem, não a depreciação dele

for (const emp of ['1', '2']) for (const c of categorias[emp]) {
  if (c.totalizadora === 'S') { totalizadoras++; continue; }
  const desc = mascarar(deesc(c.descricao));
  if (/^<Dispon[ií]vel>\d*$|^Dispon[ií]vel\d*$/i.test(desc)) { slotsVazios++; continue; }
  if (c.transferencia === 'S') { transferencias++; continue; }
  consideradas++;
  const dre = c.codigo_dre || '';
  const reg = {
    emp, codigo: c.codigo, desc, dre,
    nomeDre: deesc(c.dadosDRE?.descricaoDRE || ''),
    n: lancamentos[emp].get(c.codigo) ?? 0,
  };
  if (dre === '3.01.01') ativos.push(reg);
  for (const g of ['a', 'b', 'c', 'd']) {
    const porDre = !!dre && CONTAS_DRE[g].has(dre);
    const porNome = PELO_NOME[g](desc, c);
    if (porDre && porNome) sugeridas[g].push({ ...reg, pista: 'as duas' });
    else if (porDre) emDuvida[g].push({ ...reg, pista: 'conta do DRE' });
    else if (porNome) emDuvida[g].push({ ...reg, pista: 'nome' });
  }
}

const ordena = (a, b) => b.n - a.n || a.emp.localeCompare(b.emp) || a.codigo.localeCompare(b.codigo);
for (const g of ['a', 'b', 'c', 'd']) { sugeridas[g].sort(ordena); emDuvida[g].sort(ordena); }

// ---------------------------------------------------------------- a página

const linha = (r, comPista) => `<tr>
      <td class="emp">${r.emp}</td>
      <td><code>${esc(r.codigo)}</code></td>
      <td>${esc(r.desc)}</td>
      <td>${r.dre ? `<code>${esc(r.dre)}</code> ${esc(r.nomeDre)}` : '<span class="vazia">sem conta do DRE</span>'}</td>
      <td class="num">${r.n}</td>${comPista ? `\n      <td class="pista">só ${esc(r.pista)}</td>` : ''}
    </tr>`;

const tabela = (linhas, comPista) => `<table>
    <thead><tr><th>emp.</th><th>código</th><th>categoria</th><th>conta do DRE hoje</th><th>lanç.</th>${comPista ? '<th>o que apontou</th>' : ''}</tr></thead>
    <tbody>
${linhas.map(r => linha(r, comPista)).join('\n')}
    </tbody>
  </table>`;

function bloco(g) {
  const G = GRUPOS[g], sug = sugeridas[g], duv = emDuvida[g];
  const comMov = duv.filter(r => r.n > 0), semMov = duv.filter(r => r.n === 0);
  let corpo = '';

  if (sug.length) {
    corpo += `<h3>Sugeridas: ${sug.length}</h3>
  <p class="nota">As duas pistas concordam — o nome da categoria e a conta do DRE em que ela já está apontam para este grupo.</p>
  ${tabela(sug, false)}`;
  } else {
    corpo += `<h3>Sugeridas: nenhuma</h3>
  <div class="vazio">
    <p><strong>Não existe categoria de depreciação nem de amortização no plano das duas empresas.</strong> A busca por
    "deprecia", "amortiza" e "exaust" no nome, na descrição padrão e na explicação de cada uma das
    ${categorias[1].length + categorias[2].length} categorias não achou nenhuma, e nenhuma das 28 contas do DRE é
    dessas duas.</p>
    <p>Isso é esperado, e não é erro de cadastro: o plano do Omie classifica <em>movimento de dinheiro</em>, e
    depreciação não movimenta dinheiro. O que existe no plano é a <strong>compra</strong> do bem — a conta do DRE
    <code>3.01.01</code> "Ativos", com ${ativos.length} categorias, como ${ativos.slice(0, 3).map(r => `"${esc(r.desc)}"`).join(', ')}.
    Essa compra é a matéria-prima do cálculo da depreciação, não o cálculo.</p>
    <p><strong>O que isso significa para a tela:</strong> a depreciação teria de vir de fora do módulo financeiro do
    Omie — da ficha de bens do contador. Enquanto ela não vier, o EBITDA da tela é EBITDA sem depreciação e sem
    amortização, e a tela precisa dizer isso ao lado do número. Quem decide é o dono.</p>
  </div>`;
  }

  if (comMov.length) {
    corpo += `<h3>Em dúvida: ${comMov.length} com movimento no período</h3>
  <p class="nota">Aqui as duas pistas <strong>discordam</strong>: ou o nome diz que é deste grupo e a conta do DRE diz outra coisa,
  ou a conta do DRE diz que é e o nome não parece. São as que valem uma olhada — estão ordenadas pelo número de lançamentos.</p>
  ${tabela(comMov, true)}`;
  }
  if (semMov.length) {
    corpo += `<details><summary>Mais ${semMov.length} em dúvida, sem nenhum lançamento de ${FAIXA} — cadastro parado, decidir depois</summary>
  ${tabela(semMov, true)}</details>`;
  }
  if (!comMov.length && !semMov.length && sug.length) corpo += `<p class="nota">Nenhuma categoria ficou em dúvida neste grupo.</p>`;

  return `<section id="grupo-${g}">
  <h2><span class="letra">${g}</span> ${G.titulo}</h2>
  <p class="paraque">${G.paraQue}</p>
  <p class="onde">${G.ondeEntra}</p>
  ${corpo}
</section>`;
}

const totalSug = ['a','b','c','d'].reduce((s, g) => s + sugeridas[g].length, 0);
const totalDuv = ['a','b','c','d'].reduce((s, g) => s + emDuvida[g].length, 0);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Categorias do Omie: o que é dedução, custo, depreciação e resultado financeiro</title>
<style>
  :root {
    --tinta: #1b2430; --fraco: #5d6b7a; --linha: #e2e8ef; --fundo: #fbfcfd; --caixa: #fff;
    --a: #7b4bb7; --b: #0f7b6c; --c: #b06a00; --d: #1f5fa8; --duvida: #fff8e6; --duvidab: #e8c86a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 1.2rem 4rem; background: var(--fundo); color: var(--tinta);
    font: 16px/1.62 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 63rem; margin: 0 auto; }
  header { padding: 2.6rem 0 1.4rem; border-bottom: 2px solid var(--linha); margin-bottom: 1.8rem; }
  h1 { font-size: 1.85rem; line-height: 1.25; margin: 0 0 .9rem; letter-spacing: -.01em; }
  h2 { font-size: 1.32rem; margin: 0 0 .7rem; display: flex; align-items: center; gap: .6rem; }
  h3 { font-size: .98rem; margin: 1.7rem 0 .4rem; text-transform: uppercase; letter-spacing: .05em; color: var(--fraco); }
  p { margin: 0 0 .85rem; }
  code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: .87em;
    background: #eef2f6; padding: .1em .35em; border-radius: 3px; }
  .chamada { background: #eef4fb; border-left: 4px solid var(--d); padding: 1rem 1.2rem; border-radius: 0 6px 6px 0; margin: 0 0 1.1rem; }
  .aviso { background: #fdf3f3; border-left: 4px solid #c0564f; padding: 1rem 1.2rem; border-radius: 0 6px 6px 0; margin: 1.4rem 0; }
  .indice { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1.4rem 0 0; padding: 0; list-style: none; }
  .indice a { display: block; padding: .45rem .8rem; background: var(--caixa); border: 1px solid var(--linha);
    border-radius: 999px; text-decoration: none; color: var(--tinta); font-size: .9rem; }
  .indice a:hover { border-color: var(--fraco); }
  section { background: var(--caixa); border: 1px solid var(--linha); border-radius: 10px;
    padding: 1.6rem 1.7rem; margin: 0 0 1.5rem; }
  #grupo-a h2 .letra { background: var(--a); } #grupo-b h2 .letra { background: var(--b); }
  #grupo-c h2 .letra { background: var(--c); } #grupo-d h2 .letra { background: var(--d); }
  .letra { display: inline-grid; place-items: center; width: 1.85rem; height: 1.85rem; border-radius: 50%;
    color: #fff; font-size: .95rem; font-weight: 700; flex: none; }
  .paraque { font-size: 1.02rem; }
  .onde { font-size: .93rem; color: var(--fraco); border-top: 1px dashed var(--linha); padding-top: .7rem; }
  .nota { font-size: .9rem; color: var(--fraco); }
  table { width: 100%; border-collapse: collapse; margin: .6rem 0 0; font-size: .89rem; }
  th, td { text-align: left; padding: .42rem .55rem; border-bottom: 1px solid var(--linha); vertical-align: top; }
  th { font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--fraco);
    border-bottom: 2px solid var(--linha); white-space: nowrap; }
  td.emp, td.num { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num { font-weight: 600; }
  td.pista { font-size: .84rem; color: #8a6d1f; white-space: nowrap; }
  tbody tr:hover { background: #f7fafc; }
  h3 + .nota + table tbody tr:hover { background: #f7fafc; }
  .vazia { color: var(--fraco); font-style: italic; font-size: .88rem; }
  .vazio { background: #fff8ef; border: 1px solid #e9d3ad; border-radius: 8px; padding: 1.1rem 1.2rem; }
  .vazio p:last-child { margin-bottom: 0; }
  details { margin: 1rem 0 0; background: var(--duvida); border: 1px solid var(--duvidab); border-radius: 8px; padding: .7rem 1rem; }
  summary { cursor: pointer; font-size: .9rem; font-weight: 600; }
  details table { margin-top: .8rem; }
  footer { margin-top: 2.4rem; padding-top: 1.4rem; border-top: 2px solid var(--linha);
    font-size: .88rem; color: var(--fraco); }
  footer code { font-size: .85em; }
  .placar { display: flex; flex-wrap: wrap; gap: .8rem; margin: 1.2rem 0 0; }
  .placar div { flex: 1 1 8rem; background: var(--caixa); border: 1px solid var(--linha);
    border-radius: 8px; padding: .75rem .9rem; }
  .placar b { display: block; font-size: 1.5rem; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .placar span { font-size: .82rem; color: var(--fraco); }
  @media (max-width: 40rem) { section { padding: 1.2rem 1rem; } table { font-size: .82rem; } }
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Categorias do Omie: o que é dedução, custo, depreciação e resultado financeiro</h1>
  <p>A Tela 2 (o DRE) precisa saber, de cada categoria do plano de contas, em qual linha ela entra. Quatro dessas
  linhas o Omie <strong>não marca sozinho</strong> — nada no cadastro diz "isto aqui é dedução da receita". Esta
  página olha as ${consideradas} categorias das empresas 1 e 2 e <strong>sugere</strong> quais são, usando duas pistas:
  o <strong>nome</strong> da categoria e a <strong>conta do DRE</strong> em que ela já está pendurada hoje.</p>

  <div class="chamada">
    <p style="margin:0"><strong>Isto é sugestão, não decisão.</strong> Nenhuma categoria foi mexida no Omie e nenhuma
    lacuna de <code>docs/fontes.md</code> foi fechada por esta página. Onde as duas pistas concordam, a sugestão é
    firme; onde elas discordam, a categoria vai para "em dúvida" com o motivo ao lado. A palavra final é do dono.</p>
  </div>

  <div class="placar">
    <div><b>${totalSug}</b><span>categorias sugeridas, somando os quatro grupos</span></div>
    <div><b>${totalDuv}</b><span>em dúvida — as duas pistas discordam</span></div>
    <div><b>${consideradas}</b><span>categorias olhadas (empresas 1 e 2)</span></div>
    <div><b>${vistos[1].size + vistos[2].size}</b><span>lançamentos contados, ${FAIXA}</span></div>
  </div>

  <ul class="indice">
    <li><a href="#grupo-a">a · Dedução da receita (${sugeridas.a.length})</a></li>
    <li><a href="#grupo-b">b · Custo de vendas (${sugeridas.b.length})</a></li>
    <li><a href="#grupo-c">c · Depreciação e amortização (${sugeridas.c.length})</a></li>
    <li><a href="#grupo-d">d · Resultado financeiro (${sugeridas.d.length})</a></li>
  </ul>
</header>

<section style="background:#f4f7fa">
  <h2 style="font-size:1.1rem">Como ler esta página, em meio minuto</h2>
  <p>Cada grupo abaixo tem <strong>duas listas</strong>. A primeira, <em>sugeridas</em>, é onde o nome da categoria e a
  conta do DRE contam a mesma história — pode bater o olho e seguir. A segunda, <em>em dúvida</em>, é onde as duas
  discordam, e é a lista que realmente pede sua decisão: o nome diz uma coisa e o cadastro do Omie diz outra.</p>
  <p>A coluna <strong>lanç.</strong> é quantos lançamentos aquela categoria teve de ${FAIXA} — serve para você saber o
  que é grande e o que é cadastro parado. Categoria em dúvida <strong>sem nenhum lançamento</strong> fica escondida
  atrás de um "mostrar mais", porque não muda número nenhum hoje. <strong>Não há valores em reais nesta página.</strong></p>
  <p class="nota">A coluna <strong>emp.</strong> diz de qual empresa é a categoria: <strong>1</strong> é a filial
  <code>/0001-42</code> (as rotinas administrativas) e <strong>2</strong> é a <code>/0002-23</code> (compra, venda e
  logística). As duas têm planos separados, com a mesma numeração e conteúdo diferente — por isso o mesmo código
  aparece duas vezes, às vezes com nomes diferentes.</p>
</section>

${['a', 'b', 'c', 'd'].map(bloco).join('\n\n')}

<section class="aviso" style="border-radius:10px">
  <h2 style="font-size:1.1rem">O que esta página responde — e o que ela não fecha</h2>
  <p>Ela dá material para quatro lacunas de <code>docs/fontes.md</code>, e <strong>não fecha nenhuma delas</strong>:</p>
  <ul>
    <li>a linha <strong>(−) Deduções</strong> da Tela 2 — quais categorias do Omie são dedução: grupo <strong>a</strong>;</li>
    <li>a linha <strong>(−) Custos de vendas</strong> — quais contas do DRE são de custo: grupo <strong>b</strong>;</li>
    <li>o cartão de <strong>EBITDA</strong> — quais categorias são depreciação, amortização e resultado financeiro:
        grupos <strong>c</strong> e <strong>d</strong>;</li>
    <li>o cartão <strong>% desp. funcionários / receita líquida</strong> da Tela 1, que depende da receita líquida e,
        por ela, do grupo <strong>a</strong>.</li>
  </ul>
  <p style="margin-bottom:0">Enquanto o dono não escolher, as quatro seguem escritas como lacuna em
  <code>docs/fontes.md</code>, e o EBITDA da tela continua sem se distinguir do lucro operacional.</p>
</section>

<footer>
  <p><strong>De onde saem estes números.</strong> Do cadastro de categorias das empresas 1 e 2 lido do Omie em
  ${LEITURA} (<code>geral/categorias</code> → <code>ListarCategorias</code>, ${categorias[1].length} categorias na
  empresa 1 e ${categorias[2].length} na 2), com a conta do DRE de cada uma vindo do próprio retorno
  (<code>dadosDRE.codigoDRE</code> e <code>descricaoDRE</code>). A contagem de lançamentos vem da leitura de
  <code>financas/mf</code> → <code>ListarMovimentos</code> da mesma data, na faixa de ${FAIXA} por data de pagamento,
  fora os <code>CANCELADO</code>, contando cada título uma vez pelo <code>nCodTitulo</code>.</p>
  <p>Ficaram de fora da conta: ${totalizadoras} categorias totalizadoras (são somas, não recebem lançamento),
  ${slotsVazios} vagas <code>&lt;Disponível&gt;</code> do plano padrão do Omie e ${transferencias} de transferência
  entre contas. Nome de terceiro aparece como <code>[terceiro]</code>, como em <code>docs/fontes.md</code>.</p>
  <p>Página gerada por <code>scripts/categorias-do-dre.mjs</code>, que <strong>não chama a API do Omie</strong>: lê o
  cache local de <code>.cache/omie/</code> (pasta fora do git) que o <code>scripts/confronto-dfc-omie.mjs</code>
  gravou. Nada foi escrito no Omie nem nas planilhas. O cadastro inteiro, lado a lado, está em
  <code>docs/plano-de-categorias-omie.html</code>.</p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(SAIDA, html);
console.log(`docs/categorias-do-dre.html gravada.`);
for (const g of ['a', 'b', 'c', 'd'])
  console.log(`  grupo ${g} (${GRUPOS[g].titulo}): ${sugeridas[g].length} sugeridas, ${emDuvida[g].length} em dúvida ` +
    `(${emDuvida[g].filter(r => r.n > 0).length} com movimento)`);
console.log(`  total: ${totalSug} sugeridas, ${totalDuv} em dúvida, sobre ${consideradas} categorias`);
