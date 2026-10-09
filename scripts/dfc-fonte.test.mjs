import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acharPasta, acharPastas, fonteDaPastaSincronizada } from '../lib/regras/dfc-fonte.mjs';
import { espelharDfc } from './espelhar-dfc.mjs';
import { registrarEnvio } from './envio-dfc-log.mjs';
import { listarEspelho, planejarEnvio } from './envio-dfc-unidades.mjs';

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

test('espelho copia os 12 meses de cada unidade, sobrescreve, preserva mtime e deixa a origem intacta', async () => {
  const origem = path.join(base, 'origem-espelho');
  const destino = path.join(base, 'destino-espelho');
  const data = new Date('2026-09-15T12:00:00.000Z');
  for (const unidade of ['3N', 'B3N', 'B3W', 'N3']) {
    const pasta = path.join(origem, unidade, 'DFC', '2026');
    fs.mkdirSync(pasta, { recursive: true });
    for (let mes = 1; mes <= 12; mes++) {
      const arquivo = path.join(pasta, `${String(mes).padStart(2, '0')} - DFC MES ${mes} 2026.xlsx`);
      fs.writeFileSync(arquivo, `fixture-${unidade}-${mes}`);
      fs.utimesSync(arquivo, data, data);
    }
    fs.mkdirSync(path.join(destino, unidade), { recursive: true });
    fs.writeFileSync(path.join(destino, unidade, '09 - DFC MES 9 2026.xlsx'), 'antigo');
  }
  const anterior = process.env.DFC_DIR;
  let fonte;
  try {
    process.env.DFC_DIR = origem;
    fonte = fonteDaPastaSincronizada();
  } finally {
    if (anterior === undefined) delete process.env.DFC_DIR; else process.env.DFC_DIR = anterior;
  }
  const nomes = await fonte.arquivos();
  assert.equal(nomes.length, 48);
  await assert.rejects(espelharDfc({ fonte, nomes: nomes.filter((n) => n.includes('__09 -')), destino }), /recortada/);
  assert.deepEqual(await espelharDfc({ fonte, nomes, destino }), { '3N': 12, B3N: 12, B3W: 12, N3: 12 });
  for (const unidade of ['3N', 'B3N', 'B3W', 'N3']) {
    for (let mes = 1; mes <= 12; mes++) {
      const nome = `${String(mes).padStart(2, '0')} - DFC MES ${mes} 2026.xlsx`;
      const arquivo = path.join(origem, unidade, 'DFC', '2026', nome);
      const copia = path.join(destino, unidade, nome);
      assert.equal(fs.readFileSync(arquivo, 'utf8'), `fixture-${unidade}-${mes}`);
      assert.equal(fs.readFileSync(copia, 'utf8'), `fixture-${unidade}-${mes}`);
      assert.equal(fs.statSync(arquivo).mtimeMs, data.getTime());
      assert.equal(fs.statSync(copia).mtimeMs, data.getTime());
    }
  }
  try {
    process.env.DFC_DIR = destino;
    const espelho = fonteDaPastaSincronizada();
    assert.deepEqual((await espelho.arquivos()).sort(), nomes.sort());
    for (const nome of nomes) {
      const [, unidade, mes] = /^(\w+)__(\d+) -/.exec(nome);
      assert.equal((await espelho.ler(nome)).toString(), `fixture-${unidade}-${Number(mes)}`);
    }
  } finally {
    if (anterior === undefined) delete process.env.DFC_DIR; else process.env.DFC_DIR = anterior;
  }
});

test('DFC_DIR ainda aceita pasta plana da B3W', async () => {
  const pasta = criar('plana', ['09 - DFC SETEMBRO 2026.xlsx']);
  const anterior = process.env.DFC_DIR;
  try {
    process.env.DFC_DIR = pasta;
    assert.deepEqual(await fonteDaPastaSincronizada().arquivos(), ['B3W__09 - DFC SETEMBRO 2026.xlsx']);
  } finally {
    if (anterior === undefined) delete process.env.DFC_DIR; else process.env.DFC_DIR = anterior;
  }
});

test('espelho por unidade prevalece sobre cópia plana antiga na mesma raiz', async () => {
  const pasta = criar('plana-mista', ['08 - DFC AGOSTO 2026.xlsx']);
  criar('plana-mista/B3W', ['09 - DFC SETEMBRO 2026.xlsx']);
  criar('plana-mista/N3', ['DFC SETEMBRO 2026.xlsx']);
  const anterior = process.env.DFC_DIR;
  try {
    process.env.DFC_DIR = pasta;
    assert.deepEqual(await fonteDaPastaSincronizada().arquivos(), [
      'B3W__09 - DFC SETEMBRO 2026.xlsx', 'N3__DFC SETEMBRO 2026.xlsx',
    ]);
  } finally {
    if (anterior === undefined) delete process.env.DFC_DIR; else process.env.DFC_DIR = anterior;
  }
});

test('registro de falha traz hora, etapa e mensagem sem segredo', async () => {
  const arquivo = path.join(base, 'logs-fixture', 'envio-dfc.log');
  await registrarEnvio({ arquivo, resultado: 'erro', etapa: 'confirmação do envio',
    erro: new Error('recusado\nsegredo-fixture'), segredos: ['segredo-fixture'] });
  const linha = fs.readFileSync(arquivo, 'utf8');
  assert.match(linha, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z resultado=erro etapa=confirmação do envio mensagem=recusado \[oculto\]\n$/);
  assert.doesNotMatch(linha, /segredo-fixture/);
});

test('envio sem a N3: passa com as outras três, avisa e reenvia só agosto da N3 pelo espelho', () => {
  const destino = path.join(base, 'espelho-n3');
  criar('espelho-n3/N3', ['DFC AGOSTO2026.xlsx', 'DFC SETEMBRO2026.xlsx']);
  const espelho = listarEspelho(destino);
  assert.deepEqual(espelho, ['N3__DFC AGOSTO2026.xlsx', 'N3__DFC SETEMBRO2026.xlsx']);
  const nomes = ['3N__DFC SETEMBRO 2026.xlsx', 'B3N__09 - DFC - SETEMBRO2026.xlsx', 'B3W__09 - DFC SETEMBRO 2026.xlsx'];
  const plano = planejarEnvio({ nomes, espelho });
  assert.deepEqual(plano.faltam, []);
  assert.deepEqual(plano.porUnidade, { '3N': 1, B3N: 1, B3W: 1, N3: 0 });
  assert.deepEqual(plano.doEspelho, ['N3__DFC AGOSTO2026.xlsx']);
  assert.equal(plano.avisos.length, 1);
  assert.match(plano.avisos[0], /^N3: sem planilha/);
  // Sem espelho, o envio passa do mesmo jeito, só com o aviso.
  assert.deepEqual(planejarEnvio({ nomes }).faltam, []);
  assert.deepEqual(planejarEnvio({ nomes }).doEspelho, []);
});

test('envio com a N3 na pasta não usa o espelho; unidade em vigor ausente ainda barra', () => {
  const nomes = ['3N__DFC AGOSTO 2026.xlsx', 'B3N__08 - DFC - AGOSTO2026.xlsx', 'B3W__08 - DFC AGOSTO 2026.xlsx', 'N3__DFC AGOSTO2026.xlsx'];
  const plano = planejarEnvio({ nomes, espelho: ['N3__DFC AGOSTO2026.xlsx'] });
  assert.deepEqual([plano.faltam, plano.avisos, plano.doEspelho], [[], [], []]);
  assert.deepEqual(planejarEnvio({ nomes: nomes.filter((n) => !n.startsWith('B3N__')) }).faltam, ['B3N']);
});
