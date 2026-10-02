// TELA 1 — GESTÃO DE CONTAS. Os 11 indicadores de `docs/fontes.md`, cada um com o VALOR que a tela mostra e a
// CONTAGEM que `docs/conferencia.md` publica.
//
// POR QUE OS DOIS JUNTOS. O valor é dinheiro e nunca entra em arquivo versionado — vive na memória do servidor e vai
// para a tela. A contagem (quantos lançamentos entraram) é o que a conferência já publica, e é por ela que
// `scripts/conferir-telas.mjs` compara a tela com a conferência: se o filtro da tela sair do que `docs/fontes.md`
// manda, a contagem muda e a linha sai "divergente:".
//
// NENHUMA REGRA MORA AQUI. Os filtros vêm de `lib/regras/` — os mesmos que `scripts/numeros-das-telas.mjs` usa.
//
// O FILTRO DE CENTRO DE CUSTO (`docs/fontes.md`, "Tela 1 — Gestão de Contas": ano · mês · centro de custo, seleção
// múltipla). Ele entra por `filtro.cc`, uma lista de NOMES de departamento, e sai resolvido em `cCodDepartamento` de
// cada empresa por `lib/regras/filtros.mjs` — a junção pelo nome é decisão do dono de 25/09/2026, porque nenhum código
// coincide entre as duas empresas. Aqui ele só é APLICADO, de dois jeitos:
//
//   na CONTAGEM, como um predicado a mais no `contar` de `lib/regras/movimentos.mjs`: entra o lançamento que tem
//   alguma linha de rateio num dos centros escolhidos;
//   no VALOR, pelo `nDistrValor` daquelas linhas de rateio, e não pelo valor inteiro do título — um título repartido
//   50/50 entre dois centros entra com metade em cada, que é o que `docs/fontes.md` manda somar.
//
// DE ONDE VEM O RATEIO. `departamentos[]` só volta do Omie quando a consulta pede `cExibirDepartamentos: "S"`, e a
// leitura das Telas 1 e 2 não pede. Quem pede é a leitura de confronto do "Top 10 despesas" (`MF_DEP` no cache), que é
// a MESMA consulta com a mesma janela: as duas devolvem os mesmos lançamentos, um a um, e por isso o rateio é casado
// aqui pela identidade do lançamento (`nCodMovCC` + `nCodTitulo` + `cGrupo`). Se essa leitura faltar no cache, o filtro
// se declara indisponível e a tela diz isso — nunca devolve tela vazia fingindo que filtrou.
//
// ONDE ELE NÃO VALE, e por quê, está em `docs/filtros.md` e sai daqui em `naoVale[]`, indicador por indicador: o DFC
// não tem coluna de centro de custo, e a leitura de títulos a pagar por vencimento não traz rateio nenhum.
//
// O FILTRO DE EMPRESA (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas. Esta tela sempre somou as duas
// filiais do Omie, e o filtro escolhe QUAIS entram na soma — ele entra em `filtro.empresa` e é aplicado aqui pelo lado
// do Omie, que é lido uma vez por empresa: os três baldes, o pessoal e os títulos a pagar por vencimento.
//
// O LADO DO DFC NÃO ACEITA ESSE FILTRO, e é o único caso em que o cartão "Desp. Pendentes" aceita um filtro que os
// outros não aceitam. A planilha separa as linhas por `EMP.` (`B3W` / `N3`), e o cruzamento de 27/09/2026
// (`scripts/de-para-empresa-dfc.mjs`, em `docs/fontes.md`) mostrou que nenhum dos dois rótulos é filial do Omie. Então
// todo número de fonte DFC sai do mês inteiro, das duas empresas, e diz isso ao lado — em `naoVale[]`, como sempre.
//
// E OS QUATRO FILTROS QUE O DONO APROVOU EM 27/09/2026, todos aplicados aqui e nenhum decidido aqui:
//
//   CATEGORIA, DE DUAS PONTAS. `classe` é a `CLASS. CONTABIL` do DFC — a MESMA classificação que o "Top 10 despesas"
//   agrupa — e recorta as linhas do `FLUXO DE CAIXA`; `categoria` é o `cCodCateg` do Omie e recorta os lançamentos.
//   São dois vocabulários sem de-para entre si, então cada ponta diz, ao lado do número da outra, que não a alcança.
//
//   CLIENTE/FORNECEDOR. O par empresa + `nCodCliente`, do lado do Omie. No DFC o cliente/fornecedor é um NOME
//   digitado à mão, sem código: das 4.670 linhas cruzáveis de 2026, 3.550 não acham nome nenhum no cadastro
//   (`scripts/de-para-conta-dfc.mjs`, 27/09/2026). O lado do DFC não é recortado, e diz isso.
//
//   SITUAÇÃO — pago · recebido · a pagar. É o ÚNICO dos quatro que alcança o VALOR do DFC, porque os três rótulos são,
//   letra por letra, os valores da coluna `PAGAMENTO` (N) do `FLUXO DE CAIXA`. Do lado do Omie o de-para é a natureza
//   do lançamento (a leitura é de caixa e tudo nela já está baixado), e "a pagar" é o cartão "Desp. Pendentes".
//
//   CONTA BANCÁRIA. O `nCodCC` do lançamento, pelas contas da MeuBESS de `dados/contas-correntes-por-negocio.json`,
//   juntando as duas empresas pelo `dito_como` do dono. O DFC tem coluna `BANCO`, mas os rótulos dela não são as
//   contas do Omie — `ITAU`, que é 4.449 das 4.670 linhas do ano, casa com quatro contas diferentes — e por isso todo
//   número de fonte DFC sai de todas as contas somadas, e diz isso ao lado.

// DE ONDE VÊM AS FONTES: DA BASE LOCAL (decisão do dono, 27/09/2026, "cada clique num filtro demora uma eternidade").
// O cache do Omie, o recorte da MeuBESS e as planilhas do DFC não são lidos aqui a cada cálculo: quem lê é
// `lib/regras/base-local.mjs`, uma vez por ano pedido, e `lib/dados.mjs` guarda essa base e a renova na abertura, na
// virada da hora e no "atualizar agora". O `base` chega por parâmetro; sem ele — como nos scripts da conferência, que
// rodam uma vez e saem — uma base nova é montada aqui mesmo, e a leitura é a de sempre. O filtro não muda nada do que
// se lê: ele recorta DEPOIS, e é por isso que a base pode ser a mesma para todas as combinações de filtro da Tela 1.

import { novaBase } from '../regras/base-local.mjs';
import { criarRegras, valorOmie } from '../regras/movimentos.mjs';
import { noMesDe } from '../regras/periodo.mjs';
import { ePessoalDfc, eDeducaoDfc, eReceitaTela1Dfc, serieDoFluxo, DFC_RECEITA } from '../regras/dfc.mjs';
import { PESSOAL } from '../regras/listas.mjs';
import { itemDfc, itemTitulo, lista, razao } from './composicao.mjs';
import {
  centrosDeCusto, filtroDaTela1, filtroDeEmpresa, naoVale, PORQUE_O_DFC_NAO_TEM_EMPRESA,
  SITUACOES, filtroDeSituacao, contasBancarias, filtroDeConta,
  PORQUE_O_DFC_NAO_TEM_CONTA, PORQUE_O_DFC_NAO_TEM_FORNECEDOR,
  filtroDoOmie, contagemSemOmie, semOmie,
} from '../regras/filtros.mjs';

const naLista = (lista) => (cod) => lista.includes(cod);
const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// No DFC a saída já vem negativa; a tela mostra despesa como número positivo.
const modulo = (c) => Math.abs(c);

// A IDENTIDADE DE UM LANÇAMENTO dentro de uma leitura de `financas/mf`, para casar a leitura das telas com a leitura
// que traz o rateio por departamento. As duas são a mesma consulta na mesma janela, e esta trinca é única em cada uma.
const chaveDoMovimento = (d) => `${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`;

async function calcularTela1({ raiz, ano, mes, fonte, filtro = {}, base = null }) {
  const noMes = noMesDe(ano, mes);
  const BASE = base ?? novaBase({ raiz, ano, fonte });
  const OMIE = BASE.cacheOmie();
  const { EMPRESAS, movimentos, categorias, departamentos, comDep, cpVenc, clientes } = OMIE;
  const recorte = BASE.recorte();
  // O mês desta tela E a série do ano — os doze meses de planilha, que é o que o gráfico de "Receita × despesa por
  // mês" desenha. Na base, cada arquivo é aberto uma vez só, e a Tela 2 acha os mesmos doze meses já lidos.
  const DFC = await BASE.dfc({ mes, comSerie: true });

  // ---------------------------------------------------------------- o filtro de empresa
  //
  // `ATIVAS` são as empresas que entram na soma: as duas, sem filtro. Tudo o que vem do Omie é lido por empresa e
  // somado sobre esta lista; o que vem do DFC não tem por onde ser recortado (ver `naoVale[]` no fim).
  const { empresa } = filtroDeEmpresa(filtro, EMPRESAS);
  const ATIVAS = EMPRESAS.filter((emp) => empresa.pega(emp));

  // ---------------------------------------------------------------- os outros filtros da tela
  //
  // Todos lidos num lugar só, `lib/regras/filtros.mjs`, e todos transparentes quando vazios — é por isso que a
  // conferência com filtro vazio continua contando o mesmo de sempre.
  const centros = centrosDeCusto(departamentos);
  const { cc, classe, categoria: fCategoria, fornecedor } = filtroDaTela1(filtro, centros);
  const opcoesDeConta = contasBancarias(BASE.contas());
  const { conta } = filtroDeConta(filtro, opcoesDeConta);
  const { situacao } = filtroDeSituacao(filtro);
  // A CHAVE "INCLUIR DADOS DO OMIE" (decisão do dono, 28/09/2026). Ela não recorta nada: o cálculo abaixo é o de
  // sempre, inteiro, e o lado do Omie é apagado no FIM — ver "a chave desligada", perto dos 11 indicadores. Ligada,
  // que é o padrão, ela não toca em linha nenhuma deste arquivo.
  const { omie: chaveOmie } = filtroDoOmie(filtro);
  // O rateio por departamento, casado lançamento a lançamento com a leitura das telas. Falta a leitura só conta nas
  // empresas que estão na soma: com o filtro de empresa em uma delas, a leitura da outra não é pedida.
  const faltaDep = ATIVAS.filter((emp) => !comDep[emp]);
  const rateioPorMov = {};
  for (const emp of EMPRESAS) {
    rateioPorMov[emp] = new Map();
    for (const m of (comDep[emp] ?? [])) {
      const deps = m.departamentos ?? [];
      if (deps.length) rateioPorMov[emp].set(chaveDoMovimento(m.detalhes ?? {}), deps);
    }
  }
  // O `_deps` viaja com o lançamento, e é o único campo que esta camada acrescenta ao que o cache devolveu.
  const comRateio = Object.fromEntries(EMPRESAS.map((emp) => [emp, movimentos[emp].map((m) => ({
    ...m, detalhes: { ...m.detalhes, _deps: rateioPorMov[emp].get(chaveDoMovimento(m.detalhes ?? {})) ?? [] },
  }))]));
  // O filtro só é aplicado se houver rateio para aplicar. Sem a leitura `MF_DEP` no cache ele se declara indisponível.
  const ccVale = cc.ativo && faltaDep.length === 0;
  const valorDe = ccVale ? (emp, d) => cc.rateio(emp, d._deps) : (emp, d) => valorOmie(d);

  // O PREDICADO DO LADO DO OMIE: um só, montado dos filtros que estão ligados, e passado ao gancho `linha` de
  // `lib/regras/movimentos.mjs` — o único ponto por onde uma tela pode apertar o recorte. Sem filtro nenhum ele é
  // `null`, e `contar` volta a ser o de sempre.
  const doOmie = (emp) => {
    const ps = [];
    if (ccVale) ps.push((d) => cc.pega(emp, d._deps));
    if (conta.ativo) ps.push((d) => conta.pega(emp, d.nCodCC));
    if (fCategoria.ativo) ps.push((d) => fCategoria.pega(String(d.cCodCateg ?? '')));
    if (fornecedor.ativo) ps.push((d) => fornecedor.pega(emp, d.nCodCliente));
    if (situacao.ativo) ps.push((d) => situacao.pegaOmie(d));
    return ps.length ? (d) => ps.every((p) => p(d)) : null;
  };
  const doCc = { linha: doOmie };
  // Quantos lançamentos do mês não têm rateio nenhum: eles não têm nome para juntar e ficam fora de qualquer escolha
  // de centro de custo (`docs/fontes.md`, "3. Departamentos"). A tela mostra este número junto do filtro.
  const semRateio = {};

  const { contar } = criarRegras({ movimentos: comRateio, categorias, recorte });

  // Os três baldes do mês, por empresa e natureza — a base do lado do Omie, igual à da conferência. Só as empresas
  // que o filtro deixou na soma são lidas e somadas; sem filtro, são as duas, como sempre.
  const R = {}, P = {};
  for (const emp of ATIVAS) {
    R[emp] = contar(emp, noMes, 'R', { linha: doCc.linha(emp) });
    P[emp] = contar(emp, noMes, 'P', { linha: doCc.linha(emp) });
  }
  // `contar` sem `linha` é o mês inteiro, sem escolha de centro de custo: é dele que sai quantos lançamentos não
  // têm rateio nenhum e por isso não caem em nenhum nome. Este número é das DUAS empresas, sempre, porque a tela o
  // mostra quebrado por empresa junto do filtro de centro de custo.
  for (const emp of EMPRESAS) {
    semRateio[emp] = [...contar(emp, noMes, 'R').todos, ...contar(emp, noMes, 'P').todos]
      .filter((d) => (d._deps ?? []).length === 0).length;
  }
  // AS OPÇÕES DE CATEGORIA E DE CLIENTE/FORNECEDOR SAEM DO PRÓPRIO MÊS, e não do cadastro inteiro: um código sem
  // lançamento no mês não vira opção, porque escolhê-lo só daria tela vazia. E elas são montadas ANTES de a categoria
  // e o cliente/fornecedor serem aplicados — senão escolher um apagaria os outros da lista e não haveria como trocar.
  // É o mesmo desenho da Tela 3.
  const baseDoMes = ATIVAS.flatMap((emp) => [...contar(emp, noMes, 'R').todos, ...contar(emp, noMes, 'P').todos]
    .map((d) => ({ emp, d })));
  const opcoesDeCategoria = [...new Map(baseDoMes.map(({ emp, d }) => {
    const cod = String(d.cCodCateg ?? '');
    return [cod, { codigo: cod, descricao: categorias[emp].get(cod)?.descricao ?? cod }];
  })).values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  // O LANÇAMENTO SEM `nCodCliente` FICA FORA DA LISTA, e não vira uma opção vazia: ele não tem código para escolher,
  // e uma opção com `data-codigo=""` também faria a trava de `scripts/capturar-tela.mjs` recusar a captura, porque ela
  // não teria por onde trocar o nome pelo código. Quantos são vai para a tela, ao lado do filtro.
  const semCliente = baseDoMes.filter(({ d }) => !d.nCodCliente).length;
  const opcoesDeFornecedor = [...new Map(baseDoMes.filter(({ d }) => d.nCodCliente).map(({ emp, d }) => {
    const cod = String(d.nCodCliente);
    return [`${emp}-${cod}`, { chave: `${emp}-${cod}`, empresa: emp, codigo: cod, nome: clientes[emp]?.nomes?.get(cod) ?? null }];
  })).values()].sort((a, b) => (a.nome ?? a.codigo).localeCompare(b.nome ?? b.codigo, 'pt-BR'));

  const totalR = somar(ATIVAS.map((emp) => R[emp].total)), totalP = somar(ATIVAS.map((emp) => P[emp].total));
  const todosR = ATIVAS.flatMap((emp) => R[emp].todos), todosP = ATIVAS.flatMap((emp) => P[emp].todos);

  // Pessoal, do lado do Omie (confronto): categorias de pessoal, pagas no mês, no centro de custo escolhido.
  const pes = {};
  for (const emp of ATIVAS) pes[emp] = contar(emp, noMes, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false, linha: doOmie(emp) });
  const pessoalPagos = ATIVAS.flatMap((emp) => pes[emp].todos).filter((d) => d.cStatus === 'PAGO');

  // Despesas pendentes — a exceção ao caixa: por VENCIMENTO, sem baixa (`cLiquidado = "N"`). É do Omie inteiro, e por
  // isso o filtro de empresa vale aqui no valor E na contagem — ao contrário do de centro de custo.
  const pend = {};
  const faltaCp = ATIVAS.filter((emp) => !cpVenc[emp]);
  // O CARTÃO É "A PAGAR" INTEIRO: título sem baixa. Então a SITUAÇÃO o alcança pelo cartão todo — escolher só "pago"
  // ou só "recebido" o deixa vazio, e escolher "a pagar" o deixa inteiro —, e a CONTA, a CATEGORIA do Omie e o
  // CLIENTE/FORNECEDOR o alcançam lançamento a lançamento, porque são campos do próprio título. O centro de custo
  // continua sendo o único que não o alcança: esta leitura não traz `departamentos[]`.
  for (const emp of ATIVAS) {
    pend[emp] = !situacao.pegaPendente() ? [] : (cpVenc[emp] ?? []).map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} })).filter((d) =>
      d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`) && noMes(d.dDtVenc) && (d._resumo.cLiquidado ?? 'N') === 'N'
      && conta.pega(emp, d.nCodCC)
      && (!fCategoria.ativo || fCategoria.pega(String(d.cCodCateg ?? '')))
      && fornecedor.pega(emp, d.nCodCliente));
  }
  const pendTodos = ATIVAS.flatMap((emp) => pend[emp]);

  // ---------------------------------------------------------------- o lado do DFC
  //
  // DOIS DOS FILTROS NOVOS ALCANÇAM O DFC, porque são colunas da própria planilha: a CLASSIFICAÇÃO (`CLASS. CONTABIL`,
  // a mesma que o "Top 10 despesas" agrupa) e a SITUAÇÃO (`PAGAMENTO`, com os rótulos `PAGO`, `RECEBIDO` e `A PAGAR`).
  // Os outros dois — conta bancária e cliente/fornecedor — não, e cada número daqui diz isso ao lado.
  const todasAsLinhas = DFC.ok ? DFC.linhas : [];
  // As opções de classificação saem do próprio mês, como as de categoria do Omie, e antes de o filtro ser aplicado.
  const opcoesDeClasse = [...new Set(todasAsLinhas.map((l) => l.classe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const passaNoDfc = (l) => (!classe.ativo || classe.pega(l.classe)) && situacao.pegaDfc(l.pagamento);
  const L = todasAsLinhas.filter(passaNoDfc);
  // As entradas que contam como receita: `eReceitaTela1Dfc` tira as linhas de transferência entre contas
  // (decisão do dono, 27/09/2026), que não são receita. A regra mora em `lib/regras/dfc.mjs`, num lugar só.
  const dfcR = L.filter(eReceitaTela1Dfc);
  const dfcP = L.filter((l) => l.natureza === 'P');
  const dfcPagas = dfcP.filter((l) => l.pagamento === 'PAGO');
  const dfcPessoal = L.filter(ePessoalDfc);
  const dfcReceitaLinhas = dfcR.filter((l) => DFC_RECEITA.includes(l.sub2));
  const dfcDeducoes = L.filter(eDeducaoDfc);
  const receitaLiquida = somar(dfcReceitaLinhas.map((l) => l.valor)) - somar(dfcDeducoes.map((l) => modulo(l.valor)));
  const pessoalTotal = somar(dfcPessoal.map((l) => modulo(l.valor)));

  // Top 10 despesas: o DFC agrupado por `CLASS. CONTABIL` — cada linha tem UMA classificação, não há rateio.
  const porClasse = new Map();
  for (const l of dfcP) porClasse.set(l.classe, (porClasse.get(l.classe) ?? 0) + modulo(l.valor));
  const top10Despesas = [...porClasse.entries()].map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor).slice(0, 10);

  // Top 10 receitas: o Omie é a fonte principal aqui. A descrição sai da categoria do lançamento — o caminho que a
  // decisão do dono de 25/09/2026 manda usar quando não há pedido de venda atrás do título — mas a TELA mostra o
  // cliente no lugar dela (decisão do dono, 27/09/2026): o nome sai de `geral/clientes`, como na Tela 3, com o
  // código junto porque é por ele que `scripts/capturar-tela.mjs` troca o nome antes de a captura entrar no
  // repositório.
  const descricaoDe = (emp, d) => categorias[emp].get(String(d.cCodCateg))?.descricao ?? String(d.cCodCateg ?? '—');
  const clienteDe = (emp, d) => {
    const cod = String(d.nCodCliente ?? '');
    return { codigo: cod, nome: clientes[emp]?.nomes?.get(cod) ?? null };
  };
  //
  // COM O FILTRO DE CENTRO DE CUSTO LIGADO, o valor de cada linha é o `nDistrValor` das linhas de rateio escolhidas —
  // `valorDe` cuida disso. Sem filtro é o valor do lançamento, como sempre.
  const receitasComValor = ATIVAS.flatMap((emp) => R[emp].todos.map((d) => ({ d, emp })))
    .map(({ d, emp }) => ({
      descricao: descricaoDe(emp, d), cliente: clienteDe(emp, d), data: d.dDtPagamento, status: d.cStatus, valor: valorDe(emp, d),
    })).sort((a, b) => b.valor - a.valor).slice(0, 10);

  // Os gráficos usam as linhas baixadas do FLUXO DE CAIXA; o quadro pronto da aba do mês está desatualizado.
  const dias = DFC.ok ? serieDoFluxo(DFC.linhas, ano, mes) : [];
  const serieOk = DFC.ok ? DFC.serie.filter((x) => x.ok) : [];
  const meses = serieOk.map((x) => ({
    mes: x.mes,
    entradas: somar(x.porDia?.entradas ?? []),
    gastos: somar(x.porDia?.gastos ?? []),
  }));

  // ---------------------------------------------------------------- onde o centro de custo não vale
  //
  // Estas frases só existem quando o filtro está ligado, e a tela as escreve JUNTO do número. São três motivos, e
  // nenhum é escolha nossa:
  //
  //   O DFC NÃO TEM CENTRO DE CUSTO. A aba `FLUXO DE CAIXA` classifica cada linha por `CLASS. CONTABIL` e `SUB 2`, e
  //   não por departamento — não há coluna para filtrar. Onde o DFC é a fonte principal, o VALOR sai do mês inteiro; a
  //   contagem do Omie, ao lado, sai filtrada.
  //   A LEITURA DE TÍTULOS A PAGAR POR VENCIMENTO NÃO TRAZ RATEIO. O cartão "Desp. Pendentes" é a exceção ao caixa
  //   (`docs/fontes.md`): ele sai de `cTpLancamento: "CP"` por vencimento, sem `cExibirDepartamentos`, e um título
  //   ainda não pago nem está na leitura de caixa de onde o rateio vem. Este cartão não aceita o filtro, nem no valor
  //   nem na contagem.
  //   FALTANDO A LEITURA COM RATEIO no cache, o filtro não é aplicado em lugar nenhum — e a tela diz isso.
  const doDfc = (oQue) => naoVale('centro de custo', oQue,
    'a aba `FLUXO DE CAIXA` do DFC classifica cada linha por `CLASS. CONTABIL` e `SUB 2`, e não por departamento: não há por onde filtrar. O número do DFC é do mês inteiro; a contagem do Omie, ao lado, está filtrada');
  const seCc = (...frases) => (ccVale ? frases : []);

  // E O MESMO PARA O FILTRO DE EMPRESA, nos mesmos lugares: onde o DFC é a fonte, o número é das duas empresas
  // somadas, porque o de-para de `EMP.` com as filiais do Omie não fecha (`docs/fontes.md`). A diferença é o cartão
  // "Desp. Pendentes": ele é do Omie, e o filtro de empresa vale nele inteiro.
  const doDfcEmpresa = (oQue) => naoVale('empresa', oQue, PORQUE_O_DFC_NAO_TEM_EMPRESA);
  const seEmpresa = (...frases) => (empresa.ativo ? frases : []);

  // E OS QUATRO DE 27/09/2026. Três deles não alcançam o lado do DFC, cada um por um motivo medido; o quarto, a
  // classificação do DFC, é o contrário — ele alcança o DFC e NÃO alcança a contagem do Omie, porque o `cCodCateg` do
  // Omie e a `CLASS. CONTABIL` da planilha são dois vocabulários sem de-para.
  const doDfcConta = (oQue) => naoVale('conta bancária', oQue, PORQUE_O_DFC_NAO_TEM_CONTA);
  const doDfcFornecedor = (oQue) => naoVale('cliente/fornecedor', oQue, PORQUE_O_DFC_NAO_TEM_FORNECEDOR);
  const doDfcCategoria = (oQue) => naoVale('categoria (a do Omie)', oQue,
    'a categoria escolhida é um `cCodCateg` do plano de contas do Omie, e o DFC classifica cada linha por `CLASS. CONTABIL` e `SUB 2`, que saem do cadastro da aba `BASE`: nenhuma das duas fontes escreve o de-para entre os dois vocabulários. Para recortar também o lado do DFC, escolha uma classificação do DFC ao lado');
  const doOmieClasse = (oQue) => naoVale('categoria (a classificação do DFC)', oQue,
    'a classificação escolhida é a `CLASS. CONTABIL` da planilha, e o lançamento do Omie não a tem — ele tem `cCodCateg`, do plano de contas do Omie, e as duas fontes não têm de-para entre os dois vocabulários. Para recortar também o lado do Omie, escolha uma categoria do Omie ao lado');
  const seConta = (...frases) => (conta.ativo ? frases : []);
  const seFornecedor = (...frases) => (fornecedor.ativo ? frases : []);
  const seCategoria = (...frases) => (fCategoria.ativo ? frases : []);
  const seClasse = (...frases) => (classe.ativo ? frases : []);
  const seSituacao = (...frases) => (situacao.ativo ? frases : []);

  // A LISTA DE UM CARTÃO DE FONTE DFC: tudo o que não alcança o valor dele, mais a ponta do Omie que a classificação
  // do DFC não alcança.
  const seFiltros = (oQue, oQueNoOmie = 'a contagem do Omie deste cartão') => [
    ...seCc(doDfc(oQue)),
    ...seEmpresa(doDfcEmpresa(oQue)),
    ...seConta(doDfcConta(oQue)),
    ...seFornecedor(doDfcFornecedor(oQue)),
    ...seCategoria(doDfcCategoria(oQue)),
    ...seClasse(doOmieClasse(oQueNoOmie)),
  ];
  // A série mostra o caixa consolidado do mês; os filtros de detalhe não recortam estes dois gráficos.
  const seFiltrosNaSerie = (oQue) => [
    ...seFiltros(oQue),
    ...seClasse(naoVale('categoria (a classificação do DFC)', oQue,
      'o gráfico mostra a série consolidada do FLUXO DE CAIXA, sem recorte por `CLASS. CONTABIL`')),
    ...seSituacao(naoVale('situação', oQue,
      'o gráfico mostra apenas linhas baixadas do FLUXO DE CAIXA, sem recorte adicional por situação')),
  ];

  // ---------------------------------------------------------------- o que cada cartão soma (01/10/2026)
  //
  // O "explodir" do DRE levado aos cartões (pedido do dono): no clique, cada cartão abre as MESMAS linhas do DFC ou os
  // MESMOS títulos do Omie que o valor dele somou, já com os filtros da tela. O formato mora em `./composicao.mjs`.
  const doMesDfc = (ls, opcoes) => ls.map(itemDfc(ano, mes, opcoes));
  const emAberto = (d) => Math.round(Number(d._resumo.nValAberto ?? 0) * 100);
  const receitaLiquidaAberta = { rotulo: 'Receita líquida (DFC)', ...lista([mes], receitaLiquida,
    [...doMesDfc(dfcReceitaLinhas, { comSinal: true }), ...doMesDfc(dfcDeducoes, { sinal: -1 })]) };
  const composicoes = {
    saldo: lista([mes], somar(L.map((l) => l.valor)), doMesDfc(L, { comSinal: true })),
    receitas: lista([mes], somar(dfcR.map((l) => l.valor)), doMesDfc(dfcR, { comSinal: true })),
    despesas: lista([mes], somar(dfcP.map((l) => modulo(l.valor))), doMesDfc(dfcP)),
    'despesas-pagas': lista([mes], somar(dfcPagas.map((l) => modulo(l.valor))), doMesDfc(dfcPagas)),
    'despesas-pendentes': lista([mes], somar(pendTodos.map(emAberto)),
      ATIVAS.flatMap((emp) => pend[emp].map(itemTitulo(categorias, emp, mes, emAberto)))),
    'despesas-funcionarios': lista([mes], pessoalTotal, doMesDfc(dfcPessoal)),
    'percentual-funcionarios': razao([mes], receitaLiquida ? pessoalTotal / receitaLiquida : null,
      { rotulo: 'Desp. Funcionários (DFC)', ...lista([mes], pessoalTotal, doMesDfc(dfcPessoal)) }, receitaLiquidaAberta),
  };

  // ---------------------------------------------------------------- os 11 indicadores
  // `contagem.dfc` e `contagem.omie` são os números que `docs/conferencia.md` publica para este indicador.
  const cartoes = [
    { id: 'saldo', nome: 'Saldo', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(L.map((l) => l.valor)), tipo: 'dinheiro',
      contagem: { dfc: L.length, omie: totalR + totalP },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'receitas', nome: 'Receitas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcR.map((l) => l.valor)), tipo: 'dinheiro',
      contagem: { dfc: dfcR.length, omie: totalR },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'despesas', nome: 'Despesas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcP.map((l) => modulo(l.valor))), tipo: 'dinheiro', negativo: true,
      contagem: { dfc: dfcP.length, omie: totalP },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'despesas-pagas', nome: 'Desp. Pagas', fonte: 'DFC (principal) / Omie recortado (confronto)',
      valor: somar(dfcPagas.map((l) => modulo(l.valor))), tipo: 'dinheiro',
      contagem: { dfc: dfcPagas.length, omie: totalP },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'despesas-pendentes', nome: 'Desp. Pendentes', fonte: 'Omie recortado (principal) / DFC (confronto)',
      valor: somar(pendTodos.map((d) => Math.round(Number(d._resumo.nValAberto ?? 0) * 100))), tipo: 'dinheiro',
      semDfc: true, faltaLeitura: faltaCp.length > 0,
      contagem: { dfc: null, omie: pendTodos.length },
      // O MESMO VALOR, título a título, pela data de vencimento: é o que o fluxo DIÁRIO do Fluxo de Caixa desenha como
      // previsão de saída. Não muda o cartão nem a contagem.
      porVencimento: pendTodos.map((d) => ({ venc: d.dDtVenc, valor: Math.round(Number(d._resumo.nValAberto ?? 0) * 100) })),
      naoVale: [
        ...seCc(naoVale('centro de custo', 'este cartão inteiro — o valor E a contagem',
          'ele é a exceção ao caixa e sai da leitura de títulos a pagar por VENCIMENTO (`cTpLancamento: "CP"`), que não pede `cExibirDepartamentos` e não traz `departamentos[]`; um título ainda não pago nem está na leitura de caixa de onde o rateio vem')),
        ...seClasse(naoVale('categoria (a classificação do DFC)', 'este cartão inteiro — o valor E a contagem',
          'ele é do Omie, e o título a pagar não tem `CLASS. CONTABIL` nenhuma: essa coluna é da planilha do DFC. A categoria do Omie, ao lado, o alcança')),
      ],
      avisos: (situacao.ativo && !situacao.pegaPendente())
        ? ['o filtro de situação não escolheu "a pagar", que é o que este cartão inteiro é — título a pagar sem baixa: por isso ele está vazio.']
        : [] },
    { id: 'despesas-funcionarios', nome: 'Desp. Funcionários', fonte: 'DFC (principal) / Omie recortado por categoria de pessoal (confronto)',
      valor: pessoalTotal, tipo: 'dinheiro',
      contagem: { dfc: dfcPessoal.length, omie: pessoalPagos.length },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'percentual-funcionarios', nome: '% D. Func. / Rec. Líquida', fonte: 'DFC nas duas pontas (principal) / a mesma razão no Omie recortado (confronto)',
      valor: receitaLiquida ? pessoalTotal / receitaLiquida : null, tipo: 'percentual',
      contagem: { dfc: dfcPessoal.length, omie: totalR },
      naoVale: seFiltros('as duas pontas desta razão e a contagem do DFC, que são do DFC') },
  ].map((c) => ({ ...c, composicao: composicoes[c.id] }));

  const blocos = [
    { id: 'top-10-despesas', nome: 'Top 10 despesas', fonte: 'DFC (principal) / Omie recortado por centro de custo (confronto)',
      contagem: { dfc: dfcP.length, omie: totalP }, dados: top10Despesas,
      naoVale: seFiltros('as barras, que são o DFC agrupado por `CLASS. CONTABIL`', 'a contagem do Omie deste bloco') },
    { id: 'top-10-receitas', nome: 'Top 10 receitas', fonte: 'Omie recortado (principal) / DFC (confronto)',
      contagem: { dfc: null, omie: totalR }, semDfc: true, dados: receitasComValor,
      naoVale: seClasse(naoVale('categoria (a classificação do DFC)', 'este bloco inteiro — as barras E a contagem',
        'ele é do Omie, e o lançamento do Omie não tem `CLASS. CONTABIL`: essa coluna é da planilha do DFC. A categoria do Omie, ao lado, o alcança')),
      avisos: (situacao.ativo && !situacao.faixas.includes('recebido'))
        ? ['o filtro de situação não escolheu "recebido", e este bloco é de receita: por isso ele está vazio.']
        : [] },
    { id: 'receita-despesa-por-dia', nome: 'Receita × despesa por dia', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: DFC.ok ? dias.length : 0, omie: totalR + totalP }, dados: dias,
      naoVale: seFiltrosNaSerie('as barras, que são o FLUXO DE CAIXA baixado do mês do DFC') },
    { id: 'receita-despesa-por-mes', nome: 'Receita × despesa por mês', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: serieOk.length, omie: totalR + totalP }, dados: meses,
      naoVale: seFiltrosNaSerie('as barras, que são o FLUXO DE CAIXA baixado de cada mês do DFC') },
  ];

  // ---------------------------------------------------------------- a chave "incluir dados do Omie", desligada
  //
  // O QUE SAI DESTA TELA, e é a última coisa que acontece aqui: os números do Omie. A conta acima não mudou nem um
  // pouco — ela roda inteira, com os mesmos filtros —, e o que muda é o que sai por esta porta.
  //
  //   A CONTAGEM "do Omie" DOS 11 INDICADORES vira `null`, e a tela escreve "sem o Omie" onde escrevia o número.
  //   OS DOIS INDICADORES CUJA FONTE PRINCIPAL É O OMIE perdem o valor: "Desp. Pendentes" e "Top 10 receitas". Eles
  //   não têm lado do DFC nenhum (`contagem.dfc` dos dois já é `null` desde sempre), então sem o Omie não sobra
  //   número — e o que fica no lugar é um travessão e a frase de `semOmie()`, e nunca um zero.
  //
  // O QUE FICA: os outros 9, que são do DFC — os seis cartões de fonte DFC, o "Top 10 despesas" e os dois gráficos de
  // receita × despesa, que leem o bloco `Entradas`/`Gastos` já pronto da planilha. O valor deles não muda em nada, e
  // é por isso que a frase de 5 segundos desta tela ("o caixa do mês fechou em X", que é o cartão "Saldo") continua
  // inteira com a chave desligada.
  const SEM_OMIE = {
    'despesas-pendentes': semOmie('este cartão não tem número',
      'ele é a exceção ao caixa e sai da leitura de títulos a pagar por VENCIMENTO do Omie (`cTpLancamento: "CP"`, sem baixa); o DFC não tem carteira a pagar para pôr no lugar, porque a aba `FLUXO DE CAIXA` é de caixa e a linha `A PAGAR` dela nunca entra nesta tela'),
    'top-10-receitas': semOmie('este bloco não tem barras',
      'os dez maiores recebimentos do mês saem do Omie recortado da MeuBESS, e este bloco nunca teve lado do DFC; as SAÍDAS do mês, essas, continuam ali ao lado, no "Para onde foi a despesa", que é do DFC'),
  };
  // Cada indicador atravessa esta função uma vez. Sem a chave desligada ela devolve o MESMO objeto, sem cópia:
  // é a garantia de que ligada a chave não muda nada.
  const semOOmie = (i) => {
    if (chaveOmie.ligado) return i;
    const f = SEM_OMIE[i.id];
    return {
      ...i,
      contagem: contagemSemOmie(i.contagem),
      ...(f ? { valor: null, ...(Array.isArray(i.dados) ? { dados: [] } : {}), ...(i.porVencimento ? { porVencimento: [] } : {}), ...(i.composicao ? { composicao: null } : {}), semOmie: [f] } : {}),
    };
  };

  return {
    ano, mes,
    dfc: { ok: DFC.ok, motivo: DFC.motivo ?? null, arquivo: DFC.arquivo ?? null, fonte: BASE.nomeDaFonte },
    cartoes: cartoes.map(semOOmie), blocos: blocos.map(semOOmie),
    // O FILTRO, DE VOLTA PARA A TELA: as opções que existem, o que foi escolhido, e se deu para aplicar.
    filtros: {
      // A CHAVE "INCLUIR DADOS DO OMIE", de volta para a tela: ligada é o padrão, e ligada a tela é a de sempre.
      omie: { ligado: chaveOmie.ligado },
      empresa: {
        opcoes: EMPRESAS,
        escolhidas: empresa.escolhidas,
        desconhecidos: empresa.desconhecidos,
        ativo: empresa.ativo,
        // As empresas que entraram na soma dos números do Omie desta tela.
        somadas: ATIVAS,
      },
      cc: {
        opcoes: centros.map((c) => c.nome),
        escolhidos: cc.nomes,
        desconhecidos: cc.desconhecidos,
        aplicado: ccVale,
        faltaLeitura: faltaDep,
        semRateio: { empresa1: semRateio[1], empresa2: semRateio[2] },
      },
      // A CATEGORIA, com as duas pontas lado a lado na tela: a classificação do DFC e a categoria do Omie.
      classe: {
        opcoes: opcoesDeClasse,
        escolhidos: classe.nomes,
        desconhecidos: classe.nomes.filter((n) => !opcoesDeClasse.includes(n)),
        ativo: classe.ativo,
      },
      categoria: {
        opcoes: opcoesDeCategoria,
        escolhidos: fCategoria.codigos,
        desconhecidos: fCategoria.codigos.filter((c) => !opcoesDeCategoria.some((o) => o.codigo === c)),
        ativo: fCategoria.ativo,
      },
      fornecedor: {
        opcoes: opcoesDeFornecedor,
        escolhido: fornecedor.ativo ? `${fornecedor.empresa}-${fornecedor.codigo}` : null,
        ativo: fornecedor.ativo,
        semCliente,
      },
      situacao: {
        opcoes: SITUACOES.map((f) => ({ chave: f.chave, nome: f.nome, dfc: f.dfc })),
        escolhidos: situacao.faixas,
        desconhecidos: situacao.desconhecidos,
        ativo: situacao.ativo,
        // Quantas linhas do mês têm cada rótulo de `PAGAMENTO`, e quantas têm um rótulo que não é nenhum dos três:
        // essas ficam fora de qualquer escolha, e a tela mostra o número junto do filtro.
        noDfc: Object.fromEntries(SITUACOES.map((f) => [f.chave,
          todasAsLinhas.filter((l) => f.dfc.includes(l.pagamento)).length])),
        foraDosTres: todasAsLinhas.filter((l) => !SITUACOES.some((f) => f.dfc.includes(l.pagamento))).length,
      },
      conta: {
        opcoes: opcoesDeConta.map((c) => c.nome),
        escolhidas: conta.nomes,
        desconhecidos: conta.desconhecidos,
        ativo: conta.ativo,
      },
    },
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela1 };
