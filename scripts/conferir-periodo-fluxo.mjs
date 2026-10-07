// Confere o recorte da Tela 3 com o espelho local do DFC. Os valores só saem no terminal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularFluxoDeCaixa } from '../lib/indicadores/fluxo-de-caixa.mjs';
import { novaBase } from '../lib/regras/base-local.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copia = path.join(raiz, '.cache', 'dfc-2026');
assert.ok(fs.existsSync(copia), 'O espelho local .cache/dfc-2026 é necessário');
process.env.DFC_DIR = copia;
const ano = 2026, fonte = fonteDoDfc(), base = novaBase({ raiz, ano, fonte });
const calcular = (meses, unidade = null) => calcularFluxoDeCaixa({ raiz, ano, mes: meses.at(-1), fonte, base,
  filtro: { omie: ['0'], mesesDoDia: meses, unidade } });
const agosto = await calcular([8]), setembro = await calcular([9]), ambos = await calcular([8, 9]);
const valor = (d, id) => d.cartoes.find((c) => c.id === id).valor;
assert.ok(agosto.dfc.ok && setembro.dfc.ok, 'Falta o DFC de agosto ou setembro');
for (const id of ['entrou', 'saiu', 'resultado', 'fixas']) {
  assert.equal(Math.round(valor(ambos, id)), Math.round(valor(agosto, id) + valor(setembro, id)), id);
}
for (const id of ['entrou', 'saiu']) {
  assert.notEqual(valor(ambos, id), valor(agosto, id), `${id} não mudou`);
  assert.notEqual(valor(ambos, id), valor(setembro, id), `${id} não mudou`);
  assert.equal(valor(ambos, id), ambos.periodo[id], `${id} diverge do gráfico diário`);
}
if (setembro.dfc.aviso?.includes('N3')) {
  assert.match(ambos.dfc.aviso, /N3/);
  const n3 = await calcular([8, 9], 'N3');
  assert.equal(n3.dfc.ok, false);
  assert.match(n3.dfc.aviso, /N3/);
  assert.equal(valor(n3, 'entrou'), null);
  assert.equal(valor(n3, 'saiu'), null);
}

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
for (const [rotulo, d] of [['agosto', agosto], ['setembro', setembro], ['agosto + setembro', ambos]]) {
  console.log(`${rotulo}: Entrou ${reais.format(valor(d, 'entrou') / 100)}; Saiu ${reais.format(valor(d, 'saiu') / 100)}`);
}
console.log('Período = soma dos meses; totais mudam; aviso de unidade preservado.');
