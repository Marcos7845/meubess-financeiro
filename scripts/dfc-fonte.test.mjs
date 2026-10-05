import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acharPasta, acharPastas } from '../lib/regras/dfc-fonte.mjs';

// Árvore de mentira, só com nomes e arquivos vazios; nenhum caminho real entra aqui.
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'meubess-dfc-fonte-'));
test.after(() => fs.rmSync(base, { recursive: true, force: true }));

function criar(relativo, arquivos) {
  const pasta = path.join(base, ...relativo.split('/'));
  fs.mkdirSync(pasta, { recursive: true });
  for (const a of arquivos) fs.writeFileSync(path.join(pasta, a), '');
  return pasta;
}
const mensais = (n, formato = (i) => `${String(i).padStart(2, '0')} - DFC MES ${i} 2026.xlsx`) =>
  Array.from({ length: n }, (_, i) => formato(i + 1));

const semDfcDir = (fn) => {
  const antes = process.env.DFC_DIR;
  delete process.env.DFC_DIR;
  try { return fn(); } finally { if (antes !== undefined) process.env.DFC_DIR = antes; }
};

test('acha a pasta do ano em nível fundo e prefere a que numera mais planilhas', () => {
  const raiz = 'raiz1';
  criar(`${raiz}/Pessoa X - FINANCEIRO/3N/DFC/2026`, ['DFC AGOSTO 2026.xlsx', 'DFC SETEMBRO 2026.xlsx']);
  criar(`${raiz}/Pessoa X - FINANCEIRO/B3N/DFC/2026`, mensais(9, (i) => `${String(i + 3).padStart(2, '0')} - DFC - M${i}2026.xlsx`));
  const certa = criar(`${raiz}/Pessoa X - FINANCEIRO/B3W/DFC/2026`, [...mensais(12), 'ContratoCCB 1.pdf', '~$02 - DFC.xlsx']);
  criar(`${raiz}/Pessoa X - FINANCEIRO/N3/DFC/2026`, ['DFC AGOSTO2026.xlsx']);
  criar(`${raiz}/Pessoa X - FINANCEIRO/B3N/DOCUMENTOS/09.2026`, ['balancete.xlsx']);
  const r = semDfcDir(() => acharPasta([path.join(base, raiz)]));
  assert.equal(r.caminho, certa);
  assert.equal(r.arquivos.length, 12);
  assert.equal(r.numerados, 12);
});

test('descobre as quatro pastas anuais e aceita o nome mensal de cada unidade', () => {
  const raiz = 'raiz-unidades';
  for (const u of ['3N', 'B3N', 'B3W', 'N3']) criar(`${raiz}/${u}/DFC/2026`, [`DFC AGOSTO 2026.xlsx`]);
  const pastas = semDfcDir(() => acharPastas([path.join(base, raiz)]));
  assert.deepEqual([...pastas.keys()], ['3N', 'B3N', 'B3W', 'N3']);
  assert.ok([...pastas.values()].every((p) => p.numerados === 1));
});

test('o resultado não depende da ordem do disco: empate vai para a cópia sem sufixo e depois para o nome', () => {
  const raiz = 'raiz2';
  criar(`${raiz}/a/DFC 2026 (1)`, mensais(3));
  const sem = criar(`${raiz}/b/DFC 2026`, mensais(3));
  criar(`${raiz}/c/DFC 2026`, mensais(3));
  assert.equal(semDfcDir(() => acharPasta([path.join(base, raiz)])).caminho, sem);
});

test('pasta funda demais não conta; nomes mensais sem número são aceitos', () => {
  const raiz = 'raiz3';
  criar(`${raiz}/n1/n2/n3/n4/n5/n6/n7/2026`, mensais(12));
  criar(`${raiz}/n1/2026`, ['DFC AGOSTO 2026.xlsx']);
  assert.equal(semDfcDir(() => acharPasta([path.join(base, raiz)])).numerados, 1);
  assert.equal(semDfcDir(() => acharPasta([path.join(base, 'não-existe')])), null);
});

test('a primeira raiz com candidata decide', () => {
  const primeira = criar('raiz4/um/2026', mensais(2));
  criar('raiz5/dois/2026', mensais(12));
  const r = semDfcDir(() => acharPasta([path.join(base, 'raiz4'), path.join(base, 'raiz5')]));
  assert.equal(r.caminho, primeira);
});

test('DFC_DIR manda e não se procura em mais lugar nenhum', () => {
  const dir = criar('raiz6/escolhida', mensais(2));
  criar('raiz6/outra/2026', mensais(12));
  const antes = process.env.DFC_DIR;
  try {
    process.env.DFC_DIR = dir;
    assert.equal(acharPasta([path.join(base, 'raiz6')]).caminho, dir);
    process.env.DFC_DIR = path.join(base, 'raiz6', 'não-existe');
    assert.equal(acharPasta([path.join(base, 'raiz6')]), null);
  } finally {
    if (antes === undefined) delete process.env.DFC_DIR; else process.env.DFC_DIR = antes;
  }
});

test('segue atalho (link simbólico ou junção) para a pasta compartilhada', (t) => {
  const alvo = criar('alvo-compartilhado/DFC/2026', mensais(12));
  const raiz = path.join(base, 'raiz7');
  fs.mkdirSync(raiz, { recursive: true });
  try { fs.symlinkSync(path.join(base, 'alvo-compartilhado'), path.join(raiz, 'atalho'), 'junction'); }
  catch { t.skip('este sistema não deixou criar o atalho'); return; }
  const r = semDfcDir(() => acharPasta([raiz]));
  assert.equal(r.caminho, path.join(raiz, 'atalho', 'DFC', '2026'));
  assert.equal(r.arquivos.length, 12);
  assert.ok(fs.existsSync(alvo));
});
