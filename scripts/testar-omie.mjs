// Teste de leitura do Omie: financas/mf ListarMovimentos de um mês, todas as páginas.
// Só leitura. Imprime apenas se deu certo, o número de páginas e o de lançamentos —
// nunca valor, cliente, descrição, categoria nem a chave (nem em erro).
//
// Uso: node scripts/testar-omie.mjs AAAA-MM        (ex.: node scripts/testar-omie.mjs 2026-08)
// Credencial: OMIE_APP_KEY e OMIE_APP_SECRET no .env da raiz (fora do git). Node 21.7+, sem dependências.

const URL_OMIE = "https://app.omie.com.br/api/v1/financas/mf/";
const POR_PAGINA = 100;

const falhar = (msg) => {
  console.log(`ERRO: ${msg}`);
  process.exit(1);
};

const mes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(process.argv[2] ?? "");
if (!mes) falhar("informe o mês como AAAA-MM (ex.: 2026-08)");
const [, ano, mm] = mes;
const ultimoDia = new Date(Date.UTC(Number(ano), Number(mm), 0)).getUTCDate();
const de = `01/${mm}/${ano}`;
const ate = `${String(ultimoDia).padStart(2, "0")}/${mm}/${ano}`;

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  falhar("arquivo .env não encontrado ou ilegível na raiz do repositório");
}
const { OMIE_APP_KEY, OMIE_APP_SECRET } = process.env;
if (!OMIE_APP_KEY || !OMIE_APP_SECRET) falhar("OMIE_APP_KEY e OMIE_APP_SECRET precisam estar preenchidas no .env");

async function pagina(n) {
  const corpo = {
    call: "ListarMovimentos",
    app_key: OMIE_APP_KEY,
    app_secret: OMIE_APP_SECRET,
    param: [{ nPagina: n, nRegPorPagina: POR_PAGINA, dDtVencDe: de, dDtVencAte: ate }],
  };
  let resp;
  try {
    resp = await fetch(URL_OMIE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    falhar("sem resposta do Omie (falha de rede)");
  }
  let json;
  try {
    json = await resp.json();
  } catch {
    falhar(`resposta do Omie não é JSON (HTTP ${resp.status})`);
  }
  if (json.faultcode || json.faultstring) {
    falhar(`Omie devolveu erro ${json.faultcode ?? "?"}: ${json.faultstring ?? "?"}`);
  }
  if (!resp.ok) falhar(`HTTP ${resp.status}`);
  return json;
}

let paginas = 0;
let lancamentos = 0;
let total = 1;
for (let n = 1; n <= total; n++) {
  const r = await pagina(n);
  total = Number(r.nTotPaginas) || 1;
  paginas++;
  lancamentos += Array.isArray(r.movimentos) ? r.movimentos.length : 0;
}

console.log(`OK ${ano}-${mm}: ${paginas} página(s), ${lancamentos} lançamento(s)`);
