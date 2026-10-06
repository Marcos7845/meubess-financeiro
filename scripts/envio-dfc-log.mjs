import fs from 'node:fs/promises';
import path from 'node:path';

export async function registrarEnvio({ arquivo, resultado, etapa, erro, segredos = [] }) {
  let mensagem = String(erro?.message ?? erro ?? '');
  for (const segredo of segredos.filter(Boolean)) mensagem = mensagem.replaceAll(String(segredo), '[oculto]');
  mensagem = mensagem.replace(/[\r\n\t]+/g, ' ').slice(0, 1000);
  const linha = `${new Date().toISOString()} resultado=${resultado} etapa=${etapa}`
    + (erro ? ` mensagem=${mensagem}` : '') + '\n';
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  await fs.appendFile(arquivo, linha, { encoding: 'utf8', mode: 0o600 });
}
