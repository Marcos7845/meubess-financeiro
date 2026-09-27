// CAPTURA UMA TELA COMO PÁGINA, SEM DINHEIRO — grava `docs/tela-N-captura.html`.
//
// PARA QUE SERVE. O dono precisa ver como a tela ficou sem ter o app rodando na frente. Esta captura é a página de
// verdade, servida pelo app, com TODO valor em dinheiro trocado por "—" e a contagem de lançamentos no lugar. Assim
// ela pode entrar no repositório: arquivo versionado aqui não tem dinheiro (ver o README).
//
// COMO. Busca a página no app rodando, joga fora todo `<script>` (é lá que o Next manda os dados crus, que TÊM os
// valores), tira os `title=` (que também têm), inlineia o CSS e troca o dinheiro. No fim, confere o que sobrou.
//
// E O NOME DO CLIENTE SAI TAMBÉM. A Tela 3 mostra o nome do cliente no eixo do gráfico e na lista; arquivo
// versionado aqui não tem nome de pessoa nem de empresa cliente, só o código. A tela marca cada nome com
// `class="cliente"` e `data-codigo="…"`, e a troca abaixo põe o código no lugar do nome. A trava do fim recusa a
// captura se sobrar um único `data-codigo`.
//
// E COM FILTRO. `--q` acrescenta à URL os filtros da tela (os de `docs/filtros.md`, que moram na query), e `--nome`
// muda o fim do nome do arquivo para a captura filtrada não sobrescrever a de sempre.
//
//   npm run dev                                   # (o app precisa estar no ar, em http://localhost:4781)
//   node scripts/capturar-tela.mjs --tela 1
//   node scripts/capturar-tela.mjs --tela 2 --mes 8 --ano 2026 --url http://localhost:4781
//   node scripts/capturar-tela.mjs --tela 1 --q "cc=TI" --nome filtro

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const URL_BASE = arg('--url', 'http://localhost:4781');
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const TELA = Number(arg('--tela', '1'));
// Os filtros da tela, como eles vão na URL: `--q "cc=TI"`, `--q "meses=7,8"`, `--q "status=atrasado&categoria=1.01.01"`.
const EXTRA_Q = arg('--q', '');
// O fim do nome do arquivo. Sem ele, a captura é a de sempre: `docs/tela-N-captura.html`.
const NOME = arg('--nome', '');

// Cada tela: a rota que a serve, o título da captura e a frase que explica o que sobrou de número.
const TELAS = {
  1: {
    rota: '/',
    titulo: 'Tela 1 — Gestão de Contas',
    referencia: 'docs/referencias/tela-1-gestao-de-contas.jpg',
  },
  2: {
    // Com a análise vertical ligada, para a captura mostrar as duas leituras da tabela.
    rota: '/dre',
    extra: { av: '1' },
    titulo: 'Tela 2 — DRE, Demonstrativo de Resultados',
    referencia: 'docs/referencias/tela-2-dre.jpg',
  },
  3: {
    rota: '/receber',
    titulo: 'Tela 3 — Contas a Receber',
    referencia: 'docs/referencias/tela-3-contas-a-receber.jpg',
  },
};

const tela = TELAS[TELA];
if (!tela) { console.error(`--tela ${TELA} não existe; as que existem são ${Object.keys(TELAS).join(' e ')}`); process.exit(1); }
if (NOME && !/^[a-z0-9-]+$/.test(NOME)) { console.error(`--nome aceita só letras minúsculas, números e hífen; veio ${JSON.stringify(NOME)}`); process.exit(1); }
const SAIDA = path.join(RAIZ, 'docs', `tela-${TELA}-captura${NOME ? `-${NOME}` : ''}.html`);

const q = new URLSearchParams({ ano: String(ANO), mes: String(MES), ...(tela.extra ?? {}) });
for (const [k, v] of new URLSearchParams(EXTRA_Q)) q.set(k, v);
const bruto = await (await fetch(`${URL_BASE}${tela.rota}?${q}`)).text();

// O miolo da página, sem nada de script.
let corpo = (/<body[^>]*>([\s\S]*)<\/body>/.exec(bruto)?.[1] ?? bruto)
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<template[\s\S]*?<\/template>/g, '')
  .replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, '')
  .replace(/\s(?:title)="[^"]*"/g, '')       // os `title` traziam o valor de cada dia
  .replace(/<!--[\s\S]*?-->/g, '');

// O NOME DO CLIENTE SAI, e no lugar fica o código dele. É a mesma marca em toda a tela — o eixo do gráfico por
// cliente e a coluna "Cliente" da lista —, então uma troca só dá conta das duas.
corpo = corpo.replace(/<span[^>]*class="cliente"[^>]*>[\s\S]*?<\/span>/g, (todo) => {
  const cod = /data-codigo="(\d+)"/.exec(todo)?.[1];
  return `<span class="cliente">${cod ? `cliente ${cod}` : 'cliente'}</span>`;
});

// E A LISTA DO FILTRO DE CLIENTE TAMBÉM. O filtro da Tela 3 tem um `<select>` com um `<option>` por cliente da janela,
// e cada um leva o mesmo `data-codigo` da tela: a troca é a mesma, num `<option>` em vez de num `<span>`.
corpo = corpo.replace(/<option([^>]*)data-codigo="(\d+)"([^>]*)>[\s\S]*?<\/option>/g,
  (todo, antes, cod, depois) => {
    const valor = /value="([^"]*)"/.exec(`${antes} ${depois}`)?.[1] ?? '';
    const escolhido = /selected/.test(`${antes} ${depois}`) ? ' selected' : '';
    return `<option value="${valor}"${escolhido}>cliente ${cod}</option>`;
  });

// O DINHEIRO SAI. O formato é o do `Intl` em pt-BR (a marca da moeda, espaço fino, milhar com ponto).
const MOEDA = /-?R\$[\s  ]*[\d.]+(?:,\d{2})?/g;
corpo = corpo.replace(MOEDA, '—');

// Os links da captura não levam a lugar nenhum fora do app: viram texto, para a página se bastar.
corpo = corpo.replace(/<a\s[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (todo, dentro) => {
  const classe = /class="([^"]*)"/.exec(todo)?.[1] ?? '';
  return `<span class="${classe}">${dentro}</span>`;
});

// O botão "atualizar agora" não funciona fora do app; vira texto.
corpo = corpo.replace(/<button[^>]*class="botao"[^>]*>([\s\S]*?)<\/button>/, '<span class="botao" style="opacity:.55">$1</span>');

const css = fs.readFileSync(path.join(RAIZ, 'app', 'globals.css'), 'utf8');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MeuBESS · ${tela.titulo} (captura sem valores)</title>
<style>
${css}
.nota {
  margin: 0; padding: 11px 14px; background: var(--marca-escura); color: var(--texto-claro); font-size: 12.5px;
}
.nota strong { color: var(--destaque); }
</style>
</head>
<body>
<p class="nota">
  <strong>Captura da ${tela.titulo}</strong> — a página que o app serve, de ${String(MES).padStart(2, '0')}/${ANO}${EXTRA_Q ? `, com o filtro <code>${EXTRA_Q.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code> aplicado` : ''}, com
  <strong>todo valor em dinheiro trocado por “—”</strong>. O que ficou de número é a
  <strong>contagem de lançamentos</strong> que entrou em cada indicador, que é o que
  <code>docs/conferencia.md</code> confere, e os percentuais, que são razão e não dinheiro.
  O layout é o de <code>${tela.referencia}</code>;
  as cores são as variáveis de <code>app/globals.css</code> (a marca da MeuBESS não está no repositório).
</p>
${corpo}
</body>
</html>
`;

// A TRAVA: se sobrou dinheiro, a captura não é gravada.
const PROIBIDO = [
  [/R\$/, 'a marca da moeda'],
  [/\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/, 'um número de milhar'],
  [/\b\d+,\d{2}\b/, 'um número com centavos'],
  // Se sobrou um `data-codigo`, sobrou o nome do cliente junto: a troca acima não pegou aquele pedaço.
  [/data-codigo=/, 'um nome de cliente que a troca não pegou'],
];
for (const [re, oque] of PROIBIDO) {
  const m = re.exec(html.replace(/<style>[\s\S]*?<\/style>/, ''));
  if (m) { console.error(`a captura ia sair com ${oque}: ${JSON.stringify(m[0])}`); process.exit(1); }
}

fs.writeFileSync(SAIDA, html);
console.log(`gravado ${path.relative(RAIZ, SAIDA)} (${html.length} bytes)`);
