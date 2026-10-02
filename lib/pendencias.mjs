// Caixa privada do financeiro. Conteúdo, respostas e anexos ficam somente no volume.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pastaDosDados } from './acesso/armazenamento.mjs';

const raiz = () => path.join(pastaDosDados(), 'pendencias');
const arquivo = () => path.join(raiz(), 'pendencias.json');
const pastaAnexos = () => path.join(raiz(), 'anexos');
const vazio = () => ({ versao: 1, proximoMarcador: 1, pendencias: [], respostas: [] });
const erro = (mensagem) => { throw new Error(mensagem); };
const texto = (valor, campo, limite) => {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > limite) erro(`${campo} inválido`);
  return valor.trim();
};
const idValido = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(id) && id !== '.' && id !== '..';
const extensoes = new Set(['.xlsx', '.xls', '.ods', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.txt', '.md', '.zip']);
export const LIMITE_ANEXO = 15 * 1024 * 1024;

function ler() {
  try { return JSON.parse(fs.readFileSync(arquivo(), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return vazio(); throw e; }
}
function gravar(dados) {
  fs.mkdirSync(raiz(), { recursive: true, mode: 0o700 });
  const temp = `${arquivo()}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(dados), { mode: 0o600 });
    fs.renameSync(temp, arquivo());
  } finally { try { fs.unlinkSync(temp); } catch { /* rename já consumiu o temporário */ } }
}
let fila = Promise.resolve();
function mudar(fn) {
  const p = fila.then(async () => { const dados = ler(); const resultado = await fn(dados); gravar(dados); return resultado; });
  fila = p.catch(() => {});
  return p;
}
export function listarPendencias() {
  const dados = ler();
  return dados.pendencias.map((p) => ({ ...p, respostas: dados.respostas.filter((r) => r.pendenciaId === p.id) }));
}
export async function publicarPendencia(entrada) {
  if (!idValido(entrada?.id)) erro('id inválido');
  const titulo = texto(entrada.titulo, 'título', 200);
  const pedido = texto(entrada.pedido, 'pedido', 10000);
  const motivo = texto(entrada.motivo, 'motivo', 10000);
  if (!['aberta', 'encerrada'].includes(entrada.status)) erro('status inválido');
  return mudar((dados) => {
    const agora = new Date().toISOString();
    const atual = dados.pendencias.find((p) => p.id === entrada.id);
    if (atual) Object.assign(atual, { titulo, pedido, motivo, status: entrada.status, atualizadaEm: agora });
    else dados.pendencias.push({ id: entrada.id, titulo, pedido, motivo, status: entrada.status, criadaEm: agora, atualizadaEm: agora });
    return atual ?? dados.pendencias.at(-1);
  });
}
function nomeLimpo(nome) {
  const limpo = path.basename(String(nome ?? '').replaceAll('\\', '/')).normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '').trim().slice(0, 120);
  if (!limpo || !extensoes.has(path.extname(limpo).toLowerCase())) erro('tipo de anexo não permitido');
  return limpo;
}
function caminhoDoAnexo(nomeGuardado) {
  if (!/^[0-9a-f-]{36}_[^/\\]+$/.test(nomeGuardado)) erro('anexo inválido');
  const pasta = path.resolve(pastaAnexos());
  const destino = path.resolve(pasta, nomeGuardado);
  if (!destino.startsWith(pasta + path.sep)) erro('caminho de anexo inválido');
  return destino;
}
export async function responderPendencia({ pendenciaId, resposta, anexos, email }) {
  if (!idValido(pendenciaId)) erro('pendência inválida');
  const corpo = texto(resposta, 'resposta', 20000);
  if (!Array.isArray(anexos) || anexos.length > 5) erro('envie no máximo 5 anexos');
  const preparados = [];
  for (const f of anexos) {
    if (!f || typeof f.arrayBuffer !== 'function' || f.size > LIMITE_ANEXO) erro('anexo grande demais');
    preparados.push({ nome: nomeLimpo(f.name), conteudo: Buffer.from(await f.arrayBuffer()) });
  }
  const gravados = [];
  try { return await mudar((dados) => {
    const pendencia = dados.pendencias.find((p) => p.id === pendenciaId);
    if (!pendencia || pendencia.status !== 'aberta') erro('pendência não está aberta');
    fs.mkdirSync(pastaAnexos(), { recursive: true, mode: 0o700 });
    const arquivos = preparados.map(({ nome, conteudo }) => {
      const id = crypto.randomUUID();
      const guardado = `${id}_${nome}`;
      const destino = caminhoDoAnexo(guardado);
      fs.writeFileSync(destino, conteudo, { flag: 'wx', mode: 0o600 });
      gravados.push(destino);
      return { id, nome, tamanho: conteudo.length, guardado };
    });
    const registro = {
      id: crypto.randomUUID(), pendenciaId, texto: corpo, por: email,
      em: new Date().toISOString(), marcador: dados.proximoMarcador++, recebidoEm: null, anexos: arquivos,
    };
    dados.respostas.push(registro);
    return registro;
  }); } catch (e) { for (const destino of gravados) { try { fs.unlinkSync(destino); } catch { /* não encobrir a falha original */ } } throw e; }
}
export function respostasDesde(marcador) {
  if (!Number.isSafeInteger(marcador) || marcador < 0) erro('marcador inválido');
  const dados = ler();
  return { marcador: dados.proximoMarcador - 1,
    respostas: dados.respostas.filter((r) => r.marcador > marcador).map(({ anexos, ...r }) => ({
      ...r, anexos: anexos.map(({ guardado, ...a }) => a),
    })) };
}
export async function marcarRecebida(id) {
  return mudar((dados) => {
    const resposta = dados.respostas.find((r) => r.id === id);
    if (!resposta) erro('resposta não encontrada');
    resposta.recebidoEm ??= new Date().toISOString();
    return { id: resposta.id, recebidoEm: resposta.recebidoEm };
  });
}
export function obterAnexo(id) {
  const anexo = ler().respostas.flatMap((r) => r.anexos).find((a) => a.id === id);
  if (!anexo) erro('anexo não encontrado');
  return { nome: anexo.nome, conteudo: fs.readFileSync(caminhoDoAnexo(anexo.guardado)) };
}
