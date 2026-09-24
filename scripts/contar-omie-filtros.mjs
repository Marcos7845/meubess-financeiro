// Diagnóstico de filtros do Omie: financas/mf ListarMovimentos, só leitura.
// Para cada filtro de data (formato dd/mm/aaaa, o único que o Omie aceita: aaaa-mm-dd volta erro Client-103) e para CP e CR separados, imprime apenas
// o número de páginas e de lançamentos. Nunca imprime valor, cliente, descrição, categoria nem a chave.
// Um filtro que o Omie ignora aparece com a mesma contagem da linha "sem filtro de data".
//
// Uso: node scripts/contar-omie-filtros.mjs AAAA-MM [chave=N]   (ex.: node scripts/contar-omie-filtros.mjs 2026-08)
// Credencial no .env da raiz (fora do git): por padrão o par OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET, a chave
// das telas (filial /0002-23). chave=1 ou chave=3 lê o par OMIE_MEUBESS_1_… ou OMIE_MEUBESS_3_… no lugar.
// Node 21.7+, sem dependências.

const URL_OMIE = "https://app.omie.com.br/api/v1/financas/mf/";
const POR_PAGINA = 100;
const MAX_PAGINAS = 300;
const PAUSA_MS = 2500;
const TENTATIVAS = 4;

const args = process.argv.slice(2);
const mes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(args.find((a) => !a.startsWith("chave=")) ?? "");
if (!mes) {
  console.log("ERRO: informe o mês como AAAA-MM (ex.: 2026-08)");
  process.exit(1);
}
const escolhida = args.find((a) => a.startsWith("chave="))?.slice(6);
if (escolhida !== undefined && !/^[123]$/.test(escolhida)) {
  console.log("ERRO: chave deve ser 1, 2 ou 3 (ex.: chave=1)");
  process.exit(1);
}
// Nomes das variáveis; o padrão é a chave 2 e chave=N só troca o número
const VAR_CHAVE = "OMIE_MEUBESS_2_APP_KEY".replace("_2_", `_${escolhida ?? 2}_`);
const VAR_SEGREDO = "OMIE_MEUBESS_2_APP_SECRET".replace("_2_", `_${escolhida ?? 2}_`);
const [, ano, mm] = mes;
const ultimo = String(new Date(Date.UTC(Number(ano), Number(mm), 0)).getUTCDate()).padStart(2, "0");

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  console.log("ERRO: arquivo .env não encontrado ou ilegível na raiz do repositório");
  process.exit(1);
}
const APP_KEY = process.env[VAR_CHAVE];
const APP_SECRET = process.env[VAR_SEGREDO];
// só o NOME da variável que falta, nunca o valor
const faltam = [[VAR_CHAVE, APP_KEY], [VAR_SEGREDO, APP_SECRET]].filter(([, v]) => !v).map(([n]) => n);
if (faltam.length) {
  console.log(`ERRO: ${faltam.join(" e ")} ${faltam.length > 1 ? "precisam" : "precisa"} estar preenchida${faltam.length > 1 ? "s" : ""} no .env`);
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Devolve { paginas, lancamentos } ou { erro } (código e mensagem do Omie, sem os dados enviados).
async function contar(filtro) {
  let paginas = 0;
  let lancamentos = 0;
  let total = 1;
  for (let n = 1; n <= total && n <= MAX_PAGINAS; n++) {
    let json;
    for (let t = 1; t <= TENTATIVAS; t++) {
      await dormir(PAUSA_MS * t);
      try {
        const resp = await fetch(URL_OMIE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call: "ListarMovimentos",
            app_key: APP_KEY,
            app_secret: APP_SECRET,
            param: [{ nPagina: n, nRegPorPagina: POR_PAGINA, ...filtro }],
          }),
        });
        json = await resp.json();
      } catch {
        return { erro: "sem resposta utilizável do Omie" };
      }
      // Client-1880: o Omie ainda processa a requisição anterior do método; espera e tenta de novo
      if (/Client-1880/.test(json.faultcode ?? "")) continue;
      // MISUSE_API_PROCESS: bloqueio temporário por excesso de chamadas; espera o tempo que o Omie pede
      // Client-6 (REDUNDANT): consumo redundante, o Omie também diz quantos segundos esperar
      if (json.faultcode === "MISUSE_API_PROCESS" || /Client-6$/.test(json.faultcode ?? "")) {
        const segundos = Number(/(?:em|Aguarde) (\d+) segundos/.exec(json.faultstring ?? "")?.[1]) || 60;
        console.log(`(Omie pediu pausa de ${segundos}s; aguardando)`);
        await dormir((segundos + 5) * 1000);
        continue;
      }
      break;
    }
    if (json.faultcode || json.faultstring) {
      // "Não existem registros" é resposta normal de consulta vazia
      if (/n[ãa]o existem registros/i.test(json.faultstring ?? "")) return { paginas, lancamentos };
      return { erro: `Omie ${json.faultcode ?? "?"}: ${json.faultstring ?? "?"}` };
    }
    total = Number(json.nTotPaginas) || 1;
    paginas++;
    lancamentos += Array.isArray(json.movimentos) ? json.movimentos.length : 0;
  }
  return { paginas, lancamentos, cortado: total > MAX_PAGINAS };
}

const f = (d, m, a) => `${d}/${m}/${a}`;
const filtrosData = [
  ["vencimento", "dDtVencDe", "dDtVencAte"],
  ["pagamento", "dDtPagtoDe", "dDtPagtoAte"],
  ["emissão", "dDtEmisDe", "dDtEmisAte"],
  ["registro", "dDtRegDe", "dDtRegAte"],
  ["previsão", "dDtPrevDe", "dDtPrevAte"],
];

const testes = [];
for (const tp of ["CP", "CR"]) {
  testes.push([`${tp} · sem filtro de data (tudo)`, { cTpLancamento: tp }]);
  for (const [nome, de, ate] of filtrosData) {
    testes.push([
      `${tp} · ${nome} ${ano}-${mm}`,
      { cTpLancamento: tp, [de]: f("01", mm, ano), [ate]: f(ultimo, mm, ano) },
    ]);
  }
  for (const [nome, de, ate] of filtrosData.slice(0, 2)) {
    testes.push([
      `${tp} · ${nome} 2026 inteiro`,
      { cTpLancamento: tp, [de]: f("01", "01", "2026"), [ate]: f("31", "12", "2026") },
    ]);
  }
}

console.log(`Limite: ${MAX_PAGINAS} páginas de ${POR_PAGINA} por consulta; datas no formato dd/mm/aaaa.`);
for (const [rotulo, filtro] of testes) {
  const r = await contar(filtro);
  console.log(r.erro ? `${rotulo}: ERRO ${r.erro}` : `${rotulo}: ${r.paginas} página(s), ${r.lancamentos} lançamento(s)${r.cortado ? " (cortado no limite de páginas)" : ""}`);
}
