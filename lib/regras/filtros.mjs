// OS FILTROS DAS TRÊS TELAS — a fonte única deles.
//
// O QUE ESTÁ AQUI. Só os filtros que `docs/fontes.md` já registra, tirados das referências do dono:
//
//   Tela 1 (linha 716)  ano · mês · CENTRO DE CUSTO (seleção múltipla), juntando as empresas 1 e 2 pelo NOME do
//                       departamento (decisão do dono, 25/09/2026), porque nenhum `cCodDepartamento` coincide.
//   Tela 2 (linha 788)  MÊS, seleção múltipla — vários meses de uma vez.
//   Tela 3 (linha 852)  VENCIMENTO de–até · STATUS · CLIENTE · CATEGORIA, os quatro que a consulta da tela aceita.
//   AS TRÊS TELAS       EMPRESA — empresa 1, empresa 2 ou as duas (decisão do dono, 27/09/2026).
//
// E OS QUATRO QUE O DONO APROVOU EM 27/09/2026, depois dos de cima:
//
//   Tela 1              CATEGORIA, de duas pontas — a CLASSIFICAÇÃO do DFC (`CLASS. CONTABIL`, a mesma que o
//                       "Top 10 despesas" agrupa) para o lado do DFC, e o `cCodCateg` do Omie para o lado do Omie.
//                       São dois vocabulários, e não um: não existe de-para entre eles em lugar nenhum das fontes.
//   Tela 1              CLIENTE/FORNECEDOR — o par empresa + `nCodCliente`, como o cliente da Tela 3.
//   Tela 1              SITUAÇÃO — pago · recebido · a pagar, os três rótulos da coluna `PAGAMENTO` (N) do DFC.
//   AS TRÊS TELAS       CONTA BANCÁRIA — as contas da MeuBESS de `dados/contas-correntes-por-negocio.json`.
//
// O que NÃO está aqui: qualquer filtro que `docs/fontes.md` ou uma decisão do dono não registre — esses esperam
// decisão dele, e nenhuma linha deste arquivo os adivinha.
//
// ONDE O FILTRO MORA: NA URL. É a mesma escolha das pílulas de ano e mês que já existiam — as telas são componentes de
// servidor, então o estado do filtro tem de chegar pela query, e assim um link colado no chat e a captura da tela
// mostram exatamente a mesma coisa. Cada leitor abaixo recebe o `searchParams` cru e devolve o filtro já normalizado.
//
// ONDE O FILTRO NÃO VALE. Nenhuma tela mostra valor sem filtro como se estivesse filtrado: quando um número vem de uma
// fonte que não aceita o filtro escolhido (um cartão do DFC diante do centro de custo, por exemplo), o indicador ganha
// um `naoVale[]` e a tela escreve isso ao lado do número. `naoVale()`, no fim deste arquivo, é a forma dessa frase, e
// `docs/filtros.md` lista todas elas, tela por tela.

import { dataBR, dois, ultimoDia } from './periodo.mjs';

// ================================================================ a leitura da query
//
// O `searchParams` do Next devolve string quando o parâmetro veio uma vez e array quando veio várias. As duas formas
// valem, e uma lista também pode vir separada por vírgula num parâmetro só (`?cc=TI,RH`), que é o que as pílulas usam.

const comoLista = (v) => (v === undefined || v === null ? []
  : (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean));
const comoTexto = (v) => { const l = comoLista(v); return l.length ? l[0] : null; };

// Uma data de filtro: aceita `aaaa-mm-dd` (o que o campo de data do navegador manda) e `dd/mm/aaaa` (o formato do
// Omie, que é como ela segue para a consulta). Devolve sempre `dd/mm/aaaa`, ou `null` se não for data.
function dataDeFiltro(v) {
  const s = String(comoTexto(v) ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return dataBR(s) ? s : null;
}

// `dd/mm/aaaa` para `aaaa-mm-dd`, que é o `value` que o campo de data da tela espera.
const paraCampoDeData = (s) => { const d = dataBR(s); return d ? `${d.a}-${dois(d.m)}-${dois(d.d)}` : ''; };

// ================================================================ Tela 1 — centro de custo
//
// AS OPÇÕES SÃO OS NOMES (decisão do dono, 25/09/2026). O cadastro `geral/departamentos` → `ListarDepartamentos` tem
// os mesmos 16 nomes nas duas empresas e **nenhum** código em comum, então o nome é a única chave que casa os dois
// lados; por trás de cada nome ficam os `cCodDepartamento` de cada empresa, e é por eles que o filtro escolhe.
function centrosDeCusto(departamentos) {
  const porNome = new Map();
  for (const emp of Object.keys(departamentos)) {
    for (const d of (departamentos[emp]?.values?.() ?? [])) {
      const nome = String(d.descricao ?? '').trim();
      if (!nome) continue;
      if (!porNome.has(nome)) porNome.set(nome, { nome, codigos: {} });
      const c = porNome.get(nome);
      (c.codigos[emp] ??= []).push(String(d.codigo));
    }
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// O filtro de centro de custo, já resolvido em códigos por empresa. Nome que não está no cadastro é ignorado e vai
// para `desconhecidos`: filtro escrito errado na URL não pode virar filtro vazio que esconde a tela inteira.
//
// E MAIS TRÊS FILTROS DESTA TELA, aprovados pelo dono em 27/09/2026 e lidos aqui, no mesmo lugar:
//
//   CATEGORIA, DE DUAS PONTAS. `?classe=` é a `CLASS. CONTABIL` do DFC — a MESMA classificação que o "Top 10
//   despesas" agrupa — e recorta o lado do DFC; `?categoria=` é o `cCodCateg` do Omie e recorta o lado do Omie. São
//   DOIS VOCABULÁRIOS e não um: o `SUB 2` do DFC sai do cadastro da aba `BASE` e o `cCodCateg`, do plano de contas do
//   Omie, e nenhuma das duas fontes escreve o de-para entre eles. Por isso cada ponta diz, ao lado do número da
//   outra, que não a alcança — em vez de um filtro só fingir que recorta os dois lados.
//
//   CLIENTE/FORNECEDOR. O par empresa + `nCodCliente`, como o cliente da Tela 3 (`?fornecedor=2-1234567`): o código é
//   próprio de cada empresa. Só o lado do Omie — no DFC o cliente/fornecedor é um NOME digitado à mão na coluna
//   `FORNECEDOR / CLIENTE` (G), sem código nenhum (a medida de quanto ele casa está em `docs/filtros.md`).
const naLista = (lista) => (x) => lista.includes(x);

// A classe do DFC vem da URL como o rótulo que a planilha escreve; `lib/regras/dfc.mjs` guarda cada linha já em
// maiúscula e sem acento, e é nessa forma que a comparação é feita — aqui e na tela.
const comoClasseDoDfc = (x) => String(x).toLocaleUpperCase('pt-BR')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

function filtroDaTela1(q, centros) {
  const pedidos = new Set(comoLista(q?.cc));
  const escolhidos = centros.filter((c) => pedidos.has(c.nome));
  const porEmpresa = {};
  for (const c of escolhidos) {
    for (const [emp, cods] of Object.entries(c.codigos)) for (const cod of cods) (porEmpresa[emp] ??= new Set()).add(cod);
  }
  const classes = [...new Set(comoLista(q?.classe).map(comoClasseDoDfc))];
  const categorias = [...new Set(comoLista(q?.categoria))];
  const fornecedor = lerChaveDoCliente(comoTexto(q?.fornecedor));
  return {
    cc: {
      ativo: escolhidos.length > 0,
      nomes: escolhidos.map((c) => c.nome),
      desconhecidos: [...pedidos].filter((n) => !centros.some((c) => c.nome === n)),
      porEmpresa,
      // O PREDICADO E O VALOR RATEADO, prontos para o cálculo. `pega` diz se o lançamento entra; `rateio` é o
      // `nDistrValor` só das linhas de rateio escolhidas, em centavos — é o que `docs/fontes.md` manda somar quando o
      // filtro está ligado, e não o valor inteiro do título rateado entre vários centros.
      pega: (emp, deps) => (deps ?? []).some((x) => porEmpresa[emp]?.has(String(x.cCodDepartamento))),
      rateio: (emp, deps) => (deps ?? []).filter((x) => porEmpresa[emp]?.has(String(x.cCodDepartamento)))
        .reduce((s, x) => s + Math.round(Number(x.nDistrValor ?? 0) * 100), 0),
    },
    // A ponta do DFC da categoria: a `CLASS. CONTABIL` de cada linha do `FLUXO DE CAIXA`.
    classe: { ativo: classes.length > 0, nomes: classes, pega: naLista(classes) },
    // A ponta do Omie da categoria: o `cCodCateg` do lançamento.
    categoria: { ativo: categorias.length > 0, codigos: categorias, pega: naLista(categorias) },
    // O cliente/fornecedor, do lado do Omie: empresa + `nCodCliente`.
    fornecedor: {
      ativo: Boolean(fornecedor), empresa: fornecedor?.empresa ?? null, codigo: fornecedor?.codigo ?? null,
      pega: (emp, cod) => !fornecedor || (String(emp) === fornecedor.empresa && String(cod ?? '') === fornecedor.codigo),
    },
  };
}

// ================================================================ Tela 1 — situação (pago · recebido · a pagar)
//
// DECISÃO DO DONO, 27/09/2026. Os três rótulos não foram inventados aqui: eles são, letra por letra, os valores da
// coluna `PAGAMENTO` (N) do `FLUXO DE CAIXA` que `docs/fontes.md` registra — `PAGO`, `RECEBIDO` e `A PAGAR`. Por isso
// este é o único dos quatro filtros novos que alcança o VALOR do DFC, e não só a contagem do Omie.
//
// DO LADO DO OMIE o de-para é a NATUREZA do lançamento, e não um `cStatus` novo: a leitura das Telas 1 e 2 é de CAIXA
// (`financas/mf` por data de pagamento), e nela todo lançamento já está baixado — os 3.569 lançamentos de 2026 no
// recorte da MeuBESS têm só dois `cStatus`, `PAGO` nos 2.217 de natureza `P` e `RECEBIDO` nos 1.352 de natureza `R`
// (medido em 27/09/2026). Então pago é a natureza `P`, recebido é a `R`, e A PAGAR não existe nessa leitura: o que
// ainda não foi pago só aparece no cartão "Desp. Pendentes", que sai dos títulos a pagar por VENCIMENTO sem baixa. É
// o mesmo corte do DFC, onde a linha `A PAGAR` nunca entra na tela porque `BAIXADO()` a deixa de fora (regime de
// caixa, `docs/fontes.md`).
const SITUACOES = [
  { chave: 'pago', nome: 'Pago', dfc: ['PAGO'], natureza: 'P' },
  { chave: 'recebido', nome: 'Recebido', dfc: ['RECEBIDO'], natureza: 'R' },
  { chave: 'a-pagar', nome: 'A pagar', dfc: ['A PAGAR'], natureza: null },
];

function filtroDeSituacao(q) {
  const pedidos = comoLista(q?.situacao).map((x) => x.toLowerCase().replace(/\s+/g, '-'));
  const faixas = [...new Set(pedidos.filter((x) => SITUACOES.some((f) => f.chave === x)))];
  const escolhidas = SITUACOES.filter((f) => faixas.includes(f.chave));
  const ativo = escolhidas.length > 0;
  const rotulosDfc = escolhidas.flatMap((f) => f.dfc);
  const naturezas = escolhidas.map((f) => f.natureza).filter(Boolean);
  return {
    situacao: {
      ativo, faixas,
      desconhecidos: [...new Set(pedidos.filter((x) => !SITUACOES.some((f) => f.chave === x)))],
      // O lado do DFC: o rótulo da coluna `PAGAMENTO` da própria linha.
      pegaDfc: (pagamento) => !ativo || rotulosDfc.includes(String(pagamento ?? '')),
      // O lado do Omie de caixa: a natureza do lançamento.
      pegaOmie: (d) => !ativo || naturezas.includes(String(d?.cNatureza ?? '')),
      // E o cartão "Desp. Pendentes", que é "a pagar" inteiro.
      pegaPendente: () => !ativo || faixas.includes('a-pagar'),
    },
  };
}

// ================================================================ a conta bancária — as TRÊS telas
//
// DECISÃO DO DONO, 27/09/2026: filtrar por conta bancária nas três telas, "onde a fonte disser o banco".
//
// AS OPÇÕES SÃO AS CONTAS DA MEUBESS, e o nome de cada uma é o `dito_como` de
// `dados/contas-correntes-por-negocio.json` — o nome que o PRÓPRIO DONO deu à conta quando disse de que negócio ela
// era (24 e 25/09/2026). É esse nome que junta as duas empresas, como o nome do departamento junta os dois cadastros
// no centro de custo: a mesma conta física está cadastrada nas duas com `nCodCC` diferente e, às vezes, com descrição
// diferente (`CARTÃO B3W ITAU (1106)` na empresa 1 e `CARTÃO B3W ITAU (1106) - FILIAL` na 2). O de-para é a resposta
// dele, e não semelhança de texto adivinhada por código.
//
// ONDE ELE NÃO VALE: em todo número que vem do DFC. A planilha TEM uma coluna `BANCO` (C), mas os rótulos dela não são
// as contas do Omie — o cruzamento de 27/09/2026 (`scripts/de-para-conta-dfc.mjs`) mostrou que o rótulo `ITAU`, que é
// 4.449 das 4.670 linhas cruzáveis do ano, casa com QUATRO contas diferentes do Omie. Sem de-para não há por onde
// recortar o DFC por conta, e cada número que sai dele diz isso ao lado, em `naoVale[]`.
function contasBancarias(contas) {
  const porNome = new Map();
  for (const c of contas) {
    const nome = String(c.dito_como ?? c.descricao ?? '').trim();
    if (!nome) continue;
    if (!porNome.has(nome)) porNome.set(nome, { nome, codigos: {} });
    (porNome.get(nome).codigos[String(c.empresa)] ??= []).push(String(c.nCodCC));
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function filtroDeConta(q, opcoes) {
  const pedidos = new Set(comoLista(q?.conta));
  const escolhidas = opcoes.filter((c) => pedidos.has(c.nome));
  const porEmpresa = {};
  for (const c of escolhidas) {
    for (const [emp, cods] of Object.entries(c.codigos)) for (const cod of cods) (porEmpresa[emp] ??= new Set()).add(cod);
  }
  return {
    conta: {
      ativo: escolhidas.length > 0,
      nomes: escolhidas.map((c) => c.nome),
      desconhecidos: [...pedidos].filter((n) => !opcoes.some((c) => c.nome === n)),
      porEmpresa,
      pega: (emp, nCodCC) => escolhidas.length === 0 || Boolean(porEmpresa[String(emp)]?.has(String(nCodCC ?? ''))),
    },
  };
}

// A frase do "por que não" da conta, num lugar só, como a do filtro de empresa: as três telas a escrevem, e ela tem de
// ser a mesma em todas — é a prova do cruzamento, e não uma opinião de cada tela.
//
// SEM SEPARADOR DE MILHAR nas duas frases abaixo, de propósito: elas são escritas na TELA, e a trava de
// `scripts/capturar-tela.mjs` recusa a captura em que sobre um número de milhar — ela não sabe distinguir uma
// contagem de um valor em reais, e é bom que não saiba. As contagens exatas do cruzamento estão em `docs/filtros.md`.
const PORQUE_O_DFC_NAO_TEM_CONTA = 'a coluna `BANCO` do `FLUXO DE CAIXA` existe, mas os rótulos dela não são as contas '
  + 'do Omie: o cruzamento de 27/09/2026 (`scripts/de-para-conta-dfc.mjs`) casou o rótulo `ITAU` — que é 95% das linhas '
  + 'cruzáveis do ano — com QUATRO contas diferentes do Omie, por data, valor e nome do cliente/fornecedor, e ainda '
  + 'deixou 113 linhas casando com mais de uma conta ao mesmo tempo. Sem de-para, o número do DFC é de todas as '
  + 'contas somadas; a contagem do Omie, ao lado, está filtrada (as contagens inteiras estão em `docs/filtros.md`)';

// E a do cliente/fornecedor, pelo mesmo motivo: a Tela 1 a escreve em vários cartões e blocos.
const PORQUE_O_DFC_NAO_TEM_FORNECEDOR = 'no DFC o cliente/fornecedor é um NOME digitado à mão na coluna '
  + '`FORNECEDOR / CLIENTE` (G), sem código nenhum, e o filtro escolhe pelo `nCodCliente` do cadastro do Omie: '
  + 'cruzando as linhas cruzáveis do ano com o cadastro `geral/clientes` por data, valor e nome (27/09/2026, '
  + '`scripts/de-para-conta-dfc.mjs`), 76% delas não acharam nome nenhum. Sem de-para, o número do DFC é de todos '
  + 'os clientes e fornecedores; a contagem do Omie, ao lado, está filtrada (as contagens inteiras estão em '
  + '`docs/filtros.md`)';

// ================================================================ Tela 2 — vários meses de uma vez
//
// A tela já tinha uma coluna por mês; o filtro escolhe QUAIS colunas, e os cartões do topo passam a somar os meses
// escolhidos em vez de mostrarem um só. Sem escolha nenhuma nada muda: todas as colunas, cartões no mês da URL. Mês
// fora de 1–12 é ignorado; quais dos escolhidos têm coluna é a tela que decide (jan–mar ficam fora dela por decisão do
// dono de 27/09/2026, e mês sem planilha do DFC também).
function filtroDaTela2(q) {
  const pedidos = comoLista(q?.meses).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  const meses = [...new Set(pedidos)].sort((a, b) => a - b);
  return { meses: { ativo: meses.length > 0, lista: meses } };
}

// ================================================================ Tela 3 — vencimento, status, cliente, categoria
//
// AS TRÊS FAIXAS DE STATUS são as do de-para do dono (25/09/2026), que `lib/regras/listas.mjs` guarda: o filtro fala a
// língua da tela (pago · atrasado · em aberto) e cada faixa é o conjunto de `cStatus` que aquela decisão lhe dá.
// `CANCELADO` não é opção — ele fica fora da tela, inteiro.
const FAIXAS_DE_STATUS = [
  { chave: 'pago', nome: 'Pago', status: ['RECEBIDO', 'LIQUIDADO'] },
  { chave: 'atrasado', nome: 'Atrasado', status: ['ATRASADO'] },
  { chave: 'aberto', nome: 'Em aberto', status: ['EMABERTO', 'AVENCER', 'VENCEHOJE', 'PAGTO_PARCIAL'] },
];

// O CLIENTE É O PAR EMPRESA + CÓDIGO, e não o código solto: `nCodCliente` é próprio de cada empresa, como o
// `cCodDepartamento`. Na URL ele vai como `2-1234567` — o código, nunca o nome.
const chaveDoCliente = (emp, cod) => `${emp}-${cod}`;
const lerChaveDoCliente = (s) => { const m = /^([12])-(\d+)$/.exec(String(s ?? '')); return m ? { empresa: m[1], codigo: m[2] } : null; };

// Sem `de` / `ate` na URL, a janela é o mês escolhido — a mesma de sempre, e a mesma que `docs/conferencia.md` confere.
function filtroDaTela3(q, { ano, mes }) {
  const doMesDe = `01/${dois(mes)}/${ano}`, doMesAte = `${ultimoDia(ano, mes)}/${dois(mes)}/${ano}`;
  const de = dataDeFiltro(q?.de) ?? doMesDe;
  const ate = dataDeFiltro(q?.ate) ?? doMesAte;
  const doMes = de === doMesDe && ate === doMesAte;
  const faixas = comoLista(q?.status).map((s) => s.toLowerCase())
    .filter((s) => FAIXAS_DE_STATUS.some((f) => f.chave === s));
  const cliente = lerChaveDoCliente(comoTexto(q?.cliente));
  const categoria = comoTexto(q?.categoria);
  return {
    vencimento: { de, ate, ativo: !doMes, doMes },
    status: { ativo: faixas.length > 0, faixas: [...new Set(faixas)] },
    cliente: { ativo: Boolean(cliente), empresa: cliente?.empresa ?? null, codigo: cliente?.codigo ?? null },
    categoria: { ativo: Boolean(categoria), codigo: categoria ?? null },
  };
}

// ================================================================ o filtro de empresa — as TRÊS telas
//
// DECISÃO DO DONO, 27/09/2026: empresa 1, empresa 2 ou as duas. É o primeiro filtro que atravessa as três telas, e ele
// não é regra nova nenhuma: as telas sempre somaram as filiais `/0001-42` (empresa 1) e `/0002-23` (empresa 2) do Omie
// (`docs/fontes.md`), e este filtro escolhe QUAIS das duas entram na soma.
//
// NA URL, como todos os outros: `?empresa=1`, `?empresa=2` — e `?empresa=1,2`, que é o mesmo que sem filtro, porque
// escolher as duas é a soma de sempre. A pílula "as duas" limpa a escolha.
//
// ONDE ELE NÃO VALE: EM TODO NÚMERO QUE VEM DO DFC. As planilhas separam as linhas pela coluna `EMP.` (A), com `B3W`
// e `N3`, e **nenhum dos dois é filial do Omie** — o cruzamento de 27/09/2026 (`scripts/de-para-empresa-dfc.mjs`,
// registrado em `docs/fontes.md`) casou linhas `B3W` com as duas empresas, inclusive duas no mesmo dia. Sem de-para
// não há por onde recortar o DFC por empresa, e cada número que sai dele diz isso ao lado, em `naoVale[]`.
const EMPRESAS_DO_FILTRO = ['1', '2'];

// A frase do "por que não", num lugar só: as Telas 1 e 2 a escrevem em vários cartões e linhas, e ela tem de ser a
// mesma em todos — é a prova do cruzamento, e não uma opinião de cada tela.
const PORQUE_O_DFC_NAO_TEM_EMPRESA = 'a coluna `EMP.` do `FLUXO DE CAIXA` separa as linhas em `B3W` e `N3`, e nenhum '
  + 'dos dois é filial do Omie: o cruzamento de 27/09/2026 (`scripts/de-para-empresa-dfc.mjs`) casou 565 linhas `B3W` '
  + 'só com a empresa 1 e 481 só com a empresa 2 — por data, valor e nome do cliente/fornecedor, duas delas no mesmo '
  + 'dia. Sem de-para, o número do DFC é das duas empresas somadas; a contagem do Omie, ao lado, está filtrada';

// Empresa que não é 1 nem 2 vai para `desconhecidos` e é ignorada, como o nome de centro de custo fora do cadastro:
// filtro escrito errado na URL não pode virar filtro vazio que esconde a tela inteira.
function filtroDeEmpresa(q, empresas = EMPRESAS_DO_FILTRO) {
  const pedidos = comoLista(q?.empresa).map(String);
  const escolhidas = [...new Set(pedidos.filter((e) => empresas.includes(e)))].sort();
  const desconhecidos = [...new Set(pedidos.filter((e) => !empresas.includes(e)))];
  // Sem escolha — ou com as duas escolhidas — valem as duas, e o filtro está desligado: é a soma de sempre.
  const valem = escolhidas.length ? escolhidas : [...empresas];
  return {
    empresa: {
      ativo: escolhidas.length > 0 && escolhidas.length < empresas.length,
      escolhidas, desconhecidos, valem,
      pega: (emp) => valem.includes(String(emp)),
    },
  };
}

// ================================================================ a frase de "aqui este filtro não vale"
//
// Uma por número que o filtro escolhido não alcança. A tela a escreve JUNTO do número; `docs/filtros.md` lista todas.
const naoVale = (filtro, onde, porque) => ({ filtro, onde, porque });

export {
  comoLista, comoTexto, dataDeFiltro, paraCampoDeData,
  centrosDeCusto, filtroDaTela1, filtroDaTela2, filtroDaTela3,
  EMPRESAS_DO_FILTRO, PORQUE_O_DFC_NAO_TEM_EMPRESA, filtroDeEmpresa,
  SITUACOES, filtroDeSituacao, comoClasseDoDfc,
  contasBancarias, filtroDeConta, PORQUE_O_DFC_NAO_TEM_CONTA, PORQUE_O_DFC_NAO_TEM_FORNECEDOR,
  FAIXAS_DE_STATUS, chaveDoCliente, lerChaveDoCliente, naoVale,
};
