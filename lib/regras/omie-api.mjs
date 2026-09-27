// A CHAMADA À API DO OMIE — o único lugar por onde o app e a releitura falam com o Omie.
//
// POR QUE EXISTE. `scripts/ler-omie-faltante.mjs` tinha a sua própria cópia de "como se chama o Omie". Quando a
// camada de dados do app passou a buscar dado novo sozinha (decisão do dono, 27/09/2026: as três telas rodam neste
// computador, só para ele, sem publicar), as duas cópias viraram esta. Aqui mora COMO se chama — endereço,
// credencial por empresa, tentativas, a pausa do limite de consumo, e a gravação no cache. QUAIS leituras se faz
// continua em `lib/regras/cache-omie.mjs` (`leiturasDe`), que é o mesmo arquivo de onde as telas leem: gravar e ler
// são sempre a mesma pergunta, e nenhuma regra é escrita duas vezes.
//
// SÓ MÉTODO DE CONSULTA. `eDeConsulta()` barra, antes do fetch, qualquer método que não comece por `Listar`,
// `Pesquisar`, `Consultar` ou `Obter`. Nada neste repositório inclui, altera ou exclui no Omie, e este guarda existe
// para que continuar assim não dependa de alguém lembrar.
//
// A CREDENCIAL É A QUE OS SCRIPTS JÁ USAM: `OMIE_MEUBESS_<n>_APP_KEY` / `_APP_SECRET` do `.env` da raiz, que o
// `.gitignore` mantém fora de todo commit. Ela vai no corpo do POST e não é impressa em lugar nenhum — nem em erro.
//
// NADA DO QUE VEM DO OMIE VAZA PARA TEXTO. A mensagem de erro diz empresa, serviço e método, e nada mais: nem valor
// em reais, nem nome de cliente, nem documento. As respostas cruas ficam só no cache local `.cache/omie/`.
//
// A GRAVAÇÃO É ATÔMICA: escreve num arquivo temporário e o renomeia em cima do definitivo. Sem isso, uma tela que
// abrisse o cache no exato instante da gravação leria meio JSON e quebraria.

import fs from 'node:fs';
import path from 'node:path';

import { arqCacheOmie, pastaDoCacheOmie } from './cache-omie.mjs';

const BASE = 'https://app.omie.com.br/api/v1/';
// A pausa entre chamadas existe por causa do limite de consumo do Omie. É a mesma dos scripts de leitura.
const PAUSA_MS = 1200;
const TENTATIVAS = 4;
const TEMPO_LIMITE_MS = 60000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// O GUARDA DO "SÓ CONSULTA". Um método do Omie que não seja de leitura não passa daqui.
const PREFIXOS_DE_CONSULTA = ['Listar', 'Pesquisar', 'Consultar', 'Obter'];
const eDeConsulta = (call) => PREFIXOS_DE_CONSULTA.some((p) => String(call).startsWith(p));

// As variáveis de ambiente que faltam preencher, para a mensagem dizer QUAL falta sem dizer o valor de nenhuma.
const credenciaisQueFaltam = (empresas) =>
  empresas.flatMap((e) => [`OMIE_MEUBESS_${e}_APP_KEY`, `OMIE_MEUBESS_${e}_APP_SECRET`]).filter((v) => !process.env[v]);

// O `next start` já carrega o `.env` da raiz; um script chamado direto pelo node, não. Esta função cobre os dois:
// só lê o arquivo se a credencial ainda não estiver no ambiente.
function garantirCredenciais({ raiz, empresas }) {
  if (credenciaisQueFaltam(empresas).length === 0) return;
  try { process.loadEnvFile(path.join(raiz, '.env')); } catch { /* sem .env: a checagem abaixo dá a mensagem */ }
  const faltam = credenciaisQueFaltam(empresas);
  if (faltam.length) throw new Error(`${faltam.join(', ')} precisa(m) estar preenchida(s) no .env da raiz do repositório`);
}

// Grava uma resposta no cache, na chave que a tela vai abrir (`arqCacheOmie`).
function gravarNoCache({ raiz, emp, servico, call, param, json }) {
  const arq = arqCacheOmie(raiz, emp, servico, call, param);
  fs.mkdirSync(pastaDoCacheOmie(raiz), { recursive: true });
  const temp = `${arq}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(json), 'utf8');
  fs.renameSync(temp, arq);
  return arq;
}

function lerDoCache({ raiz, emp, servico, call, param }) {
  const arq = arqCacheOmie(raiz, emp, servico, call, param);
  if (!fs.existsSync(arq)) return null;
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
}

// UMA CHAMADA AO OMIE.
//   forcar: true  → ignora o que está no cache e vai à API (é o caso da releitura das telas)
//   forcar: false → devolve o que está no cache, se estiver lá (é o caso dos scripts que só completam o cache)
//   gravar: true  → grava a resposta no cache agora; false → devolve a resposta e deixa quem chamou decidir quando
//                   gravar (a releitura só grava uma leitura quando ela chegou INTEIRA, para o cache nunca ficar
//                   com página faltando no meio)
//
// Devolve `{ json, doOmie }`. `doOmie` é `false` quando a resposta veio do cache.
async function chamarOmie({ raiz, emp, servico, call, param, forcar = false, gravar = true }) {
  if (!eDeConsulta(call)) throw new Error(`${call} não é método de consulta do Omie; este repositório só consulta`);

  if (!forcar) {
    const guardado = lerDoCache({ raiz, emp, servico, call, param });
    if (guardado) return { json: guardado, doOmie: false };
  }

  const onde = `empresa ${emp} ${servico} ${call}`;
  let ultimo = '';
  for (let n = 1; n <= TENTATIVAS; n++) {
    // `semVolta` guarda o erro que não melhora tentando de novo: credencial errada, parâmetro inválido, 4xx. Ele é
    // lançado depois do `finally`, para o tempo limite ser sempre desarmado.
    let semVolta = null;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TEMPO_LIMITE_MS);
    try {
      const resp = await fetch(`${BASE}${servico}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call,
          app_key: process.env[`OMIE_MEUBESS_${emp}_APP_KEY`],
          app_secret: process.env[`OMIE_MEUBESS_${emp}_APP_SECRET`],
          param: [param],
        }),
        // Sem o cache de `fetch` do Next no meio: a releitura existe justamente para trazer a resposta de agora.
        cache: 'no-store',
        signal: ac.signal,
      });
      let json = null;
      try { json = await resp.json(); } catch { /* corpo não-JSON */ }
      if (json?.faultstring) {
        ultimo = `${onde}: ${json.faultcode ?? '?'} ${json.faultstring}`;
        // "não encontrado" não é erro: é lista vazia. É o que os scripts de leitura já fazem.
        if (/n[aã]o.*(encontrad|existe)|0 registros/i.test(String(json.faultstring))) {
          const vazio = { _vazio: true, nTotPaginas: 1, nTotRegistros: 0 };
          if (gravar) gravarNoCache({ raiz, emp, servico, call, param, json: vazio });
          return { json: vazio, doOmie: true };
        }
        // Limite de consumo e chamada repetida pedem espera; o resto é erro de verdade e não melhora tentando de novo.
        if (!/REDUNDANT|consumo|aguarde|bloquead/i.test(`${json.faultcode} ${json.faultstring}`)) semVolta = ultimo;
      } else if (json && resp.ok) {
        if (gravar) gravarNoCache({ raiz, emp, servico, call, param, json });
        return { json, doOmie: true };
      } else {
        ultimo = `${onde}: HTTP ${resp.status}`;
        if (resp.status < 500 && resp.status !== 425 && resp.status !== 429) semVolta = ultimo;
      }
    } catch {
      ultimo = `${onde}: sem resposta do Omie (rede ou tempo limite)`;
    } finally { clearTimeout(t); }
    if (semVolta) throw new Error(semVolta);
    if (n < TENTATIVAS) await espera(PAUSA_MS * n * 3);
  }
  throw new Error(`${ultimo} (desisti após ${TENTATIVAS} tentativas)`);
}

export {
  BASE, PAUSA_MS, espera, eDeConsulta,
  credenciaisQueFaltam, garantirCredenciais, gravarNoCache, lerDoCache, chamarOmie,
};
