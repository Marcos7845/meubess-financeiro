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
import { lerRecorte, criarRegras } from '../lib/regras/movimentos.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { noMesDe, NOMES_DOS_MESES, dataBR, dois, ultimoDia } from '../lib/regras/periodo.mjs';
import { FAIXA_DO_STATUS } from '../lib/regras/listas.mjs';
import { centrosDeCusto } from '../lib/regras/filtros.mjs';

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
