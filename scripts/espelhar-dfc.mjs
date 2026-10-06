import fs from 'node:fs/promises';
import path from 'node:path';
import { UNIDADES } from '../lib/regras/dfc-fonte.mjs';

// Usa exatamente os arquivos selecionados para o envio. A origem é só lida.
export async function espelharDfc({ fonte, nomes, destino }) {
  const contagem = Object.fromEntries(UNIDADES.map((unidade) => [unidade, 0]));
  for (const nome of nomes) {
    const match = /^(3N|B3N|B3W|N3)__(.+\.xlsx)$/i.exec(nome);
    if (!match || path.basename(match[2]) !== match[2]) throw new Error('nome de planilha inválido no espelho');
    const unidade = match[1].toUpperCase();
    const origem = fonte.caminho(nome);
    const pasta = path.join(destino, unidade);
    const copia = path.join(pasta, match[2]);
    if (path.resolve(origem) === path.resolve(copia)) throw new Error('a origem e o espelho são o mesmo arquivo');
    await fs.mkdir(pasta, { recursive: true });
    const { atime, mtime } = await fs.stat(origem);
    await fs.copyFile(origem, copia);
    await fs.utimes(copia, atime, mtime);
    contagem[unidade] += 1;
  }
  return contagem;
}
