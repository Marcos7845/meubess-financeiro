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
import { calcularTela2 } from './indicadores/tela-2.mjs';
import { fonteDoDfc } from './regras/dfc-fonte.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UMA_HORA = 60 * 60 * 1000;

// Um balde por tela e mês pedidos. O processo do Next sobrevive entre as visitas, então isto é o cache da releitura
// horária. "atualizar agora" limpa o mapa inteiro, e não só a tela de onde o botão foi apertado: as duas telas leem
// as mesmas fontes, e o dono que pede número novo quer número novo nas duas.
const guardado = new Map();

function chave(tela, ano, mes) { return `${tela}|${ano}-${String(mes).padStart(2, '0')}`; }

// O mês que a tela abre: o corrente (decisão do dono, 25/09/2026).
function mesCorrente() {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

// O guardado de uma tela qualquer: `calcular` só é chamado quando não há nada de menos de uma hora no balde.
async function comBalde(tela, { ano, mes, forcar = false }, calcular) {
  const k = chave(tela, ano, mes);
  const agora = Date.now();
  const tem = guardado.get(k);
  if (!forcar && tem && agora - tem.em < UMA_HORA) return { ...tem.dados, doCache: true, lidoHaMs: agora - tem.em };
  const dados = await calcular({ raiz: RAIZ, ano, mes, fonte: fonteDoDfc() });
  guardado.set(k, { em: agora, dados });
  return { ...dados, doCache: false, lidoHaMs: 0 };
}

const dadosDaTela1 = (pedido) => comBalde('tela-1', pedido, calcularTela1);
const dadosDaTela2 = (pedido) => comBalde('tela-2', pedido, calcularTela2);

// "atualizar agora": joga fora o guardado para a próxima leitura ir às fontes.
function esquecer() { guardado.clear(); }

export { dadosDaTela1, dadosDaTela2, esquecer, mesCorrente, UMA_HORA, RAIZ };
