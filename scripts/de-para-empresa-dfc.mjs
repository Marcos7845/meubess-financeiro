// O DE-PARA DA COLUNA `EMP.` DO DFC COM AS EMPRESAS DO OMIE — o cruzamento que responde se `B3W` e `N3` são as
// filiais `/0001-42` e `/0002-23`.
//
// POR QUE EXISTE. A coluna `EMP.` (A) do `FLUXO DE CAIXA` tem `B3W` em todos os meses e `N3` a partir de agosto, e
// `docs/fontes.md` registra que NADA na planilha diz qual `EMP.` é qual empresa do Omie. Sem esse de-para o filtro de
// empresa das três telas não pode recortar o lado do DFC. Este script descobre o de-para pelo único caminho que existe
// sem perguntar ao dono: cruzar lançamento por lançamento, pelos campos que os dois lados têm em comum — DATA, VALOR e
// o NOME do cliente/fornecedor.
//
// SÓ LEITURA. Lê as planilhas pela mesma interface do app (`lib/regras/dfc-fonte.mjs`) e o cache do Omie já gravado;
// não escreve em arquivo nenhum, nem no Omie, nem nas planilhas. Imprime CONTAGEM, CÓDIGO e DATA — nunca valor em
// dinheiro, e o nome do cliente/fornecedor sai mascarado: ele é comparado em memória e não é impresso inteiro.
//
// COMO O CRUZAMENTO É FEITO, em dois níveis:
//
//   NÍVEL 1 — data + valor. Para cada linha do `FLUXO DE CAIXA` já baixada e com `DIA PG` no mês do arquivo, procura
//   nos lançamentos do Omie do mesmo dia com o mesmo valor em centavos, em cada empresa, dentro do recorte da MeuBESS
//   e pelos mesmos três baldes das telas (`lib/regras/movimentos.mjs`). Data e valor sozinhos casam por acaso — duas
//   contas do mesmo dia e do mesmo valor —, e é por isso que há o nível 2.
//
//   NÍVEL 2 — data + valor + NOME do cliente/fornecedor. Dos candidatos do nível 1, fica o que tem o mesmo nome da
//   coluna `FORNECEDOR / CLIENTE`, comparado com o nome do cadastro `geral/clientes` da empresa, sem acento, em
//   maiúscula e sem as palavras de forma jurídica (LTDA, ME, EIRELI…). O casamento é ESTRITO: dois pedaços de nome em
//   comum, um pedaço de 8 letras ou mais, ou um nome inteiro dentro do outro.
//
// O QUE O RESULTADO QUER DIZER. Se um rótulo de `EMP.` só casar com uma das empresas, ele É aquela empresa e o de-para
// fecha. Se casar com as duas, no mesmo mês e no mesmo dia, o rótulo não é a filial do Omie — e então o DFC não é
// filtrável por empresa, e as três telas têm de dizer isso ao lado de cada número que sai dele.
//
//   node scripts/de-para-empresa-dfc.mjs
//   node scripts/de-para-empresa-dfc.mjs --ano 2026

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { abrirCacheOmie } from '../lib/regras/cache-omie.mjs';
import { lerRecorte, criarRegras, valorOmie } from '../lib/regras/movimentos.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { norm, cent } from '../lib/regras/dfc.mjs';
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula, BAIXADO } from '../lib/regras/xlsx.mjs';
import { noMesDe, dois, NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const ANO = Number(arg('--ano', '2026'));
// O MÊS DO CASO: de qual mês sai o par de linhas que serve de prova. Agosto, o mês conferido
// (`docs/trava-agosto-2026.json`), como em `scripts/conferir-filtros.mjs`.
const MES = Number(arg('--mes', '8'));
const EMPRESAS = ['1', '2'];

// ================================================================ o nome, dos dois lados
//
// Formas jurídicas e palavras de ramo não distinguem ninguém: duas empresas diferentes as dividem. Ficam fora da
// comparação para que "X COMERCIO LTDA" não case com "Y COMERCIO LTDA".
const PARADA = new Set(['LTDA', 'ME', 'MEI', 'EIRELI', 'SA', 'EPP', 'CIA', 'GRUPO',
  'DE', 'DA', 'DO', 'DOS', 'DAS', 'COMERCIO', 'SERVICOS', 'CONSULTORIA', 'BRASIL', 'NACIONAL']);
const limpo = (s) => norm(s).replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const pedacos = (s) => limpo(s).split(' ').filter((t) => t.length >= 4 && !PARADA.has(t));
// ESTRITO: dois pedaços em comum, um pedaço de 8+ letras, ou um nome inteiro dentro do outro.
function mesmoNome(a, b) {
  const la = limpo(a), lb = limpo(b);
  if (!la || !lb) return false;
  if (la.length >= 8 && (lb.includes(la) || la.includes(lb))) return true;
  const pa = pedacos(a), pb = pedacos(b);
  const comuns = pa.filter((t) => pb.includes(t));
  return comuns.length >= 2 || comuns.some((t) => t.length >= 8);
}
// O nome nunca é impresso inteiro: só as três primeiras letras e o tamanho.
const mascara = (s) => { const l = limpo(s); return l ? `${l.slice(0, 3)}… (${l.length} letras)` : '(vazio)'; };

// ================================================================ o lado do DFC
//
// As mesmas colunas que `lib/regras/dfc.mjs` lê, achadas pelo NOME no cabeçalho (que se repete, um bloco por banco), e
// mais três que só este cruzamento usa: `EMP.` (A), `FORNECEDOR / CLIENTE` (G) e `TITULO` (H).
async function linhasDoDfc(fonte) {
  const nomes = await fonte.arquivos();
  const fora = [];
  for (let mes = 1; mes <= 12; mes++) {
    const arq = nomes.find((f) => new RegExp(`^0?${mes}\\s*-`).test(f));
    if (!arq) continue;
    const zip = lerZip(await fonte.ler(arq));
    const ss = sharedStrings(zip);
    const aba = abasDo(zip).find((a) => norm(a.nome) === 'FLUXO DE CAIXA');
    if (!aba) continue;
    let mapa = null;
    for (const l of lerAba(zip, aba.parte, ss)) {
      const textos = [...l.cel.entries()].filter(([, c]) => c.t);
      const rotulos = textos.map(([, c]) => norm(c.t));
      if (rotulos.includes('VENCIMENTO') && rotulos.includes('DIA PG')) { mapa = new Map(textos.map(([col, c]) => [norm(c.t), col])); continue; }
      if (!mapa) continue;
      const texto = (r) => { const c = l.cel.get(mapa.get(r)); return c?.t ? c.t.trim() : ''; };
      const numero = (r) => { const c = l.cel.get(mapa.get(r)); return c?.v !== undefined ? c.v : 0; };
      const k = numero('ENTRADA'), s = numero('SAIDA');
      const bruto = cent(k) !== 0 ? k : s;
      const dt = dataDaCelula(l.cel.get(mapa.get('DIA PG')));
      fora.push({
        mes, arquivo: arq, linha: l.n,
        emp: texto('EMP.') || '(vazio)',
        data: dt ? `${dois(dt.d)}/${dois(dt.m)}/${dt.a}` : null,
        noMes: Boolean(dt) && dt.a === ANO && dt.m === mes,
        valor: Math.abs(cent(bruto)),
        nome: texto('FORNECEDOR / CLIENTE'),
        baixada: BAIXADO(norm(texto('PAGAMENTO'))),
      });
    }
  }
  return fora;
}

// ================================================================ o lado do Omie
//
// Os mesmos três baldes das telas, mês a mês, empresa a empresa, dentro do recorte da MeuBESS — a mesma base que
// `docs/conferencia.md` confere. Indexados por dia + valor, que é a chave do nível 1.
function indiceDoOmie(OMIE, recorte) {
  const { contar } = criarRegras({ movimentos: OMIE.movimentos, categorias: OMIE.categorias, recorte });
  const idx = {};
  for (const emp of EMPRESAS) {
    idx[emp] = new Map();
    for (let mes = 1; mes <= 12; mes++) {
      const noMes = noMesDe(ANO, mes);
      for (const nat of ['R', 'P']) {
        for (const d of contar(emp, noMes, nat).todos) {
          const k = `${d.dDtPagamento}|${Math.abs(valorOmie(d))}`;
          if (!idx[emp].has(k)) idx[emp].set(k, []);
          idx[emp].get(k).push({
            emp, grupo: d.cGrupo, titulo: String(d.nCodTitulo ?? '0'), mov: String(d.nCodMovCC ?? '0'),
            categoria: String(d.cCodCateg ?? ''),
            nome: OMIE.clientes[emp]?.nomes?.get(String(d.nCodCliente)) ?? null,
          });
        }
      }
    }
  }
  return idx;
}

// ================================================================ o cruzamento

const fonte = fonteDoDfc();
if (!fonte.disponivel()) { console.error(fonte.descrever()); process.exit(1); }
const OMIE = abrirCacheOmie({ raiz: RAIZ, ano: ANO });
const recorte = lerRecorte(RAIZ);
const idx = indiceDoOmie(OMIE, recorte);
const dfc = await linhasDoDfc(fonte);

const cruzaveis = dfc.filter((x) => x.valor !== 0 && x.baixada && x.noMes);
const rotulos = [...new Set(dfc.map((x) => x.emp))].sort();

console.log(`== A COLUNA \`EMP.\` DO DFC CONTRA AS EMPRESAS DO OMIE — ${ANO} ==`);
console.log(`cache do Omie: ${OMIE.carimbo.id} (${OMIE.carimbo.arquivos} arquivos) · DFC: ${fonte.nome}`);
console.log(`linhas do FLUXO DE CAIXA: ${dfc.length}; cruzáveis (baixadas e com DIA PG no mês do arquivo): ${cruzaveis.length}`);
console.log(`lançamentos do Omie no recorte da MeuBESS: ${EMPRESAS.map((e) => `empresa ${e}: ${[...idx[e].values()].reduce((s, x) => s + x.length, 0)}`).join(' · ')}`);
console.log('');

const conta = new Map();
const soma = (rot, nivel, onde) => {
  const k = `${rot}|${nivel}|${onde}`;
  conta.set(k, (conta.get(k) ?? 0) + 1);
};
const exemplos = new Map();

for (const x of cruzaveis) {
  const k = `${x.data}|${x.valor}`;
  const c = { 1: idx['1'].get(k) ?? [], 2: idx['2'].get(k) ?? [] };
  const d1 = c[1].length > 0, d2 = c[2].length > 0;
  soma(x.emp, 'data+valor', d1 && d2 ? 'nas duas' : (d1 ? 'só empresa 1' : (d2 ? 'só empresa 2' : 'em nenhuma')));
  const p = { 1: c[1].filter((y) => mesmoNome(x.nome, y.nome)), 2: c[2].filter((y) => mesmoNome(x.nome, y.nome)) };
  const m1 = p[1].length > 0, m2 = p[2].length > 0;
  const onde = m1 && m2 ? 'nas duas' : (m1 ? 'só empresa 1' : (m2 ? 'só empresa 2' : 'em nenhuma'));
  soma(x.emp, '+nome', onde);
  // UM CASO DE CADA RÓTULO EM CADA EMPRESA, para a prova poder ser reconferida um a um no Omie. O do MÊS DO CASO tem
  // precedência: a prova mais forte é a de duas linhas do mesmo rótulo, no mesmo mês, casando em empresas diferentes.
  for (const emp of EMPRESAS) {
    const chave = `${x.emp}|${emp}`;
    const tem = exemplos.get(chave);
    if (onde !== `só empresa ${emp}`) continue;
    if (!tem || (tem.x.mes !== MES && x.mes === MES)) exemplos.set(chave, { x, y: p[emp][0] });
  }
}

for (const rot of rotulos) {
  const linhas = cruzaveis.filter((x) => x.emp === rot).length;
  if (!linhas) continue;
  console.log(`-- EMP. = ${rot} — ${linhas} linhas cruzáveis (${dfc.filter((x) => x.emp === rot).length} no arquivo)`);
  for (const nivel of ['data+valor', '+nome']) {
    const partes = ['só empresa 1', 'só empresa 2', 'nas duas', 'em nenhuma']
      .map((onde) => `${onde}: ${conta.get(`${rot}|${nivel}|${onde}`) ?? 0}`);
    console.log(`   ${nivel.padEnd(10)} ${partes.join(' · ')}`);
  }
  for (const emp of EMPRESAS) {
    const e = exemplos.get(`${rot}|${emp}`);
    if (!e) continue;
    console.log(`   caso na empresa ${emp}: ${NOMES_DOS_MESES[e.x.mes]}, linha ${e.x.linha} do FLUXO DE CAIXA, `
      + `DIA PG ${e.x.data}, nome ${mascara(e.x.nome)} -> ${e.y.grupo} `
      + `${e.y.titulo !== '0' ? `título ${e.y.titulo}` : `movimento ${e.y.mov}`}, categoria ${e.y.categoria}`);
  }
  console.log('');
}

// ================================================================ o veredito
const fecha = [];
for (const rot of rotulos) {
  if (!cruzaveis.some((x) => x.emp === rot)) continue;
  const so1 = conta.get(`${rot}|+nome|só empresa 1`) ?? 0;
  const so2 = conta.get(`${rot}|+nome|só empresa 2`) ?? 0;
  if (so1 === 0 && so2 === 0) {
    console.log(`SEM RESPOSTA: EMP. = ${rot} — nenhuma das ${cruzaveis.filter((x) => x.emp === rot).length} linhas `
      + 'cruzáveis achou par no Omie, então este rótulo não diz nada sobre empresa.');
    continue;
  }
  const uma = (so1 > 0 && so2 === 0) ? '1' : ((so2 > 0 && so1 === 0) ? '2' : null);
  fecha.push({ rot, so1, so2, uma });
  console.log(uma
    ? `DE-PARA: EMP. = ${rot} é a empresa ${uma} — ${so1 + so2} linhas casadas, todas nela.`
    : `DE-PARA NÃO FECHA: EMP. = ${rot} casa com as DUAS empresas — ${so1} só na 1 e ${so2} só na 2.`);
}
console.log('');
console.log(fecha.length && fecha.every((f) => f.uma)
  ? 'Conclusão: o DFC é filtrável por empresa pelo rótulo de EMP.'
  : 'Conclusão: a coluna EMP. NÃO é a filial do Omie. O DFC não é filtrável por empresa, e as três telas dizem isso ao lado de cada número que sai dele.');
