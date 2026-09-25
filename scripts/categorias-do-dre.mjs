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
// O QUE ELE NÃO FAZ: ele não decide nada. Quem decide é o dono; esta página é material para a decisão. O grupo (a) foi
// decidido em 24/09/2026 (e revisto em 25/09/2026, sem o ISS RETIDO) e os grupos (b), (c) e (d) em 25/09/2026 (ver
// DECIDIDO_A, DECIDIDO_B, DECISAO_C e DECIDIDO_D abaixo, que só REGISTRAM a resposta do dono); os quatro estão decididos.
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
const arquivosDeMovimento = arquivos.filter(x => /-financas-mf-/.test(x));
// De que dia é cada resposta do cache. O cache cresce: um script novo, com outra pergunta, grava mais respostas nele, e
// a contagem desta página sobe junto. Por isso a data sai do próprio arquivo (data de gravação) e não de uma constante
// escrita à mão, que envelhece sem avisar.
const diasDoCache = [...new Set(arquivosDeMovimento.map(f =>
  fs.statSync(path.join(CACHE, f)).mtime.toLocaleDateString('pt-BR')))].sort((a, b) =>
  a.split('/').reverse().join('').localeCompare(b.split('/').reverse().join('')));
const LEITURA_MOVIMENTOS = diasDoCache.length === 1
  ? `leitura de ${diasDoCache[0]}`
  : `leituras de ${diasDoCache.slice(0, -1).join(', ')} e ${diasDoCache.at(-1)}`;
for (const f of arquivosDeMovimento) {
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

// DECISÃO DO DONO, 24/09/2026 (resposta "c" à pergunta do grupo a): dedução da receita = as sugeridas do grupo (a) mais
// Reembolso por cancelamento (2.02.97, empresa 2). Chave: `empresa:código`. A decisão de 24/09/2026 incluía também o
// ISS RETIDO (2.06.07, empresas 1 e 2); em 25/09/2026 o dono decidiu (opção A) que ele NÃO é dedução: a retenção da
// MeuBESS é do que ela desconta ao pagar fornecedor e já sai pela guia paga. Por isso ele saiu da lista e volta a
// aparecer entre as que ficaram de fora da decisão. Isto REGISTRA a decisão; não é heurística.
const DECIDIDO_A = new Set(['2:2.02.97']);
const DECISAO_A = '24/09/2026';
const DECISAO_A_ISS = '25/09/2026';

// DECISÃO DO DONO, 25/09/2026 (resposta "c" à pergunta do grupo b): custo de vendas = as sugeridas do grupo (b) mais as 17
// "em dúvida" COM movimento que a página apontou só pelo NOME (compras de matéria-prima e de mercadorias, fretes sobre
// compras e os gastos com "Custo" no nome). Ficam de fora as 2 apontadas só pela conta do DRE (1:2.08.99 OUTRAS DESPESAS e
// 1:2.08.98 Reembolso) e as 6 em dúvida sem movimento. Chave: `empresa:código`. Isto REGISTRA a decisão; não é heurística.
const DECIDIDO_B = new Set([
  '2:2.01.02', '2:2.01.03', '2:2.01.01', '1:2.01.03', '2:2.01.91', '1:2.01.01', '1:2.01.97', '2:2.01.93', '2:2.01.98',
  '2:2.01.94', '2:2.08.99', '1:2.01.82', '2:2.01.90', '1:2.01.83', '1:2.04.88', '2:2.01.95', '2:2.01.97',
]);
const DECISAO_B = '25/09/2026';

// DECISÃO DO DONO, 25/09/2026 (resposta "b" à pergunta do grupo d): resultado financeiro = as 11 sugeridas do grupo (d) mais
// Rendimentos de Aplicações (1.02.02) e IOF (2.06.95), nas duas empresas em que existem. Ficam FORA do resultado financeiro:
// Cartão de Crédito e Aluguel de Veículo (empresa 1), que vão para as despesas gerais do DRE, e os empréstimos e
// transferências entre as empresas (Intercompany), que ficam fora do DRE, como as transferências. As demais em dúvida (sem
// movimento: empréstimos bancários e financiamento de veículo) ficam anotadas como "decidir depois". Cuidado com o código:
// 2.05.99 é "Transferência Intercompany" na empresa 1 e "Tarifas Bancarias" (resultado financeiro) na 2; 2.10.98 é
// intercompany só na empresa 2. Por isso a chave é sempre `empresa:código`. Isto REGISTRA a decisão; não é heurística.
const DECIDIDO_D = new Set(['1:1.02.02', '1:2.06.95', '2:1.02.02', '2:2.06.95']);
const FORA_D = new Map([
  ['1:2.11.98', 'despesas gerais'], ['1:2.11.99', 'despesas gerais'],
  ['1:2.08.02', 'fora do DRE'], ['1:2.05.99', 'fora do DRE'], ['1:1.04.99', 'fora do DRE'],
  ['2:1.04.99', 'fora do DRE'], ['2:2.10.98', 'fora do DRE'],
]);
const DECISAO_D = '25/09/2026';

// DECISÃO DO DONO, 25/09/2026 (resposta "a" à pergunta do grupo c): o Omie não tem categoria de depreciação nem de
// amortização, então o grupo (c) fica SEM categorias; a Tela 2 mostra EBITDA e lucro líquido sem elas, com o aviso abaixo
// ao lado dos números, e não entra planilha do contador. Não há lista a registrar; isto só marca o grupo como decidido.
const DECISAO_C = '25/09/2026';
const AVISO_C = 'Sem depreciação e sem amortização: o Omie não tem categoria para elas, então este número não as desconta.';

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

// Grupo (a): a decisão do dono = as sugeridas + as em dúvida que ela incluiu. O que sobra em dúvida ficou de fora dela.
const adicionadasA = emDuvida.a.filter(r => DECIDIDO_A.has(`${r.emp}:${r.codigo}`));
const decididasA = [...sugeridas.a, ...adicionadasA]
  .sort((x, y) => x.emp.localeCompare(y.emp) || x.codigo.localeCompare(y.codigo));
emDuvida.a = emDuvida.a.filter(r => !DECIDIDO_A.has(`${r.emp}:${r.codigo}`));
if (adicionadasA.length !== DECIDIDO_A.size) {
  console.error(`a decisão do dono cita ${DECIDIDO_A.size} categorias fora das sugeridas e o cache achou ${adicionadasA.length}.`);
  process.exit(1);
}

// Grupo (b): mesma conta — as sugeridas mais as em dúvida que o dono incluiu; o resto em dúvida ficou de fora dela.
const adicionadasB = emDuvida.b.filter(r => DECIDIDO_B.has(`${r.emp}:${r.codigo}`));
const decididasB = [...sugeridas.b, ...adicionadasB]
  .sort((x, y) => x.emp.localeCompare(y.emp) || x.codigo.localeCompare(y.codigo));
emDuvida.b = emDuvida.b.filter(r => !DECIDIDO_B.has(`${r.emp}:${r.codigo}`));
if (adicionadasB.length !== DECIDIDO_B.size || adicionadasB.some(r => r.n === 0 || r.pista !== 'nome')) {
  console.error(`a decisão do dono cita ${DECIDIDO_B.size} categorias fora das sugeridas (com movimento, só pelo nome) e o cache achou ${adicionadasB.length}.`);
  process.exit(1);
}

// Grupo (d): as sugeridas mais as quatro em dúvida que o dono incluiu; sete em dúvida têm destino escrito (despesas gerais ou
// fora do DRE); o que sobra em dúvida fica como "decidir depois".
const chaveD = r => `${r.emp}:${r.codigo}`;
const adicionadasD = emDuvida.d.filter(r => DECIDIDO_D.has(chaveD(r)));
const decididasD = [...sugeridas.d, ...adicionadasD]
  .sort((x, y) => x.emp.localeCompare(y.emp) || x.codigo.localeCompare(y.codigo));
const foraD = emDuvida.d.filter(r => FORA_D.has(chaveD(r)))
  .sort((x, y) => FORA_D.get(chaveD(x)).localeCompare(FORA_D.get(chaveD(y))) || x.emp.localeCompare(y.emp) || x.codigo.localeCompare(y.codigo));
emDuvida.d = emDuvida.d.filter(r => !DECIDIDO_D.has(chaveD(r)) && !FORA_D.has(chaveD(r)));
if (adicionadasD.length !== DECIDIDO_D.size || foraD.length !== FORA_D.size || emDuvida.d.some(r => r.n > 0)) {
  console.error(`a decisão do dono cita ${DECIDIDO_D.size} incluídas e ${FORA_D.size} com destino, o cache achou ${adicionadasD.length} e ${foraD.length}, ou sobrou "decidir depois" com movimento.`);
  process.exit(1);
}

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

const tabelaDestino = linhas => `<table>
    <thead><tr><th>emp.</th><th>código</th><th>categoria</th><th>conta do DRE hoje</th><th>lanç.</th><th>destino</th></tr></thead>
    <tbody>
${linhas.map(r => linha(r, false).replace('</tr>', `  <td>${FORA_D.get(chaveD(r)) === 'fora do DRE' ? 'fora do DRE (intercompany)' : 'despesas gerais do DRE'}</td>\n    </tr>`)).join('\n')}
    </tbody>
  </table>`;

function bloco(g) {
  const G = GRUPOS[g], sug = sugeridas[g], duv = emDuvida[g];
  const comMov = duv.filter(r => r.n > 0), semMov = duv.filter(r => r.n === 0);
  let corpo = '';

  if (g === 'a') {
    corpo += `<div class="decidido">
    <p style="margin:0"><strong>Decidido pelo dono em ${DECISAO_A}.</strong> Deduções da receita são as ${sug.length}
    sugeridas abaixo mais Reembolso por cancelamento (<code>2.02.97</code>, empresa 2): ${decididasA.length} códigos.</p>
    <p style="margin:6px 0 0"><strong>Revisto em ${DECISAO_A_ISS} (opção A):</strong> ISS RETIDO (<code>2.06.07</code>, empresas 1 e 2),
    que a decisão de ${DECISAO_A} incluía, <strong>não é dedução</strong>. A retenção da MeuBESS é do que ela desconta ao pagar
    fornecedor e já sai pela guia paga; ele aparece mais abaixo, entre as que ficaram de fora da decisão.</p>
  </div>
  <h3>Decididas: ${decididasA.length} códigos</h3>
  <p class="nota">Empresa 1: ${decididasA.filter(r => r.emp === '1').length} códigos. Empresa 2: ${decididasA.filter(r => r.emp === '2').length} códigos.
  Reembolso por cancelamento não era sugerida (a conta do DRE dela é outra); entrou por decisão do dono.</p>
  ${tabela(decididasA, false)}`;
  } else if (g === 'b') {
    corpo += `<div class="decidido">
    <p style="margin:0"><strong>Decidido pelo dono em ${DECISAO_B}.</strong> Custo de vendas são as ${sug.length}
    sugeridas mais ${adicionadasB.length} das que estavam em dúvida e tinham movimento, apontadas pelo nome (compras de
    matéria-prima e de mercadorias para revenda, fretes sobre compras e os gastos com "Custo" no nome): ${decididasB.length} códigos.
    Ficaram de fora as 2 apontadas só pela conta do DRE (empresa 1: <code>2.08.99</code> OUTRAS DESPESAS e
    <code>2.08.98</code> Reembolso) e as ${semMov.length} em dúvida sem movimento.</p>
  </div>
  <div class="chamada">
    <p style="margin:0"><strong>A tela reclassifica pela lista, não pela conta do DRE.</strong> Várias das decididas hoje estão
    numa conta de despesa do DRE no Omie (Despesas Variáveis, Despesas Administrativas, Despesas com Pessoal) ou sem conta;
    a Tela 2 leva o lançamento para (−) Custos de vendas pelo código da categoria, e não pela conta em que ela está pendurada.</p>
  </div>
  <h3>Decididas: ${decididasB.length} códigos</h3>
  <p class="nota">Empresa 1: ${decididasB.filter(r => r.emp === '1').length} códigos. Empresa 2: ${decididasB.filter(r => r.emp === '2').length} códigos.
  ${sug.length} eram sugeridas; ${adicionadasB.length} entraram por decisão do dono.</p>
  ${tabela(decididasB, false)}`;
  } else if (g === 'd') {
    corpo += `<div class="decidido">
    <p style="margin:0"><strong>Decidido pelo dono em ${DECISAO_D}.</strong> Resultado financeiro são as ${sug.length}
    sugeridas (juros, tarifas, rendimentos, empréstimo) mais Rendimentos de Aplicações (<code>1.02.02</code>) e IOF
    (<code>2.06.95</code>), nas duas empresas em que existem: ${decididasD.length} códigos.</p>
  </div>
  <div class="chamada">
    <p style="margin:0"><strong>Fora do resultado financeiro, com destino:</strong> Cartão de Crédito
    (<code>2.11.98</code>) e Aluguel de Veículo (<code>2.11.99</code>), da empresa 1, vão para as <strong>despesas gerais</strong>
    do DRE; os empréstimos e transferências entre as empresas (Intercompany) ficam <strong>fora do DRE</strong>, como as
    transferências. A tela reclassifica pela lista, não pela conta do DRE (as duas primeiras estão hoje em Despesas Financeiras).
    Atenção ao código: <code>2.05.99</code> é Transferência Intercompany na empresa 1 e Tarifas Bancárias (resultado financeiro)
    na empresa 2.</p>
  </div>
  <h3>Decididas: ${decididasD.length} códigos</h3>
  <p class="nota">Empresa 1: ${decididasD.filter(r => r.emp === '1').length} códigos. Empresa 2: ${decididasD.filter(r => r.emp === '2').length} códigos.
  ${sug.length} eram sugeridas; ${adicionadasD.length} entraram por decisão do dono.</p>
  ${tabela(decididasD, false)}
  <h3>Ficaram fora do resultado financeiro: ${foraD.length} códigos, cada um com destino</h3>
  ${tabelaDestino(foraD)}`;
  } else if (sug.length) {
    corpo += `<h3>Sugeridas: ${sug.length}</h3>
  <p class="nota">As duas pistas concordam — o nome da categoria e a conta do DRE em que ela já está apontam para este grupo.</p>
  ${tabela(sug, false)}`;
  } else {
    corpo += `<div class="decidido">
    <p style="margin:0"><strong>Decidido pelo dono em ${DECISAO_C}.</strong> Como o Omie não tem nenhuma categoria de
    depreciação nem de amortização, este grupo fica <strong>sem categorias</strong>: a Tela 2 mostra o EBITDA e o lucro
    líquido <strong>sem depreciação e sem amortização</strong>, com um aviso ao lado dos números, e <strong>não entra
    planilha do contador</strong>.</p>
  </div>
  <div class="chamada">
    <p style="margin:0"><strong>O aviso que a tela mostra:</strong> "${AVISO_C}"</p>
  </div>
  <h3>Decididas: nenhuma categoria</h3>
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
    Omie — da ficha de bens do contador. O dono decidiu não trazê-la: o EBITDA e o lucro líquido da tela saem sem
    depreciação e sem amortização, e a tela diz isso ao lado do número.</p>
  </div>`;
  }

  if (comMov.length) {
    corpo += `<h3>${g === 'a' || g === 'b' ? 'Ficaram de fora da decisão' : 'Em dúvida'}: ${comMov.length} com movimento no período</h3>
  <p class="nota">${g === 'a' || g === 'b' ? 'A decisão do dono não incluiu estas. ' : ''}Aqui as duas pistas <strong>discordam</strong>: ou o nome diz que é deste grupo e a conta do DRE diz outra coisa,
  ou a conta do DRE diz que é e o nome não parece. São as que valem uma olhada — estão ordenadas pelo número de lançamentos.</p>
  ${tabela(comMov, true)}`;
  }
  if (semMov.length) {
    corpo += `<details><summary>${g === 'd' ? `Ficaram de fora da decisão: ${semMov.length} sem nenhum lançamento de ${FAIXA} (empréstimos bancários e financiamento de veículo) — decidir depois` : `Mais ${semMov.length} em dúvida, sem nenhum lançamento de ${FAIXA} — cadastro parado, decidir depois`}</summary>
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
  .decidido { background: #eef8f1; border-left: 4px solid var(--b); padding: 1rem 1.2rem; border-radius: 0 6px 6px 0; margin: 0 0 1rem; }
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
    <p style="margin:0"><strong>Os quatro grupos estão decididos pelo dono.</strong> Nenhuma categoria foi mexida
    no Omie. O <strong>grupo a</strong> (dedução da receita) foi decidido em <strong>${DECISAO_A}</strong>;
    o <strong>grupo b</strong> (custo de vendas), o <strong>grupo c</strong> (depreciação e amortização: sem categorias, o
    número sai sem elas) e o <strong>grupo d</strong> (resultado financeiro) em <strong>${DECISAO_B}</strong>.
    As listas abaixo mostram o que entrou, o que ficou de fora e o que ficou anotado como "decidir depois".
    A sugestão original — onde as duas pistas concordam é firme; onde discordam, a categoria vai para "em dúvida" com o
    motivo ao lado — continua visível nas tabelas.</p>
  </div>

  <div class="placar">
    <div><b>${totalSug}</b><span>categorias sugeridas, somando os quatro grupos (todos já decididos)</span></div>
    <div><b>${totalDuv}</b><span>em dúvida — as duas pistas discordam</span></div>
    <div><b>${consideradas}</b><span>categorias olhadas (empresas 1 e 2)</span></div>
    <div><b>${vistos[1].size + vistos[2].size}</b><span>lançamentos contados, ${FAIXA}</span></div>
  </div>

  <ul class="indice">
    <li><a href="#grupo-a">a · Dedução da receita — decidido (${decididasA.length})</a></li>
    <li><a href="#grupo-b">b · Custo de vendas — decidido (${decididasB.length})</a></li>
    <li><a href="#grupo-c">c · Depreciação e amortização — decidido (sem categorias)</a></li>
    <li><a href="#grupo-d">d · Resultado financeiro — decidido (${decididasD.length})</a></li>
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
  <p>Ela dá material para lacunas de <code>docs/fontes.md</code>. A do grupo <strong>a</strong> o dono fechou em
  ${DECISAO_A} e as dos grupos <strong>b</strong>, <strong>c</strong> e <strong>d</strong> em ${DECISAO_D}; <strong>nenhuma segue aberta</strong>:</p>
  <ul>
    <li>a linha <strong>(−) Deduções</strong> da Tela 2 — quais categorias do Omie são dedução: grupo <strong>a</strong>
        (<strong>decidido</strong> em ${DECISAO_A});</li>
    <li>a linha <strong>(−) Custos de vendas</strong> — quais categorias são custo de vendas: grupo <strong>b</strong>
        (<strong>decidido</strong> em ${DECISAO_B});</li>
    <li>o cartão de <strong>EBITDA</strong> — quais categorias são resultado financeiro: grupo <strong>d</strong>
        (<strong>decidido</strong> em ${DECISAO_D}); e o que fazer com depreciação e amortização: grupo <strong>c</strong>
        (<strong>decidido</strong> em ${DECISAO_C}: sem categorias, o EBITDA e o lucro líquido saem sem elas, com aviso ao lado);</li>
    <li>o cartão <strong>% desp. funcionários / receita líquida</strong> da Tela 1, que depende da receita líquida e,
        por ela, do grupo <strong>a</strong> (<strong>decidido</strong>, no confronto do Omie).</li>
  </ul>
  <p style="margin-bottom:0">As decisões estão registradas em <code>docs/fontes.md</code>, nas linhas do EBITDA, do lucro líquido e das
  demais linhas da Tela 2 a que cada grupo pertence.</p>
</section>

<footer>
  <p><strong>De onde saem estes números.</strong> Do cadastro de categorias das empresas 1 e 2 lido do Omie em
  ${LEITURA} (<code>geral/categorias</code> → <code>ListarCategorias</code>, ${categorias[1].length} categorias na
  empresa 1 e ${categorias[2].length} na 2), com a conta do DRE de cada uma vindo do próprio retorno
  (<code>dadosDRE.codigoDRE</code> e <code>descricaoDRE</code>). A contagem de lançamentos vem de
  <code>financas/mf</code> → <code>ListarMovimentos</code>, de <strong>todas</strong> as respostas que estão no cache local
  (${LEITURA_MOVIMENTOS}), na faixa de ${FAIXA} por data de pagamento,
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
