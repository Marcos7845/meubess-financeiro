// Diagnóstico de filtros do Omie: financas/mf ListarMovimentos, só leitura.
// Para cada filtro de data (formato dd/mm/aaaa, o único que o Omie aceita: aaaa-mm-dd volta erro Client-103) e para CP e CR separados, imprime apenas
// o número de páginas e de lançamentos. Nunca imprime valor, cliente, descrição, categoria nem a chave.
// Um filtro que o Omie ignora aparece com a mesma contagem da linha "sem filtro de data".
//
// Uso: node scripts/contar-omie-filtros.mjs AAAA-MM        (ex.: node scripts/contar-omie-filtros.mjs 2026-08)
// Credencial: OMIE_APP_KEY e OMIE_APP_SECRET no .env da raiz (fora do git). Node 21.7+, sem dependências.

const URL_OMIE = "https://app.omie.com.br/api/v1/financas/mf/";
const POR_PAGINA = 100;
const MAX_PAGINAS = 300;
const PAUSA_MS = 2500;
const TENTATIVAS = 4;

const mes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(process.argv[2] ?? "");
if (!mes) {
  console.log("ERRO: informe o mês como AAAA-MM (ex.: 2026-08)");
  process.exit(1);
}
const [, ano, mm] = mes;
const ultimo = String(new Date(Date.UTC(Number(ano), Number(mm), 0)).getUTCDate()).padStart(2, "0");

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  console.log("ERRO: arquivo .env não encontrado ou ilegível na raiz do repositório");
  process.exit(1);
}
const { OMIE_APP_KEY, OMIE_APP_SECRET } = process.env;
if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
  console.log("ERRO: OMIE_APP_KEY e OMIE_APP_SECRET precisam estar preenchidas no .env");
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
            app_key: OMIE_APP_KEY,
            app_secret: OMIE_APP_SECRET,
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
