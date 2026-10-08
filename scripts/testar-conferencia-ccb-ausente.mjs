import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('conferência informa CCB local ausente sem quebrar', (t) => {
  const nomes = ['DFC_DIR', 'OMIE_CACHE_DIR', 'CONTRATOS_DIR'];
  if (nomes.some((nome) => !process.env[nome] || !fs.existsSync(process.env[nome]))) {
    t.skip('precisa das três fontes locais indicadas por DFC_DIR, OMIE_CACHE_DIR e CONTRATOS_DIR');
    return;
  }

  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'meubess-conferencia-ccb-'));
  try {
    for (const dir of ['lib', 'dados']) fs.cpSync(path.join(raiz, dir), path.join(copia, dir), { recursive: true });
    fs.mkdirSync(path.join(copia, 'scripts'));
    fs.mkdirSync(path.join(copia, 'docs'));
    fs.copyFileSync(path.join(raiz, 'scripts', 'numeros-das-telas.mjs'), path.join(copia, 'scripts', 'numeros-das-telas.mjs'));
    for (const nome of ['fontes.md', 'trava-agosto-2026.json'])
      fs.copyFileSync(path.join(raiz, 'docs', nome), path.join(copia, 'docs', nome));

    const saida = execFileSync(process.execPath, ['scripts/numeros-das-telas.mjs', '--hoje', '08/10/2026'], {
      cwd: copia, encoding: 'utf8', timeout: 180_000,
      env: { ...process.env, DFC_DIR: path.resolve(process.env.DFC_DIR), OMIE_CACHE_DIR: path.resolve(process.env.OMIE_CACHE_DIR), CONTRATOS_DIR: path.resolve(process.env.CONTRATOS_DIR) },
    });
    assert.match(saida, /\d+ indicadores — \d+ conferidos, \d+ divergentes, \d+ a conferir/);
    assert.match(saida, /a conferir: Tela 2 — Capital de giro tomado: falta a CCB do Itaú/);
    assert.match(saida, /a conferir: Tela 2 — Dívida líquida: falta a CCB do Itaú/);
    const relatorio = fs.readFileSync(path.join(copia, 'docs', 'conferencia.md'), 'utf8');
    assert.match(relatorio, /a conferir: \*\*Tela 2 — Capital de giro tomado/);
    assert.match(relatorio, /a conferir: \*\*Tela 2 — Dívida líquida/);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});
