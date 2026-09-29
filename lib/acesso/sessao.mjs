// A SESSÃO — um cookie assinado, e a regra de quem passa.
//
// O COOKIE `meubess_sessao` leva `{ e: e-mail, v: versão da sessão, x: validade }` em base64url, mais a assinatura
// HMAC-SHA256 com `SESSAO_SEGREDO`. Ele é HttpOnly (o JavaScript da página não o lê), Secure (só vai por https; o
// navegador aceita também em http://127.0.0.1 e localhost) e SameSite=Lax (um formulário de outro site não o leva num
// POST). Vale 12 horas.
//
// A ASSINATURA NÃO BASTA: a cada pedido a pessoa é procurada no cadastro, e a sessão só vale se ela ainda está ativa e
// se a versão bate. Desativar alguém ou trocar a senha dele sobe a versão, e todo cookie antigo para de valer na hora.
//
// O LOGIN SÓ FICA DESLIGADO com `MEUBESS_LOGIN=desligado`, que `npm run local` põe sozinho — as telas deste computador
// atendem só 127.0.0.1. O servidor do Railway (`scripts/subir-servidor.mjs`) se recusa a subir com essa variável.

import crypto from 'node:crypto';
import { buscar } from './usuarios.mjs';

const COOKIE = 'meubess_sessao';
const DOZE_HORAS = 12 * 60 * 60;

const loginLigado = () => process.env.MEUBESS_LOGIN !== 'desligado';
const segredo = () => process.env.SESSAO_SEGREDO || null;
const assinar = (s, texto) => crypto.createHmac('sha256', s).update(texto).digest('base64url');

function emitir(pessoa) {
  const s = segredo();
  if (!s) throw new Error('SESSAO_SEGREDO não está no ambiente');
  const corpo = Buffer.from(JSON.stringify({
    e: pessoa.email, v: pessoa.versaoSessao, x: Math.floor(Date.now() / 1000) + DOZE_HORAS,
  })).toString('base64url');
  return `${corpo}.${assinar(s, corpo)}`;
}

// QUEM ESTÁ LOGADO, a partir do valor do cookie. Devolve `{ email, admin }` ou null.
function quemE(valor) {
  const s = segredo();
  if (!s || !valor || typeof valor !== 'string') return null;
  const [corpo, assinatura] = valor.split('.');
  if (!corpo || !assinatura) return null;
  const a = Buffer.from(assinatura), b = Buffer.from(assinar(s, corpo));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')); } catch { return null; }
  if (!p?.e || !(p.x > Date.now() / 1000)) return null;
  const u = buscar(p.e);
  if (!u || !u.ativo || u.versaoSessao !== p.v) return null;
  return { email: u.email, admin: Boolean(u.admin) };
}

// O cabeçalho Set-Cookie, montado à mão para servir tanto ao proxy quanto às rotas.
function cookieDaSessao(valor) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DOZE_HORAS}`;
}
const cookieQueApaga = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// Lê o cookie da sessão de um cabeçalho `Cookie` cru.
function valorDoCookie(cabecalho) {
  for (const parte of String(cabecalho ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === COOKIE) return parte.slice(i + 1).trim();
  }
  return null;
}

// Quem fez este pedido (Request padrão). Com o login desligado, um dono local fictício, administrador.
function quemPediu(pedido) {
  if (!loginLigado()) return { email: 'local', admin: true, local: true };
  return quemE(valorDoCookie(pedido.headers.get('cookie')));
}

export { COOKIE, loginLigado, segredo, emitir, quemE, quemPediu, cookieDaSessao, cookieQueApaga, valorDoCookie };
