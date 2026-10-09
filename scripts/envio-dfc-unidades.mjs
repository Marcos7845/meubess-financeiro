import fs from 'node:fs';
import path from 'node:path';
import { UNIDADES, FIM_DAS_UNIDADES } from '../lib/regras/dfc-fonte.mjs';
import { arquivoDoMes } from '../lib/regras/dfc.mjs';

const unidadeDoNome = (nome) => /^([^_]+)__/.exec(nome)?.[1]?.toUpperCase() ?? null;

// Os nomes "<unidade>__<arquivo>" que o espelho local guarda das unidades encerradas. Só lista; nada é aberto.
export function listarEspelho(destino, unidades = Object.keys(FIM_DAS_UNIDADES)) {
  return unidades.flatMap((unidade) => {
    try {
      return fs.readdirSync(path.join(destino, unidade))
        .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
        .sort((a, b) => a.localeCompare(b)).map((f) => `${unidade}__${f}`);
    } catch { return []; }
  });
}

// O QUE O ENVIO EXIGE (decisão do dono, 09/10/2026). Unidade em vigor sem planilha para o envio. Unidade encerrada
// (`FIM_DAS_UNIDADES`) sem planilha na pasta dá só o aviso, e os meses anteriores ao fim vêm do espelho, para o
// servidor, que troca o envio inteiro, não perder o mês que já tinha.
export function planejarEnvio({ nomes, espelho = [], ano = 2026 }) {
  const porUnidade = Object.fromEntries(UNIDADES.map((u) =>
    [u, nomes.filter((nome) => unidadeDoNome(nome) === u && /DFC/i.test(nome)).length]));
  const faltam = UNIDADES.filter((u) => !FIM_DAS_UNIDADES[u] && porUnidade[u] === 0);
  const avisos = [], doEspelho = [];
  for (const [unidade, fim] of Object.entries(FIM_DAS_UNIDADES)) {
    if (porUnidade[unidade] > 0) continue;
    const anteriores = espelho.filter((nome) => unidadeDoNome(nome) === unidade && /DFC/i.test(nome) &&
      Array.from({ length: 12 }, (_, i) => i + 1)
        .some((mes) => `${ano}-${String(mes).padStart(2, '0')}` < fim && arquivoDoMes(nome, mes, ano)));
    doEspelho.push(...anteriores);
    avisos.push(`${unidade}: sem planilha (encerrada a partir de ${fim}); ${anteriores.length} planilha(s) anterior(es) reenviada(s) do espelho.`);
  }
  return { porUnidade, faltam, avisos, doEspelho };
}
