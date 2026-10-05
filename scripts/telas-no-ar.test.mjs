// A LEITURA DAS TRÊS TELAS PELA PONTE — `GET /api/pendencias/ponte/telas` e `scripts/conferir-no-ar.mjs`, parte do
// `npm test`. Roda sobre as fixtures de `testes/fixtures/` (inventadas, sem dinheiro real): não lê `.env`, não abre
// `.cache/`, não chama a rede. O "cálculo local" é o mesmo `calcularTela1`, `calcularTela2` e `calcularFluxoDeCaixa`
// que `lib/dados.mjs` chama para as páginas, sobre uma base das fixtures.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'testes', 'fixtures');
process.env.OMIE_CACHE_DIR = path.join(FIXTURES, 'omie');
const SEGREDO = 'segredo-de-teste-das-telas';
process.env.PENDENCIAS_PONTE_SEGREDO = SEGREDO;

const { novaBase } = await import('../lib/regras/base-local.mjs');
const { calcularTela1 } = await import('../lib/indicadores/tela-1.mjs');
const { calcularTela2 } = await import('../lib/indicadores/tela-2.mjs');
const { calcularFluxoDeCaixa } = await import('../lib/indicadores/fluxo-de-caixa.mjs');
const { responderTelas } = await import('../lib/indicadores/telas-no-ar.mjs');
const { lerNoAr, lerConferidas, relatorio } = await import('./conferir-no-ar.mjs');

const PASTA_DFC = path.join(FIXTURES, 'dfc');
const fonte = {
  nome: 'fixture', disponivel: () => true, descrever: () => 'fixture',
  arquivos: async () => fs.readdirSync(PASTA_DFC),
  ler: async (nome) => fs.readFileSync(path.join(PASTA_DFC, nome)),
};

// As funções de `lib/dados.mjs`, trocadas pelo mesmo cálculo sobre as fixtures (sem o balde da hora). `pedidos`
// guarda o que cada tela recebeu, para conferir o mês padrão.
function dadosDasFixtures(corrente = { ano: 2026, mes: 8 }) {
  const pedidos = [];
  const comBase = (calcular, tela) => async ({ ano, mes, filtro }) => {
    pedidos.push({ tela, ano, mes, filtro });
    return calcular({ raiz: FIXTURES, ano, mes, fonte, filtro, base: novaBase({ raiz: FIXTURES, ano, fonte }) });
  };
  return {
    pedidos,
    tela1: comBase(calcularTela1, 'tela1'), tela2: comBase(calcularTela2, 'tela2'),
    fluxo: comBase(calcularFluxoDeCaixa, 'fluxo'), mesCorrente: () => corrente,
  };
}

const pedir = (consulta, auth) => new Request(`http://127.0.0.1/api/pendencias/ponte/telas${consulta}`,
  { headers: auth ? { Authorization: auth } : {} });

test('ponte/telas: sem token ou com token errado, 401 e nenhuma tela é calculada', async () => {
  const dados = dadosDasFixtures();
  for (const auth of [null, 'Bearer outro-segredo', SEGREDO]) {
    const r = await responderTelas(pedir('?ano=2026&mes=8', auth), dados);
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), { ok: false, erro: 'segredo ausente ou errado' });
  }
  assert.equal(dados.pedidos.length, 0);
});

test('ponte/telas: com token, o mês e cada cartão das três telas batem com o cálculo local', async () => {
  const r = await responderTelas(pedir('?ano=2026&mes=8', `Bearer ${SEGREDO}`), dadosDasFixtures());
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/json/);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.deepEqual({ ano: j.ano, mes: j.mes, mesPadrao: j.mesPadrao }, { ano: 2026, mes: 8, mesPadrao: false });
  assert.deepEqual(j.telas.map((t) => [t.tela, t.rota, t.ano, t.mes]),
    [['Tela 1', '/', 2026, 8], ['Tela 2', '/dre', 2026, 8], ['Tela 3', '/fluxo-de-caixa', 2026, 8]]);

  const base = () => novaBase({ raiz: FIXTURES, ano: 2026, fonte });
  const locais = [
    await calcularTela1({ raiz: FIXTURES, ano: 2026, mes: 8, fonte, base: base(), filtro: {} }),
    await calcularTela2({ raiz: FIXTURES, ano: 2026, mes: 8, fonte, base: base(), filtro: {} }),
    await calcularFluxoDeCaixa({ raiz: FIXTURES, ano: 2026, mes: 8, fonte, base: base(), filtro: {} }),
  ];
  locais.forEach((local, i) => {
    const t = j.telas[i];
    assert.deepEqual(t.cartoes.map((c) => c.id), local.cartoes.map((c) => c.id), `${t.tela}: os mesmos cartões`);
    for (const c of local.cartoes) {
      const n = t.cartoes.find((x) => x.id === c.id);
      assert.equal(n.valor, typeof c.valor === 'number' ? c.valor : null, `${t.tela} ${c.id}: valor`);
      assert.equal(n.fonte, c.fonte ?? null, `${t.tela} ${c.id}: fonte`);
      assert.deepEqual(n.contagem, { dfc: c.contagem?.dfc ?? null, omie: c.contagem?.omie ?? null }, `${t.tela} ${c.id}: contagem`);
    }
  });
  // A fixture tem valor nas três telas: o teste não passa comparando nulo com nulo.
  assert.ok(j.telas.every((t) => t.cartoes.some((c) => typeof c.valor === 'number' && c.valor !== 0)));
  const fontes = Object.fromEntries(j.telas.flatMap((t) => t.cartoes.map((c) => [`${t.tela}|${c.id}`, c.fontes])));
  assert.deepEqual(fontes['Tela 1|saldo'], ['DFC']);
  assert.deepEqual(fontes['Tela 1|despesas-pendentes'], ['Omie']);
  assert.deepEqual(fontes['Tela 3|resultado'], ['conta']);
});

test('ponte/telas: sem ?mes= abre no mês corrente, como as páginas; a Tela 2 não desce de abril', async () => {
  const dados = dadosDasFixtures({ ano: 2026, mes: 2 });
  const j = await (await responderTelas(pedir('', `Bearer ${SEGREDO}`), dados)).json();
  assert.deepEqual({ ano: j.ano, mes: j.mes, mesPadrao: j.mesPadrao }, { ano: 2026, mes: 2, mesPadrao: true });
  assert.deepEqual(dados.pedidos.map((p) => [p.tela, p.mes]), [['tela1', 2], ['tela2', 4], ['fluxo', 2]]);
  const ruim = await responderTelas(pedir('?ano=2026&mes=13', `Bearer ${SEGREDO}`), dados);
  assert.equal(ruim.status, 400);
});

test('ponte/telas: a unidade chega ao filtro das três telas', async () => {
  const dados = dadosDasFixtures();
  await responderTelas(pedir('?ano=2026&mes=8&unidade=B3W', `Bearer ${SEGREDO}`), dados);
  assert.deepEqual(dados.pedidos.map((p) => p.filtro.unidade), ['B3W', 'B3W', 'B3W']);
});

test('conferir-no-ar: chama a rota com o segredo, imprime mês e fonte e compara com o documento do mês', async () => {
  const dados = dadosDasFixtures();
  const chamadas = [];
  const cfg = {
    url: 'http://127.0.0.1:1', segredo: SEGREDO,
    fetch: async (url, opcoes) => { chamadas.push(String(url)); return responderTelas(new Request(url, opcoes), dados); },
  };
  const r = await lerNoAr(cfg, { ano: 2026, mes: 8 });
  assert.deepEqual(chamadas, ['http://127.0.0.1:1/api/pendencias/ponte/telas?ano=2026&mes=8']);

  const saldo = r.telas[0].cartoes.find((c) => c.id === 'saldo');
  const documento = '# As telas conferidas contra a conferência — agosto de 2026\n\n'
    + `- **Tela 1 — Saldo.** **Na tela:** DFC ${saldo.contagem.dfc} e Omie ${saldo.contagem.omie}. **Na conferência:** x.\n`
    + `- **Tela 1 — Receitas.** **Na tela:** DFC 999 e Omie 0. **Na conferência:** x.\n`;
  const conferidas = lerConferidas(documento);
  assert.deepEqual({ ano: conferidas.ano, mes: conferidas.mes, linhas: conferidas.linhas.size }, { ano: 2026, mes: 8, linhas: 2 });
  const { texto, divergentes } = relatorio(r, conferidas);
  assert.equal(divergentes, 1);
  assert.match(texto, /Tela 1 \(\/\) — mês exibido: agosto de 2026/);
  assert.match(texto, /Saldo: .+ \[DFC\] .+ conferido: bate/);
  assert.match(texto, /Receitas: .+ conferido: DIFERE \(documento: DFC 999, Omie 0\)/);
  assert.ok(!texto.includes(SEGREDO), 'o segredo nunca vai para a saída');

  // Outro mês, ou com unidade escolhida, não é comparado.
  assert.equal(relatorio({ ...r, telas: r.telas.map((t) => ({ ...t, mes: 9 })) }, conferidas).divergentes, 0);
  assert.equal(relatorio({ ...r, unidade: 'B3W' }, conferidas).divergentes, 0);

  await assert.rejects(lerNoAr({ ...cfg, segredo: 'errado' }, { ano: 2026, mes: 8 }), /401/);
});
