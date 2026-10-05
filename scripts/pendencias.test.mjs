import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publicarPendencia, listarPendencias, responderPendencia, respostasDesde, obterAnexo, marcarRecebida } from '../lib/pendencias.mjs';
import { GET as listarNaPonte } from '../app/api/pendencias/ponte/listar/route.js';

const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'meubess-pendencias-'));
process.env.MEUBESS_DADOS_DIR = dados;
test.after(() => fs.rmSync(dados, { recursive: true, force: true }));

test('publicar, atualizar, responder, baixar e confirmar no volume', async () => {
  const entrada = { id: 'caso-1', titulo: 'Enviar comprovante', pedido: 'Enviar o comprovante', motivo: 'Conferir o registro', status: 'aberta' };
  await publicarPendencia(entrada);
  await publicarPendencia({ ...entrada, titulo: 'Comprovante atualizado' });
  assert.equal(listarPendencias().length, 1);
  assert.equal(listarPendencias()[0].titulo, 'Comprovante atualizado');
  const anexo = new File(['conteúdo de teste'], '../arquivo.txt', { type: 'text/plain' });
  const r = await responderPendencia({ pendenciaId: entrada.id, resposta: 'Segue o arquivo.', anexos: [anexo], email: 'teste@exemplo.com' });
  assert.equal(r.marcador, 1);
  assert.equal(respostasDesde(0).respostas[0].por, 'teste@exemplo.com');
  assert.equal(respostasDesde(1).respostas.length, 0);
  assert.equal(obterAnexo(r.anexos[0].id).conteudo.toString(), 'conteúdo de teste');
  assert.equal(r.anexos[0].nome, 'arquivo.txt');
  assert.ok(fs.existsSync(path.join(dados, 'pendencias', 'pendencias.json')));
  const recibo = await marcarRecebida(r.id);
  assert.ok(recibo.recebidoEm);
  assert.equal((await marcarRecebida(r.id)).recebidoEm, recibo.recebidoEm);
  assert.equal(respostasDesde(0).respostas[0].recebidoEm, recibo.recebidoEm);
});

test('recusa caminho, tipo, tamanho, excesso de anexos e pendência encerrada', async () => {
  const base = { pendenciaId: 'caso-1', resposta: 'Texto', email: 'teste@exemplo.com' };
  await assert.rejects(() => responderPendencia({ ...base, anexos: [new File(['x'], '../segredo.exe')] }), /tipo/);
  await assert.rejects(() => responderPendencia({ ...base, anexos: Array.from({ length: 6 }, () => new File(['x'], 'a.txt')) }), /5 anexos/);
  await assert.rejects(() => responderPendencia({ ...base, anexos: [new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'a.txt')] }), /grande/);
  await publicarPendencia({ id: 'caso-1', titulo: 'Encerrada', pedido: 'Pedido', motivo: 'Motivo', status: 'encerrada' });
  await assert.rejects(() => responderPendencia({ ...base, anexos: [] }), /não está aberta/);
});

test('GET da ponte exige Bearer e lista apenas o estado das pendências', async () => {
  const segredoAnterior = process.env.PENDENCIAS_PONTE_SEGREDO;
  process.env.PENDENCIAS_PONTE_SEGREDO = 'segredo-de-teste';
  try {
    const semToken = await listarNaPonte(new Request('http://localhost/api/pendencias/ponte/listar'));
    assert.equal(semToken.status, 401);
    const comToken = await listarNaPonte(new Request('http://localhost/api/pendencias/ponte/listar', {
      headers: { Authorization: 'Bearer segredo-de-teste' },
    }));
    assert.equal(comToken.status, 200);
    assert.deepEqual(await comToken.json(), { ok: true, pendencias: [{
      id: 'caso-1', titulo: 'Encerrada', status: 'encerrada', pedido: 'Pedido', motivo: 'Motivo',
    }] });
  } finally {
    if (segredoAnterior === undefined) delete process.env.PENDENCIAS_PONTE_SEGREDO;
    else process.env.PENDENCIAS_PONTE_SEGREDO = segredoAnterior;
  }
});
