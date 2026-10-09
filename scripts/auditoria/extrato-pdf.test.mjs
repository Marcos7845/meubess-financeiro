// Conversor de extrato em PDF (extrato-pdf.py), modelos safra e sicoob, sobre os PDFs reais de agosto/2026 da cópia
// local da master em .cache/ (fora do git). Sem a cópia, o teste é pulado. Nenhum valor em reais aqui: só contagens,
// datas e a cadeia de saldos refeita linha a linha.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pasta = path.join(raiz, '.cache', 'master-2026-08', 'B3W', 'FINANCEIRO', '1. EXTRATOS B3W', '2026', '08 - AGOSTO');
const python = process.platform === 'win32' ? 'python' : 'python3';

function converter(modelo, conta, pdf) {
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'extrato-pdf-'));
  const r = spawnSync(python, [path.join(raiz, 'scripts', 'auditoria', 'extrato-pdf.py'), '--modelo', modelo, '--mes', '2026-08',
    '--conta', conta, '--pdf', path.join(pasta, pdf), '--saida', saida], { encoding: 'utf8' });
  const base = path.join(saida, `2026-08__${conta}`);
  const gravou = fs.existsSync(`${base}.csv`);
  const linhas = gravou ? fs.readFileSync(`${base}.csv`, 'utf8').trim().split('\n').slice(1).map((s) => {
    const [data, valor, saldo, id, historico] = s.split(';');
    return { data, valor: Math.round(Number(valor) * 100), saldo: Math.round(Number(saldo) * 100), id, historico };
  }) : [];
  const prova = gravou ? JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) : null;
  fs.rmSync(saida, { recursive: true, force: true });
  return { status: r.status, linhas, prova };
}

const cadeiaFecha = (ls) => ls.every((l, i) => i === 0 || ls[i - 1].saldo + l.valor === l.saldo);

test('Safra (3N), agosto/2026: 26 lançamentos, 16 saldos do dia conferidos, mês inteiro', { skip: !fs.existsSync(path.join(pasta, 'SAFRA - 08 AGOS.pdf')) }, () => {
  const { status, linhas, prova } = converter('safra', 'BANCO SAFRA--1', 'SAFRA - 08 AGOS.pdf');
  assert.equal(status, 0);
  assert.equal(prova.transacoes, 26);
  assert.equal(prova.saldosConferidos, 16);
  assert.deepEqual(prova.periodoDoPdf, ['2026-08-03', '2026-08-31']);
  // O extrato começa em 03/08 (segunda-feira); 01 e 02/08 são fim de semana: cobre o mês.
  assert.equal(prova.inicioNoFimDeSemana, true);
  assert.equal(prova.cobreMesInteiro, true);
  assert.ok(cadeiaFecha(linhas));
  assert.ok(linhas.every((l) => l.data.startsWith('2026-08-')));
  // Caso real: em 19/08 há cinco PIX recebidos de mesmo valor (os que provam as linhas 10, 11, 17, 18 e 19 do DFC da 3N).
  const pix19 = linhas.filter((l) => l.data === '2026-08-19' && l.historico.startsWith('PIX RECEBIDO'));
  assert.equal(pix19.length, 5);
  assert.equal(new Set(pix19.map((l) => l.valor)).size, 1);
});

test('Sicoob (B3N), agosto/2026: 52 lançamentos, 15 saldos do dia conferidos, saldo bloqueado fora', { skip: !fs.existsSync(path.join(pasta, 'EXTRATO SICOOB 08-2026.pdf')) }, () => {
  const { status, linhas, prova } = converter('sicoob', 'BANCO SICOOB--1', 'EXTRATO SICOOB 08-2026.pdf');
  assert.equal(status, 0);
  assert.equal(prova.transacoes, 52);
  assert.equal(prova.saldosConferidos, 15);
  assert.deepEqual(prova.periodoDoPdf, ['2026-08-01', '2026-08-31']);
  assert.deepEqual(prova.excluidos, { 'saldo bloqueado': 1 });
  assert.equal(prova.cobreMesInteiro, true);
  assert.ok(cadeiaFecha(linhas));
  assert.deepEqual(linhas.map((l) => l.data), [...linhas.map((l) => l.data)].sort());
  // Caso real: em 03/08, um PIX emitido e o estorno dele, de mesmo valor e sinais opostos.
  const estorno = linhas.find((l) => l.data === '2026-08-03' && /ESTORNO PIX/.test(l.historico));
  assert.ok(estorno && linhas.some((l) => l.data === '2026-08-03' && l.valor === -estorno.valor));
});

test('modelo errado não grava nada', { skip: !fs.existsSync(path.join(pasta, 'EXTRATO SICOOB 08-2026.pdf')) }, () => {
  const { status, linhas } = converter('safra', 'BANCO SICOOB--1', 'EXTRATO SICOOB 08-2026.pdf');
  assert.notEqual(status, 0);
  assert.equal(linhas.length, 0);
});
