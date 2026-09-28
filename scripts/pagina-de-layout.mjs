// ESCREVE `docs/layout.html` — a página que o dono lê para decidir se aprova o layout novo.
//
// PARA QUE SERVE. `docs/layout.md` é a fonte: a história de cada tela, o plano de gráficos e o checklist. Mas o dono
// não lê markdown num editor — ele abre uma página. Esta página é a mesma coisa, formatada, com a CAPTURA DAS TRÊS
// TELAS DENTRO dela, para o plano e o resultado ficarem lado a lado.
//
// ONDE CADA CAPTURA ENTRA quem diz é o próprio `.md`, com uma linha `<!-- captura N -->` embaixo do título da tela.
// Assim a ordem da página é a ordem do documento, e acrescentar uma tela não mexe neste script.
//
// A PÁGINA SE BASTA: o CSS é dela mesma, não chama API nenhuma e não busca nada de fora. Cada captura entra num
// `<iframe srcdoc>` — é a única forma de mostrar a tela inteira sem o CSS dela escapar e desmontar esta página.
//
// NENHUM NÚMERO NOVO. As capturas já entram sem dinheiro e sem nome de cliente (é `scripts/capturar-tela.mjs` que
// garante isso, com a trava dele); aqui elas só são embrulhadas.
//
//   node scripts/capturar-tela.mjs --tela 1     # primeiro as três capturas
//   node scripts/capturar-tela.mjs --tela 2
//   node scripts/capturar-tela.mjs --tela 3
//   node scripts/pagina-de-layout.mjs           # depois a página

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTE = path.join(RAIZ, 'docs', 'layout.md');
const SAIDA = path.join(RAIZ, 'docs', 'layout.html');

// AS TRÊS TELAS, e a altura do quadro de cada uma. A altura é fixa porque a captura é uma página inteira dentro do
// iframe, e um iframe não cresce sozinho com o conteúdo — medi-lo pediria JavaScript, e esta página não roda nenhum.
// Os números são a altura de cada captura na largura desta coluna, com uma folga pequena; captura mais alta do que
// isso rola dentro do próprio quadro, e não se perde.
const TELAS = {
  1: { arquivo: 'tela-1-captura.html', titulo: 'Tela 1 — Gestão de Contas', altura: 2120 },
  2: { arquivo: 'tela-2-captura.html', titulo: 'Tela 2 — DRE, Demonstrativo de Resultados', altura: 1500 },
  3: { arquivo: 'tela-3-captura.html', titulo: 'Tela 3 — Contas a Receber', altura: 1700 },
};

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// O QUADRO DE UMA CAPTURA, com a trava junto: esta página não pode sair com dinheiro nem com nome de cliente. Como o
// único pedaço dela que vem de fora são as capturas — que já passaram pela trava de `scripts/capturar-tela.mjs` —,
// aqui basta reconferir as duas marcas em cada uma.
function quadroDaCaptura(n) {
  const tela = TELAS[n];
  if (!tela) { console.error(`o .md pede a captura da tela ${n}, que não existe`); process.exit(1); }
  const caminho = path.join(RAIZ, 'docs', tela.arquivo);
  if (!fs.existsSync(caminho)) {
    console.error(`falta docs/${tela.arquivo} — rode antes: node scripts/capturar-tela.mjs --tela ${n}`);
    process.exit(1);
  }
  const captura = fs.readFileSync(caminho, 'utf8');
  if (/data-codigo=/.test(captura) || /R\$/.test(captura.replace(/<style>[\s\S]*?<\/style>/, ''))) {
    console.error(`docs/${tela.arquivo} ainda tem dinheiro ou nome de cliente; a página não foi gravada`);
    process.exit(1);
  }
  const naIframe = captura.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<p class="legenda-captura">
  A página que o app serve, de 08/2026, com todo valor em dinheiro trocado por “—” e todo nome de cliente trocado
  pelo código — é assim que ela pode entrar no repositório. O que ficou de número é a contagem de lançamentos de cada
  indicador.
</p>
<div class="captura" style="--altura: ${tela.altura}px">`
    + `<iframe title="${tela.titulo} (captura sem valores)" srcdoc="${naIframe}"></iframe></div>`;
}

// O PEDAÇO DE MARKDOWN QUE ESTE DOCUMENTO USA, e nada além: negrito, itálico, `código` e link. É escrito depois do
// escape, para um `<` do texto continuar virando `&lt;` e não uma tag.
const emLinha = (s) => escapar(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

// Uma linha de tabela do markdown: `| a | b |` → as células, sem os canos das pontas.
const celulas = (linha) => linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const eSeparador = (linha) => /^\|[\s:|-]+\|$/.test(linha.trim());

function paraHtml(md) {
  const linhas = md.split(/\r?\n/);
  const saida = [];
  let i = 0;
  let paragrafo = [];
  let lista = null;
  // O ITEM DE LISTA É JUNTADO ANTES DE SER ESCRITO. No `.md` um item pode ocupar três linhas, e um `**negrito**`
  // pode começar numa e fechar na outra: escrever linha a linha deixaria os asteriscos à mostra.
  let item = null;

  const fecharItem = () => {
    if (!item) return;
    saida.push(`<li${item.feito ? ' class="feito"' : ''}>${emLinha(item.linhas.join(' '))}</li>`);
    item = null;
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) { saida.push(`<p>${emLinha(paragrafo.join(' '))}</p>`); paragrafo = []; }
  };
  const fecharLista = () => { fecharItem(); if (lista) { saida.push(`</${lista}>`); lista = null; } };
  const fechar = () => { fecharParagrafo(); fecharLista(); };

  while (i < linhas.length) {
    const linha = linhas[i];

    if (!linha.trim()) { fechar(); i += 1; continue; }

    const titulo = /^(#{1,4})\s+(.*)$/.exec(linha);
    if (titulo) {
      fechar();
      const n = titulo[1].length;
      saida.push(`<h${n}>${emLinha(titulo[2])}</h${n}>`);
      i += 1; continue;
    }

    if (/^---+$/.test(linha.trim())) { fechar(); saida.push('<hr>'); i += 1; continue; }

    // A CAPTURA DA TELA, onde o `.md` a pede.
    const pedeCaptura = /^<!--\s*captura\s+(\d)\s*-->$/.exec(linha.trim());
    if (pedeCaptura) { fechar(); saida.push(quadroDaCaptura(Number(pedeCaptura[1]))); i += 1; continue; }

    // TABELA: começa numa linha com canos e a linha seguinte é o separador.
    if (linha.trim().startsWith('|') && eSeparador(linhas[i + 1] ?? '')) {
      fechar();
      const cabeca = celulas(linha);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) { corpo.push(celulas(linhas[i])); i += 1; }
      saida.push('<div class="rolagem"><table>');
      saida.push(`<thead><tr>${cabeca.map((c) => `<th>${emLinha(c)}</th>`).join('')}</tr></thead>`);
      saida.push(`<tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${emLinha(c)}</td>`).join('')}</tr>`).join('')}</tbody>`);
      saida.push('</table></div>');
      continue;
    }

    // LISTA, com ou sem caixa de marcar. A caixa marcada do checklist vira um "✓" — sem `<input>`, que numa página
    // de leitura só convidaria a clicar em algo que não faz nada.
    const abre = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/.exec(linha);
    if (abre) {
      fecharParagrafo();
      const querida = /^\s*\d+\./.test(linha) ? 'ol' : 'ul';
      if (lista !== querida) { fecharLista(); saida.push(`<${querida}>`); lista = querida; }
      fecharItem();
      const marcado = /^\[x\]\s+/i.exec(abre[2]);
      item = { feito: Boolean(marcado), linhas: [marcado ? abre[2].slice(marcado[0].length) : abre[2]] };
      i += 1; continue;
    }

    // LINHA SOLTA DEPOIS DE UM ITEM DE LISTA é a continuação dele — no `.md` os itens são quebrados em várias
    // linhas para caber em 120 colunas. Sem isto, cada quebra fecharia a lista e a numeração recomeçaria do 1.
    if (item) { item.linhas.push(linha.trim()); i += 1; continue; }
    fecharLista();
    paragrafo.push(linha.trim());
    i += 1;
  }
  fechar();
  return saida.join('\n');
}

const md = fs.readFileSync(FONTE, 'utf8');
const corpo = paraHtml(md);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MeuBESS · O layout das três telas</title>
<style>
:root {
  --marca-escura: #102040; --marca: #004888; --marca-clara: #0060a8; --destaque: #0079cb;
  --fundo: #ffffff; --painel: #f5f7fa; --borda: #d5dbe4; --texto: #16202e; --texto-fraco: #5d6b7e;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--fundo); color: var(--texto);
  font: 15px/1.6 "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
}
.faixa { background: var(--marca-escura); color: #fff; padding: 22px 32px; }
.faixa h1 { margin: 0; font-size: 22px; font-weight: 600; }
.faixa p { margin: 6px 0 0; font-size: 13.5px; opacity: .8; max-width: 90ch; }
main { max-width: 1180px; margin: 0 auto; padding: 8px 32px 60px; }
h1 { font-size: 24px; margin: 38px 0 4px; padding-top: 10px; }
h2 { font-size: 18px; margin: 30px 0 4px; color: var(--marca); }
h3 { font-size: 15px; margin: 22px 0 4px; }
p { margin: 10px 0; max-width: 104ch; }
hr { border: 0; border-top: 1px solid var(--borda); margin: 40px 0 0; }
code { background: var(--painel); border-radius: 3px; padding: 1px 5px; font-size: 12.5px; }
a { color: var(--marca-clara); }
ul, ol { max-width: 104ch; padding-left: 22px; }
li { margin: 5px 0; }
li.feito { list-style: none; position: relative; }
li.feito::before { content: "✓"; position: absolute; left: -20px; color: var(--marca-clara); font-weight: 700; }
.rolagem { overflow-x: auto; margin: 14px 0 18px; }
table { border-collapse: collapse; font-size: 13px; width: 100%; }
th, td { border-bottom: 1px solid var(--borda); padding: 8px 12px 8px 0; text-align: left; vertical-align: top; }
thead th {
  font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--texto-fraco);
  border-bottom: 1px solid var(--texto-fraco); white-space: nowrap;
}
/* A altura de cada quadro vem da variável que o próprio quadro traz (ver TELAS, no topo do script): um iframe não
 * cresce sozinho com o conteúdo, e medi-lo pediria JavaScript, que esta página não roda. Sem acento grave nesta
 * linha: ela mora dentro de um template literal, e um acento grave aqui fecharia a página no meio. */
.captura { margin: 18px 0 8px; border: 1px solid var(--borda); border-radius: 8px; overflow: hidden; }
.captura iframe { display: block; width: 100%; height: var(--altura, 1800px); border: 0; background: #fff; }
.legenda-captura { margin: 0 0 22px; font-size: 12.5px; color: var(--texto-fraco); }
</style>
</head>
<body>
<header class="faixa">
  <h1>MeuBESS · o layout das três telas</h1>
  <p>
    Como as três telas passam a ser desenhadas, e por quê — uma pergunta por gráfico. A captura de cada uma está aqui
    dentro, embaixo do título dela. A Tela 1 está refeita; nas Telas 2 e 3, o que já mudou foram os filtros e a frase
    de 5 segundos da Tela 3, e o resto do desenho delas espera a sua aprovação. Nenhum número, indicador, filtro ou
    regra mudou.
  </p>
</header>
<main>
${corpo}
</main>
</body>
</html>
`;

fs.writeFileSync(SAIDA, html);
console.log(`gravado ${path.relative(RAIZ, SAIDA)} (${html.length} bytes)`);
