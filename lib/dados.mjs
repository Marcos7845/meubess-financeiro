// A CAMADA DE DADOS DO SERVIDOR. É o único lugar por onde a tela pede número.
//
// Roda SÓ NO SERVIDOR: lê o cache do Omie e as planilhas do DFC com `fs`, coisas que o navegador não vê. Para o
// browser vai só o resultado já calculado — nunca uma chave, um caminho de pasta ou um arquivo.
//
// RELEITURA DE HORA EM HORA (decisão do dono, 25/09/2026). As fontes ficam guardadas por uma hora; passada a hora, a
// próxima visita relê. O botão "atualizar agora" da tela chama `esquecer()` e força a releitura.
//
// AS DUAS FONTES, E O QUE "RELER" PASSOU A SIGNIFICAR (decisão do dono, 27/09/2026: as três telas rodam neste
// computador, só para ele, sem publicar):
//
//   O OMIE — releitura pela API. Antes, reler era só reabrir o cache local, e buscar página nova era trabalho dos
//   scripts. Agora `lib/regras/omie-releitura.mjs` vai ao Omie, só por método de consulta, com as chaves que os
//   scripts já usam, e grava no MESMO cache `.cache/omie/`. Uma volta inteira leva minutos, então ela roda ao lado: a
//   tela desenha o último guardado e diz isso.
//
//   O DFC — as planilhas da pasta que o OneDrive espelha, lidas por `lib/regras/dfc-fonte.mjs`.
//
// ---------------------------------------------------------------------------------------------------------------
// A BASE LOCAL, E POR QUE O CLIQUE DE FILTRO FICOU RÁPIDO (decisão do dono, 27/09/2026: "cada clique num filtro das
// 3 telas demora uma eternidade").
//
// O QUE ERA. Cada combinação de filtro era um balde novo aqui, e o balde novo refazia o cálculo INTEIRO — e o cálculo
// inteiro reabria as fontes: os 357 arquivos do cache do Omie e as planilhas do DFC, treze na Tela 1 e doze na Tela 2.
// Antes disso ainda esperava até 8 s pela releitura do Omie. Medido em `docs/desempenho.md`: 7,6 s por clique na Tela
// 1, 7,3 s na Tela 2 — e mais 8 s em qualquer clique que caísse na virada da hora.
//
// O QUE É AGORA. As fontes são lidas e preparadas UMA VEZ, numa base local (`lib/regras/base-local.mjs`), e o clique
// de filtro só calcula em cima dela. Nada do que se lê depende do filtro: a planilha é a mesma, o cache é o mesmo, e o
// recorte do filtro é aplicado depois.
//
// AS TRÊS HORAS EM QUE A BASE É PREPARADA, e nenhuma a mais:
//
//   na ABERTURA           não há base para o ano pedido: esta visita lê as fontes e espera por elas. É a única espera
//                         que sobrou, e é a que o dono aceita.
//   na VIRADA DA HORA     a base completou uma hora (ou a releitura do Omie trouxe leitura nova): a visita responde com
//                         a base que tem e prepara a nova AO LADO, com os mesmos meses de planilha que a velha tinha
//                         lido. Quando a nova fica pronta, ela entra no lugar e os baldes de resultado são jogados
//                         fora — a visita seguinte já mostra os números novos.
//   no "ATUALIZAR AGORA"  `esquecer()` joga fora a base e os baldes; a visita seguinte é uma abertura, e lê tudo de
//                         novo. Quem apertou o botão pediu número novo e espera por ele.
//
// O CLIQUE DE FILTRO NÃO ESPERA PELA RELEITURA DO OMIE. A releitura continua de hora em hora, pela mesma regra do
// mesmo arquivo — o que saiu é a espera: ela é disparada com `esperarMs: 0` quando uma base é preparada, e segue ao
// lado. O preço é que uma falha imediata do Omie (credencial faltando, por exemplo) aparece na visita seguinte em vez
// de na mesma; a hora da última leitura, que o rodapé mostra, continua saindo da marca que a releitura grava.
//
// A HORA DA ÚLTIMA LEITURA DAS DUAS FONTES vai para a tela em `d.leituras` e é desenhada por `app/ultima-leitura.js`.
// A do DFC é a hora em que a PLANILHA foi aberta — quem a guarda é a base, e num clique que só calcula ela não se
// move, porque ninguém abriu planilha nenhuma.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from './indicadores/tela-1.mjs';
import { calcularTela2 } from './indicadores/tela-2.mjs';
import { calcularTela3 } from './indicadores/tela-3.mjs';
import { novaBase } from './regras/base-local.mjs';
import { fonteDoDfc } from './regras/dfc-fonte.mjs';
import { pedirReleituraDoOmie, estadoDoOmie } from './regras/omie-releitura.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UMA_HORA = 60 * 60 * 1000;

// Um balde por tela e janela pedidas. O processo do Next sobrevive entre as visitas, então isto é o cache da releitura
// horária. "atualizar agora" limpa o mapa inteiro, e não só a tela de onde o botão foi apertado: as duas telas leem
// as mesmas fontes, e o dono que pede número novo quer número novo em todas.
const guardado = new Map();

// A BASE LOCAL, uma por ano pedido: `{ base, em, omieEm }`. `em` é quando ela foi preparada e `omieEm`, de que leitura
// do Omie ela é. O cache do Omie é guardado por ano e a pasta do DFC é a do ano, por isso o ano é a chave.
const bases = new Map();
// A renovação que está rodando ao lado, uma por ano — nunca duas, como na releitura do Omie.
const renovando = new Map();
// A ABERTURA QUE ESTÁ RODANDO, uma por ano. Duas telas abertas ao mesmo tempo depois de subir o app são duas visitas
// sem base nenhuma, e sem isto cada uma leria as doze planilhas por conta própria. Com isto, a segunda espera a leitura
// da primeira — que é a mesma leitura, dos mesmos arquivos.
const abrindo = new Map();
// A GERAÇÃO DA BASE. `esquecer()` a avança, e uma renovação que estava rodando ao lado quando o botão foi apertado não
// entra mais no lugar: a base que ela preparou é de antes do "atualizar agora", e quem apertou o botão pediu depois.
let geracao = 0;

// "atualizar agora" não recalcula na hora: quem recalcula é a visita seguinte, que o navegador dispara. Esta marca
// atravessa as duas e faz essa visita ir ao Omie, e não só ao cache. É consumida na primeira base que a usar.
let forcarAProxima = false;

// O TEMPO DE CADA FASE DA ÚLTIMA RESPOSTA, em milissegundos. Existe para `scripts/medir-filtros.mjs`, que publica
// `docs/desempenho.md`: num clique que só calcula, `omie`, `cacheOmie` e `planilhas` saem zero, e é isso que a medição
// prova. Só tempo entra aqui — nenhum número da empresa, nenhum nome, nenhum caminho de pasta.
const ultimasFases = {
  tela: null, omie: 0, cacheOmie: 0, planilhas: 0, calculo: 0, total: 0,
  doCache: false, baseNova: false, renovandoAoLado: false,
};

// A chave do balde leva o `extra` porque a Tela 3 pode ser pedida numa janela de vencimento que não é o mês —
// duas janelas diferentes são duas leituras diferentes e não podem dividir o mesmo balde. O FILTRO ENTRA NA CHAVE pelo
// mesmo motivo: a tela com um centro de custo escolhido é outro cálculo, e servir para ela o balde da tela sem filtro
// mostraria número sem filtro como se estivesse filtrado.
function chave(tela, ano, mes, extra = '') { return `${tela}|${ano}-${String(mes).padStart(2, '0')}${extra ? `|${extra}` : ''}`; }

// O mês que a tela abre: o corrente (decisão do dono, 25/09/2026).
function mesCorrente() {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

// ---------------------------------------------------------------- a base local

// UMA BASE NOVA, e a releitura do Omie disparada junto — sem esperar por ela.
async function criarBase(ano, forcar) {
  const aoOmie = forcar || forcarAProxima;
  forcarAProxima = false;
  await pedirReleituraDoOmie({ raiz: RAIZ, ano, forcar: aoOmie, esperarMs: 0 });
  return novaBase({ raiz: RAIZ, ano, fonte: fonteDoDfc() });
}

// AQUECER UMA BASE: abrir o cache do Omie e os meses de planilha que a base velha tinha aberto. É o trabalho que a
// abertura faz dentro da visita e que a renovação da hora faz ao lado — nos dois casos, uma vez só.
async function aquecer(base, meses) {
  base.cacheOmie();
  for (const m of meses) await base.mes(m);
}

// A BASE VALE ATÉ A HORA VIRAR **OU** ATÉ CHEGAR LEITURA NOVA DO OMIE. A segunda parte é o que faz a releitura
// aparecer na tela: ela leva minutos e termina depois de a base já ter sido preparada com o cache antigo, e sem isto o
// dono apertaria "atualizar agora", esperaria a releitura terminar, recarregaria — e continuaria vendo os números
// velhos até a hora virar. `okEm` muda a cada volta que traz dado.
const baseVale = (g) => Boolean(g) && Date.now() - g.em < UMA_HORA && g.omieEm === estadoDoOmie(RAIZ).okEm;

// A RENOVAÇÃO AO LADO. A visita que descobre a base velha não espera por esta: ela responde com a base que tem, e
// quando a nova fica pronta ela entra no lugar e os baldes de resultado são jogados fora.
function renovarAoLado(ano) {
  if (renovando.has(ano)) return;
  const velha = bases.get(ano);
  const daGeracao = geracao;
  const p = (async () => {
    const base = await criarBase(ano, false);
    await aquecer(base, velha ? velha.base.mesesLidos() : []);
    if (daGeracao !== geracao) return;   // "atualizar agora" passou por aqui: esta base nasceu velha
    bases.set(ano, { base, em: Date.now(), omieEm: estadoDoOmie(RAIZ).okEm });
    // Os baldes foram calculados da base velha; com base nova, todos têm de ser refeitos.
    guardado.clear();
  })();
  // Renovação que falha não derruba nada: a base velha continua servindo e a visita seguinte tenta de novo.
  p.catch(() => {}).finally(() => renovando.delete(ano));
  renovando.set(ano, p);
}

// A BASE DESTA VISITA. Sem base nenhuma, esta visita é a ABERTURA: prepara e espera. Com base velha, responde com ela
// e manda a nova ser preparada ao lado.
async function baseDoAno(ano, forcar) {
  const g = bases.get(ano);
  if (forcar || !g) {
    // Duas telas abrindo juntas dividem UMA abertura. Dentro da base, cada mês de planilha também é uma leitura só:
    // quem pede um mês que já está sendo lido espera aquela leitura, em vez de abrir o arquivo de novo.
    if (!forcar && abrindo.has(ano)) return { base: await abrindo.get(ano), nova: false, renovandoAoLado: false };
    const p = criarBase(ano, forcar).then((base) => {
      bases.set(ano, { base, em: Date.now(), omieEm: estadoDoOmie(RAIZ).okEm });
      return base;
    });
    abrindo.set(ano, p);
    try { return { base: await p, nova: true, renovandoAoLado: false }; }
    finally { abrindo.delete(ano); }
  }
  if (!baseVale(g)) renovarAoLado(ano);
  return { base: g.base, nova: false, renovandoAoLado: renovando.has(ano) };
}

// O que a tela desenha sobre as duas fontes. Montado a cada resposta, inclusive quando os números vêm do balde da
// hora: a releitura do Omie pode ter avançado desde que o balde foi calculado. A hora do DFC é a da base — a hora em
// que a planilha foi realmente aberta.
function leiturasAgora(base) {
  return { omie: estadoDoOmie(RAIZ), dfc: { ...(base?.dfcLido ?? { em: null, fonte: null }) } };
}

// ---------------------------------------------------------------- o guardado de uma tela qualquer

// `calcular` só é chamado quando não há nada de menos de uma hora no balde — e, quando é chamado, calcula em cima da
// base local: o clique de filtro não lê fonte nenhuma.
async function comBalde(tela, { ano, mes, forcar = false, janela = null, filtro = null }, calcular) {
  const k = chave(tela, ano, mes, [janela ? janela.join('-') : '', filtro ? JSON.stringify(filtro) : ''].filter(Boolean).join('|'));
  const t0 = performance.now();
  const fases = { tela, omie: 0, cacheOmie: 0, planilhas: 0, calculo: 0, total: 0, doCache: false, baseNova: false, renovandoAoLado: false };
  const guardarFases = () => {
    fases.total = performance.now() - t0;
    Object.assign(ultimasFases, fases);
  };

  const tOmie = performance.now();
  const { base, nova, renovandoAoLado } = await baseDoAno(ano, forcar);
  const gasto = { ...base.gasto };
  fases.omie = performance.now() - tOmie;
  fases.baseNova = nova;
  fases.renovandoAoLado = renovandoAoLado;

  const agora = Date.now();
  const tem = guardado.get(k);
  if (!forcar && tem && agora - tem.em < UMA_HORA) {
    fases.doCache = true;
    guardarFases();
    return { ...tem.dados, doCache: true, lidoHaMs: agora - tem.em, leituras: leiturasAgora(base) };
  }

  const dados = await calcular({ raiz: RAIZ, ano, mes, janela, filtro: filtro ?? {}, base });
  // O QUE ESTA VISITA GASTOU LENDO FONTE: a diferença dos contadores da base. Na abertura é a leitura inteira; num
  // clique de filtro é zero, porque a base já estava pronta.
  fases.cacheOmie = base.gasto.cacheOmie - gasto.cacheOmie;
  fases.planilhas = base.gasto.planilhas - gasto.planilhas;
  fases.calculo = (performance.now() - t0) - fases.omie - fases.cacheOmie - fases.planilhas;
  guardado.set(k, { em: agora, dados });
  guardarFases();
  return { ...dados, doCache: false, lidoHaMs: 0, leituras: leiturasAgora(base) };
}

const dadosDaTela1 = (pedido) => comBalde('tela-1', pedido, calcularTela1);
const dadosDaTela2 = (pedido) => comBalde('tela-2', pedido, calcularTela2);
const dadosDaTela3 = (pedido) => comBalde('tela-3', pedido, calcularTela3);

// "atualizar agora": joga fora o guardado E a base local, e marca que a próxima leitura tem de ir ao Omie, e não só ao
// cache. A visita seguinte é uma abertura: ela lê as fontes de novo e espera por elas, que é o que quem apertou o botão
// pediu. Os cliques de filtro depois dela voltam a ser só cálculo.
function esquecer() {
  guardado.clear();
  bases.clear();
  geracao += 1;
  forcarAProxima = true;
}

export { dadosDaTela1, dadosDaTela2, dadosDaTela3, esquecer, mesCorrente, ultimasFases, UMA_HORA, RAIZ };
