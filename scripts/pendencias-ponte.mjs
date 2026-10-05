#!/usr/bin/env node
// O LADO DO PC DA PONTE DAS PENDÊNCIAS — publica no portal as perguntas à equipe financeira e traz as respostas.
// O contrato das rotas está em `docs/ponte-pendencias.md`.
//
//   node scripts/pendencias-ponte.mjs estado                         # a ponte responde? (404 / 401 / ok)
//   node scripts/pendencias-ponte.mjs publicar docs/pendencias/x.json  # cria ou atualiza pelo `id` do JSON
//   node scripts/pendencias-ponte.mjs publicar --id x --titulo "..." --pedido "..." --motivo "..." [--status aberta]
//   node scripts/pendencias-ponte.mjs buscar                          # traz as respostas novas e marca as recebidas
//
// O ENDEREÇO vem de `MEUBESS_SERVIDOR_URL` e o segredo de `PENDENCIAS_PONTE_SEGREDO` — do ambiente ou do `.env` da
// raiz. O segredo vai só no cabeçalho e nunca é impresso. O endereço tem de ser https (http só para 127.0.0.1 e
// localhost). As respostas e os anexos vão para `PENDENCIAS_PASTA` ou, sem ela, `.cache/pendencias-recebidas`
// (fora do git): podem trazer valores em reais, por isso o terminal mostra só contagens e caminhos.
// Não está agendado. Termina com 0 quando deu certo e ≠ 0 em qualquer falha.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIOR = String(Number.MAX_SAFE_INTEGER);

export class FalhaDaPonte extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}
const falha = (msg, codigo = 1) => { throw new FalhaDaPonte(msg, codigo); };

// Lê o ambiente (e o `.env`, se faltar algo). Não exige o segredo: o `estado` funciona sem ele, para separar 404 de 401.
export function configDoAmbiente(env = process.env) {
  if (!env.MEUBESS_SERVIDOR_URL || !env.PENDENCIAS_PONTE_SEGREDO) {
    try { process.loadEnvFile(path.join(RAIZ, '.env')); } catch { /* sem .env: a checagem diz o que falta */ }
  }
  return {
    url: env.MEUBESS_SERVIDOR_URL,
    segredo: env.PENDENCIAS_PONTE_SEGREDO || null,
    pasta: env.PENDENCIAS_PASTA || path.join(RAIZ, '.cache', 'pendencias-recebidas'),
  };
}

function baseDe(url) {
  if (!url) falha('MEUBESS_SERVIDOR_URL precisa estar no ambiente ou no .env');
  let u;
  try { u = new URL(url); } catch { falha('MEUBESS_SERVIDOR_URL não é um endereço'); }
  const local = ['127.0.0.1', 'localhost'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) falha('o endereço do servidor precisa ser https');
  return u;
}

// Um pedido à ponte. `semSegredo` só para o `estado` sondar quando o segredo falta deste lado.
async function pedir(cfg, metodo, caminho, { corpo, bruto = false } = {}) {
  const url = new URL(caminho, baseDe(cfg.url));
  const f = cfg.fetch ?? fetch;
  let r;
  try {
    r = await f(url, {
      method: metodo,
      headers: {
        ...(cfg.segredo ? { Authorization: `Bearer ${cfg.segredo}` } : {}),
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(60 * 1000),
    });
  } catch (e) {
    falha(`o servidor não respondeu (${e.message})`, 3);
  }
  if (bruto && r.ok) return { status: r.status, ok: true, bytes: Buffer.from(await r.arrayBuffer()) };
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j, ok: r.ok && j.ok !== false };
}

function recusa(r, oque) {
  if (r.status === 404) falha(`${oque}: 404 — o portal publicado ainda não tem a ponte das pendências`, 5);
  if (r.status === 401) falha(`${oque}: 401 — segredo ausente ou diferente (PENDENCIAS_PONTE_SEGREDO nos dois lados)`, 6);
  falha(`${oque}: o servidor recusou (${r.status}${r.erro ? `: ${r.erro}` : ''})`, 4);
}
const exigirSegredo = (cfg) => { if (!cfg.segredo) falha('PENDENCIAS_PONTE_SEGREDO precisa estar no ambiente ou no .env', 6); };

// ---------------------------------------------------------------- estado

export async function estado(cfg) {
  const r = await pedir(cfg, 'GET', `/api/pendencias/ponte?desde=${MAIOR}`);
  if (r.ok) return { situacao: 'responde', status: r.status, marcador: r.marcador };
  if (r.status === 404) return { situacao: '404', status: 404, texto: 'o portal publicado ainda não tem a ponte das pendências' };
  if (r.status === 401) {
    return { situacao: '401', status: 401, texto: cfg.segredo
      ? 'a ponte existe, mas o segredo deste PC é diferente do segredo do portal'
      : 'a ponte existe, mas este PC não tem PENDENCIAS_PONTE_SEGREDO (ou o portal também não tem)' };
  }
  return { situacao: 'erro', status: r.status, texto: r.erro ?? 'resposta inesperada' };
}

// ---------------------------------------------------------------- publicar

export function lerPendencia(args) {
  const i = (nome) => { const k = args.indexOf(`--${nome}`); return k >= 0 ? args[k + 1] : undefined; };
  const arquivo = args.find((a, k) => !a.startsWith('--') && !args[k - 1]?.startsWith('--'));
  const base = arquivo ? JSON.parse(fs.readFileSync(path.resolve(RAIZ, arquivo), 'utf8')) : {};
  const p = {
    id: i('id') ?? base.id, titulo: i('titulo') ?? base.titulo, pedido: i('pedido') ?? base.pedido,
    motivo: i('motivo') ?? base.motivo, status: i('status') ?? base.status ?? 'aberta',
  };
  for (const c of ['id', 'titulo', 'pedido', 'motivo']) if (!p[c]) falha(`a pendência precisa de ${c}`);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(p.id)) falha('id inválido: letras, números, . _ : -, até 100');
  if (!['aberta', 'encerrada'].includes(p.status)) falha('status precisa ser aberta ou encerrada');
  return p;
}

export async function publicar(cfg, pendencia) {
  exigirSegredo(cfg);
  const r = await pedir(cfg, 'PUT', '/api/pendencias/ponte', { corpo: pendencia });
  if (!r.ok) recusa(r, 'não publiquei');
  return r.pendencia;
}

// ---------------------------------------------------------------- buscar

const seguro = (s) => String(s ?? '').replaceAll('\\', '/').split('/').pop().normalize('NFKC')
  .replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'sem-nome';

function lerMarcador(pasta) {
  try { return Number(JSON.parse(fs.readFileSync(path.join(pasta, 'marcador.json'), 'utf8')).marcador) || 0; } catch { return 0; }
}
function gravarMarcador(pasta, marcador) {
  const f = path.join(pasta, 'marcador.json');
  fs.writeFileSync(`${f}.tmp`, JSON.stringify({ marcador, em: new Date().toISOString() }));
  fs.renameSync(`${f}.tmp`, f);
}

// Salva cada resposta (texto + anexos), marca como recebida e só então avança o marcador — uma por vez, na ordem do
// marcador. Se algo falhar no meio, a próxima busca recomeça da primeira não guardada; repetir é seguro.
export async function buscar(cfg) {
  exigirSegredo(cfg);
  fs.mkdirSync(cfg.pasta, { recursive: true });
  const desde = lerMarcador(cfg.pasta);
  const r = await pedir(cfg, 'GET', `/api/pendencias/ponte?desde=${desde}`);
  if (!r.ok) recusa(r, 'não busquei');
  const respostas = [...(r.respostas ?? [])].sort((a, b) => a.marcador - b.marcador);
  let anexos = 0;
  for (const resp of respostas) {
    const dir = path.join(cfg.pasta, seguro(resp.pendenciaId), seguro(resp.id));
    fs.mkdirSync(dir, { recursive: true });
    for (const a of resp.anexos ?? []) {
      const b = await pedir(cfg, 'GET', `/api/pendencias/ponte/anexos/${encodeURIComponent(a.id)}`, { bruto: true });
      if (!b.ok) recusa(b, `não baixei um anexo da resposta ${resp.id}`);
      fs.writeFileSync(path.join(dir, `${seguro(a.id)}_${seguro(a.nome)}`), b.bytes);
      anexos += 1;
    }
    const cabeca = [`pendência: ${resp.pendenciaId}`, `resposta: ${resp.id}`, `por: ${resp.por ?? ''}`, `em: ${resp.em ?? ''}`,
      `anexos: ${(resp.anexos ?? []).map((a) => a.nome).join(', ') || 'nenhum'}`];
    fs.writeFileSync(path.join(dir, 'resposta.txt'), `${cabeca.join('\n')}\n\n${resp.texto ?? ''}\n`);
    const m = await pedir(cfg, 'POST', '/api/pendencias/ponte/recebidas', { corpo: { id: resp.id } });
    if (!m.ok) recusa(m, `salvei a resposta ${resp.id}, mas não consegui marcá-la como recebida`);
    gravarMarcador(cfg.pasta, resp.marcador);
  }
  return { respostas: respostas.length, anexos, marcador: lerMarcador(cfg.pasta), pasta: cfg.pasta };
}

// ---------------------------------------------------------------- linha de comando

async function principal(argv) {
  const [comando, ...args] = argv;
  const cfg = configDoAmbiente();
  if (comando === 'estado') {
    const e = await estado(cfg);
    const servidor = baseDe(cfg.url).host;
    if (e.situacao === 'responde') { console.log(`ponte responde em ${servidor} (marcador ${e.marcador}).`); return 0; }
    console.log(`ponte não responde em ${servidor}: ${e.status} — ${e.texto}.`);
    return e.situacao === '404' ? 5 : e.situacao === '401' ? 6 : 4;
  }
  if (comando === 'publicar') {
    const p = await publicar(cfg, lerPendencia(args));
    console.log(`pendência publicada: id ${p.id}, status ${p.status}, atualizada em ${p.atualizadaEm}.`);
    return 0;
  }
  if (comando === 'buscar') {
    const b = await buscar(cfg);
    console.log(`${b.respostas} resposta(s) nova(s), ${b.anexos} anexo(s), salvas em ${b.pasta}; marcador ${b.marcador}.`);
    return 0;
  }
  console.error('uso: node scripts/pendencias-ponte.mjs estado | publicar <arquivo.json> [--id --titulo --pedido --motivo --status] | buscar');
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.error(`falhou: ${e.message}`);
    process.exit(e instanceof FalhaDaPonte ? e.codigo : 1);
  });
}
