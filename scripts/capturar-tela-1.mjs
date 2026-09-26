// CAPTURA A TELA 1 COMO PÁGINA, SEM DINHEIRO — grava `docs/tela-1-captura.html`.
//
// PARA QUE SERVE. O dono precisa ver como a Tela 1 ficou sem ter o app rodando na frente. Esta captura é a página
// de verdade, servida pelo app, com TODO valor em dinheiro trocado por "—" e a contagem de lançamentos no lugar.
// Assim ela pode entrar no repositório: arquivo versionado aqui não tem dinheiro (ver o README).
//
// COMO. Busca a página no app rodando, joga fora todo `<script>` (é lá que o Next manda os dados crus, que TÊM os
// valores), tira os `title=` (que também têm), inlineia o CSS e troca o dinheiro. No fim, confere o que sobrou.
//
//   npm run dev                          # (o app precisa estar no ar, em http://localhost:4781)
//   node scripts/capturar-tela-1.mjs --url http://localhost:4781 --mes 8 --ano 2026

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const URL_BASE = arg('--url', 'http://localhost:4781');
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const SAIDA = path.join(RAIZ, 'docs', 'tela-1-captura.html');

const bruto = await (await fetch(`${URL_BASE}/?ano=${ANO}&mes=${MES}`)).text();

// O miolo da página, sem nada de script.
let corpo = (/<body[^>]*>([\s\S]*)<\/body>/.exec(bruto)?.[1] ?? bruto)
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<template[\s\S]*?<\/template>/g, '')
  .replace(/<next-route-announcer[\s\S]*?<\/next-route-announcer>/g, '')
  .replace(/\s(?:title)="[^"]*"/g, '')       // os `title` traziam o valor de cada dia
  .replace(/<!--[\s\S]*?-->/g, '');

// O DINHEIRO SAI. O formato é o do `Intl` em pt-BR (a marca da moeda, espaço fino, milhar com ponto).
const MOEDA = /-?R\$[\s  ]*[\d.]+(?:,\d{2})?/g;
corpo = corpo.replace(MOEDA, '—');

// O botão "atualizar agora" não funciona fora do app; vira texto.
corpo = corpo.replace(/<button[^>]*class="botao"[^>]*>([\s\S]*?)<\/button>/, '<span class="botao" style="opacity:.55">$1</span>');

const css = fs.readFileSync(path.join(RAIZ, 'app', 'globals.css'), 'utf8');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MeuBESS · Tela 1 — Gestão de Contas (captura sem valores)</title>
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
  <strong>Captura da Tela 1</strong> — a página que o app serve, de ${String(MES).padStart(2, '0')}/${ANO}, com
  <strong>todo valor em dinheiro trocado por “—”</strong>. O que ficou de número é a
  <strong>contagem de lançamentos</strong> que entrou em cada indicador, que é o que
  <code>docs/conferencia.md</code> confere. O layout é o de <code>docs/referencias/tela-1-gestao-de-contas.jpg</code>;
  as cores são as variáveis de <code>app/globals.css</code> (a marca da MeuBESS não está no repositório).
</p>
${corpo}
</body>
</html>
`;

// A TRAVA: se sobrou dinheiro, a captura não é gravada.
const PROIBIDO = [[/R\$/, 'a marca da moeda'], [/\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/, 'um número de milhar'], [/\b\d+,\d{2}\b/, 'um número com centavos']];
for (const [re, oque] of PROIBIDO) {
  const m = re.exec(html.replace(/<style>[\s\S]*?<\/style>/, ''));
  if (m) { console.error(`a captura ia sair com ${oque}: ${JSON.stringify(m[0])}`); process.exit(1); }
}

fs.writeFileSync(SAIDA, html);
console.log(`gravado ${path.relative(RAIZ, SAIDA)} (${html.length} bytes)`);
