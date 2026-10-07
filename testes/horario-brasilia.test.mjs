import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoDuranteReleitura, diaEmBrasilia, quandoEmBrasilia } from '../app/horario-brasilia.mjs';

test('instantes UTC são apresentados no horário de Brasília', () => {
  assert.equal(quandoEmBrasilia('2026-10-07T13:25:00Z'), '07/10, 10:25');
  assert.equal(quandoEmBrasilia('2026-10-07T12:30:00Z'), '07/10, 09:30');
  assert.equal(diaEmBrasilia('2026-10-08T01:30:00Z'), '07/10/2026');
  assert.equal(quandoEmBrasilia(null), '—');
});

test('aviso curto aparece somente durante a releitura', () => {
  assert.equal(
    avisoDuranteReleitura({ estado: 'em curso', comecouEm: '2026-10-07T13:25:00Z' }),
    'Atualizando dados do Omie… os números podem mudar em instantes.',
  );
  for (const estado of ['ok', 'parcial', 'falhou', 'nunca']) {
    assert.equal(avisoDuranteReleitura({ estado }), null);
  }
});
