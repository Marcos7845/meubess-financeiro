// A CAMADA DE DADOS DO SERVIDOR. É o único lugar por onde a tela pede número.
//
// Roda SÓ NO SERVIDOR: lê o cache do Omie e as planilhas do DFC com `fs`, coisas que o navegador não vê. Para o
// browser vai só o resultado já calculado — nunca uma chave, um caminho de pasta ou um arquivo.
//
// RELEITURA DE HORA EM HORA (decisão do dono, 25/09/2026). Cada mês pedido fica guardado por uma hora; passada a
// hora, a próxima visita relê as fontes. O botão "atualizar agora" da tela chama `esquecer()` e força a releitura.
//
// O QUE É RELIDO: o cache local do Omie (`.cache/omie/`, que os scripts de leitura gravam) e as planilhas do DFC.
// Buscar página nova na API do Omie continua sendo trabalho dos scripts — nada aqui escreve em lugar nenhum.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from './indicadores/tela-1.mjs';
import { fonteDoDfc } from './regras/dfc-fonte.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UMA_HORA = 60 * 60 * 1000;

// Um balde por mês pedido. O processo do Next sobrevive entre as visitas, então isto é o cache da releitura horária.
const guardado = new Map();

function chave(ano, mes) { return `${ano}-${String(mes).padStart(2, '0')}`; }

// O mês que a tela abre: o corrente (decisão do dono, 25/09/2026).
function mesCorrente() {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

async function dadosDaTela1({ ano, mes, forcar = false }) {
  const k = chave(ano, mes);
  const agora = Date.now();
  const tem = guardado.get(k);
  if (!forcar && tem && agora - tem.em < UMA_HORA) return { ...tem.dados, doCache: true, lidoHaMs: agora - tem.em };
  const dados = await calcularTela1({ raiz: RAIZ, ano, mes, fonte: fonteDoDfc() });
  guardado.set(k, { em: agora, dados });
  return { ...dados, doCache: false, lidoHaMs: 0 };
}

// "atualizar agora": joga fora o guardado para a próxima leitura ir às fontes.
function esquecer() { guardado.clear(); }

export { dadosDaTela1, esquecer, mesCorrente, UMA_HORA, RAIZ };
