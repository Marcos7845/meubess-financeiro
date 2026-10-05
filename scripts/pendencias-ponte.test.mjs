import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estado, publicar, buscar, lerPendencia, FalhaDaPonte } from './pendencias-ponte.mjs';

// Servidor falso da ponte, em memória: o `fetch` é trocado por esta função, então nada sai pela rede. Segue o contrato
// de `docs/ponte-pendencias.md`.
function servidorFalso({ segredo = 'segredo-de-teste', semPonte = false, falharRecebida = null } = {}) {
  const s = { pendencias: new Map(), respostas: [], anexos: new Map(), recebidas: [], pedidos: [] };
  s.fetch = async (url, opcoes = {}) => {
    const u = new URL(url);
    const auth = opcoes.headers?.Authorization;
    s.pedidos.push({ metodo: opcoes.method, caminho: u.pathname + u.search, auth });
    const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
    if (semPonte || !u.pathname.startsWith('/api/pendencias/ponte')) return new Response('não achei', { status: 404 });
    if (auth !== `Bearer ${segredo}`) return json({ ok: false, erro: 'segredo ausente ou errado' }, 401);
    if (u.pathname === '/api/pendencias/ponte' && opcoes.method === 'PUT') {
      const p = JSON.parse(opcoes.body);
      const atual = s.pendencias.get(p.id);
      const nova = { ...p, criadaEm: atual?.criadaEm ?? 'c', atualizadaEm: new Date().toISOString() };
      s.pendencias.set(p.id, nova);
      return json({ ok: true, pendencia: nova });
    }
    if (u.pathname === '/api/pendencias/ponte' && opcoes.method === 'GET') {
      const desde = Number(u.searchParams.get('desde'));
      const marcador = s.respostas.reduce((m, r) => Math.max(m, r.marcador), 0);
      return json({ ok: true, marcador, respostas: s.respostas.filter((r) => r.marcador > desde) });
    }
    const anexo = /^\/api\/pendencias\/ponte\/anexos\/(.+)$/.exec(u.pathname);
    if (anexo) {
      const b = s.anexos.get(decodeURIComponent(anexo[1]));
      return b ? new Response(b, { status: 200 }) : json({ ok: false, erro: 'anexo não encontrado' }, 404);
    }
    if (u.pathname === '/api/pendencias/ponte/recebidas' && opcoes.method === 'POST') {
      const { id } = JSON.parse(opcoes.body);
      if (id === falharRecebida) return json({ ok: false, erro: 'falha simulada' }, 500);
      s.recebidas.push(id);
      return json({ ok: true, resposta: { id, recebidoEm: 'agora' } });
    }
    return json({ ok: false, erro: 'rota desconhecida' }, 404);
  };
  return s;
}

const temporarias = [];
const pastaTemp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'meubess-ponte-')); temporarias.push(d); return d; };
test.after(() => { for (const d of temporarias) fs.rmSync(d, { recursive: true, force: true }); });
const cfgDe = (s, extra = {}) => ({ url: 'https://portal.exemplo.test', segredo: 'segredo-de-teste', pasta: pastaTemp(), fetch: s.fetch, ...extra });
const pendencia = { id: 'caso-ponte', titulo: 'Conferir extrato', pedido: 'Confirme as entradas.', motivo: 'Fechar o mês.', status: 'aberta' };

test('estado: responde, 404 sem ponte, 401 sem segredo e 401 com segredo diferente', async () => {
  assert.equal((await estado(cfgDe(servidorFalso()))).situacao, 'responde');
  assert.equal((await estado(cfgDe(servidorFalso({ semPonte: true })))).situacao, '404');
  const sem = await estado(cfgDe(servidorFalso(), { segredo: null }));
  assert.equal(sem.situacao, '401');
  assert.match(sem.texto, /não tem PENDENCIAS_PONTE_SEGREDO/);
  const errado = await estado(cfgDe(servidorFalso(), { segredo: 'outro' }));
  assert.equal(errado.situacao, '401');
  assert.match(errado.texto, /diferente/);
});

test('o segredo vai só no cabeçalho, e o endereço tem de ser https', async () => {
  const s = servidorFalso();
  await estado(cfgDe(s));
  assert.ok(s.pedidos.every((p) => !p.caminho.includes('segredo-de-teste')));
  await assert.rejects(() => estado(cfgDe(s, { url: 'http://portal.exemplo.test' })), /https/);
  assert.equal((await estado(cfgDe(s, { url: 'http://127.0.0.1:4781' }))).situacao, 'responde');
});

test('publicar cria e atualiza pelo mesmo id; recusa 404 e 401 com o código certo', async () => {
  const s = servidorFalso();
  const cfg = cfgDe(s);
  await publicar(cfg, pendencia);
  const p = await publicar(cfg, { ...pendencia, titulo: 'Conferir extrato de agosto' });
  assert.equal(p.id, 'caso-ponte');
  assert.equal(s.pendencias.size, 1);
  assert.equal(s.pendencias.get('caso-ponte').titulo, 'Conferir extrato de agosto');
  await assert.rejects(() => publicar(cfgDe(servidorFalso({ semPonte: true })), pendencia), (e) => e instanceof FalhaDaPonte && e.codigo === 5);
  await assert.rejects(() => publicar(cfgDe(s, { segredo: 'outro' }), pendencia), (e) => e.codigo === 6);
  await assert.rejects(() => publicar(cfgDe(s, { segredo: null }), pendencia), (e) => e.codigo === 6);
});

test('lerPendencia: do JSON versionado e dos argumentos, que valem por cima', () => {
  const j = lerPendencia(['docs/pendencias/stone-agosto-2026.json']);
  assert.equal(j.id, 'stone-agosto-2026-seis-entradas');
  assert.equal(j.status, 'aberta');
  assert.doesNotMatch(`${j.titulo} ${j.pedido} ${j.motivo}`, /R\$|\d+,\d{2}\b|EXTR|nCodCC|cOrigem|DFC|trava/);
  const a = lerPendencia(['--id', 'x-1', '--titulo', 'T', '--pedido', 'P', '--motivo', 'M']);
  assert.deepEqual(a, { id: 'x-1', titulo: 'T', pedido: 'P', motivo: 'M', status: 'aberta' });
  assert.equal(lerPendencia(['docs/pendencias/stone-agosto-2026.json', '--status', 'encerrada']).status, 'encerrada');
  assert.throws(() => lerPendencia(['--id', '../x', '--titulo', 'T', '--pedido', 'P', '--motivo', 'M']), /id inválido/);
  assert.throws(() => lerPendencia(['--id', 'x']), /titulo/);
});

test('buscar: salva texto e anexos, marca recebidas e guarda o marcador; repetir não traz de novo', async () => {
  const s = servidorFalso();
  s.respostas.push(
    { id: 'r-2', pendenciaId: 'caso-ponte', texto: 'Segue o extrato.', por: 'a@exemplo.com', em: '2026-10-05T12:00:00Z', marcador: 2, anexos: [{ id: 'an-1', nome: '../extrato.pdf', tamanho: 3 }] },
    { id: 'r-1', pendenciaId: 'caso-ponte', texto: 'Vou olhar.', por: 'a@exemplo.com', em: '2026-10-05T11:00:00Z', marcador: 1, anexos: [] },
  );
  s.anexos.set('an-1', Buffer.from('pdf'));
  const cfg = cfgDe(s);
  const b = await buscar(cfg);
  assert.deepEqual([b.respostas, b.anexos, b.marcador], [2, 1, 2]);
  assert.deepEqual(s.recebidas, ['r-1', 'r-2']);
  const dir = path.join(cfg.pasta, 'caso-ponte', 'r-2');
  assert.match(fs.readFileSync(path.join(dir, 'resposta.txt'), 'utf8'), /Segue o extrato\./);
  assert.equal(fs.readFileSync(path.join(dir, 'an-1_extrato.pdf'), 'utf8'), 'pdf');
  assert.ok(!fs.existsSync(path.join(cfg.pasta, '..', 'extrato.pdf')));
  const de = await buscar(cfg);
  assert.equal(de.respostas, 0);
  assert.ok(s.pedidos.at(-1).caminho.endsWith('desde=2'));
});

test('buscar: se não consegue marcar uma recebida, o marcador para antes dela e a próxima busca a refaz', async () => {
  const s = servidorFalso({ falharRecebida: 'r-2' });
  s.respostas.push(
    { id: 'r-1', pendenciaId: 'p', texto: 'um', marcador: 1, anexos: [] },
    { id: 'r-2', pendenciaId: 'p', texto: 'dois', marcador: 2, anexos: [] },
  );
  const cfg = cfgDe(s);
  await assert.rejects(() => buscar(cfg), (e) => e.codigo === 4);
  assert.equal(JSON.parse(fs.readFileSync(path.join(cfg.pasta, 'marcador.json'), 'utf8')).marcador, 1);
  const ok = servidorFalso();
  ok.respostas.push(...s.respostas);
  const b = await buscar({ ...cfg, fetch: ok.fetch });
  assert.equal(b.respostas, 1);
  assert.deepEqual(ok.recebidas, ['r-2']);
});
