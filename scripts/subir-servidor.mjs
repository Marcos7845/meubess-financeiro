#!/usr/bin/env node
// SOBE AS TRÊS TELAS NO SERVIDOR (Railway) — em 0.0.0.0, na porta que o Railway manda em `$PORT`, e COM LOGIN.
//
// É o `startCommand` de `railway.json` (`npm run servidor`). O build é o mesmo de sempre (`npm run build`). O que este
// script garante, e que ninguém precisa lembrar de configurar:
//
//   1. O LOGIN NÃO SE DESLIGA AQUI. Com `MEUBESS_LOGIN=desligado` no ambiente, ele se recusa a subir — essa variável
//      é só do `npm run local`, que atende 127.0.0.1. Sem `SESSAO_SEGREDO` (32 caracteres ou mais), também não sobe.
//   2. O QUE PRECISA SOBREVIVER A UM REDEPLOY VAI PARA O VOLUME. `MEUBESS_DADOS_DIR` (ou, sem ela, o
//      `RAILWAY_VOLUME_MOUNT_PATH` que o Railway anuncia) guarda o cadastro de quem entra e o DFC que o PC mandou; e a
//      pasta `.cache/` do app — o cache do Omie e a hora da última releitura — passa a ser um atalho para
//      `<volume>/cache`, para o Omie não ter de ser relido do zero a cada deploy.
//   3. O DFC VEM DO QUE O PC MANDOU (`DFC_FONTE=servidor`), a não ser que o ambiente diga outra coisa.
//
// Não imprime valor de variável nenhuma: só o nome das que faltam.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
const PORTA = process.env.PORT || '3000';

const parar = (msg) => { console.error(`não subi: ${msg}`); process.exit(1); };

if (process.env.MEUBESS_LOGIN === 'desligado') parar('MEUBESS_LOGIN=desligado é só para o npm run local; tire essa variável do servidor');
if ((process.env.SESSAO_SEGREDO ?? '').length < 32) parar('SESSAO_SEGREDO precisa estar no ambiente, com 32 caracteres ou mais');
if (!process.env.DFC_ENVIO_SEGREDO) console.warn('aviso: sem DFC_ENVIO_SEGREDO, POST /api/dfc recusa todo envio do PC');

const dados = process.env.MEUBESS_DADOS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (dados) {
  fs.mkdirSync(path.join(dados, 'cache'), { recursive: true });
  const cache = path.join(RAIZ, '.cache');
  let st = null;
  try { st = fs.lstatSync(cache); } catch { /* não existe: cria o atalho */ }
  if (!st) fs.symlinkSync(path.join(dados, 'cache'), cache, 'dir');
  else if (!st.isSymbolicLink()) console.warn('aviso: .cache/ já existe como pasta comum; o cache do Omie não vai para o volume');
} else {
  console.warn('aviso: sem MEUBESS_DADOS_DIR nem volume do Railway, o cadastro e o DFC ficam em .cache/servidor e se perdem num redeploy');
}

const env = { ...process.env, NODE_ENV: 'production', DFC_FONTE: process.env.DFC_FONTE || 'servidor' };
console.log(`As três telas sobem em 0.0.0.0:${PORTA}, com login.`);
const filho = spawn(process.execPath, [NEXT, 'start', '-H', '0.0.0.0', '-p', PORTA], { cwd: RAIZ, stdio: 'inherit', env });
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => filho.kill(s));
filho.on('exit', (code) => process.exit(code ?? 1));
