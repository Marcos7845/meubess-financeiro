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
// A TRAVA: AGOSTO DE 2026, FIXADO EM `docs/trava-agosto-2026.json`. O que não pode mudar sem alguém dizer que pode é
// o mês conferido. Esse arquivo fixa, e diz de que leitura fixou: os três baldes de agosto por empresa e natureza, as
// faixas de agosto da Tela 3 e a IDENTIDADE de cada caso real que esta página confere (o código, e mais `cGrupo`,
// `cNatureza`, `cStatus`, `nCodCC`, `cCodCateg`, `cOrigem` e a data). Se qualquer um desses mudar, o script para e não
// grava nada; refixar é explícito, com `--refazer-trava`.
//
// É AQUI QUE A TRAVA TEM DE ESTAR, E NÃO EM JAN–SET. A conferência caso a caso relê a fonte pelo caminho de trás, mas
// relê O MESMO CACHE: se o lançamento mudou no Omie e a releitura o trouxe mudado, os dois lados leem o valor novo e
// batem. Quem pega isso é a trava de agosto, comparando com o que ficou fixado.
//
// AS CONTAGENS DE JAN–SET NÃO SÃO TRAVA — SÃO PUBLICAÇÃO. O script as refaz e as ESCREVE em `docs/fontes.md`, num
// bloco gerado, na mesma rodada em que grava esta página. Antes elas eram comparadas com números escritos à mão no
// documento; como o app relê o Omie de hora em hora e o Omie recebe lançamento com data retroativa, um mês já passado
// muda de contagem sozinho, e aquela comparação parava o script e pedia que alguém recontasse o documento à mão. Pior:
// ela nunca provou nada sobre a regra — os dois lados saíam deste mesmo script. Agora o documento e a página saem da
// MESMA rodada e da MESMA leitura, por construção, e cada contagem publicada diz de que leitura é (ver CARIMBO). A
// comparação com a leitura de referência que a prosa de `docs/fontes.md` cita continua nas duas páginas, como
// informação: mostra o que a releitura mexeu, sem barrar nada.
//
// A ÚNICA EXCEÇÃO AO MÊS FECHADO: a faixa "em aberto" do cartão "Valor pendente" da Tela 3. Num mês fechado ela é
// sempre vazia — todo título que já venceu está pago ou atrasado —, então o caso real dela só existe em título que
// ainda não venceu. Essa faixa, e só ela, é conferida numa janela que começa HOJE: o mês seguinte inteiro, com o que
// resta do mês corrente lido ao lado para dizer por que o mês seguinte foi o escolhido. As duas leituras são gravadas
// no cache por `scripts/ler-omie-faltante.mjs`; todos os outros indicadores seguem no mês fechado.
//
//   node scripts/numeros-das-telas.mjs                 # agosto de 2026, tentando ler o DFC
//   node scripts/numeros-das-telas.mjs --sem-dfc       # só o cache do Omie; as linhas do DFC saem "a conferir:"
//   node scripts/numeros-das-telas.mjs --mes 7         # outro mês fechado de 2026
//   node scripts/numeros-das-telas.mjs --hoje 25/09/2026   # a data de onde parte a janela da faixa "em aberto"
//   node scripts/numeros-das-telas.mjs --refazer-trava     # refixa docs/trava-agosto-2026.json nesta leitura
//   OMIE_CACHE_DIR=<pasta> node scripts/numeros-das-telas.mjs   # roda contra uma CÓPIA do cache (ver testar-trava-agosto.mjs)
//   DFC_DIR=<caminho> node scripts/numeros-das-telas.mjs

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AS REGRAS MORAM EM `lib/regras/`, e não mais aqui. Este script e a camada de dados do app (`lib/dados.mjs`)
// importam as MESMAS funções e as MESMAS listas do dono — é o que garante que a tela mostra o número que esta página
// confere. Enquanto isto aqui era o único leitor, a regra vivia neste arquivo; desde que o app começou, mora lá.
import { abrirCacheOmie } from '../lib/regras/cache-omie.mjs';
import { lerRecorte, criarRegras, valorOmie } from '../lib/regras/movimentos.mjs';
import { NOMES_DOS_MESES, dois, ultimoDia, dataBR, noMesDe, noAnoDe } from '../lib/regras/periodo.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { lerDfc, arquivosDoDfc, norm, ePessoalDfc, eReceitaTela1Dfc, eDeducaoDfc, DFC_RECEITA, DFC_PESSOAL_CLASSE, DFC_PESSOAL_SUB2, DFC_CUSTO_CLASSE, DFC_CUSTO_SUB2, DFC_IMPOSTO_SUB2, DFC_FINANCEIRO_SUB2 } from '../lib/regras/dfc.mjs';
import { lerDespesasFixas } from '../lib/regras/despesas-fixas.mjs';
import { VENDA_DE_PRODUTOS, PESSOAL, CUSTO_DE_VENDAS, RESULTADO_FINANCEIRO, DEDUCOES, IMPOSTOS_GUIAS, INTERCOMPANY, FORA_DO_DRE, AMORTIZACAO_DE_DIVIDA, FAIXA_DO_STATUS, RETIRADA_DE_SOCIO, IMPLANTACAO_DE_SALDOS } from '../lib/regras/listas.mjs';
import { GRUPOS_DA_DIVIDA, eDividaDfc, casar, lerContratos, fonteLocalDosContratos, saldoDosContratos, obrigacoesComClientes } from '../lib/regras/passivo.mjs';
import { provisoesDoMes, COLUNAS_DA_PROVISAO, E_CODIGO_DE_PROJETO } from '../lib/regras/provisao.mjs';
import { lerZip, sharedStrings, abasDo } from '../lib/regras/xlsx.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA_MD = path.join(RAIZ, 'docs', 'conferencia.md');
const SAIDA_HTML = path.join(RAIZ, 'docs', 'conferencia.html');
// A TRAVA DE AGOSTO (fixada, versionada) e o DOCUMENTO onde as contagens de jan–set são publicadas.
const TRAVA_MES = path.join(RAIZ, 'docs', 'trava-agosto-2026.json');
const FONTES = path.join(RAIZ, 'docs', 'fontes.md');
const MARCA_INICIO = '<!-- CONTAGENS-JAN-SET:INICIO -->';
const MARCA_FIM = '<!-- CONTAGENS-JAN-SET:FIM -->';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const SEM_DFC = process.argv.includes('--sem-dfc');
// Refixar a trava de agosto é sempre explícito: quem roda com esta flag está dizendo que o mês mudou de propósito.
const REFAZER_TRAVA = process.argv.includes('--refazer-trava');

const MES2 = String(MES).padStart(2, '0');
const PERIODO = `01/${MES2}/${ANO} a ${new Date(ANO, MES, 0).getDate()}/${MES2}/${ANO}`;

// A DATA DE HOJE, de onde partem as duas janelas da faixa "em aberto" do "Valor pendente" (a exceção ao mês fechado,
// explicada no topo). `--hoje dd/mm/aaaa` a fixa; sem isso, é o dia de hoje. As duas janelas são as mesmas que
// `scripts/ler-omie-faltante.mjs` grava no cache: o que RESTA do mês corrente e o mês SEGUINTE inteiro.
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
// As chaves do cache, as leituras e o carregamento moram em `lib/regras/cache-omie.mjs`, que a camada de dados do
// app abre do mesmo jeito. As duas janelas da faixa "em aberto" do "Valor pendente" nascem aqui porque dependem
// de `--hoje`.

const JANELAS_ABERTO = { corrente: JANELA_CORRENTE, seguinte: JANELA_SEGUINTE };
const OMIE = abrirCacheOmie({ raiz: RAIZ, ano: ANO, janelasAberto: JANELAS_ABERTO, aoFaltar: falhar, hoje: HOJE });
const { EMPRESAS, arqCache, arquivosDoCache, paginas, movimentos, titulosR, titulosP, categorias,
  departamentos, pedidos, cpVenc, comDep, clientes, contasDre, titulosAberto } = OMIE;
// O CARIMBO: de que leitura do Omie são os números desta rodada. Nasce em `lib/regras/cache-omie.mjs` e vai para as
// duas páginas e para o bloco gerado de `docs/fontes.md` — é o que faz cada contagem publicada dizer de onde veio.
const CARIMBO = OMIE.carimbo;
const horaBR = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${dois(d.getHours())}h${dois(d.getMinutes())}`;
};
const CARIMBO_TEXTO = CARIMBO.id
  ? `leitura \`${CARIMBO.id}\` — ${CARIMBO.arquivos} arquivos no cache local, o mais novo gravado em ${horaBR(CARIMBO.gravadoEm)}${CARIMBO.okEm
    ? `; a última releitura do app que trouxe dado do Omie foi em ${horaBR(CARIMBO.okEm)} (${CARIMBO.estado}, ${CARIMBO.paginas} páginas)`
    : '; a releitura do app ainda não deixou marca neste cache'}`
  : 'cache vazio';

const LEITURA_MF = OMIE.leituras.MF;
const LEITURA_TIT_R = OMIE.leituras.TIT_R;
const LEITURA_TIT_P = OMIE.leituras.TIT_P;
const LEITURA_CP_VENC = OMIE.leituras.CP_VENC;
const LEITURA_MF_DEP = OMIE.leituras.MF_DEP;
const FAIXAS_TIT_R = OMIE.leituras.FAIXAS_TIT_R;

// ================================================================ o recorte e os filtros de docs/fontes.md
//
// O recorte da MeuBESS, o par do adiantamento ao fornecedor, os três baldes e o `contar` moram em
// `lib/regras/movimentos.mjs`; as listas que o dono decidiu, em `lib/regras/listas.mjs`. A camada de dados do app
// chama exatamente estes — nenhuma regra é copiada de um lado para o outro.

const RECORTE = lerRecorte(RAIZ);
const { eTransferencia, base, baldes, contar } = criarRegras({ movimentos, categorias, recorte: RECORTE });

const noMes = noMesDe(ANO, MES);
const em2026 = noAnoDe(ANO);

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

// OS CASOS REAIS DO MÊS, guardados para a trava (ver o topo). Um caso é a IDENTIDADE do lançamento que a página
// confere naquela linha: o código e os campos de cadastro que o filtro usou, e nada mais — nenhum valor, nenhum nome.
// É o que a trava compara com `docs/trava-agosto-2026.json`. Se o lançamento mudou de status, de conta corrente, de
// categoria, de origem ou de data, ou se outro lançamento passou a ser o de menor código, o texto muda e a trava para
// o script. Entram só os do mês pedido: o caso da faixa "em aberto" do "Valor pendente" é de outro mês, de propósito.
const CASOS_DO_MES = new Set();

const casoDoLancamento = (emp, d) => {
  const eTitulo = d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER';
  const texto = `${eTitulo ? `nCodTitulo ${d.nCodTitulo}` : `nCodMovCC ${d.nCodMovCC}`} (empresa ${emp}, \`${d.cGrupo}\`, \`cNatureza\` ${d.cNatureza}, \`cStatus\` ${d.cStatus}, \`nCodCC\` ${d.nCodCC}, \`cCodCateg\` ${d.cCodCateg ?? '(sem)'}, \`cOrigem\` ${d.cOrigem ?? '(sem)'}, pago em ${d.dDtPagamento})`;
  if (noMes(d.dDtPagamento)) CASOS_DO_MES.add(texto);
  return texto;
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
// De janeiro a setembro o script refaz as contagens e as PUBLICA: elas vão para o bloco gerado de `docs/fontes.md` na
// mesma rodada em que esta página é gravada, com o carimbo da leitura. Não travam mais nada — ver o topo.

const janSet = (s) => { const d = dataBR(s); return Boolean(d) && d.a === ANO && d.m >= 1 && d.m <= 9; };
const trinca = (b) => [b.titulos.size, b.baixas.size, b.avulsos.size];
const igual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// A LEITURA DE REFERÊNCIA é HISTÓRIA, não trava. A prosa de `docs/fontes.md` cita, em cada indicador, as contagens de
// jan–set da leitura abaixo; os números daqui são exatamente os dela. Ficam para o bloco gerado poder mostrar, lado a
// lado, o que esta leitura dá e o que aquela dava — e assim dizer de que leitura é cada contagem publicada. Um número
// diferente não é erro: é o Omie tendo recebido lançamento com data retroativa entre as duas leituras.
const LEITURA_DE_REFERENCIA = '27/09/2026, 09h11–09h17';
const CONTAGEM_DA_REFERENCIA = { 1: { R: [9, 0, 162], P: [809, 9, 276] }, 2: { R: [536, 25, 611], P: [556, 3, 547] } };
const totalJanSet = {};
const CONFERENCIAS_DO_FONTES = [];
const registrar = (id, rotulo, meu, ref) => CONFERENCIAS_DO_FONTES.push({ id, rotulo, meu, ref, bate: igual(meu, ref) });

for (const emp of EMPRESAS) {
  totalJanSet[emp] = { R: contar(emp, janSet, 'R'), P: contar(emp, janSet, 'P') };
  for (const nat of ['R', 'P']) {
    registrar(`total-${emp}-${nat}`,
      `total da leitura de **${nat === 'R' ? 'receita' : 'despesa'}** da empresa ${emp}, jan–set (títulos, baixas de parcial, avulsos)`,
      trinca(totalJanSet[emp][nat]), CONTAGEM_DA_REFERENCIA[emp][nat]);
  }
}
const conferencia = (id) => CONFERENCIAS_DO_FONTES.find((c) => c.id === id);
const naLista = (lista) => (cod) => lista.includes(cod);

const jsCustos = {};
for (const emp of EMPRESAS) jsCustos[emp] = contar(emp, janSet, 'P', { categoria: naLista(CUSTO_DE_VENDAS[emp]) });
registrar('custos', 'custos de vendas, jan–set (títulos + baixas + avulsos da empresa 1, depois da 2)',
  [...trinca(jsCustos[1]), ...trinca(jsCustos[2])], [66, 1, 20, 447, 3, 137]);

const jsFin = {};
for (const emp of EMPRESAS) jsFin[emp] = {
  R: contar(emp, janSet, 'R', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
  P: contar(emp, janSet, 'P', { categoria: naLista(RESULTADO_FINANCEIRO[emp]) }),
};
// A despesa da empresa 2 era 33 até 29/09/2026: os 2 lançamentos do `2.04.91` Emprestimo em jan–set saíram do
// resultado financeiro para a amortização de dívida (decisão do dono), e a referência passou a 31.
registrar('financeiro', 'resultado financeiro, jan–set (receita emp. 1, receita emp. 2, despesa emp. 1, despesa emp. 2), sem o `2.04.91` da empresa 2 desde 29/09/2026',
  [jsFin[1].R.total, jsFin[2].R.total, jsFin[1].P.total, jsFin[2].P.total], [55, 11, 98, 31]);

const jsPessoal = {};
for (const emp of EMPRESAS) jsPessoal[emp] = contar(emp, janSet, 'P', { categoria: naLista(PESSOAL[emp]), comTransferencia: false });
registrar('pessoal', 'pessoal pago, jan–set (empresa 1, empresa 2)',
  [jsPessoal[1].todos.filter((d) => d.cStatus === 'PAGO').length, jsPessoal[2].todos.filter((d) => d.cStatus === 'PAGO').length], [253, 322]);

const jsGuias = {};
for (const emp of EMPRESAS) jsGuias[emp] = contar(emp, janSet, 'P', { categoria: naLista(IMPOSTOS_GUIAS[emp]), comTransferencia: false });
registrar('guias', 'impostos pagos (guias), jan–set (títulos, baixas de parcial, avulsos, somando as duas empresas)',
  [jsGuias[1].titulos.size + jsGuias[2].titulos.size, jsGuias[1].baixas.size + jsGuias[2].baixas.size, jsGuias[1].avulsos.size + jsGuias[2].avulsos.size], [14, 0, 10]);

// A divisão da linha "(+) Receitas": docs/fontes.md diz 3 códigos de venda e 24 / 26 de outras receitas — eram 26 / 28
// até 29/09/2026, quando o Recebimento de Empréstimo Intercompany (`1.04.99`, como a regra de intercompany já mandava) e
// o Recebimento de Empréstimos Bancários (`1.04.03`, a captação), nas duas empresas, saíram da receita (FORA_DO_DRE).
const outrasReceitasDe = (emp) => [...categorias[emp].values()]
  .filter((c) => c.conta_receita === 'S' && c.totalizadora === 'N' && !eTransferencia(emp, c.codigo) && !VENDA_DE_PRODUTOS.includes(String(c.codigo))
    && !FORA_DO_DRE[emp].includes(String(c.codigo)))
  .map((c) => String(c.codigo));
const OUTRAS_RECEITAS = { 1: outrasReceitasDe('1'), 2: outrasReceitasDe('2') };
registrar('grupos-receita', 'códigos de outra receita no cadastro (empresa 1, empresa 2), sem o `1.04.99` e o `1.04.03` desde 29/09/2026',
  [OUTRAS_RECEITAS[1].length, OUTRAS_RECEITAS[2].length], [24, 26]);

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
// Ler a planilha (zip, abas, células), achar a pasta e filtrar o `FLUXO DE CAIXA` moram em `lib/regras/xlsx.mjs`,
// `lib/regras/dfc-fonte.mjs` e `lib/regras/dfc.mjs`. DE ONDE vêm os arquivos é a interface de `dfc-fonte.mjs`:
// hoje a pasta que o OneDrive espelha neste computador, depois o Microsoft Graph, sem mexer em mais nada.
// `--sem-dfc` pula a leitura inteira, sem tocar na pasta — e então toda linha cuja fonte principal é o DFC sai
// "a conferir:", dizendo isso.

const DFC = SEM_DFC
  ? { ok: false, motivo: 'esta rodada foi feita com `--sem-dfc`: a pasta DFC/2026 é uma biblioteca do SharePoint espelhada pelo OneDrive neste computador, e abrir um arquivo de lá o baixa' }
  : await lerDfc({ fonte: fonteDoDfc(), ano: ANO, mes: MES });
const MOTIVO_DFC = DFC.ok ? null : DFC.motivo;


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
  filtro: `DFC: \`ENTRADA\` (K) de \`FLUXO DE CAIXA\`, somada pelo mês de \`DIA PG\` (F), **fora as linhas de \`SUB 2\` (J) = \`TRANSFERENCIAS BANCARIAS - RECEITA\`** — transferência entre contas não é receita (decisão do dono, 27/09/2026), e é por elas que este cartão contava mais linhas que o "Receita total" da Tela 2. Omie: ${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "R"\``,
  contagem: `${soma(MES_R)} lançamentos no Omie recortado — ${trincaTexto(MES_R)}`,
  porEmpresa: porEmp(MES_R),
  dfc: eReceitaTela1Dfc, dfcRotulo: 'linhas de entrada no mês, fora as de transferência entre contas',
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
  // A contagem de jan–set de `cg` não entra aqui: ela é publicação, não trava (ver o topo). O que decide esta linha é
  // o caso real do mês.
  const ok = Boolean(caso) && caso.r.ok;
  const casoTexto = caso
    ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está em \`geral/categorias\` da empresa ${caso.emp} com \`conta_receita\` ${cat?.conta_receita ?? '?'} e \`totalizadora\` ${cat?.totalizadora ?? '?'}, e cai em ${VENDA_DE_PRODUTOS.includes(String(caso.d.cCodCateg)) ? '"vendas de produtos"' : '"outras receitas"'}`
    : 'nenhum lançamento de receita entrou neste mês';
  add({
    tela: 'Tela 2', nome: '(+) Receitas: outras receitas, vendas de produtos', fonte: 'Omie recortado (principal) / DFC (confronto)',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "R"\`; a linha se divide pela CATEGORIA do lançamento (decisão do dono, 25/09/2026): venda de produtos são \`1.01.01\`, \`1.01.03\` e \`1.04.01\` nas duas empresas, e outras receitas é todo o resto com \`conta_receita = "S"\` e \`totalizadora = "N"\` em \`geral/categorias\` fora as de transferência e fora as que ficam fora do DRE — o Recebimento de Empréstimo Intercompany \`1.04.99\` saiu daqui em 29/09/2026, como a regra de intercompany já mandava, e o Recebimento de Empréstimos Bancários \`1.04.03\` saiu no mesmo dia, porque é captação de empréstimo e fica fora do DRE (decisão do dono) (${OUTRAS_RECEITAS[1].length} códigos na empresa 1 e ${OUTRAS_RECEITAS[2].length} na 2); o sinal do cliente (título \`ADVR\`) continua receita no mês em que foi pago; as quatro totalizadoras \`1.01\` a \`1.04\` ficam fora dos dois grupos`,
    contagem: `${total} lançamentos — ${venda[1].total + venda[2].total} em vendas de produtos (${venda[1].total} na empresa 1 e ${venda[2].total} na 2) e ${outras[1].total + outras[2].total} em outras receitas (${outras[1].total} e ${outras[2].total})`,
    estado: ok ? 'conferido' : 'divergente',
    motivo: ok ? null : [
      caso ? null : 'nenhum lançamento de receita entrou neste mês',
      caso && !caso.r.ok ? (caso.r.motivo ?? caso.r.dif.join('; ')) : null,
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
      : `a grafia errada \`FORNECEODORES COGS\`, que a regra aceita desde 25/09/2026, aparece em ${ERRADAS_COGS.total} ${ERRADAS_COGS.total === 1 ? 'linha' : 'linhas'} do mês e o filtro leva ${ERRADAS_COGS.pegas}${ERRADAS_COGS.pegas === ERRADAS_COGS.total ? '' : `: as ${ERRADAS_COGS.total - ERRADAS_COGS.pegas} que ficam de fora têm \`SUB 2\` ${ERRADAS_COGS.sub2.map((x) => `\`${x}\``).join(', ')}, que não está entre os três \`SUB 2\` de custo que a regra de \`docs/fontes.md\` lista — **o dono decidiu a grafia e, na mesma data (25/09/2026), que marketing não é custo de vendas: a regra fica como está**, e elas seguem fora desta linha`}`,
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
      && !CUSTO_DE_VENDAS[emp].includes(cod) && !RESULTADO_FINANCEIRO[emp].includes(cod) && !FORA_DO_DRE[emp].includes(cod)
      && !RETIRADA_DE_SOCIO[emp].includes(cod),
  });
  const caso = conferirPrimeiro({ 1: dg[1].todos, 2: dg[2].todos });
  const cat = caso ? categorias[caso.emp].get(String(caso.d.cCodCateg)) : null;
  add({
    tela: 'Tela 2', nome: '(−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI', fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\` e as categorias com \`conta_despesa = "S"\` em \`geral/categorias\`, agrupadas pelo \`codigo_dre\` — cada lançamento entra pela categoria dele, não por departamento. Saem desta linha, para as linhas próprias, as ${CUSTO_DE_VENDAS[1].length + CUSTO_DE_VENDAS[2].length} categorias de custo de vendas e as ${RESULTADO_FINANCEIRO[1].length + RESULTADO_FINANCEIRO[2].length} de resultado financeiro; ficam fora do DRE os empréstimos e transferências Intercompany (${INTERCOMPANY[1].length} códigos na empresa 1 e ${INTERCOMPANY[2].length} na 2) e a amortização de dívida — \`2.04.89\` Giro de Capital e \`2.11.95\` Financiamento Veiculo, da empresa 1, que saíram desta linha em 29/09/2026, e \`2.04.91\` Emprestimo, da empresa 2, que saiu do resultado financeiro no mesmo dia (${AMORTIZACAO_DE_DIVIDA[1].length + AMORTIZACAO_DE_DIVIDA[2].length} códigos; decisão do dono: parcela de empréstimo não é despesa; vão para o bloco "Compromissos", fora do lucro); a implantação de saldos (\`2.10.99\` Implantação de saldos (saidas), só na empresa 1) também fica fora do DRE, e a retirada de sócio (\`2.08.01\`, nas duas empresas) sai desta linha para a linha própria "Retirada de sócio", abaixo do lucro líquido (decisão do dono, 01/10/2026; na empresa 2 o \`2.10.99\` é Adiantamentos a Fornecedores e fica aqui); Cartão de Credito (\`2.11.98\`) e Aluguel Veiculo (\`2.11.99\`) da empresa 1 ficam aqui, embora o Omie os pendure em Despesas Financeiras (decisão do dono, 25/09/2026)`,
    contagem: `${dg[1].total + dg[2].total} lançamentos — ${dg[1].titulos.size} títulos + ${dg[1].baixas.size} baixas de parcial + ${dg[1].avulsos.size} avulsos na empresa 1 e ${dg[2].titulos.size} + ${dg[2].baixas.size} + ${dg[2].avulsos.size} na 2`,
    estado: caso && caso.r.ok ? 'conferido' : 'divergente',
    motivo: caso && caso.r.ok ? null : (caso ? (caso.r.motivo ?? caso.r.dif.join('; ')) : 'nenhum lançamento de despesa geral entrou neste mês'),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está em \`geral/categorias\` da empresa ${caso.emp} com \`conta_despesa\` ${cat?.conta_despesa ?? '?'} e \`codigo_dre\` ${cat?.codigo_dre || '(vazio)'}, e não está em nenhuma das listas que saem desta linha`
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
  // Como nas outras linhas: a contagem de jan–set de `c` é publicação, não trava. Quem decide é o caso real do mês.
  const ok = Boolean(caso) && caso.r.ok;
  add({
    tela: 'Tela 2', nome: '(+/−) Resultado financeiro: receitas e despesas financeiras', fonte: 'Omie recortado (principal) / DFC por `SUB 2` (confronto)',
    filtro: `${FILTRO_CAIXA}, separando por \`detalhes.cNatureza\` o que é \`R\` (rendimentos) do que é \`P\` (juros, tarifas, IOF), pelas ${RESULTADO_FINANCEIRO[1].length + RESULTADO_FINANCEIRO[2].length} categorias que o dono decidiu em 25/09/2026 (${RESULTADO_FINANCEIRO[1].length} na empresa 1 e ${RESULTADO_FINANCEIRO[2].length} na 2), **pelo código da categoria e não pela conta do DRE**; cartão de crédito, aluguel de veículo e os empréstimos e transferências Intercompany não entram aqui, e o \`2.04.91\` Emprestimo da empresa 2 saiu daqui em 29/09/2026 para a amortização de dívida, fora do lucro (decisão do dono; eram 16 categorias, 8 na empresa 2). Confronto no DFC por \`SUB 2\` (J) em \`JUROS\`, \`RENDIMENTO FINANCEIRO\`, \`EMPRESTIMO\`, \`TARIFAS BANCÁRIAS\``,
    contagem: `${fin[1].R.total + fin[2].R.total + fin[1].P.total + fin[2].P.total} lançamentos — na receita financeira, ${fin[1].R.total} na empresa 1 e ${fin[2].R.total} na 2; na despesa financeira, ${fin[1].P.total} e ${fin[2].P.total}`,
    estado: ok ? 'conferido' : 'divergente',
    motivo: ok ? null : [
      caso ? null : 'nenhum lançamento de resultado financeiro entrou neste mês',
      caso && !caso.r.ok ? (caso.r.motivo ?? caso.r.dif.join('; ')) : null,
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
  });
}

add({
  tela: 'Tela 2', nome: '(=) Lucro líquido', fonte: 'Omie recortado, calculado',
  filtro: 'EBITDA (linha acima) + resultado financeiro − impostos pagos (guias). Não tem leitura própria; sai sem depreciação e sem amortização, e a linha "(−) Impostos retidos na nota" não existe mais (decisão do dono, 25/09/2026, opção A). Desde 29/09/2026 a amortização de dívida (`2.04.89` e `2.11.95`) também fica fora: é lucro de caixa sem o pagamento de principal de empréstimo, e os juros e o IOF da dívida seguem dentro, no resultado financeiro',
  contagem: `${soma(MES_R) + soma(MES_P)} lançamentos do mês, que passam pelas linhas que a compõem`,
  estado: MOTIVO_DFC ? 'a-conferir' : (calc(porEmp(MES_P)).ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC
    ? `segue o cartão "Lucro líquido" do topo: a conta consome "(−) Deduções", "(−) Custos de vendas" e "(−) Impostos pagos (guias)", as três com o DFC como fonte principal — ${MOTIVO_DFC}`
    : calc(porEmp(MES_P)).motivo,
  caso: `${textoDoCaso(conferirPrimeiro(porEmp(MES_P)), 'no lado do Omie: ')}; segue o cartão "Lucro líquido" do topo — as três linhas que a conta consome estão conferidas nas linhas delas nesta página`,
});

// Retirada de sócio — linha própria, abaixo do lucro líquido (decisão do dono, 01/10/2026). Omie inteiro, e conferível.
{
  const ret = {};
  for (const emp of EMPRESAS) ret[emp] = contar(emp, noMes, 'P', { categoria: naLista(RETIRADA_DE_SOCIO[emp]) });
  const caso = conferirPrimeiro({ 1: ret[1].todos, 2: ret[2].todos });
  const total = ret[1].total + ret[2].total;
  add({
    tela: 'Tela 2', nome: 'Retirada de sócio', fonte: 'Omie recortado',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\` e \`detalhes.cCodCateg\` = \`2.08.01\` Adiantamento/Retirada de Sócio, nas duas empresas. Saiu de "(−) Despesas gerais" e é linha própria do DRE, **abaixo** do "(=) Lucro líquido" e fora dos totalizadores: nem o EBITDA nem o lucro líquido a descontam, porque é distribuição ao sócio e não despesa da operação (decisão do dono, 01/10/2026)`,
    contagem: `${total} lançamentos — ${ret[1].titulos.size} títulos + ${ret[1].baixas.size} baixas de parcial + ${ret[1].avulsos.size} avulsos na empresa 1 e ${ret[2].titulos.size} + ${ret[2].baixas.size} + ${ret[2].avulsos.size} na 2`,
    estado: total === 0 ? 'a-conferir' : (caso && caso.r.ok ? 'conferido' : 'divergente'),
    motivo: total === 0
      ? 'nenhum lançamento de retirada de sócio entrou neste mês, então não há caso real para conferir (a linha existe e fica zerada)'
      : (caso && caso.r.ok ? null : (caso.r.motivo ?? caso.r.dif.join('; '))),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está na lista de retirada de sócio da empresa ${caso.emp}`
      : 'nenhum lançamento de retirada de sócio entrou neste mês',
  });
}

// Fora do DRE: implantação de saldos (decisão do dono, 01/10/2026). Não entra em linha nenhuma; a tela a mostra à
// parte, com o valor. Omie inteiro, e conferível.
{
  const impl = {};
  for (const emp of EMPRESAS) impl[emp] = contar(emp, noMes, 'P', { categoria: naLista(IMPLANTACAO_DE_SALDOS[emp]) });
  const caso = conferirPrimeiro({ 1: impl[1].todos, 2: impl[2].todos });
  const total = impl[1].total + impl[2].total;
  add({
    tela: 'Tela 2', nome: 'Fora do DRE: implantação de saldos', fonte: 'Omie recortado',
    filtro: `${FILTRO_CAIXA}, guardando \`detalhes.cNatureza = "P"\` e \`detalhes.cCodCateg\` = \`2.10.99\` Implantação de saldos (saidas), **só na empresa 1** — na empresa 2 o mesmo código é Adiantamentos a Fornecedores, tem conta do DRE e fica em "(−) Despesas gerais". É ajuste de saldo inicial e fica fora do DRE (\`FORA_DO_DRE\`); a tela o mostra à parte, abaixo da tabela, com o valor (decisão do dono, 01/10/2026)`,
    contagem: `${total} lançamentos — ${impl[1].titulos.size} títulos + ${impl[1].baixas.size} baixas de parcial + ${impl[1].avulsos.size} avulsos, todos na empresa 1`,
    estado: total === 0 ? 'a-conferir' : (caso && caso.r.ok ? 'conferido' : 'divergente'),
    motivo: total === 0
      ? 'nenhum lançamento de implantação de saldos entrou neste mês, então não há caso real para conferir'
      : (caso && caso.r.ok ? null : (caso.r.motivo ?? caso.r.dif.join('; '))),
    caso: caso
      ? `${textoDoCaso(caso)}; a categoria ${caso.d.cCodCateg} está na lista de implantação de saldos da empresa ${caso.emp}, que fica fora do DRE`
      : 'nenhum lançamento de implantação de saldos entrou neste mês',
  });
}

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

// ---------------------------------------------------------------- Tela 2, o bloco "Compromissos" (29/09/2026)
//
// O PASSIVO, abaixo do DRE. As regras moram em `lib/regras/passivo.mjs` e as listas em `lib/regras/listas.mjs`, como
// todas; aqui o script refaz a contagem de cada número e confere um caso real de cada um na fonte crua — o pagamento da
// parcela no Omie E na planilha, o sinal do cliente no título E no pedido, o bloco de banco na aba do mês.

// Um pedido de venda relido nas páginas cruas de `produtos/pedido` → `ListarPedidos`, pelo `codigo_pedido`.
function acharPedidoCru(emp, codigo) {
  for (const f of arquivosDoCache.filter((x) => x.startsWith(`${emp}-produtos-pedido`))) {
    const j = JSON.parse(fs.readFileSync(path.join(OMIE.CACHE, f), 'utf8'));
    for (const p of j.pedido_venda_produto ?? []) if (String(p.cabecalho?.codigo_pedido) === String(codigo)) return p;
  }
  return null;
}

// Um título a receber relido nas páginas cruas, com os campos do sinal que a regra usa.
function conferirSinal(s) {
  const cab = s.cru;
  const r = conferirTituloR(s.empresa, cab);
  const cru = acharTituloCru(s.empresa, cab.nCodTitulo);
  const dif = [...(r.dif ?? []), ...(r.motivo ? [r.motivo] : [])];
  if (cru) dif.push(...comparar(cru.cabecTitulo, { cOrigem: 'ADVR', dDtPagamento: cab.dDtPagamento, nCodOS: cab.nCodOS, cNumDocFiscal: cab.cNumDocFiscal ?? '' }));
  const ped = acharPedidoCru(s.empresa, cab.nCodOS);
  if (!ped) dif.push(`o \`nCodOS\` ${cab.nCodOS} não foi achado nas páginas cruas de \`ListarPedidos\``);
  else dif.push(...comparar(ped.infoCadastro ?? {}, { faturado: pedidos[s.empresa].get(String(cab.nCodOS))?.infoCadastro?.faturado ?? '' }));
  return { ok: dif.length === 0, dif, pagina: r.pagina, ped };
}

const FLUXO_DO_MES = (() => {
  const grupos = {};
  for (const g of GRUPOS_DA_DIVIDA) {
    const omie = [];
    for (const emp of EMPRESAS) {
      for (const d of contar(emp, noMes, g.natureza, { categoria: naLista(g.omie[emp] ?? []) }).todos) {
        const eTitulo = d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER';
        omie.push({ emp, d, natureza: d.cNatureza, codigo: String(eTitulo ? d.nCodTitulo : d.nCodMovCC), dia: dataBR(d.dDtPagamento)?.d ?? null, valor: Math.abs(valorOmie(d)) });
      }
    }
    const dfc = g.dfc && DFC.ok ? DFC.linhas.filter((l) => eDividaDfc(l) && l.natureza === g.natureza) : [];
    grupos[g.id] = { omie, dfc, ...casar(omie, dfc) };
  }
  return grupos;
})();
const CONTRATOS = SEM_DFC
  ? { ok: false, motivo: 'falta a planilha de contratos', porque: 'esta rodada foi feita com `--sem-dfc`' }
  : await lerContratos({ fonte: fonteDoDfc(), arquivos: await arquivosDoDfc(fonteDoDfc()), raiz: RAIZ });
const N_CONTRATOS = CONTRATOS.ok ? CONTRATOS.contratos.length : 0;
const TEXTO_CONTRATOS = CONTRATOS.ok
  ? `a planilha \`${CONTRATOS.arquivo}\` da ${CONTRATOS.origem}, com ${pl(N_CONTRATOS, 'contrato', 'contratos')}${CONTRATOS.recusados.length ? ` e ${pl(CONTRATOS.recusados.length, 'linha recusada', 'linhas recusadas')} por falta de coluna obrigatória` : ''}`
  : `${CONTRATOS.porque} — é o que a tela diz no lugar do saldo ("saldo: ${CONTRATOS.motivo}")`;
const nDoFluxo = (lado) => Object.values(FLUXO_DO_MES).reduce((s, g) => s + g[lado].length, 0);
const LANC_DO_FLUXO = Object.values(FLUXO_DO_MES).reduce((s, g) => s + g.pares.length + g.soOmie.length + g.soDfc.length, 0);
const nGrupo = (id) => { const g = FLUXO_DO_MES[id]; return g.pares.length + g.soOmie.length + g.soDfc.length; };

// O CASO DO FLUXO: o pagamento que está nas DUAS fontes, o de menor código no Omie — é ele que prova o "sem contar duas
// vezes". Sem nenhum par no mês, o de menor código do Omie; sem Omie, a linha do DFC de menor número.
const CASO_DA_DIVIDA = (() => {
  const pares = Object.values(FLUXO_DO_MES).flatMap((g) => g.pares).sort((a, b) => Number(a.omie.codigo) - Number(b.omie.codigo));
  const soOmie = Object.values(FLUXO_DO_MES).flatMap((g) => g.soOmie).sort((a, b) => Number(a.codigo) - Number(b.codigo));
  const soDfc = Object.values(FLUXO_DO_MES).flatMap((g) => g.soDfc).sort((a, b) => a.linha - b.linha);
  const doDfc = (l, o) => {
    const cru = DFC.cruas.get(l.linha);
    const dif = [];
    if (!cru) dif.push(`a linha ${l.linha} não foi achada de volta na segunda leitura da aba`);
    else {
      for (const [campo, usou, veio] of [['SUB 2', l.sub2, cru.sub2], ['sentido', l.natureza, cru.natureza], ['dia', l.dia, cru.dia]])
        if (String(veio ?? '') !== String(usou ?? '')) dif.push(`\`${campo}\` veio "${veio}" e o cálculo usou "${usou}"`);
      if (cru.mes !== `${MES}/${ANO}`) dif.push(`a data da linha caiu em ${cru.mes}`);
    }
    if (o && (o.dia !== l.dia || o.valor !== Math.abs(l.valor))) dif.push('o dia ou o valor da linha do DFC não é o do lançamento do Omie com que ela casou');
    return { ok: dif.length === 0, dif, texto: `linha ${l.linha} da aba \`FLUXO DE CAIXA\` do arquivo \`${DFC.arquivo}\` (\`CLASS. CONTABIL\` ${l.classe}, \`SUB 2\` ${l.sub2}, ${l.natureza === 'R' ? 'entrada' : 'saída'}, dia ${l.dia})` };
  };
  if (pares.length) {
    const p = pares[0];
    const r = conferirLancamento(p.omie.emp, p.omie.d);
    const t = casoDoLancamento(p.omie.emp, p.omie.d);
    const x = doDfc(p.dfc, p.omie);
    const ok = r.ok && x.ok;
    return {
      ok, emp: p.omie.emp, d: p.omie.d,
      motivo: ok ? null : [...(r.dif ?? []), ...(r.motivo ? [r.motivo] : []), ...x.dif].join('; '),
      texto: `o pagamento ${t} — achado de volta na página ${r.pagina ?? '?'} da leitura crua do cache com os mesmos campos — é o MESMO pagamento da ${x.texto}, relida pelo número da linha numa segunda leitura da aba: mesmo sentido, mesmo dia e mesmo valor em centavos, e por isso entra UMA vez no fluxo do mês, no grupo "${GRUPOS_DA_DIVIDA.find((g) => FLUXO_DO_MES[g.id].pares.includes(p)).rotulo}"`,
    };
  }
  if (soOmie.length) {
    const o = soOmie[0];
    const r = conferirLancamento(o.emp, o.d);
    return { ok: r.ok, emp: o.emp, d: o.d, motivo: r.ok ? null : (r.motivo ?? r.dif.join('; ')), texto: `${casoDoLancamento(o.emp, o.d)} — ${r.ok ? `achado de volta na página ${r.pagina} da leitura crua do cache com os mesmos campos` : 'não conferiu'}; nenhuma linha do DFC do mês casou com ele` };
  }
  if (soDfc.length) { const x = doDfc(soDfc[0], null); return { ok: x.ok, motivo: x.ok ? null : x.dif.join('; '), texto: `${x.texto}; nenhum lançamento do Omie do mês casou com ela` }; }
  return null;
})();

// O CASO DO CONTRATO (planilha de contratos, desde 30/09/2026). Dois caminhos independentes da regra:
//   1. a aba `CONTRATOS` relida CRUA, célula por célula pela referência no XML (sem `lerAba`), e cada campo que a regra
//      usou — VALOR, DATA, PARCELAS, TAXA, PRIMEIRO VENCIMENTO e VALOR DA PARCELA — comparado com o que ela leu;
//   2. a CAPTAÇÃO do contrato achada no `FLUXO DE CAIXA` do mês da DATA: uma linha de dívida (`SUB 2` `EMPRESTIMO`) de
//      entrada, no mesmo dia e com o mesmo valor em centavos; e a PRIMEIRA PARCELA, quando a planilha a traz, no mês do
//      PRIMEIRO VENCIMENTO: uma saída de dívida no mesmo dia e com o mesmo valor.
// O caso é o primeiro contrato (pela linha da planilha) cuja captação e primeira parcela estão no DFC; sem nenhum
// assim, o primeiro com a captação; sem nenhum, o da linha 2, que sai divergente. O valor em reais não é escrito aqui:
// só "o mesmo valor em centavos".
const CASO_DO_CONTRATO = await (async () => {
  if (!CONTRATOS.ok || !CONTRATOS.contratos.length) return null;
  const ler = CONTRATOS.origem === 'pasta do DFC' ? (n) => fonteDoDfc().ler(n) : (n) => fonteLocalDosContratos(RAIZ).ler(n);
  const zip = lerZip(await ler(CONTRATOS.arquivo));
  const ss = sharedStrings(zip);
  const aba = abasDo(zip)[0];
  const xml = zip.ler(aba.parte).toString('utf8');
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const col = {};
  for (const c of letras) {
    const t = norm(celulaCrua(xml, ss, `${c}1`) ?? '');
    for (const [k, rot] of [['valor', 'VALOR'], ['data', 'DATA'], ['parcelas', 'PARCELAS'], ['primeiro', 'PRIMEIRO VENCIMENTO'], ['parcela', 'VALOR DA PARCELA'], ['contrato', 'CONTRATO']]) if (t === rot) col[k] = c;
    if (t.startsWith('TAXA')) col.taxa = c;
  }
  const utcDe = (d) => (d ? Date.UTC(d.a, d.m - 1, d.d) : Infinity);
  const dataTexto = (d) => (d ? `${dois(d.d)}/${dois(d.m)}/${d.a}` : '(sem data)');
  const serial = (x) => { const d = new Date(Date.UTC(1899, 11, 30) + Number(x) * 86400000); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
  const mesmaData = (a, b) => a && b && a.a === b.a && a.m === b.m && a.d === b.d;
  const meses = new Map();
  const dfcDoMes = async (a, m) => {
    if (a !== ANO) return null;
    if (!meses.has(m)) meses.set(m, m === MES ? DFC : await lerDfc({ fonte: fonteDoDfc(), ano: ANO, mes: m, comSerie: false }));
    const r = meses.get(m);
    return r?.ok ? r : null;
  };
  const achar = async (data, natureza, valor) => {
    const r = await dfcDoMes(data.a, data.m);
    if (!r) return { linha: null, arquivo: null };
    const l = r.linhas.find((x) => eDividaDfc(x) && x.natureza === natureza && x.dia === data.d && Math.abs(x.valor) === valor);
    return { linha: l?.linha ?? null, arquivo: r.arquivo };
  };
  const casos = [];
  for (const c of CONTRATOS.contratos.slice().sort((a, b) => a.linha - b.linha)) {
    const dif = [];
    const cru = (k) => (col[k] ? celulaCrua(xml, ss, `${col[k]}${c.linha}`) : null);
    if (Math.round(Number(cru('valor')) * 100) !== c.valor) dif.push('`VALOR` relido não é o que a regra usou');
    if (!mesmaData(serial(cru('data')), c.data)) dif.push('`DATA` relida não é a que a regra usou');
    if (Number(cru('parcelas')) !== c.parcelas) dif.push('`PARCELAS` relida não é a que a regra usou');
    if (Number(cru('taxa')) !== c.taxa) dif.push('`TAXA` relida não é a que a regra usou');
    if (!mesmaData(serial(cru('primeiro')), c.primeiro)) dif.push('`PRIMEIRO VENCIMENTO` relido não é o que a regra usou');
    if (c.parcela !== null && Math.round(Number(cru('parcela')) * 100) !== c.parcela) dif.push('`VALOR DA PARCELA` relido não é o que a regra usou');
    const captacao = await achar(c.data, 'R', c.valor);
    const parcela = c.parcela !== null ? await achar(c.primeiro, 'P', c.parcela) : { linha: null, arquivo: null };
    casos.push({ c, dif, captacao, parcela });
  }
  const caso = casos.find((x) => x.captacao.linha && x.parcela.linha) ?? casos.find((x) => x.captacao.linha) ?? casos[0];
  const { c, dif, captacao, parcela } = caso;
  if (!captacao.linha) dif.push(`a captação do contrato (a \`DATA\` e o \`VALOR\`) não foi achada como entrada de dívida no \`FLUXO DE CAIXA\` de ${dois(c.data.m)}/${c.data.a}`);
  const saldo = saldoDosContratos(CONTRATOS, { a: ANO, m: MES, d: ultimoDia(ANO, MES) }).porContrato.find((x) => x.linha === c.linha);
  const outros = casos.filter((x) => x !== caso).map((x) => `o contrato \`${x.c.contrato}\` (linha ${x.c.linha}): captação ${x.captacao.linha ? `na linha ${x.captacao.linha} de \`${x.captacao.arquivo}\`` : (x.c.data.a === ANO ? 'não achada no DFC' : `em ${dois(x.c.data.m)}/${x.c.data.a}, antes dos arquivos do DFC de ${ANO}`)}, primeira parcela ${x.parcela.linha ? `na linha ${x.parcela.linha} de \`${x.parcela.arquivo}\`` : (x.c.primeiro.a === ANO && utcDe(x.c.primeiro) <= utcDe({ a: ANO, m: MES, d: ultimoDia(ANO, MES) }) ? 'não achada no DFC no dia do vencimento' : `vence em ${dataTexto(x.c.primeiro)}`)}`);
  return {
    ok: dif.length === 0, dif,
    texto: `o contrato \`${c.contrato}\` (${c.banco}, linha ${c.linha} da aba \`${aba.nome}\` de \`${CONTRATOS.arquivo}\`), relido no XML célula por célula pela referência — \`VALOR\`, \`DATA\` ${dataTexto(c.data)}, \`PARCELAS\` ${c.parcelas}, \`TAXA\`, \`PRIMEIRO VENCIMENTO\` ${dataTexto(c.primeiro)} e \`VALOR DA PARCELA\` ${dif.some((d) => d.includes('relid')) ? '**não** batem' : 'batem'} com o que a regra leu; a captação é a ${captacao.linha ? `linha ${captacao.linha} do \`FLUXO DE CAIXA\` de \`${captacao.arquivo}\` (\`SUB 2\` EMPRESTIMO, entrada, dia ${c.data.d}, o mesmo valor em centavos do \`VALOR\`)` : '(não achada)'}${parcela.linha ? ` e a primeira parcela é a linha ${parcela.linha} do \`FLUXO DE CAIXA\` de \`${parcela.arquivo}\` (saída, dia ${c.primeiro.d}, o mesmo valor em centavos do \`VALOR DA PARCELA\`)` : ''}; no fim de ${NOME_DO_MES} a regra conta ${pl(saldo?.pagas ?? 0, 'parcela vencida', 'parcelas vencidas')} de ${c.parcelas} e o saldo pelo principal mais os juros já corridos. Os outros: ${outros.join('; ') || 'nenhum'}`,
  };
})();

// AS CCBs DO ITAÚ (decisão do dono, 30/09/2026): o cronograma que a regra leu do Anexo I (pelas colunas, em Python) é
// relido aqui por OUTRO leitor, o texto do PDF pelo `pdftotext`; cada parcela que vence no mês tem de estar no texto
// (data e total na mesma linha) e casar com uma linha de dívida do DFC do mês, no mesmo dia e no mesmo valor em centavos.
const CASO_DAS_CCBS = (() => {
  if (!CONTRATOS.ok || !CONTRATOS.ccbs?.size) return null;
  const moeda = (c) => `${Math.floor(c / 100).toLocaleString('pt-BR')},${dois(c % 100)}`;
  const partes = [], dif = [];
  for (const [numero, ccb] of CONTRATOS.ccbs) {
    if (!ccb) { dif.push(`CCB ${numero}: Anexo I ilegível na cópia local`); continue; }
    let texto = null;
    for (const exe of [process.env.PDFTOTEXT, 'pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe'].filter(Boolean)) {
      try { texto = execFileSync(exe, ['-layout', '-enc', 'UTF-8', ccb.arquivo, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); break; } catch { /* próximo */ }
    }
    if (!texto) { dif.push(`CCB ${numero}: o texto do PDF não foi relido`); continue; }
    const doMes = ccb.parcelas.filter((p) => { const d = new Date(p.venc); return d.getUTCFullYear() === ANO && d.getUTCMonth() + 1 === MES; });
    const soJuros = ccb.parcelas.filter((p) => p.principal === 0).length;
    const casadas = doMes.map((p) => {
      const d = new Date(p.venc), data = `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
      const noTexto = texto.split('\n').some((l) => l.includes(data) && l.includes(moeda(p.total)));
      const linha = DFC.ok ? DFC.linhas.find((x) => eDividaDfc(x) && x.natureza === 'P' && x.dia === d.getUTCDate() && Math.abs(x.valor) === p.total) : null;
      if (!noTexto) dif.push(`CCB ${numero}: a parcela ${p.n} (${data}) não foi achada no texto do PDF`);
      if (!linha) dif.push(`CCB ${numero}: a parcela ${p.n} (${data}) não casa com linha de dívida do DFC do mês`);
      return `parcela ${p.n} de ${data} (${p.principal === 0 ? 'só juros' : 'juros e principal'}) ${noTexto ? 'achada no texto do Anexo I' : '**não** achada no texto'}${linha ? ` e igual, em centavos, à linha ${linha.linha} do \`FLUXO DE CAIXA\`` : ''}`;
    });
    partes.push(`CCB \`${numero}\`: ${ccb.parcelas.length} parcelas no Anexo I, principal somado igual ao total financiado, ${soJuros} primeiras só de juros; ${casadas.join('; ') || `nenhuma parcela vence em ${NOME_DO_MES}`}`);
  }
  return { ok: dif.length === 0, dif, texto: partes.join('; ') };
})();

add({
  tela: 'Tela 2', nome: 'Capital de giro tomado',
  fonte: 'fluxo do mês: Omie recortado + DFC por `SUB 2`, sem duplicar pagamentos; saldo: CCBs Itaú pelo Anexo I e planilha para contrato sem CCB legível',
  filtro: `**fluxo do mês** — Omie: ${FILTRO_CAIXA}, pela categoria (decisão do dono, 29/09/2026): captado = \`1.04.03\` Recebimento de Empréstimos Bancários (\`cNatureza = "R"\`); amortizado = \`2.04.89\` Giro de Capital e \`2.11.95\` Financiamento Veiculo, na empresa 1, que saíram de "(−) Despesas gerais", e \`2.04.91\` Emprestimo, na empresa 2, que saiu do resultado financeiro (\`cNatureza = "P"\`); a captação e a amortização ficam fora do DRE; juros = \`2.05.01\` Juros sobre Empréstimos; IOF = \`2.06.95\` (juros e IOF continuam no resultado financeiro do DRE, e aqui só aparecem). DFC: \`FLUXO DE CAIXA\` do mês, \`SUB 2\` (J) = \`EMPRESTIMO\` (entrada é captação, saída é parcela) e toda linha com "ANTECIPA" em \`SUB 2\` ou \`CLASS. CONTABIL\` (antecipação de recebíveis conta como dívida). **Sem contar duas vezes:** um lançamento do Omie e uma linha do DFC são o mesmo pagamento quando têm o mesmo sentido, o mesmo dia do mês e o mesmo valor em centavos, casados um a um. **Saldo devedor** — para as CCBs Itaú \`4528305982\` e \`4528550256\` (decisão do dono, 30/09/2026), o PDF da CCB da cópia local: total financiado (crédito + IOF + ECG) menos o principal das parcelas do Anexo I vencidas até o corte, mais os juros corridos desde o último vencimento pela taxa da CCB, sem juros futuros; vencimentos em 0–3, 3–12 e mais de 12 meses pelo total nominal das parcelas do Anexo I que faltam. O contrato sem CCB legível segue a planilha de contratos do financeiro (um \`.xlsx\` com "contrato" no nome, modelo em \`docs/modelo-contratos.xlsx\`), a custo amortizado, com as parcelas vencidas contando como pagas. CCB exigida ausente ou ilegível: sem número`,
  contagem: `${pl(nDoFluxo('omie'), 'lançamento', 'lançamentos')} do Omie e ${pl(nDoFluxo('dfc'), 'linha', 'linhas')} do DFC no fluxo do mês, ${Object.values(FLUXO_DO_MES).reduce((s, g) => s + g.pares.length, 0)} deles o mesmo pagamento nas duas fontes, que conta uma vez — ${pl(LANC_DO_FLUXO, 'pagamento', 'pagamentos')}: captado ${nGrupo('captado')}, amortizado ${nGrupo('amortizado')}, juros ${nGrupo('juros')}, IOF ${nGrupo('iof')}; ${pl(N_CONTRATOS, 'contrato', 'contratos')} na planilha de contratos (${TEXTO_CONTRATOS})`,
  estado: MOTIVO_DFC ? 'a-conferir' : (CASO_DA_DIVIDA && CASO_DA_DIVIDA.ok && (!CASO_DO_CONTRATO || CASO_DO_CONTRATO.ok) && (!CASO_DAS_CCBS || CASO_DAS_CCBS.ok) ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC ? `metade do fluxo é o DFC — ${MOTIVO_DFC}` : ([
    CASO_DA_DIVIDA ? CASO_DA_DIVIDA.motivo : 'nenhum pagamento de dívida entrou neste mês, então não há caso real',
    CASO_DO_CONTRATO && !CASO_DO_CONTRATO.ok ? `no saldo: ${CASO_DO_CONTRATO.dif.join('; ')}` : null,
    CASO_DAS_CCBS && !CASO_DAS_CCBS.ok ? `nas CCBs: ${CASO_DAS_CCBS.dif.join('; ')}` : null,
  ].filter(Boolean).join('; ') || null),
  caso: [
    `no fluxo do mês: ${CASO_DA_DIVIDA ? CASO_DA_DIVIDA.texto : 'nenhum pagamento de dívida entrou neste mês'}`,
    CASO_DAS_CCBS ? `nas CCBs do Itaú: ${CASO_DAS_CCBS.texto}` : null,
    CASO_DO_CONTRATO ? `na planilha de contratos: ${CASO_DO_CONTRATO.texto}` : `na planilha de contratos: ${TEXTO_CONTRATOS}`,
  ].filter(Boolean).join('; '),
});

// OBRIGAÇÕES COM CLIENTES: a regra é a de `obrigacoesComClientes`; os casos são um sinal ainda em aberto no fim do mês
// e um baixado com a NF no mês, cada um relido no título cru E no pedido cru.
const OBRIG = obrigacoesComClientes({ EMPRESAS, titulosR, pedidos, recorte: RECORTE, ano: ANO, mes: MES });
const menorSinal = (xs) => xs.slice().sort((a, b) => Number(a.nCodTitulo) - Number(b.nCodTitulo))[0] ?? null;
const textoDoSinal = (s, r) => `nCodTitulo ${s.nCodTitulo} (empresa ${s.empresa}, \`cOrigem\` ADVR, \`cStatus\` ${s.cru.cStatus}, \`nCodCC\` ${s.cru.nCodCC}, pago em ${s.cru.dDtPagamento}, ${s.cru.cNumDocFiscal ? 'com `cNumDocFiscal`' : 'sem `cNumDocFiscal`'}) — ${r.ok ? `achado de volta na página ${r.pagina} da leitura crua do cache com os mesmos campos` : `**não conferiu**: ${r.dif.join('; ')}`}; o \`nCodOS\` ${s.nCodOS} dele é o \`codigo_pedido\` do pedido \`numero_pedido\` ${r.ped?.cabecalho?.numero_pedido ?? '?'}, relido nas páginas cruas de \`ListarPedidos\` com \`faturado\` ${r.ped?.infoCadastro?.faturado ?? '?'} e \`cancelado\` ${r.ped?.infoCadastro?.cancelado ?? '?'}`;
// O caso do saldo prefere o sinal de pedido vivo que ainda espera a NF (não cancelado e sem NF até hoje): é o caso típico.
const SINAL_ABERTO = menorSinal(OBRIG.lancamentos.saldo.filter((s) => !s.pedidoCancelado && !s.comNf))
  ?? menorSinal(OBRIG.lancamentos.saldo.filter((s) => !s.pedidoCancelado)) ?? menorSinal(OBRIG.lancamentos.saldo);
const dataTexto = (d) => (d ? `${dois(d.d)}/${dois(d.m)}/${d.a}` : '(sem data)');
const SINAL_BAIXADO = menorSinal(OBRIG.lancamentos.baixados);
const R_ABERTO = SINAL_ABERTO ? conferirSinal(SINAL_ABERTO) : null;
const R_BAIXADO = SINAL_BAIXADO ? conferirSinal(SINAL_BAIXADO) : null;
const nfDoBaixado = SINAL_BAIXADO?.dataDaNf ? `${dois(SINAL_BAIXADO.dataDaNf.d)}/${dois(SINAL_BAIXADO.dataDaNf.m)}/${SINAL_BAIXADO.dataDaNf.a}` : null;
add({
  tela: 'Tela 2', nome: 'Obrigações com clientes', fonte: 'Omie, sinais `ADVR` recebidos de pedidos ainda sem NF, pelo valor nominal; à parte, o repasse a clientes da aba `PROVISÃO` do DFC',
  filtro: `\`financas/pesquisartitulos\` → \`PesquisarLancamentos\` com \`cNatureza: "R"\` por vencimento em ${ANO} (a leitura da carteira), recorte da MeuBESS por \`cabecTitulo.nCodCC\`, guardando \`cabecTitulo.cOrigem = "ADVR"\` (o sinal, adiantamento de venda) com \`cStatus\` na faixa pago e \`dDtPagamento\` até o dia de corte; ligado ao pedido por \`cabecTitulo.nCodOS\` = \`cabecalho.codigo_pedido\` de \`produtos/pedido\` → \`ListarPedidos\`. O sinal está **com NF** quando o pedido tem \`infoCadastro.faturado = "S"\` e o sinal traz \`cabecTitulo.cNumDocFiscal\`; a data da NF é a \`dDtEmissao\` do primeiro título \`VENR\` do pedido com o mesmo \`cNumDocFiscal\` (ou \`infoCadastro.dFat\`). **Saldo** no último dia do mês: os sinais recebidos até ele cuja NF não tinha saído até ele, somados por \`nValorTitulo\` (valor nominal). **Movimento:** sinais novos = recebidos no mês; baixados com a NF = os que estavam em aberto no começo do mês ou entraram nele e não estão no fim. O sinal continua receita no mês do pagamento, no DRE (decisão do dono, 29/09/2026)`,
  contagem: `${pl(OBRIG.contagem.emAberto, 'sinal', 'sinais')} \`ADVR\` em aberto no fim do mês (recebidos, de pedido ainda sem NF), ${OBRIG.contagem.pedidoCancelado} deles de pedido cancelado; ${OBRIG.contagem.noInicio} no fim do mês anterior, ${pl(OBRIG.contagem.novos, 'sinal novo', 'sinais novos')} no mês e ${OBRIG.contagem.baixados} baixados com a NF; ${OBRIG.contagem.sinaisLidos} sinais recebidos lidos na carteira de ${ANO}${OBRIG.contagem.nfSemData ? `, ${OBRIG.contagem.nfSemData} com NF sem data achada` : ''}`,
  estado: R_ABERTO && R_ABERTO.ok && (!R_BAIXADO || R_BAIXADO.ok) ? 'conferido' : 'divergente',
  motivo: R_ABERTO ? (R_ABERTO.ok && (!R_BAIXADO || R_BAIXADO.ok) ? null : [...R_ABERTO.dif, ...(R_BAIXADO?.dif ?? [])].join('; ')) : 'nenhum sinal em aberto no fim do mês, então não há caso real do saldo',
  caso: [
    SINAL_ABERTO ? `no saldo: ${textoDoSinal(SINAL_ABERTO, R_ABERTO)} — recebido e sem NF no fim de ${NOME_DO_MES}${SINAL_ABERTO.comNf ? ` (a NF só saiu em ${dataTexto(SINAL_ABERTO.dataDaNf)})` : ''}` : null,
    SINAL_BAIXADO ? `baixado com a NF no mês: ${textoDoSinal(SINAL_BAIXADO, R_BAIXADO)} — a NF é de ${nfDoBaixado ?? '(sem data)'}, a emissão do título \`VENR\` do mesmo pedido com o mesmo \`cNumDocFiscal\`` : null,
  ].filter(Boolean).join('; '),
});

// DÍVIDA LÍQUIDA: o saldo devedor (a planilha) menos o saldo dos bancos — os blocos de banco do `FLUXO DE CAIXA` do mês,
// os mesmos que o Fluxo de Caixa soma. O caso é o primeiro bloco, relido pela linha do último saldo dele.
const BANCOS = DFC.ok ? (DFC.saldosPorBanco ?? []) : [];
const CASO_DO_BANCO = (() => {
  const b = BANCOS.find((x) => x.linhaFinal !== null && x.linhaFinal !== undefined);
  if (!b) return null;
  const cru = DFC.cruas.get(b.linhaFinal);
  return { ok: Boolean(cru), texto: `o bloco ${b.bloco} da aba \`FLUXO DE CAIXA\` do arquivo \`${DFC.arquivo}\` (\`BANCO\` ${b.banco || '(vazio)'}), cujo último saldo está na linha ${b.linhaFinal}${cru ? ', achada de volta pelo número da linha numa segunda leitura da aba' : ', que **não** foi achada de volta na segunda leitura'}` };
})();
add({
  tela: 'Tela 2', nome: 'Dívida líquida', fonte: 'capital de giro tomado (CCBs Itaú e planilha) − saldo dos bancos da Tela 3 (DFC, `FLUXO DE CAIXA` do mês)',
  filtro: 'o saldo devedor do "Capital de giro tomado" (linha acima), menos o saldo dos bancos da Tela 3: o último saldo escrito de cada bloco de banco da aba `FLUXO DE CAIXA` do mês — a coluna de saldo corrido, reconhecida pela regra de `lib/regras/dfc.mjs` (o número só vale como saldo quando é o saldo anterior mais o movimento da linha). Sem a planilha de contratos, ou sem uma CCB Itaú exigida legível, a tela não tem este número e escreve o motivo no lugar dele',
  contagem: `${pl(BANCOS.length, 'bloco', 'blocos')} de banco no \`FLUXO DE CAIXA\` do mês (o saldo dos bancos da Tela 3); ${pl(N_CONTRATOS, 'contrato', 'contratos')} na planilha de contratos (${TEXTO_CONTRATOS})`,
  estado: MOTIVO_DFC ? 'a-conferir' : (CASO_DO_BANCO && CASO_DO_BANCO.ok ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC ? `o saldo dos bancos é do DFC — ${MOTIVO_DFC}` : (CASO_DO_BANCO?.ok ? null : 'nenhum bloco de banco do mês foi achado de volta'),
  caso: [
    CASO_DO_BANCO ? `no saldo dos bancos: ${CASO_DO_BANCO.texto}` : null,
    CASO_DA_DIVIDA ? `na dívida: o mesmo pagamento da linha "Capital de giro tomado" — ${CASO_DA_DIVIDA.texto.split(' — ')[0]}` : null,
    CONTRATOS.ok ? `a planilha de contratos foi lida: ${TEXTO_CONTRATOS}` : `a planilha de contratos não está na pasta: ${TEXTO_CONTRATOS}`,
  ].filter(Boolean).join('; '),
});

// RESULTADO SEM DINHEIRO DE TERCEIROS (decisão do dono, 29/09/2026, a segunda do dia): o lucro líquido menos a variação
// dos sinais em aberto no mês. Empréstimo, captação e amortização não entram — já estão fora do DRE. O caso abre a
// conta: o lucro, um sinal recebido de pedido sem NF no mês e um sinal baixado, cada um relido na fonte crua. Os
// valores ficam na tela; aqui vão as contagens, os títulos e o sentido da variação, nunca o dinheiro.
const utcDe = (d) => (d ? Date.UTC(d.a, d.m - 1, d.d) : Infinity);
const SINAL_NOVO = menorSinal(OBRIG.lancamentos.novos.filter((s) => !s.comNf || utcDe(s.dataDaNf) > utcDe(s.pago)))
  ?? menorSinal(OBRIG.lancamentos.novos);
const R_NOVO = SINAL_NOVO ? conferirSinal(SINAL_NOVO) : null;
const CASO_DO_LUCRO = conferirPrimeiro(porEmp(MES_P));
const OK_SEM_TERCEIROS = calc(porEmp(MES_P)).ok && (!R_NOVO || R_NOVO.ok) && (!R_BAIXADO || R_BAIXADO.ok);
const SENTIDO_DA_VARIACAO = OBRIG.variacao > 0
  ? 'positiva — em valor, entraram mais sinais de pedido sem NF do que saíram com a NF —, e por isso o resultado sem dinheiro de terceiros fica ABAIXO do lucro líquido'
  : (OBRIG.variacao < 0
    ? 'negativa — em valor, saíram mais sinais com a NF do que entraram —, e por isso o resultado sem dinheiro de terceiros fica ACIMA do lucro líquido, só pelos sinais'
    : 'zero, e o resultado sem dinheiro de terceiros é o próprio lucro líquido');
add({
  tela: 'Tela 2', nome: 'Resultado sem dinheiro de terceiros', fonte: 'lucro líquido do DRE do mês − variação dos sinais em aberto (sinais recebidos de pedidos sem NF − sinais baixados)',
  filtro: 'não tem leitura própria (decisão do dono, 29/09/2026): o lucro de caixa — a linha "(=) Lucro líquido" do mês — menos a variação dos sinais em aberto no mês, que é o movimento das obrigações com clientes (linha acima): sinais recebidos no mês de pedidos sem NF menos sinais baixados com a NF. **Empréstimo, captação e amortização não entram**: já estão fora do DRE (`2.04.89`, `2.11.95` e `2.04.91` como amortização, `1.04.03` como captação). Até a segunda decisão de 29/09/2026 a conta ainda tirava a captação líquida (captado − amortizado), o que somava a amortização de volta ao lucro',
  contagem: `${soma(MES_R) + soma(MES_P)} lançamentos do mês do lucro líquido e ${pl(OBRIG.contagem.novos + OBRIG.contagem.baixados, 'sinal', 'sinais')} que mexeram nas obrigações com clientes (${pl(OBRIG.contagem.novos, 'recebido', 'recebidos')} e ${OBRIG.contagem.baixados} baixados)`,
  estado: MOTIVO_DFC ? 'a-conferir' : (OK_SEM_TERCEIROS ? 'conferido' : 'divergente'),
  motivo: MOTIVO_DFC ? `o lucro líquido consome linhas de fonte DFC — ${MOTIVO_DFC}` : (OK_SEM_TERCEIROS ? null : 'um dos casos da conta não conferiu'),
  caso: `a conta aberta de ${NOME_DO_MES}: **lucro líquido** (os ${soma(MES_R) + soma(MES_P)} lançamentos do mês; ${textoDoCaso(CASO_DO_LUCRO, 'no lado do Omie: ')}) **− (sinais recebidos de pedidos sem NF** — ${pl(OBRIG.contagem.novos, 'sinal', 'sinais')} no mês; ${SINAL_NOVO ? `caso: ${textoDoSinal(SINAL_NOVO, R_NOVO)}, recebido em ${dataTexto(SINAL_NOVO.pago)}${SINAL_NOVO.comNf ? ` e com a NF só em ${dataTexto(SINAL_NOVO.dataDaNf)}` : ' e ainda sem NF'}` : 'nenhum'} **− sinais baixados** — ${OBRIG.contagem.baixados} no mês; ${SINAL_BAIXADO ? `caso: ${textoDoSinal(SINAL_BAIXADO, R_BAIXADO)}, com a NF de ${nfDoBaixado ?? '(sem data)'}` : 'nenhum'}**)**. A variação do mês é ${SENTIDO_DA_VARIACAO}. A amortização do mês (${pl(FLUXO_DO_MES.amortizado.omie.length, 'lançamento', 'lançamentos')} do Omie) e a captação (${FLUXO_DO_MES.captado.omie.length}) não entram na conta`,
});

// PROVISÕES POR PROJETO (29/09/2026, com as respostas do dono do mesmo dia): a aba `PROVISÃO` do DFC. O quadro por
// projeto vem em todo arquivo de mês a partir de setembro de 2026, com a data do fim do mês, e esta linha lê a aba DO
// MÊS CONFERIDO — como a tela. De abril a agosto a aba é um razão, sem projeto: a linha diz "0 projetos" e "sem
// provisão por projeto neste mês", e a releitura crua confirma que o cabeçalho do quadro não está lá.
//
// O CAMINHO DE TRÁS NÃO USA O LEITOR DO APP. A conta sai de `provisoesDoMes` (a regra); a conferência relê a aba CRUA,
// célula por célula PELA REFERÊNCIA (`C7`, `J7`…) no XML, sem passar por `lerAba` — e assim pegaria também uma célula
// vazia engolindo a vizinha, o defeito do leitor achado nesta aba e corrigido em 29/09/2026. As linhas de projeto, o
// frete, a comissão, a compra e o repasse são recontados aqui por conta própria. O imposto não entra: é crédito da
// empresa e não se paga (dono, 30/09/2026); toda linha da aba é ainda não paga, e não há coluna de pagamento.
const PROV = await (async () => {
  if (SEM_DFC) return { ok: false, motivo: 'esta rodada foi feita com `--sem-dfc`' };
  const fonte = fonteDoDfc();
  const r = await lerDfc({ fonte, ano: ANO, mes: MES, comSerie: false });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  const p = provisoesDoMes(r.provisao);
  const buf = await fonte.ler(r.arquivo);
  if (!p.ok) return { ok: false, semQuadro: true, motivo: p.motivo, mes: MES, arquivo: r.arquivo, buf };
  return { ...p, mes: MES, arquivo: r.arquivo, buf };
})();

// A RELEITURA CRUA: a célula pela referência, com a célula vazia fechada em si mesma (`<c r="I7" s="634"/>`) valendo
// vazio. Devolve o texto (compartilhado, inline ou de fórmula) ou o número.
function celulaCrua(xml, ss, ref) {
  const m = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(xml);
  if (!m || m[2] === undefined) return null;
  const tipo = /t="([^"]*)"/.exec(m[1])?.[1] ?? 'n';
  const v = /<v>([\s\S]*?)<\/v>/.exec(m[2])?.[1];
  if (tipo === 's') return (ss[+v] ?? '').trim() || null;
  if (tipo === 'inlineStr' || tipo === 'str') return (v ?? '').trim() || null;
  return v !== undefined && v !== '' ? Number(v) : null;
}
const CONF_PROV = (() => {
  if (!PROV.buf) return null;
  const zip = lerZip(PROV.buf);
  const ss = sharedStrings(zip);
  const aba = abasDo(zip).find((a) => norm(a.nome) === 'PROVISAO');
  if (!aba) return { ok: Boolean(PROV.semQuadro), dif: [], semAba: true };
  const xml = zip.ler(aba.parte).toString('utf8');
  const letras = [];
  for (let i = 0; i < 40; i++) letras.push(i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);
  const numeros = [...xml.matchAll(/<row\b[^>]*?\br="(\d+)"/g)].map((m) => +m[1]);
  // O cabeçalho, relido: a primeira linha com uma célula escrita "PROJETO" e outra "CONSULTOR" (o razão de abril a
  // agosto tem "PROJETO", mas não "CONSULTOR"), e nela a letra de cada coluna pelo rótulo.
  const temRotulo = (n, r) => letras.some((c) => norm(celulaCrua(xml, ss, `${c}${n}`)) === r);
  const cabecalho = numeros.find((n) => temRotulo(n, 'PROJETO') && temRotulo(n, 'CONSULTOR'));
  if (PROV.ok && PROV.formato === 'razão') {
    const cabRazao = numeros.find((n) => temRotulo(n, 'TIPO') && temRotulo(n, 'SUB 2'));
    const col = {};
    for (const [k, rotulo] of Object.entries({ projeto: 'TIPO', sub2: 'SUB 2', compra: 'SAIDA', pagamento: 'PAGAMENTO' }))
      col[k] = letras.find((c) => norm(celulaCrua(xml, ss, `${c}${cabRazao}`)) === rotulo);
    const cru = (k, n) => celulaCrua(xml, ss, `${col[k]}${n}`);
    const compras = numeros.filter((n) => n > cabRazao && norm(cru('sub2', n)) === 'COMPRAS - PROVISAO'
      && norm(cru('pagamento', n)) === 'A PAGAR' && /^\d+$/.test(String(cru('projeto', n) ?? ''))
      && Math.abs(Number(cru('compra', n))) > 0);
    const dif = [];
    if (compras.length !== PROV.contagem.projetos || compras.length !== PROV.contagem.compra)
      dif.push(`compras por projeto: regra ${PROV.contagem.projetos}, releitura crua ${compras.length}`);
    const caso = PROV.projetos[0];
    if (caso && (String(cru('projeto', caso.linha)) !== caso.projeto
      || Math.abs(Math.round(Number(cru('compra', caso.linha)) * 100)) !== caso.compra))
      dif.push(`projeto ou compra da linha ${caso.linha} difere da célula crua`);
    return { ok: dif.length === 0, dif, releitura: { projetos: compras.length, compra: compras.length }, caso,
      campos: ['TIPO preenchido', 'SAIDA preenchida', 'PAGAMENTO A PAGAR'], col, cabecalho: cabRazao, formato: 'razão' };
  }
  if (PROV.semQuadro) {
    return { ok: cabecalho === undefined, dif: cabecalho === undefined ? [] : [`a regra não achou o quadro, e a releitura crua achou o cabeçalho na linha ${cabecalho}`], semQuadro: true };
  }
  const col = {};
  for (const [k, rotulo] of Object.entries(COLUNAS_DA_PROVISAO)) {
    const l = letras.find((c) => [rotulo].flat().includes(norm(celulaCrua(xml, ss, `${c}${cabecalho}`))));
    if (l) col[k] = l;
  }
  const cru = (k, n) => (col[k] ? celulaCrua(xml, ss, `${col[k]}${n}`) : null);
  const emCent = (x) => (x === null || x === undefined || x === '' || Number.isNaN(Number(x)) ? null : Math.round(Number(x) * 100));
  // As linhas de projeto, relidas: toda linha abaixo do cabeçalho cuja célula de `PROJETO` tem o código. Toda linha
  // da aba é ainda não paga (dono, 30/09/2026): nenhuma sai por pagamento.
  const projetos = numeros.filter((n) => n > cabecalho && E_CODIGO_DE_PROJETO.test(String(cru('projeto', n) ?? '')));
  const maiorQueZero = (k) => projetos.filter((n) => (emCent(cru(k, n)) ?? 0) > 0).length;
  const releitura = {
    projetos: projetos.length, frete: maiorQueZero('frete'), comissao: maiorQueZero('comissao'),
    comissaoHead: maiorQueZero('comissaoHead'), compra: maiorQueZero('compra'), repasse: maiorQueZero('repasse'),
  };
  const dif = [];
  for (const [k, v] of Object.entries(releitura)) if (PROV.contagem[k] !== v) dif.push(`\`${k}\`: a regra conta ${PROV.contagem[k]} e a releitura crua ${v}`);
  // O CASO: o primeiro projeto com frete E repasse — é nele que a célula vazia de `VALOR DE COMPRA` fica ao lado do
  // frete, e onde o defeito de `lerAba` punha o frete na coluna da compra.
  const caso = PROV.projetos.find((p) => (p.frete ?? 0) > 0 && (p.repasse ?? 0) > 0) ?? PROV.projetos[0];
  const campos = [];
  const NOME = { compra: 'VALOR DE COMPRA', frete: 'VALOR FRETE', repasse: 'VALOR REPASSE', comissao: 'VALOR COMISSÃO', comissaoHead: 'VALOR COMISSÃO HEAD' };
  if (caso) {
    if (cru('projeto', caso.linha) !== caso.projeto) dif.push(`na linha ${caso.linha}, \`PROJETO\` veio "${cru('projeto', caso.linha)}" e a regra usou "${caso.projeto}"`);
    for (const k of ['compra', 'frete', 'repasse', 'comissao', 'comissaoHead']) {
      const a = emCent(cru(k, caso.linha)), b = caso[k];
      if ((a ?? 0) !== (b ?? 0)) dif.push(`na linha ${caso.linha}, \`${NOME[k]}\` (${col[k]}) não é o valor que a regra usou`);
      campos.push(`\`${NOME[k]}\` ${a === null ? 'vazio' : (a > 0 ? 'preenchido' : 'zero')}`);
    }
  }
  return { ok: dif.length === 0, dif, releitura, caso, campos, col, cabecalho };
})();

{
  const semQuadro = Boolean(PROV.semQuadro);
  add({
    tela: 'Tela 2', nome: 'Provisões por projeto',
    fonte: 'DFC, aba `PROVISÃO` do arquivo do mês: frete, comissão, comissão head e compra de cada projeto vendido (toda linha da aba é ainda não paga; o imposto é crédito e fica fora)',
    filtro: `a aba \`PROVISÃO\` do arquivo do DFC ${PROV.ok || semQuadro ? `do mês ${dois(PROV.mes)}/${ANO} (\`${PROV.arquivo}\`)` : 'do mês'} — o quadro por projeto vem em todo arquivo de mês a partir de setembro de 2026, com a data do fim do mês, e a tela lê a aba do mês escolhido; mês cuja aba não tem o quadro (de abril a agosto de 2026 ela é um razão de recebimentos e compras de provisão, sem projeto) sai **"sem provisão por projeto neste mês"**, e não zero. O quadro é achado pelo **cabeçalho** (\`PROJETO\`, \`CLIENTE\`, \`CONSULTOR\`, \`VALOR FRETE\`, \`VALOR REPASSE\`, \`VALOR COMISSÃO\`, \`VALOR COMISSÃO HEAD\`), não pela letra; **entra** toda linha abaixo dele cuja célula de \`PROJETO\` é um código de projeto (oito dígitos de data, hífen e número — o mesmo código do item do pedido de venda no Omie); as linhas do fim da aba sem código (sobra do razão antigo, "SALDO FINAL PROVISÃO") ficam fora. **Pago** (dono, 30/09/2026): toda linha da aba é ainda não paga — o financeiro tira a linha quando paga ou cancela —, e não há coluna "pago em". **Soma**, em todas as linhas de projeto, célula vazia contando zero: \`VALOR FRETE\`, \`VALOR COMISSÃO\`, \`VALOR COMISSÃO HEAD\` e \`VALOR DE COMPRA\` (vazia em setembro de 2026, conta zero até a gestora do financeiro preencher). **O imposto fica fora** (dono, 30/09/2026): a coluna \`IMPOSTO\` é crédito da empresa e não se paga, e não é lida. O cartão é a soma dessas quatro, "provisionado". **O repasse** (\`VALOR REPASSE\`) é pagamento a clientes: não soma aqui, vai para o quadro "Obrigações com clientes", à parte dos sinais do Omie, com o projeto e o cliente, e não entra no resultado sem dinheiro de terceiros. **Fora da tela:** \`VALOR FINAL\` (só em duas linhas), \`VALOR PROJETO\`, \`IMPOSTO\` (crédito), \`VALOR RECEBIDO\` e \`VALIR A RECEBER\` (o sinal do cliente, que o bloco conta pelo Omie, com a NF). Lida por \`lerAba\`, que lê a célula vazia como vazia (o defeito que a fazia engolir a vizinha foi corrigido em 29/09/2026)`,
    contagem: PROV.ok
      ? `${pl(PROV.contagem.projetos, 'projeto', 'projetos')} na aba \`PROVISÃO\` do mês ${dois(PROV.mes)}/${ANO} — frete em ${PROV.contagem.frete}, comissão em ${PROV.contagem.comissao}, comissão head em ${PROV.contagem.comissaoHead}, compra em ${PROV.contagem.compra}; repasse a clientes em ${PROV.contagem.repasse} (fora da soma, nas obrigações com clientes); toda linha da aba é ainda não paga, e o imposto (crédito) fica fora`
      : (semQuadro
        ? `0 projetos na aba \`PROVISÃO\` do mês ${dois(PROV.mes)}/${ANO} — sem provisão por projeto neste mês: ${PROV.motivo}`
        : `nenhum projeto: ${PROV.motivo}`),
    estado: MOTIVO_DFC || !(PROV.ok || semQuadro) ? 'a-conferir' : (CONF_PROV.ok ? 'conferido' : 'divergente'),
    motivo: MOTIVO_DFC ? `a fonte é o DFC — ${MOTIVO_DFC}` : (!(PROV.ok || semQuadro) ? PROV.motivo : (CONF_PROV.ok ? null : CONF_PROV.dif.join('; '))),
    caso: PROV.ok && CONF_PROV.caso && CONF_PROV.formato === 'razão'
      ? `a linha ${CONF_PROV.caso.linha} da aba \`PROVISÃO\` de \`${PROV.arquivo}\`, projeto \`${CONF_PROV.caso.projeto}\`, relida no XML por referência: \`TIPO\` em ${CONF_PROV.col.projeto}, \`SAIDA\` em ${CONF_PROV.col.compra} e \`PAGAMENTO\` em ${CONF_PROV.col.pagamento}; as ${PROV.contagem.compra} compras a pagar foram recontadas independentemente`
      : PROV.ok && CONF_PROV.caso
      ? `a linha ${CONF_PROV.caso.linha} da aba \`PROVISÃO\` de \`${PROV.arquivo}\`, projeto \`${CONF_PROV.caso.projeto}\`, relida no XML célula por célula pela referência — ${CONF_PROV.campos.join(', ')} —, com os mesmos valores que a regra usou; e as ${PROV.contagem.projetos} linhas de projeto e as contagens por coluna, recontadas na releitura crua a partir do cabeçalho da linha ${CONF_PROV.cabecalho}, ${CONF_PROV.ok ? 'batem' : 'não batem'}. As colunas, achadas pelo cabeçalho: \`PROJETO\` em ${CONF_PROV.col.projeto}, \`VALOR PROJETO\` em ${CONF_PROV.col.valorProjeto}, \`VALOR DE COMPRA\` em ${CONF_PROV.col.compra}, \`VALOR FRETE\` em ${CONF_PROV.col.frete}, \`VALOR REPASSE\` em ${CONF_PROV.col.repasse}, \`VALOR COMISSÃO\` em ${CONF_PROV.col.comissao} e \`VALOR COMISSÃO HEAD\` em ${CONF_PROV.col.comissaoHead}`
      : (semQuadro && CONF_PROV
        ? `a aba \`PROVISÃO\` de \`${PROV.arquivo}\`, relida no XML: ${CONF_PROV.semAba ? 'o arquivo não tem a aba' : (CONF_PROV.ok ? 'nenhuma linha tem os rótulos `PROJETO` e `CONSULTOR` juntos — é o razão, não o quadro por projeto' : CONF_PROV.dif.join('; '))}`
        : 'nenhum projeto para conferir'),
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
    // A IDENTIDADE do caso, separada do resultado da conferência: é ela que vai para a trava do mês. A página em que o
    // título foi achado de volta fica fora — ela muda quando a releitura repagina a leitura, e isso não é divergência.
    const identidade = `nCodTitulo ${e.cab.nCodTitulo} (empresa ${e.emp}, \`cNatureza\` ${e.cab.cNatureza}, \`cStatus\` ${e.cab.cStatus}, \`nCodCC\` ${e.cab.nCodCC}, \`cCodCateg\` ${e.cab.cCodCateg}, vence em ${e.cab.dDtVenc}, \`resumo.cLiquidado\` ${e.resumo.cLiquidado ?? '?'})`;
    // Só os casos do mês pedido entram na trava. A faixa "em aberto" do "Valor pendente" lê outra janela de
    // vencimento, de propósito (ver o topo), e é a única que chega aqui com `faixas` diferente do ano inteiro.
    if (faixas === FAIXAS_TIT_R) CASOS_DO_MES.add(identidade);
    caso = `${identidade} — ${r.ok ? `achado de volta na página ${r.pagina} ${ondeCaso} com os mesmos campos` : `**não conferiu**: ${r.motivo ?? r.dif.join('; ')}`}${casoExtra ? `, ${casoExtra}` : ''}`;
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
  const POR_QUE = `o mês usado nesta linha é **${MES_DA_FAIXA_ABERTO}**, e não ${NOME_DO_MES} de ${ANO} como em todos os outros indicadores desta página: em ${NOME_DO_MES} esta faixa deu 0 títulos, e num mês fechado ela é sempre vazia — todo título que já venceu está pago ou atrasado, e os quatro \`cStatus\` da faixa são os de um título que ainda não venceu. Das duas janelas que começam hoje (${HOJE}), ${MES_DA_FAIXA_ABERTO} é o primeiro mês inteiramente à frente: a janela é o mês todo, como nos outros indicadores, e nenhum título dele venceu. Do mês corrente sobram ${DIAS_QUE_RESTAM} dias (${JANELA_CORRENTE[0]} a ${JANELA_CORRENTE[1]}), que são um trecho de ${MES_CORRENTE_NOME} e não um mês; essa janela foi lida também e traz ${t3Total(ABERTO_CORRENTE)} títulos na faixa (${ABERTO_CORRENTE[1].length} na empresa 1 e ${ABERTO_CORRENTE[2].length} na 2)`;
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

// ---------------------------------------------------------------- Tela 3, os números que o Fluxo de Caixa trouxe
//
// A Tela 3 virou Fluxo de Caixa em 28/09/2026, e os quatro números que NASCERAM nela — despesas fixas pagas, o peso
// delas na receita líquida, a projeção do mês e o gráfico do mês dia a dia — não passavam por esta página. Os outros
// seis cartões dela são cartões das Telas 1 e 3 pelo mesmo cálculo, e já estão conferidos nas linhas deles.
//
// Os quatro são de fonte DFC (a projeção soma o Omie por cima), e por isso são conferidos como os do DFC já eram: a
// contagem das linhas que o filtro de `docs/fontes.md` pega, e a linha de menor número achada de volta numa segunda
// leitura crua da aba `FLUXO DE CAIXA`. Nenhum valor em dinheiro entra aqui.
const FIXAS = lerDespesasFixas(RAIZ);
const eFixaDfc = (l) => l.natureza === 'P' && FIXAS.fixas.has(l.sub2);
const eReceitaLiquidaDfc = (l) => l.natureza === 'R' && DFC_RECEITA.includes(l.sub2);
const FILTRO_FLUXO = `aba \`FLUXO DE CAIXA\` do arquivo do mês, linhas baixadas (\`PAGAMENTO\` diferente de A PAGAR / A RECEBER) com \`DIA PG\` no mês`;

if (!FIXAS.respondido) {
  add({
    tela: 'Tela 3', nome: 'Despesas fixas pagas', fonte: 'DFC', estado: 'a-conferir',
    filtro: `${FILTRO_FLUXO}, coluna \`SAIDA\`, só as linhas cujo \`SUB 2\` está na lista de fixas de \`dados/despesas-fixas.json\``,
    contagem: 'nenhuma linha: a classificação de despesa fixa ainda não foi respondida pela gestora',
    motivo: 'a lista de despesas fixas de `dados/despesas-fixas.json` não está respondida, e sem ela a tela não mostra número de despesa fixa (`docs/fontes.md`)',
    caso: '',
  });
  add({
    tela: 'Tela 3', nome: 'Fixas / receita líquida', fonte: 'DFC', estado: 'a-conferir',
    filtro: 'despesas fixas pagas ÷ receita líquida do mês, as duas do DFC',
    contagem: 'nenhuma linha: a classificação de despesa fixa ainda não foi respondida pela gestora',
    motivo: 'o numerador desta razão é a despesa fixa, e a lista de `dados/despesas-fixas.json` não está respondida',
    caso: '',
  });
} else {
  const rFixas = MOTIVO_DFC ? null : conferirDfc(eFixaDfc);
  const contasFixas = MOTIVO_DFC ? null : new Set(DFC.linhas.filter(eFixaDfc).map((l) => l.sub2));
  add({
    tela: 'Tela 3', nome: 'Despesas fixas pagas', fonte: 'DFC',
    filtro: `${FILTRO_FLUXO}, coluna \`SAIDA\`, só as linhas cujo \`SUB 2\` a gestora marcou como Fixa em \`dados/despesas-fixas.json\` (${FIXAS.fixas.size} contas${FIXAS.respondidoEm ? `, respondido em ${FIXAS.respondidoEm}` : ''}); soma a \`SAIDA\` delas`,
    contagem: MOTIVO_DFC
      ? 'as planilhas não foram lidas nesta rodada'
      : `${pl(rFixas.quantas, 'linha de saída fixa no mês', 'linhas de saída fixas no mês')}, em ${pl(contasFixas.size, 'conta fixa distinta', 'contas fixas distintas')} das ${FIXAS.fixas.size} que a gestora marcou; ${pl(FIXAS.ausentesDaResposta.length, 'conta de despesa não voltou na resposta dela e fica fora das fixas', 'contas de despesa não voltaram na resposta dela e ficam fora das fixas')} (${FIXAS.ausentesDaResposta.join(', ')})`,
    estado: MOTIVO_DFC ? 'a-conferir' : (rFixas.vazio ? 'a-conferir' : (rFixas.ok ? 'conferido' : 'divergente')),
    motivo: MOTIVO_DFC ? `a fonte deste indicador é o DFC e as planilhas não foram lidas nesta rodada — ${MOTIVO_DFC}`
      : (rFixas.vazio ? 'nenhuma linha de despesa fixa no mês, então não há caso real para conferir'
        : (rFixas.ok ? null : `a linha do DFC não conferiu: ${rFixas.dif.join('; ')}`)),
    caso: MOTIVO_DFC || rFixas.vazio ? '' : textoDoCasoDfc(rFixas),
  });

  const rRl = MOTIVO_DFC ? null : conferirDfc(eReceitaLiquidaDfc);
  const nDed = MOTIVO_DFC ? null : DFC.linhas.filter(eDeducaoDfc).length;
  add({
    tela: 'Tela 3', nome: 'Fixas / receita líquida', fonte: 'DFC',
    filtro: `despesas fixas pagas ÷ receita líquida do mês, as duas do DFC. A receita líquida é a MESMA conta do cartão "% desp. funcionários / receita líquida" da Tela 1: linhas de \`SUB 2\` ${DFC_RECEITA.join(', ')}, menos as de dedução (\`SUB 2\` DEVOLUCÃO ou \`CLASS. CONTABIL\` ESTORNO)`,
    contagem: MOTIVO_DFC
      ? 'as planilhas não foram lidas nesta rodada'
      : `${pl(rFixas.quantas, 'linha fixa no numerador', 'linhas fixas no numerador')} e ${pl(rRl.quantas, 'linha de receita no denominador', 'linhas de receita no denominador')}, menos ${pl(nDed, 'linha de dedução', 'linhas de dedução')}`,
    estado: MOTIVO_DFC ? 'a-conferir' : (rRl.vazio ? 'a-conferir' : (rRl.ok ? 'conferido' : 'divergente')),
    motivo: MOTIVO_DFC ? `as duas pontas desta razão são do DFC e as planilhas não foram lidas nesta rodada — ${MOTIVO_DFC}`
      : (rRl.vazio ? 'nenhuma linha de receita no mês, então não há denominador para conferir'
        : (rRl.ok ? null : `a linha de receita do DFC não conferiu: ${rRl.dif.join('; ')}`)),
    caso: MOTIVO_DFC || rRl.vazio ? '' : `o denominador, ${textoDoCasoDfc(rRl)}`,
  });
}

// A PROJEÇÃO: num mês fechado ela não existe — é o resultado do mês, e o cartão do Omie vira "venceu no mês e não foi
// pago". O que se confere aqui é justamente isso: as linhas do DFC que a conta consome, e a ausência do lado do Omie.
{
  const rEnt = MOTIVO_DFC ? null : conferirDfc(eReceitaTela1Dfc);
  const nSaida = MOTIVO_DFC ? null : DFC.linhas.filter((l) => l.natureza === 'P').length;
  add({
    tela: 'Tela 3', nome: 'Projeção do mês', fonte: 'DFC + Omie',
    filtro: `resultado do mês (Entrou − Saiu, do ${FILTRO_FLUXO}) + ainda a receber no mês (Omie, faixa EM ABERTO) − ainda a pagar no mês (Omie, títulos a pagar vencendo no mês e sem baixa). **Só com o mês em andamento:** num mês fechado o cartão diz "mês fechado" e não traz projeção, e o cartão do Omie ao lado passa a se chamar "Venceu no mês e não foi pago" (\`docs/fontes.md\`)`,
    contagem: MOTIVO_DFC
      ? 'as planilhas não foram lidas nesta rodada'
      : `${pl(rEnt.quantas + nSaida, 'linha do `FLUXO DE CAIXA` no mês', 'linhas do `FLUXO DE CAIXA` no mês')} do lado do DFC — ${n(rEnt.quantas)} de entrada e ${n(nSaida)} de saída; sem título do Omie, porque ${NOME_DO_MES} é mês fechado e num mês fechado não há projeção — a tela não mostra contagem do Omie neste cartão, e não um zero`,
    estado: MOTIVO_DFC ? 'a-conferir' : (rEnt.vazio ? 'a-conferir' : (rEnt.ok ? 'conferido' : 'divergente')),
    motivo: MOTIVO_DFC ? `a parte do DFC desta conta é a fonte principal e as planilhas não foram lidas nesta rodada — ${MOTIVO_DFC}`
      : (rEnt.vazio ? 'nenhuma linha de entrada no mês, então não há caso real para conferir'
        : (rEnt.ok ? null : `a linha do DFC não conferiu: ${rEnt.dif.join('; ')}`)),
    caso: MOTIVO_DFC || rEnt.vazio ? '' : textoDoCasoDfc(rEnt),
  });
}

// O MÊS DIA A DIA: o consolidado é o mesmo conjunto de linhas dos cartões Entrou e Saiu, repartido pelo dia de
// `DIA PG`; a previsão é do Omie e não existe num mês fechado. O que esta linha acrescenta é a PONTE COM OS BANCOS:
// a posição do último dia consolidado mais o que o saldo corrido da planilha já desconta e não está baixado tem de dar
// o último saldo somado dos bancos. Só o veredito entra aqui — o valor em reais fica no terminal
// (`scripts/diagnostico-dia-a-dia.mjs`).
{
  const bancos = MOTIVO_DFC ? [] : (DFC.saldosPorBanco ?? []);
  const rDia = MOTIVO_DFC ? null : conferirDfc(() => true);
  const dias = MOTIVO_DFC ? null : new Set(DFC.linhas.map((l) => l.dia)).size;
  const naoBaixado = bancos.reduce((t, b) => t + (b.naoBaixado ?? 0), 0);
  const nNaoBaixado = bancos.reduce((t, b) => t + (b.linhasNaoBaixado ?? 0), 0);
  const fecham = bancos.filter((b) => b.fecha).length;
  const posicao = bancos.reduce((t, b) => t + b.abertura + b.movimentoUsado, 0);
  const fim = bancos.reduce((t, b) => t + b.final, 0);
  // A PONTE, a mesma de `conferenciaDosBancos` em `lib/indicadores/fluxo-de-caixa.mjs`. O último termo é o movimento que
  // a planilha lançou DEPOIS de parar de escrever o saldo no bloco — em agosto de 2026 são dois bancos.
  const depoisDoSaldo = bancos.reduce((t, b) => t + (b.depoisDoUltimoSaldo ?? 0), 0);
  const nDepoisDoSaldo = bancos.filter((b) => (b.depoisDoUltimoSaldo ?? 0) !== 0).length;
  const ponteFecha = bancos.length > 0 && fecham === bancos.length && posicao + naoBaixado - depoisDoSaldo - fim === 0;
  add({
    tela: 'Tela 3', nome: 'O mês dia a dia', fonte: 'DFC (consolidado) + Omie (previsão)',
    filtro: `consolidado: ${FILTRO_FLUXO}, repartidas pelo dia de \`DIA PG\`, a mesma conta dos cartões Entrou e Saiu; previsão: Omie, os títulos a receber em aberto e a pagar sem baixa pelo dia de vencimento, **só com o mês em andamento**. A linha é a posição de caixa e soma TODAS as linhas do dia, transferência inclusive; ela parte do saldo corrido de cada banco na primeira linha do bloco dele (\`saldosPorBanco\` em \`lerMesDoDfc\`)`,
    contagem: MOTIVO_DFC
      ? 'as planilhas não foram lidas nesta rodada'
      : `${pl(rDia.quantas, 'linha do `FLUXO DE CAIXA` no mês', 'linhas do `FLUXO DE CAIXA` no mês')} no consolidado, em ${pl(dias, 'dia com movimento', 'dias com movimento')}; sem título de previsão, porque ${NOME_DO_MES} é mês fechado; ${pl(bancos.length, 'bloco de banco', 'blocos de banco')}, ${fecham} em que o saldo corrido anda exatamente com o movimento, ${pl(nNaoBaixado, 'linha que o saldo já desconta e não está baixada', 'linhas que o saldo já desconta e não estão baixadas')} e ${pl(nDepoisDoSaldo, 'banco em que a planilha lançou depois de parar de escrever o saldo', 'bancos em que a planilha lançou depois de parar de escrever o saldo')}; a ponte com os bancos ${ponteFecha ? 'fecha sem sobra' : 'não fecha'}`,
    estado: MOTIVO_DFC ? 'a-conferir' : (rDia.vazio ? 'a-conferir' : (rDia.ok && ponteFecha ? 'conferido' : (rDia.ok ? 'a-conferir' : 'divergente'))),
    motivo: MOTIVO_DFC ? `a fonte do consolidado é o DFC e as planilhas não foram lidas nesta rodada — ${MOTIVO_DFC}`
      : (rDia.vazio ? 'nenhuma linha no mês, então não há caso real para conferir'
        : (!rDia.ok ? `a linha do DFC não conferiu: ${rDia.dif.join('; ')}`
          : (ponteFecha ? null : `a ponte com os bancos não fecha em ${NOME_DO_MES}: em ${bancos.length - fecham} de ${bancos.length} blocos o saldo corrido da planilha PULA — ele anda por um valor diferente do movimento da linha —, e sem essa coluna mantida não há com o que comparar a posição de caixa. O valor da sobra sai só no terminal, em \`node scripts/diagnostico-dia-a-dia.mjs --mes ${MES} --saldos\``))),
    caso: MOTIVO_DFC || rDia.vazio ? '' : `${textoDoCasoDfc(rDia)}; e a ponte com os bancos, banco por banco: ${bancos.map((b) => `${b.banco ?? 'sem nome'} (abertura na linha ${b.linhaAbertura}, último saldo escrito na linha ${b.linhaFinal ?? '—'}, ${b.semSaldoEscrito ? 'nenhum saldo escrito' : b.fecha ? 'o saldo anda com o movimento' : `${b.desvios} pulo(s) do saldo`}${(b.depoisDoUltimoSaldo ?? 0) !== 0 ? ', com lançamento depois do último saldo escrito' : ''})`).join(', ')}`,
  });
}

// ================================================================ a trava do mês conferido
//
// O QUE ELA GUARDA, E POR QUE ELA E NÃO A DE JAN–SET. A conferência caso a caso relê a fonte pelo caminho de trás,
// mas relê o MESMO cache que o cálculo leu: se o dono mexeu num lançamento de agosto e a releitura de hora em hora o
// trouxe mexido, os dois lados leem o valor novo e batem — a divergência passa. A trava fecha essa porta: o que agosto
// de 2026 deu quando foi conferido fica FIXADO em `docs/trava-agosto-2026.json`, que entra no git, e toda rodada
// compara com ele antes de gravar qualquer coisa.
//
// São três coisas, e nenhuma delas é valor em dinheiro:
//   baldes   → os três baldes de agosto (títulos, baixas de parcial, avulsos) por empresa e natureza;
//   tela-3   → as faixas de agosto da Tela 3 (na tela, pago, atrasado, em aberto, e a sobra de status);
//   digitais → o sha1 dos campos de cadastro de TODOS os lançamentos de agosto, por empresa e natureza e na Tela 3;
//   casos    → a identidade de cada caso real que a página confere: o código e os campos de cadastro que o filtro usou.
//
// As digitais pegam qualquer lançamento de agosto que mude, mesmo sem mudar contagem; os casos dizem, em português, o
// que mudou naqueles que a página cita. Uma coisa sem a outra deixa buraco: o filtro só exclui o `CANCELADO`, então um
// `cStatus` que vira outro não mexe em nenhuma contagem.
//
// Lançamento novo com data de um mês ANTERIOR não mexe em nada disto, e é justamente o que passou a acontecer toda
// hora. Lançamento novo com data de AGOSTO, ou um lançamento de agosto que mudou de status, de conta, de categoria ou
// de data, mexe — e aí o script para. Refixar é dizer, na mão, que a mudança é de propósito: `--refazer-trava`.
//
// Fora de agosto de 2026 (`--mes 7`, outro ano) não há o que comparar: a trava não vale e a rodada segue.

// A IMPRESSÃO DIGITAL DO MÊS: o sha1 dos campos de cadastro de TODOS os lançamentos do mês, e não só dos casos
// escolhidos. Os casos dão o diff legível ("este título mudou de status"); a digital fecha o resto — um lançamento
// qualquer de agosto que mude de `cStatus`, de conta corrente, de categoria, de origem ou de data muda a digital do
// lado dele, mesmo que a contagem não mude (o filtro só deixa de fora o `CANCELADO`). Só campo de cadastro entra aqui:
// nenhum valor em dinheiro, nenhum nome.
const identidadeCrua = (emp, d) => {
  const eTitulo = d.cGrupo === 'CONTA_A_PAGAR' || d.cGrupo === 'CONTA_A_RECEBER';
  return [emp, eTitulo ? d.nCodTitulo : d.nCodMovCC, d.cGrupo, d.cNatureza, d.cStatus, d.nCodCC,
    d.cCodCateg ?? '', d.cOrigem ?? '', d.dDtPagamento].join('|');
};
const digitalDe = (linhas) => ({
  lancamentos: linhas.length,
  digital: crypto.createHash('sha1').update(linhas.slice().sort().join('\n')).digest('hex').slice(0, 12),
});

const travaDaRodada = {
  mes: `${MES2}/${ANO}`,
  'o-que-e': 'o que agosto de 2026 deu na leitura abaixo. scripts/numeros-das-telas.mjs compara com isto antes de gravar e para se algo mudou; refixar é --refazer-trava. Só contagem e campo de cadastro: nenhum valor em dinheiro, nenhum nome.',
  'da-leitura': { id: CARIMBO.id, gravadoEm: CARIMBO.gravadoEm, okEm: CARIMBO.okEm, paginas: CARIMBO.paginas, arquivos: CARIMBO.arquivos },
  baldes: Object.fromEntries(EMPRESAS.map((e) => [e, { R: trinca(MES_R[e]), P: trinca(MES_P[e]) }])),
  'tela-3': {
    'na-tela': t3Total(T3_NA_TELA), pago: t3Total(T3_PAGO), atrasado: t3Total(T3_ATRASADO),
    aberto: t3Total(T3_ABERTO), 'fora-das-faixas': t3Total(T3_OUTRO),
  },
  digitais: {
    ...Object.fromEntries(EMPRESAS.flatMap((e) => [
      [`empresa-${e}-entradas`, digitalDe(MES_R[e].todos.map((d) => identidadeCrua(e, d)))],
      [`empresa-${e}-saidas`, digitalDe(MES_P[e].todos.map((d) => identidadeCrua(e, d)))],
    ])),
    'tela-3': digitalDe(EMPRESAS.flatMap((e) => T3_NA_TELA[e].map((t) => {
      const c = t.cabecTitulo ?? {};
      return [e, c.nCodTitulo, c.cNatureza, c.cStatus, c.nCodCC, c.cCodCateg ?? '', c.dDtVenc].join('|');
    }))),
  },
  casos: [...CASOS_DO_MES].sort(),
};

const TRAVA_VALE = ANO === 2026 && MES === 8;
const fixada = TRAVA_VALE && fs.existsSync(TRAVA_MES) ? JSON.parse(fs.readFileSync(TRAVA_MES, 'utf8')) : null;
const GRAVAR_TRAVA = TRAVA_VALE && (REFAZER_TRAVA || !fixada);
let TRAVA_TEXTO;

if (!TRAVA_VALE) {
  TRAVA_TEXTO = `esta rodada é de ${NOME_DO_MES} de ${ANO}, e a trava vale só para agosto de 2026 — nada foi comparado`;
} else if (GRAVAR_TRAVA) {
  TRAVA_TEXTO = fixada
    ? `refixada nesta rodada (\`--refazer-trava\`), nesta leitura: ${CARIMBO_TEXTO}`
    : `fixada nesta rodada pela primeira vez, nesta leitura: ${CARIMBO_TEXTO}`;
} else {
  const dif = [];
  for (const emp of EMPRESAS) {
    for (const nat of ['R', 'P']) {
      const meu = travaDaRodada.baldes[emp][nat], fix = fixada.baldes?.[String(emp)]?.[nat] ?? [];
      if (!igual(meu, fix)) dif.push(`empresa ${emp}, ${nat === 'R' ? 'entradas' : 'saídas'} de ${NOME_DO_MES}: esta leitura dá ${meu.join(' + ')} e a trava fixou ${fix.join(' + ')}`);
    }
  }
  for (const [faixa, quantos] of Object.entries(travaDaRodada['tela-3'])) {
    const fix = fixada['tela-3']?.[faixa];
    if (quantos !== fix) dif.push(`Tela 3, faixa "${faixa}" de ${NOME_DO_MES}: esta leitura dá ${quantos} e a trava fixou ${fix}`);
  }
  for (const [onde, meu] of Object.entries(travaDaRodada.digitais)) {
    const fix = fixada.digitais?.[onde];
    if (!fix) { dif.push(`a trava não tem a impressão digital de "${onde}" — ela foi fixada antes de a digital existir; refixe`); continue; }
    if (fix.digital === meu.digital && fix.lancamentos === meu.lancamentos) continue;
    dif.push(`"${onde}" de ${NOME_DO_MES}: esta leitura tem ${meu.lancamentos} lançamentos com impressão digital ${meu.digital}, e a trava fixou ${fix.lancamentos} com ${fix.digital}${fix.lancamentos === meu.lancamentos ? ' — a contagem é a mesma, então o que mudou é campo de cadastro (`cStatus`, `nCodCC`, `cCodCateg`, `cOrigem` ou a data) de algum lançamento do mês' : ''}`);
  }
  const fixCasos = new Set(fixada.casos ?? []);
  for (const c of travaDaRodada.casos) if (!fixCasos.has(c)) dif.push(`caso real que esta leitura confere e a trava não tem: ${c}`);
  for (const c of fixCasos) if (!CASOS_DO_MES.has(c)) dif.push(`caso real que a trava fixou e esta leitura não achou: ${c}`);
  if (dif.length) {
    falhar([
      `TRAVA DE AGOSTO DE 2026 (docs/trava-agosto-2026.json): ${dif.length} coisa(s) que a trava fixou mudaram nesta leitura. Não gravo nada.`,
      ...dif.map((d) => `  - ${d}`),
      `A trava foi fixada na leitura ${fixada['da-leitura']?.id ?? '(sem carimbo)'} e esta é a ${CARIMBO.id}.`,
      'Se a mudança é de propósito — o dono lançou ou corrigiu algo com data de agosto de 2026 —, refixe na mão:',
      '  node scripts/numeros-das-telas.mjs --refazer-trava',
    ].join('\n'));
  }
  TRAVA_TEXTO = `conferida: os três baldes das duas empresas, as faixas da Tela 3, os ${travaDaRodada.casos.length} casos reais de ${NOME_DO_MES} e a impressão digital dos campos de cadastro dos ${Object.values(travaDaRodada.digitais).reduce((s, d) => s + d.lancamentos, 0)} lançamentos do mês são os mesmos que \`docs/trava-agosto-2026.json\` fixou na leitura \`${fixada['da-leitura']?.id ?? '(sem carimbo)'}\``;
}

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

const linhaTravaMd = (c) => `| ${c.rotulo} | ${c.meu.join(', ')} | ${c.ref.join(', ')} | ${c.bate ? 'sim' : '**não** — a releitura mexeu'} |`;

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
em reais ficam em \`docs/confronto-dfc-omie.html\`, que não é gerado por este script e **não entra no git**: é uma
página local, gerada neste computador por [\`scripts/confronto-dfc-omie.mjs\`](../scripts/confronto-dfc-omie.mjs) e
coberta pelo \`.gitignore\` — por isso o nome dela aqui não é link, que daqui não abriria. Nome de
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

## De que leitura são estes números

Esta rodada leu o cache do Omie assim: **${CARIMBO_TEXTO}**. Tudo nesta página sai dessa leitura. As contagens de
janeiro a setembro, abaixo, também — e a MESMA rodada as escreveu no bloco gerado de
[\`docs/fontes.md\`](fontes.md): o documento e esta página nunca podem ficar em leituras diferentes, porque quem grava
os dois é a mesma passagem do script.

**A trava do mês conferido.** ${TRAVA_TEXTO}. O que ela fixa está em
[\`docs/trava-agosto-2026.json\`](trava-agosto-2026.json), que entra no git: os três baldes de ${NOME_DO_MES} por
empresa e natureza, as faixas de ${NOME_DO_MES} da Tela 3, a identidade de cada caso real desta página (o código e os
campos de cadastro que o filtro usou) e a impressão digital dos campos de cadastro de **todos** os lançamentos do mês —
que pega um \`cStatus\` trocado mesmo quando nenhuma contagem muda, porque o filtro só deixa de fora o \`CANCELADO\`. Se
algum deles mudar, o script para e não grava nada — refixar é na mão, com
\`--refazer-trava\`. Ela existe porque a conferência caso a caso relê o MESMO cache que o cálculo leu: se um lançamento
de ${NOME_DO_MES} mudou no Omie e a releitura o trouxe mudado, os dois lados leem o valor novo e batem. Quem pega isso
é a trava.

**As contagens de jan–set não travam nada.** O app relê o Omie de hora em hora e o Omie recebe lançamento com data
retroativa: um mês já passado muda de contagem sozinho. Comparar a contagem de agora com um número escrito à mão no
documento só fazia o script parar e pedir que alguém recontasse o documento — e nunca provou nada sobre a regra, porque
os dois lados saíam deste mesmo script. A coluna da direita mostra o que a **leitura de referência**
(${LEITURA_DE_REFERENCIA}), citada na prosa de \`docs/fontes.md\` indicador por indicador, dava: um número diferente ali
não é erro, é o que a releitura mexeu.

| o que | esta leitura (\`${CARIMBO.id}\`) | a leitura de referência (${LEITURA_DE_REFERENCIA}) | igual? |
|---|---|---|---|
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
<h2>De que leitura são estes números</h2>
<p>Esta rodada leu o cache do Omie assim: <strong>${inline(CARIMBO_TEXTO)}</strong>. Tudo nesta página sai dessa
leitura, e a mesma rodada escreveu as contagens de jan–set no bloco gerado de <a href="fontes.md">docs/fontes.md</a> —
o documento e esta página não têm como ficar em leituras diferentes.</p>
<p><strong>A trava do mês conferido.</strong> ${inline(TRAVA_TEXTO)}. O que ela fixa está em
<a href="trava-agosto-2026.json">docs/trava-agosto-2026.json</a>, que entra no git: os três baldes de ${NOME_DO_MES}
por empresa e natureza, as faixas de ${NOME_DO_MES} da Tela 3, a identidade de cada caso real desta página e a impressão
digital dos campos de cadastro de todos os lançamentos do mês. Se algum
deles mudar, o script para e não grava nada. Ela existe porque a conferência caso a caso relê o MESMO cache que o
cálculo leu: um lançamento que mudou no Omie e voltou mudado na releitura bate dos dois lados — quem pega isso é a
trava.</p>
<p><strong>As contagens de jan–set não travam nada.</strong> O app relê o Omie de hora em hora e o Omie recebe
lançamento com data retroativa: um mês já passado muda de contagem sozinho. A coluna da direita mostra o que a leitura
de referência (${LEITURA_DE_REFERENCIA}), citada na prosa do documento, dava — um número diferente ali é o que a
releitura mexeu, não um erro.</p>
<div class="tabela"><table><thead><tr><th>o que</th><th>esta leitura (<code>${esc(CARIMBO.id)}</code>)</th><th>a leitura de referência (${LEITURA_DE_REFERENCIA})</th><th>igual?</th></tr></thead><tbody>
${CONFERENCIAS_DO_FONTES.map((c) => `<tr><td>${inline(c.rotulo)}</td><td>${c.meu.join(', ')}</td><td>${c.ref.join(', ')}</td><td>${c.bate ? 'sim' : '<strong>não</strong> — a releitura mexeu'}</td></tr>`).join('\n')}
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

// AS CONTAGENS DE JAN–SET VÃO PARA `docs/fontes.md`, num bloco gerado entre marcas.
//
// POR QUE ESCREVER NO DOCUMENTO, E NÃO CONFERIR CONTRA ELE. O que a trava antiga queria garantir é que o número
// publicado no documento e o da página fossem da mesma leitura. Comparar não garante isso — só avisa quando já
// divergiram, e desde que o app relê o Omie de hora em hora isso passou a acontecer sozinho. Escrever garante: a mesma
// passagem do script grava os dois, na mesma leitura, com o mesmo carimbo. O que está no documento FORA das marcas é
// prosa do dono e história, e este script não toca nela.
const blocoDoFontes = `${MARCA_INICIO}
### As contagens de jan–set desta leitura (bloco gerado — não edite à mão)

Escrito por [\`scripts/numeros-das-telas.mjs\`](../scripts/numeros-das-telas.mjs) a cada rodada da conferência, na mesma
passagem que grava [\`docs/conferencia.md\`](conferencia.md) — as contagens daqui e as de lá são sempre da mesma leitura
do Omie, e é assim que este documento e aquela página não têm como discordar.

**De que leitura são as contagens desta tabela:** ${CARIMBO_TEXTO}.

**De que leitura são as contagens escritas em PROSA neste documento:** da leitura de ${LEITURA_DE_REFERENCIA} — a
leitura de referência. Elas são história e ficam como estão; a coluna da direita repete cada uma ao lado da contagem de
agora. Uma diferença não é erro: o app relê o Omie de hora em hora e o Omie recebe lançamento com data retroativa, então
um mês já passado muda de contagem sozinho. Quem trava o que não pode mudar é
[\`docs/trava-agosto-2026.json\`](trava-agosto-2026.json), que fixa agosto de 2026 — os baldes do mês, as faixas da
Tela 3, a identidade de cada caso real conferido e a impressão digital dos campos de cadastro de todos os lançamentos
do mês.

| o que | esta leitura (\`${CARIMBO.id}\`) | a leitura de referência (${LEITURA_DE_REFERENCIA}) | igual? |
|---|---|---|---|
${CONFERENCIAS_DO_FONTES.map(linhaTravaMd).join('\n')}

${MARCA_FIM}`;

{
  const fontes = fs.readFileSync(FONTES, 'utf8');
  const i = fontes.indexOf(MARCA_INICIO), f = fontes.indexOf(MARCA_FIM);
  if (i < 0 || f < 0 || f < i) falhar(`não achei as marcas ${MARCA_INICIO} e ${MARCA_FIM} em docs/fontes.md — é entre elas que as contagens de jan–set são publicadas.`);
  for (const [re, oQue] of PROIBIDO) {
    const m = re.exec(blocoDoFontes);
    if (m) falhar(`GUARDA (fontes.md): o bloco gerado tem ${oQue} ("${m[0]}").`);
  }
  const novo = fontes.slice(0, i) + blocoDoFontes + fontes.slice(f + MARCA_FIM.length);
  if (novo !== fontes) fs.writeFileSync(FONTES, novo, 'utf8');
}

// A trava do mês só é gravada quando é para fixar (primeira vez ou `--refazer-trava`); quando só confere, nada muda.
if (GRAVAR_TRAVA) {
  const texto = `${JSON.stringify(travaDaRodada, null, 2)}\n`;
  for (const [re, oQue] of PROIBIDO) {
    const m = re.exec(texto);
    if (m) falhar(`GUARDA (trava): o arquivo ia sair com ${oQue} ("${m[0]}").`);
  }
  fs.writeFileSync(TRAVA_MES, texto, 'utf8');
}

const semMarca = (s) => String(s).replace(/[`*]/g, '');
console.log(`${NOME_DO_MES} de ${ANO}: ${indicadores.length} indicadores — ${quantos('conferido')} conferidos, ${quantos('divergente')} divergentes, ${quantos('a-conferir')} a conferir.`);
console.log(`leitura do Omie: ${semMarca(CARIMBO_TEXTO)}`);
console.log(`trava de agosto de 2026: ${semMarca(TRAVA_TEXTO)}`);
console.log(`contagens de jan–set desta leitura (a de referência é a leitura de ${LEITURA_DE_REFERENCIA}):`);
for (const c of CONFERENCIAS_DO_FONTES) console.log(`  ${c.bate ? 'igual ' : 'MUDOU '} ${semMarca(c.rotulo)}: ${c.meu.join(', ')} (referência: ${c.ref.join(', ')})`);
for (const i of indicadores.filter((x) => x.estado !== 'conferido')) console.log(`  ${ROTULO[i.estado]}${i.tela} — ${i.nome}: ${i.motivo}`);
console.log(`gravados ${path.relative(RAIZ, SAIDA_MD)}, ${path.relative(RAIZ, SAIDA_HTML)} e o bloco de jan–set em ${path.relative(RAIZ, FONTES)}${GRAVAR_TRAVA ? `; trava fixada em ${path.relative(RAIZ, TRAVA_MES)}` : ''}`);
