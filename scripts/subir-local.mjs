#!/usr/bin/env node
// SOBE AS TRÊS TELAS NESTE COMPUTADOR, EM MODO DE PRODUÇÃO E SÓ EM 127.0.0.1
//
// A DECISÃO DO DONO, 27/09/2026: usar as telas neste computador, só ele, sem publicar. Daí as duas amarras que este
// script existe para garantir, e que ninguém precisa lembrar de digitar:
//
//   1. `-H 127.0.0.1` — o servidor atende SÓ a placa de rede interna da própria máquina. Sem isso o Next atende em
//      0.0.0.0, e quem estivesse no mesmo wi-fi abriria os números da empresa pelo IP deste computador. Com isso,
//      `http://127.0.0.1:4781` abre aqui e não abre em lugar nenhum da rede.
//   2. `NODE_ENV=production` — este computador tem `NODE_ENV=development` fixo no ambiente do usuário, e com ele o
//      `next build` quebra na página de erro que o próprio Next monta. O modo de produção é o que o dono quer de
//      qualquer jeito (a tela carrega pronta, sem a recompilação a cada visita), então o script o impõe.
//
// PORTA 4781, a mesma de sempre, e a que `scripts/capturar-tela.mjs` procura.
//
//   npm run local              # constrói e sobe  ← o comando de produção
//   npm run start              # só sobe (usa o build que já existe)
//   npm run build              # só constrói
//
// Para parar, Ctrl+C na janela em que ele subiu. Não põe nada no ar fora desta máquina, não faz login, não escreve
// no Omie nem nas planilhas: o único lugar em que o app escreve é o cache local `.cache/`.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
const ENDERECO = process.env.HOSTNAME || '127.0.0.1';
const PORTA = '4781';

const tem = (f) => process.argv.includes(f);
const soBuild = tem('--so-build');
const semBuild = tem('--sem-build');

// O `next` é chamado pelo mesmo node que está rodando este script — sem depender de `.bin/next.cmd`, de shell nem
// de PATH. `NODE_ENV` é imposto aqui e não vaza para o ambiente do usuário.
function next(...args) {
  const r = spawnSync(process.execPath, [NEXT, ...args], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (r.error) { console.error(r.error.message); process.exit(1); }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!semBuild) next('build');
if (soBuild) process.exit(0);

console.log(`\nAs três telas sobem em http://${ENDERECO}:${PORTA} — só neste computador. Ctrl+C para parar.\n`);
next('start', '-H', ENDERECO, '-p', PORTA);
