// O DFC QUE O PC MANDOU, GUARDADO NO SERVIDOR.
//
// O PC do dono lê as planilhas do DFC como sempre (a pasta que o OneDrive espelha) e as manda inteiras para
// `/api/dfc` (`scripts/financeiro-enviar-dfc.mjs`). O servidor guarda aqui, no volume, e grava junto a hora do envio.
// A fonte `servidor` de `dfc-fonte.mjs` lê daqui — e daqui em diante é a MESMA leitura de planilha de sempre
// (`dfc.mjs`), com os mesmos bytes: o número não tem como sair diferente do que o PC leria.
//
// COMO É GUARDADO, em `<pasta dos dados>/dfc/`:
//   pedacos/<sha256>.xlsx  cada planilha pelo resumo do próprio conteúdo. O PC só manda o que o servidor ainda não
//                          tem (as doze pesam dezenas de MB, e de uma hora para outra quase sempre muda uma só).
//   envio.json             o envio que vale: a hora, e o nome, tamanho e sha256 de cada arquivo. Trocá-lo é UM
//                          rename, e por isso a troca é atômica: quem lê vê o envio velho inteiro ou o novo inteiro.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pastaDosDados } from '../acesso/armazenamento.mjs';

const pastaDoDfc = () => path.join(pastaDosDados(), 'dfc');
const pastaDosPedacos = () => path.join(pastaDoDfc(), 'pedacos');
const NOME_VALIDO = /^[^/\\:*?"<>|\x00-\x1f]{1,200}\.xlsx$/i;
const SHA_VALIDO = /^[0-9a-f]{64}$/;
const LIMITE_ARQUIVOS = 60;

const arquivoDoPedaco = (sha) => path.join(pastaDosPedacos(), `${sha}.xlsx`);

// O QUE VALE AGORA: `{ em, arquivos: [{ nome, bytes, sha256 }] }`, ou null se o PC nunca mandou nada.
function ultimoEnvio() {
  try { return JSON.parse(fs.readFileSync(path.join(pastaDoDfc(), 'envio.json'), 'utf8')); }
  catch { return null; }
}

// O conteúdo de um arquivo do envio que vale.
function lerDoEnvio(envio, nome) {
  const a = envio?.arquivos.find((x) => x.nome === nome);
  if (!a) throw new Error(`${nome} não veio no último envio`);
  return fs.readFileSync(arquivoDoPedaco(a.sha256));
}

// GUARDA UMA PLANILHA pelo resumo do conteúdo e devolve o resumo. Guardar de novo a mesma é inofensivo.
function guardarPedaco(conteudo) {
  // Um .xlsx é um zip: começa com "PK".
  if (!Buffer.isBuffer(conteudo) || conteudo.length < 4 || conteudo.readUInt16BE(0) !== 0x504b) throw new Error('o arquivo não é um .xlsx');
  const sha = crypto.createHash('sha256').update(conteudo).digest('hex');
  const arq = arquivoDoPedaco(sha);
  if (!fs.existsSync(arq)) {
    fs.mkdirSync(pastaDosPedacos(), { recursive: true });
    const temp = `${arq}.${process.pid}.tmp`;
    fs.writeFileSync(temp, conteudo);
    fs.renameSync(temp, arq);
  }
  return sha;
}

// FECHA UM ENVIO: `arquivos` é a lista inteira da pasta, `[{ nome, sha256 }]`. Toda planilha tem de já estar guardada
// (`guardarPedaco`); as que faltam voltam em `faltam`, e nada muda. Fechado, os pedaços que nenhum envio usa mais e
// têm mais de uma hora são apagados (os de menos de uma hora podem ser de um envio que ainda está chegando).
function fecharEnvio(arquivos) {
  if (!Array.isArray(arquivos) || arquivos.length === 0) throw new Error('o envio não trouxe arquivo nenhum');
  if (arquivos.length > LIMITE_ARQUIVOS) throw new Error(`o envio trouxe mais de ${LIMITE_ARQUIVOS} arquivos`);
  const nomes = new Set();
  for (const a of arquivos) {
    if (!NOME_VALIDO.test(a?.nome ?? '') || a.nome.startsWith('.') || a.nome.startsWith('~$')) throw new Error('nome de arquivo inválido no envio');
    if (!SHA_VALIDO.test(a.sha256 ?? '')) throw new Error(`resumo inválido para ${a.nome}`);
    if (nomes.has(a.nome)) throw new Error('arquivo repetido no envio');
    nomes.add(a.nome);
  }
  const faltam = arquivos.filter((a) => !fs.existsSync(arquivoDoPedaco(a.sha256))).map((a) => a.sha256);
  if (faltam.length) return { ok: false, faltam };

  const envio = {
    em: new Date().toISOString(),
    arquivos: arquivos.map((a) => ({ nome: a.nome, bytes: fs.statSync(arquivoDoPedaco(a.sha256)).size, sha256: a.sha256 })),
  };
  const destino = path.join(pastaDoDfc(), 'envio.json');
  const temp = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(envio, null, 2), 'utf8');
  fs.renameSync(temp, destino);

  const usados = new Set(envio.arquivos.map((a) => `${a.sha256}.xlsx`));
  for (const f of fs.readdirSync(pastaDosPedacos())) {
    const arq = path.join(pastaDosPedacos(), f);
    try { if (!usados.has(f) && Date.now() - fs.statSync(arq).mtimeMs > 60 * 60 * 1000) fs.rmSync(arq, { force: true }); }
    catch { /* limpeza: se não der, fica para o próximo envio */ }
  }
  return { ok: true, envio };
}

export { ultimoEnvio, lerDoEnvio, guardarPedaco, fecharEnvio };
