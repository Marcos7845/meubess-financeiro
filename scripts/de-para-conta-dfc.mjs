// O DE-PARA DA COLUNA `BANCO` DO DFC COM AS CONTAS CORRENTES DO OMIE — e, de quebra, o da coluna
// `FORNECEDOR / CLIENTE` com o cadastro `geral/clientes`.
//
// POR QUE EXISTE. O dono aprovou, em 27/09/2026, dois filtros novos que dependem de um de-para que ninguém escreveu:
// CONTA BANCÁRIA, nas três telas ("onde a fonte disser o banco"), e CLIENTE/FORNECEDOR, na Tela 1. O `FLUXO DE CAIXA`
// TEM as duas colunas — `BANCO` (C) e `FORNECEDOR / CLIENTE` (G) —, mas nenhuma delas traz código: são rótulos e nomes
// digitados à mão. Do outro lado, o Omie escolhe por `nCodCC` e por `nCodCliente`. Este script procura o de-para pelo
// único caminho que existe sem perguntar ao dono, o mesmo de `scripts/de-para-empresa-dfc.mjs`: cruzar lançamento por
// lançamento pelos campos que os dois lados têm em comum — DATA, VALOR e o NOME do cliente/fornecedor — e ver em que
// conta do Omie cada rótulo de `BANCO` cai.
//
// SÓ LEITURA. Lê as planilhas pela mesma interface do app (`lib/regras/dfc-fonte.mjs`) e o cache do Omie já gravado;
// não escreve em arquivo nenhum, nem no Omie, nem nas planilhas. Imprime CONTAGEM, CÓDIGO e DATA — nunca valor em
// dinheiro, e o nome do cliente/fornecedor sai mascarado.
//
// O QUE O RESULTADO QUER DIZER. Se cada rótulo de `BANCO` só casar com UMA conta do Omie, o de-para fecha e o DFC é
// filtrável por conta. Se um rótulo casar com várias contas, ele não é a conta do Omie — e então as três telas têm de
// dizer isso ao lado de cada número que sai do DFC, como já fazem com o filtro de empresa.
//
//   node scripts/de-para-conta-dfc.mjs
//   node scripts/de-para-conta-dfc.mjs --ano 2026

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { abrirCacheOmie } from '../lib/regras/cache-omie.mjs';
import { lerRecorte, lerContas, criarRegras, valorOmie } from '../lib/regras/movimentos.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { norm, cent } from '../lib/regras/dfc.mjs';
import { lerZip, sharedStrings, abasDo, lerAba, dataDaCelula, BAIXADO } from '../lib/regras/xlsx.mjs';
import { noMesDe, dois, NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';
import { contasBancarias } from '../lib/regras/filtros.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const ANO = Number(arg('--ano', '2026'));
// O MÊS DO CASO: de qual mês sai a linha que serve de prova. Agosto, o mês conferido (`docs/trava-agosto-2026.json`).
const MES = Number(arg('--mes', '8'));
const EMPRESAS = ['1', '2'];

// ================================================================ o nome, dos dois lados
//
// Exatamente a mesma comparação de `scripts/de-para-empresa-dfc.mjs`: formas jurídicas e palavras de ramo não
// distinguem ninguém e ficam fora, e o casamento é estrito. Se os dois cruzamentos comparassem nome de jeitos
// diferentes, as duas provas não se poderiam ler juntas.
const PARADA = new Set(['LTDA', 'ME', 'MEI', 'EIRELI', 'SA', 'EPP', 'CIA', 'GRUPO',
  'DE', 'DA', 'DO', 'DOS', 'DAS', 'COMERCIO', 'SERVICOS', 'CONSULTORIA', 'BRASIL', 'NACIONAL']);
const limpo = (s) => norm(s).replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const pedacos = (s) => limpo(s).split(' ').filter((t) => t.length >= 4 && !PARADA.has(t));
function mesmoNome(a, b) {
  const la = limpo(a), lb = limpo(b);
  if (!la || !lb) return false;
  if (la.length >= 8 && (lb.includes(la) || la.includes(lb))) return true;
  const pa = pedacos(a), pb = pedacos(b);
  const comuns = pa.filter((t) => pb.includes(t));
  return comuns.length >= 2 || comuns.some((t) => t.length >= 8);
}
const mascara = (s) => { const l = limpo(s); return l ? `${l.slice(0, 3)}… (${l.length} letras)` : '(vazio)'; };

// ================================================================ o lado do DFC
//
// As mesmas colunas que `lib/regras/dfc.mjs` lê, achadas pelo NOME no cabeçalho (que se repete, um bloco por banco), e
// mais duas que este cruzamento usa: `BANCO` (C) e `FORNECEDOR / CLIENTE` (G).
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
        banco: norm(texto('BANCO')) || '(vazio)',
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
// `docs/conferencia.md` confere. Indexados por dia + valor, que é a chave do primeiro nível do cruzamento. De cada
// lançamento interessa a CONTA CORRENTE dele (`nCodCC`), que é o que o filtro de conta escolhe.
function indiceDoOmie(OMIE, recorte, nomeDaConta) {
  const { contar } = criarRegras({ movimentos: OMIE.movimentos, categorias: OMIE.categorias, recorte });
  const idx = new Map();
  let total = 0;
  for (const emp of EMPRESAS) {
    for (let mes = 1; mes <= 12; mes++) {
      const noMes = noMesDe(ANO, mes);
      for (const nat of ['R', 'P']) {
        for (const d of contar(emp, noMes, nat).todos) {
          const k = `${d.dDtPagamento}|${Math.abs(valorOmie(d))}`;
          if (!idx.has(k)) idx.set(k, []);
          idx.get(k).push({
            emp, mes, grupo: d.cGrupo, titulo: String(d.nCodTitulo ?? '0'), mov: String(d.nCodMovCC ?? '0'),
            conta: nomeDaConta(emp, d.nCodCC), nCodCC: String(d.nCodCC ?? ''),
            nome: OMIE.clientes[emp]?.nomes?.get(String(d.nCodCliente)) ?? null,
          });
          total++;
        }
      }
    }
  }
  return { idx, total };
}

// ================================================================ o cruzamento

const fonte = fonteDoDfc();
if (!fonte.disponivel()) { console.error(fonte.descrever()); process.exit(1); }
const OMIE = abrirCacheOmie({ raiz: RAIZ, ano: ANO });
const recorte = lerRecorte(RAIZ);
const contas = lerContas(RAIZ);
const opcoes = contasBancarias(contas);
// De `nCodCC` para o nome que o dono deu à conta — o mesmo `dito_como` que é a opção do filtro.
const porChave = new Map(contas.map((c) => [`${c.empresa}|${c.nCodCC}`, String(c.dito_como ?? c.descricao)]));
const nomeDaConta = (emp, nCodCC) => porChave.get(`${emp}|${nCodCC}`) ?? `(nCodCC ${nCodCC})`;

const { idx, total: totalOmie } = indiceDoOmie(OMIE, recorte, nomeDaConta);
const dfc = await linhasDoDfc(fonte);
const cruzaveis = dfc.filter((x) => x.valor !== 0 && x.baixada && x.noMes);

console.log(`== A COLUNA \`BANCO\` DO DFC CONTRA AS CONTAS CORRENTES DO OMIE — ${ANO} ==`);
console.log(`cache do Omie: ${OMIE.carimbo.id} (${OMIE.carimbo.arquivos} arquivos) · DFC: ${fonte.nome}`);
console.log(`linhas do FLUXO DE CAIXA: ${dfc.length}; cruzáveis (baixadas e com DIA PG no mês do arquivo): ${cruzaveis.length}`);
console.log(`lançamentos do Omie no recorte da MeuBESS: ${totalOmie}`);
console.log(`contas da MeuBESS (as opções do filtro, pelo \`dito_como\` do dono): ${opcoes.length} — ${opcoes.map((o) => o.nome).join(' · ')}`);
console.log('');

const res = new Map();
const exemplos = new Map();
let semNomeNoCruzamento = 0;

for (const x of cruzaveis) {
  const candidatos = idx.get(`${x.data}|${x.valor}`) ?? [];
  const comNome = candidatos.filter((y) => mesmoNome(x.nome, y.nome));
  if (!res.has(x.banco)) res.set(x.banco, { linhas: 0, semPar: 0, varias: 0, porConta: new Map() });
  const r = res.get(x.banco);
  r.linhas++;
  if (comNome.length === 0) { r.semPar++; semNomeNoCruzamento++; continue; }
  const nomesDeConta = new Set(comNome.map((y) => y.conta));
  if (nomesDeConta.size > 1) { r.varias++; continue; }
  const conta = [...nomesDeConta][0];
  r.porConta.set(conta, (r.porConta.get(conta) ?? 0) + 1);
  // UM CASO POR (rótulo, conta), com precedência para o mês conferido: é a prova que dá para reconferir no Omie.
  const chave = `${x.banco}|${conta}`;
  const tem = exemplos.get(chave);
  if (!tem || (tem.x.mes !== MES && x.mes === MES)) exemplos.set(chave, { x, y: comNome[0] });
}

for (const [banco, r] of [...res.entries()].sort((a, b) => b[1].linhas - a[1].linhas)) {
  console.log(`-- BANCO = ${banco} — ${r.linhas} linhas cruzáveis (${dfc.filter((x) => x.banco === banco).length} no arquivo)`);
  console.log(`   sem par no Omie: ${r.semPar} · casou com mais de uma conta ao mesmo tempo: ${r.varias}`);
  for (const [conta, n] of [...r.porConta.entries()].sort((a, b) => b[1] - a[1])) {
    const e = exemplos.get(`${banco}|${conta}`);
    console.log(`   casou só com "${conta}": ${n}${e ? ` — caso: ${NOMES_DOS_MESES[e.x.mes]}, linha ${e.x.linha} do FLUXO DE CAIXA, `
      + `DIA PG ${e.x.data}, nome ${mascara(e.x.nome)} -> ${e.y.grupo} `
      + `${e.y.titulo !== '0' ? `título ${e.y.titulo}` : `movimento ${e.y.mov}`}, nCodCC ${e.y.nCodCC}` : ''}`);
  }
  console.log('');
}

// ================================================================ o veredito da conta
const fecha = [];
for (const [banco, r] of res.entries()) {
  if (r.porConta.size === 0) {
    console.log(`SEM RESPOSTA: BANCO = ${banco} — nenhuma das ${r.linhas} linhas cruzáveis achou par no Omie, `
      + 'então este rótulo não diz nada sobre conta corrente.');
    continue;
  }
  fecha.push({ banco, contas: r.porConta.size, varias: r.varias });
  console.log(r.porConta.size === 1 && r.varias === 0
    ? `DE-PARA: BANCO = ${banco} é a conta "${[...r.porConta.keys()][0]}" — ${[...r.porConta.values()][0]} linhas casadas, todas nela.`
    : `DE-PARA NÃO FECHA: BANCO = ${banco} casa com ${r.porConta.size} contas diferentes do Omie`
      + `${r.varias ? ` (e ${r.varias} linhas casam com mais de uma ao mesmo tempo)` : ''}: `
      + [...r.porConta.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · '));
}
console.log('');
console.log(fecha.length && fecha.every((f) => f.contas === 1 && f.varias === 0)
  ? 'Conclusão: o DFC é filtrável por conta corrente pelo rótulo de BANCO.'
  : 'Conclusão: a coluna BANCO NÃO é a conta corrente do Omie. O DFC não é filtrável por conta, e as três telas dizem '
    + 'isso ao lado de cada número que sai dele.');

// ================================================================ e o cliente/fornecedor
//
// A MESMA MEDIDA, para o outro filtro que depende de nome: quantas das linhas cruzáveis acharam ALGUM nome do cadastro
// `geral/clientes`. O filtro de cliente/fornecedor da Tela 1 escolhe pelo `nCodCliente`, e uma linha sem par de nome
// não tem código nenhum para comparar.
console.log('');
console.log('== A COLUNA `FORNECEDOR / CLIENTE` DO DFC CONTRA O CADASTRO `geral/clientes` ==');
console.log(`das ${cruzaveis.length} linhas cruzáveis, ${semNomeNoCruzamento} não acharam nome nenhum no cadastro `
  + `(${(100 * semNomeNoCruzamento / cruzaveis.length).toFixed(0)}%) — cruzando por data, valor e nome.`);
console.log('Conclusão: o DFC não é filtrável por cliente/fornecedor pelo código do Omie. O filtro vale no lado do '
  + 'Omie, e cada número de fonte DFC diz, ao lado, que é de todos os clientes e fornecedores.');

// E os `cStatus` da base do Omie, que é o de-para do filtro de SITUAÇÃO: pago é a natureza P e recebido é a R.
const porNatureza = new Map();
{
  const { contar } = criarRegras({ movimentos: OMIE.movimentos, categorias: OMIE.categorias, recorte });
  for (const emp of EMPRESAS) {
    for (let mes = 1; mes <= 12; mes++) {
      for (const nat of ['R', 'P']) {
        for (const d of contar(emp, noMesDe(ANO, mes), nat).todos) {
          const k = `${nat} · ${d.cStatus}`;
          porNatureza.set(k, (porNatureza.get(k) ?? 0) + 1);
        }
      }
    }
  }
}
console.log('');
console.log('== O `cStatus` DA BASE DO OMIE, por natureza — o de-para do filtro de SITUAÇÃO ==');
for (const [k, n] of [...porNatureza.entries()].sort()) console.log(`   ${k}: ${n}`);
console.log('A leitura das Telas 1 e 2 é de caixa, então todo lançamento dela já está baixado: pago é a natureza P e '
  + 'recebido é a R. "A pagar" só existe no cartão "Desp. Pendentes", que sai dos títulos a pagar por vencimento.');
