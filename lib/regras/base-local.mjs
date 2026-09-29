// A BASE LOCAL DAS TRÊS TELAS — as fontes lidas e preparadas UMA VEZ, e o clique de filtro calculando só em cima
// dela (decisão do dono, 27/09/2026: "cada clique num filtro demora uma eternidade").
//
// O QUE ERA. Cada combinação de filtro era um balde novo em `lib/dados.mjs`, e o balde novo refazia o cálculo INTEIRO:
// reabria os 357 arquivos do cache do Omie e reabria as planilhas do DFC — treze arquivos na Tela 1 (o mês mais os
// doze da série do ano) e doze na Tela 2 —, da pasta que o OneDrive espelha. Medido em `docs/desempenho.md`: 7,2 s de
// planilha por clique na Tela 1, 6,9 s na Tela 2. E, se a leitura do Omie tinha passado de uma hora, o clique ainda
// esperava até 8 s por ela antes de começar.
//
// O QUE É AGORA. Nada disso depende do filtro: a planilha é a mesma, o cache é o mesmo, e o recorte do filtro é
// aplicado DEPOIS, sobre o que foi lido. Então a leitura acontece uma vez e fica guardada aqui; o clique só calcula.
//
// ONDE ELA MORA: NA MEMÓRIA DO PROCESSO DO SERVIDOR, e não em arquivo nem em banco. Três motivos, nessa ordem:
//
//   1. DINHEIRO NÃO VAI PARA DISCO. A base guarda o VALOR de cada linha do DFC, em centavos, e o nome de cada cliente
//      do cadastro do Omie. A regra deste repositório é que valor em reais e nome de pessoa vivem na memória do
//      servidor e vão só para a tela (ver o começo de `lib/regras/dfc.mjs` e o README). Um arquivo ou um SQLite com a
//      base seria um lugar novo, no disco, com o dinheiro da empresa dentro — e ninguém precisa dele.
//   2. O PROCESSO SOBREVIVE ENTRE OS CLIQUES. As telas rodam em `next start` neste computador (`npm run local`), e o
//      mesmo processo atende todas as visitas: memória já é persistência suficiente para o clique. O único caso que um
//      arquivo cobriria a mais é a PRIMEIRA abertura depois de reiniciar o app, que é justamente a leitura que o dono
//      aceita esperar.
//   3. SERIALIZAR CUSTARIA O QUE ECONOMIZA. O cache do Omie já É disco: reabri-lo inteiro custa 0,1 s (medido). Passar
//      a base por JSON — com os `Map` e os `Set` que o cache monta — custaria a mesma ordem de grandeza, e o ganho de
//      verdade (os 7 s de planilha) não precisa de disco nenhum para acontecer uma vez só.
//
// QUANDO ELA É RENOVADA — as três horas que `lib/dados.mjs` manda, e nenhuma a mais:
//
//   na ABERTURA          quando não há base nenhuma para o ano pedido; é a única leitura que o dono espera
//   na VIRADA DA HORA    a base tem uma hora → `lib/dados.mjs` pede uma nova AO LADO e responde com a que tem
//   no "ATUALIZAR AGORA" o botão joga a base fora e a próxima visita prepara outra
//
// A REGRA DA RELEITURA DE HORA EM HORA NÃO MUDOU: as fontes continuam sendo relidas de hora em hora, e o Omie
// continua sendo relido pela API pelo mesmo `lib/regras/omie-releitura.mjs`, com a mesma janela de uma hora. O que
// mudou é quem espera: ninguém. O clique responde do que está pronto.
//
// UMA BASE POR ANO. O cache do Omie é guardado por ano (`lib/regras/cache-omie.mjs`) e a pasta do DFC é a do ano;
// dentro do ano, cada mês de planilha é lido quando alguém pede, e fica. Abrir a Tela 1 lê os doze meses (ela desenha
// a série do ano), e por isso a Tela 2, que precisa dos mesmos doze, já os encontra prontos.
//
// SÓ LEITURA. Nada aqui escreve no Omie, nas planilhas ou em arquivo nenhum.

import { abrirCacheOmie } from './cache-omie.mjs';
import { arquivosDoDfc, lerMesSemDerrubar, serieDeUmMes } from './dfc.mjs';
import { lerContas, lerRecorte } from './movimentos.mjs';
import { lerContratos } from './passivo.mjs';

// QUANTO CUSTOU PREPARAR, em milissegundos, separado por fonte. É o que `scripts/medir-filtros.mjs` publica em
// `docs/desempenho.md`: num clique que só calcula, os dois saem zero, e é isso que a medição prova. Só tempo entra
// aqui — nenhum número da empresa.
function novaBase({ raiz, ano, fonte }) {
  const gasto = { cacheOmie: 0, planilhas: 0 };
  let omie = null, recorte = null, contas = null, arquivos = null, serie = null, contratos = null;
  const meses = new Map();

  const base = {
    ano,
    preparadaEm: Date.now(),
    gasto,

    // A HORA EM QUE A PLANILHA FOI ABERTA DE VERDADE, e de que fonte — é a que o rodapé da tela mostra
    // (app/ultima-leitura.js). Num clique que só calcula ela não se move, porque ninguém abriu planilha nenhuma.
    // `enviadoEm` já nasce preenchido na fonte do servidor: a hora do último envio do PC aparece mesmo quando nenhum
    // mês abriu.
    dfcLido: { em: null, fonte: fonte?.nome ?? null, enviadoEm: fonte?.enviadoEm?.() ?? null },

    // QUAIS MESES DE PLANILHA ESTA BASE JÁ ABRIU. É o que a renovação da hora usa para aquecer a base nova com os
    // mesmos meses — nem mais, para não abrir arquivo que ninguém pediu, nem menos, para o clique seguinte não ter de
    // esperar por um mês que a velha já tinha.
    mesesLidos() { return [...meses.keys()]; },

    // O NOME CURTO DA FONTE DO DFC — a página diz de onde leu, e quem sabe isso é a fonte. Sai da base porque
    // as telas não recebem mais a fonte: elas recebem a base, que a tem dentro.
    nomeDaFonte: fonte?.nome ?? null,

    // O CACHE DO OMIE, aberto uma vez. É a mesma `abrirCacheOmie` de sempre, com a mesma chave de leitura: a base não
    // sabe ler o Omie, ela só guarda o que aquela função devolveu.
    cacheOmie() {
      if (!omie) {
        const t = performance.now();
        omie = abrirCacheOmie({ raiz, ano });
        gasto.cacheOmie += performance.now() - t;
      }
      return omie;
    },

    // O recorte da MeuBESS e as contas correntes dela — dois arquivos pequenos do próprio repositório, lidos uma vez.
    recorte() { return recorte ??= lerRecorte(raiz); },
    contas() { return contas ??= lerContas(raiz); },

    // A LISTA DE ARQUIVOS DA PASTA DO DFC, uma vez para todos os meses.
    arquivos() { return arquivos ??= arquivosDoDfc(fonte); },

    // A PLANILHA DE CONTRATOS do financeiro (bloco "Compromissos" da Tela 2), aberta uma vez, da MESMA pasta e pela
    // MESMA fonte do DFC: é um `.xlsx` a mais na pasta, com "contrato" no nome (`lib/regras/passivo.mjs`).
    contratos() {
      contratos ??= (async () => {
        const t = performance.now();
        try { return await lerContratos({ fonte, arquivos: await base.arquivos() }); }
        finally { gasto.planilhas += performance.now() - t; }
      })();
      return contratos;
    },

    // UM MÊS DE PLANILHA, aberto uma vez. A promessa é guardada, e não o resultado: duas telas pedindo o mesmo mês ao
    // mesmo tempo esperam a MESMA leitura em vez de abrirem o arquivo duas vezes.
    mes(m) {
      if (!meses.has(m)) meses.set(m, (async () => {
        const t = performance.now();
        try {
          const r = await lerMesSemDerrubar({ fonte, ano, mes: m, arquivos: await base.arquivos() });
          // `enviadoEm`: só a fonte do servidor tem — a hora em que o PC mandou os arquivos que foram abertos.
          if (r.ok) base.dfcLido = { em: new Date().toISOString(), fonte: fonte.nome, enviadoEm: fonte.enviadoEm?.() ?? null };
          return r;
        } finally { gasto.planilhas += performance.now() - t; }
      })());
      return meses.get(m);
    },

    // A SÉRIE DO ANO, dos doze meses já lidos — o bloco `Entradas`/`Gastos` de cada um, que é o que o gráfico de
    // "Receita × despesa por mês" desenha. Sai das mesmas leituras de mês, sem reabrir arquivo nenhum.
    serieDoAno() {
      serie ??= (async () => {
        const fora = [];
        for (let m = 1; m <= 12; m++) fora.push(serieDeUmMes(m, await base.mes(m)));
        return fora;
      })();
      return serie;
    },

    // O QUE AS TELAS PEDEM, com o retorno de `lerDfc` — o mesmo objeto, com as mesmas chaves.
    async dfc({ mes, comSerie = false }) {
      const r = await base.mes(mes);
      if (!r.ok) return r;
      return { ...r, serie: comSerie ? await base.serieDoAno() : [] };
    },
  };
  return base;
}

export { novaBase };
