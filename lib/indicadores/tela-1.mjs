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

import { abrirCacheOmie } from '../regras/cache-omie.mjs';
import { lerRecorte, criarRegras, valorOmie } from '../regras/movimentos.mjs';
import { noMesDe, ultimoDia } from '../regras/periodo.mjs';
import { lerDfc, ePessoalDfc, eDeducaoDfc, eReceitaTela1Dfc, DFC_RECEITA } from '../regras/dfc.mjs';
import { PESSOAL } from '../regras/listas.mjs';
import { centrosDeCusto, filtroDaTela1, filtroDeEmpresa, naoVale, PORQUE_O_DFC_NAO_TEM_EMPRESA } from '../regras/filtros.mjs';

const naLista = (lista) => (cod) => lista.includes(cod);
const somar = (xs) => xs.reduce((s, x) => s + x, 0);
// No DFC a saída já vem negativa; a tela mostra despesa como número positivo.
const modulo = (c) => Math.abs(c);

// A IDENTIDADE DE UM LANÇAMENTO dentro de uma leitura de `financas/mf`, para casar a leitura das telas com a leitura
// que traz o rateio por departamento. As duas são a mesma consulta na mesma janela, e esta trinca é única em cada uma.
const chaveDoMovimento = (d) => `${d.nCodMovCC ?? 0}|${d.nCodTitulo ?? 0}|${d.cGrupo ?? ''}`;

async function calcularTela1({ raiz, ano, mes, fonte, filtro = {} }) {
  const noMes = noMesDe(ano, mes);
  const OMIE = abrirCacheOmie({ raiz, ano });
  const { EMPRESAS, movimentos, categorias, departamentos, comDep, cpVenc, clientes } = OMIE;
  const recorte = lerRecorte(raiz);
  const DFC = await lerDfc({ fonte, ano, mes });

  // ---------------------------------------------------------------- o filtro de empresa
  //
  // `ATIVAS` são as empresas que entram na soma: as duas, sem filtro. Tudo o que vem do Omie é lido por empresa e
  // somado sobre esta lista; o que vem do DFC não tem por onde ser recortado (ver `naoVale[]` no fim).
  const { empresa } = filtroDeEmpresa(filtro, EMPRESAS);
  const ATIVAS = EMPRESAS.filter((emp) => empresa.pega(emp));

  // ---------------------------------------------------------------- o filtro de centro de custo
  const centros = centrosDeCusto(departamentos);
  const { cc } = filtroDaTela1(filtro, centros);
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
  const doCc = ccVale ? { linha: (emp) => (d) => cc.pega(emp, d._deps) } : { linha: () => null };
  const valorDe = ccVale ? (emp, d) => cc.rateio(emp, d._deps) : (emp, d) => valorOmie(d);
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
  const totalR = somar(ATIVAS.map((emp) => R[emp].total)), totalP = somar(ATIVAS.map((emp) => P[emp].total));
  const todosR = ATIVAS.flatMap((emp) => R[emp].todos), todosP = ATIVAS.flatMap((emp) => P[emp].todos);

  // Pessoal, do lado do Omie (confronto): categorias de pessoal, pagas no mês, no centro de custo escolhido.
  const pes = {};
  for (const emp of ATIVAS) pes[emp] = contar(emp, noMes, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false, linha: doCc.linha(emp) });
  const pessoalPagos = ATIVAS.flatMap((emp) => pes[emp].todos).filter((d) => d.cStatus === 'PAGO');

  // Despesas pendentes — a exceção ao caixa: por VENCIMENTO, sem baixa (`cLiquidado = "N"`). É do Omie inteiro, e por
  // isso o filtro de empresa vale aqui no valor E na contagem — ao contrário do de centro de custo.
  const pend = {};
  const faltaCp = ATIVAS.filter((emp) => !cpVenc[emp]);
  for (const emp of ATIVAS) {
    pend[emp] = (cpVenc[emp] ?? []).map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} })).filter((d) =>
      d.cStatus !== 'CANCELADO' && recorte.has(`${emp}|${d.nCodCC}`) && noMes(d.dDtVenc) && (d._resumo.cLiquidado ?? 'N') === 'N');
  }
  const pendTodos = ATIVAS.flatMap((emp) => pend[emp]);

  // ---------------------------------------------------------------- o lado do DFC
  const L = DFC.ok ? DFC.linhas : [];
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

  // Os dois gráficos de "Receita × despesa" leem o BLOCO PRONTO da aba do mês, não o `FLUXO DE CAIXA`.
  const bloco = DFC.ok ? DFC.abaDoMes : null;
  const dias = bloco?.porDia
    ? bloco.porDia.entradas.map((e, i) => ({ dia: i + 1, entradas: e, gastos: modulo(bloco.porDia.gastos[i] ?? 0) }))
      .slice(0, ultimoDia(ano, mes))
    : [];
  const serieOk = DFC.ok ? DFC.serie.filter((x) => x.ok) : [];
  const meses = serieOk.map((x) => ({
    mes: x.mes,
    entradas: somar(x.porDia?.entradas ?? []),
    gastos: modulo(somar(x.porDia?.gastos ?? [])),
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
  const seFiltros = (oQue) => [...seCc(doDfc(oQue)), ...seEmpresa(doDfcEmpresa(oQue))];

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
      naoVale: seCc(naoVale('centro de custo', 'este cartão inteiro — o valor E a contagem',
        'ele é a exceção ao caixa e sai da leitura de títulos a pagar por VENCIMENTO (`cTpLancamento: "CP"`), que não pede `cExibirDepartamentos` e não traz `departamentos[]`; um título ainda não pago nem está na leitura de caixa de onde o rateio vem')) },
    { id: 'despesas-funcionarios', nome: 'Desp. Funcionários', fonte: 'DFC (principal) / Omie recortado por categoria de pessoal (confronto)',
      valor: pessoalTotal, tipo: 'dinheiro',
      contagem: { dfc: dfcPessoal.length, omie: pessoalPagos.length },
      naoVale: seFiltros('o valor e a contagem do DFC deste cartão') },
    { id: 'percentual-funcionarios', nome: '% D. Func. / Rec. Líquida', fonte: 'DFC nas duas pontas (principal) / a mesma razão no Omie recortado (confronto)',
      valor: receitaLiquida ? pessoalTotal / receitaLiquida : null, tipo: 'percentual',
      contagem: { dfc: dfcPessoal.length, omie: totalR },
      naoVale: seFiltros('as duas pontas desta razão e a contagem do DFC, que são do DFC') },
  ];

  const blocos = [
    { id: 'top-10-despesas', nome: 'Top 10 despesas', fonte: 'DFC (principal) / Omie recortado por centro de custo (confronto)',
      contagem: { dfc: dfcP.length, omie: totalP }, dados: top10Despesas,
      naoVale: seFiltros('as barras, que são o DFC agrupado por `CLASS. CONTABIL`') },
    { id: 'top-10-receitas', nome: 'Top 10 receitas', fonte: 'Omie recortado (principal) / DFC (confronto)',
      contagem: { dfc: null, omie: totalR }, semDfc: true, dados: receitasComValor, naoVale: [] },
    { id: 'receita-despesa-por-dia', nome: 'Receita × despesa por dia', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: bloco?.colunas ?? 0, omie: totalR + totalP }, dados: dias,
      naoVale: seFiltros('as barras, que são o bloco `Entradas`/`Gastos` já pronto da aba do mês do DFC') },
    { id: 'receita-despesa-por-mes', nome: 'Receita × despesa por mês', fonte: 'DFC (principal) / Omie recortado (confronto)',
      contagem: { dfc: serieOk.length, omie: totalR + totalP }, dados: meses,
      naoVale: seFiltros('as barras, que são o bloco `Entradas`/`Gastos` de cada arquivo do ano do DFC') },
  ];

  return {
    ano, mes,
    dfc: { ok: DFC.ok, motivo: DFC.motivo ?? null, arquivo: DFC.arquivo ?? null, fonte: fonte.nome },
    cartoes, blocos,
    // O FILTRO, DE VOLTA PARA A TELA: as opções que existem, o que foi escolhido, e se deu para aplicar.
    filtros: {
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
    },
    lidoEm: new Date().toISOString(),
  };
}

export { calcularTela1 };
