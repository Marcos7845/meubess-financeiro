#!/usr/bin/env node
// PROVA QUE A TRAVA DE AGOSTO PEGA UMA DIVERGÊNCIA DE VERDADE — E QUE UMA RELEITURA RETROATIVA PASSA
//
// O QUE ESTE TESTE RESPONDE. Desde que o app relê o Omie de hora em hora, o cache muda sozinho, e o Omie recebe
// lançamento com data retroativa: um mês já passado muda de contagem sem ninguém mexer em nada. A conferência não pode
// parar por isso. Mas também não pode deixar passar o contrário: agosto de 2026, que é o mês conferido, mudando por
// baixo. `docs/trava-agosto-2026.json` separa os dois casos, e este teste prova a separação, em três casos:
//
//   1. lançamento novo num mês ANTERIOR (maio)  → a conferência TEM de passar. É o que acontece de hora em hora.
//   2. o caso real de agosto que a página cita muda de `cStatus` → a conferência TEM de parar. A contagem do mês nem
//      muda (o filtro só deixa de fora o `CANCELADO`), então quem pega é a trava: a identidade do caso e a digital.
//   3. lançamento novo com data de AGOSTO → a conferência TEM de parar. Aí a contagem do mês muda também.
//
// POR QUE A TRAVA É NECESSÁRIA, E A CONFERÊNCIA CASO A CASO NÃO BASTA. A conferência caso a caso relê a fonte pelo
// caminho de trás, mas relê O MESMO CACHE que o cálculo leu. Se o lançamento mudou no Omie e a releitura o trouxe
// mudado, os dois lados leem o valor novo e batem — o caso 2 passaria batido. Só a trava, que compara com o que ficou
// fixado em arquivo versionado, pega isso.
//
// NÃO TOCA NO OMIE NEM NO CACHE DE VERDADE. Cada caso roda numa CÓPIA do cache, numa pasta temporária, apontada por
// `OMIE_CACHE_DIR` (ver `lib/regras/cache-omie.mjs`); nenhuma chamada sai para a API. Os arquivos de `docs/` que a
// conferência grava são guardados antes de cada rodada e devolvidos depois, aconteça o que acontecer — o teste não
// deixa rastro em arquivo versionado. Cada caso roda com `--sem-dfc`: o que se prova aqui é a trava do lado do Omie, e
// abrir as planilhas do DFC (biblioteca do SharePoint espelhada pelo OneDrive) não tem a ver com isso.
//
//   node scripts/testar-trava-agosto.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { abrirCacheOmie, arqCacheOmie, leiturasDe } from '../lib/regras/cache-omie.mjs';
import { lerRecorte, criarRegras } from '../lib/regras/movimentos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(RAIZ, '.cache', 'omie');
const TRAVA = path.join(RAIZ, 'docs', 'trava-agosto-2026.json');
// Os arquivos versionados que a conferência grava. O teste os devolve como estavam ao fim de cada rodada.
const TOCADOS = ['docs/conferencia.md', 'docs/conferencia.html', 'docs/fontes.md', 'docs/trava-agosto-2026.json'];

if (!fs.existsSync(CACHE)) { console.error(`não achei o cache em ${CACHE}`); process.exit(1); }
if (!fs.existsSync(TRAVA)) { console.error(`não achei ${TRAVA}; rode antes: npm run conferencia`); process.exit(1); }

// ---------------------------------------------------------------- a cópia do cache
//
// A cópia leva os arquivos da leitura e a marca da última releitura, que fica AO LADO da pasta (é de lá que o carimbo
// da leitura tira a hora). Copiar, e não ligar por atalho: o teste mexe no conteúdo dos arquivos.
function copiarCache() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'trava-agosto-'));
  const destino = path.join(base, 'omie');
  fs.mkdirSync(destino);
  for (const f of fs.readdirSync(CACHE)) fs.copyFileSync(path.join(CACHE, f), path.join(destino, f));
  const marca = path.join(RAIZ, '.cache', 'ultima-leitura-omie.json');
  if (fs.existsSync(marca)) fs.copyFileSync(marca, path.join(base, 'ultima-leitura-omie.json'));
  return destino;
}

// AS PÁGINAS DA LEITURA DE CAIXA — as de `MF`, e só elas.
//
// Achadas pela CHAVE, não pelo nome solto do arquivo: três leituras diferentes moram em `financas/mf` →
// `ListarMovimentos` (a de caixa sem `cTpLancamento`, a de `cTpLancamento: "CP"` por vencimento e a irmã com
// `cExibirDepartamentos`), e mexer na página errada não mexe em nada que as telas contem. A chave vem de
// `leiturasDe`/`arqCacheOmie`, as mesmas funções que a conferência usa para abrir o cache.
const ANO = 2026;
function paginasMf(cache, emp) {
  const antes = process.env.OMIE_CACHE_DIR;
  process.env.OMIE_CACHE_DIR = cache;
  try {
    const L = leiturasDe(ANO);
    const paginas = [];
    for (let n = 1; ; n++) {
      const arquivo = arqCacheOmie(RAIZ, emp, 'financas/mf', 'ListarMovimentos', L.MF(n));
      if (!fs.existsSync(arquivo)) break;
      const json = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (!Array.isArray(json.movimentos)) break;
      paginas.push({ arquivo, json });
    }
    return paginas;
  } finally {
    if (antes === undefined) delete process.env.OMIE_CACHE_DIR; else process.env.OMIE_CACHE_DIR = antes;
  }
}

const gravar = (p) => fs.writeFileSync(p.arquivo, JSON.stringify(p.json), 'utf8');

// O MOLDE: UM AVULSO QUE A CONFERÊNCIA REALMENTE CONTA em agosto.
//
// Escolhido abrindo a cópia do cache com as MESMAS funções que a conferência usa e pegando um dos que sobraram nos
// baldes. Pegar um lançamento qualquer do JSON cru não serve: ele pode estar fora do recorte da MeuBESS, ser a baixa de
// um título que a regra de não contar duas vezes descarta, ou cair numa categoria de transferência — e aí duplicá-lo
// não mexe em contagem nenhuma e o teste passaria achando que provou algo.
function avulsoContado(cache) {
  const antes = process.env.OMIE_CACHE_DIR;
  process.env.OMIE_CACHE_DIR = cache;
  try {
    const O = abrirCacheOmie({ raiz: RAIZ, ano: ANO });
    const R = criarRegras({ movimentos: O.movimentos, categorias: O.categorias, recorte: lerRecorte(RAIZ) });
    const emAgosto = (s) => /^\d{2}\/08\/2026$/.test(String(s ?? ''));
    for (const emp of ['1', '2']) {
      for (const nat of ['P', 'R']) {
        const d = [...R.contar(emp, emAgosto, nat).avulsos.values()][0];
        if (d) return { emp, nCodMovCC: String(d.nCodMovCC) };
      }
    }
    return null;
  } finally {
    if (antes === undefined) delete process.env.OMIE_CACHE_DIR; else process.env.OMIE_CACHE_DIR = antes;
  }
}

// Duplica esse avulso na página em que ele está, com código novo e, quando o caso pede, data nova. Conta corrente,
// categoria, natureza, status e origem vêm do molde, então o lançamento novo passa pelos mesmos filtros que ele.
function duplicarAvulso(cache, { emp, nCodMovCC }, dataPg) {
  for (const p of paginasMf(cache, emp)) {
    const modelo = (p.json.movimentos ?? []).find((m) => String(m.detalhes?.nCodMovCC) === nCodMovCC);
    if (!modelo) continue;
    const novo = JSON.parse(JSON.stringify(modelo));
    novo.detalhes.nCodMovCC = Number(`9${String(Date.now()).slice(-8)}`);
    novo.detalhes.nCodMovCCRepet = novo.detalhes.nCodMovCC;
    if (dataPg) { novo.detalhes.dDtPagamento = dataPg; novo.detalhes.dDtVenc = dataPg; }
    p.json.movimentos.push(novo);
    gravar(p);
    return `avulso ${novo.detalhes.nCodMovCC} da empresa ${emp} (cópia do ${nCodMovCC}, que a conferência conta), pago em ${novo.detalhes.dDtPagamento}, acrescentado à cópia do cache`;
  }
  return null;
}

// ---------------------------------------------------------------- as três mexidas, cada uma na sua cópia

// 1. LANÇAMENTO NOVO COM DATA DE UM MÊS ANTERIOR. É o que a releitura de hora em hora traz desde 24/09: o dono lança
//    em setembro algo com data de maio, e as contagens de jan–set sobem.
function acrescentarNoMesAnterior(cache) {
  const molde = avulsoContado(cache);
  return molde && duplicarAvulso(cache, molde, '15/05/2026');
}

// 2. O CASO REAL DE AGOSTO QUE A PÁGINA CITA MUDA DE `cStatus`. O código sai da própria trava, para mexer exatamente no
//    lançamento que a conferência escolhe. O status novo é um que o filtro NÃO exclui, de propósito: assim a contagem
//    de agosto continua a mesma e quem tem de pegar a mexida é a trava, não a aritmética.
function mudarOStatusDoCasoReal(cache) {
  const fixada = JSON.parse(fs.readFileSync(TRAVA, 'utf8'));
  for (const caso of fixada.casos ?? []) {
    const m = /^(nCodTitulo|nCodMovCC) (\d+) \(empresa (\d)/.exec(caso);
    if (!m) continue;
    const [, campo, codigo, emp] = m;
    for (const p of paginasMf(cache, emp)) {
      let mexeu = null;
      for (const mov of p.json.movimentos ?? []) {
        const d = mov.detalhes ?? {};
        if (String(d[campo]) !== codigo || d.cStatus === 'CANCELADO') continue;
        const antes = d.cStatus;
        d.cStatus = antes === 'ATRASADO' ? 'PAGO' : 'ATRASADO';
        mexeu = `${campo} ${codigo} da empresa ${emp}: cStatus ${antes} -> ${d.cStatus} na cópia do cache`;
      }
      if (mexeu) { gravar(p); return mexeu; }
    }
  }
  return null;
}

// 3. LANÇAMENTO NOVO COM DATA DE AGOSTO. O mês conferido ganhando lançamento: a data do molde fica como está.
function acrescentarEmAgosto(cache) {
  const molde = avulsoContado(cache);
  return molde && duplicarAvulso(cache, molde, null);
}

// ---------------------------------------------------------------- só montar a cópia, para rodar os comandos na mão
//
// `--so-a-copia <pasta>` monta a cópia do cache com o lançamento retroativo (o caso 1) numa pasta escolhida e para aí,
// sem rodar nada. Serve para conferir à mão que os comandos de sempre funcionam sobre um cache que a releitura mexeu:
//
//   node scripts/testar-trava-agosto.mjs --so-a-copia .cache/simulacao-releitura
//   OMIE_CACHE_DIR=.cache/simulacao-releitura/omie npm run conferencia
//   OMIE_CACHE_DIR=.cache/simulacao-releitura/omie npm run conferir-telas
//
// A pasta fica dentro de `.cache/`, que o `.gitignore` cobre. Depois, rodar os dois comandos sem a variável devolve as
// páginas ao cache de verdade.
{
  const i = process.argv.indexOf('--so-a-copia');
  if (i >= 0) {
    const destino = path.resolve(RAIZ, process.argv[i + 1] ?? '.cache/simulacao-releitura');
    const omie = path.join(destino, 'omie');
    fs.rmSync(destino, { recursive: true, force: true });
    fs.mkdirSync(omie, { recursive: true });
    for (const f of fs.readdirSync(CACHE)) fs.copyFileSync(path.join(CACHE, f), path.join(omie, f));
    const marca = path.join(RAIZ, '.cache', 'ultima-leitura-omie.json');
    if (fs.existsSync(marca)) fs.copyFileSync(marca, path.join(destino, 'ultima-leitura-omie.json'));
    const oQueMexi = acrescentarNoMesAnterior(omie);
    if (!oQueMexi) { console.error('não consegui montar a mexida na cópia'); process.exit(1); }
    console.log(`cópia do cache em ${path.relative(RAIZ, omie)}`);
    console.log(`mexida: ${oQueMexi}`);
    console.log('agora: OMIE_CACHE_DIR=<essa pasta> npm run conferencia && OMIE_CACHE_DIR=<essa pasta> npm run conferir-telas');
    process.exit(0);
  }
}

// ---------------------------------------------------------------- rodar um caso
function rodar(cache) {
  const guardado = new Map();
  for (const rel of TOCADOS) {
    const p = path.join(RAIZ, rel);
    if (fs.existsSync(p)) guardado.set(p, fs.readFileSync(p));
  }
  try {
    return spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'numeros-das-telas.mjs'), '--sem-dfc'], {
      cwd: RAIZ, encoding: 'utf8', env: { ...process.env, OMIE_CACHE_DIR: cache },
    });
  } finally {
    for (const [p, conteudo] of guardado) fs.writeFileSync(p, conteudo);
  }
}

const CASOS = [
  {
    nome: '1. lançamento novo num mês ANTERIOR (maio de 2026), como a releitura de hora em hora traz',
    mexer: acrescentarNoMesAnterior,
    esperado: 'passa',
    porque: 'jan–set muda de contagem sozinho, e isso é publicação, não trava: a conferência grava e ninguém edita docs/fontes.md à mão',
    // Sem isto o caso 1 passaria de graça: uma mexida que não mudasse contagem nenhuma também "passa", e não provaria
    // nada. Exigir a marca MUDOU é exigir que jan–set tenha REALMENTE mudado nesta rodada, e mesmo assim ela grave.
    exigeNaSaida: { re: /^ {2}MUDOU /m, oQue: 'ao menos uma contagem de jan–set diferente da leitura de referência' },
  },
  {
    nome: '2. o caso real de AGOSTO que a página cita muda de cStatus',
    mexer: mudarOStatusDoCasoReal,
    esperado: 'para',
    porque: 'é uma divergência de verdade em agosto, e a contagem do mês nem muda — quem tem de pegar é a trava',
  },
  {
    nome: '3. lançamento novo com data de AGOSTO de 2026',
    mexer: acrescentarEmAgosto,
    esperado: 'para',
    porque: 'o mês conferido ganhou lançamento: os baldes de agosto que a trava fixou deixam de bater',
  },
];

const INTERESSA = /^(TRAVA DE AGOSTO|  - |A trava foi fixada|Se a mudança|  node scripts|agosto de 2026:|trava de agosto|  MUDOU )/;

let falhas = 0;
for (const caso of CASOS) {
  const cache = copiarCache();
  const oQueMexi = caso.mexer(cache);
  if (!oQueMexi) {
    console.log(`FALHOU  ${caso.nome}\n        não consegui montar a mexida na cópia do cache`);
    falhas++;
    fs.rmSync(path.dirname(cache), { recursive: true, force: true });
    continue;
  }
  const r = rodar(cache);
  const parou = r.status !== 0;
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const daTrava = /TRAVA DE AGOSTO DE 2026/.test(saida);
  // Parar por outro motivo não conta como acerto: o teste tem de provar que foi A TRAVA que pegou.
  const exige = caso.exigeNaSaida ? caso.exigeNaSaida.re.test(saida) : true;
  const certo = (caso.esperado === 'para' ? (parou && daTrava) : !parou) && exige;
  if (!certo) falhas++;
  console.log(`${certo ? 'ok     ' : 'FALHOU '} ${caso.nome}`);
  console.log(`        mexida: ${oQueMexi}`);
  console.log(`        esperado: a conferência ${caso.esperado === 'para' ? 'PARA, com mensagem da trava' : 'PASSA'} — ${caso.porque}`);
  console.log(`        deu: a conferência ${parou ? `PAROU (código ${r.status}), mensagem ${daTrava ? 'da trava' : 'de outra coisa'}` : 'PASSOU'}`);
  if (caso.exigeNaSaida) console.log(`        e a saída ${exige ? 'traz' : 'NÃO traz'} ${caso.exigeNaSaida.oQue}`);
  for (const l of saida.split(/\r?\n/).filter((l) => INTERESSA.test(l)).slice(0, 14)) console.log(`        | ${l}`);
  fs.rmSync(path.dirname(cache), { recursive: true, force: true });
}

// O cache de verdade e os arquivos de `docs/` não mudaram. O sha1 da trava é a prova mais curta disso.
console.log(`\ntrava intacta depois do teste: sha1 ${crypto.createHash('sha1').update(fs.readFileSync(TRAVA)).digest('hex').slice(0, 12)} em ${path.relative(RAIZ, TRAVA)}`);
console.log(`${CASOS.length} casos: ${CASOS.length - falhas} como esperado, ${falhas} não.`);
process.exit(falhas ? 1 : 0);
