#!/usr/bin/env node
// OS NÚMEROS DAS 3 TELAS PARA UM MÊS FECHADO, E A CONFERÊNCIA DE CADA UM CONTRA A FONTE
//
// Calcula, indicador por indicador, o que `docs/fontes.md` manda calcular, para UM mês (padrão: agosto de 2026), e
// grava `docs/conferencia.md` (uma linha por indicador) e `docs/conferencia.html` (a mesma coisa, para ler de uma vez).
//
// SÓ LEITURA. Não chama a API do Omie: lê as respostas que `scripts/confronto-dfc-omie.mjs` já gravou no cache local
// `.cache/omie/` (fora do git). Do lado das planilhas, abre os `.xlsx` do DFC com `fs.readFileSync` e nunca grava,
// move nem abre para edição. Nada é escrito no Omie nem nas planilhas.
//
// O QUE É "CONFERIR" AQUI. Para cada indicador o script (1) calcula a CONTAGEM de lançamentos que entram, pela regra
// escrita na linha daquele indicador em `docs/fontes.md`; (2) escolhe um CASO REAL entre os que entraram — o de menor
// código, para ser sempre o mesmo — e (3) vai buscá-lo de novo na fonte, por um caminho independente: relê as páginas
// cruas do cache, acha o registro pelo código e compara campo a campo o que o filtro usou (`cGrupo`, `cNatureza`,
// `cStatus`, `nCodCC`, `cCodCateg`, `cOrigem`, a data). Se algum campo não bater, o indicador sai marcado
// "divergente:" e a linha diz o que difere. Se o indicador não pôde ser calculado ou conferido — porque a leitura
// que `docs/fontes.md` pede não está no cache, ou porque a fonte principal dele é o DFC e as planilhas não foram
// lidas nesta rodada —, sai marcado "a conferir:" e a linha diz por quê.
//
// NENHUM VALOR EM DINHEIRO SAI DAQUI. A conferência é de CONTAGEM e de CAMPOS DE CADASTRO (códigos, datas, status).
// Os valores em reais ficam em `docs/confronto-dfc-omie.html`, que não é gerado por este script. Antes de gravar, o
// script varre o próprio texto atrás de "R$" e de número com centavos e se recusa a gravar se achar (ver GUARDA).
// Nome de pessoa também não entra: nenhum campo de nome é lido — nem `cCPFCNPJCliente`, nem razão social, nem a
// coluna `FORNECEDOR / CLIENTE` do DFC. Do cadastro de clientes o script só guarda o CÓDIGO e um sim/não dizendo se
// o nome está preenchido; o nome em si nunca sai do cache local.
//
// TRAVAS. Além da conferência caso a caso, o script refaz as contagens de janeiro a setembro que `docs/fontes.md` já
// publica e compara com elas (ver CONFERENCIAS_DO_FONTES). É o que prova que o filtro implementado aqui é o mesmo do
// documento antes de aplicá-lo ao mês. A trava principal — o total de receita e despesa por empresa — para o script;
// as outras entram como divergência na linha do indicador a que pertencem.
//
// A ÚNICA EXCEÇÃO AO MÊS FECHADO: a faixa "em aberto" do cartão "Valor pendente" da Tela 3. Num mês fechado ela é
// sempre vazia — todo título que já venceu está pago ou atrasado —, então o caso real dela só existe em título que
// ainda não venceu. Essa faixa, e só ela, é conferida numa janela que começa HOJE: o mês seguinte inteiro, com o que
// resta do mês corrente lido ao lado para dizer por que o mês seguinte foi o escolhido. As duas leituras são gravadas
// no cache por `scripts/ler-omie-faltante.mjs`; os outros 35 indicadores seguem no mês fechado.
//
//   node scripts/numeros-das-telas.mjs                 # agosto de 2026, tentando ler o DFC
//   node scripts/numeros-das-telas.mjs --sem-dfc       # só o cache do Omie; as linhas do DFC saem "a conferir:"
//   node scripts/numeros-das-telas.mjs --mes 7         # outro mês fechado de 2026
//   node scripts/numeros-das-telas.mjs --hoje 25/09/2026   # a data de onde parte a janela da faixa "em aberto"
//   DFC_DIR=<caminho> node scripts/numeros-das-telas.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.cache', 'omie');
const SAIDA_MD = path.join(RAIZ, 'docs', 'conferencia.md');
const SAIDA_HTML = path.join(RAIZ, 'docs', 'conferencia.html');

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const SEM_DFC = process.argv.includes('--sem-dfc');

const MES2 = String(MES).padStart(2, '0');
const PERIODO = `01/${MES2}/${ANO} a ${new Date(ANO, MES, 0).getDate()}/${MES2}/${ANO}`;
const NOMES_DOS_MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
  'outubro', 'novembro', 'dezembro'];

// A DATA DE HOJE, de onde partem as duas janelas da faixa "em aberto" do "Valor pendente" (a exceção ao mês fechado,
// explicada no topo). `--hoje dd/mm/aaaa` a fixa; sem isso, é o dia de hoje. As duas janelas são as mesmas que
// `scripts/ler-omie-faltante.mjs` grava no cache: o que RESTA do mês corrente e o mês SEGUINTE inteiro.
const dois = (x) => String(x).padStart(2, '0');
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();
const HOJE = arg('--hoje', (() => { const d = new Date(); return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`; })());
const hj = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(HOJE);
if (!hj) { console.error('--hoje precisa ser dd/mm/aaaa'); process.exit(1); }
const [HD, HM, HA] = [Number(hj[1]), Number(hj[2]), Number(hj[3])];
const [SM, SA] = HM === 12 ? [1, HA + 1] : [HM + 1, HA];
const JANELA_CORRENTE = [`${dois(HD)}/${dois(HM)}/${HA}`, `${ultimoDia(HA, HM)}/${dois(HM)}/${HA}`];
const JANELA_SEGUINTE = [`01/${dois(SM)}/${SA}`, `${ultimoDia(SA, SM)}/${dois(SM)}/${SA}`];
const DIAS_QUE_RESTAM = ultimoDia(HA, HM) - HD + 1;
const MES_DA_FAIXA_ABERTO = `${NOMES_DOS_MESES[SM]} de ${SA}`;
const MES_CORRENTE_NOME = `${NOMES_DOS_MESES[HM]} de ${HA}`;
const NOME_DO_MES = NOMES_DOS_MESES[MES];

const falhar = (m) => { console.error(m); process.exit(1); };

// ================================================================ o cache do Omie
//
// As chaves do cache são a própria pergunta: empresa + serviço + método + sha1 dos parâmetros. É a mesma conta que
// `scripts/confronto-dfc-omie.mjs` faz para gravar, e a mesma que `scripts/categorias-do-dre.mjs` faz para achar.

const sha = (p) => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const arqCache = (emp, servico, call, param) =>
  path.join(CACHE, `${emp}-${servico.replace(/\W+/g, '-')}-${call}-${sha(param)}.json`);

if (!fs.existsSync(CACHE)) falhar(`cache não encontrado em ${CACHE}.\nRode antes: node scripts/confronto-dfc-omie.mjs`);
const arquivosDoCache = fs.readdirSync(CACHE);

// A LEITURA DAS TELAS 1 E 2, e a única que `docs/fontes.md` conta: `financas/mf` → `ListarMovimentos` SEM
// `cTpLancamento` (o filtro por tipo deixa de fora o lançamento avulso de conta corrente), por data de pagamento.
// O cache tem a faixa inteira de 2026 até setembro; o mês pedido é recortado dela pela `dDtPagamento` de cada
// lançamento, que é exatamente o que `dDtPagtoDe` / `dDtPagtoAte` no mês devolveria.
const LEITURA_MF = (n) => ({ nPagina: n, nRegPorPagina: 100, dDtPagtoDe: `01/01/${ANO}`, dDtPagtoAte: `30/09/${ANO}` });
// A LEITURA DA TELA 3: `financas/pesquisartitulos` → `PesquisarLancamentos`, `cNatureza: "R"`, por vencimento, em duas
// passadas (até hoje e a vencer) — é a leitura que `docs/fontes.md` descreve no bloco "Lançamentos por mês e status".
const LEITURA_TIT_R = (n, de, ate) => ({ nPagina: n, nRegPorPagina: 100, cNatureza: 'R', dDtVencDe: de, dDtVencAte: ate });
const FAIXAS_TIT_R = [[`01/01/${ANO}`, `25/09/${ANO}`], [`26/09/${ANO}`, `31/12/${ANO}`]];
// AS DUAS LEITURAS DA FAIXA "EM ABERTO" do "Valor pendente" (a exceção ao mês fechado, explicada no topo): a mesma
// chamada, por vencimento, nas duas janelas que começam hoje. `scripts/ler-omie-faltante.mjs` as grava no cache.
const JANELAS_ABERTO = { corrente: JANELA_CORRENTE, seguinte: JANELA_SEGUINTE };
// A LEITURA DOS TÍTULOS A PAGAR de `financas/pesquisartitulos`, por vencimento. Fica como segunda opinião do cartão
// "Despesas pendentes": traz os mesmos campos da leitura abaixo, por outro serviço.
const LEITURA_TIT_P = (n) => ({ nPagina: n, nRegPorPagina: 100, cNatureza: 'P', dDtVencDe: `01/01/${ANO}`, dDtVencAte: `31/12/${ANO}` });
// A LEITURA DO CARTÃO "Despesas pendentes", exatamente como `docs/fontes.md` a pede: `financas/mf` →
// `ListarMovimentos` com `cTpLancamento: "CP"` por VENCIMENTO. `scripts/ler-omie-faltante.mjs` a grava no cache.
const LEITURA_CP_VENC = (n) => ({ nPagina: n, nRegPorPagina: 100, cTpLancamento: 'CP', dDtVencDe: `01/01/${ANO}`, dDtVencAte: `31/12/${ANO}` });
// A LEITURA DO CONFRONTO DO "Top 10 despesas": a mesma leitura de caixa de cima, COM `cExibirDepartamentos: "S"`,
// que é o único jeito de o rateio por centro de custo vir no retorno (nenhum método do Omie filtra por departamento).
const LEITURA_MF_DEP = (n) => ({ nPagina: n, nRegPorPagina: 100, dDtPagtoDe: `01/01/${ANO}`, dDtPagtoAte: `30/09/${ANO}`, cExibirDepartamentos: 'S' });
// OS DOIS CADASTROS que faltavam: o de clientes (o eixo do gráfico da Tela 3) e o das contas do DRE (o `totalizaDRE`
// da linha "(=) Receita bruta").
const LEITURA_CLIENTES = (n) => ({ pagina: n, registros_por_pagina: 100, apenas_importado_api: 'N' });
const LEITURA_DRE = { apenasContasAtivas: 'N' };

function paginas(emp, servico, call, param, campo) {
  const primeira = arqCache(emp, servico, call, param(1));
  if (!fs.existsSync(primeira)) return null;
  const itens = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const f = arqCache(emp, servico, call, param(n));
    if (!fs.existsSync(f)) return null;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    total = Number(j.nTotPaginas ?? j.total_de_paginas) || 1;
    itens.push(...(j[campo] ?? []));
  }
  return itens;
}

const EMPRESAS = ['1', '2'];
const movimentos = {}, titulosR = {}, titulosP = {}, categorias = {}, departamentos = {}, pedidos = {};
// As quatro leituras que `scripts/ler-omie-faltante.mjs` acrescentou ao cache. Se alguma faltar, o indicador que
// depende dela sai "a conferir:" dizendo isso, e o resto da página segue.
const cpVenc = {}, comDep = {}, clientes = {}, contasDre = {};
// As duas janelas da faixa "em aberto" (`corrente` e `seguinte`), por empresa. `null` = a leitura não está no cache.
const titulosAberto = { corrente: {}, seguinte: {} };
for (const emp of EMPRESAS) {
  movimentos[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', LEITURA_MF, 'movimentos');
  if (!movimentos[emp]) falhar(`empresa ${emp}: a leitura de financas/mf por data de pagamento (sem cTpLancamento, 01/01 a 30/09/${ANO}) não está inteira no cache.\nRode antes: node scripts/confronto-dfc-omie.mjs`);

  titulosR[emp] = [];
  for (const [de, ate] of FAIXAS_TIT_R) {
    const t = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', (n) => LEITURA_TIT_R(n, de, ate), 'titulosEncontrados');
    if (t) titulosR[emp].push(...t);
  }
  titulosP[emp] = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', LEITURA_TIT_P, 'titulosEncontrados') ?? [];

  categorias[emp] = new Map();
  for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-geral-categorias`)))
    for (const c of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).categoria_cadastro ?? [])
      categorias[emp].set(String(c.codigo), c);
  departamentos[emp] = new Map();
  for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-geral-departamentos`)))
    for (const d of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).departamentos ?? [])
      departamentos[emp].set(String(d.codigo), d);
  pedidos[emp] = new Map();
  for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-produtos-pedido`)))
    for (const p of JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')).pedido_venda_produto ?? [])
      pedidos[emp].set(String(p.cabecalho?.codigo_pedido), p);

  cpVenc[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', LEITURA_CP_VENC, 'movimentos');
  comDep[emp] = paginas(emp, 'financas/mf', 'ListarMovimentos', LEITURA_MF_DEP, 'movimentos');
  // DO CADASTRO DE CLIENTES SÓ SAI O CÓDIGO. `clientes[emp]` é o conjunto dos códigos cujo nome está preenchido no
  // cadastro; o nome nunca é guardado nem impresso.
  const cru = paginas(emp, 'geral/clientes', 'ListarClientesResumido', LEITURA_CLIENTES, 'clientes_cadastro_resumido');
  clientes[emp] = cru && {
    total: cru.length,
    comNome: new Set(cru.filter((c) => String(c.razao_social ?? '').trim() || String(c.nome_fantasia ?? '').trim())
      .map((c) => String(c.codigo_cliente))),
  };
  const arqDre = arqCache(emp, 'geral/dre', 'ListarCadastroDRE', LEITURA_DRE);
  contasDre[emp] = fs.existsSync(arqDre) ? (JSON.parse(fs.readFileSync(arqDre, 'utf8')).dreLista ?? []) : null;
  for (const [qual, [de, ate]] of Object.entries(JANELAS_ABERTO))
    titulosAberto[qual][emp] = paginas(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos',
      (n) => LEITURA_TIT_R(n, de, ate), 'titulosEncontrados');
}

// ================================================================ o recorte e os filtros de docs/fontes.md

// O RECORTE DA MEUBESS (decisão do dono, 24 e 25/09/2026): só os lançamentos cuja conta corrente é da MeuBESS.
const RECORTE = new Set(JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'))
  .contas.filter((c) => c.negocio === 'MeuBESS').map((c) => c.chave));

// AS CATEGORIAS DE TRANSFERÊNCIA QUE FICAM FORA (decisão do dono, 25/09/2026, opção B). Duas o cadastro marca
// (`transferencia = "S"`); as de baixo se chamam "Transferência" sem a marca. A `1.04.97` só na empresa 1 — na 2 o
// mesmo código é "Prêmios de Seguros / Sinistros" e conta como outra receita.
const TRANSFERENCIA_SEM_MARCA = { 1: ['1.04.96', '1.04.97', '2.05.98'], 2: ['1.04.96', '2.05.98'] };
const eTransferencia = (emp, cod) =>
  categorias[emp].get(String(cod))?.transferencia === 'S' || TRANSFERENCIA_SEM_MARCA[emp].includes(String(cod));

const dataBR = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '')); return m ? { d: +m[1], m: +m[2], a: +m[3] } : null; };
const noMes = (s) => { const d = dataBR(s); return Boolean(d) && d.a === ANO && d.m === MES; };
const em2026 = (s) => { const d = dataBR(s); return Boolean(d) && d.a === ANO; };

// A BASE DE UM PERÍODO: os lançamentos da leitura que sobrevivem ao recorte, ao cancelado e à data. O par do
// adiantamento ao fornecedor (decisão do dono, 25/09/2026, opção A) é medido DENTRO do período, porque é dentro dele
// que a tela lê: ficam fora todo lançamento com `cOrigem = "ADCR"` e todo lançamento de um título que tenha, na mesma
// leitura, alguma linha com `cOrigem = "ADCP"` — o título da ida E a baixa dele.
function base(emp, dentro) {
  const linhas = movimentos[emp].map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} }))
    .filter((d) => d.cStatus !== 'CANCELADO' && RECORTE.has(`${emp}|${d.nCodCC}`) && dentro(d.dDtPagamento));
  const adcp = new Set(linhas.filter((d) => d.cOrigem === 'ADCP' && d.nCodTitulo).map((d) => d.nCodTitulo));
  const elegivel = (d) => d.cOrigem !== 'ADCR' && !(d.nCodTitulo && adcp.has(d.nCodTitulo));
  return { linhas, adcp, elegivel };
}

// OS TRÊS BALDES, SEM CONTAR DUAS VEZES. O título baixado volta na mesma leitura como CONTA_A_PAGAR / CONTA_A_RECEBER
// e como CONTA_CORRENTE_PAG / CONTA_CORRENTE_REC com o mesmo `nCodTitulo`; fica o título, um por `nCodTitulo`, e do
// conta corrente entram os dois que não têm título irmão nesta leitura, cada um uma vez por `nCodMovCC`: o AVULSO
// (`nCodTitulo` 0) e a BAIXA DO TÍTULO QUITADO SÓ EM PARTE (`nCodTitulo` preenchido, título ausente da leitura).
function baldes(b, nat, extra = () => true) {
  const titulos = new Map(), baixas = new Map(), avulsos = new Map();
  for (const d of b.linhas) {
    if (d.cNatureza !== nat) continue;
    if (!b.elegivel(d)) continue;
    if (!extra(d)) continue;
    if (d.cGrupo === 'CONTA_A_RECEBER' || d.cGrupo === 'CONTA_A_PAGAR') titulos.set(d.nCodTitulo, d);
    else if (d.cGrupo === 'CONTA_CORRENTE_REC' || d.cGrupo === 'CONTA_CORRENTE_PAG') (d.nCodTitulo ? baixas : avulsos).set(d.nCodMovCC, d);
  }
  for (const [mov, d] of baixas) if (titulos.has(d.nCodTitulo)) baixas.delete(mov);
  return {
    titulos, baixas, avulsos, total: titulos.size + baixas.size + avulsos.size,
    todos: [...titulos.values(), ...baixas.values(), ...avulsos.values()],
  };
}

// `comTransferencia` diz se a linha tira as categorias de transferência; `categoria` é a lista de códigos da linha.
function contar(emp, dentro, nat, { categoria = null, comTransferencia = true } = {}) {
  const b = base(emp, dentro);
  return baldes(b, nat, (d) => (!comTransferencia || !eTransferencia(emp, d.cCodCateg)) && (!categoria || categoria(String(d.cCodCateg ?? ''), d)));
}

// ================================================================ as listas que o dono decidiu
//
// Cada lista abaixo só REGISTRA uma decisão do dono já escrita em `docs/fontes.md`. Nenhuma é heurística, e a chave é
// sempre o par empresa + código: o mesmo código é coisa diferente nas duas empresas.

// Venda de produtos × outras receitas na linha "(+) Receitas" (decisão do dono, 25/09/2026).
const VENDA_DE_PRODUTOS = ['1.01.01', '1.01.03', '1.04.01'];

const faixa = (pre, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => `${pre}${String(de + i).padStart(2, '0')}`);

// Categorias de pessoal, para o confronto do cartão "Despesas com funcionários" (decisão do dono, 25/09/2026).
const PESSOAL = {
  1: [...faixa('2.03.', 1, 14), '2.03.97', '2.03.98', '2.03.99', '2.11.96', '2.02.01', '2.02.02', ...faixa('2.01.', 81, 97)],
  2: [...faixa('2.03.', 1, 14), '2.03.97', '2.03.98', '2.03.99', '2.02.01', '2.02.02', '2.08.01'],
};

// Custo de vendas (decisão do dono, 25/09/2026, grupo b): 22 códigos na empresa 1 e 16 na 2.
// Os três últimos da empresa 2 entraram na segunda resposta do dono, também em 25/09/2026 ("1 ok"): a contagem
// corrigida mostrou que `2.01.96` Energia Elétrica-Custo, `2.01.89` Gas para empilhadeira-Custos e `2.01.92`
// Armanezagem e manuseio de Carga-Custos têm movimento e são apontadas pelo nome, o mesmo critério das outras.
const CUSTO_DE_VENDAS = {
  1: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', ...faixa('2.01.', 82, 97), '2.01.99', '2.04.88'],
  2: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', '2.01.90', '2.01.91', '2.01.93', '2.01.94', '2.01.95', '2.01.97', '2.01.98', '2.01.99', '2.08.99',
      '2.01.89', '2.01.92', '2.01.96'],
};

// Resultado financeiro (decisão do dono, 25/09/2026, grupo d): 7 códigos na empresa 1 e 8 na 2.
const RESULTADO_FINANCEIRO = {
  1: ['1.01.02', '1.02.02', '1.04.95', '2.05.01', '2.05.02', '2.05.04', '2.06.95'],
  2: ['1.02.02', '1.04.94', '2.04.91', '2.05.01', '2.05.02', '2.05.04', '2.05.99', '2.06.95'],
};

// Dedução da receita (decisão do dono, 24/09/2026; o ISS retido `2.06.07` saiu em 25/09/2026): 5 na empresa 1 e 6 na 2.
const DEDUCOES = {
  1: ['2.06.01', '2.06.03', '2.06.04', '2.09.01', '2.09.02'],
  2: ['2.06.01', '2.06.03', '2.06.04', '2.09.01', '2.09.02', '2.02.97'],
};

// Impostos pagos (guias) — o confronto do Omie, pela categoria e não pelo `cTipo` (decisão do dono, 25/09/2026).
const IMPOSTOS_GUIAS = { 1: ['2.06.05', '2.06.06', '2.06.07', '2.03.06', '2.01.92'], 2: ['2.06.05', '2.06.06', '2.06.07', '2.03.06'] };

// Os empréstimos e transferências entre as empresas (Intercompany), que ficam fora do DRE (decisão do dono, 25/09/2026).
const INTERCOMPANY = { 1: ['2.08.02', '2.05.99', '1.04.99'], 2: ['1.04.99', '2.10.98'] };

// Ficam FORA do DRE: hoje, só os Intercompany. O Financiamento Veiculo (`2.11.95`, empresa 1) esteve nesta lista por um
// dia: a terceira resposta do dono, em 25/09/2026 ("financiamento de veiculo é despesas gerais sim"), o mandou para
// "(−) Despesas gerais", e ele saiu daqui — continua fora do resultado financeiro, como já estava decidido.
const FORA_DO_DRE = INTERCOMPANY;

// De-para dos `cStatus` do Omie para as três faixas da Tela 3 (decisão do dono, 25/09/2026). O Omie devolve
// `"A VENCER"` com espaço nos títulos a vencer; pelos campos é o mesmo `AVENCER`, e o código o trata como tal.
const FAIXA_DO_STATUS = (s) => {
  const x = String(s ?? '').replace(/\s+/g, '').toUpperCase();
  if (x === 'CANCELADO') return 'fora';
  if (x === 'RECEBIDO' || x === 'LIQUIDADO') return 'pago';
  if (x === 'ATRASADO') return 'atrasado';
  if (['EMABERTO', 'AVENCER', 'VENCEHOJE', 'PAGTOPARCIAL'].includes(x)) return 'aberto';
  return 'outro';
};

// ================================================================ a conferência: achar o caso de novo, na fonte crua
//
// O cálculo acima trabalha sobre estruturas já filtradas e deduplicadas. A conferência faz o caminho contrário: abre
// de novo as páginas do cache, sem filtro nenhum, acha o registro pelo código e compara campo a campo.

function acharMovimentoCru(emp, chave, valor) {
  const achados = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const j = JSON.parse(fs.readFileSync(arqCache(emp, 'financas/mf', 'ListarMovimentos', LEITURA_MF(n)), 'utf8'));
    total = Number(j.nTotPaginas) || 1;
    for (const m of j.movimentos ?? []) if (String(m.detalhes?.[chave]) === String(valor)) achados.push({ ...m, _pagina: n });
  }
  return achados;
}

function acharTituloCru(emp, nCodTitulo, faixas = FAIXAS_TIT_R) {
  for (const f of faixas) {
    let total = 1;
    for (let n = 1; n <= total; n++) {
      const arq = arqCache(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', LEITURA_TIT_R(n, f[0], f[1]));
      if (!fs.existsSync(arq)) break;
      const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
      total = Number(j.nTotPaginas) || 1;
      for (const t of j.titulosEncontrados ?? []) if (String(t.cabecTitulo?.nCodTitulo) === String(nCodTitulo)) return { ...t, _pagina: n };
    }
  }
  return null;
}

// A mesma volta, nas leituras que `scripts/ler-omie-faltante.mjs` acrescentou: reabre as páginas cruas e acha o
// registro pelo código. `param` é a leitura; `campo` é o que se compara em `detalhes`.
function acharCru(emp, param, campo, valor) {
  const achados = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const arq = arqCache(emp, 'financas/mf', 'ListarMovimentos', param(n));
    if (!fs.existsSync(arq)) break;
    const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
    total = Number(j.nTotPaginas) || 1;
    for (const m of j.movimentos ?? []) if (String(m.detalhes?.[campo]) === String(valor)) achados.push({ ...m, _pagina: n });
  }
  return achados;
}

// Compara o que o filtro usou. Devolve a lista de diferenças (vazia = confere).
function comparar(achado, esperado) {
  const dif = [];
  for (const [campo, valor] of Object.entries(esperado)) {
    const veio = achado?.[campo];
    if (String(veio ?? '') !== String(valor ?? '')) dif.push(`\`${campo}\` veio "${veio ?? '(ausente)'}" e o cálculo usou "${valor}"`);
  }
  return dif;
}

// Confere um lançamento de `financas/mf`: acha pelo código (`nCodMovCC` no conta corrente, `nCodTitulo` no título),
// confirma que é um registro só e que os campos do filtro batem.
function conferirLancamento(emp, d) {
  const eTitulo = d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER';
  const chave = eTitulo ? 'nCodTitulo' : 'nCodMovCC';
  const codigo = eTitulo ? d.nCodTitulo : d.nCodMovCC;
  const crus = acharMovimentoCru(emp, chave, codigo);
  const alvo = eTitulo ? crus.filter((m) => m.detalhes.cGrupo === d.cGrupo) : crus;
  if (!alvo.length) return { ok: false, motivo: `o código \`${chave}\` ${codigo} não foi achado de volta na leitura crua do cache` };
  if (alvo.length > 1) return { ok: false, motivo: `o código \`${chave}\` ${codigo} aparece ${alvo.length} vezes na leitura crua, e o cálculo o contou uma` };
  const det = alvo[0].detalhes;
  const dif = comparar(det, {
    cGrupo: d.cGrupo, cNatureza: d.cNatureza, cStatus: d.cStatus, nCodCC: d.nCodCC,
    cCodCateg: d.cCodCateg, cOrigem: d.cOrigem, dDtPagamento: d.dDtPagamento,
  });
  return { ok: dif.length === 0, dif, pagina: alvo[0]._pagina };
}

function conferirTituloR(emp, cab, faixas = FAIXAS_TIT_R) {
  const cru = acharTituloCru(emp, cab.nCodTitulo, faixas);
  if (!cru) return { ok: false, motivo: `o título ${cab.nCodTitulo} não foi achado de volta na leitura crua do cache` };
  const dif = comparar(cru.cabecTitulo, { cNatureza: cab.cNatureza, cStatus: cab.cStatus, nCodCC: cab.nCodCC, cCodCateg: cab.cCodCateg, dDtVenc: cab.dDtVenc });
  return { ok: dif.length === 0, dif, pagina: cru._pagina };
}

// O caso escolhido é sempre o de MENOR código entre os que entraram, para a conferência ser repetível.
const menorPor = (lista, campo) => lista.slice().sort((a, b) => Number(a[campo] ?? 0) - Number(b[campo] ?? 0))[0];

const casoDoLancamento = (emp, d) => {
  const eTitulo = d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER';
  return `${eTitulo ? `nCodTitulo ${d.nCodTitulo}` : `nCodMovCC ${d.nCodMovCC}`} (empresa ${emp}, \`${d.cGrupo}\`, \`cNatureza\` ${d.cNatureza}, \`cStatus\` ${d.cStatus}, \`nCodCC\` ${d.nCodCC}, \`cCodCateg\` ${d.cCodCateg ?? '(sem)'}, \`cOrigem\` ${d.cOrigem ?? '(sem)'}, pago em ${d.dDtPagamento})`;
};

// Escolhe o caso do indicador: prefere o título (que tem mais campos para comparar), e entre eles o de menor código.
function conferirPrimeiro(porEmpresa) {
  for (const emp of EMPRESAS) {
    const lista = porEmpresa[emp] ?? [];
    if (!lista.length) continue;
    const titulos = lista.filter((d) => d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER');
    const d = titulos.length ? menorPor(titulos, 'nCodTitulo') : menorPor(lista, 'nCodMovCC');
    const r = conferirLancamento(emp, d);
    return { emp, d, r, texto: casoDoLancamento(emp, d) };
  }
  return null;
}

// Texto do caso de um indicador cujo cálculo saiu do Omie. Junta o caso e o resultado da conferência.
const textoDoCaso = (caso, prefixo = '', vazio = 'nenhum lançamento entrou neste mês') => {
  if (!caso) return vazio;
  const fim = caso.r.ok
    ? `achado de volta na página ${caso.r.pagina} da leitura crua do cache com os mesmos campos`
    : `**não conferiu**: ${caso.r.motivo ?? caso.r.dif.join('; ')}`;
  return `${prefixo}${caso.texto} — ${fim}`;
};

// ================================================================ as contagens de docs/fontes.md, refeitas
//
// De janeiro a setembro, `docs/fontes.md` já publica as contagens. Refazê-las aqui é o que prova que o filtro
// implementado neste script é o mesmo do documento — antes de aplicá-lo ao mês pedido.

const janSet = (s) => { const d = dataBR(s); return Boolean(d) && d.a === ANO && d.m >= 1 && d.m <= 9; };
const trinca = (b) => [b.titulos.size, b.baixas.size, b.avulsos.size];
const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const CONTAGEM_DO_FONTES = { 1: { R: [9, 0, 159], P: [804, 8, 272] }, 2: { R: [523, 24, 607], P: [550, 3, 539] } };
const totalJanSet = {};
for (const emp of EMPRESAS) {
  totalJanSet[emp] = { R: contar(emp, janSet, 'R'), P: contar(emp, janSet, 'P') };
  for (const nat of ['R', 'P']) {
    const meu = trinca(totalJanSet[emp][nat]), dito = CONTAGEM_DO_FONTES[emp][nat];
    if (!igual(meu, dito)) falhar(`TRAVA: empresa ${emp}, ${nat === 'R' ? 'entradas' : 'saídas'} de jan–set: o cache dá ${meu.join(' + ')} e docs/fontes.md diz ${dito.join(' + ')}. Não gravo uma página que discorda da fonte.`);
  }
}

// As outras contagens que docs/fontes.md publica. Não param o script: uma que não bata vira "divergente:" na linha do
// indicador a que pertence.
const CONFERENCIAS_DO_FONTES = [];
const registrar = (id, rotulo, meu, dito) => CONFERENCIAS_DO_FONTES.push({ id, rotulo, meu, dito, bate: igual(meu, dito) });
const conferencia = (id) => CONFERENCIAS_DO_FONTES.find((c) => c.id === id);
const naLista = (lista) => (cod) => lista.includes(cod);

const jsCustos = {};
for (const emp of EMPRESAS) jsCustos[emp] = contar(emp, janSet, 'P', { categoria: naLista(CUSTO_DE_VENDAS[emp]) });
registrar('custos', 'custos de vendas, jan–set (títulos + baixas + avulsos da empresa 1, depois da 2)',
  [...trinca(jsCustos[1]), ...trinca(jsCustos[2])], [65, 1, 19, 441, 3, 130]);

const jsFin = {};
for (const emp of EMPRESAS) jsFin[emp] = {
  R: contar(emp, janSet, 'R', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
  P: contar(emp, janSet, 'P', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
};
registrar('financeiro', 'resultado financeiro, jan–set (receita emp. 1, receita emp. 2, despesa emp. 1, despesa emp. 2)',
  [jsFin[1].R.total, jsFin[2].R.total, jsFin[1].P.total, jsFin[2].P.total], [54, 11, 98, 33]);

const jsPessoal = {};
for (const emp of EMPRESAS) jsPessoal[emp] = contar(emp, janSet, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false });
registrar('pessoal', 'pessoal pago, jan–set (empresa 1, empresa 2)',
  [jsPessoal[1].todos.filter((d) => d.cStatus === 'PAGO').length, jsPessoal[2].todos.filter((d) => d.cStatus === 'PAGO').length], [251, 321]);

const jsGuias = {};
for (const emp of EMPRESAS) jsGuias[emp] = contar(emp, janSet, 'P', { categoria: naLista(IMPOSTOS_GUIAS[emp]), comTransferencia: false });
registrar('guias', 'impostos pagos (guias), jan–set (títulos, baixas de parcial, avulsos, somando as duas empresas)',
  [jsGuias[1].titulos.size + jsGuias[2].titulos.size, jsGuias[1].baixas.size + jsGuias[2].baixas.size, jsGuias[1].avulsos.size + jsGuias[2].avulsos.size], [14, 0, 9]);

// A divisão da linha "(+) Receitas": docs/fontes.md diz 3 códigos de venda e 26 / 28 de outras receitas.
const outrasReceitasDe = (emp) => [...categorias[emp].values()]
  .filter((c) => c.conta_receita === 'S' && c.totalizadora === 'N' && !eTransferencia(emp, c.codigo) && !VENDA_DE_PRODUTOS.includes(String(c.codigo)))
  .map((c) => String(c.codigo));
const OUTRAS_RECEITAS = { 1: outrasReceitasDe('1'), 2: outrasReceitasDe('2') };
registrar('grupos-receita', 'códigos de outra receita no cadastro (empresa 1, empresa 2)',
  [OUTRAS_RECEITAS[1].length, OUTRAS_RECEITAS[2].length], [26, 28]);

// O par do adiantamento ao fornecedor: docs/fontes.md diz 53 títulos `ADCP` em 2026, 1 deles em agosto.
const adcpPorMes = {};
for (const emp of EMPRESAS) {
  for (const m of movimentos[emp]) {
    const d = m.detalhes ?? {};
    if (d.cOrigem !== 'ADCP' || !d.nCodTitulo) continue;
    if (d.cStatus === 'CANCELADO' || !RECORTE.has(`${emp}|${d.nCodCC}`) || !em2026(d.dDtPagamento)) continue;
    const mes = dataBR(d.dDtPagamento).m;
    (adcpPorMes[mes] ??= new Set()).add(`${emp}|${d.nCodTitulo}`);
  }
}
const ADCP_TOTAL = Object.values(adcpPorMes).reduce((s, x) => s + x.size, 0);
registrar('adiantamento', `títulos \`ADCP\` do par do adiantamento em ${ANO} (no ano todo, em ${NOME_DO_MES})`,
  [ADCP_TOTAL, adcpPorMes[MES]?.size ?? 0], [53, 1]);

// ================================================================ o DFC
//
// Leitura só, e só se as planilhas estiverem alcançáveis. A pasta do DFC é uma biblioteca do SharePoint que o OneDrive
// espelha; ler um arquivo de lá o baixa na máquina do dono. Por isso `--sem-dfc` existe: sem as planilhas, toda linha
// cuja fonte principal é o DFC sai "a conferir:", dizendo isso.

const norm = (s) => String(s ?? '').toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cent = (v) => Math.round(Number(v ?? 0) * 100);

function lerZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('não é um zip (EOCD não encontrado)');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const arquivos = new Map();
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20);
    const nomeLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), comentLen = buf.readUInt16LE(p + 32);
    arquivos.set(buf.toString('utf8', p + 46, p + 46 + nomeLen), { metodo, compSize, offset: buf.readUInt32LE(p + 42) });
    p += 46 + nomeLen + extraLen + comentLen;
  }
  return {
    ler(nome) {
      const e = arquivos.get(nome);
      if (!e) return null;
      const lh = e.offset;
      const ini = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
      const cru = buf.subarray(ini, ini + e.compSize);
      return e.metodo === 0 ? cru : zlib.inflateRawSync(cru);
    },
  };
}
const desescapar = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const textoDosT = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g)].map((m) => (m[1] ? desescapar(m[1]) : '')).join('');
function sharedStrings(zip) {
  const b = zip.ler('xl/sharedStrings.xml');
  if (!b) return [];
  return [...b.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => (m[1] ? textoDosT(m[1]) : ''));
}
function abasDo(zip) {
  const wb = zip.ler('xl/workbook.xml').toString('utf8');
  const rels = (zip.ler('xl/_rels/workbook.xml.rels') || Buffer.from('')).toString('utf8');
  const alvo = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) alvo.set(id, t.replace(/^\/?xl\//, '').replace(/^\.\//, ''));
  }
  return [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => ({
    nome: desescapar(/name="([^"]*)"/.exec(m[0])?.[1] ?? ''),
    parte: 'xl/' + (alvo.get(/r:id="([^"]+)"/.exec(m[0])?.[1]) ?? ''),
  }));
}
function lerAba(zip, parte, ss) {
  const b = zip.ler(parte);
  if (!b) return null;
  const linhas = [];
  for (const mr of b.toString('utf8').matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const n = +(/r="(\d+)"/.exec(mr[1] ?? mr[3] ?? '')?.[1] ?? 0);
    const cel = new Map();
    for (const mc of (mr[2] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const ca = mc[1] ?? mc[3] ?? '', cc = mc[2] ?? '';
      const col = /^([A-Z]+)/.exec(/r="([A-Z]+\d+)"/.exec(ca)?.[1] ?? '')?.[1];
      if (!col) continue;
      const tipo = /t="([^"]*)"/.exec(ca)?.[1] ?? 'n';
      const v = /<v>([\s\S]*?)<\/v>/.exec(cc)?.[1];
      if (tipo === 's') { const t = (ss[+v] ?? '').trim(); if (t) cel.set(col, { t }); }
      else if (tipo === 'inlineStr') { const t = textoDosT(cc).trim(); if (t) cel.set(col, { t }); }
      else if (tipo === 'str') { const t = desescapar(v ?? '').trim(); if (t) cel.set(col, { t }); }
      else if (v !== undefined && v !== '' && Number.isFinite(Number(v))) cel.set(col, { v: Number(v) });
    }
    if (cel.size) linhas.push({ n, cel });
  }
  return linhas;
}
function dataDaCelula(c) {
  if (!c) return null;
  if (c.v !== undefined) {
    if (!(c.v > 20000 && c.v < 80000)) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c.v) * 86400000);
    return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(c.t ?? '');
  if (!m) return null;
  return { a: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: +m[2], d: +m[1] };
}
// As colunas de dia do bloco pronto da aba do mês: de `D` a `AH`, como `docs/fontes.md` escreve.
const COLUNAS_DE_DIA = new Set([
  ...'DEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'ABCDEFGH'.split('').map((c) => `A${c}`),
]);
const SUB2_SALDO = new Set(['SALDO INICIAL', 'SALDO FINAL', 'SALDO INICIAL PROVISAO', 'SALDO FINAL PROVISAO']);
const COLUNAS_DE_DATA = ['DIA PG', 'VENCIMENTO', 'TIPO'];
const BAIXADO = (p) => p !== '' && p !== 'A PAGAR' && p !== 'A RECEBER';

// A pasta da MeuBESS é a que numera os arquivos ("01 - DFC - JAN2026"); as das outras unidades, não.
function pastaDaMeuBess() {
  const candidatas = [];
  if (process.env.DFC_DIR) candidatas.push(process.env.DFC_DIR);
  else {
    for (const raiz of [path.join(os.homedir(), 'Meu Bess'), path.join(os.homedir(), 'OneDrive')]) {
      if (!fs.existsSync(raiz)) continue;
      for (const nome of fs.readdirSync(raiz)) {
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

// Lê o `FLUXO DE CAIXA` do arquivo do mês. Uma linha por lançamento, com a classificação que a própria planilha
// escreve — `CLASS. CONTABIL` (I) e `SUB 2` (J) —, a data em `DIA PG` (F) e o sinal na coluna `ENTRADA` (K). O
// cabeçalho se repete, um bloco por banco, e as colunas são achadas pelo nome, nunca pela letra.
// NENHUM VALOR É GUARDADO: só o sinal (que diz se é entrada ou saída), a classificação e o número da linha.
function lerDfc() {
  if (SEM_DFC) return { ok: false, motivo: 'esta rodada foi feita com `--sem-dfc`: a pasta DFC/2026 é uma biblioteca do SharePoint espelhada pelo OneDrive neste computador, e abrir um arquivo de lá o baixa' };
  let pasta = null;
  try { pasta = pastaDaMeuBess(); } catch (e) { return { ok: false, motivo: `não deu para alcançar a pasta do DFC: ${e.message}` }; }
  if (!pasta) return { ok: false, motivo: 'não achei a pasta DFC/2026 da MeuBESS sincronizada (use `DFC_DIR=<caminho>`)' };
  const arq = pasta.arquivos.find((f) => new RegExp(`^0?${MES}\\s*-`).test(f));
  if (!arq) return { ok: false, motivo: `a pasta da MeuBESS não tem o arquivo do mês ${MES2}` };
  const zip = lerZip(fs.readFileSync(path.join(pasta.caminho, arq)));
  const ss = sharedStrings(zip);
  const aba = abasDo(zip).find((a) => norm(a.nome) === 'FLUXO DE CAIXA');
  if (!aba) return { ok: false, motivo: `o arquivo ${arq} não tem a aba FLUXO DE CAIXA` };
  const linhas = [];
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
    const k = numero('ENTRADA'), lv = numero('SAIDA');
    const bruto = cent(k) !== 0 ? k : lv;
    if (cent(bruto) === 0) continue;
    const pagamento = norm(texto('PAGAMENTO'));
    if (!BAIXADO(pagamento)) continue;
    let dt = null;
    for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(mapa.get(rot))); if (dt) break; }
    if (!dt || dt.a !== ANO || dt.m !== MES) continue;
    linhas.push({ linha: l.n, classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: sub2 || '(vazio)', natureza: bruto > 0 ? 'R' : 'P', pagamento, dia: dt.d });
  }
  // A VOLTA, para conferir o caso: relê a MESMA aba do zero, sem filtro nenhum, e guarda uma entrada por número de
  // linha. É o caminho contrário do de cima — como a releitura das páginas cruas do cache no lado do Omie.
  const cruas = new Map();
  {
    let m2 = null;
    for (const l of lerAba(zip, aba.parte, ss)) {
      const textos = [...l.cel.entries()].filter(([, c]) => c.t);
      const rotulos = textos.map(([, c]) => norm(c.t));
      if (rotulos.includes('VENCIMENTO') && rotulos.includes('DIA PG')) { m2 = new Map(textos.map(([col, c]) => [norm(c.t), col])); continue; }
      if (!m2) continue;
      const texto = (r) => { const c = l.cel.get(m2.get(r)); return c?.t ? c.t.trim() : ''; };
      const numero = (r) => { const c = l.cel.get(m2.get(r)); return c?.v !== undefined ? c.v : 0; };
      let dt = null;
      for (const rot of COLUNAS_DE_DATA) { dt = dataDaCelula(l.cel.get(m2.get(rot))); if (dt) break; }
      const k = numero('ENTRADA'), lv = numero('SAIDA');
      const bruto = cent(k) !== 0 ? k : lv;
      cruas.set(l.n, {
        classe: norm(texto('CLASS. CONTABIL')) || '(vazio)', sub2: norm(texto('SUB 2')) || '(vazio)',
        pagamento: norm(texto('PAGAMENTO')), natureza: cent(bruto) === 0 ? '(sem)' : (bruto > 0 ? 'R' : 'P'),
        mes: dt ? `${dt.m}/${dt.a}` : '(sem data)', dia: dt?.d ?? null,
      });
    }
  }
  // A ABA DO MÊS: o bloco pronto que os dois gráficos de "Receita × despesa" usam — `Inicial` (42), `Entradas` (43),
  // `Gastos` (44) e `Final` (45), uma coluna por dia. Só a forma do bloco é lida; nenhum valor é guardado.
  const abaDoMes = blocoDoMes(zip, ss, abasDo(zip));
  // A SÉRIE DO ANO: um arquivo por mês na mesma pasta. Só o bloco `Entradas`/`Gastos` de cada um.
  const serie = [];
  for (let m = 1; m <= 12; m++) {
    const a = pasta.arquivos.find((f) => new RegExp(`^0?${m}\\s*-`).test(f));
    if (!a) { serie.push({ mes: m, ok: false, motivo: 'sem arquivo na pasta' }); continue; }
    try {
      const z = lerZip(fs.readFileSync(path.join(pasta.caminho, a)));
      const b = blocoDoMes(z, sharedStrings(z), abasDo(z));
      serie.push({ mes: m, ok: Boolean(b?.temEntradas && b?.temGastos), colunas: b?.colunas ?? 0, motivo: b ? null : 'sem o bloco Entradas/Gastos' });
    } catch (e) { serie.push({ mes: m, ok: false, motivo: `não deu para abrir: ${e.message}` }); }
  }
  return { ok: true, arquivo: arq, linhas, cruas, abaDoMes, serie };
}

// O bloco `Inicial` / `Entradas` / `Gastos` / `Final` da primeira aba do arquivo do mês, achado pelo RÓTULO da linha
// (coluna B) e não pelo número dela. Devolve só a forma: qual linha tem cada rótulo e quantas colunas de dia existem.
function blocoDoMes(zip, ss, abas) {
  for (const a of abas) {
    const linhas = lerAba(zip, a.parte, ss);
    if (!linhas) continue;
    const rotulo = new Map();
    for (const l of linhas) for (const [col, c] of l.cel) if (col === 'B' && c.t) rotulo.set(norm(c.t), l.n);
    const nEnt = rotulo.get('ENTRADAS'), nGas = rotulo.get('GASTOS');
    if (!nEnt || !nGas || nEnt === nGas) continue;
    const daLinha = (n) => linhas.find((l) => l.n === n);
    const colunas = [...(daLinha(nEnt)?.cel ?? new Map()).keys()].filter((c) => COLUNAS_DE_DIA.has(c)).length;
    return {
      aba: a.nome, colunas,
      temInicial: rotulo.has('INICIAL'), temEntradas: true, temGastos: true, temFinal: rotulo.has('FINAL'),
      linhaInicial: rotulo.get('INICIAL') ?? null, linhaEntradas: nEnt, linhaGastos: nGas, linhaFinal: rotulo.get('FINAL') ?? null,
      linhaReceitas: rotulo.get('RECEITAS') ?? null,
    };
  }
  return null;
}
const DFC = lerDfc();
const MOTIVO_DFC = DFC.ok ? null : DFC.motivo;

// O VOCABULÁRIO DO DFC, como `docs/fontes.md` o escreve — já passado pelo `norm` (maiúscula, sem acento), que é como
// as linhas da planilha são guardadas. Nenhuma lista aqui é heurística: cada uma copia a linha do documento.
const DFC_RECEITA = ['RECEITA COM VENDAS', 'RECEITA COM SERVICOS', 'OUTRAS RECEITAS', 'REEMBOLSO RECEITA', 'RENDIMENTO FINANCEIRO'];
const DFC_PESSOAL_CLASSE = ['FOLHA, IMPOSTOS E ADIANTAMENTOS', 'PESSOAL PJ', 'DESPESA CLT', 'DESPESA PJ', 'RESCISAO'];
const DFC_PESSOAL_SUB2 = ['DESPESAS CLT', 'DESPESAS PJ', 'PRO-LABORE ( RETIRADA DE SOCIO )', 'COMISSAO DE VENDAS', 'REEMBOLSO'];
// `FORNECEODORES COGS` é a MESMA conta escrita com erro de digitação na planilha (2 linhas em agosto de 2026, e só
// nesse mês dos doze): conta em custo de vendas do mesmo jeito, e a regra aceita as duas grafias (decisão do dono,
// 25/09/2026, "sim fornecedor COGS é custo de vendas").
const DFC_CUSTO_CLASSE = ['FORNECEDORES COGS', 'FORNECEODORES COGS', 'COMPRA DE MERCADORIA'];
const DFC_CUSTO_SUB2 = ['COMPRAS DE MERCADORIAS', 'FRETE E CARRETO', 'ARMAZENAGEM E MANUSEIO'];
const DFC_IMPOSTO_SUB2 = ['ISS', 'INSS', 'IRPJ / CSLL'];
const DFC_FINANCEIRO_SUB2 = ['JUROS', 'RENDIMENTO FINANCEIRO', 'EMPRESTIMO', 'TARIFAS BANCARIAS'];
const ePessoalDfc = (l) => l.natureza === 'P' && (DFC_PESSOAL_CLASSE.includes(l.classe) || DFC_PESSOAL_SUB2.includes(l.sub2));

// AS LINHAS DA GRAFIA ERRADA, no mês: quantas existem e quantas o filtro de custo de vendas leva. As duas grafias
// valem igual na coluna `CLASS. CONTABIL` — o que pode deixar uma linha de fora é a OUTRA condição da regra, o `SUB 2`,
// que este script não mexe. A página publica os dois números para o dono ver a diferença. `null` sem o DFC lido.
const ERRADAS_COGS = DFC.ok
  ? {
    total: DFC.linhas.filter((l) => l.classe === 'FORNECEODORES COGS').length,
    pegas: DFC.linhas.filter((l) => l.classe === 'FORNECEODORES COGS' && DFC_CUSTO_SUB2.includes(l.sub2)).length,
    sub2: [...new Set(DFC.linhas.filter((l) => l.classe === 'FORNECEODORES COGS' && !DFC_CUSTO_SUB2.includes(l.sub2)).map((l) => l.sub2))],
  }
  : null;

// A CONFERÊNCIA DO LADO DO DFC. Conta as linhas da planilha que o filtro da linha pega, escolhe a de MENOR número de
// linha — para o caso ser sempre o mesmo — e vai buscá-la de volta na releitura crua da aba, comparando os campos que
// o filtro usou. Nenhum valor é comparado: só a classificação, o sentido (entrada ou saída), a baixa e o mês.
function conferirDfc(filtra) {
  const pega = DFC.linhas.filter(filtra);
  if (!pega.length) return { quantas: 0, ok: false, vazio: true };
  const l = pega.slice().sort((a, b) => a.linha - b.linha)[0];
  const cru = DFC.cruas.get(l.linha);
  const dif = [];
  if (!cru) dif.push(`a linha ${l.linha} não foi achada de volta na segunda leitura da aba`);
  else {
    for (const [campo, usou, veio] of [
      ['CLASS. CONTABIL', l.classe, cru.classe], ['SUB 2', l.sub2, cru.sub2],
      ['PAGAMENTO', l.pagamento, cru.pagamento], ['sentido', l.natureza, cru.natureza], ['dia', l.dia, cru.dia],
    ]) if (String(veio ?? '') !== String(usou ?? '')) dif.push(`\`${campo}\` veio "${veio ?? '(ausente)'}" e o cálculo usou "${usou}"`);
    if (cru && cru.mes !== `${MES}/${ANO}`) dif.push(`a data da linha caiu em ${cru.mes} e o cálculo a contou em ${MES2}/${ANO}`);
  }
  return { quantas: pega.length, linha: l, ok: dif.length === 0, dif };
}

const textoDoCasoDfc = (r) => r.vazio
  ? null
  : `linha ${r.linha.linha} da aba \`FLUXO DE CAIXA\` do arquivo \`${DFC.arquivo}\` (\`CLASS. CONTABIL\` ${r.linha.classe}, \`SUB 2\` ${r.linha.sub2}, \`PAGAMENTO\` ${r.linha.pagamento}, ${r.linha.natureza === 'R' ? 'entrada' : 'saída'}, dia ${r.linha.dia}) — ${r.ok ? 'achada de volta pelo número da linha numa segunda leitura da aba, com os mesmos campos' : `**não conferiu**: ${r.dif.join('; ')}`}`;

// ================================================================ os indicadores
//
// Um item por indicador de `docs/fontes.md`, na ordem das telas. `estado` é 'conferido', 'divergente' ou 'a-conferir'.

const indicadores = [];
const add = (o) => indicadores.push(o);

// Os três baldes do mês, por empresa e natureza — a base de quase tudo nas Telas 1 e 2.
const MES_R = {}, MES_P = {};
for (const emp of EMPRESAS) { MES_R[emp] = contar(emp, noMes, 'R'); MES_P[emp] = contar(emp, noMes, 'P'); }
// `n` escreve o milhar como `docs/fontes.md` escreve (1.084); `pl` resolve a concordância de "1 título".
const n = (x) => Number(x).toLocaleString('pt-BR');
const pl = (x, um, varios) => `${n(x)} ${x === 1 ? um : varios}`;
const soma = (m) => m[1].total + m[2].total;
const porEmp = (m) => ({ 1: m[1].todos, 2: m[2].todos });
const ambos = (a, b) => ({ 1: [...a[1].todos, ...b[1].todos], 2: [...a[2].todos, ...b[2].todos] });
const trincaTexto = (m) => `${m[1].titulos.size} títulos + ${m[1].baixas.size} baixas de parcial + ${m[1].avulsos.size} avulsos na empresa 1 e ${m[2].titulos.size} + ${m[2].baixas.size} + ${m[2].avulsos.size} na 2`;

const FILTRO_CAIXA = `\`financas/mf\` → \`ListarMovimentos\` **sem \`cTpLancamento\`**, \`dDtPagtoDe\`/\`dDtPagtoAte\` em ${PERIODO}, fora os \`cStatus = "CANCELADO"\`, fora as categorias de transferência (5 códigos na empresa 1 e 4 na 2, decisão do dono de 25/09/2026, opção B), fora o par do adiantamento ao fornecedor (\`cOrigem = "ADCR"\` e todo lançamento de título com linha \`ADCP\`, decisão do dono de 25/09/2026, opção A), recorte da MeuBESS por \`detalhes.nCodCC\` em \`dados/contas-correntes-por-negocio.json\`, sem contar duas vezes (fica o título, um por \`nCodTitulo\`; do conta corrente entram o avulso e a baixa de parcial, um por \`nCodMovCC\`)`;

// Atalho para os indicadores das Telas 1 e 2 cuja fonte principal é o DFC. Todos ficam "a conferir:" quando as
// planilhas não foram lidas, mas a linha ainda traz a contagem do lado do Omie, que é o confronto deles.
// A linha de um indicador cuja FONTE PRINCIPAL é o DFC. Confere os dois lados: a linha da planilha que o filtro do
// DFC pega (`dfc`) e o lançamento do Omie que o confronto pega (`porEmpresa`). `dfcCaso` troca a conferência da
// planilha quando o indicador não lê o `FLUXO DE CAIXA` e sim o bloco pronto da aba do mês.
function linhaDoDfc({ tela, nome, fonte, filtro, contagem, porEmpresa, dfc = null, dfcCaso = null, dfcRotulo = 'linhas do `FLUXO DE CAIXA` no mês', extraMotivo = null, casoExtra = null }) {
  const caso = conferirPrimeiro(porEmpresa);
  const motivos = [];
  let contagemDfc = null, casoDfc = null, dfcOk = false;
  if (MOTIVO_DFC) {
    motivos.push(`a fonte principal deste indicador é o DFC e as planilhas não foram lidas nesta rodada — ${MOTIVO_DFC}`);
  } else if (dfcCaso) {
    contagemDfc = dfcCaso.contagem; casoDfc = dfcCaso.texto; dfcOk = dfcCaso.ok;
    if (!dfcOk) motivos.push(dfcCaso.motivo);
  } else if (dfc) {
    const r = conferirDfc(dfc);
    contagemDfc = `${n(r.quantas)} ${dfcRotulo}`;
    casoDfc = textoDoCasoDfc(r);
    dfcOk = r.ok;
    if (r.vazio) motivos.push('o filtro escrito em `docs/fontes.md` não pegou nenhuma linha do `FLUXO DE CAIXA` no arquivo do mês, então não há caso real do lado da fonte principal');
    else if (!r.ok) motivos.push(`a linha do DFC não conferiu: ${r.dif.join('; ')}`);
  } else {
    motivos.push('este indicador não tem, neste script, um filtro do lado do DFC para conferir');
  }
  if (extraMotivo) motivos.push(extraMotivo);
  if (caso && !caso.r.ok) motivos.push('o caso do lado do Omie não conferiu');
  const conferido = dfcOk && !extraMotivo && (!caso || caso.r.ok);
  const naoConferiu = dfcOk && !extraMotivo && caso && !caso.r.ok;
  add({
    tela, nome, fonte, filtro,
    contagem: contagemDfc ? `${contagemDfc}, do lado do DFC; ${contagem}` : contagem,
    estado: conferido ? 'conferido' : (naoConferiu ? 'divergente' : 'a-conferir'),
    motivo: motivos.join('; ') || null,
    caso: [
      casoDfc ? `no DFC, que é a fonte principal: ${casoDfc}` : null,
      textoDoCaso(caso, 'no lado do Omie, que é o confronto deste indicador: ',
        'no lado do Omie, que é o confronto deste indicador: nenhum lançamento entrou neste mês, e a coluna de confronto fica zerada'),
      casoExtra,
    ].filter(Boolean).join('; '),
  });
}

// As linhas CALCULADAS: não têm leitura própria, são aritmética sobre linhas que esta mesma página já confere. O que
// dá para conferir nelas é o caso do lado do Omie — e, quando o DFC foi lido, as linhas que elas consomem já vêm
// conferidas cada uma na linha dela.
const calc = (porEmpresa) => {
  const caso = conferirPrimeiro(porEmpresa);
  if (!caso) return { ok: false, motivo: 'nenhum lançamento entrou neste mês, então não há caso real para conferir' };
  return { ok: caso.r.ok, motivo: caso.r.ok ? null : (caso.r.motivo ?? caso.r.dif.join('; ')) };
};

// ---------------------------------------------------------------- Tela 1, cartões

linhaDoDfc({
  tela: 'Tela 1', nome: 'Saldo', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: `DFC: aba \`FLUXO DE CAIXA\` do arquivo do mês, na pasta da MeuBESS — \`ENTRADA\` (K) menos \`SAIDA\` (L), pelo mês de \`DIA PG\` (F). Omie: ${FILTRO_CAIXA}; separa entrada de saída por \`detalhes.cNatureza\``,
  contagem: `${soma(MES_R) + soma(MES_P)} lançamentos no Omie recortado (${soma(MES_R)} de entrada e ${soma(MES_P)} de saída) — nas entradas, ${trincaTexto(MES_R)}; nas saídas, ${trincaTexto(MES_P)}`,
  porEmpresa: ambos(MES_R, MES_P),
  dfc: () => true, dfcRotulo: 'linhas de lançamento baixado no mês, entradas e saídas',
});

linhaDoDfc({
  tela: 'Tela 1', nome: 'Receitas', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: `DFC: \`ENTRADA\` (K) de \`FLUXO DE CAIXA\`, somada pelo mês de \`DIA PG\` (F). Omie: ${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "R"\``,
  contagem: `${soma(MES_R)} lançamentos no Omie recortado — ${trincaTexto(MES_R)}`,
  porEmpresa: porEmp(MES_R),
  dfc: (l) => l.natureza === 'R', dfcRotulo: 'linhas de entrada no mês',
});

linhaDoDfc({
  tela: 'Tela 1', nome: 'Despesas', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: `DFC: \`SAIDA\` (L) de \`FLUXO DE CAIXA\`, pelo mês de \`DIA PG\` (F) — a classificação vem escrita na própria linha. Omie: ${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\``,
  contagem: `${soma(MES_P)} lançamentos no Omie recortado — ${trincaTexto(MES_P)}`,
  porEmpresa: porEmp(MES_P),
  dfc: (l) => l.natureza === 'P', dfcRotulo: 'linhas de saída no mês',
});

linhaDoDfc({
  tela: 'Tela 1', nome: 'Despesas pagas', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: `DFC: \`SAIDA\` (L) das linhas com \`PAGAMENTO\` (N) = \`PAGO\`, pelo mês de \`DIA PG\` (F). Omie: ${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\`; soma \`resumo.nValPago\` dos três baldes`,
  contagem: `${soma(MES_P)} lançamentos no Omie recortado — ${trincaTexto(MES_P)}; é a mesma leitura do cartão "Despesas", porque o filtro por data de pagamento só devolve título já baixado`,
  porEmpresa: porEmp(MES_P),
  dfc: (l) => l.natureza === 'P' && l.pagamento === 'PAGO', dfcRotulo: 'linhas de saída com `PAGAMENTO` = `PAGO` no mês',
});

// Despesas pendentes: a leitura que `docs/fontes.md` pede é `financas/mf` → `ListarMovimentos` com
// `cTpLancamento: "CP"` por VENCIMENTO, e ela está no cache desde `scripts/ler-omie-faltante.mjs`. O ano inteiro é
// lido de uma vez e o mês é recortado dele pela `dDtVenc` de cada lançamento — o mesmo que a consulta do mês daria.
// A pesquisa de títulos a pagar (`financas/pesquisartitulos`) fica como SEGUNDA OPINIÃO: outro serviço, mesmos campos.
{
  const pend = {}, seg = {};
  let falta = EMPRESAS.filter((emp) => !cpVenc[emp]);
  for (const emp of EMPRESAS) {
    pend[emp] = (cpVenc[emp] ?? []).map((m) => ({ ...m.detalhes, _resumo: m.resumo ?? {} })).filter((d) =>
      d.cStatus !== 'CANCELADO' && RECORTE.has(`${emp}|${d.nCodCC}`) && noMes(d.dDtVenc) && (d._resumo.cLiquidado ?? 'N') === 'N');
    seg[emp] = titulosP[emp].filter((t) => {
      const c = t.cabecTitulo ?? {};
      return c.cStatus !== 'CANCELADO' && RECORTE.has(`${emp}|${c.nCodCC}`) && noMes(c.dDtVenc) && (t.resumo?.cLiquidado ?? 'N') === 'N';
    });
  }
  const total = pend[1].length + pend[2].length;
  const totalSeg = seg[1].length + seg[2].length;
  let caso = 'nenhum título a pagar do recorte vence neste mês em aberto', estado = 'conferido', motivo = null;
  if (falta.length) {
    estado = 'a-conferir';
    motivo = `a leitura que \`docs/fontes.md\` pede — \`financas/mf\` → \`ListarMovimentos\` com \`cTpLancamento: "CP"\` por vencimento — não está no cache da(s) empresa(s) ${falta.join(' e ')}; rode antes \`node scripts/ler-omie-faltante.mjs\``;
  } else if (!total) {
    estado = 'a-conferir';
    motivo = 'nenhum título a pagar do recorte vence neste mês em aberto, então não há caso real para conferir (a contagem é zero, que é o que a tela mostraria)';
  } else {
    const emp = pend[1].length ? '1' : '2';
    const d = menorPor(pend[emp], 'nCodTitulo');
    const crus = acharCru(emp, LEITURA_CP_VENC, 'nCodTitulo', d.nCodTitulo);
    const dif = crus.length !== 1
      ? [`o \`nCodTitulo\` ${d.nCodTitulo} aparece ${crus.length} vez(es) na leitura crua, e o cálculo o contou uma`]
      : [...comparar(crus[0].detalhes, { cGrupo: d.cGrupo, cNatureza: d.cNatureza, cStatus: d.cStatus, nCodCC: d.nCodCC, cCodCateg: d.cCodCateg, dDtVenc: d.dDtVenc }),
        ...comparar(crus[0].resumo ?? {}, { cLiquidado: d._resumo.cLiquidado })];
    caso = `nCodTitulo ${d.nCodTitulo} (empresa ${emp}, \`${d.cGrupo}\`, \`cNatureza\` ${d.cNatureza}, \`cStatus\` ${d.cStatus}, \`nCodCC\` ${d.nCodCC}, \`cCodCateg\` ${d.cCodCateg}, vence em ${d.dDtVenc}, \`resumo.cLiquidado\` ${d._resumo.cLiquidado}) — ${dif.length ? `**não conferiu**: ${dif.join('; ')}` : `achado de volta na página ${crus[0]._pagina} da leitura crua do cache com os mesmos campos`}`;
    if (dif.length) { estado = 'divergente'; motivo = dif.join('; '); }
    else if (total !== totalSeg) {
      estado = 'divergente';
      motivo = `a segunda opinião não bate: \`financas/pesquisartitulos\` → \`PesquisarLancamentos\` com \`cNatureza: "P"\` por vencimento, com o mesmo recorte e o mesmo \`cLiquidado\`, dá ${totalSeg} título(s) e esta leitura dá ${total}`;
    }
  }
  add({
    tela: 'Tela 1', nome: 'Despesas pendentes', fonte: 'Omie recortado (principal) / DFC (confronto)',
    filtro: `\`financas/mf\` → \`ListarMovimentos\` com \`cTpLancamento: "CP"\`, \`dDtVencDe\`/\`dDtVencAte\` em ${PERIODO} (exceção ao regime de caixa: sem baixa não há data de pagamento) e \`resumo.cLiquidado = "N"\`; soma \`resumo.nValAberto\`, com o recorte da MeuBESS por \`detalhes.nCodCC\``,
    contagem: `${total} títulos a pagar em aberto (${pend[1].length} na empresa 1 e ${pend[2].length} na 2)${falta.length ? '' : `; a segunda opinião, \`financas/pesquisartitulos\` → \`PesquisarLancamentos\` com \`cNatureza: "P"\` por vencimento, dá ${totalSeg}`}`,
    estado, motivo, caso,
  });
}

{
  const pes = {};
  for (const emp of EMPRESAS) pes[emp] = contar(emp, noMes, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false });
  const pagos = { 1: pes[1].todos.filter((d) => d.cStatus === 'PAGO'), 2: pes[2].todos.filter((d) => d.cStatus === 'PAGO') };
  const c = conferencia('pessoal');
  linhaDoDfc({
    tela: 'Tela 1', nome: 'Despesas com funcionários', fonte: 'DFC (principal) / Omie recortado por categoria de pessoal (confronto)',
    filtro: `DFC: \`SAIDA\` (L) das linhas de pessoal, pelo mês de \`DIA PG\` (F) — \`CLASS. CONTABIL\` (I) em \`FOLHA, IMPOSTOS E ADIANTAMENTOS\`, \`PESSOAL PJ\`, \`DESPESA CLT\`, \`DESPESA PJ\`, \`RESCISÃO\`, e \`SUB 2\` (J) em \`DESPESAS CLT\`, \`DESPESAS PJ\`, \`PRÓ-LABORE ( retirada de sócio )\`, \`COMISSÃO DE VENDAS\`, \`REEMBOLSO\`. Omie: a mesma leitura de caixa, \`detalhes.cNatureza = "P"\` e \`detalhes.cStatus = "PAGO"\`, em qualquer departamento, com \`detalhes.cCodCateg\` na lista de pessoal do dono (${PESSOAL[1].length} códigos na empresa 1 e ${PESSOAL[2].length} na 2, decisão de 25/09/2026)`,
    contagem: `${pagos[1].length + pagos[2].length} lançamentos pagos nas categorias de pessoal (${pagos[1].length} na empresa 1 e ${pagos[2].length} na 2)`,
    porEmpresa: pagos,
    dfc: ePessoalDfc, dfcRotulo: 'linhas de saída de pessoal no mês, pela classificação escrita na própria linha',
    extraMotivo: c.bate ? null : `além disso, a contagem de jan–set do confronto refeita por este script (${c.meu.join(' e ')}) não bate com a de \`docs/fontes.md\` (${c.dito.join(' e ')})`,
  });
}

linhaDoDfc({
  tela: 'Tela 1', nome: '% desp. funcionários / receita líquida', fonte: 'DFC nas duas pontas (principal) / a mesma razão no Omie recortado (confronto)',
  filtro: 'DFC: numerador, o cartão acima; denominador, a receita líquida de caixa montada no DFC — `ENTRADA` (K) das linhas de receita menos as de dedução (`SUB 2` (J) = `DEVOLUCÃO`, `CLASS. CONTABIL` (I) = `ESTORNO`). Omie: a mesma razão feita toda no Omie recortado, com as 11 categorias de dedução do dono pesando no denominador; o selo herda a maior das duas diferenças',
  contagem: `no denominador, do lado do Omie, os ${soma(MES_R)} lançamentos de receita do mês menos os das categorias de dedução; no numerador, os do cartão acima`,
  porEmpresa: porEmp(MES_R),
  dfc: ePessoalDfc, dfcRotulo: 'linhas de pessoal no mês, que são o numerador desta razão',
});

// ---------------------------------------------------------------- Tela 1, blocos

// Top 10 despesas: o agrupamento por centro de custo só existe se a leitura pedir `cExibirDepartamentos: "S"` —
// nenhum método do Omie filtra por departamento, o rateio só vem no retorno. A leitura que `docs/fontes.md` conta é
// feita SEM esse parâmetro; a leitura irmã, com ele, está no cache desde `scripts/ler-omie-faltante.mjs`. As duas
// são a mesma faixa e o mesmo filtro, e o script confere que, no mês, elas trazem o MESMO conjunto de lançamentos
// antes de usar o rateio da segunda (a de fora do mês pode ter crescido: ela foi lida depois).
{
  const chave = (d) => `${d.cGrupo}|${d.nCodTitulo ?? 0}|${d.nCodMovCC ?? 0}`;
  let faltaLeitura = EMPRESAS.filter((emp) => !comDep[emp]);
  let mesmoConjunto = true, comRateio = 0, semRateio = 0, foraDoCadastro = 0;
  const nomes = new Set();
  const porChave = {};
  if (!faltaLeitura.length) {
    for (const emp of EMPRESAS) {
      porChave[emp] = new Map(comDep[emp].map((m) => [chave(m.detalhes ?? {}), m]));
      const doMes = new Set(comDep[emp]
        .filter((m) => m.detalhes?.cStatus !== 'CANCELADO' && RECORTE.has(`${emp}|${m.detalhes?.nCodCC}`) && noMes(m.detalhes?.dDtPagamento))
        .map((m) => chave(m.detalhes ?? {})));
      const meus = new Set(base(emp, noMes).linhas.map(chave));
      if (doMes.size !== meus.size || [...meus].some((k) => !doMes.has(k))) mesmoConjunto = false;
      for (const d of MES_P[emp].todos) {
        const deps = porChave[emp].get(chave(d))?.departamentos ?? [];
        if (!deps.length) { semRateio++; continue; }
        comRateio++;
        for (const x of deps) {
          const cad = departamentos[emp].get(String(x.cCodDepartamento));
          if (cad?.descricao) nomes.add(norm(cad.descricao)); else foraDoCadastro++;
        }
      }
    }
  }
  // O caso: o lançamento de menor código, entre os que têm rateio, achado de volta na leitura crua com departamento.
  let casoDep = null, difDep = null;
  if (!faltaLeitura.length && comRateio) {
    for (const emp of EMPRESAS) {
      const comR = MES_P[emp].todos.filter((d) => (porChave[emp].get(chave(d))?.departamentos ?? []).length);
      if (!comR.length) continue;
      const titulos = comR.filter((d) => d.cGrupo === 'CONTA_A_PAGAR');
      const d = titulos.length ? menorPor(titulos, 'nCodTitulo') : menorPor(comR, 'nCodMovCC');
      const eTitulo = d.cGrupo === 'CONTA_A_PAGAR';
      const crus = acharCru(emp, LEITURA_MF_DEP, eTitulo ? 'nCodTitulo' : 'nCodMovCC', eTitulo ? d.nCodTitulo : d.nCodMovCC)
        .filter((m) => m.detalhes.cGrupo === d.cGrupo);
      if (crus.length !== 1) { difDep = `o código do caso aparece ${crus.length} vez(es) na leitura crua com departamentos, e o cálculo o contou uma`; break; }
      const dif = comparar(crus[0].detalhes, { cGrupo: d.cGrupo, cNatureza: d.cNatureza, cStatus: d.cStatus, nCodCC: d.nCodCC, cCodCateg: d.cCodCateg, dDtPagamento: d.dDtPagamento });
      const deps = crus[0].departamentos ?? [];
      const cad = deps.length ? departamentos[emp].get(String(deps[0].cCodDepartamento)) : null;
      if (!cad) dif.push(`o \`cCodDepartamento\` do rateio não está no cadastro \`geral/departamentos\` da empresa ${emp}`);
      if (dif.length) { difDep = dif.join('; '); break; }
      casoDep = `${casoDoLancamento(emp, d)}, com ${pl(deps.length, 'linha de rateio', 'linhas de rateio')} em \`departamentos[]\` (a primeira no \`cCodDepartamento\` ${deps[0].cCodDepartamento}, que está em \`geral/departamentos\` da empresa ${emp} com \`descricao\` preenchida) — achado de volta na página ${crus[0]._pagina} da leitura crua com \`cExibirDepartamentos: "S"\`, com os mesmos campos`;
      break;
    }
  }
  const problema = faltaLeitura.length
    ? `a leitura do confronto — a mesma leitura de caixa **com \`cExibirDepartamentos: "S"\`** — não está no cache da(s) empresa(s) ${faltaLeitura.join(' e ')}; rode antes \`node scripts/ler-omie-faltante.mjs\``
    : (!mesmoConjunto
      ? 'a leitura com `cExibirDepartamentos: "S"` e a leitura que `docs/fontes.md` conta não trazem o mesmo conjunto de lançamentos no mês, então o rateio de uma não pode ser colado na contagem da outra'
      : (foraDoCadastro ? `${foraDoCadastro} linha(s) de rateio apontam um \`cCodDepartamento\` que não está em \`geral/departamentos\`` : (difDep || null)));
  linhaDoDfc({
    tela: 'Tela 1', nome: 'Top 10 despesas', fonte: 'DFC (principal) / Omie recortado por centro de custo (confronto)',
    filtro: 'DFC: `SAIDA` (L) no período por `DIA PG` (F), agrupada por `CLASS. CONTABIL` (I) ou por `SUB 2` (J); pega as 10 maiores, e cada linha tem uma classificação só, sem rateio. Omie: a mesma leitura de caixa **com `cExibirDepartamentos: "S"`**, somando `movimentos[].departamentos[].nDistrValor` por nome de departamento (as duas empresas juntas pelo nome, decisão do dono de 25/09/2026), com uma barra "sem centro de custo" para o que vem sem rateio',
    contagem: `${soma(MES_P)} lançamentos de despesa do mês — ${trincaTexto(MES_P)} —, dos quais ${comRateio} trazem rateio em \`departamentos[]\` e ${semRateio} caem na barra "sem centro de custo"; o rateio se distribui por ${pl(nomes.size, 'nome de departamento', 'nomes de departamento')}`,
    porEmpresa: porEmp(MES_P),
    dfc: (l) => l.natureza === 'P', dfcRotulo: `linhas de saída no mês, em ${new Set(DFC.ok ? DFC.linhas.filter((l) => l.natureza === 'P').map((l) => l.classe) : []).size} \`CLASS. CONTABIL\` distintas`,
    extraMotivo: problema,
    casoExtra: casoDep ? `no centro de custo, que é o confronto: ${casoDep}` : null,
  });
}

// Top 10 receitas: Omie principal, e dá para conferir inteiro — inclusive a descrição, porque `produtos/pedido` →
// `ListarPedidos` está no cache com o `det[]` de cada pedido.
{
  const caso = conferirPrimeiro(porEmp(MES_R));
  let descricao = null, difDescricao = null;
  if (caso) {
    const nCodOS = String(caso.d.nCodOS ?? '');
    if (nCodOS && nCodOS !== '0') {
      const p = pedidos[caso.emp].get(nCodOS);
      if (!p) difDescricao = `o lançamento aponta \`nCodOS\` ${nCodOS} e esse \`codigo_pedido\` não está no cache de \`produtos/pedido\` → \`ListarPedidos\``;
      else if (String(p.cabecalho?.numero_pedido ?? '') !== String(caso.d.cNumOS ?? '').trim())
        difDescricao = `o pedido ${nCodOS} tem \`numero_pedido\` ${p.cabecalho?.numero_pedido} e o lançamento traz \`cNumOS\` ${caso.d.cNumOS}`;
      else descricao = `a descrição dele vem do pedido de venda \`codigo_pedido\` ${nCodOS} (\`numero_pedido\` ${p.cabecalho.numero_pedido}, \`faturado\` ${p.infoCadastro?.faturado ?? '?'}), achado no cache de \`ListarPedidos\` com ${p.det?.length ?? 0} item(ns) em \`det[]\`, o primeiro com \`codigo_produto\` ${p.det?.[0]?.produto?.codigo_produto ?? '(sem)'} e \`descricao\` preenchida`;
    } else {
      descricao = `o lançamento não tem \`nCodOS\`, então a descrição é a \`descricao\` da categoria ${caso.d.cCodCateg} em \`geral/categorias\`, que está preenchida no cadastro da empresa ${caso.emp}`;
    }
  }
  const ok = Boolean(caso) && caso.r.ok && !difDescricao;
  add({
    tela: 'Tela 1', nome: 'Top 10 receitas', fonte: 'Omie recortado (principal) / DFC (confronto)',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "R"\`; ordena por \`detalhes.nValorTitulo\` no título e por \`resumo.nValPago\` no avulso e na baixa de parcial; data em \`detalhes.dDtVenc\` no título e \`detalhes.dDtPagamento\` no avulso, status em \`detalhes.cStatus\`; a descrição é a dos produtos do pedido de venda ligado por \`detalhes.nCodOS\` (o primeiro \`det[]\` mais "+N"), ou a \`descricao\` da categoria quando não há pedido (decisão do dono, 25/09/2026)`,
    contagem: `${soma(MES_R)} lançamentos de receita, que concorrem ao Top 10 — ${trincaTexto(MES_R)}`,
    estado: ok ? 'conferido' : 'divergente',
    motivo: ok ? null : [caso ? null : 'nenhum lançamento de receita entrou neste mês', caso && !caso.r.ok ? (caso.r.motivo ?? caso.r.dif.join('; ')) : null, difDescricao].filter(Boolean).join('; '),
    caso: caso ? `${textoDoCaso(caso)}; ${descricao ?? difDescricao}` : 'nenhum lançamento de receita entrou neste mês',
  });
}

// Os dois gráficos de "Receita × despesa" não leem o `FLUXO DE CAIXA`: leem o bloco pronto da aba do mês — `Inicial`,
// `Entradas`, `Gastos` e `Final`, uma coluna por dia. A conferência aqui é da FORMA do bloco (que linha tem cada
// rótulo e quantas colunas de dia existem), achada pelo rótulo escrito na coluna B, e não pelo número da linha.
{
  const b = DFC.ok ? DFC.abaDoMes : null;
  const falta = b ? ['Inicial', 'Entradas', 'Gastos', 'Final'].filter((r) => !b[`tem${r}`]) : null;
  linhaDoDfc({
    tela: 'Tela 1', nome: 'Receita × despesa por dia', fonte: 'DFC (principal) / Omie recortado (confronto)',
    filtro: 'DFC: aba do mês do arquivo da pasta da MeuBESS, linhas `Entradas` (43) e `Gastos` (44), uma coluna por dia de `D` a `AH`, com `Inicial` (42) e `Final` (45). Omie: a mesma leitura de caixa, agrupada pelo dia de `detalhes.dDtPagamento` e separada por `detalhes.cNatureza`',
    contagem: `${soma(MES_R) + soma(MES_P)} lançamentos no mês (${soma(MES_R)} de entrada e ${soma(MES_P)} de saída), distribuídos pelos dias de \`dDtPagamento\``,
    porEmpresa: ambos(MES_R, MES_P),
    dfcCaso: !b
      ? { ok: false, contagem: 'nenhuma', texto: null, motivo: 'o arquivo do mês não tem, em nenhuma aba, o bloco com os rótulos `Entradas` e `Gastos` na coluna B' }
      : {
        ok: falta.length === 0 && b.colunas > 0,
        contagem: `${b.colunas} colunas de dia no bloco pronto`,
        texto: `linha ${b.linhaEntradas} (\`Entradas\`) e linha ${b.linhaGastos} (\`Gastos\`) da aba \`${b.aba}\` do arquivo \`${DFC.arquivo}\`, com \`Inicial\` na ${b.linhaInicial ?? '(ausente)'} e \`Final\` na ${b.linhaFinal ?? '(ausente)'} e ${b.colunas} colunas de dia — as quatro linhas foram achadas pelo rótulo escrito na coluna B, e não pelo número da linha`,
        motivo: falta.length ? `o bloco da aba do mês não tem ${falta.join(', ')}` : 'o bloco da aba do mês não tem nenhuma coluna de dia',
      },
  });

  // A série do ano: um arquivo por mês na mesma pasta. Conferir é abrir cada um e achar o mesmo bloco.
  const ok = DFC.ok ? DFC.serie.filter((x) => x.ok) : [];
  const semArquivo = DFC.ok ? DFC.serie.filter((x) => !x.ok) : [];
  linhaDoDfc({
    tela: 'Tela 1', nome: 'Receita × despesa por mês', fonte: 'DFC (principal) / Omie recortado (confronto)',
    filtro: 'DFC: um arquivo por mês na pasta da MeuBESS, somando `Entradas` (43) e `Gastos` (44) da aba do mês na faixa do seletor — é a única fonte que cobre o ano. Omie: a mesma leitura de caixa, agrupada pelo ano-mês de `detalhes.dDtPagamento`',
    contagem: `${soma(MES_R) + soma(MES_P)} lançamentos na coluna do mês; na série inteira que o Omie cobre (jan–set), ${n(totalJanSet[1].R.total + totalJanSet[2].R.total)} de entrada e ${n(totalJanSet[1].P.total + totalJanSet[2].P.total)} de saída`,
    porEmpresa: ambos(MES_R, MES_P),
    dfcCaso: {
      ok: ok.length === 12,
      contagem: `${ok.length} dos 12 meses de ${ANO} com o bloco \`Entradas\`/\`Gastos\``,
      texto: ok.length
        ? `os arquivos dos meses ${ok.map((x) => String(x.mes).padStart(2, '0')).join(', ')} da pasta da MeuBESS foram abertos um a um e cada um trouxe o bloco \`Entradas\`/\`Gastos\` na aba do mês (o de ${MES2} com ${DFC.abaDoMes?.colunas ?? 0} colunas de dia)`
        : null,
      motivo: `não deu para montar a série inteira: ${semArquivo.map((x) => `mês ${String(x.mes).padStart(2, '0')} (${x.motivo})`).join('; ')}`,
    },
  });
}

// ---------------------------------------------------------------- Tela 2, cartões

linhaDoDfc({
  tela: 'Tela 2', nome: 'Receita total', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: 'DFC: `ENTRADA` (K) das linhas de receita (`SUB 2` (J) em `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`), somada pelo mês de `DIA PG` (F) — ou, pronta, a linha `Receitas` (B15) da aba do mês. Omie: a mesma leitura de caixa com `detalhes.cNatureza = "R"`. É o mesmo número do cartão "Receitas" da Tela 1, de propósito',
  contagem: `${soma(MES_R)} lançamentos no Omie recortado — ${trincaTexto(MES_R)}`,
  porEmpresa: porEmp(MES_R),
  dfc: (l) => l.natureza === 'R' && DFC_RECEITA.includes(l.sub2), dfcRotulo: 'linhas de entrada no mês com `SUB 2` de receita',
});

linhaDoDfc({
  tela: 'Tela 2', nome: 'Custos e despesas', fonte: 'DFC (principal) / Omie recortado (confronto)',
  filtro: 'DFC: `SAIDA` (L) agrupada por `CLASS. CONTABIL` (I), pelo mês de `DIA PG` (F) — `FORNECEDORES COGS` é custo e `FORNECEDORES G&A` é despesa geral, separação que só existe no DFC. Omie: a mesma leitura de caixa com `detalhes.cNatureza = "P"`, contra o total',
  contagem: `${soma(MES_P)} lançamentos no Omie recortado — ${trincaTexto(MES_P)}`,
  porEmpresa: porEmp(MES_P),
  dfc: (l) => l.natureza === 'P', dfcRotulo: 'linhas de saída no mês, agrupáveis por `CLASS. CONTABIL`',
});

// Os três cartões calculados da Tela 2 dependem, na aritmética, de linhas cuja fonte principal é o DFC — deduções,
// custos de vendas e impostos pagos. Por isso ficam "a conferir:" enquanto o DFC não é lido, mesmo sendo cartões
// "do Omie recortado (calculado)".
for (const c of [
  { nome: 'EBITDA', conta: 'receita líquida − custos de vendas − despesas gerais, sem depreciação e sem amortização (o Omie não tem categoria delas; decisão do dono de 25/09/2026)', depende: '"(−) Deduções" e "(−) Custos de vendas"' },
  { nome: 'Lucro líquido', conta: 'EBITDA + resultado financeiro − impostos pagos (guias), também sem depreciação e sem amortização', depende: '"(−) Deduções", "(−) Custos de vendas" e "(−) Impostos pagos (guias)"' },
  { nome: 'Margem de lucro', conta: 'lucro líquido ÷ receita, os dois termos do Omie recortado', depende: 'as mesmas linhas do lucro líquido' },
]) {
  const caso = conferirPrimeiro(ambos(MES_R, MES_P));
  add({
    tela: 'Tela 2', nome: c.nome, fonte: 'Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto)',
    filtro: `não tem leitura própria: ${c.conta}, sobre as linhas da tabela do DRE, todas vindas da mesma leitura de caixa (${FILTRO_CAIXA})`,
    contagem: `${soma(MES_R) + soma(MES_P)} lançamentos do mês, que passam pelas linhas que o compõem (${soma(MES_R)} de receita e ${soma(MES_P)} de despesa), antes de cada linha aplicar a lista de categorias dela`,
    estado: MOTIVO_DFC ? 'a-conferir' : (caso && caso.r.ok ? 'conferido' : 'divergente'),
    motivo: MOTIVO_DFC
      ? `a conta deste cartão consome ${c.depende}, cuja fonte principal é o DFC — ${MOTIVO_DFC}, então o número do cartão não pôde ser fechado nem conferido só com o cache do Omie`
      : (caso && caso.r.ok ? null : (caso ? (caso.r.motivo ?? caso.r.dif.join('; ')) : 'nenhum lançamento entrou neste mês')),
    caso: `${textoDoCaso(caso, 'no lado do Omie: ')}; o cartão não tem leitura própria — é aritmética sobre ${c.depende} e as demais linhas da tabela, cada uma conferida na linha dela nesta página, com o DFC lido do arquivo do mês`,
  });
}

// ---------------------------------------------------------------- Tela 2, linhas do DRE

// (+) Receitas e (=) Receita bruta — Omie inteiro, e conferíveis.
{
  const venda = {}, outras = {};
  for (const emp of EMPRESAS) {
    venda[emp] = contar(emp, noMes, 'R', { categoria: naLista(VENDA_DE_PRODUTOS) });
    outras[emp] = contar(emp, noMes, 'R', { categoria: naLista(OUTRAS_RECEITAS[emp]) });
  }
  const total = venda[1].total + venda[2].total + outras[1].total + outras[2].total;
  const caso = conferirPrimeiro(ambos(venda, outras));
  const cg = conferencia('grupos-receita');
  const cat = caso ? categorias[caso.emp].get(String(caso.d.cCodCateg)) : null;
  const ok = Boolean(caso) && caso.r.ok && cg.bate;
  const casoTexto = caso
    ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está em \`geral/categorias\` da empresa ${caso.emp} com \`conta_receita\` ${cat?.conta_receita ?? '?'} e \`totalizadora\` ${cat?.totalizadora ?? '?'}, e cai em ${VENDA_DE_PRODUTOS.includes(String(caso.d.cCodCateg)) ? '"vendas de produtos"' : '"outras receitas"'}`
    : 'nenhum lançamento de receita entrou neste mês';
  add({
    tela: 'Tela 2', nome: '(+) Receitas: outras receitas, vendas de produtos', fonte: 'Omie recortado (principal) / DFC (confronto)',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "R"\`; a linha se divide pela CATEGORIA do lançamento (decisão do dono, 25/09/2026): venda de produtos são \`1.01.01\`, \`1.01.03\` e \`1.04.01\` nas duas empresas, e outras receitas é todo o resto com \`conta_receita = "S"\` e \`totalizadora = "N"\` em \`geral/categorias\` fora as de transferência (${OUTRAS_RECEITAS[1].length} códigos na empresa 1 e ${OUTRAS_RECEITAS[2].length} na 2); as quatro totalizadoras \`1.01\` a \`1.04\` ficam fora dos dois grupos`,
    contagem: `${total} lançamentos — ${venda[1].total + venda[2].total} em vendas de produtos (${venda[1].total} na empresa 1 e ${venda[2].total} na 2) e ${outras[1].total + outras[2].total} em outras receitas (${outras[1].total} e ${outras[2].total})`,
    estado: ok ? 'conferido' : 'divergente',
    motivo: ok ? null : [
      caso ? null : 'nenhum lançamento de receita entrou neste mês',
      caso && !caso.r.ok ? (caso.r.motivo ?? caso.r.dif.join('; ')) : null,
      cg.bate ? null : `o cadastro do cache dá ${cg.meu.join(' e ')} códigos de outra receita e \`docs/fontes.md\` diz ${cg.dito.join(' e ')}`,
    ].filter(Boolean).join('; '),
    caso: casoTexto,
  });

  // A conta totalizadora da receita bruta no Omie é a que tem `totalizaDRE = "S"` em `geral/dre`. O cadastro está no
  // cache desde `scripts/ler-omie-faltante.mjs`, e o script o relê aqui em vez de citar a leitura de 24/09/2026.
  const semDre = EMPRESAS.filter((emp) => !contasDre[emp]);
  const totalizadoras = semDre.length ? null : Object.fromEntries(EMPRESAS.map((emp) =>
    [emp, (contasDre[emp] ?? []).filter((c) => c.totalizaDRE === 'S')]));
  const iguais = totalizadoras && EMPRESAS.every((emp) => totalizadoras[emp].length === totalizadoras[1].length);
  const dreOk = Boolean(totalizadoras) && totalizadoras[1].length > 0 && iguais;
  const receitaBruta = dreOk
    ? totalizadoras[1].slice().sort((a, b) => String(a.codigoDRE).localeCompare(String(b.codigoDRE)))[0]
    : null;
  add({
    tela: 'Tela 2', nome: '(=) Receita bruta', fonte: 'Omie recortado, calculado',
    filtro: 'soma das duas linhas de receita acima; no Omie a conta totalizadora é a que tem `totalizaDRE = "S"` em `geral/dre` → `ListarCadastroDRE`. Não tem leitura própria: os lançamentos são exatamente os da linha "(+) Receitas"',
    contagem: `${total} lançamentos — os mesmos da linha "(+) Receitas"${dreOk ? `; o cadastro do DRE tem ${n(contasDre[1].length)} contas em cada empresa, ${totalizadoras[1].length} delas com \`totalizaDRE = "S"\`` : ''}`,
    estado: (caso && caso.r.ok && dreOk) ? 'conferido' : 'divergente',
    motivo: [
      caso ? (caso.r.ok ? null : (caso.r.motivo ?? caso.r.dif.join('; '))) : 'nenhum lançamento de receita entrou neste mês',
      semDre.length ? `o cadastro \`geral/dre\` → \`ListarCadastroDRE\` não está no cache da(s) empresa(s) ${semDre.join(' e ')}; rode antes \`node scripts/ler-omie-faltante.mjs\`` : null,
      totalizadoras && !iguais ? `as duas empresas têm número diferente de contas com \`totalizaDRE = "S"\` (${EMPRESAS.map((e) => `empresa ${e}: ${totalizadoras[e].length}`).join(', ')})` : null,
    ].filter(Boolean).join('; ') || null,
    caso: caso
      ? `${textoDoCaso(caso)} — é o mesmo caso da linha "(+) Receitas"${dreOk ? `; e a conta totalizadora que dá nome a esta linha foi relida no cadastro: \`codigoDRE\` ${receitaBruta.codigoDRE} (\`nivelDRE\` ${receitaBruta.nivelDRE}, \`sinalDRE\` ${receitaBruta.sinalDRE}, \`totalizaDRE\` S, \`naoExibirDRE\` ${receitaBruta.naoExibirDRE ?? '(vazio)'}), uma das ${totalizadoras[1].length} totalizadoras que as duas empresas têm em \`geral/dre\`` : ''}`
      : 'nenhum lançamento de receita entrou neste mês',
  });
}

// (−) Deduções — DFC principal, confronto do Omie pelas 11 categorias e pelo cOperacao 13.
{
  const ded = {}, oper13 = {};
  for (const emp of EMPRESAS) {
    ded[emp] = contar(emp, noMes, 'P', { categoria: naLista(DEDUCOES[emp]), comTransferencia: false });
    oper13[emp] = base(emp, noMes).linhas.filter((d) => String(d.cOperacao ?? '') === '13');
  }
  linhaDoDfc({
    tela: 'Tela 2', nome: '(−) Deduções: devoluções, taxas de serviço', fonte: 'DFC (principal) / Omie recortado (confronto)',
    filtro: 'DFC: a devolução vem marcada na própria linha — `SUB 2` (J) = `DEVOLUCÃO`, com `ESTORNO` em `CLASS. CONTABIL` (I) —, pelo mês de `DIA PG` (F). Omie: `detalhes.cOperacao = "13"` (devolução de venda) e as 11 categorias que o dono decidiu em 24/09/2026 (5 na empresa 1 e 6 na 2; o ISS retido `2.06.07` saiu da lista em 25/09/2026, opção A). Os campos de retenção do título não entram',
    contagem: `${ded[1].total + ded[2].total} lançamentos nas categorias de dedução (${ded[1].total} na empresa 1 e ${ded[2].total} na 2), mais ${oper13[1].length + oper13[2].length} com \`cOperacao = "13"\` no recorte do mês`,
    porEmpresa: { 1: ded[1].todos, 2: ded[2].todos },
    dfc: (l) => l.sub2 === 'DEVOLUCAO' || l.classe === 'ESTORNO', dfcRotulo: 'linhas de dedução no mês, pelas duas marcas que `docs/fontes.md` lista (`SUB 2` = `DEVOLUCÃO` ou `CLASS. CONTABIL` = `ESTORNO`)',
  });
}

add({
  tela: 'Tela 2', nome: '(=) Receita líquida', fonte: 'mistura as duas, calculado',
  filtro: 'receita bruta (Omie recortado, linha acima) − deduções (DFC, linha acima). Não tem leitura própria',
  contagem: `no minuendo, os ${soma(MES_R)} lançamentos de receita do Omie; o subtraendo vem das linhas de dedução do DFC`,
  estado: MOTIVO_DFC ? 'a-conferir' : (calc(porEmp(MES_R)).ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC
    ? `é a soma que a decisão de 24/09/2026 deixou com uma fonte de cada lado: o subtraendo é a linha "(−) Deduções", do DFC — ${MOTIVO_DFC}`
    : calc(porEmp(MES_R)).motivo,
  caso: `${textoDoCaso(conferirPrimeiro(porEmp(MES_R)), 'no minuendo, que é do Omie: ', 'nenhum lançamento de receita entrou neste mês')}; o subtraendo é a linha "(−) Deduções", conferida na linha dela nesta página, no arquivo do mês do DFC`,
});

// (−) Custos de vendas — DFC principal, confronto do Omie pela lista de 38 códigos.
{
  const cv = {};
  for (const emp of EMPRESAS) cv[emp] = contar(emp, noMes, 'P', { categoria: naLista(CUSTO_DE_VENDAS[emp]) });
  const c = conferencia('custos');
  linhaDoDfc({
    tela: 'Tela 2', nome: '(−) Custos de vendas: custo do produto, outros custos', fonte: 'DFC (principal) / Omie recortado (confronto)',
    filtro: 'DFC: `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `FORNECEDORES COGS` (ou `FORNECEODORES COGS`, a mesma conta escrita com erro de digitação na planilha — as duas grafias contam, decisão do dono de 25/09/2026) ou `COMPRA DE MERCADORIA`, e `SUB 2` (J) em `COMPRAS DE MERCADORIAS`, `FRETE E CARRETO` e `ARMAZENAGEM E MANUSEIO`. Omie: a mesma leitura de caixa com `detalhes.cNatureza = "P"`, fora o par do adiantamento, pela lista de 38 códigos que o dono decidiu em 25/09/2026 (22 na empresa 1 e 16 na 2) — **pelo código da categoria, e não por `codigo_dre`**',
    contagem: `${cv[1].total + cv[2].total} lançamentos — ${cv[1].titulos.size} títulos + ${cv[1].baixas.size} baixas de parcial + ${cv[1].avulsos.size} avulsos na empresa 1 e ${cv[2].titulos.size} + ${cv[2].baixas.size} + ${cv[2].avulsos.size} na 2`,
    porEmpresa: { 1: cv[1].todos, 2: cv[2].todos },
    dfc: (l) => DFC_CUSTO_CLASSE.includes(l.classe) && DFC_CUSTO_SUB2.includes(l.sub2),
    dfcRotulo: `linhas de custo no mês (\`CLASS. CONTABIL\` de COGS com \`SUB 2\` de compra, frete ou armazenagem)${ERRADAS_COGS === null || ERRADAS_COGS.pegas === 0 ? '' : `, das quais ${ERRADAS_COGS.pegas} pela grafia errada \`FORNECEODORES COGS\`, que a regra passou a aceitar em 25/09/2026`}`,
    casoExtra: ERRADAS_COGS === null || ERRADAS_COGS.total === 0 ? null
      : `a grafia errada \`FORNECEODORES COGS\`, que a regra aceita desde 25/09/2026, aparece em ${ERRADAS_COGS.total} ${ERRADAS_COGS.total === 1 ? 'linha' : 'linhas'} do mês e o filtro leva ${ERRADAS_COGS.pegas}${ERRADAS_COGS.pegas === ERRADAS_COGS.total ? '' : `: as ${ERRADAS_COGS.total - ERRADAS_COGS.pegas} que ficam de fora têm \`SUB 2\` ${ERRADAS_COGS.sub2.map((x) => `\`${x}\``).join(', ')}, que não está entre os três \`SUB 2\` de custo que a regra de \`docs/fontes.md\` lista — **o dono decidiu a grafia, não o \`SUB 2\`**, então elas seguem fora desta linha até ele dizer o contrário`}`,
    extraMotivo: c.bate ? null : `além disso, a contagem de jan–set do confronto refeita por este script (${c.meu.join(', ')}) não bate com a de \`docs/fontes.md\` (${c.dito.join(', ')})`,
  });
}

add({
  tela: 'Tela 2', nome: '(=) Lucro bruto', fonte: 'mistura as duas, calculado',
  filtro: 'receita líquida (linha acima, que já mistura) − custos de vendas (DFC). Não tem leitura própria',
  contagem: `${soma(MES_R)} lançamentos de receita e ${soma(MES_P)} de despesa do Omie, que passam pelas linhas que a compõem, antes de cada linha aplicar a lista dela`,
  estado: MOTIVO_DFC ? 'a-conferir' : (calc(porEmp(MES_P)).ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC
    ? `é consequência aritmética de "(=) Receita líquida" e de "(−) Custos de vendas", as duas com o DFC de um lado — ${MOTIVO_DFC}`
    : calc(porEmp(MES_P)).motivo,
  caso: `${textoDoCaso(conferirPrimeiro(porEmp(MES_P)), 'no lado do Omie: ')}; é aritmética de "(=) Receita líquida" e "(−) Custos de vendas", conferidas nas linhas delas nesta página, no arquivo do mês do DFC`,
});

// (−) Despesas gerais — Omie inteiro, e conferível.
{
  const dg = {};
  for (const emp of EMPRESAS) dg[emp] = contar(emp, noMes, 'P', {
    categoria: (cod) => categorias[emp].get(cod)?.conta_despesa === 'S'
      && !CUSTO_DE_VENDAS[emp].includes(cod) && !RESULTADO_FINANCEIRO[emp].includes(cod) && !FORA_DO_DRE[emp].includes(cod),
  });
  const caso = conferirPrimeiro({ 1: dg[1].todos, 2: dg[2].todos });
  const cat = caso ? categorias[caso.emp].get(String(caso.d.cCodCateg)) : null;
  add({
    tela: 'Tela 2', nome: '(−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI', fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\` e as categorias com \`conta_despesa = "S"\` em \`geral/categorias\`, agrupadas pelo \`codigo_dre\` — cada lançamento entra pela categoria dele, não por departamento. Saem desta linha, para as linhas próprias, as ${CUSTO_DE_VENDAS[1].length + CUSTO_DE_VENDAS[2].length} categorias de custo de vendas e as ${RESULTADO_FINANCEIRO[1].length + RESULTADO_FINANCEIRO[2].length} de resultado financeiro; ficam fora do DRE os empréstimos e transferências Intercompany (${INTERCOMPANY[1].length} códigos na empresa 1 e ${INTERCOMPANY[2].length} na 2); Cartão de Credito (\`2.11.98\`), Aluguel Veiculo (\`2.11.99\`) e Financiamento Veiculo (\`2.11.95\`) da empresa 1 ficam aqui, embora o Omie pendure os dois primeiros em Despesas Financeiras e o terceiro em Outros Custos (decisão do dono, 25/09/2026; o Financiamento Veiculo entrou nesta linha pela terceira resposta do mesmo dia, e segue fora do resultado financeiro)`,
    contagem: `${dg[1].total + dg[2].total} lançamentos — ${dg[1].titulos.size} títulos + ${dg[1].baixas.size} baixas de parcial + ${dg[1].avulsos.size} avulsos na empresa 1 e ${dg[2].titulos.size} + ${dg[2].baixas.size} + ${dg[2].avulsos.size} na 2`,
    estado: caso && caso.r.ok ? 'conferido' : 'divergente',
    motivo: caso && caso.r.ok ? null : (caso ? (caso.r.motivo ?? caso.r.dif.join('; ')) : 'nenhum lançamento de despesa geral entrou neste mês'),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está em \`geral/categorias\` da empresa ${caso.emp} com \`conta_despesa\` ${cat?.conta_despesa ?? '?'} e \`codigo_dre\` ${cat?.codigo_dre || '(vazio)'}, e não está em nenhuma das três listas que saem desta linha`
      : 'nenhum lançamento de despesa geral entrou neste mês',
  });
}

add({
  tela: 'Tela 2', nome: '(=) EBITDA', fonte: 'Omie recortado, calculado',
  filtro: 'lucro bruto − despesas gerais, isto é, receita líquida − custos de vendas − despesas gerais, antes do resultado financeiro, dos impostos, da depreciação e da amortização. Não tem leitura própria',
  contagem: `${soma(MES_R) + soma(MES_P)} lançamentos do mês, que passam pelas linhas que a compõem`,
  estado: MOTIVO_DFC ? 'a-conferir' : (calc(porEmp(MES_P)).ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC
    ? `segue o cartão "EBITDA" do topo: a conta consome "(−) Deduções" e "(−) Custos de vendas", cuja fonte principal é o DFC — ${MOTIVO_DFC}`
    : calc(porEmp(MES_P)).motivo,
  caso: `${textoDoCaso(conferirPrimeiro(porEmp(MES_P)), 'no lado do Omie: ')}; segue o cartão "EBITDA" do topo — as linhas que a conta consome estão conferidas nas linhas delas nesta página`,
});

// (+/−) Resultado financeiro — Omie inteiro, e conferível.
{
  const fin = {};
  for (const emp of EMPRESAS) fin[emp] = {
    R: contar(emp, noMes, 'R', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
    P: contar(emp, noMes, 'P', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
  };
  const caso = conferirPrimeiro({ 1: [...fin[1].R.todos, ...fin[1].P.todos], 2: [...fin[2].R.todos, ...fin[2].P.todos] });
  const c = conferencia('financeiro');
  const ok = Boolean(caso) && caso.r.ok && c.bate;
  add({
    tela: 'Tela 2', nome: '(+/−) Resultado financeiro: receitas e despesas financeiras', fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)',
    filtro: `${FILTRO_CAIXA}, separando por \`detalhes.cNatureza\` o que é \`R\` (rendimentos) do que é \`P\` (juros, tarifas, IOF, empréstimo), pelas 15 categorias que o dono decidiu em 25/09/2026 (7 na empresa 1 e 8 na 2), **pelo código da categoria e não pela conta do DRE**; cartão de crédito, aluguel de veículo e os empréstimos e transferências Intercompany não entram aqui. Confronto no DFC por \`SUB 2\` (J) em \`JUROS\`, \`RENDIMENTO FINANCEIRO\`, \`EMPRESTIMO\`, \`TARIFAS BANCÁRIAS\``,
    contagem: `${fin[1].R.total + fin[2].R.total + fin[1].P.total + fin[2].P.total} lançamentos — na receita financeira, ${fin[1].R.total} na empresa 1 e ${fin[2].R.total} na 2; na despesa financeira, ${fin[1].P.total} e ${fin[2].P.total}`,
    estado: ok ? 'conferido' : 'divergente',
    motivo: ok ? null : [
      caso ? null : 'nenhum lançamento de resultado financeiro entrou neste mês',
      caso && !caso.r.ok ? (caso.r.motivo ?? caso.r.dif.join('; ')) : null,
      c.bate ? null : `a contagem de jan–set refeita por este script (${c.meu.join(', ')}) não bate com a de \`docs/fontes.md\` (${c.dito.join(', ')})`,
    ].filter(Boolean).join('; '),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está na lista de resultado financeiro da empresa ${caso.emp} e vem no lado ${caso.d.cNatureza === 'R' ? 'de receita financeira' : 'de despesa financeira'}`
      : 'nenhum lançamento de resultado financeiro entrou neste mês',
  });
}

// (−) Impostos pagos (guias) — DFC principal, confronto do Omie pela categoria.
{
  const imp = {};
  for (const emp of EMPRESAS) imp[emp] = contar(emp, noMes, 'P', { categoria: naLista(IMPOSTOS_GUIAS[emp]), comTransferencia: false });
  const c = conferencia('guias');
  linhaDoDfc({
    tela: 'Tela 2', nome: '(−) Impostos pagos (guias)', fonte: 'DFC, guias pagas (principal) / Omie recortado (confronto)',
    filtro: 'DFC: `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `IMPOSTOS E CONTRIBUIÇÕES` e `SUB 2` (J) em `ISS`, `INSS` e `IRPJ / CSLL`. Omie: a mesma leitura de caixa com `detalhes.cNatureza = "P"`, reconhecendo a guia **pela categoria e não pelo `cTipo`** — `2.06.05`, `2.06.06`, `2.06.07`, `2.03.06` e, só na empresa 1, `2.01.92` (decisão do dono, 25/09/2026, opção A: a Tela 2 tem só esta linha de impostos)',
    contagem: `${imp[1].total + imp[2].total} lançamentos — ${pl(imp[1].titulos.size + imp[2].titulos.size, "título", "títulos")}, ${pl(imp[1].baixas.size + imp[2].baixas.size, "baixa de parcial", "baixas de parcial")} e ${pl(imp[1].avulsos.size + imp[2].avulsos.size, "avulso", "avulsos")}, somando as duas empresas`,
    porEmpresa: { 1: imp[1].todos, 2: imp[2].todos },
    dfc: (l) => l.classe === 'IMPOSTOS E CONTRIBUICOES' && DFC_IMPOSTO_SUB2.includes(l.sub2), dfcRotulo: 'linhas de guia no mês (`IMPOSTOS E CONTRIBUIÇÕES` com `SUB 2` em ISS, INSS ou IRPJ / CSLL)',
    extraMotivo: c.bate ? null : `além disso, a contagem de jan–set do confronto refeita por este script (${c.meu.join(', ')}) não bate com a de \`docs/fontes.md\` (${c.dito.join(', ')})`,
  });
}

add({
  tela: 'Tela 2', nome: '(=) Lucro líquido', fonte: 'Omie recortado, calculado',
  filtro: 'EBITDA (linha acima) + resultado financeiro − impostos pagos (guias). Não tem leitura própria; sai sem depreciação e sem amortização, e a linha "(−) Impostos retidos na nota" não existe mais (decisão do dono, 25/09/2026, opção A)',
  contagem: `${soma(MES_R) + soma(MES_P)} lançamentos do mês, que passam pelas linhas que a compõem`,
  estado: MOTIVO_DFC ? 'a-conferir' : (calc(porEmp(MES_P)).ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC
    ? `segue o cartão "Lucro líquido" do topo: a conta consome "(−) Deduções", "(−) Custos de vendas" e "(−) Impostos pagos (guias)", as três com o DFC como fonte principal — ${MOTIVO_DFC}`
    : calc(porEmp(MES_P)).motivo,
  caso: `${textoDoCaso(conferirPrimeiro(porEmp(MES_P)), 'no lado do Omie: ')}; segue o cartão "Lucro líquido" do topo — as três linhas que a conta consome estão conferidas nas linhas delas nesta página`,
});

// (=) sem conta — Omie inteiro, e conferível.
{
  const sc = {};
  for (const emp of EMPRESAS) sc[emp] = {
    R: contar(emp, noMes, 'R', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre }),
    P: contar(emp, noMes, 'P', { categoria: (cod) => !categorias[emp].get(cod)?.codigo_dre }),
  };
  const total = sc[1].R.total + sc[1].P.total + sc[2].R.total + sc[2].P.total;
  const caso = conferirPrimeiro({ 1: [...sc[1].R.todos, ...sc[1].P.todos], 2: [...sc[2].R.todos, ...sc[2].P.todos] });
  const cat = caso ? categorias[caso.emp].get(String(caso.d.cCodCateg)) : null;
  add({
    tela: 'Tela 2', nome: '(=) sem conta', fonte: 'Omie recortado',
    filtro: `${FILTRO_CAIXA}; entram os lançamentos cuja \`detalhes.cCodCateg\` cai numa categoria com \`codigo_dre\` vazio no cadastro da própria empresa (13 categorias na empresa 1 e 1 na 2, medidas em 24/09/2026). A linha fica no fim da tabela e fora dos totalizadores do DRE, e serve de alarme (decisão do dono, 24/09/2026)`,
    contagem: `${total} lançamentos — ${sc[1].R.total + sc[1].P.total} na empresa 1 e ${sc[2].R.total + sc[2].P.total} na 2`,
    estado: total === 0 ? 'a-conferir' : (caso && caso.r.ok ? 'conferido' : 'divergente'),
    motivo: total === 0
      ? 'nenhum lançamento do mês caiu em categoria sem `codigo_dre`, então não há caso real para conferir nesta linha neste mês (a linha existe e fica zerada, que é o comportamento que `docs/fontes.md` descreve)'
      : (caso && caso.r.ok ? null : (caso.r.motivo ?? caso.r.dif.join('; '))),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está em \`geral/categorias\` da empresa ${caso.emp} com \`codigo_dre\` vazio${cat?.totalizadora ? ` e \`totalizadora\` ${cat.totalizadora}` : ''}`
      : 'nenhum lançamento sem conta do DRE entrou neste mês',
  });
}

// ---------------------------------------------------------------- Tela 3

const FILTRO_T3 = `\`financas/pesquisartitulos\` → \`PesquisarLancamentos\` com \`cNatureza: "R"\` e \`dDtVencDe\`/\`dDtVencAte\` em ${PERIODO}, recorte da MeuBESS por \`cabecTitulo.nCodCC\`, fora os \`cStatus = "CANCELADO"\` (que ficam fora da tela, decisão do dono de 25/09/2026)`;

const T3_MES = {};
for (const emp of EMPRESAS) T3_MES[emp] = titulosR[emp].filter((t) => {
  const c = t.cabecTitulo ?? {};
  return RECORTE.has(`${emp}|${c.nCodCC}`) && noMes(c.dDtVenc);
});
const t3Faixa = (f) => ({ 1: T3_MES[1].filter((t) => FAIXA_DO_STATUS(t.cabecTitulo?.cStatus) === f), 2: T3_MES[2].filter((t) => FAIXA_DO_STATUS(t.cabecTitulo?.cStatus) === f) });
const t3Total = (m) => m[1].length + m[2].length;
const T3_PAGO = t3Faixa('pago'), T3_ABERTO = t3Faixa('aberto'), T3_ATRASADO = t3Faixa('atrasado'), T3_OUTRO = t3Faixa('outro');
const T3_NA_TELA = { 1: T3_MES[1].filter((t) => FAIXA_DO_STATUS(t.cabecTitulo?.cStatus) !== 'fora'), 2: T3_MES[2].filter((t) => FAIXA_DO_STATUS(t.cabecTitulo?.cStatus) !== 'fora') };
const SOBRA_DE_STATUS = t3Total(T3_OUTRO)
  ? `; ${t3Total(T3_OUTRO)} título(s) vieram com \`cStatus\` fora das três faixas do de-para — o Omie escreve \`"A VENCER"\` com espaço, e este script o trata como \`AVENCER\`, na faixa em aberto`
  : '';

function linhaT3({ nome, filtro, contagem, lista, motivoExtra = null, estadoForcado = null, casoExtra = null,
  faixas = FAIXAS_TIT_R, ondeCaso = 'da leitura crua do cache', semCaso = 'nenhum título do recorte vence neste mês nessa faixa',
  motivoSemCaso = 'nenhum título do recorte vence neste mês nessa faixa, então não há caso real para conferir' }) {
  const candidatos = EMPRESAS.flatMap((emp) => (lista[emp] ?? []).map((t) => ({ emp, cab: t.cabecTitulo ?? {}, resumo: t.resumo ?? {} })));
  let caso = semCaso, estado = motivoExtra ? 'a-conferir' : 'conferido', motivo = motivoExtra;
  if (candidatos.length) {
    const e = candidatos.slice().sort((a, b) => Number(a.cab.nCodTitulo) - Number(b.cab.nCodTitulo))[0];
    const r = conferirTituloR(e.emp, e.cab, faixas);
    caso = `nCodTitulo ${e.cab.nCodTitulo} (empresa ${e.emp}, \`cNatureza\` ${e.cab.cNatureza}, \`cStatus\` ${e.cab.cStatus}, \`nCodCC\` ${e.cab.nCodCC}, \`cCodCateg\` ${e.cab.cCodCateg}, vence em ${e.cab.dDtVenc}, \`resumo.cLiquidado\` ${e.resumo.cLiquidado ?? '?'}) — ${r.ok ? `achado de volta na página ${r.pagina} ${ondeCaso} com os mesmos campos` : `**não conferiu**: ${r.motivo ?? r.dif.join('; ')}`}${casoExtra ? `, ${casoExtra}` : ''}`;
    if (!r.ok) { estado = 'divergente'; motivo = [motivo, r.motivo ?? r.dif.join('; ')].filter(Boolean).join('; '); }
  } else if (!estadoForcado) {
    estado = 'a-conferir';
    motivo = [motivo, motivoSemCaso].filter(Boolean).join('; ');
  }
  add({ tela: 'Tela 3', nome, fonte: 'Omie', filtro, contagem, estado: estadoForcado ?? estado, motivo: motivo || null, caso });
}

linhaT3({
  nome: 'Valor previsto', filtro: `${FILTRO_T3}; soma \`cabecTitulo.nValorTitulo\``,
  contagem: `${t3Total(T3_NA_TELA)} títulos (${T3_NA_TELA[1].length} na empresa 1 e ${T3_NA_TELA[2].length} na 2); ${pl(t3Total(T3_MES) - t3Total(T3_NA_TELA), "\`CANCELADO\` ficou fora", "\`CANCELADO\` ficaram fora")}${SOBRA_DE_STATUS}`,
  lista: T3_NA_TELA,
});
linhaT3({
  nome: 'Valor recebido', filtro: `${FILTRO_T3}, faixa **pago** (\`cStatus\` \`RECEBIDO\` ou \`LIQUIDADO\`, de-para do dono de 25/09/2026); soma \`resumo.nValPago\`. O \`PAGTO_PARCIAL\` está na faixa em aberto, então a parte já paga dele não entra`,
  contagem: `${t3Total(T3_PAGO)} títulos na faixa pago (${T3_PAGO[1].length} na empresa 1 e ${T3_PAGO[2].length} na 2)`,
  lista: T3_PAGO,
});
// O "Valor pendente" é o ÚNICO indicador que não é do mês fechado, e o motivo está na própria regra da faixa: no
// mês fechado a faixa "em aberto" deu 0 títulos, porque num mês fechado todo título que já venceu está pago ou
// atrasado. A regra de `docs/fontes.md` não muda — os quatro `cStatus` dela são exatamente os de um título que ainda
// não venceu —, muda só a janela de vencimento: de hoje para frente. Duas janelas são lidas, e a linha diz qual das
// duas virou o mês da faixa e por quê.
{
  const abertosDe = (qual) => {
    const r = {};
    for (const emp of EMPRESAS) r[emp] = (titulosAberto[qual][emp] ?? []).filter((t) => {
      const c = t.cabecTitulo ?? {};
      return RECORTE.has(`${emp}|${c.nCodCC}`) && FAIXA_DO_STATUS(c.cStatus) === 'aberto';
    });
    return r;
  };
  const faltam = EMPRESAS.filter((emp) => !titulosAberto.corrente[emp] || !titulosAberto.seguinte[emp]);
  const ABERTO_CORRENTE = abertosDe('corrente'), ABERTO_SEGUINTE = abertosDe('seguinte');
  // As grafias de `cStatus` que o Omie devolveu nos títulos da faixa. Vale registrar: o Omie escreve dois dos quatro
  // status com espaço no meio (`"A VENCER"` e `"VENCE HOJE"`), e o de-para de `docs/fontes.md` cita as duas grafias
  // sem espaço; pelos campos é o mesmo status, e `FAIXA_DO_STATUS` tira o espaço antes de comparar.
  const grafias = (m) => [...new Set(EMPRESAS.flatMap((emp) => m[emp].map((t) => String(t.cabecTitulo?.cStatus ?? ''))))].sort();
  const comEspaco = [...new Set([...grafias(ABERTO_SEGUINTE), ...grafias(ABERTO_CORRENTE)])].filter((g) => /\s/.test(g));
  const POR_QUE = `o mês usado nesta linha é **${MES_DA_FAIXA_ABERTO}**, e não ${NOME_DO_MES} de ${ANO} como nos outros 35 indicadores: em ${NOME_DO_MES} esta faixa deu 0 títulos, e num mês fechado ela é sempre vazia — todo título que já venceu está pago ou atrasado, e os quatro \`cStatus\` da faixa são os de um título que ainda não venceu. Das duas janelas que começam hoje (${HOJE}), ${MES_DA_FAIXA_ABERTO} é o primeiro mês inteiramente à frente: a janela é o mês todo, como nos outros indicadores, e nenhum título dele venceu. Do mês corrente sobram ${DIAS_QUE_RESTAM} dias (${JANELA_CORRENTE[0]} a ${JANELA_CORRENTE[1]}), que são um trecho de ${MES_CORRENTE_NOME} e não um mês; essa janela foi lida também e traz ${t3Total(ABERTO_CORRENTE)} títulos na faixa (${ABERTO_CORRENTE[1].length} na empresa 1 e ${ABERTO_CORRENTE[2].length} na 2)`;
  linhaT3({
    nome: 'Valor pendente',
    filtro: `\`financas/pesquisartitulos\` → \`PesquisarLancamentos\` com \`cNatureza: "R"\` e \`dDtVencDe\`/\`dDtVencAte\` em ${JANELA_SEGUINTE[0]} a ${JANELA_SEGUINTE[1]} (leitura feita no Omie em ${HOJE}, só leitura), recorte da MeuBESS por \`cabecTitulo.nCodCC\`, fora os \`cStatus = "CANCELADO"\` (que ficam fora da tela, decisão do dono de 25/09/2026), faixa **em aberto** (\`cStatus\` \`EMABERTO\`, \`AVENCER\`, \`VENCEHOJE\` ou \`PAGTO_PARCIAL\`, decisão do dono de 25/09/2026, a regra como está escrita em \`docs/fontes.md\`); soma \`resumo.nValAberto\``,
    contagem: `${t3Total(ABERTO_SEGUINTE)} títulos na faixa em aberto (${ABERTO_SEGUINTE[1].length} na empresa 1 e ${ABERTO_SEGUINTE[2].length} na 2) — ${POR_QUE}${comEspaco.length ? `. Os \`cStatus\` que vieram nessa faixa: ${grafias(ABERTO_SEGUINTE).map((g) => `\`"${g}"\``).join(', ')} em ${MES_DA_FAIXA_ABERTO}${ABERTO_CORRENTE[1].length + ABERTO_CORRENTE[2].length ? ` e ${grafias(ABERTO_CORRENTE).map((g) => `\`"${g}"\``).join(', ')} no trecho de ${MES_CORRENTE_NOME}` : ''} — o Omie escreve ${comEspaco.map((g) => `\`"${g}"\``).join(' e ')} com espaço no meio, e o de-para do dono cita ${comEspaco.map((g) => `\`${g.replace(/\s+/g, '')}\``).join(' e ')} sem espaço; pelos campos (nada pago, valor em aberto, \`cLiquidado\` N) é o mesmo status, e este script tira o espaço antes de comparar, como \`docs/fontes.md\` já manda fazer com \`"A VENCER"\`` : ''}`,
    lista: ABERTO_SEGUINTE,
    faixas: [JANELA_SEGUINTE],
    ondeCaso: `da leitura crua de ${JANELA_SEGUINTE[0]} a ${JANELA_SEGUINTE[1]} no cache`,
    semCaso: `nenhum título do recorte vence em ${MES_DA_FAIXA_ABERTO} nessa faixa`,
    motivoSemCaso: `nenhum título do recorte vence em ${MES_DA_FAIXA_ABERTO} nessa faixa, nem no que resta de ${MES_CORRENTE_NOME}, então não há caso real para conferir`,
    motivoExtra: faltam.length
      ? `a leitura por vencimento das janelas que começam hoje (${JANELA_CORRENTE.join(' a ')} e ${JANELA_SEGUINTE.join(' a ')}) não está no cache da(s) empresa(s) ${faltam.join(' e ')}; rode antes \`node scripts/ler-omie-faltante.mjs --hoje ${HOJE}\``
      : null,
  });
}
linhaT3({
  nome: 'Valor vencido', filtro: `${FILTRO_T3}, faixa **atrasado** (\`cStatus = "ATRASADO"\`); soma \`resumo.nValAberto\``,
  contagem: `${t3Total(T3_ATRASADO)} títulos na faixa atrasado (${T3_ATRASADO[1].length} na empresa 1 e ${T3_ATRASADO[2].length} na 2)`,
  lista: T3_ATRASADO,
});
linhaT3({
  nome: 'Lançamentos por mês e status', filtro: `${FILTRO_T3}; agrupa pelo ano-mês de \`cabecTitulo.dDtVenc\` e conta os títulos por faixa (pago = \`RECEBIDO\` e \`LIQUIDADO\`; atrasado = \`ATRASADO\`; em aberto = \`EMABERTO\`, \`AVENCER\`, \`VENCEHOJE\` e \`PAGTO_PARCIAL\`)`,
  contagem: `${t3Total(T3_NA_TELA)} títulos na coluna de ${NOME_DO_MES} — pago ${t3Total(T3_PAGO)}, atrasado ${t3Total(T3_ATRASADO)}, em aberto ${t3Total(T3_ABERTO)}${t3Total(T3_OUTRO) ? `, dos quais ${t3Total(T3_OUTRO)} com o \`cStatus\` escrito \`"A VENCER"\`` : ''}`,
  lista: T3_NA_TELA,
});
{
  // O eixo deste gráfico é o NOME do cliente. O cadastro está no cache desde `scripts/ler-omie-faltante.mjs`, e o
  // script confere que todo `nCodCliente` do mês tem nome lá. O NOME EM SI NÃO ENTRA NESTA PÁGINA: só o código e a
  // contagem de quantos têm nome.
  const codigos = {};
  for (const emp of EMPRESAS) codigos[emp] = new Set(T3_NA_TELA[emp].map((t) => String(t.cabecTitulo?.nCodCliente ?? '')));
  const quantosCodigos = EMPRESAS.reduce((a, emp) => a + codigos[emp].size, 0);
  const semCadastro = EMPRESAS.filter((emp) => !clientes[emp]);
  const semNome = semCadastro.length ? [] : EMPRESAS.flatMap((emp) => [...codigos[emp]].filter((c) => !clientes[emp].comNome.has(c)).map((c) => `${emp}|${c}`));
  linhaT3({
    nome: 'Valor previsto por cliente e status',
    filtro: `${FILTRO_T3}; agrupa por \`cabecTitulo.nCodCliente\` somando \`nValorTitulo\` e separa pela faixa do \`cStatus\`; o nome do cliente sai de \`geral/clientes\` → \`ListarClientesResumido\``,
    contagem: `${t3Total(T3_NA_TELA)} títulos, em ${pl(quantosCodigos, "código de cliente distinto", "códigos de cliente distintos")}${semCadastro.length ? '' : `; os ${quantosCodigos} estão no cadastro de clientes (${n(clientes[1].total)} na empresa 1 e ${n(clientes[2].total)} na 2) e ${semNome.length ? `${semNome.length} deles vêm sem nome` : 'todos vêm com nome preenchido'}`}`,
    lista: T3_NA_TELA,
    motivoExtra: semCadastro.length
      ? `o cadastro \`geral/clientes\` → \`ListarClientesResumido\` não está no cache da(s) empresa(s) ${semCadastro.join(' e ')}, então o eixo deste gráfico — que é o **nome** do cliente — não pôde ser conferido; rode antes \`node scripts/ler-omie-faltante.mjs\``
      : (semNome.length ? `${semNome.length} dos ${quantosCodigos} códigos de cliente do mês não têm nome preenchido em \`geral/clientes\` (empresa|código: ${semNome.join(', ')}), e o eixo do gráfico ficaria sem rótulo neles` : null),
    estadoForcado: semCadastro.length ? 'a-conferir' : (semNome.length ? 'divergente' : null),
    casoExtra: semCadastro.length ? null : `e o \`nCodCliente\` dele está em \`geral/clientes\` da empresa dele com o nome preenchido (o nome não entra nesta página, de propósito)`,
  });
}
{
  // Lista de títulos: a descrição sai do pedido de venda ligado por `nCodOS`, e `produtos/pedido` → `ListarPedidos`
  // está no cache com o `det[]` de cada pedido, então dá para conferir o elo sem chamar a API.
  let comPedido = 0, semPedido = 0, pedidoAusente = 0;
  for (const emp of EMPRESAS) {
    for (const t of T3_NA_TELA[emp]) {
      const os = String(t.cabecTitulo?.nCodOS ?? '');
      if (!os || os === '0') { semPedido++; continue; }
      if (pedidos[emp].has(os)) comPedido++; else pedidoAusente++;
    }
  }
  const escolhido = EMPRESAS.flatMap((emp) => T3_NA_TELA[emp].map((t) => ({ emp, t })))
    .filter(({ emp, t }) => { const os = String(t.cabecTitulo?.nCodOS ?? ''); return os && os !== '0' && pedidos[emp].has(os); })
    .sort((a, b) => Number(a.t.cabecTitulo.nCodTitulo) - Number(b.t.cabecTitulo.nCodTitulo))[0];
  let caso = 'nenhum título do recorte vence neste mês', estado = 'conferido', motivo = null;
  if (escolhido) {
    const cab = escolhido.t.cabecTitulo;
    const ped = pedidos[escolhido.emp].get(String(cab.nCodOS));
    const r = conferirTituloR(escolhido.emp, cab);
    const numeroBate = String(ped.cabecalho?.numero_pedido ?? '') === String(cab.cNumOS ?? '').trim();
    caso = `nCodTitulo ${cab.nCodTitulo} (empresa ${escolhido.emp}, \`cStatus\` ${cab.cStatus}, \`nCodCC\` ${cab.nCodCC}, \`cCodCateg\` ${cab.cCodCateg}, \`cOrigem\` ${cab.cOrigem}, vence em ${cab.dDtVenc}) — ${r.ok ? `achado de volta na página ${r.pagina} da leitura crua do cache com os mesmos campos` : `**não conferiu**: ${r.motivo ?? r.dif.join('; ')}`}, e o \`nCodOS\` ${cab.nCodOS} dele bate com o \`codigo_pedido\` do pedido \`numero_pedido\` ${ped.cabecalho?.numero_pedido} no cache de \`ListarPedidos\`, que tem ${ped.det?.length ?? 0} item(ns) em \`det[]\` (o primeiro com \`codigo_produto\` ${ped.det?.[0]?.produto?.codigo_produto ?? '(sem)'} e \`descricao\` preenchida), e a categoria ${cab.cCodCateg} tem \`descricao\` no cadastro da empresa ${escolhido.emp}`;
    if (!r.ok || !numeroBate) {
      estado = 'divergente';
      motivo = [r.motivo, r.dif?.join('; '), numeroBate ? null : `o \`cNumOS\` do título é ${cab.cNumOS} e o \`numero_pedido\` do pedido é ${ped.cabecalho?.numero_pedido}`].filter(Boolean).join('; ');
    }
  } else if (t3Total(T3_NA_TELA) === 0) {
    estado = 'a-conferir';
    motivo = 'nenhum título do recorte vence neste mês, então não há caso real para conferir';
  } else {
    estado = 'divergente';
    motivo = 'nenhum dos títulos do mês tem pedido de venda achável no cache de `ListarPedidos`, então o elo da descrição não pôde ser exibido num caso real';
  }
  if (pedidoAusente) {
    estado = 'divergente';
    motivo = [motivo, `${pedidoAusente} dos ${t3Total(T3_NA_TELA)} títulos apontam um \`nCodOS\` que não está no cache de \`ListarPedidos\``].filter(Boolean).join('; ');
  }
  add({
    tela: 'Tela 3', nome: 'Lista de títulos', fonte: 'Omie',
    filtro: `${FILTRO_T3}, um título por linha: código \`cabecTitulo.nCodTitulo\` (o \`cNumTitulo\` não serve, veio vazio em 97 de 100 na amostra de 24/09/2026), cliente por \`nCodCliente\` em \`geral/clientes\`, categoria \`cCodCateg\` com a \`descricao\` de \`geral/categorias\`, valor \`nValorTitulo\`, vencimento \`dDtVenc\`, status \`cStatus\`; a descrição vem dos produtos do pedido ligado por \`cabecTitulo.nCodOS\`, ou da \`descricao\` da categoria quando o título nasceu à mão (decisão do dono, 25/09/2026)`,
    contagem: `${t3Total(T3_NA_TELA)} títulos — ${comPedido} com pedido de venda achado no cache e ${semPedido} sem \`nCodOS\` (descrição pela categoria)${pedidoAusente ? `, ${pedidoAusente} com \`nCodOS\` ausente do cache de pedidos` : ''}`,
    estado, motivo, caso,
  });
}
linhaT3({
  nome: 'Lançamentos por status', filtro: `${FILTRO_T3}; conta os títulos por faixa do \`cStatus\` e usa \`nTotRegistros\` como total do centro, sem os \`CANCELADO\``,
  contagem: `${t3Total(T3_NA_TELA)} títulos na rosca — pago ${t3Total(T3_PAGO)}, atrasado ${t3Total(T3_ATRASADO)}, em aberto ${t3Total(T3_ABERTO)}${SOBRA_DE_STATUS}`,
  lista: T3_NA_TELA,
});

// ================================================================ a saída

const ROTULO = { conferido: '', divergente: 'divergente: ', 'a-conferir': 'a conferir: ' };
const linhaMd = (i) =>
  `- ${ROTULO[i.estado]}**${i.tela} — ${i.nome}.** **Entram:** ${i.contagem}. **Fonte:** ${i.fonte}. **Filtro:** ${i.filtro}. **Caso conferido:** ${i.caso}.${i.motivo ? ` **Motivo:** ${i.motivo}.` : ''}`;

// O resumo é contado nas próprias linhas que vão para o .md, pelo começo de cada uma, e não pelo `estado` dos objetos:
// assim ele não tem como divergir do que a página mostra. Linha marcada sem "**Motivo:**" para o script, e a soma tem de
// fechar com o número de indicadores.
const LINHAS_MD = indicadores.map(linhaMd);
const COMECO = { conferido: '- **', divergente: '- divergente: ', 'a-conferir': '- a conferir: ' };
const quantos = (e) => LINHAS_MD.filter((l) => l.startsWith(COMECO[e])).length;
for (const l of LINHAS_MD) {
  if (!l.startsWith(COMECO.conferido) && !l.includes('**Motivo:**')) throw new Error(`linha marcada sem motivo: ${l.slice(0, 80)}`);
}
if (quantos('conferido') + quantos('divergente') + quantos('a-conferir') !== indicadores.length) throw new Error('o resumo contado nas linhas não fecha com o número de indicadores');

const linhaTravaMd = (c) => `| ${c.rotulo} | ${c.meu.join(', ')} | ${c.dito.join(', ')} | ${c.bate ? 'sim' : '**não**'} |`;
const travaPrincipal = EMPRESAS.map((e) => `empresa ${e}: receita ${trinca(totalJanSet[e].R).join(' + ')}, despesa ${trinca(totalJanSet[e].P).join(' + ')}`).join('; ');

const md = `# Conferência dos números das 3 telas — ${NOME_DO_MES} de ${ANO}

Gerado por [\`scripts/numeros-das-telas.mjs\`](../scripts/numeros-das-telas.mjs), só leitura. Uma linha por indicador de
[\`docs/fontes.md\`](fontes.md): a tela e o indicador, quantos lançamentos entram, a fonte e o filtro como estão escritos
lá, e um caso real — um lançamento ou título que o cálculo pegou e que foi achado de novo na fonte, pelo código, com
os mesmos campos.

Linha que começa com **divergente:** quer dizer que o caso não bateu; o motivo está no fim da linha. Linha que começa
com **a conferir:** quer dizer que o indicador não pôde ser conferido; o motivo está no fim da linha.

**Um indicador não é de ${NOME_DO_MES}, e a própria regra dele explica por quê.** A faixa **em aberto** do cartão
"Valor pendente" da Tela 3 é vazia em qualquer mês fechado: os quatro \`cStatus\` que a regra de
[\`docs/fontes.md\`](fontes.md) lista (\`EMABERTO\`, \`AVENCER\`, \`VENCEHOJE\`, \`PAGTO_PARCIAL\`) são os de um título
que **ainda não venceu**, e num mês fechado todo título já venceu — está pago ou atrasado. Em ${NOME_DO_MES} ela deu
${t3Total(T3_ABERTO)} títulos. Então essa linha, e só ela, é conferida com títulos de vencimento a partir de ${HOJE}: a regra não muda, muda
a janela de vencimento. A própria linha diz qual mês foi usado e por quê. Os outros ${indicadores.length - 1}
indicadores são de ${NOME_DO_MES} de ${ANO}.

**Não há valor em dinheiro nesta página, de propósito** — só contagens, códigos, datas e campos de cadastro. Os valores
em reais ficam em [\`docs/confronto-dfc-omie.html\`](confronto-dfc-omie.html), que não é gerado por este script. Nome de
pessoa também não entra: nenhum campo de nome é lido.

**Como o caso é conferido.** O cálculo trabalha sobre estruturas já filtradas e deduplicadas; a conferência faz o
caminho contrário. **No Omie**, reabre as páginas cruas do cache, acha o registro pelo código e compara \`cGrupo\`,
\`cNatureza\`, \`cStatus\`, \`nCodCC\`, \`cCodCateg\`, \`cOrigem\` e a data (nos títulos da Tela 3, \`cNatureza\`,
\`cStatus\`, \`nCodCC\`, \`cCodCateg\` e \`dDtVenc\`). **No DFC**, relê a aba \`FLUXO DE CAIXA\` do zero, sem filtro
nenhum, acha a linha pelo número dela e compara \`CLASS. CONTABIL\`, \`SUB 2\`, \`PAGAMENTO\`, o sentido (entrada ou
saída) e o dia — nos dois gráficos de "Receita × despesa", que leem o bloco pronto da aba do mês, o que se confere é
a forma do bloco, achada pelo rótulo escrito na coluna B e não pelo número da linha. O caso escolhido é sempre o de
menor código, ou de menor número de linha, entre os que entraram, para a conferência ser repetível.

**De onde vieram os números.** O **Omie** sai do cache local \`.cache/omie/\` (fora do git), que
[\`scripts/confronto-dfc-omie.mjs\`](../scripts/confronto-dfc-omie.mjs) e
[\`scripts/ler-omie-faltante.mjs\`](../scripts/ler-omie-faltante.mjs) gravam, só com métodos de consulta: \`financas/mf\` →
\`ListarMovimentos\` **sem \`cTpLancamento\`** por data de pagamento de 01/01 a 30/09/${ANO} (e a leitura irmã dela, com
\`cExibirDepartamentos: "S"\`, para o rateio por centro de custo); \`financas/mf\` → \`ListarMovimentos\` com
\`cTpLancamento: "CP"\` por vencimento, para as despesas pendentes; \`financas/pesquisartitulos\` →
\`PesquisarLancamentos\` com \`cNatureza: "R"\` e com \`cNatureza: "P"\` por vencimento (a de \`"R"\` também nas duas
janelas que começam em ${HOJE} — ${JANELA_CORRENTE[0]} a ${JANELA_CORRENTE[1]} e ${JANELA_SEGUINTE[0]} a
${JANELA_SEGUINTE[1]} —, que é de onde sai a faixa em aberto do "Valor pendente"); e os cadastros
\`geral/categorias\`, \`geral/departamentos\`, \`geral/clientes\` → \`ListarClientesResumido\`, \`geral/dre\` →
\`ListarCadastroDRE\` e \`produtos/pedido\`. As leituras do ano são recortadas em ${NOME_DO_MES} pela data de cada
lançamento, que é o que a consulta do mês devolveria. O **DFC** ${DFC.ok
    ? `saiu das planilhas da pasta da MeuBESS, abertas só para leitura: o arquivo \`${DFC.arquivo}\`, com ${DFC.linhas.length} linhas de lançamento no mês na aba \`FLUXO DE CAIXA\` e o bloco \`Entradas\`/\`Gastos\` na aba \`${DFC.abaDoMes?.aba ?? '(sem)'}\`, e os arquivos dos outros meses do ano, de onde sai a série mensal (${DFC.serie.filter((x) => x.ok).length} dos 12 com o bloco)`
    : `**não foi lido nesta rodada**: ${DFC.motivo}`}.

**${indicadores.length} indicadores**: ${quantos('conferido')} conferidos, ${quantos('divergente')} divergentes e ${quantos('a-conferir')} a conferir.

## As contagens de jan–set de \`docs/fontes.md\`, refeitas por este script

Antes de aplicar o filtro ao mês, o script refaz as contagens que \`docs/fontes.md\` já publica para janeiro a setembro.
É o que prova que a regra implementada aqui é a mesma do documento. A primeira é trava: se não bater, o script para e
não grava nada.

| o que | este script | \`docs/fontes.md\` | bate? |
|---|---|---|---|
| **trava** — total de receita e despesa por empresa, em títulos + baixas de parcial + avulsos | ${travaPrincipal} | o mesmo | sim |
${CONFERENCIAS_DO_FONTES.map(linhaTravaMd).join('\n')}

## Os indicadores

${['Tela 1', 'Tela 2', 'Tela 3'].map((t) => `### ${t}\n\n${indicadores.filter((i) => i.tela === t).map(linhaMd).join('\n')}`).join('\n\n')}
`;

// GUARDA: esta página não pode ter valor em dinheiro. Nenhuma contagem é valor e nenhum campo de valor é impresso; a
// varredura abaixo é a rede de segurança.
const PROIBIDO = [[/R\$/, 'a marca "R$"'], [/\b\d{1,3}(\.\d{3})*,\d{2}\b/, 'um número com centavos'], [/\b\d+,\d{2}\b/, 'um número com centavos']];
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(md);
  if (m) falhar(`GUARDA: o texto gerado tem ${oQue} ("${m[0]}"). Não gravo: valor em dinheiro não entra em arquivo versionado.`);
}
fs.writeFileSync(SAIDA_MD, md, 'utf8');

// A mesma coisa como página, para ler de uma vez.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const CLASSE = { conferido: 'ok', divergente: 'div', 'a-conferir': 'pend' };
const SELO = { conferido: 'conferido', divergente: 'divergente', 'a-conferir': 'a conferir' };
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conferência dos números das 3 telas</title>
<style>
 :root { --fundo:#fbfaf7; --papel:#fff; --tinta:#1d1b16; --fraco:#6b6559; --linha:#e3ded2;
         --ok:#1f6f43; --okf:#e8f4ec; --div:#9a2b1e; --divf:#fbeae7; --pend:#8a6212; --pendf:#fdf3e0; }
 @media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) {
   --fundo:#16150f; --papel:#1e1c16; --tinta:#efece2; --fraco:#a49d8d; --linha:#34312a;
   --ok:#7cc79b; --okf:#17301f; --div:#e89b8d; --divf:#331914; --pend:#ddb35e; --pendf:#332815; } }
 :root[data-tema="escuro"] { --fundo:#16150f; --papel:#1e1c16; --tinta:#efece2; --fraco:#a49d8d; --linha:#34312a;
   --ok:#7cc79b; --okf:#17301f; --div:#e89b8d; --divf:#331914; --pend:#ddb35e; --pendf:#332815; }
 * { box-sizing:border-box } html { -webkit-text-size-adjust:100% }
 body { margin:0; padding:0 16px 64px; background:var(--fundo); color:var(--tinta);
   font:16px/1.6 ui-serif, Georgia, "Times New Roman", serif; overflow-wrap:break-word }
 main { max-width:62rem; margin:0 auto }
 h1 { font-size:1.9rem; line-height:1.2; margin:2.5rem 0 .5rem }
 h2 { font-size:1.3rem; margin:2.5rem 0 .75rem; padding-bottom:.35rem; border-bottom:1px solid var(--linha) }
 p { max-width:64ch } a { color:inherit }
 code { font:0.86em ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--papel);
   border:1px solid var(--linha); border-radius:3px; padding:.05em .3em }
 .resumo { display:flex; flex-wrap:wrap; gap:.75rem; margin:1.5rem 0 }
 .resumo div { flex:1 1 8rem; background:var(--papel); border:1px solid var(--linha); border-radius:8px; padding:.85rem 1rem }
 .resumo b { display:block; font-size:1.8rem; line-height:1.1; font-family:ui-sans-serif,system-ui,sans-serif }
 .resumo span { font-size:.82rem; color:var(--fraco); font-family:ui-sans-serif,system-ui,sans-serif }
 ul.ind { list-style:none; padding:0; margin:0 }
 ul.ind li { background:var(--papel); border:1px solid var(--linha); border-left-width:4px; border-radius:8px;
   padding:.9rem 1.1rem; margin:0 0 .7rem }
 li.ok { border-left-color:var(--ok) } li.div { border-left-color:var(--div); background:var(--divf) }
 li.pend { border-left-color:var(--pend); background:var(--pendf) }
 .selo { display:inline-block; font:600 .7rem/1.5 ui-sans-serif,system-ui,sans-serif; text-transform:uppercase;
   letter-spacing:.06em; padding:.05em .55em; border-radius:99px; vertical-align:.14em; margin-right:.5em }
 li.ok .selo { background:var(--okf); color:var(--ok) } li.div .selo { background:var(--div); color:#fff }
 li.pend .selo { background:var(--pend); color:#fff }
 .nome { font-weight:700 }
 .campo { display:block; margin-top:.5rem; font-size:.94rem }
 .campo b { font-family:ui-sans-serif,system-ui,sans-serif; font-size:.72rem; text-transform:uppercase;
   letter-spacing:.07em; color:var(--fraco); margin-right:.45em }
 .tabela { overflow-x:auto } table { border-collapse:collapse; width:100%; margin:1rem 0; font-size:.92rem }
 th, td { border:1px solid var(--linha); padding:.4rem .6rem; text-align:left; vertical-align:top }
 th { background:var(--papel); font-family:ui-sans-serif,system-ui,sans-serif; font-size:.76rem;
   text-transform:uppercase; letter-spacing:.06em; color:var(--fraco) }
 .rodape { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--linha); font-size:.86rem; color:var(--fraco) }
</style></head><body><main>
<h1>Conferência dos números das 3 telas<br><span style="font-size:.58em;color:var(--fraco)">${NOME_DO_MES} de ${ANO}</span></h1>
<p>Uma linha por indicador de <a href="fontes.md">docs/fontes.md</a>: quantos lançamentos entram, a fonte e o filtro, e
um caso real — um lançamento ou título que o cálculo pegou e que foi achado de novo na fonte, pelo código, com os
mesmos campos. <strong>Não há valor em dinheiro nesta página, de propósito.</strong></p>
<p><strong>Um indicador não é de ${NOME_DO_MES}, e a própria regra dele explica por quê.</strong> A faixa
<strong>em aberto</strong> do cartão "Valor pendente" da Tela 3 é vazia em qualquer mês fechado: os quatro
<code>cStatus</code> que a regra de <a href="fontes.md">docs/fontes.md</a> lista (<code>EMABERTO</code>,
<code>AVENCER</code>, <code>VENCEHOJE</code>, <code>PAGTO_PARCIAL</code>) são os de um título que <strong>ainda não
venceu</strong>, e num mês fechado todo título já venceu — está pago ou atrasado. Em ${NOME_DO_MES} ela deu
${t3Total(T3_ABERTO)} títulos. Então essa linha, e só ela, foi conferida com títulos de vencimento a partir de
${HOJE}: a regra não muda, muda a janela de vencimento, e a própria linha diz qual mês foi usado e por quê. Os outros
${indicadores.length - 1} indicadores são de ${NOME_DO_MES} de ${ANO}.</p>
<div class="resumo">
 <div><b>${indicadores.length}</b><span>indicadores</span></div>
 <div><b style="color:var(--ok)">${quantos('conferido')}</b><span>conferidos</span></div>
 <div><b style="color:var(--div)">${quantos('divergente')}</b><span>divergentes</span></div>
 <div><b style="color:var(--pend)">${quantos('a-conferir')}</b><span>a conferir</span></div>
</div>
<p>O <strong>Omie</strong> sai do cache local <code>.cache/omie/</code>, fora do git; ${NOME_DO_MES} é recortado das
leituras do ano pela data de cada lançamento. O <strong>DFC</strong> ${DFC.ok
    ? `saiu das planilhas da pasta da MeuBESS, abertas só para leitura: o arquivo <code>${esc(DFC.arquivo)}</code>, com ${DFC.linhas.length} linhas de lançamento no mês na aba <code>FLUXO DE CAIXA</code> e o bloco <code>Entradas</code>/<code>Gastos</code> na aba <code>${esc(DFC.abaDoMes?.aba ?? '(sem)')}</code>, e os arquivos dos outros meses do ano, de onde sai a série mensal (${DFC.serie.filter((x) => x.ok).length} dos 12 com o bloco)`
    : `<strong>não foi lido nesta rodada</strong>: ${inline(DFC.motivo)}`}.</p>
<h2>As contagens de jan–set de <code>docs/fontes.md</code>, refeitas</h2>
<p>Antes de aplicar o filtro ao mês, o script refaz as contagens que o documento já publica. É o que prova que a regra
implementada é a mesma. A primeira é trava: se não bater, o script para e não grava nada.</p>
<div class="tabela"><table><thead><tr><th>o que</th><th>este script</th><th>docs/fontes.md</th><th>bate?</th></tr></thead><tbody>
<tr><td><strong>trava</strong> — total de receita e despesa por empresa, em títulos + baixas de parcial + avulsos</td><td>${esc(travaPrincipal)}</td><td>o mesmo</td><td>sim</td></tr>
${CONFERENCIAS_DO_FONTES.map((c) => `<tr><td>${inline(c.rotulo)}</td><td>${c.meu.join(', ')}</td><td>${c.dito.join(', ')}</td><td>${c.bate ? 'sim' : '<strong>não</strong>'}</td></tr>`).join('\n')}
</tbody></table></div>
${['Tela 1', 'Tela 2', 'Tela 3'].map((t) => `<h2>${t}</h2><ul class="ind">
${indicadores.filter((i) => i.tela === t).map((i) => `<li class="${CLASSE[i.estado]}"><span class="selo">${SELO[i.estado]}</span><span class="nome">${inline(i.nome)}</span>
<span class="campo"><b>entram</b>${inline(i.contagem)}</span>
<span class="campo"><b>fonte</b>${inline(i.fonte)}</span>
<span class="campo"><b>filtro</b>${inline(i.filtro)}</span>
<span class="campo"><b>caso conferido</b>${inline(i.caso)}</span>${i.motivo ? `
<span class="campo"><b>motivo</b>${inline(i.motivo)}</span>` : ''}</li>`).join('\n')}
</ul>`).join('\n')}
<p class="rodape">Gerado por <code>scripts/numeros-das-telas.mjs</code>, só leitura: nada foi escrito no Omie nem nas
planilhas. A mesma coisa em texto está em <a href="conferencia.md">docs/conferencia.md</a>.</p>
</main></body></html>
`;
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(html.replace(/<style>[\s\S]*?<\/style>/, ''));
  if (m) falhar(`GUARDA (html): o texto gerado tem ${oQue} ("${m[0]}").`);
}
fs.writeFileSync(SAIDA_HTML, html, 'utf8');

console.log(`${NOME_DO_MES} de ${ANO}: ${indicadores.length} indicadores — ${quantos('conferido')} conferidos, ${quantos('divergente')} divergentes, ${quantos('a-conferir')} a conferir.`);
console.log('contagens de jan–set de docs/fontes.md, refeitas:');
for (const c of CONFERENCIAS_DO_FONTES) console.log(`  ${c.bate ? 'ok  ' : 'NÃO '} ${c.rotulo}: ${c.meu.join(', ')} (fontes.md: ${c.dito.join(', ')})`);
for (const i of indicadores.filter((x) => x.estado !== 'conferido')) console.log(`  ${ROTULO[i.estado]}${i.tela} — ${i.nome}: ${i.motivo}`);
console.log(`gravados ${path.relative(RAIZ, SAIDA_MD)} e ${path.relative(RAIZ, SAIDA_HTML)}`);
