#!/usr/bin/env node
// CATEGORIAS DE RECEITA DO OMIE: "VENDA DE PRODUTO" OU "OUTRA RECEITA"?
//
// A linha "(+) Receitas" da Tela 2 separa "vendas de produtos" de "outras receitas" pela CATEGORIA do Omie (decisão do
// dono de 25/09/2026); quem diz quais categorias são venda de produto é o dono. Este script monta o material para essa
// resposta: lista as categorias de receita (`conta_receita = "S"`) das empresas 1 e 2, lado a lado quando o código é o
// mesmo, sem as de transferência, com a contagem de recebimentos de 2026 (com a regra atual de docs/fontes.md, linha do
// Top 10 receitas) e quantos vieram de pedido de venda (`nCodOS` preenchido), e sugere um destino pelo nome e pela origem.
// Grava `docs/categorias-de-receita.html`.
//
// SÓ LEITURA, E NEM ISSO NA API: este script não chama o Omie. Lê o cache local (`.cache/omie/`, fora do git) que o
// `scripts/confronto-dfc-omie.mjs` gravou. Só contagens: nenhum valor em reais e nenhum nome de cliente entra na página.
//
// A REGRA DE CONTAGEM (a mesma de docs/fontes.md, Top 10 receitas): ListarMovimentos sem cTpLancamento, por data de
// pagamento de 01/01 a 30/09/2026; `cNatureza = "R"`; fora os CANCELADO; fora as categorias de transferência; só as contas
// correntes com `negocio = "MeuBESS"` (dados/contas-correntes-por-negocio.json). Sem contar duas vezes: o título recebido
// (CONTA_A_RECEBER) conta uma vez por `nCodTitulo`; do conta corrente (CONTA_CORRENTE_REC) entra só o avulso, sem título
// (`nCodTitulo` 0), uma vez por `nCodMovCC`.
//
//   node scripts/categorias-de-receita.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.cache', 'omie');
const SAIDA = path.join(RAIZ, 'docs', 'categorias-de-receita.html');
const LEITURA = '24 e 25/09/2026';
const FAIXA = '01/01/2026 a 30/09/2026';

// Contagem de 2026 já escrita em docs/fontes.md (Top 10 receitas): serve de trava, para a página não divergir do que a
// tela vai contar. [títulos, avulsos] por empresa.
const CONTAGEM_DO_FONTES = { 1: [9, 160], 2: [541, 619] };

const deesc = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const mascarar = s => s.replace(/Pacianotto/gi, '[terceiro]').replace(/\bB3N\b/g, '[terceiro]').replace(/Sanepar/gi, '[terceiro]');
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nome = c => mascarar(deesc(c.descricao)).trim();

// ---------------------------------------------------------------- leitura do cache

if (!fs.existsSync(CACHE)) {
  console.error(`cache não encontrado em ${CACHE}.\nRode antes: node scripts/confronto-dfc-omie.mjs`);
  process.exit(1);
}
const arquivos = fs.readdirSync(CACHE);
const negocios = JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'));
const contasMeuBess = new Set(negocios.contas.filter(c => c.negocio === 'MeuBESS').map(c => c.chave));

const categorias = { 1: new Map(), 2: new Map() };
for (const emp of ['1', '2'])
  for (const f of arquivos.filter(x => x.startsWith(`${emp}-geral-categorias`)))
    for (const c of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).categoria_cadastro ?? [])
      categorias[emp].set(String(c.codigo), c);

// Por categoria: títulos recebidos, avulsos de conta corrente e quantos títulos vieram de pedido de venda.
const conta = { 1: new Map(), 2: new Map() };
const totais = { 1: { titulos: 0, avulsos: 0, foraDeReceita: 0 }, 2: { titulos: 0, avulsos: 0, foraDeReceita: 0 } };
for (const emp of ['1', '2']) {
  const titulos = new Map(), avulsos = new Map();
  for (const f of arquivos.filter(x => x.startsWith(`${emp}-financas-mf-`))) {
    for (const mov of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).movimentos ?? []) {
      const d = mov.detalhes ?? {};
      if (d.cNatureza !== 'R' || d.cStatus === 'CANCELADO') continue;
      if (!contasMeuBess.has(`${emp}|${d.nCodCC}`)) continue;
      if (!/\/2026$/.test(d.dDtPagamento ?? '')) continue;
      if (categorias[emp].get(String(d.cCodCateg))?.transferencia === 'S') continue;
      if (d.cGrupo === 'CONTA_A_RECEBER') titulos.set(d.nCodTitulo, d);
      else if (d.cGrupo === 'CONTA_CORRENTE_REC' && !d.nCodTitulo) avulsos.set(d.nCodMovCC, d);
    }
  }
  const linha = cod => {
    if (!conta[emp].has(cod)) conta[emp].set(cod, { titulos: 0, avulsos: 0, comPedido: 0 });
    return conta[emp].get(cod);
  };
  for (const d of titulos.values()) { const l = linha(String(d.cCodCateg)); l.titulos++; if (d.nCodOS) l.comPedido++; }
  for (const d of avulsos.values()) { const l = linha(String(d.cCodCateg)); l.avulsos++; if (d.nCodOS) l.comPedido++; }
  totais[emp].titulos = titulos.size;
  totais[emp].avulsos = avulsos.size;
  totais[emp].foraDeReceita = [...conta[emp].keys()].filter(c => categorias[emp].get(c)?.conta_receita !== 'S')
    .reduce((s, c) => s + conta[emp].get(c).titulos + conta[emp].get(c).avulsos, 0);
}
for (const emp of ['1', '2']) {
  const [t, a] = CONTAGEM_DO_FONTES[emp];
  if (totais[emp].titulos !== t || totais[emp].avulsos !== a) {
    console.error(`empresa ${emp}: o cache dá ${totais[emp].titulos} títulos + ${totais[emp].avulsos} avulsos, e docs/fontes.md diz ${t} + ${a}.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- as categorias de receita, lado a lado

const eTotalizadora = c => c.totalizadora === 'S';
const eVaga = c => /^<Dispon/i.test(nome(c));
const daReceita = emp => [...categorias[emp].values()].filter(c => c.conta_receita === 'S' && c.transferencia !== 'S');

const codigos = [...new Set([1, 2].flatMap(e => daReceita(String(e)).map(c => String(c.codigo))))]
  .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));

const zero = { titulos: 0, avulsos: 0, comPedido: 0 };
const linhas = codigos.map(cod => {
  const cel = {};
  for (const emp of ['1', '2']) {
    const c = daReceita(emp).find(x => String(x.codigo) === cod);
    cel[emp] = c ? { c, nome: nome(c), inativa: c.conta_inativa === 'S', vaga: eVaga(c), tot: eTotalizadora(c), ...(conta[emp].get(cod) ?? zero) } : null;
  }
  return { cod, cel };
});

// ---------------------------------------------------------------- a sugestão: pelo nome e pela origem

// NOME: "venda de produtos" e "revenda de mercadorias" são venda de produto; serviço, rendimento, reembolso, capital,
// transferência, empréstimo, devolução e "não identificadas" não são. Vaga `<Disponível>` não tem nome, então não opina.
const VENDA_NO_NOME = /venda de produtos|revenda de mercadorias/i;
// ORIGEM: título que veio de pedido de venda (`nCodOS` preenchido). O avulso de conta corrente nunca vem de pedido.
function sugerir(l) {
  const cels = [l.cel[1], l.cel[2]].filter(Boolean);
  const nomeadas = cels.filter(x => !x.vaga);
  const noNome = nomeadas.some(x => VENDA_NO_NOME.test(x.nome));
  const lanc = cels.reduce((s, x) => s + x.titulos + x.avulsos, 0);
  const comPedido = cels.reduce((s, x) => s + x.comPedido, 0);
  if (noNome) {
    if (comPedido > 0) return { g: 'venda', pista: 'o nome diz venda de produto e há título vindo de pedido de venda', forca: 'firme' };
    if (lanc > 0) return { g: 'venda', pista: 'o nome diz venda de produto, mas nenhum recebimento veio de pedido (só avulso de conta corrente)', forca: 'conferir' };
    return { g: 'venda', pista: 'só o nome diz venda de produto; sem recebimento em 2026', forca: 'so-nome' };
  }
  if (comPedido > 0) return { g: 'venda', pista: 'o nome não diz venda de produto, mas há título vindo de pedido de venda (adiantamento de cliente)', forca: 'conferir' };
  if (lanc > 0) return { g: 'outra', pista: 'o nome não diz venda de produto e nenhum recebimento veio de pedido', forca: 'firme' };
  return { g: 'outra', pista: nomeadas.length ? 'o nome não diz venda de produto; sem recebimento em 2026' : 'vaga sem nome no plano; sem recebimento em 2026', forca: 'so-nome' };
}
for (const l of linhas) l.sug = sugerir(l);

const tot = l => [l.cel[1], l.cel[2]].filter(Boolean).reduce((s, x) => s + x.titulos + x.avulsos, 0);
const ped = l => [l.cel[1], l.cel[2]].filter(Boolean).reduce((s, x) => s + x.comPedido, 0);
const nCats = l => [l.cel[1], l.cel[2]].filter(Boolean).length;

const totalizadoras = linhas.filter(l => [l.cel[1], l.cel[2]].filter(Boolean).every(x => x.tot));
const classificaveis = linhas.filter(l => !totalizadoras.includes(l));
const grupo = g => classificaveis.filter(l => l.sug.g === g)
  .sort((a, b) => tot(b) - tot(a) || a.cod.localeCompare(b.cod, 'pt', { numeric: true }));
const G = { venda: grupo('venda'), outra: grupo('outra') };
const resumo = g => ({
  codigos: G[g].length,
  categorias: G[g].reduce((s, l) => s + nCats(l), 0),
  lancamentos: G[g].reduce((s, l) => s + tot(l), 0),
  comPedido: G[g].reduce((s, l) => s + ped(l), 0),
  comMov: G[g].filter(l => tot(l) > 0).length,
});
const R = { venda: resumo('venda'), outra: resumo('outra') };
const totalLanc = R.venda.lancamentos + R.outra.lancamentos;
const esperado = [1, 2].reduce((s, e) => s + CONTAGEM_DO_FONTES[e][0] + CONTAGEM_DO_FONTES[e][1], 0);
if (totalLanc !== esperado || [1, 2].some(e => totais[e].foraDeReceita)) {
  console.error(`a soma dos grupos (${totalLanc}) não bate com a contagem do fontes.md (${esperado}), ou há recebimento fora de categoria de receita.`);
  process.exit(1);
}
if (totalizadoras.some(l => tot(l) > 0)) { console.error('totalizadora com lançamento: revisar.'); process.exit(1); }

// ---------------------------------------------------------------- a página

const celNome = l => {
  const a = l.cel[1], b = l.cel[2];
  if (a && b && a.nome === b.nome) return `<span class="igual">${esc(a.nome)}</span>${a.inativa && b.inativa ? ' <span class="tag">inativa nas duas</span>' : ''}`;
  const uma = (n, x) => x ? `<div><span class="e">emp. ${n}</span> ${x.vaga ? '<span class="vazia">vaga &lt;Disponível&gt;</span>' : esc(x.nome)}${x.inativa ? ' <span class="tag">inativa</span>' : ''}</div>` : `<div><span class="e">emp. ${n}</span> <span class="vazia">não existe</span></div>`;
  return uma(1, a) + uma(2, b);
};
const celNum = x => x
  ? `<td class="num">${x.titulos}</td><td class="num">${x.avulsos}</td><td class="num">${x.comPedido}</td>`
  : `<td class="num vazia" colspan="3">—</td>`;
const rotuloForca = { firme: 'nome e origem concordam', conferir: 'nome e origem discordam — conferir', 'so-nome': 'só pelo nome (sem recebimento em 2026)' };

const linhaTabela = l => `<tr data-cod="${esc(l.cod)}" data-sug="${l.sug.g}" class="${l.sug.forca === 'conferir' ? 'conferir' : ''}">
      <td><code>${esc(l.cod)}</code></td>
      <td class="cat">${celNome(l)}</td>
      ${celNum(l.cel[1])}
      ${celNum(l.cel[2])}
      <td class="num tot">${tot(l)}</td>
      <td class="porque"><span class="forca ${l.sug.forca}">${rotuloForca[l.sug.forca]}</span><br>${esc(l.sug.pista)}</td>
      <td class="dec"><select aria-label="destino de ${esc(l.cod)}"><option value="venda"${l.sug.g === 'venda' ? ' selected' : ''}>venda de produto</option><option value="outra"${l.sug.g === 'outra' ? ' selected' : ''}>outra receita</option></select></td>
    </tr>`;

const tabela = ls => `<div class="tabela"><table>
    <thead>
      <tr><th rowspan="2">código</th><th rowspan="2">categoria</th><th colspan="3" class="g">empresa 1</th><th colspan="3" class="g">empresa 2</th><th rowspan="2">total</th><th rowspan="2">por que a sugestão</th><th rowspan="2">destino</th></tr>
      <tr><th>títulos</th><th>avulsos</th><th>de pedido</th><th>títulos</th><th>avulsos</th><th>de pedido</th></tr>
    </thead>
    <tbody>
${ls.map(linhaTabela).join('\n')}
    </tbody>
  </table></div>`;

function bloco(g, titulo, ajuda) {
  const r = R[g];
  const comMov = G[g].filter(l => tot(l) > 0), semMov = G[g].filter(l => tot(l) === 0);
  const outro = g === 'venda' ? 'outra' : 'venda', nomeOutro = g === 'venda' ? 'outra receita' : 'venda de produto';
  return `<section id="grupo-${g}" data-grupo="${g}">
  <h2>${titulo}</h2>
  <p class="paraque">${ajuda}</p>
  <div class="placar">
    <div><b>${r.categorias}</b><span>categorias (${r.codigos} códigos)</span></div>
    <div><b>${r.lancamentos}</b><span>recebimentos em 2026 (${r.comPedido} de pedido)</span></div>
    <div><b>${r.comMov}</b><span>códigos com recebimento</span></div>
  </div>
  <div class="acoes">
    <button type="button" data-aceitar="${g}">Aceitar este grupo como sugerido</button>
    <button type="button" data-mover="${g}" data-para="${outro}">Passar todo o grupo para ${nomeOutro}</button>
  </div>
  <h3>Com recebimento em 2026: ${comMov.length} códigos</h3>
  ${comMov.length ? tabela(comMov) : '<p class="nota">Nenhum.</p>'}
  ${semMov.length ? `<details><summary>Sem nenhum recebimento em 2026: ${semMov.length} códigos (cadastro parado, vagas e categorias inativas)</summary>
  ${tabela(semMov)}</details>` : ''}
</section>`;
}

const totCat = totalizadoras.reduce((s, l) => s + nCats(l), 0);
const catsListadas = R.venda.categorias + R.outra.categorias + totCat;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Categorias de receita do Omie: o que é venda de produto</title>
<style>
  :root { --tinta: #1b2430; --fraco: #5d6b7a; --linha: #e2e8ef; --fundo: #fbfcfd; --caixa: #fff;
    --venda: #0f7b6c; --outra: #7b4bb7; --azul: #1f5fa8; --duvida: #fff8e6; --duvidab: #e8c86a; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 1.2rem 4rem; background: var(--fundo); color: var(--tinta);
    font: 16px/1.6 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 78rem; margin: 0 auto; }
  header { padding: 2.4rem 0 1.3rem; border-bottom: 2px solid var(--linha); margin-bottom: 1.6rem; }
  h1 { font-size: 1.8rem; line-height: 1.25; margin: 0 0 .9rem; letter-spacing: -.01em; }
  h2 { font-size: 1.3rem; margin: 0 0 .6rem; }
  h3 { font-size: .95rem; margin: 1.5rem 0 .4rem; text-transform: uppercase; letter-spacing: .05em; color: var(--fraco); }
  p { margin: 0 0 .85rem; }
  code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: .87em; background: #eef2f6; padding: .1em .35em; border-radius: 3px; }
  .chamada { background: #eef4fb; border-left: 4px solid var(--azul); padding: 1rem 1.2rem; border-radius: 0 6px 6px 0; margin: 0 0 1.1rem; }
  section { background: var(--caixa); border: 1px solid var(--linha); border-radius: 10px; padding: 1.5rem 1.6rem; margin: 0 0 1.5rem; }
  #grupo-venda { border-top: 5px solid var(--venda); } #grupo-outra { border-top: 5px solid var(--outra); }
  .nota { font-size: .9rem; color: var(--fraco); }
  .placar { display: flex; flex-wrap: wrap; gap: .8rem; margin: 1rem 0 0; }
  .placar div { flex: 1 1 9rem; background: var(--caixa); border: 1px solid var(--linha); border-radius: 8px; padding: .7rem .9rem; }
  .placar b { display: block; font-size: 1.5rem; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .placar span { font-size: .82rem; color: var(--fraco); }
  .acoes { display: flex; flex-wrap: wrap; gap: .6rem; margin: 1rem 0 0; }
  button { font: inherit; font-size: .88rem; padding: .45rem .8rem; border: 1px solid var(--fraco); background: #fff; border-radius: 6px; cursor: pointer; color: var(--tinta); }
  button:hover { background: #f0f4f8; }
  select { font: inherit; font-size: .86rem; padding: .2rem .3rem; border: 1px solid var(--linha); border-radius: 4px; background: #fff; }
  select.mudou { border-color: #c0564f; background: #fdf3f3; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: .6rem 0 0; font-size: .86rem; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--linha); vertical-align: top; }
  th { font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; color: var(--fraco); border-bottom: 1px solid var(--linha); white-space: nowrap; }
  th.g { text-align: center; border-bottom: 1px solid var(--linha); background: #f4f7fa; }
  thead tr:last-child th { border-bottom: 2px solid var(--linha); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.tot { font-weight: 700; }
  td.cat { min-width: 14rem; }
  td.porque { font-size: .82rem; color: var(--fraco); min-width: 15rem; }
  td.dec { white-space: nowrap; }
  tbody tr:hover { background: #f7fafc; }
  tr.conferir { background: #fffaf0; }
  .e { display: inline-block; font-size: .72rem; font-weight: 700; color: var(--fraco); background: #eef2f6; border-radius: 3px; padding: 0 .3rem; margin-right: .25rem; }
  .vazia { color: var(--fraco); font-style: italic; }
  .tag { font-size: .72rem; color: #8a6d1f; background: var(--duvida); border: 1px solid var(--duvidab); border-radius: 3px; padding: 0 .3rem; }
  .forca { font-weight: 600; } .forca.firme { color: var(--venda); } .forca.conferir { color: #b06a00; } .forca.so-nome { color: var(--fraco); }
  details { margin: 1rem 0 0; background: var(--duvida); border: 1px solid var(--duvidab); border-radius: 8px; padding: .7rem 1rem; }
  summary { cursor: pointer; font-size: .9rem; font-weight: 600; }
  textarea { width: 100%; min-height: 12rem; font: .85rem/1.5 ui-monospace, Consolas, monospace; padding: .7rem; border: 1px solid var(--linha); border-radius: 6px; }
  footer { margin-top: 2.2rem; padding-top: 1.3rem; border-top: 2px solid var(--linha); font-size: .88rem; color: var(--fraco); }
  @media (max-width: 48rem) { section { padding: 1.1rem .8rem; } table { font-size: .78rem; } .tabela { overflow-x: auto; } }
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Categorias de receita do Omie: o que é venda de produto</h1>
  <p>Na Tela 2, a linha <strong>(+) Receitas</strong> separa <strong>vendas de produtos</strong> de <strong>outras receitas</strong>
  pela <strong>categoria</strong> do Omie (decisão do dono, 25/09/2026). Falta dizer <strong>quais categorias são venda de produto</strong>.
  Esta página lista as ${catsListadas} categorias de receita das empresas 1 e 2 (sem as de transferência), lado a lado quando o
  código é o mesmo, com a contagem de recebimentos de 2026 e uma <strong>sugestão</strong> pelo nome e pela origem.
  Você aceita o grupo inteiro ou muda o destino de uma categoria, e a página monta a resposta no fim.</p>

  <div class="chamada">
    <p style="margin:0"><strong>Só a sugestão está pronta; a decisão é sua.</strong> Nada foi escrito no Omie nem em
    <code>docs/fontes.md</code>. <strong>Não há valores em reais nesta página</strong>: só contagens de recebimentos.</p>
  </div>

  <div class="placar">
    <div><b>${R.venda.categorias}</b><span>categorias sugeridas como venda de produto (${R.venda.codigos} códigos), com ${R.venda.lancamentos} recebimentos</span></div>
    <div><b>${R.outra.categorias}</b><span>categorias sugeridas como outra receita (${R.outra.codigos} códigos), com ${R.outra.lancamentos} recebimentos</span></div>
    <div><b>${totalLanc}</b><span>recebimentos em 2026, ${FAIXA}</span></div>
    <div><b>${totCat}</b><span>totalizadoras (somas, não recebem lançamento), fora da sugestão</span></div>
  </div>
</header>

<section style="background:#f4f7fa">
  <h2 style="font-size:1.1rem">Como ler, em meio minuto</h2>
  <p><strong>Recebimentos</strong> são os que a tela vai contar: título a receber baixado (<strong>títulos</strong>) mais lançamento
  avulso de conta corrente (<strong>avulsos</strong>), de ${FAIXA} por data de pagamento, só nas contas da MeuBESS, sem
  cancelados e sem transferências, e sem contar duas vezes. <strong>De pedido</strong> é quantos deles têm pedido de venda ligado
  (<code>nCodOS</code> preenchido); o avulso nunca tem.</p>
  <p><strong>A sugestão</strong> olha duas coisas. O <strong>nome</strong>: "venda de produtos" e "revenda de mercadorias" dizem venda de produto;
  serviço, rendimento, reembolso, capital, transferência, empréstimo, devolução e "não identificadas" não dizem. A <strong>origem</strong>:
  recebimento vindo de pedido de venda é venda. Onde nome e origem <strong>discordam</strong>, a linha vem em amarelo, marcada "conferir".
  Códigos iguais nas duas empresas dividem uma linha, e o destino vale para as duas.</p>
  <p class="nota">Categorias <strong>totalizadoras</strong> (as somas 1.01, 1.02, 1.03 e 1.04) ficam de fora porque não recebem lançamento.
  As vagas <code>&lt;Disponível&gt;</code> e as inativas <strong>estão listadas</strong>, dentro de "sem nenhum recebimento em 2026".</p>
</section>

${bloco('venda', `Sugeridas como <span style="color:var(--venda)">venda de produto</span>: ${R.venda.categorias} categorias`,
  'Entram em "vendas de produtos" na linha (+) Receitas. Vale conferir as marcadas em amarelo: o nome ou a origem não bate com a sugestão.')}

${bloco('outra', `Sugeridas como <span style="color:var(--outra)">outra receita</span>: ${R.outra.categorias} categorias`,
  'Entram em "outras receitas" na linha (+) Receitas: rendimento, reembolso, transferência, capital, empréstimo, devolução, dividendo e o que não é venda de produto.')}

<section>
  <h2 style="font-size:1.1rem">Totalizadoras: ${totCat} categorias, fora da sugestão</h2>
  <p class="nota">São somas de outras categorias e não recebem lançamento (0 recebimentos em 2026).</p>
  <details><summary>Ver as ${totalizadoras.length} totalizadoras</summary>
  <table><thead><tr><th>código</th><th>categoria</th></tr></thead><tbody>
${totalizadoras.map(l => `    <tr><td><code>${esc(l.cod)}</code></td><td>${celNome(l)}</td></tr>`).join('\n')}
  </tbody></table></details>
</section>

<section id="resposta">
  <h2>A resposta, montada conforme você escolhe</h2>
  <p class="nota">Ela se atualiza a cada mudança de destino. Copie e cole na conversa.</p>
  <p id="contagem"></p>
  <textarea id="saida" readonly></textarea>
  <div class="acoes"><button type="button" id="copiar">Copiar a resposta</button></div>
</section>

<footer>
  <p><strong>De onde saem os números.</strong> Do cadastro de categorias das empresas 1 e 2 (<code>geral/categorias</code> →
  <code>ListarCategorias</code>) e dos movimentos já lidos (<code>financas/mf</code> → <code>ListarMovimentos</code>, sem
  <code>cTpLancamento</code>) no cache local, leituras de ${LEITURA}. A contagem é a da linha do Top 10 receitas de
  <code>docs/fontes.md</code>: empresa 1, ${totais[1].titulos} títulos + ${totais[1].avulsos} avulsos; empresa 2, ${totais[2].titulos} + ${totais[2].avulsos}.
  Nenhum recebimento caiu em categoria que não seja de receita. Fora da conta, como no fontes.md: as categorias de transferência
  (<code>0.01.01</code> Entrada de Transferência, que só aparece no avulso da empresa 1) e o que está fora das contas da MeuBESS.
  Nome de terceiro aparece como <code>[terceiro]</code>.</p>
  <p>Página gerada por <code>scripts/categorias-de-receita.mjs</code>, que <strong>não chama a API do Omie</strong> e não escreve
  no Omie nem em planilhas. As decisões só valem quando registradas em <code>docs/fontes.md</code>.</p>
</footer>

</div>
<script>
(function () {
  var linhas = Array.prototype.slice.call(document.querySelectorAll('tr[data-cod]'));
  var rotulo = { venda: 'venda de produto', outra: 'outra receita' };
  function estado() {
    var r = { venda: [], outra: [] }, mudou = 0;
    linhas.forEach(function (tr) {
      var sel = tr.querySelector('select');
      sel.classList.toggle('mudou', sel.value !== tr.dataset.sug);
      if (sel.value !== tr.dataset.sug) mudou++;
      r[sel.value].push(tr.dataset.cod);
    });
    return { r: r, mudou: mudou };
  }
  function atualizar() {
    var e = estado();
    document.getElementById('contagem').textContent = e.r.venda.length + ' códigos como venda de produto, ' +
      e.r.outra.length + ' como outra receita; ' + e.mudou + ' diferentes da sugestão.';
    var txt = 'Categorias de receita do Omie (pela categoria, empresas 1 e 2):\\n\\n' +
      'VENDA DE PRODUTO (' + e.r.venda.length + ' códigos):\\n' + (e.r.venda.join(', ') || '(nenhum)') + '\\n\\n' +
      'OUTRA RECEITA (' + e.r.outra.length + ' códigos):\\n' + (e.r.outra.join(', ') || '(nenhum)') + '\\n\\n' +
      (e.mudou ? 'Mudei ' + e.mudou + ' em relação à sugestão.' : 'Aceito a sugestão como está.');
    document.getElementById('saida').value = txt;
  }
  // a mesma categoria aparece uma vez por código; se estiver em duas tabelas (não está), o destino segue junto
  document.addEventListener('change', function (ev) { if (ev.target.tagName === 'SELECT') atualizar(); });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.dataset.aceitar) {
      linhas.forEach(function (tr) { if (tr.closest('section').dataset.grupo === t.dataset.aceitar) tr.querySelector('select').value = tr.dataset.sug; });
      atualizar();
    } else if (t.dataset.mover) {
      linhas.forEach(function (tr) { if (tr.closest('section').dataset.grupo === t.dataset.mover) tr.querySelector('select').value = t.dataset.para; });
      atualizar();
    } else if (t.id === 'copiar') {
      var ta = document.getElementById('saida'); ta.select();
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value); else document.execCommand('copy');
    }
  });
  atualizar();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(SAIDA, html);
console.log('docs/categorias-de-receita.html gravada.');
for (const g of ['venda', 'outra'])
  console.log(`  ${g}: ${R[g].categorias} categorias (${R[g].codigos} códigos), ${R[g].lancamentos} recebimentos (${R[g].comPedido} de pedido), ${R[g].comMov} códigos com recebimento`);
console.log(`  totalizadoras: ${totCat} categorias; total de recebimentos ${totalLanc}; categorias listadas ${catsListadas}`);
