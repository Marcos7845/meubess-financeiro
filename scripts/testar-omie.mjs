// Teste de leitura do Omie: financas/mf ListarMovimentos de um mês, todas as páginas.
// Só leitura. Imprime apenas se deu certo, o número de páginas e o de lançamentos —
// nunca valor, cliente, descrição, categoria nem a chave (nem em erro).
//
// Uso: node scripts/testar-omie.mjs AAAA-MM [chave=N]   (ex.: node scripts/testar-omie.mjs 2026-08)
// Credencial no .env da raiz (fora do git): por padrão o par OMIE_MEUBESS_2_APP_KEY / OMIE_MEUBESS_2_APP_SECRET, a chave
// das telas (filial /0002-23). chave=1 ou chave=3 lê o par OMIE_MEUBESS_1_… ou OMIE_MEUBESS_3_… no lugar.
// Node 21.7+, sem dependências.

const URL_OMIE = "https://app.omie.com.br/api/v1/financas/mf/";
const POR_PAGINA = 100;

const falhar = (msg) => {
  console.log(`ERRO: ${msg}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const mes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(args.find((a) => !a.startsWith("chave=")) ?? "");
if (!mes) falhar("informe o mês como AAAA-MM (ex.: 2026-08)");
const escolhida = args.find((a) => a.startsWith("chave="))?.slice(6);
if (escolhida !== undefined && !/^[123]$/.test(escolhida)) falhar("chave deve ser 1, 2 ou 3 (ex.: chave=1)");
// Nomes das variáveis; o padrão é a chave 2 e chave=N só troca o número
const VAR_CHAVE = "OMIE_MEUBESS_2_APP_KEY".replace("_2_", `_${escolhida ?? 2}_`);
const VAR_SEGREDO = "OMIE_MEUBESS_2_APP_SECRET".replace("_2_", `_${escolhida ?? 2}_`);
const [, ano, mm] = mes;
const ultimoDia = new Date(Date.UTC(Number(ano), Number(mm), 0)).getUTCDate();
const de = `01/${mm}/${ano}`;
const ate = `${String(ultimoDia).padStart(2, "0")}/${mm}/${ano}`;

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  falhar("arquivo .env não encontrado ou ilegível na raiz do repositório");
}
const APP_KEY = process.env[VAR_CHAVE];
const APP_SECRET = process.env[VAR_SEGREDO];
// só o NOME da variável que falta, nunca o valor
const faltam = [[VAR_CHAVE, APP_KEY], [VAR_SEGREDO, APP_SECRET]].filter(([, v]) => !v).map(([n]) => n);
if (faltam.length) falhar(`${faltam.join(" e ")} ${faltam.length > 1 ? "precisam" : "precisa"} estar preenchida${faltam.length > 1 ? "s" : ""} no .env`);

async function pagina(n) {
  const corpo = {
    call: "ListarMovimentos",
    app_key: APP_KEY,
    app_secret: APP_SECRET,
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
