// A RELEITURA DO OMIE PELAS TELAS (decisão do dono, 27/09/2026).
//
// O QUE MUDOU. Até aqui a releitura de hora em hora da camada de dados só reabria o cache local, e buscar página nova
// no Omie era trabalho dos scripts. Agora a releitura de hora em hora e o botão "atualizar agora" vão ao Omie pela
// API, buscam as leituras que as três telas abrem e gravam no MESMO cache local, com a MESMA chave.
//
// QUAIS LEITURAS — AS DE `leiturasDe`, NENHUMA A MAIS. A lista abaixo é montada a partir de
// `lib/regras/cache-omie.mjs`, o arquivo de onde as telas leem; nenhum parâmetro de consulta é escrito aqui de novo.
// E ela não inventa chave nova de propósito: a Tela 3 escolhe entre a leitura da PRÓPRIA JANELA e a leitura do ANO
// recortada, e qual das duas ela acha no cache é o que `scripts/conferir-telas.mjs` compara com `docs/conferencia.md`.
// Acrescentar uma janela nova ao cache mudaria essa escolha sem ninguém pedir.
//
// SÓ CONSULTA. Onze leituras, todas de método `Listar…` / `Pesquisar…`, barradas por `eDeConsulta()` em
// `lib/regras/omie-api.mjs` antes de qualquer fetch. Nada aqui inclui, altera ou exclui no Omie.
//
// A RELEITURA NÃO SEGURA A TELA. São perto de 280 páginas em duas empresas, e o Omie pede pausa entre chamadas: uma
// volta inteira leva minutos. Então ela roda AO LADO — uma por vez, nunca duas — e a tela espera por ela só um tanto
// (`OMIE_ESPERA_MS`, 20 s por omissão). Passado esse tanto, a tela desenha o último guardado e diz que a releitura
// ainda está em curso; a visita seguinte já pega o que chegou.
//
// SE O OMIE FALHAR, O CACHE NÃO PIORA. As páginas de uma leitura ficam na memória e só vão para o cache quando a
// última chegou. Falha no meio, a leitura anterior continua inteira no cache — e é por isso que a tela consegue
// mostrar "o último guardado" em vez de quebrar por página faltando. Uma leitura que falha não derruba as outras.
//
// A HORA DA ÚLTIMA LEITURA FICA EM ARQUIVO (`.cache/ultima-leitura-omie.json`, fora do git), e não só na memória do
// processo: o dono fecha e reabre o app, e a tela continua sabendo de quando são os números.
//
// NADA DO QUE VEM DO OMIE VAZA PARA TEXTO: o arquivo da marca guarda hora, contagem de páginas e motivo de falha —
// nunca valor em reais, nome de cliente ou credencial.

import fs from 'node:fs';
import path from 'node:path';

import { EMPRESAS, leiturasDe } from './cache-omie.mjs';
import { PAUSA_MS, espera, garantirCredenciais, gravarNoCache, chamarOmie } from './omie-api.mjs';

const UMA_HORA = 60 * 60 * 1000;
// QUANTO A TELA ESPERA pela releitura antes de desenhar o último guardado. Curto de propósito: uma volta inteira
// nunca cabe nele, então esperar mais só atrasaria a tela. O que estes segundos pegam é a falha IMEDIATA — credencial
// faltando, por exemplo —, que assim já chega à tela como "falhou" em vez de "em curso".
const ESPERA_PADRAO_MS = 8000;

const marcaEm = (raiz) => path.join(raiz, '.cache', 'ultima-leitura-omie.json');

// ---------------------------------------------------------------- as leituras que as telas precisam
//
// Na ordem em que importam: uma volta interrompida no meio deixa renovado o que mais pesa na tela. O cadastro de
// clientes vem por último porque são 72 páginas que só dão o NOME no eixo da Tela 3.
function leiturasDasTelas(ano) {
  const L = leiturasDe(ano);
  const porEmpresa = [
    { servico: 'financas/mf', call: 'ListarMovimentos', param: L.MF, rotulo: 'caixa por data de pagamento' },
    ...L.FAIXAS_TIT_R.map(([de, ate]) => ({
      servico: 'financas/pesquisartitulos', call: 'PesquisarLancamentos', param: (n) => L.TIT_R(n, de, ate),
      rotulo: `títulos a receber por vencimento (${de} a ${ate})`,
    })),
    { servico: 'financas/mf', call: 'ListarMovimentos', param: L.CP_VENC, rotulo: 'títulos a pagar em aberto por vencimento' },
    { servico: 'financas/pesquisartitulos', call: 'PesquisarLancamentos', param: L.TIT_P, rotulo: 'títulos a pagar por vencimento' },
    { servico: 'financas/mf', call: 'ListarMovimentos', param: L.MF_DEP, rotulo: 'caixa com rateio por departamento' },
    { servico: 'geral/categorias', call: 'ListarCategorias', param: L.CATEGORIAS, rotulo: 'cadastro de categorias' },
    { servico: 'geral/departamentos', call: 'ListarDepartamentos', param: L.DEPARTAMENTOS, rotulo: 'cadastro de departamentos' },
    { servico: 'produtos/pedido', call: 'ListarPedidos', param: L.PEDIDOS, rotulo: 'pedidos de venda' },
    { servico: 'geral/dre', call: 'ListarCadastroDRE', param: () => L.DRE, umaPagina: true, rotulo: 'cadastro das contas do DRE' },
    { servico: 'geral/clientes', call: 'ListarClientesResumido', param: L.CLIENTES, rotulo: 'cadastro de clientes (resumido)' },
  ];
  return porEmpresa.flatMap((l) => EMPRESAS.map((emp) => ({ ...l, emp })));
}

// UMA LEITURA INTEIRA: todas as páginas dela, do Omie, e só então para o cache.
async function lerLeituraInteira({ raiz, emp, servico, call, param, umaPagina = false }) {
  const guardar = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const p = param(n);
    const { json } = await chamarOmie({ raiz, emp, servico, call, param: p, forcar: true, gravar: false });
    total = umaPagina ? 1 : (Number(json.nTotPaginas ?? json.total_de_paginas) || 1);
    guardar.push({ param: p, json });
    if (n < total) await espera(PAUSA_MS);
  }
  for (const g of guardar) gravarNoCache({ raiz, emp, servico, call, param: g.param, json: g.json });
  return guardar.length;
}

// UMA VOLTA INTEIRA por todas as leituras das telas.
async function umaVolta({ raiz, ano }) {
  garantirCredenciais({ raiz, empresas: EMPRESAS });
  const todas = leiturasDasTelas(ano);
  let paginas = 0, ok = 0;
  const problemas = [];
  for (const l of todas) {
    try {
      paginas += await lerLeituraInteira({ raiz, ...l });
      ok++;
    } catch (e) {
      problemas.push(`${l.rotulo} (empresa ${l.emp}): ${e.message}`);
    }
    await espera(PAUSA_MS);
  }
  return { paginas, leiturasOk: ok, leiturasTotal: todas.length, problemas };
}

// ---------------------------------------------------------------- a marca da última leitura

function lerMarca(raiz) {
  try { return JSON.parse(fs.readFileSync(marcaEm(raiz), 'utf8')); } catch { return null; }
}

function gravarMarca(raiz, marca) {
  try {
    fs.mkdirSync(path.dirname(marcaEm(raiz)), { recursive: true });
    fs.writeFileSync(marcaEm(raiz), JSON.stringify(marca, null, 2), 'utf8');
  } catch { /* sem a marca a tela só perde a hora; não é motivo para derrubar a releitura */ }
  return marca;
}

// ---------------------------------------------------------------- uma releitura por vez

let emCurso = null;        // a Promise da volta que está rodando, ou null
let comecouEm = null;      // quando ela começou, para a tela dizer "em curso desde…"

// O que a tela mostra sobre o Omie.
//   estado: 'nunca'     → nunca houve releitura neste cache (os números são só do que os scripts gravaram)
//           'em curso'  → está buscando agora; os números são os do último guardado
//           'ok'        → a última volta trouxe todas as leituras
//           'parcial'   → trouxe algumas; as outras falharam e ficaram com o guardado anterior
//           'falhou'    → não trouxe nenhuma (Omie fora do ar, sem rede, credencial faltando)
function estadoDoOmie(raiz) {
  const m = lerMarca(raiz);
  return {
    estado: emCurso ? 'em curso' : (m?.estado ?? 'nunca'),
    emCurso: Boolean(emCurso),
    comecouEm: emCurso ? new Date(comecouEm).toISOString() : null,
    // A hora da ÚLTIMA LEITURA que trouxe dado do Omie — é esta que a tela mostra.
    okEm: m?.okEm ?? null,
    tentadaEm: m?.tentadaEm ?? null,
    paginas: m?.paginas ?? 0,
    leiturasOk: m?.leiturasOk ?? 0,
    leiturasTotal: m?.leiturasTotal ?? 0,
    motivo: m?.motivo ?? null,
  };
}

// PEDE UMA RELEITURA e espera por ela `esperarMs` no máximo.
//   forcar: true            → o "atualizar agora" da tela: vai ao Omie mesmo que a última volta tenha sido agora
//   forcar: false           → a releitura de hora em hora: só vai se a última volta tem uma hora ou mais
//   esperarMs: 0            → só dispara e volta na hora (é o que a rota do botão faz)
async function pedirReleituraDoOmie({ raiz, ano, forcar = false, esperarMs = null }) {
  const espere = esperarMs ?? Number(process.env.OMIE_ESPERA_MS ?? ESPERA_PADRAO_MS);
  const m = lerMarca(raiz);
  const desdeAUltima = m?.tentadaEm ? Date.now() - Date.parse(m.tentadaEm) : Infinity;
  // `OMIE_RELEITURA=desligada` não chama a API: a tela fica com o cache que já existe. É o que o teste do login usa
  // (`scripts/testar-login.mjs`), para abrir as telas e apertar "atualizar agora" sem ir ao Omie.
  const precisa = process.env.OMIE_RELEITURA !== 'desligada' && (forcar || !(desdeAUltima < UMA_HORA));

  if (precisa && !emCurso) {
    comecouEm = Date.now();
    emCurso = umaVolta({ raiz, ano }).then(
      (r) => gravarMarca(raiz, {
        tentadaEm: new Date().toISOString(),
        okEm: r.leiturasOk ? new Date().toISOString() : (m?.okEm ?? null),
        estado: r.problemas.length === 0 ? 'ok' : (r.leiturasOk ? 'parcial' : 'falhou'),
        paginas: r.paginas, leiturasOk: r.leiturasOk, leiturasTotal: r.leiturasTotal,
        motivo: r.problemas.length ? r.problemas.join(' | ') : null,
      }),
      (e) => gravarMarca(raiz, {
        tentadaEm: new Date().toISOString(),
        okEm: m?.okEm ?? null,
        estado: 'falhou', paginas: 0, leiturasOk: 0, leiturasTotal: leiturasDasTelas(ano).length,
        motivo: e.message,
      }),
    ).finally(() => { emCurso = null; comecouEm = null; });
    // A volta segue rodando ao lado mesmo quando a tela desiste de esperar; sem este `catch` o Node reclamaria de
    // rejeição não tratada, embora as duas pontas acima já tratem tudo.
    emCurso.catch(() => {});
  }

  if (emCurso && espere > 0) await Promise.race([emCurso, espera(espere)]);
  return estadoDoOmie(raiz);
}

export { pedirReleituraDoOmie, estadoDoOmie, leiturasDasTelas };
