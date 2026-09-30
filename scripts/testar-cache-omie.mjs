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
