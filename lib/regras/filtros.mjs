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
// O que NÃO está aqui: fornecedor, conta corrente, categoria e situação nas Telas 1 e 2, e qualquer outro filtro que o
// documento não registre — esses esperam decisão do dono, e nenhuma linha deste arquivo os adivinha.
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
function filtroDaTela1(q, centros) {
  const pedidos = new Set(comoLista(q?.cc));
  const escolhidos = centros.filter((c) => pedidos.has(c.nome));
  const porEmpresa = {};
  for (const c of escolhidos) {
    for (const [emp, cods] of Object.entries(c.codigos)) for (const cod of cods) (porEmpresa[emp] ??= new Set()).add(cod);
  }
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
  };
}

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
  FAIXAS_DE_STATUS, chaveDoCliente, lerChaveDoCliente, naoVale,
};
