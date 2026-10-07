// Este projeto é JavaScript puro. O build do Next verifica a compilação das páginas
// e módulos em uma pasta isolada, sem mexer no app local que pode estar em uso.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const next = path.join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next');
const r = spawnSync(process.execPath, [next, 'build'], {
  cwd: raiz, stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', MEUBESS_DIST: '.next-prova' },
});
if (r.error) { console.error(r.error.message); process.exit(1); }
process.exit(r.status ?? 1);
