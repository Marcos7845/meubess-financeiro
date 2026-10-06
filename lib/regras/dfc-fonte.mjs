// DE ONDE VÊM OS ARQUIVOS DO DFC — a interface, e as três implementações.
//
// POR QUE EXISTE. Hoje, neste computador, o DFC é uma biblioteca do SharePoint que o OneDrive espelha numa pasta
// local. Na Vercel não há pasta nenhuma: o app vai ler os mesmos arquivos pelo Microsoft Graph, com a conta da
// empresa. Quem lê a planilha (`dfc.mjs`) não sabe de nenhum dos dois — só chama esta interface. Trocar a fonte é
// escrever a outra implementação aqui e não tocar em mais nada.
//
// A INTERFACE — uma fonte de DFC é um objeto com:
//   nome        → string curta, para a página dizer de onde leu
//   descrever() → frase de uma linha para o motivo quando não dá para ler
//   arquivos()  → Promise<string[]>, os nomes dos .xlsx da pasta da MeuBESS ("01 - DFC - JAN2026.xlsx", …)
//   ler(nome)   → Promise<Buffer> com o arquivo inteiro
//
// NENHUM CAMINHO DE PASTA ENTRA NESTE ARQUIVO. A pasta é achada pelo formato do nome ("…2026") ou vem de `DFC_DIR`,
// porque o caminho real tem nome de pessoa e nome de pessoa não entra em arquivo versionado.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ultimoEnvio, lerDoEnvio } from './dfc-guardado.mjs';

// A pasta da MeuBESS é a que numera os arquivos ("01 - DFC - JAN2026"); as das outras unidades, não.
const PASTA_DO_ANO = /2026\s*(?:\(\d+\))?\s*$/;
const NUMERADO = /^\d{1,2}\s*-/;
const PROFUNDIDADE_MAXIMA = 6;
const UNIDADES = ['3N', 'B3N', 'B3W', 'N3'];
// Primeiro mês em que a unidade existe no DFC. A ausência anterior não é pendência.
const INICIO_DAS_UNIDADES = { '3N': '2026-01', B3N: '2026-01', B3W: '2026-01', N3: '2026-08' };
const PREFIXO = /^([^_]+)__(.+\.xlsx)$/i;
const unidadeDoCaminho = (caminho) => path.resolve(caminho).split(path.sep).reverse().find((p) => UNIDADES.includes(p.toUpperCase()))?.toUpperCase() ?? null;
const eMensal = (f) => /2026/i.test(f) && (/^(?:0?[1-9]|1[0-2])\s*-/.test(f) || /DFC.*(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i.test(f));

// Lê os .xlsx de uma pasta e devolve `{ caminho, arquivos, numerados }`, ou null se não houver nenhum numerado.
function examinarPasta(caminho) {
  let arquivos;
  try {
    arquivos = fs.readdirSync(/*turbopackIgnore: true*/ caminho).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
  } catch { return null; }
  const numerados = arquivos.filter(eMensal).length;
  return numerados ? { caminho, arquivos, numerados } : null;
}

// Desce pelas pastas (só os NOMES — nenhum arquivo é aberto) até `PROFUNDIDADE_MAXIMA` níveis e junta as que têm cara de
// pasta do ano e arquivos numerados. A ordem é a alfabética, para o resultado não depender do disco.
function candidatasEm(raiz) {
  const achadas = [];
  const descer = (pasta, nivel) => {
    let filhas;
    try { filhas = fs.readdirSync(/*turbopackIgnore: true*/ pasta, { withFileTypes: true }); } catch { return; }
    // O OneDrive expõe a biblioteca compartilhada como atalho (link simbólico ou ponto de junção): segue-se o atalho.
    const ePasta = (d) => {
      if (d.isDirectory()) return true;
      if (!d.isSymbolicLink()) return false;
      try { return fs.statSync(/*turbopackIgnore: true*/ path.join(pasta, d.name)).isDirectory(); } catch { return false; }
    };
    filhas = filhas.filter((d) => !d.name.startsWith('.') && ePasta(d)).sort((a, b) => a.name.localeCompare(b.name));
    for (const d of filhas) {
      const caminho = path.join(pasta, d.name);
      if (PASTA_DO_ANO.test(d.name)) { const e = examinarPasta(caminho); if (e) achadas.push(e); }
      if (nivel < PROFUNDIDADE_MAXIMA) descer(caminho, nivel + 1);
    }
  };
  descer(raiz, 1);
  return achadas;
}

// Entre as candidatas, vale a que numera mais planilhas; empate: a sem sufixo "(n)" (as cópias soltas o têm), depois o
// caminho em ordem alfabética.
function escolher(candidatas) {
  const copia = (c) => /\(\d+\)\s*$/.test(path.basename(c.caminho));
  return [...candidatas].sort((a, b) => b.numerados - a.numerados || copia(a) - copia(b) || a.caminho.localeCompare(b.caminho))[0] ?? null;
}

function escolherUnidades(candidatas) {
  const porUnidade = new Map();
  for (const unidade of UNIDADES) {
    const candidatasDaUnidade = candidatas.filter((c) => unidadeDoCaminho(c.caminho) === unidade);
    const escolhida = escolher(candidatasDaUnidade);
    if (escolhida) porUnidade.set(unidade, escolhida);
  }
  return porUnidade;
}

function acharPastas(raizes = [path.join(os.homedir(), 'Meu Bess'), path.join(os.homedir(), 'OneDrive')]) {
  if (process.env.DFC_DIR) {
    const direta = examinarPasta(process.env.DFC_DIR);
    const unidadeDireta = direta ? unidadeDoCaminho(direta.caminho) ?? 'B3W' : null;
    // O espelho local guarda os arquivos diretamente em <DFC_DIR>/<unidade>/.
    const espelho = new Map();
    for (const unidade of UNIDADES) {
      const pasta = examinarPasta(path.join(process.env.DFC_DIR, unidade))
        ?? (unidade === unidadeDireta ? direta : null);
      if (pasta) espelho.set(unidade, pasta);
    }
    if (espelho.size) return espelho;
    return escolherUnidades(candidatasEm(process.env.DFC_DIR));
  }
  for (const raiz of raizes) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ raiz)) continue;
    const pastas = escolherUnidades(candidatasEm(raiz));
    if (pastas.size) return pastas;
  }
  return new Map();
}

// `DFC_DIR`, quando existe, manda e não se procura em mais lugar nenhum (é assim que se evita tocar a pasta
// sincronizada). Sem ele, a busca é nas raízes `raizes`, na ordem, e a primeira que tiver candidata decide.
function acharPasta(raizes = [path.join(os.homedir(), 'Meu Bess'), path.join(os.homedir(), 'OneDrive')]) {
  if (process.env.DFC_DIR) return examinarPasta(process.env.DFC_DIR);
  for (const raiz of raizes) {
    // O `turbopackIgnore` só cala o aviso de build do Next: a pasta é FORA do projeto (fica na casa do
    // usuário), então não há nada do repositório para o bundler rastrear aqui. Na Vercel esta implementação nem
    // roda — lá a fonte é o Microsoft Graph, abaixo.
    if (!fs.existsSync(/*turbopackIgnore: true*/ raiz)) continue;
    const escolhida = escolher(candidatasEm(raiz));
    if (escolhida) return escolhida;
  }
  return null;
}

// HOJE, NESTE COMPUTADOR: a pasta que o OneDrive espelha.
function fonteDaPastaSincronizada() {
  let pastas = new Map(), erro = null;
  try { pastas = acharPastas(); } catch (e) { erro = e.message; }
  const arquivoDe = (nome) => {
    const m = PREFIXO.exec(nome);
    const unidade = m?.[1]?.toUpperCase() ?? 'B3W';
    const pasta = pastas.get(unidade);
    const arquivo = m?.[2] ?? nome;
    if (!pasta || !pasta.arquivos.includes(arquivo)) throw new Error('planilha fora da fonte selecionada');
    return path.join(pasta.caminho, arquivo);
  };
  return {
    nome: 'pasta sincronizada',
    descrever: () => (erro
      ? `não deu para alcançar a pasta do DFC: ${erro}`
      : 'não achei a pasta DFC/2026 da MeuBESS sincronizada (use `DFC_DIR=<caminho>`)'),
    disponivel: () => pastas.size > 0,
    // A pasta anual inteira, sem recorte pelo mês corrente: o envio e o espelho recebem os meses históricos.
    arquivos: async () => [...pastas].flatMap(([unidade, pasta]) => pasta.arquivos
      .slice().sort((a, b) => a.localeCompare(b)).map((nome) => `${unidade}__${nome}`)),
    ler: async (nome) => fs.readFileSync(arquivoDe(nome)),
    caminho: arquivoDe,
  };
}

// DEPOIS, NA VERCEL: os mesmos arquivos pelo Microsoft Graph.
// O QUE FALTA para ligar (tarefa de pôr no ar, não esta): token da conta da empresa (client credentials ou o token do
// próprio usuário logado), o id da biblioteca e da pasta, e então
//   arquivos() → GET /drives/{drive}/items/{pasta}/children  (filtrar `.xlsx`, devolver `name`)
//   ler(nome)  → GET /drives/{drive}/items/{pasta}:/{nome}:/content  (devolver o corpo como Buffer)
// O resto do código não muda: `dfc.mjs` já lê por esta interface.
function fonteDoMicrosoftGraph() {
  const naoLigada = 'a leitura do DFC pelo Microsoft Graph ainda não foi ligada (fica para a tarefa de pôr no ar)';
  return {
    nome: 'Microsoft Graph',
    descrever: () => naoLigada,
    disponivel: () => false,
    arquivos: async () => { throw new Error(naoLigada); },
    ler: async () => { throw new Error(naoLigada); },
  };
}

// NO SERVIDOR (Railway): o que o PC mandou por `/api/dfc` e ficou guardado no volume (`dfc-guardado.mjs`). São os
// mesmos bytes das planilhas, lidos no PC pela pasta sincronizada acima; `enviadoEm()` é a hora do envio, que as
// telas mostram no rodapé.
function fonteDoServidor() {
  const envio = ultimoEnvio();
  return {
    nome: 'enviado pelo PC',
    descrever: () => 'o PC ainda não mandou o DFC para este servidor (npm run financeiro-enviar-dfc)',
    disponivel: () => Boolean(envio),
    enviadoEm: () => envio?.em ?? null,
    arquivos: async () => (envio ? envio.arquivos.map((a) => a.nome) : []),
    ler: async (nome) => lerDoEnvio(envio, nome),
  };
}

// Qual usar: `DFC_FONTE=servidor` lê o que o PC mandou; `DFC_FONTE=graph` escolhe o Graph; sem nada, a pasta
// sincronizada deste computador, como sempre.
function fonteDoDfc() {
  if (process.env.DFC_FONTE === 'servidor') return fonteDoServidor();
  return process.env.DFC_FONTE === 'graph' ? fonteDoMicrosoftGraph() : fonteDaPastaSincronizada();
}

export { acharPasta, acharPastas, fonteDaPastaSincronizada, fonteDoMicrosoftGraph, fonteDoServidor, fonteDoDfc, UNIDADES, INICIO_DAS_UNIDADES };
