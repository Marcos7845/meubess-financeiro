// A CAMADA DE DADOS DO SERVIDOR. É o único lugar por onde a tela pede número.
//
// Roda SÓ NO SERVIDOR: lê o cache do Omie e as planilhas do DFC com `fs`, coisas que o navegador não vê. Para o
// browser vai só o resultado já calculado — nunca uma chave, um caminho de pasta ou um arquivo.
//
// RELEITURA DE HORA EM HORA (decisão do dono, 25/09/2026). Cada mês pedido fica guardado por uma hora; passada a
// hora, a próxima visita relê as fontes. O botão "atualizar agora" da tela chama `esquecer()` e força a releitura.
//
// AS DUAS FONTES, E O QUE "RELER" PASSOU A SIGNIFICAR (decisão do dono, 27/09/2026: as três telas rodam neste
// computador, só para ele, sem publicar):
//
//   O OMIE — releitura pela API. Antes, reler era só reabrir o cache local, e buscar página nova era trabalho dos
//   scripts. Agora `lib/regras/omie-releitura.mjs` vai ao Omie, só por método de consulta, com as chaves que os
//   scripts já usam, e grava no MESMO cache `.cache/omie/`. Uma volta inteira leva minutos, então ela roda ao lado:
//   a tela espera por ela um tanto e, se não der, desenha o último guardado e diz isso. Se o Omie falhar, o cache
//   continua com a leitura anterior inteira — a tela mostra o guardado e o aviso, e não quebra.
//
//   O DFC — as planilhas, lidas a cada cálculo por `lib/regras/dfc-fonte.mjs`. Aqui não há cache nenhum além do
//   balde da hora: se a pasta não responder, `d.dfc.ok` sai falso com o motivo, e a tela já avisa.
//
// A HORA DA ÚLTIMA LEITURA DAS DUAS FONTES vai para a tela em `d.leituras` e é desenhada por `app/ultima-leitura.js`.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from './indicadores/tela-1.mjs';
import { calcularTela2 } from './indicadores/tela-2.mjs';
import { calcularTela3 } from './indicadores/tela-3.mjs';
import { fonteDoDfc } from './regras/dfc-fonte.mjs';
import { pedirReleituraDoOmie, estadoDoOmie } from './regras/omie-releitura.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UMA_HORA = 60 * 60 * 1000;

// Um balde por tela e janela pedidas. O processo do Next sobrevive entre as visitas, então isto é o cache da releitura
// horária. "atualizar agora" limpa o mapa inteiro, e não só a tela de onde o botão foi apertado: as duas telas leem
// as mesmas fontes, e o dono que pede número novo quer número novo em todas.
const guardado = new Map();

// "atualizar agora" não recalcula na hora: quem recalcula é a visita seguinte, que o navegador dispara. Esta marca
// atravessa as duas e faz essa visita ir ao Omie, e não só ao cache. É consumida na primeira leitura que a usar.
let forcarAProxima = false;

// A ÚLTIMA VEZ QUE O DFC FOI LIDO COM SUCESSO. Fica na memória do processo, ao lado do balde: é a hora que a tela
// mostra. Nada de nome de pasta ou de arquivo de pessoa entra aqui — só a hora e o nome curto da fonte.
let ultimaDoDfc = { em: null, fonte: null };

// A chave do balde leva o `extra` porque a Tela 3 pode ser pedida numa janela de vencimento que não é o mês —
// duas janelas diferentes são duas leituras diferentes e não podem dividir o mesmo balde.
function chave(tela, ano, mes, extra = '') { return `${tela}|${ano}-${String(mes).padStart(2, '0')}${extra ? `|${extra}` : ''}`; }

// O mês que a tela abre: o corrente (decisão do dono, 25/09/2026).
function mesCorrente() {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

// O que a tela desenha sobre as duas fontes. Montado a cada resposta, inclusive quando os números vêm do balde da
// hora: a releitura do Omie pode ter avançado desde que o balde foi calculado.
function leiturasAgora() {
  return { omie: estadoDoOmie(RAIZ), dfc: { ...ultimaDoDfc } };
}

// O guardado de uma tela qualquer: `calcular` só é chamado quando não há nada de menos de uma hora no balde.
async function comBalde(tela, { ano, mes, forcar = false, janela = null }, calcular) {
  const k = chave(tela, ano, mes, janela ? janela.join('-') : '');
  const agora = Date.now();
  const tem = guardado.get(k);
  // O BALDE VALE ATÉ A HORA VIRAR **OU** ATÉ CHEGAR LEITURA NOVA DO OMIE. A segunda parte é o que faz a releitura
  // aparecer na tela: ela leva minutos e termina depois de o balde já ter sido calculado com o cache antigo, e sem
  // isto o dono apertaria "atualizar agora", esperaria a releitura terminar, recarregaria — e continuaria vendo os
  // números velhos até a hora virar. `okEm` muda a cada volta que traz dado; mudou, o balde é refeito do cache já
  // renovado, sem nova ida ao Omie.
  const omieEm = estadoDoOmie(RAIZ).okEm;
  if (!forcar && !forcarAProxima && tem && agora - tem.em < UMA_HORA && tem.omieEm === omieEm)
    return { ...tem.dados, doCache: true, lidoHaMs: agora - tem.em, leituras: leiturasAgora() };

  // ANTES DE CALCULAR, O OMIE. `forcar` é o "atualizar agora"; sem ele, a releitura só vai à API se a última tem uma
  // hora ou mais. A tela não fica presa nela: `pedirReleituraDoOmie` espera um tanto e devolve o estado de agora.
  const aoOmie = forcar || forcarAProxima;
  forcarAProxima = false;
  await pedirReleituraDoOmie({ raiz: RAIZ, ano, forcar: aoOmie });

  const fonte = fonteDoDfc();
  const dados = await calcular({ raiz: RAIZ, ano, mes, janela, fonte });
  if (dados.dfc?.ok) ultimaDoDfc = { em: new Date().toISOString(), fonte: dados.dfc.fonte ?? fonte.nome };
  guardado.set(k, { em: agora, omieEm: estadoDoOmie(RAIZ).okEm, dados });
  return { ...dados, doCache: false, lidoHaMs: 0, leituras: leiturasAgora() };
}

const dadosDaTela1 = (pedido) => comBalde('tela-1', pedido, calcularTela1);
const dadosDaTela2 = (pedido) => comBalde('tela-2', pedido, calcularTela2);
const dadosDaTela3 = (pedido) => comBalde('tela-3', pedido, calcularTela3);

// "atualizar agora": joga fora o guardado e marca que a próxima leitura tem de ir ao Omie, e não só ao cache.
function esquecer() { guardado.clear(); forcarAProxima = true; }

export { dadosDaTela1, dadosDaTela2, dadosDaTela3, esquecer, mesCorrente, UMA_HORA, RAIZ };
