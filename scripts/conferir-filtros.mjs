// CONFERE OS FILTROS DAS TRÊS TELAS, um caso real filtrado por filtro, e escreve o bloco de casos em
// `docs/filtros.md` e a página `docs/filtros.html`.
//
// O QUE ESTE TESTE FAZ, e por que não é o mesmo que `scripts/conferir-telas.mjs`. Aquele confere os NÚMEROS das telas
// com o filtro vazio, contra `docs/conferencia.md`. Este confere o que os filtros FAZEM: para cada filtro, escolhe um
// caso real, aplica o filtro pela mesma camada de dados que o navegador recebe, e reencontra o mesmo recorte na FONTE —
// os arquivos crus do cache do Omie, lidos aqui com `fs` e `JSON.parse`, sem passar pela montagem de
// `lib/regras/cache-omie.mjs`. Se o filtro pegar um lançamento a mais ou a menos do que a fonte manda, a linha sai
// "divergente:" e o script para com erro.
//
// SÓ CONTAGEM E CÓDIGO, nunca dinheiro e nunca nome. É a mesma regra de `docs/conferencia.md`: o caso real é citado
// pelo código do lançamento ou do título e pelos campos de cadastro que o filtro usou. A trava do fim recusa a escrita
// se aparecer a marca de real, um número com centavos ou um `data-codigo`.
//
//   node scripts/conferir-filtros.mjs
//   node scripts/conferir-filtros.mjs --mes 8 --ano 2026

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularTela3 } from '../lib/indicadores/tela-3.mjs';
import { abrirCacheOmie, pastaDoCacheOmie } from '../lib/regras/cache-omie.mjs';
import { lerRecorte, lerContas, criarRegras } from '../lib/regras/movimentos.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { norm, cent } from '../lib/regras/dfc.mjs';
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula, SUB2_SALDO, COLUNAS_DE_DATA, BAIXADO } from '../lib/regras/xlsx.mjs';
import { noMesDe, NOMES_DOS_MESES, dataBR, dois, ultimoDia } from '../lib/regras/periodo.mjs';
import { FAIXA_DO_STATUS } from '../lib/regras/listas.mjs';
import { centrosDeCusto, contasBancarias, SITUACOES } from '../lib/regras/filtros.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA_MD = path.join(RAIZ, 'docs', 'filtros.md');
const SAIDA_HTML = path.join(RAIZ, 'docs', 'filtros.html');
const MARCA_INICIO = '<!-- casos-conferidos:inicio -->';
const MARCA_FIM = '<!-- casos-conferidos:fim -->';

const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const EMPRESAS = ['1', '2'];

// ================================================================ a fonte, lida aqui pelo caminho mais curto
//
// Os arquivos crus do cache, achados pelo PREFIXO do nome e abertos um a um. Não é a montagem de `cache-omie.mjs`: é
// `fs.readdirSync` mais `JSON.parse`, para o lado da fonte não sair da mesma função que o lado do cálculo.

const CACHE = pastaDoCacheOmie(RAIZ);
const arquivosDoCache = fs.readdirSync(CACHE).filter((f) => f.endsWith('.json'));
const abrir = (f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8'));
const doPrefixo = (emp, pedaco) => arquivosDoCache.filter((f) => f.startsWith(`${emp}-${pedaco}`));

// O RATEIO POR DEPARTAMENTO, da fonte: os arquivos de `financas/mf` que TÊM `departamentos[]` no retorno são os da
// leitura com `cExibirDepartamentos: "S"` — a única que traz rateio. Achados por isso, e não pela chave da consulta.
function rateioDaFonte(emp) {
  const mapa = new Map();
  for (const f of doPrefixo(emp, 'financas-mf-ListarMovimentos')) {
    const j = abrir(f);
    if (!(j.movimentos ?? []).some((m) => Array.isArray(m.departamentos))) continue;
    for (const m of j.movimentos ?? []) {
      const d = m.detalhes ?? {};
      mapa.set(`${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`, m.departamentos ?? []);
    }
  }
  return mapa;
}

// DE QUAL EMPRESA É CADA LANÇAMENTO, da fonte: pelo ARQUIVO em que ele está. O nome de cada arquivo do cache começa
// com a empresa (`1-` ou `2-`), porque a chave da leitura é a própria pergunta — empresa + serviço + método + sha dos
// parâmetros (`lib/regras/cache-omie.mjs`). Então a empresa de um lançamento, vista pela fonte, é o prefixo do arquivo
// onde ele aparece; nada aqui pergunta ao cálculo. A identidade é a mesma trinca do rateio (`nCodMovCC` + `nCodTitulo`
// + `cGrupo`), e ela não se repete entre as duas empresas — o que este mapa também mede, em `ambas`.
function empresaDaFonte() {
  const mapa = new Map();
  for (const emp of EMPRESAS) {
    for (const f of doPrefixo(emp, 'financas-mf-ListarMovimentos')) {
      for (const m of abrir(f).movimentos ?? []) {
        const d = m.detalhes ?? {};
        const k = `${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`;
        if (!mapa.has(k)) mapa.set(k, new Set());
        mapa.get(k).add(emp);
      }
    }
  }
  const ambas = [...mapa.values()].filter((x) => x.size > 1).length;
  return { mapa, ambas, so: (k, emp) => { const x = mapa.get(k); return Boolean(x) && x.size === 1 && x.has(emp); } };
}

// A CONTA CORRENTE E O CLIENTE/FORNECEDOR DE CADA LANÇAMENTO, da fonte: os mesmos arquivos crus de `financas/mf`,
// lidos aqui com `fs` e `JSON.parse`. O `nCodCC` é o campo do filtro de conta bancária e o `nCodCliente`, o do filtro
// de cliente/fornecedor — os dois saem do arquivo, e não da montagem de `lib/regras/cache-omie.mjs`. A identidade é a
// mesma trinca do rateio (`nCodMovCC` + `nCodTitulo` + `cGrupo`).
function camposDaFonte(emp) {
  const mapa = new Map();
  for (const f of doPrefixo(emp, 'financas-mf-ListarMovimentos')) {
    for (const m of abrir(f).movimentos ?? []) {
      const d = m.detalhes ?? {};
      const k = `${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`;
      if (!mapa.has(k)) mapa.set(k, { nCodCC: String(d.nCodCC ?? ''), nCodCliente: String(d.nCodCliente ?? '') });
    }
  }
  return mapa;
}

// OS TÍTULOS A PAGAR POR VENCIMENTO, da fonte: a leitura `cTpLancamento: "CP"`, que é de onde sai o cartão
// "Desp. Pendentes". Ela é achada pela CHAVE EXATA da consulta — e não pelo prefixo do arquivo —, porque o prefixo
// `financas-mf-ListarMovimentos` serve a três leituras diferentes (a de caixa, a de caixa com departamentos e esta), e
// misturá-las trocaria um título a pagar por um lançamento de caixa com a mesma identidade.
function pendentesDaFonte(emp) {
  const fora = [];
  for (let n = 1; ; n++) {
    const arq = OMIE.arqCache(emp, 'financas/mf', 'ListarMovimentos', OMIE.leituras.CP_VENC(n));
    if (!fs.existsSync(arq)) break;
    const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
    for (const m of j.movimentos ?? []) fora.push({ ...(m.detalhes ?? {}), _resumo: m.resumo ?? {} });
    if (n >= (Number(j.nTotPaginas) || 1)) break;
  }
  return fora;
}

// AS LINHAS DO `FLUXO DE CAIXA` DO MÊS, DA FONTE: a planilha reaberta AQUI, com o mesmo recorte de linha das telas
// (sem as linhas de saldo, sem as de valor zero, só as já baixadas e com data no mês do arquivo) escrito de novo neste
// arquivo, e não chamado de `lib/regras/dfc.mjs`. É o lado da fonte dos dois filtros novos que alcançam o DFC: a
// `CLASS. CONTABIL` (a ponta do DFC da categoria) e a coluna `PAGAMENTO` (a situação).
async function linhasDoDfcDaFonte(fonte, ano, mes) {
  const nomes = await fonte.arquivos();
  const arq = nomes.find((f) => new RegExp(`^0?${mes}\\s*-`).test(f));
  if (!arq) return null;
  const zip = lerZip(await fonte.ler(arq));
  const ss = sharedStrings(zip);
  const aba = abasDo(zip).find((a) => norm(a.nome) === 'FLUXO DE CAIXA');
  if (!aba) return null;
  const fora = [];
  let mapa = null;
  for (const l of lerAba(zip, aba.parte, ss)) {
    const textos = [...l.cel.entries()].filter(([, c]) => c.t);
    const rotulos = textos.map(([, c]) => norm(c.t));
    if (rotulos.includes('VENCIMENTO') && rotulos.includes('DIA PG')) { mapa = new Map(textos.map(([col, c]) => [norm(c.t), col])); continue; }
    if (!mapa) continue;
    const texto = (r) => { const c = l.cel.get(mapa.get(r)); return c?.t ? c.t.trim() : ''; };
    const numero = (r) => { const c = l.cel.get(mapa.get(r)); return c?.v !== undefined ? c.v : 0; };
    const sub2 = norm(texto('SUB 2'));
    if (SUB2_SALDO.has(sub2)) continue;
    const k = numero('ENTRADA'), v = numero('SAIDA');
    const bruto = cent(k) !== 0 ? k : v;
    if (cent(bruto) === 0) continue;
    const pagamento = norm(texto('PAGAMENTO'));
    if (!BAIXADO(pagamento)) continue;
    let dt = null;
    for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(mapa.get(rot))); if (dt) break; }
    if (!dt || dt.a !== ano || dt.m !== mes) continue;
    fora.push({ arquivo: arq, linha: l.n, classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: sub2 || '(vazio)', pagamento });
  }
  return { arquivo: arq, linhas: fora };
}

// O CADASTRO DE DEPARTAMENTOS, da fonte.
function departamentosDaFonte(emp) {
  const m = new Map();
  for (const f of doPrefixo(emp, 'geral-departamentos')) {
    for (const d of abrir(f).departamentos ?? []) m.set(String(d.codigo), String(d.descricao ?? '').trim());
  }
  return m;
}

// OS TÍTULOS A RECEBER, da fonte: a união de todas as janelas de `PesquisarLancamentos` que o cache tem, um título por
// `nCodTitulo`. É o conjunto de onde a Tela 3 recorta, visto pelo outro lado. O `cNatureza: "R"` do próprio
// `cabecTitulo` separa os títulos A RECEBER dos A PAGAR — o cache guarda as duas naturezas no mesmo serviço, e a Tela 3
// é só a carteira a receber (`docs/fontes.md`).
function titulosDaFonte(emp) {
  const m = new Map();
  for (const f of doPrefixo(emp, 'financas-pesquisartitulos-PesquisarLancamentos')) {
    for (const t of abrir(f).titulosEncontrados ?? []) {
      if (String(t.cabecTitulo?.cNatureza ?? '') !== 'R') continue;
      m.set(String(t.cabecTitulo?.nCodTitulo), t);
    }
  }
  return m;
}

// ================================================================ as linhas do relatório

const linhas = [];
const num = (n) => new Intl.NumberFormat('pt-BR').format(n);

function conferir({ tela, filtro, onde, caso, naTela, naFonte, comoNaFonte }) {
  const bate = naTela === naFonte;
  linhas.push({
    estado: bate ? 'conferido' : 'divergente',
    tela, filtro, onde, caso, naTela, naFonte, comoNaFonte,
  });
  return bate;
}

// ================================================================ Tela 1 — centro de custo
//
// O FILTRO É O RATEIO. A base do mês (os três baldes de `lib/regras/movimentos.mjs`) é a mesma que
// `docs/conferencia.md` já confere; o que este caso confere é o RECORTE que o filtro faz por cima dela — lançamento por
// lançamento, contra o `departamentos[]` que está no arquivo cru do cache.

const OMIE = abrirCacheOmie({ raiz: RAIZ, ano: ANO });
const recorte = lerRecorte(RAIZ);
const noMes = noMesDe(ANO, MES);
const centros = centrosDeCusto(OMIE.departamentos);

const rateioFonte = Object.fromEntries(EMPRESAS.map((emp) => [emp, rateioDaFonte(emp)]));
const depFonte = Object.fromEntries(EMPRESAS.map((emp) => [emp, departamentosDaFonte(emp)]));
const chaveDoMov = (d) => `${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`;

// A base do mês, sem filtro nenhum, pelas regras de sempre.
const { contar } = criarRegras({ movimentos: OMIE.movimentos, categorias: OMIE.categorias, recorte });
const baseDoMes = EMPRESAS.flatMap((emp) => [...contar(emp, noMes, 'R').todos, ...contar(emp, noMes, 'P').todos]
  .map((d) => ({ emp, d })));

// Quantos lançamentos da base caem em cada nome de departamento, CONTADO NA FONTE: os códigos vêm do cadastro cru e o
// rateio, do arquivo cru. Um lançamento rateado em dois nomes conta em cada um deles.
const naFontePorNome = new Map(centros.map((c) => [c.nome, 0]));
let semRateioNaFonte = 0;
const exemploPorNome = new Map();
for (const { emp, d } of baseDoMes) {
  const deps = rateioFonte[emp].get(chaveDoMov(d)) ?? [];
  if (!deps.length) { semRateioNaFonte++; continue; }
  const nomes = new Set(deps.map((x) => depFonte[emp].get(String(x.cCodDepartamento))).filter(Boolean));
  for (const nome of nomes) {
    naFontePorNome.set(nome, (naFontePorNome.get(nome) ?? 0) + 1);
    if (!exemploPorNome.has(nome)) {
      const linha = deps.find((x) => depFonte[emp].get(String(x.cCodDepartamento)) === nome);
      exemploPorNome.set(nome, {
        emp, grupo: d.cGrupo, titulo: String(d.nCodTitulo ?? '0'), mov: String(d.nCodMovCC ?? '0'),
        categoria: String(d.cCodCateg ?? ''), cCodDepartamento: String(linha.cCodDepartamento),
        percentual: Number(linha.nDistrPercentual ?? 0), partes: deps.length,
      });
    }
  }
}

// O CENTRO DE CUSTO DO CASO: o que tem mais lançamentos no mês, para o caso real não ser um nome vazio. Empate
// desempata pelo nome, para o caso ser o mesmo em duas rodadas iguais.
const escolhido = [...naFontePorNome.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0];

const t1Sem = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const t1Com = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { cc: [escolhido] } });
const t1Todos = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { cc: centros.map((c) => c.nome) } });
const omieDoSaldo = (t) => t.cartoes.find((c) => c.id === 'saldo').contagem.omie;
const ex = exemploPorNome.get(escolhido);

conferir({
  tela: 'Tela 1',
  filtro: `centro de custo = ${escolhido}`,
  onde: 'os 7 cartões (a contagem do Omie de cada um), o "Top 10 despesas" e os dois gráficos de receita × despesa (a contagem do Omie) e o "Top 10 receitas" inteiro, que é do Omie',
  caso: `o lançamento do grupo \`${ex.grupo}\` da empresa ${ex.emp}, ${ex.titulo !== '0' ? `título \`${ex.titulo}\`` : `movimento de conta corrente \`${ex.mov}\``}, categoria \`${ex.categoria}\`: no arquivo cru do cache ele tem \`cCodDepartamento\` \`${ex.cCodDepartamento}\`, que o cadastro \`geral/departamentos\` da empresa ${ex.emp} chama de ${escolhido}, com \`nDistrPercentual\` ${ex.percentual} em ${ex.partes} ${ex.partes === 1 ? 'linha de rateio' : 'linhas de rateio'}`,
  naTela: omieDoSaldo(t1Com),
  naFonte: naFontePorNome.get(escolhido),
  comoNaFonte: `contados um a um na base do mês pelo \`departamentos[]\` que está nos arquivos crus de \`financas/mf\` com \`cExibirDepartamentos: "S"\`, casando o \`cCodDepartamento\` de cada empresa com o nome ${escolhido} pelo cadastro cru \`geral/departamentos\``,
});

// A SEGUNDA CONFERÊNCIA DO MESMO FILTRO, e a que fecha a porta do "quase certo": escolhendo TODOS os nomes, a tela tem
// de mostrar a base do mês menos os lançamentos sem rateio — que não têm nome para juntar e ficam fora de qualquer
// escolha (`docs/fontes.md`, "3. Departamentos").
conferir({
  tela: 'Tela 1',
  filtro: `centro de custo = os ${centros.length} nomes de uma vez`,
  onde: 'os mesmos cartões e blocos; é a conferência do conjunto, e não de um nome',
  caso: `a base do mês tem ${num(omieDoSaldo(t1Sem))} lançamentos e ${num(semRateioNaFonte)} deles não têm nenhuma linha de rateio nos arquivos crus: escolhendo os ${centros.length} nomes, sobram ${num(omieDoSaldo(t1Sem) - semRateioNaFonte)}`,
  naTela: omieDoSaldo(t1Todos),
  naFonte: omieDoSaldo(t1Sem) - semRateioNaFonte,
  comoNaFonte: 'a base do mês menos os lançamentos cujo `departamentos[]` vem vazio no arquivo cru — contados aqui, um a um',
});

// ================================================================ Telas 1, 2 e 3 — o filtro de empresa
//
// O FILTRO QUE AS TRÊS TELAS DIVIDEM (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas. A FONTE dele é o
// ARQUIVO do cache em que cada lançamento está — o nome do arquivo começa com a empresa —, e é por aí que cada um dos
// três casos reconta o recorte sem perguntar ao cálculo de que empresa é o lançamento.
//
// ONDE ELE NÃO VALE: em todo número que vem do DFC, porque o de-para da coluna `EMP.` (`B3W` / `N3`) com as filiais do
// Omie NÃO FECHA — `scripts/de-para-empresa-dfc.mjs` casou 565 linhas `B3W` só com a empresa 1 e 481 só com a empresa 2
// (`docs/fontes.md`). Por isso os casos conferem a contagem do OMIE: é a que o filtro alcança.

const EMPRESA_DO_CASO = '2';
const daFonte = empresaDaFonte();

const t1Emp = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { empresa: [EMPRESA_DO_CASO] } });
// A base do mês, recontada pela FONTE: cada lançamento vale pela empresa do arquivo em que ele está.
const daEmpresaNaFonte = (emp) => baseDoMes.filter(({ d }) => daFonte.so(chaveDoMov(d), emp)).length;
const t1PorEmpresa = EMPRESAS.map((emp) => daEmpresaNaFonte(emp));

conferir({
  tela: 'Tela 1',
  filtro: `empresa = ${EMPRESA_DO_CASO}`,
  onde: 'a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro (que é do Omie) e o cartão "Desp. Pendentes" inteiro, que sai dos títulos a pagar por vencimento',
  caso: `a base do mês tem ${num(omieDoSaldo(t1Sem))} lançamentos, e nos arquivos crus do cache ${num(t1PorEmpresa[0])} deles só aparecem em arquivo da empresa 1 e ${num(t1PorEmpresa[1])} só em arquivo da empresa 2 — ${daFonte.ambas} das ${num(daFonte.mapa.size)} identidades lidas aparecem nos arquivos das duas, então o arquivo diz a empresa sem ambiguidade. Os números do DFC não são recortados por este filtro, e cada cartão de fonte DFC diz isso na tela: o de-para de \`EMP.\` não fecha`,
  naTela: omieDoSaldo(t1Emp),
  naFonte: daEmpresaNaFonte(EMPRESA_DO_CASO),
  comoNaFonte: `os lançamentos da base do mês que só aparecem em arquivo \`${EMPRESA_DO_CASO}-financas-mf-ListarMovimentos…\` do cache, contados aqui um a um pela identidade \`nCodMovCC\` + \`nCodTitulo\` + \`cGrupo\``,
});

// ================================================================ Tela 2 — vários meses de uma vez
//
// DOIS CASOS, e o primeiro amarra o filtro em `docs/conferencia.md`. Escolher SÓ o mês conferido tem de dar, indicador
// por indicador, o mesmo que a tela sem filtro dá naquele mês — e esse é o número que `scripts/conferir-telas.mjs` já
// compara com o arquivo. O segundo caso é a soma: dois meses escolhidos são a soma dos dois meses sozinhos.

const t2Sem = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc() });
const t2So = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { meses: [MES] } });
const MES_ANTES = t2Sem.filtros.meses.opcoes.filter((m) => m < MES).pop() ?? null;
const t2Antes = MES_ANTES ? await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES_ANTES, fonte: fonteDoDfc() }) : null;
const t2Dois = MES_ANTES
  ? await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { meses: [MES_ANTES, MES] } })
  : null;

const indicadoresT2 = (t) => [...t.cartoes, ...t.tabela];
const contagensIguais = (a, b) => indicadoresT2(a).every((i) => {
  const j = indicadoresT2(b).find((x) => x.id === i.id);
  return j && i.contagem.dfc === j.contagem.dfc && i.contagem.omie === j.contagem.omie;
});

conferir({
  tela: 'Tela 2',
  filtro: `meses = só ${NOMES_DOS_MESES[MES]}`,
  onde: 'os 5 cartões do topo, as 12 linhas da tabela e a coluna Total — a tela inteira é por mês',
  caso: `os ${indicadoresT2(t2So).length} indicadores da tela com o filtro em ${NOMES_DOS_MESES[MES]} sozinho batem, um a um, com os mesmos ${indicadoresT2(t2Sem).length} da tela sem filtro no mesmo mês — que são os que \`docs/conferencia.md\` publica e \`scripts/conferir-telas.mjs\` confere contra o arquivo`,
  naTela: indicadoresT2(t2So).filter((i) => {
    const j = indicadoresT2(t2Sem).find((x) => x.id === i.id);
    return j && i.contagem.dfc === j.contagem.dfc && i.contagem.omie === j.contagem.omie;
  }).length,
  naFonte: indicadoresT2(t2Sem).length,
  comoNaFonte: `a tela sem filtro em ${NOMES_DOS_MESES[MES]}, que é a que \`docs/conferencia.md\` confere indicador por indicador`,
});

if (t2Dois) {
  const soma = (t, id, lado) => indicadoresT2(t).find((x) => x.id === id).contagem[lado] ?? 0;
  const ids = indicadoresT2(t2Dois).map((i) => i.id);
  const somaBate = ids.filter((id) => ['dfc', 'omie'].every((lado) =>
    soma(t2Dois, id, lado) === soma(t2Antes, id, lado) + soma(t2So, id, lado)
    || indicadoresT2(t2Dois).find((x) => x.id === id).contagem[lado] === null)).length;
  conferir({
    tela: 'Tela 2',
    filtro: `meses = ${NOMES_DOS_MESES[MES_ANTES]} e ${NOMES_DOS_MESES[MES]}`,
    onde: 'os mesmos cartões, linhas e a coluna Total, que passa a ser o total dos dois meses',
    caso: `a coluna de ${NOMES_DOS_MESES[MES_ANTES]} tem ${num(t2Antes.cobertura.find((c) => c.mes === MES_ANTES).omie)} lançamentos do Omie e a de ${NOMES_DOS_MESES[MES]}, ${num(t2Sem.cobertura.find((c) => c.mes === MES).omie)}; com os dois meses escolhidos a tela mostra ${num(t2Dois.cobertura.reduce((s, c) => s + c.omie, 0))}, e os ${ids.length} indicadores somam os dois meses um a um. As duas contagens de cadastro do DRE não somam, de propósito, e a linha "(=) Receita bruta" diz isso na tela`,
    naTela: somaBate,
    naFonte: ids.length,
    comoNaFonte: `cada mês calculado sozinho, sem filtro, e somado aqui — ${NOMES_DOS_MESES[MES]} é o mês que \`docs/conferencia.md\` publica`,
  });
}

// ================================================================ Tela 2 — o filtro de empresa
//
// NA TELA 2 A PROVA É A SOMA: a tela é a soma das duas filiais, então escolher a empresa 1 e escolher a empresa 2 têm
// de somar, indicador por indicador, o que a tela sem filtro mostra — e o lado do DFC tem de ficar PARADO nos três,
// porque ele não se recorta por empresa. Se o filtro deixar um lançamento de fora ou contá-lo duas vezes, a soma quebra.

const t2Emp1 = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { empresa: ['1'] } });
const t2Emp2 = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { empresa: ['2'] } });
const idsT2 = indicadoresT2(t2Sem).map((i) => i.id);
const contagemDe = (t, id) => indicadoresT2(t).find((x) => x.id === id).contagem;
const somaPorEmpresa = idsT2.filter((id) => {
  const sem = contagemDe(t2Sem, id), e1 = contagemDe(t2Emp1, id), e2 = contagemDe(t2Emp2, id);
  const omieBate = (sem.omie ?? 0) === (e1.omie ?? 0) + (e2.omie ?? 0);
  const dfcParado = sem.dfc === e1.dfc && sem.dfc === e2.dfc;
  return omieBate && dfcParado;
}).length;
const omieDoMes = (t) => t.cobertura.find((c) => c.mes === MES).omie;

conferir({
  tela: 'Tela 2',
  filtro: 'empresa = 1 e empresa = 2, somadas',
  onde: 'as linhas e os cartões de fonte Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "(=) sem conta" — e toda contagem do Omie da tela',
  caso: `a coluna de ${NOMES_DOS_MESES[MES]} tem ${num(omieDoMes(t2Sem))} lançamentos do Omie sem filtro, ${num(omieDoMes(t2Emp1))} com a empresa 1 e ${num(omieDoMes(t2Emp2))} com a empresa 2; os ${idsT2.length} indicadores somam as duas empresas um a um, e a contagem do DFC de cada um fica igual nas três telas — é o filtro não alcançando o DFC, como \`docs/filtros.md\` diz`,
  naTela: somaPorEmpresa,
  naFonte: idsT2.length,
  comoNaFonte: 'cada empresa calculada sozinha e somada aqui, indicador por indicador, contra a tela sem filtro — e a contagem do DFC conferida parada nas três',
});

// ================================================================ Tela 3 — vencimento, status, cliente, categoria
//
// AQUI A FONTE É INTEIRA. Os quatro filtros são campos da própria consulta, e o mesmo recorte se refaz aqui sobre os
// arquivos crus de `PesquisarLancamentos`: recorte da MeuBESS pelo `nCodCC`, vencimento na janela, `CANCELADO` fora, e
// então o filtro. Cada caso compara a contagem da tela com a contagem refeita na fonte.

const tituloFonte = Object.fromEntries(EMPRESAS.map((emp) => [emp, titulosDaFonte(emp)]));
const ordemDe = (s) => { const d = dataBR(s); return d ? d.a * 10000 + d.m * 100 + d.d : null; };

// O conjunto da fonte para uma janela, já sem os `CANCELADO`.
function daFonteNaJanela(de, ate) {
  const oDe = ordemDe(de), oAte = ordemDe(ate);
  return EMPRESAS.flatMap((emp) => [...tituloFonte[emp].values()]
    .filter((t) => {
      const c = t.cabecTitulo ?? {};
      const o = ordemDe(c.dDtVenc);
      return recorte.has(`${emp}|${c.nCodCC}`) && o !== null && o >= oDe && o <= oAte
        && FAIXA_DO_STATUS(c.cStatus) !== 'fora';
    })
    .map((t) => ({ emp, cab: t.cabecTitulo ?? {}, faixa: FAIXA_DO_STATUS(t.cabecTitulo?.cStatus) })));
}

const previsto = (t) => t.cartoes.find((c) => c.id === 'valor-previsto').contagem.omie;

// --- 1. vencimento de–até: uma janela que não é o mês, para o filtro ter o que provar.
const VENC_DE = `01/${dois(Math.max(1, MES - 1))}/${ANO}`;
const VENC_ATE = `${ultimoDia(ANO, MES)}/${dois(MES)}/${ANO}`;
const t3Venc = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, filtro: { de: VENC_DE, ate: VENC_ATE } });
const naFonteVenc = daFonteNaJanela(VENC_DE, VENC_ATE);
conferir({
  tela: 'Tela 3',
  filtro: `vencimento de ${VENC_DE} a ${VENC_ATE}`,
  onde: 'os 4 cartões, o gráfico por cliente e status, a lista de títulos e a rosca por status',
  caso: `a janela pega ${num(naFonteVenc.length)} títulos nos arquivos crus, e o mais antigo deles é o título \`${[...naFonteVenc].sort((a, b) => ordemDe(a.cab.dDtVenc) - ordemDe(b.cab.dDtVenc))[0].cab.nCodTitulo}\` da empresa ${[...naFonteVenc].sort((a, b) => ordemDe(a.cab.dDtVenc) - ordemDe(b.cab.dDtVenc))[0].emp}, com vencimento ${[...naFonteVenc].sort((a, b) => ordemDe(a.cab.dDtVenc) - ordemDe(b.cab.dDtVenc))[0].cab.dDtVenc} e \`cStatus\` \`${[...naFonteVenc].sort((a, b) => ordemDe(a.cab.dDtVenc) - ordemDe(b.cab.dDtVenc))[0].cab.cStatus}\``,
  naTela: previsto(t3Venc),
  naFonte: naFonteVenc.length,
  comoNaFonte: 'os `titulosEncontrados` dos arquivos crus de `financas/pesquisartitulos`, recortados aqui pelo `nCodCC` da MeuBESS, pelo `dDtVenc` na janela e sem os `CANCELADO`',
});

// --- 2. status: a faixa com mais títulos no mês.
const naFonteMes = daFonteNaJanela(`01/${dois(MES)}/${ANO}`, `${ultimoDia(ANO, MES)}/${dois(MES)}/${ANO}`);
const porFaixa = ['pago', 'atrasado', 'aberto'].map((f) => [f, naFonteMes.filter((x) => x.faixa === f).length]);
const faixaEscolhida = [...porFaixa].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
const t3Status = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, filtro: { status: faixaEscolhida } });
const umDaFaixa = naFonteMes.find((x) => x.faixa === faixaEscolhida);
conferir({
  tela: 'Tela 3',
  filtro: `status = ${faixaEscolhida === 'aberto' ? 'em aberto' : faixaEscolhida}`,
  onde: 'os 4 cartões, os 4 blocos — inclusive o gráfico por mês e status, que é o único que a janela de vencimento não alcança',
  caso: `o título \`${umDaFaixa.cab.nCodTitulo}\` da empresa ${umDaFaixa.emp} tem \`cStatus\` \`${umDaFaixa.cab.cStatus}\` no arquivo cru, que o de-para do dono (25/09/2026) põe na faixa ${faixaEscolhida === 'aberto' ? 'em aberto' : faixaEscolhida}; as três faixas do mês são ${porFaixa.map(([f, n]) => `${f === 'aberto' ? 'em aberto' : f} ${num(n)}`).join(', ')}`,
  naTela: previsto(t3Status),
  naFonte: naFonteMes.filter((x) => x.faixa === faixaEscolhida).length,
  comoNaFonte: 'o mesmo conjunto cru do caso acima, recortado aqui pela faixa do `cStatus` de cada título, pelo de-para de `lib/regras/listas.mjs`',
});

// --- 3. cliente: o que tem mais títulos no mês. O NOME NÃO ENTRA — só o código e a empresa.
const porCliente = new Map();
for (const x of naFonteMes) {
  const k = `${x.emp}-${x.cab.nCodCliente ?? ''}`;
  porCliente.set(k, (porCliente.get(k) ?? 0) + 1);
}
const [clienteEscolhido, clienteQuantos] = [...porCliente.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
const t3Cliente = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, filtro: { cliente: clienteEscolhido } });
conferir({
  tela: 'Tela 3',
  filtro: `cliente = \`${clienteEscolhido}\` (empresa + \`nCodCliente\`)`,
  onde: 'os 4 cartões e os 4 blocos',
  caso: `nos arquivos crus, ${num(clienteQuantos)} dos ${num(naFonteMes.length)} títulos da janela têm esse \`nCodCliente\` na empresa ${clienteEscolhido.split('-')[0]}, em ${num(porCliente.size)} códigos de cliente distintos na janela`,
  naTela: previsto(t3Cliente),
  naFonte: clienteQuantos,
  comoNaFonte: 'o mesmo conjunto cru, recortado aqui pelo par empresa + `nCodCliente` do `cabecTitulo`',
});

// --- 4. categoria: a que tem mais títulos na janela dos dois meses, que é onde há mais de uma.
const naFonteAmpla = daFonteNaJanela(VENC_DE, VENC_ATE);
const porCategoria = new Map();
for (const x of naFonteAmpla) {
  const k = String(x.cab.cCodCateg ?? '');
  porCategoria.set(k, (porCategoria.get(k) ?? 0) + 1);
}
// A CATEGORIA DO CASO é a MENOS numerosa da janela, e não a maior: na carteira da MeuBESS quase todo título está em
// `1.01.01`, então filtrar pela maior deixaria quase tudo dentro e provaria pouco. A menor é o recorte apertado — se o
// filtro errar por um título, a contagem muda de cara.
const [catEscolhida, catQuantos] = [...porCategoria.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
const t3Cat = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, filtro: { de: VENC_DE, ate: VENC_ATE, categoria: catEscolhida } });
const umDaCat = naFonteAmpla.find((x) => String(x.cab.cCodCateg ?? '') === catEscolhida);
conferir({
  tela: 'Tela 3',
  filtro: `categoria = \`${catEscolhida}\`, na janela de ${VENC_DE} a ${VENC_ATE}`,
  onde: 'os 4 cartões e os 4 blocos',
  caso: `o título \`${umDaCat.cab.nCodTitulo}\` da empresa ${umDaCat.emp} tem \`cCodCateg\` \`${catEscolhida}\` no arquivo cru; a janela tem ${num(porCategoria.size)} ${porCategoria.size === 1 ? 'categoria' : 'categorias'} distintas e ${num(catQuantos)} dos ${num(naFonteAmpla.length)} títulos ${catQuantos === 1 ? 'está' : 'estão'} nesta`,
  naTela: previsto(t3Cat),
  naFonte: catQuantos,
  comoNaFonte: 'o mesmo conjunto cru da janela, recortado aqui pelo `cCodCateg` do `cabecTitulo`',
});

// ================================================================ Tela 3 — o filtro de empresa
//
// AQUI A FONTE É O ARQUIVO, como na Tela 1: os títulos crus de `PesquisarLancamentos` de cada empresa saem de arquivos
// diferentes do cache (`titulosDaFonte` os lê por empresa), e o filtro tem de contar exatamente os de uma.
//
// A JANELA DO CASO É O ANO, e não o mês: no mês conferido a carteira a receber da MeuBESS é inteira da empresa 2, e um
// filtro que não tira nada não prova nada. No ano a empresa 1 tem poucos títulos — e é justamente por ser o recorte
// apertado que ele serve de caso: errar um título muda a contagem de cara.
const EMPRESA_DA_TELA_3 = '1';
const ANO_DE = `01/01/${ANO}`, ANO_ATE = `31/12/${ANO}`;
const t3Emp = await calcularTela3({
  raiz: RAIZ, ano: ANO, mes: MES, filtro: { de: ANO_DE, ate: ANO_ATE, empresa: [EMPRESA_DA_TELA_3] },
});
const naFonteAno = daFonteNaJanela(ANO_DE, ANO_ATE);
const t3PorEmpresa = EMPRESAS.map((emp) => naFonteAno.filter((x) => x.emp === emp).length);
const t3NoMes = EMPRESAS.map((emp) => naFonteMes.filter((x) => x.emp === emp).length);
const umDaEmpresa = naFonteAno.find((x) => x.emp === EMPRESA_DA_TELA_3);
conferir({
  tela: 'Tela 3',
  filtro: `empresa = ${EMPRESA_DA_TELA_3}, na janela de ${ANO_DE} a ${ANO_ATE}`,
  onde: 'os 4 cartões e os 4 blocos, no valor e na contagem — a tela é do Omie inteira',
  caso: `dos ${num(naFonteAno.length)} títulos do ano nos arquivos crus, ${num(t3PorEmpresa[0])} estão em arquivo da empresa 1 e ${num(t3PorEmpresa[1])} em arquivo da empresa 2; o título \`${umDaEmpresa.cab.nCodTitulo}\` é um dos da empresa ${EMPRESA_DA_TELA_3}, com \`cStatus\` \`${umDaEmpresa.cab.cStatus}\` e vencimento ${umDaEmpresa.cab.dDtVenc}. Em ${NOMES_DOS_MESES[MES]} sozinho a carteira é inteira da empresa 2 (${num(t3NoMes[1])} de ${num(naFonteMes.length)} títulos), e escolher a empresa 2 ali não tira nenhum — é por isso que o caso é o do ano. As duas contagens do cadastro de clientes continuam as duas, e o bloco delas diz isso`,
  naTela: previsto(t3Emp),
  naFonte: t3PorEmpresa[EMPRESAS.indexOf(EMPRESA_DA_TELA_3)],
  comoNaFonte: `os \`titulosEncontrados\` lidos dos arquivos \`${EMPRESA_DA_TELA_3}-financas-pesquisartitulos-…\` do cache, recortados aqui pelo \`nCodCC\` da MeuBESS, pelo \`dDtVenc\` no ano e sem os \`CANCELADO\``,
});


// ================================================================ Tela 1 — os quatro filtros de 27/09/2026
//
// CADA UM DELES TEM UMA PONTA DIFERENTE, e é por ela que o caso confere:
//
//   a CLASSIFICAÇÃO DO DFC e a SITUAÇÃO alcançam o VALOR do DFC, porque são colunas da planilha — o caso compara a
//   contagem do DFC da tela com a planilha REABERTA aqui, com o recorte de linha escrito de novo neste arquivo;
//   a CATEGORIA DO OMIE, o CLIENTE/FORNECEDOR e a CONTA BANCÁRIA alcançam o lado do Omie — o caso compara a contagem
//   do Omie da tela com os campos lidos dos arquivos CRUS do cache.

const camposFonte = Object.fromEntries(EMPRESAS.map((emp) => [emp, camposDaFonte(emp)]));
const dfcFonte = await linhasDoDfcDaFonte(fonteDoDfc(), ANO, MES);
const dfcDoSaldo = (t) => t.cartoes.find((c) => c.id === 'saldo').contagem.dfc;

// --- 1. categoria, a ponta do DFC: a `CLASS. CONTABIL` com mais linhas no mês.
if (dfcFonte) {
  const porClasse = new Map();
  for (const l of dfcFonte.linhas) porClasse.set(l.classe, (porClasse.get(l.classe) ?? 0) + 1);
  const [classeEscolhida, quantas] = [...porClasse.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0];
  const t1Classe = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { classe: [classeEscolhida] } });
  const exemplo = dfcFonte.linhas.find((l) => l.classe === classeEscolhida);
  conferir({
    tela: 'Tela 1',
    filtro: `categoria pela classificação do DFC = ${classeEscolhida}`,
    onde: 'o valor E a contagem do DFC dos 7 cartões e do "Top 10 despesas" — é a MESMA `CLASS. CONTABIL` que as barras desse bloco já agrupam',
    caso: `a planilha reaberta aqui tem ${num(dfcFonte.linhas.length)} linhas no recorte do mês — o mesmo número que a tela sem filtro mostra no cartão "Saldo" (${num(dfcDoSaldo(t1Sem))}) — e ${num(quantas)} delas têm esta classificação, em ${num(porClasse.size)} classificações distintas no mês; a linha ${exemplo.linha} do \`FLUXO DE CAIXA\` de ${NOMES_DOS_MESES[MES]} é uma delas, com \`SUB 2\` \`${exemplo.sub2}\` e \`PAGAMENTO\` \`${exemplo.pagamento}\`. A contagem do Omie NÃO é recortada por este filtro, e cada cartão diz isso na tela: o lançamento do Omie não tem \`CLASS. CONTABIL\``,
    naTela: dfcDoSaldo(t1Classe),
    naFonte: quantas,
    comoNaFonte: `as linhas do \`FLUXO DE CAIXA\` do arquivo do mês, lidas aqui com o recorte de linha escrito de novo neste arquivo (sem as linhas de saldo, sem as de valor zero, só as baixadas e com data no mês) e contadas pela \`CLASS. CONTABIL\``,
  });

  // --- 2. situação: a faixa com mais linhas no mês, e as três fechando o total.
  const porSituacao = SITUACOES.map((f) => [f.chave, dfcFonte.linhas.filter((l) => f.dfc.includes(l.pagamento)).length]);
  const [sitEscolhida, sitQuantas] = [...porSituacao].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const t1Sit = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { situacao: [sitEscolhida] } });
  const umDaSituacao = dfcFonte.linhas.find((l) => SITUACOES.find((f) => f.chave === sitEscolhida).dfc.includes(l.pagamento));
  conferir({
    tela: 'Tela 1',
    filtro: `situação = ${sitEscolhida}`,
    onde: 'o valor E a contagem do DFC dos 7 cartões e do "Top 10 despesas", E a contagem do Omie de todos eles — é o único dos quatro filtros novos que alcança os dois lados',
    caso: `das ${num(dfcFonte.linhas.length)} linhas do mês na planilha reaberta aqui, ${porSituacao.map(([f, n]) => `${f} ${num(n)}`).join(', ')} — e a soma das três é ${num(porSituacao.reduce((a, b) => a + b[1], 0))}, a planilha inteira do mês; "a pagar" é 0 porque a linha \`A PAGAR\` nunca entra nesta tela, que é de caixa. A linha ${umDaSituacao.linha} do \`FLUXO DE CAIXA\` tem \`PAGAMENTO\` \`${umDaSituacao.pagamento}\`. Do lado do Omie o de-para é a natureza do lançamento: a tela conta ${num(omieDoSaldo(t1Sit))} lançamentos com esta escolha, contra ${num(omieDoSaldo(t1Sem))} sem filtro`,
    naTela: dfcDoSaldo(t1Sit),
    naFonte: sitQuantas,
    comoNaFonte: 'as mesmas linhas da planilha reaberta aqui, contadas pelo rótulo da coluna `PAGAMENTO` (N) de cada uma',
  });
}

// --- 3. categoria, a ponta do Omie: o `cCodCateg` com mais lançamentos na base do mês.
const porCategoriaOmie = new Map();
for (const { d } of baseDoMes) {
  const cod = String(d.cCodCateg ?? '');
  porCategoriaOmie.set(cod, (porCategoriaOmie.get(cod) ?? 0) + 1);
}
const [catOmie, catOmieQuantos] = [...porCategoriaOmie.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
const t1CatOmie = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { categoria: [catOmie] } });
conferir({
  tela: 'Tela 1',
  filtro: `categoria pela categoria do Omie = \`${catOmie}\``,
  onde: 'a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro',
  caso: `a base do mês tem ${num(omieDoSaldo(t1Sem))} lançamentos em ${num(porCategoriaOmie.size)} categorias distintas, e ${num(catOmieQuantos)} deles estão nesta. O valor do DFC NÃO é recortado por este filtro, e cada cartão de fonte DFC diz isso na tela: a planilha classifica cada linha por \`CLASS. CONTABIL\` e \`SUB 2\`, que saem do cadastro da aba \`BASE\`, e nenhuma das duas fontes escreve o de-para entre os dois vocabulários`,
  naTela: omieDoSaldo(t1CatOmie),
  naFonte: catOmieQuantos,
  comoNaFonte: 'os lançamentos da base do mês contados aqui, um a um, pelo `cCodCateg` de cada um',
});

// --- 4. cliente/fornecedor: o par empresa + `nCodCliente` com mais lançamentos, LIDO DO ARQUIVO CRU.
const porFornecedor = new Map();
for (const { emp, d } of baseDoMes) {
  const cod = camposFonte[emp].get(chaveDoMov(d))?.nCodCliente ?? '';
  porFornecedor.set(`${emp}-${cod}`, (porFornecedor.get(`${emp}-${cod}`) ?? 0) + 1);
}
const semCodigo = [...porFornecedor.entries()].filter(([k]) => k.endsWith('-') || k.endsWith('-0')).reduce((a, b) => a + b[1], 0);
const [fornEscolhido, fornQuantos] = [...porFornecedor.entries()]
  .filter(([k]) => !k.endsWith('-') && !k.endsWith('-0'))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
const t1Forn = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { fornecedor: fornEscolhido } });
conferir({
  tela: 'Tela 1',
  filtro: `cliente/fornecedor = \`${fornEscolhido}\` (empresa + \`nCodCliente\`)`,
  onde: 'a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro',
  caso: `nos arquivos crus do cache, ${num(fornQuantos)} dos ${num(omieDoSaldo(t1Sem))} lançamentos da base do mês têm esse \`nCodCliente\` na empresa ${fornEscolhido.split('-')[0]}, em ${num(porFornecedor.size)} pares empresa + código distintos — e ${num(semCodigo)} lançamentos do mês não têm \`nCodCliente\` nenhum e ficam fora de qualquer escolha. O lado do DFC não é recortado: lá o cliente/fornecedor é um NOME digitado à mão, e das 4.670 linhas cruzáveis do ano 3.550 não acham nome nenhum no cadastro (\`scripts/de-para-conta-dfc.mjs\`)`,
  naTela: omieDoSaldo(t1Forn),
  naFonte: fornQuantos,
  comoNaFonte: 'o `nCodCliente` de cada lançamento da base do mês, lido dos arquivos crus de `financas/mf` do cache — e não da montagem de `lib/regras/cache-omie.mjs`',
});

// ================================================================ Telas 1, 2 e 3 — o filtro de conta bancária
//
// O SEGUNDO FILTRO QUE AS TRÊS TELAS DIVIDEM (decisão do dono, 27/09/2026). A FONTE dele é o `nCodCC` lido dos arquivos
// CRUS do cache, e as opções são as contas da MeuBESS pelo nome que o dono deu a cada uma em
// `dados/contas-correntes-por-negocio.json`.
//
// ONDE ELE NÃO VALE: em todo número que vem do DFC. A planilha TEM a coluna `BANCO`, mas o cruzamento de 27/09/2026
// (`scripts/de-para-conta-dfc.mjs`) casou o rótulo `ITAU` com QUATRO contas diferentes do Omie. Por isso os casos das
// Telas 1 e 2 conferem a contagem do OMIE, e o da Tela 2 confere também que o lado do DFC fica PARADO.

const contasDaMeuBess = contasBancarias(lerContas(RAIZ));
// De `empresa|nCodCC` para o nome da conta, pela MESMA lista — é o de-para do dono, e o único que existe.
const contaDoCodigo = new Map();
for (const c of contasDaMeuBess) {
  for (const [emp, cods] of Object.entries(c.codigos)) for (const cod of cods) contaDoCodigo.set(`${emp}|${cod}`, c.nome);
}
const contaNaFonte = ({ emp, d }) => contaDoCodigo.get(`${emp}|${camposFonte[emp].get(chaveDoMov(d))?.nCodCC ?? ''}`) ?? null;
const porConta = new Map();
for (const x of baseDoMes) porConta.set(contaNaFonte(x), (porConta.get(contaNaFonte(x)) ?? 0) + 1);

// OS TÍTULOS A PAGAR POR VENCIMENTO, da fonte, com o mesmo recorte do cartão "Desp. Pendentes": recorte da MeuBESS,
// vencimento no mês, sem baixa (`cLiquidado = "N"`) e sem os `CANCELADO`.
//
// É NESSE CARTÃO QUE O CASO DA CONTA CONFERE, e não no "Saldo", por um motivo que `docs/filtros.md` explica: esta
// leitura é um TÍTULO POR LINHA, sem a junção de título e baixa que os três baldes de caixa fazem — então a conta a
// reparte exatamente, e as contas uma a uma somam a carteira inteira. Nos três baldes não somam: um título pago de
// OUTRA conta faz a baixa dele voltar a contar sozinha, e em agosto de 2026 as contas uma a uma dão 425 contra os 419
// da tela sem filtro. Isso não é erro do filtro; é o que escolher uma conta quer dizer, e o documento o registra.
const pendFonte = Object.fromEntries(EMPRESAS.map((emp) => [emp, pendentesDaFonte(emp).filter((d) =>
  d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`) && noMes(d.dDtVenc)
  && (d._resumo.cLiquidado ?? 'N') === 'N')]));
const porContaPend = new Map();
for (const emp of EMPRESAS) {
  for (const d of pendFonte[emp]) {
    const nome = contaDoCodigo.get(`${emp}|${String(d.nCodCC ?? '')}`) ?? null;
    porContaPend.set(nome, (porContaPend.get(nome) ?? 0) + 1);
  }
}
// A CONTA DO CASO É A QUE TEM MENOS TÍTULOS no mês, e não a maior: quase tudo da MeuBESS passa pelo Itaú, então
// filtrar pela maior deixaria quase tudo dentro e provaria pouco. A menor é o recorte apertado — se o filtro errar por
// um título, a contagem muda de cara.
const [contaEscolhida, contaQuantos] = [...porContaPend.entries()].filter(([n, q]) => n && q > 0)
  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'pt-BR'))[0];
const t1Conta = await calcularTela1({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { conta: [contaEscolhida] } });
const t1Contas = await calcularTela1({
  raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { conta: contasDaMeuBess.map((c) => c.nome) },
});
const pendentesDe = (t) => t.cartoes.find((c) => c.id === 'despesas-pendentes').contagem.omie;
const umDaConta = EMPRESAS.flatMap((emp) => pendFonte[emp]
  .filter((d) => contaDoCodigo.get(`${emp}|${String(d.nCodCC ?? '')}`) === contaEscolhida))[0];
conferir({
  tela: 'Tela 1',
  filtro: `conta bancária = ${contaEscolhida}`,
  onde: 'a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro — é neste último que o caso confere, porque ele é um título por linha',
  caso: `nos arquivos crus da leitura \`cTpLancamento: "CP"\` do cache, ${num(contaQuantos)} dos ${num(pendentesDe(t1Sem))} títulos a pagar vencendo no mês têm o \`nCodCC\` desta conta — o título \`${umDaConta.nCodTitulo}\`, com \`nCodCC\` \`${umDaConta.nCodCC}\` e vencimento ${umDaConta.dDtVenc}, é um deles. A carteira toda se reparte em ${[...porContaPend.entries()].filter(([n, q]) => n && q > 0).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} ${num(q)}`).join(', ')}, que somam os ${num(pendentesDe(t1Sem))} do cartão. Os números do DFC não são recortados por este filtro, e cada cartão de fonte DFC diz isso na tela: o rótulo \`ITAU\` da coluna \`BANCO\` casa com quatro contas diferentes do Omie`,
  naTela: pendentesDe(t1Conta),
  naFonte: contaQuantos,
  comoNaFonte: 'os `movimentos` dos arquivos crus da leitura de títulos a pagar por vencimento do cache, achados aqui pela chave exata da consulta e recortados pelo `nCodCC` da MeuBESS, pelo `dDtVenc` no mês, por `cLiquidado = "N"` e sem os `CANCELADO`',
});

// A SEGUNDA CONFERÊNCIA DO MESMO FILTRO, e a que fecha a porta do "quase certo": escolhendo TODAS as contas, a tela tem
// de mostrar a base do mês inteira — porque o recorte da MeuBESS já É essa lista de contas, e nenhum lançamento da base
// pode estar fora dela.
conferir({
  tela: 'Tela 1',
  filtro: `conta bancária = as ${contasDaMeuBess.length} contas de uma vez`,
  onde: 'os mesmos cartões e blocos; é a conferência do conjunto, e não de uma conta',
  caso: `a base do mês tem ${num(omieDoSaldo(t1Sem))} lançamentos e ${num([...porConta.entries()].filter(([n]) => !n).reduce((a, b) => a + b[1], 0))} deles estão em conta que não é da MeuBESS nos arquivos crus: escolhendo as ${contasDaMeuBess.length} contas, a tela mostra a base inteira. Nos arquivos crus ela se reparte em ${[...porConta.entries()].filter(([n]) => n).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} ${num(q)}`).join(', ')} — que somam mais que ${num(omieDoSaldo(t1Sem))}, e é assim de propósito: um título pago de outra conta faz a baixa dele voltar a contar sozinha quando só a conta da baixa é escolhida`,
  naTela: omieDoSaldo(t1Contas),
  naFonte: omieDoSaldo(t1Sem),
  comoNaFonte: 'a base do mês sem filtro — a mesma que `docs/conferencia.md` confere indicador por indicador',
});

// NA TELA 2 A PROVA TEM DUAS PERNAS, e nenhuma delas é a soma das contas uma a uma, pelo mesmo motivo de cima:
//
//   1. escolher TODAS as contas tem de dar, indicador por indicador, o que a tela sem filtro dá — porque o recorte da
//      MeuBESS já é essa lista de contas;
//   2. escolher UMA conta só tem de deixar o lado do DFC PARADO e o lado do Omie menor — é o filtro não alcançando o
//      DFC, que é a ressalva inteira deste filtro nesta tela.
const t2Contas = await calcularTela2({
  raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { conta: contasDaMeuBess.map((c) => c.nome) },
});
const t2UmaConta = await calcularTela2({ raiz: RAIZ, ano: ANO, mes: MES, fonte: fonteDoDfc(), filtro: { conta: [contaEscolhida] } });
const contaBateNaT2 = idsT2.filter((id) => {
  const sem = contagemDe(t2Sem, id), todas = contagemDe(t2Contas, id), uma = contagemDe(t2UmaConta, id);
  return (sem.omie ?? 0) === (todas.omie ?? 0) && sem.dfc === todas.dfc
    && (uma.omie ?? 0) <= (sem.omie ?? 0) && uma.dfc === sem.dfc;
}).length;
conferir({
  tela: 'Tela 2',
  filtro: `conta bancária = as ${contasDaMeuBess.length} contas de uma vez, e depois só ${contaEscolhida}`,
  onde: 'as linhas e os cartões de fonte Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "(=) sem conta" — e toda contagem do Omie da tela',
  caso: `a coluna de ${NOMES_DOS_MESES[MES]} tem ${num(omieDoMes(t2Sem))} lançamentos do Omie sem filtro e os mesmos ${num(omieDoMes(t2Contas))} com as ${contasDaMeuBess.length} contas escolhidas; com só ${contaEscolhida} ela cai para ${num(omieDoMes(t2UmaConta))}, e a contagem do DFC de cada um dos ${idsT2.length} indicadores fica igual nas três leituras — é o filtro não alcançando o DFC, como \`docs/filtros.md\` diz. As duas contagens de cadastro do DRE também não mudam, e a linha "(=) Receita bruta" diz isso na tela`,
  naTela: contaBateNaT2,
  naFonte: idsT2.length,
  comoNaFonte: 'a tela sem filtro, a tela com todas as contas e a tela com uma só, comparadas aqui indicador por indicador — e a contagem do DFC conferida parada nas três',
});

// E NA TELA 3 A FONTE É O `cabecTitulo.nCodCC` DOS TÍTULOS CRUS — o MESMO campo pelo qual a tela já faz o recorte da
// MeuBESS, então o filtro só aperta o recorte e não muda regra nenhuma. Aqui também é um título por linha, e por isso
// a conta reparte a janela exatamente. O caso é a conta com MENOS títulos na janela do mês.
const contaDoTitulo = (x) => contaDoCodigo.get(`${x.emp}|${x.cab.nCodCC}`) ?? null;
const porContaT3 = new Map();
for (const x of naFonteMes) porContaT3.set(contaDoTitulo(x), (porContaT3.get(contaDoTitulo(x)) ?? 0) + 1);
const [contaT3, contaT3Quantos] = [...porContaT3.entries()].filter(([n, q]) => n && q > 0)
  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'pt-BR'))[0];
const t3Conta = await calcularTela3({ raiz: RAIZ, ano: ANO, mes: MES, filtro: { conta: [contaT3] } });
const umDaContaT3 = naFonteMes.find((x) => contaDoTitulo(x) === contaT3);
conferir({
  tela: 'Tela 3',
  filtro: `conta bancária = ${contaT3}`,
  onde: 'os 4 cartões e os 4 blocos, no valor e na contagem — a tela é do Omie inteira, e a conta é o mesmo `cabecTitulo.nCodCC` do recorte da MeuBESS',
  caso: `dos ${num(naFonteMes.length)} títulos da janela nos arquivos crus, ${num(contaT3Quantos)} têm o \`nCodCC\` desta conta; o título \`${umDaContaT3.cab.nCodTitulo}\` da empresa ${umDaContaT3.emp} é um deles, com \`cStatus\` \`${umDaContaT3.cab.cStatus}\` e vencimento ${umDaContaT3.cab.dDtVenc}. A janela toda se reparte em ${[...porContaT3.entries()].filter(([n, q]) => n && q > 0).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} ${num(q)}`).join(', ')}, que somam os ${num(naFonteMes.length)} títulos dela. As duas contagens do cadastro de clientes continuam as duas, e o bloco delas diz isso`,
  naTela: previsto(t3Conta),
  naFonte: contaT3Quantos,
  comoNaFonte: 'os `titulosEncontrados` dos arquivos crus de `financas/pesquisartitulos`, recortados aqui pelo `cabecTitulo.nCodCC` da conta escolhida, pelo `dDtVenc` no mês e sem os `CANCELADO`',
});


// ================================================================ o bloco que vai para o documento

const conferidos = linhas.filter((l) => l.estado === 'conferido').length;
const divergentes = linhas.filter((l) => l.estado === 'divergente').length;

const linhaMd = (l) => `- ${l.estado === 'divergente' ? 'divergente: ' : ''}**${l.tela} — ${l.filtro}.** `
  + `**Vale em:** ${l.onde}. **Na tela:** ${num(l.naTela)}. **Na fonte:** ${num(l.naFonte)} — ${l.comoNaFonte}. `
  + `**Caso real:** ${l.caso}.`;

const bloco = `${MARCA_INICIO}
<!-- Escrito por scripts/conferir-filtros.mjs. Não edite à mão: rode \`npm run conferir-filtros\`. -->

**${linhas.length} filtros conferidos**: ${conferidos} conferidos e ${divergentes} divergentes. Leitura do Omie:
\`${OMIE.carimbo.id}\` — ${OMIE.carimbo.arquivos} arquivos no cache local. Mês do caso: ${NOMES_DOS_MESES[MES]} de ${ANO}.

Cada linha é um filtro real aplicado pela **mesma camada de dados que o navegador recebe**, e reencontrado na **fonte** —
os arquivos crus do cache do Omie, abertos aqui com \`fs\` e \`JSON.parse\`, sem passar pela montagem de
\`lib/regras/cache-omie.mjs\`. **Só contagem e código:** nenhum valor em dinheiro e nenhum nome de cliente, como em
[\`docs/conferencia.md\`](conferencia.md).

${linhas.map(linhaMd).join('\n')}
${MARCA_FIM}`;

if (!fs.existsSync(SAIDA_MD)) {
  console.error(`não achei ${SAIDA_MD}. Este script escreve o bloco de casos dentro dele, entre as marcas ${MARCA_INICIO} e ${MARCA_FIM}.`);
  process.exit(1);
}
const antes = fs.readFileSync(SAIDA_MD, 'utf8');
const i = antes.indexOf(MARCA_INICIO), j = antes.indexOf(MARCA_FIM);
if (i < 0 || j < 0) {
  console.error(`não achei as marcas ${MARCA_INICIO} / ${MARCA_FIM} em docs/filtros.md.`);
  process.exit(1);
}
const md = antes.slice(0, i) + bloco + antes.slice(j + MARCA_FIM.length);

// A MESMA TRAVA DAS OUTRAS PÁGINAS: nada de dinheiro, nada de nome de cliente.
const PROIBIDO = [
  [/R\$/, 'a marca "R$"'],
  [/\b\d{1,3}(\.\d{3})*,\d{2}\b/, 'um número com centavos'],
  [/\b\d+,\d{2}\b/, 'um número com centavos'],
  [/data-codigo=/, 'um nome de cliente'],
  // O `cabecTitulo` cru que este script abre traz o CPF/CNPJ do cliente. Nada aqui o imprime, e esta linha é a rede:
  // documento de pessoa ou de empresa não entra em arquivo versionado.
  [/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, 'um CNPJ'],
  [/\d{3}\.\d{3}\.\d{3}-\d{2}/, 'um CPF'],
  [/_a conferir_/, 'um "a conferir"'],
];
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(md);
  if (m) { console.error(`docs/filtros.md ia sair com ${oQue}: ${JSON.stringify(m[0])}`); process.exit(1); }
}
fs.writeFileSync(SAIDA_MD, md, 'utf8');

// ================================================================ a mesma coisa como página
//
// Um conversor curto do Markdown que este documento usa: títulos, parágrafos, listas, tabelas, `código`, **forte** e
// [link](destino). Nada além disso aparece em `docs/filtros.md`, e página não chama biblioteca nenhuma.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function paraHtml(texto) {
  const fora = [];
  let tabela = null, lista = null;
  const fecharLista = () => { if (lista) { fora.push(`<ul class="ind">${lista.join('')}</ul>`); lista = null; } };
  const fecharTabela = () => {
    if (!tabela) return;
    const [cab, ...corpo] = tabela;
    fora.push(`<div class="tabela"><table><thead><tr>${cab.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
      + `<tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    tabela = null;
  };
  const celulas = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  for (const l of texto.split(/\r?\n/)) {
    if (/^<!--/.test(l.trim())) continue;
    if (/^\|/.test(l)) {
      if (/^\|[\s:|-]+\|?$/.test(l)) continue;
      fecharLista();
      (tabela ??= []).push(celulas(l));
      continue;
    }
    fecharTabela();
    const t = /^(#{1,3})\s+(.*)$/.exec(l);
    if (t) { fecharLista(); fora.push(`<h${t[1].length}>${inline(t[2])}</h${t[1].length}>`); continue; }
    const item = /^- (.*)$/.exec(l);
    if (item) {
      const div = /^divergente: /.test(item[1]);
      (lista ??= []).push(`<li class="${div ? 'div' : 'ok'}"><span class="selo">${div ? 'divergente' : 'conferido'}</span>${inline(item[1].replace(/^divergente: /, ''))}</li>`);
      continue;
    }
    fecharLista();
    if (l.trim() === '') { fora.push(''); continue; }
    fora.push(`<p>${inline(l)}</p>`);
  }
  fecharLista(); fecharTabela();
  // Parágrafos seguidos viram um só, porque o Markdown quebra linha a cada 120 colunas.
  return fora.join('\n').replace(/<\/p>\n<p>/g, ' ').replace(/\n{2,}/g, '\n');
}

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Os filtros das 3 telas</title>
<style>
 :root { --fundo:#fbfaf7; --papel:#fff; --tinta:#1d1b16; --fraco:#6b6559; --linha:#e3ded2;
         --ok:#1f6f43; --okf:#e8f4ec; --div:#9a2b1e; --divf:#fbeae7; }
 @media (prefers-color-scheme: dark) { :root {
   --fundo:#16150f; --papel:#1e1c16; --tinta:#efece2; --fraco:#a49d8d; --linha:#34312a;
   --ok:#7cc79b; --okf:#17301f; --div:#e89b8d; --divf:#331914; } }
 * { box-sizing:border-box } html { -webkit-text-size-adjust:100% }
 body { margin:0; padding:0 16px 64px; background:var(--fundo); color:var(--tinta);
   font:16px/1.6 ui-serif, Georgia, "Times New Roman", serif; overflow-wrap:break-word }
 main { max-width:62rem; margin:0 auto }
 h1 { font-size:1.9rem; line-height:1.2; margin:2.5rem 0 .5rem }
 h2 { font-size:1.3rem; margin:2.5rem 0 .75rem; padding-bottom:.35rem; border-bottom:1px solid var(--linha) }
 h3 { font-size:1.05rem; margin:1.8rem 0 .5rem; font-family:ui-sans-serif,system-ui,sans-serif }
 p { max-width:70ch } a { color:inherit }
 code { font:0.86em ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--papel);
   border:1px solid var(--linha); border-radius:3px; padding:.05em .3em }
 ul.ind { list-style:none; padding:0; margin:0 0 1rem }
 ul.ind li { background:var(--papel); border:1px solid var(--linha); border-left-width:4px; border-radius:8px;
   padding:.9rem 1.1rem; margin:0 0 .7rem; font-size:.95rem }
 li.ok { border-left-color:var(--ok) } li.div { border-left-color:var(--div); background:var(--divf) }
 .selo { display:inline-block; font:600 .7rem/1.5 ui-sans-serif,system-ui,sans-serif; text-transform:uppercase;
   letter-spacing:.06em; padding:.05em .55em; border-radius:99px; vertical-align:.14em; margin-right:.5em;
   background:var(--okf); color:var(--ok) }
 li.div .selo { background:var(--div); color:#fff }
 .tabela { overflow-x:auto } table { border-collapse:collapse; width:100%; margin:1rem 0; font-size:.9rem }
 th, td { border:1px solid var(--linha); padding:.4rem .6rem; text-align:left; vertical-align:top }
 th { background:var(--papel); font-family:ui-sans-serif,system-ui,sans-serif; font-size:.74rem;
   text-transform:uppercase; letter-spacing:.06em; color:var(--fraco) }
 .rodape { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--linha); font-size:.86rem; color:var(--fraco) }
</style></head><body><main>
${paraHtml(md)}
<p class="rodape">Gerado por <code>scripts/conferir-filtros.mjs</code>, só leitura: nada foi escrito no Omie nem nas
planilhas. A mesma coisa em texto está em <code>docs/filtros.md</code>.</p>
</main></body></html>
`;
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(html.replace(/<style>[\s\S]*?<\/style>/, ''));
  if (m) { console.error(`docs/filtros.html ia sair com ${oQue}: ${JSON.stringify(m[0])}`); process.exit(1); }
}
fs.writeFileSync(SAIDA_HTML, html, 'utf8');

console.log(`gravados ${path.relative(RAIZ, SAIDA_MD)} e ${path.relative(RAIZ, SAIDA_HTML)}`);
console.log(`${linhas.length} filtros: ${conferidos} conferidos, ${divergentes} divergentes`);
for (const l of linhas.filter((x) => x.estado === 'divergente')) {
  console.log(`  divergente: ${l.tela} — ${l.filtro}: a tela conta ${l.naTela} e a fonte diz ${l.naFonte}`);
}
if (divergentes) process.exit(1);
