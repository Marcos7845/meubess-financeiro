// DE ONDE VÊM OS ARQUIVOS DO DFC — a interface, e as duas implementações.
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

// A pasta da MeuBESS é a que numera os arquivos ("01 - DFC - JAN2026"); as das outras unidades, não.
function acharPasta() {
  const candidatas = [];
  if (process.env.DFC_DIR) candidatas.push(process.env.DFC_DIR);
  else {
    for (const raiz of [path.join(os.homedir(), 'Meu Bess'), path.join(os.homedir(), 'OneDrive')]) {
      // O `turbopackIgnore` só cala o aviso de build do Next: a pasta é FORA do projeto (fica na casa do
      // usuário), então não há nada do repositório para o bundler rastrear aqui. Na Vercel esta implementação nem
      // roda — lá a fonte é o Microsoft Graph, abaixo.
      if (!fs.existsSync(/*turbopackIgnore: true*/ raiz)) continue;
      for (const nome of fs.readdirSync(/*turbopackIgnore: true*/ raiz)) {
        if (!/2026\s*(?:\(\d+\))?\s*$/.test(nome)) continue;
        try { if (!fs.statSync(path.join(raiz, nome)).isDirectory()) continue; } catch { continue; }
        candidatas.push(path.join(raiz, nome));
      }
      if (candidatas.length) break;
    }
  }
  for (const c of candidatas) {
    const arqs = fs.readdirSync(c).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'));
    if (arqs.some((f) => /^\d{1,2}\s*-/.test(f))) return { caminho: c, arquivos: arqs };
  }
  return null;
}

// HOJE, NESTE COMPUTADOR: a pasta que o OneDrive espelha.
function fonteDaPastaSincronizada() {
  let pasta = null, erro = null;
  try { pasta = acharPasta(); } catch (e) { erro = e.message; }
  return {
    nome: 'pasta sincronizada',
    descrever: () => (erro
      ? `não deu para alcançar a pasta do DFC: ${erro}`
      : 'não achei a pasta DFC/2026 da MeuBESS sincronizada (use `DFC_DIR=<caminho>`)'),
    disponivel: () => Boolean(pasta),
    arquivos: async () => (pasta ? pasta.arquivos : []),
    ler: async (nome) => fs.readFileSync(path.join(pasta.caminho, nome)),
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

// Qual usar: `DFC_FONTE=graph` escolhe o Graph; sem isso, a pasta sincronizada.
function fonteDoDfc() {
  return process.env.DFC_FONTE === 'graph' ? fonteDoMicrosoftGraph() : fonteDaPastaSincronizada();
}

export { fonteDaPastaSincronizada, fonteDoMicrosoftGraph, fonteDoDfc };
