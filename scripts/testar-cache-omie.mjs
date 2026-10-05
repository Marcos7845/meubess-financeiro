import test from 'node:test';
import assert from 'node:assert/strict';
import { precisaReleitura } from '../lib/regras/omie-releitura.mjs';

const hora = 60 * 60 * 1000;
const agora = Date.parse('2026-09-30T15:00:00Z');
const em = (idade) => new Date(agora - idade).toISOString();

test('cache completo é relido após uma hora, inclusive na leitura seguinte', () => {
  const recente = { estado: 'ok', okEm: em(hora - 1), tentadaEm: em(hora - 1) };
  const vencido = { ...recente, okEm: em(hora + 1), tentadaEm: em(hora + 1) };
  assert.equal(precisaReleitura(recente, agora), false);
  assert.equal(precisaReleitura(vencido, agora), true);
  assert.equal(precisaReleitura(recente, agora, true), true);
  assert.equal(precisaReleitura(null, agora), true);
  assert.equal(precisaReleitura({ estado: 'ok', okEm: 'inválido', tentadaEm: 'inválido' }, agora), true);
});

test('volta parcial não faz o cache inteiro parecer novo e respeita pausa entre tentativas', () => {
  const parcial = { estado: 'parcial', okEm: em(60_000), completaEm: em(2 * hora), tentadaEm: em(14 * 60_000) };
  assert.equal(precisaReleitura(parcial, agora), false);
  assert.equal(precisaReleitura({ ...parcial, tentadaEm: em(15 * 60_000) }, agora), true);
  assert.equal(precisaReleitura({ ...parcial, completaEm: em(30 * 60_000), tentadaEm: em(20 * 60_000) }, agora), false);
});

test('a leitura de caixa vai de 01/01 a 31/12 e o cache corta o pagamento depois de hoje', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { abrirCacheOmie, arqCacheOmie, leiturasDe } = await import('../lib/regras/cache-omie.mjs');
  const L = leiturasDe(2026);
  assert.equal(L.MF(1).dDtPagtoAte, '31/12/2026');
  assert.equal(L.MF_DEP(1).dDtPagtoAte, '31/12/2026');

  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-omie-'));
  const antes = process.env.OMIE_CACHE_DIR;
  process.env.OMIE_CACHE_DIR = pasta;
  try {
    const mov = (n, data) => ({ detalhes: { nCodMovCC: n, dDtPagamento: data }, resumo: {} });
    const lista = [mov(1, '30/09/2026'), mov(2, '05/10/2026'), mov(3, '06/10/2026'), mov(4, undefined)];
    for (const emp of ['1', '2']) {
      for (const p of [L.MF, L.MF_DEP])
        fs.writeFileSync(arqCacheOmie(pasta, emp, 'financas/mf', 'ListarMovimentos', p(1)), JSON.stringify({ nTotPaginas: 1, movimentos: lista }));
    }
    const O = abrirCacheOmie({ raiz: pasta, ano: 2026, hoje: '05/10/2026' });
    assert.deepEqual(O.movimentos['1'].map((m) => m.detalhes.nCodMovCC), [1, 2, 4]);
    assert.deepEqual(O.comDep['2'].map((m) => m.detalhes.nCodMovCC), [1, 2, 4]);
    assert.throws(() => abrirCacheOmie({ raiz: pasta, ano: 2026, hoje: '2026-10-05' }), /dd\/mm\/aaaa/);
  } finally {
    if (antes === undefined) delete process.env.OMIE_CACHE_DIR; else process.env.OMIE_CACHE_DIR = antes;
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
