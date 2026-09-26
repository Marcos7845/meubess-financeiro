// CONFERE AS TELAS CONTRA `docs/conferencia.md` e grava `docs/telas-conferidas.md`.
//
// O QUE ESTE TESTE FAZ. Monta a Tela 1 pela camada de dados do app — a mesma que o navegador recebe, com os mesmos
// filtros de `lib/regras/` — e compara, indicador por indicador, a CONTAGEM que ela usou com a contagem que
// `docs/conferencia.md` publica. Se o filtro da tela sair do que `docs/fontes.md` manda, a contagem muda e a linha
// sai "divergente:".
//
// POR QUE A CONTAGEM, E NÃO O VALOR. `docs/conferencia.md` não traz valor em dinheiro, de propósito, e este arquivo
// também não pode trazer. A contagem prende o filtro: dois filtros diferentes quase nunca pegam o mesmo número de
// lançamentos. O valor aparece só na tela, lido na hora.
//
// O LADO DE LÁ É O ARQUIVO, NÃO O CÓDIGO. Os números esperados são LIDOS do texto de `docs/conferencia.md`, que
// `scripts/numeros-das-telas.mjs` gerou antes. Se os dois lados saíssem da mesma função, o teste não provaria nada.
//
//   node scripts/conferir-telas.mjs                 # agosto de 2026
//   node scripts/conferir-telas.mjs --mes 7 --ano 2026

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFERENCIA = path.join(RAIZ, 'docs', 'conferencia.md');
const SAIDA = path.join(RAIZ, 'docs', 'telas-conferidas.md');

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));

// ================================================================ o lado da conferência
//
// Um extrator por indicador da Tela 1, escrito à mão contra o texto que `numeros-das-telas.mjs` produz. `dfc` e
// `omie` acham, cada um, o número daquele lado dentro do trecho "**Entram:** …" da linha.

const num = (s) => Number(String(s).replace(/\./g, ''));

const EXTRATORES = {
  saldo: { dfc: /^([\d.]+) linhas de lançamento baixado/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  receitas: { dfc: /^([\d.]+) linhas de entrada no mês/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  despesas: { dfc: /^([\d.]+) linhas de saída no mês, do lado do DFC/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  'despesas-pagas': { dfc: /^([\d.]+) linhas de saída com/, omie: /; ([\d.]+) lançamentos no Omie recortado/ },
  'despesas-pendentes': { dfc: null, omie: /^([\d.]+) títulos a pagar em aberto/ },
  'despesas-funcionarios': { dfc: /^([\d.]+) linhas de saída de pessoal/, omie: /; ([\d.]+) lançamentos pagos nas categorias de pessoal/ },
  'percentual-funcionarios': { dfc: /^([\d.]+) linhas de pessoal no mês/, omie: /os ([\d.]+) lançamentos de receita do mês/ },
  'top-10-despesas': { dfc: /^([\d.]+) linhas de saída no mês, em/, omie: /; ([\d.]+) lançamentos de despesa do mês/ },
  'top-10-receitas': { dfc: null, omie: /^([\d.]+) lançamentos de receita/ },
  'receita-despesa-por-dia': { dfc: /^([\d.]+) colunas de dia/, omie: /; ([\d.]+) lançamentos no mês/ },
  'receita-despesa-por-mes': { dfc: /^([\d.]+) dos \d+ meses/, omie: /; ([\d.]+) lançamentos na coluna do mês/ },
};

// Lê `docs/conferencia.md`: a ordem dos 36 indicadores e, de cada um, o trecho "**Entram:** …".
function lerConferencia() {
  if (!fs.existsSync(CONFERENCIA)) {
    console.error(`não achei ${CONFERENCIA}.\nRode antes: node scripts/numeros-das-telas.mjs`);
    process.exit(1);
  }
  const texto = fs.readFileSync(CONFERENCIA, 'utf8');
  const indicadores = [];
  for (const l of texto.split(/\r?\n/)) {
    const m = /^- (?:divergente: |a conferir: )?\*\*(Tela [123]) — (.+?)\.\*\* \*\*Entram:\*\* (.*?)(?: \*\*Fonte:\*\*|$)/.exec(l);
    if (m) indicadores.push({ tela: m[1], nome: m[2], entram: m[3] });
  }
  return indicadores;
}

// ================================================================ a conferência das telas

const tela1 = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const daTela = new Map([...tela1.cartoes, ...tela1.blocos].map((i) => [i.id, i]));
const doConferencia = lerConferencia();

if (doConferencia.length === 0) {
  console.error('não consegui ler nenhum indicador de docs/conferencia.md — o formato mudou?');
  process.exit(1);
}

// Casa o indicador da tela com a linha da conferência pelo nome que a conferência usa.
const NOME_NA_CONFERENCIA = {
  saldo: 'Saldo',
  receitas: 'Receitas',
  despesas: 'Despesas',
  'despesas-pagas': 'Despesas pagas',
  'despesas-pendentes': 'Despesas pendentes',
  'despesas-funcionarios': 'Despesas com funcionários',
  'percentual-funcionarios': '% desp. funcionários / receita líquida',
  'top-10-despesas': 'Top 10 despesas',
  'top-10-receitas': 'Top 10 receitas',
  'receita-despesa-por-dia': 'Receita × despesa por dia',
  'receita-despesa-por-mes': 'Receita × despesa por mês',
};
const idPorNome = new Map(Object.entries(NOME_NA_CONFERENCIA).map(([id, nome]) => [nome, id]));

const linhas = [];
for (const ind of doConferencia) {
  // Telas 2 e 3: ainda não há tela para comparar.
  if (ind.tela !== 'Tela 1') {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** tela ainda não construída.`);
    continue;
  }
  const id = idPorNome.get(ind.nome);
  const naTela = id ? daTela.get(id) : null;
  if (!naTela) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** a Tela 1 não mostra este indicador, e o teste não soube com o que comparar.`);
    continue;
  }
  const ex = EXTRATORES[id];
  const esperado = {
    dfc: ex.dfc ? (ex.dfc.exec(ind.entram) ? num(ex.dfc.exec(ind.entram)[1]) : null) : null,
    omie: ex.omie.exec(ind.entram) ? num(ex.omie.exec(ind.entram)[1]) : null,
  };
  const obtido = naTela.contagem;

  // Se o DFC não foi lido nesta rodada, o lado do DFC da tela é vazio: é "a conferir:", não divergência.
  if (!tela1.dfc.ok && esperado.dfc !== null) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** a fonte principal deste indicador é o DFC e as planilhas não foram lidas nesta rodada — ${tela1.dfc.motivo}.`);
    continue;
  }

  const partes = [], difs = [];
  for (const lado of ['dfc', 'omie']) {
    if (esperado[lado] === null) continue;
    if (obtido[lado] === null || obtido[lado] === undefined) {
      difs.push(`do lado do ${lado === 'dfc' ? 'DFC' : 'Omie'} a tela não produziu contagem, e a conferência diz ${esperado[lado]}`);
      continue;
    }
    partes.push(`${lado === 'dfc' ? 'DFC' : 'Omie'} ${obtido[lado]}`);
    if (obtido[lado] !== esperado[lado]) {
      difs.push(`do lado do ${lado === 'dfc' ? 'DFC' : 'Omie'} a tela conta ${obtido[lado]} e a conferência diz ${esperado[lado]}`);
    }
  }
  if (!partes.length && !difs.length) {
    linhas.push(`- a conferir: **${ind.tela} — ${ind.nome}.** **Motivo:** não achei na linha da conferência um número para comparar.`);
    continue;
  }
  const comum = `**${ind.tela} — ${ind.nome}.** **Na tela:** ${partes.join(' e ')}. **Na conferência:** ${['dfc', 'omie'].filter((l) => esperado[l] !== null).map((l) => `${l === 'dfc' ? 'DFC' : 'Omie'} ${esperado[l]}`).join(' e ')}. **Fonte:** ${naTela.fonte}.`;
  linhas.push(difs.length ? `- divergente: ${comum} **Motivo:** ${difs.join('; ')}.` : `- ${comum}`);
}

// ================================================================ a saída
//
// O resumo é contado nas PRÓPRIAS linhas que vão para o arquivo, pelo começo de cada uma — não por uma variável
// paralela, que poderia discordar do que está escrito.
const COMECO = { conferido: '- **', divergente: '- divergente: ', 'a-conferir': '- a conferir: ' };
const quantos = (e) => linhas.filter((l) => l.startsWith(COMECO[e])).length;
const nConferidos = quantos('conferido'), nDivergentes = quantos('divergente'), nAConferir = quantos('a-conferir');
if (nConferidos + nDivergentes + nAConferir !== linhas.length) {
  console.error('uma linha não começa com nenhuma das três marcas conhecidas — o formato quebrou');
  process.exit(1);
}

const md = `# As telas conferidas contra a conferência — ${NOMES_DOS_MESES[MES]} de ${ANO}

Gerado por [\`scripts/conferir-telas.mjs\`](../scripts/conferir-telas.mjs), só leitura. Uma linha por indicador das 3
telas. Para cada um, o número que **a tela mostra** e o número que **[\`docs/conferencia.md\`](conferencia.md) publica**
— e se os dois batem.

**O que é comparado é a CONTAGEM**, não o valor: quantos lançamentos entraram naquele indicador, de cada lado (o DFC e
o Omie). É o que prende o filtro — dois filtros diferentes quase nunca pegam o mesmo número de lançamentos. O valor em
reais aparece só na tela, lido na hora, e não entra nesta página nem em nenhum arquivo versionado.

Os números esperados são **lidos do texto** de [\`docs/conferencia.md\`](conferencia.md), gerado antes por
[\`scripts/numeros-das-telas.mjs\`](../scripts/numeros-das-telas.mjs). Os obtidos saem da **mesma camada de dados que o
navegador recebe** ([\`lib/indicadores/tela-1.mjs\`](../lib/indicadores/tela-1.mjs)), que filtra pelas regras de
[\`lib/regras/\`](../lib/regras/) — as mesmas que a conferência usa.

Linha que começa com **divergente:** quer dizer que os dois números não bateram; o motivo está no fim da linha. Linha
que começa com **a conferir:** quer dizer que não deu para comparar; o motivo está no fim da linha.

**${doConferencia.length} indicadores**: ${nConferidos} conferidos, ${nDivergentes} divergentes e ${nAConferir} a conferir.

As Telas 2 e 3 ainda não foram construídas — esta tarefa fez a Tela 1. Os indicadores delas aparecem abaixo, marcados
"a conferir:", para a lista continuar sendo a das 3 telas inteiras.

${tela1.dfc.ok
    ? `O DFC desta rodada saiu de **${tela1.dfc.fonte}**, arquivo \`${tela1.dfc.arquivo}\`, só para leitura.`
    : `O DFC **não foi lido** nesta rodada: ${tela1.dfc.motivo}.`}

## Os indicadores

${linhas.join('\n')}
`;

// A MESMA TRAVA DE `numeros-das-telas.mjs`: esta página não pode ganhar dinheiro nem nome de pessoa.
const PROIBIDO = [[/R\$/, 'a marca "R$"'], [/\b\d{1,3}(\.\d{3})*,\d{2}\b/, 'um número com centavos'], [/\b\d+,\d{2}\b/, 'um número com centavos']];
for (const [re, oque] of PROIBIDO) {
  const m = re.exec(md);
  if (m) { console.error(`a página ia sair com ${oque}: ${JSON.stringify(m[0])}`); process.exit(1); }
}

fs.writeFileSync(SAIDA, md);
console.log(`gravado ${path.relative(RAIZ, SAIDA)}`);
console.log(`${doConferencia.length} indicadores: ${nConferidos} conferidos, ${nDivergentes} divergentes, ${nAConferir} a conferir`);
for (const l of linhas.filter((x) => x.startsWith('- divergente: '))) console.log(`  ${l.slice(2, 160)}`);
if (nDivergentes) process.exit(1);
