// O CADASTRO DE QUEM ENTRA NAS TELAS — e-mail, senha embaralhada, se é administrador e se está ativo.
//
// A SENHA NUNCA É GUARDADA: guarda-se o resultado do scrypt (N = 2^15, r = 8, p = 1, sal de 16 bytes aleatórios por
// pessoa), no formato `scrypt$N$r$p$sal$hash`. Conferir é refazer a conta com o mesmo sal e comparar em tempo
// constante. Nenhuma função daqui devolve o hash para fora: `listar()` devolve só o que a tela de administrador mostra.
//
// ONDE FICA: `usuarios.json` na pasta dos dados do servidor (`lib/acesso/armazenamento.mjs`) — o volume, no Railway.
// Um arquivo e não um banco porque são poucas pessoas e um processo só; a gravação é atômica (arquivo temporário +
// rename) e uma de cada vez, na fila de `mudar()`.
//
// O PRIMEIRO ADMINISTRADOR sai de `MEUBESS_ADMIN_EMAIL` + `MEUBESS_ADMIN_SENHA` (só enquanto o cadastro está vazio:
// com uma pessoa cadastrada as duas variáveis não fazem mais nada) ou de `npm run criar-admin`.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { pastaDosDados } from './armazenamento.mjs';

const scrypt = promisify(crypto.scrypt);
const N = 2 ** 15, R = 8, P = 1, TAMANHO = 64;
const MAXMEM = 128 * N * R * 2;
const SENHA_MINIMA = 10;

const arquivo = () => path.join(pastaDosDados(), 'usuarios.json');
const normalizar = (email) => String(email ?? '').trim().toLowerCase();
const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;

async function embaralhar(senha) {
  const sal = crypto.randomBytes(16);
  const h = await scrypt(String(senha), sal, TAMANHO, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${h.toString('base64')}`;
}

async function confere(senha, guardado) {
  const [tipo, n, r, p, sal, hash] = String(guardado ?? '').split('$');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const h = await scrypt(String(senha), Buffer.from(sal, 'base64'), esperado.length,
    { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2 });
  return crypto.timingSafeEqual(h, esperado);
}

// Um hash de verdade, feito uma vez, para que "e-mail sem cadastro" leve o mesmo tempo que "senha errada".
let hashDeMentira = null;
const falso = async () => (hashDeMentira ??= await embaralhar(crypto.randomBytes(18).toString('hex')));

// ---------------------------------------------------------------- leitura e gravação

// Relido só quando o arquivo muda (o proxy confere a sessão a cada pedido).
let lido = { mtime: -1, dados: null };
function ler() {
  let st = null;
  try { st = fs.statSync(arquivo()); } catch { return { usuarios: [] }; }
  if (st.mtimeMs !== lido.mtime) lido = { mtime: st.mtimeMs, dados: JSON.parse(fs.readFileSync(arquivo(), 'utf8')) };
  return lido.dados;
}

function gravar(dados) {
  fs.mkdirSync(path.dirname(arquivo()), { recursive: true });
  const temp = `${arquivo()}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(dados, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, arquivo());
  lido = { mtime: -1, dados: null };
}

let fila = Promise.resolve();
function mudar(fn) {
  const p = fila.then(async () => {
    const dados = structuredClone(ler());
    const r = await fn(dados);
    gravar(dados);
    return r;
  });
  fila = p.catch(() => {});
  return p;
}

const achar = (dados, email) => dados.usuarios.find((u) => u.email === normalizar(email));
const semSegredo = (u) => ({ email: u.email, admin: Boolean(u.admin), ativo: Boolean(u.ativo), criadoEm: u.criadoEm, senhaTrocadaEm: u.senhaTrocadaEm });

// ---------------------------------------------------------------- o que o resto do app usa

function listar() { return ler().usuarios.map(semSegredo); }
function buscar(email) { return achar(ler(), email) ?? null; }

function exigirSenha(senha) {
  if (String(senha ?? '').length < SENHA_MINIMA) throw new Error(`a senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
}

async function criar({ email, senha, admin = false }) {
  const e = normalizar(email);
  if (!emailValido(e)) throw new Error('e-mail inválido');
  exigirSenha(senha);
  const hash = await embaralhar(senha);
  return mudar((dados) => {
    if (achar(dados, e)) throw new Error('esse e-mail já tem cadastro');
    const agora = new Date().toISOString();
    dados.usuarios.push({ email: e, hash, admin: Boolean(admin), ativo: true, versaoSessao: 1, criadoEm: agora, senhaTrocadaEm: agora });
    return semSegredo(dados.usuarios.at(-1));
  });
}

const adminsAtivos = (dados) => dados.usuarios.filter((u) => u.admin && u.ativo).length;

async function mudarAtivo(email, ativo) {
  return mudar((dados) => {
    const u = achar(dados, email);
    if (!u) throw new Error('e-mail sem cadastro');
    if (!ativo && u.admin && u.ativo && adminsAtivos(dados) === 1) throw new Error('é o único administrador ativo');
    u.ativo = Boolean(ativo);
    u.versaoSessao += 1;   // desativar derruba a sessão aberta
    return semSegredo(u);
  });
}

async function trocarSenha(email, senha) {
  exigirSenha(senha);
  const hash = await embaralhar(senha);
  return mudar((dados) => {
    const u = achar(dados, email);
    if (!u) throw new Error('e-mail sem cadastro');
    u.hash = hash;
    u.senhaTrocadaEm = new Date().toISOString();
    u.versaoSessao += 1;   // trocar a senha derruba as sessões abertas com a antiga
    return semSegredo(u);
  });
}

// CONFERE E-MAIL E SENHA. Devolve a pessoa (sem o hash) ou null — sem dizer qual dos dois falhou.
async function autenticar(email, senha) {
  await garantirPrimeiroAdmin();
  const u = buscar(email);
  if (!u || !u.ativo) { await confere(senha, await falso()); return null; }
  return (await confere(senha, u.hash)) ? { ...semSegredo(u), versaoSessao: u.versaoSessao } : null;
}

// O PRIMEIRO ADMINISTRADOR pelas variáveis de ambiente — só com o cadastro vazio.
async function garantirPrimeiroAdmin() {
  if (ler().usuarios.length) return false;
  const email = process.env.MEUBESS_ADMIN_EMAIL, senha = process.env.MEUBESS_ADMIN_SENHA;
  if (!email || !senha) return false;
  try { await criar({ email, senha, admin: true }); return true; }
  catch { return false; }
}

export { listar, buscar, criar, mudarAtivo, trocarSenha, autenticar, garantirPrimeiroAdmin, normalizar, SENHA_MINIMA };
