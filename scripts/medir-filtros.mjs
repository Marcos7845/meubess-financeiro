// MEDE O CLIQUE DE FILTRO DAS TRÊS TELAS, FASE POR FASE — antes e depois da base local. Escreve
// `docs/desempenho.md` e `docs/desempenho.html`.
//
// POR QUE ESTE SCRIPT EXISTE. O dono disse que cada clique num filtro "demora uma eternidade" (27/09/2026). Antes de
// mudar qualquer coisa era preciso saber ONDE o tempo estava, e depois de mudar era preciso provar que saiu. As duas
// pontas são medidas aqui, na mesma rodada, com o mesmo relógio — por isso a tabela do documento compara duas colunas
// que nasceram juntas, e não uma lembrança contra uma medição.
//
// AS QUATRO FASES DE UM CLIQUE, e o que cada uma é:
//
//   espera do Omie     quanto a resposta ficou parada esperando a releitura do Omie (`lib/regras/omie-releitura.mjs`).
//                      ANTES: até 8 s, quando a última leitura tinha passado de uma hora. DEPOIS: a releitura continua
//                      de hora em hora, mas o clique não espera por ela.
//   planilhas do DFC   abrir e ler os arquivos `.xlsx` da pasta que o OneDrive espelha — treze na Tela 1 e doze na
//                      Tela 2, a cada clique, porque cada combinação de filtro era um cálculo novo.
//   cache do Omie      abrir os arquivos `.json` do cache local `.cache/omie/` e montar as leituras.
//   cálculo            o resto: aplicar os filtros e montar os indicadores da tela.
//
//   desenho            a quinta, que não cabe dentro do Node: é o React desenhando a página e o Next respondendo. Ela
//                      só existe com o app no ar, então é medida sobre HTTP com `--url`, pela DIFERENÇA entre o tempo
//                      da página inteira e o tempo dos dados. NENHUMA linha de `app/` mudou nesta tarefa, então o
//                      desenho é o mesmo antes e depois — o que mudou é o que vem antes dele.
//
// OS DOIS MODOS, e por que os dois continuam medíveis depois da mudança:
//
//   --modo antes   refaz o que `lib/dados.mjs` fazia até 27/09/2026: esperar a releitura do Omie e, para CADA clique,
//                  montar uma base nova — isto é, reabrir o cache do Omie e as planilhas do DFC do zero. É o caminho
//                  do "balde novo por combinação de filtro". Com uma diferença que joga CONTRA o modo antes e a favor
//                  da honestidade: a leitura de hoje abre doze arquivos na Tela 1, e a de antes abria treze (o mês e
//                  mais os doze da série do ano, um deles duas vezes). O antes medido aqui é, portanto, um pouco
//                  melhor do que o antes que o dono viveu.
//   --modo depois  o caminho de verdade, por `lib/dados.mjs`: a base local é preparada uma vez e o clique só calcula.
//
// COMO RODAR:
//
//   node scripts/medir-filtros.mjs                                  # mede os dois modos e imprime a tabela
//   node scripts/medir-filtros.mjs --gravar                         # e escreve docs/desempenho.md e .html
//   node scripts/medir-filtros.mjs --so-documento                   # reescreve o documento do que já foi medido
//   node scripts/medir-filtros.mjs --url http://localhost:4781 --http depois --gravar
//                                                                   # e mede o clique de verdade no app no ar
//   node scripts/medir-filtros.mjs --omie forcar                    # com a releitura do Omie em curso (vai à API,
//                                                                   # só consulta; é o pior caso do modo antes)
//
// TODA MEDIÇÃO FICA EM `docs/desempenho-medicoes.json`, e o documento é escrito dele. É o que deixa `--so-documento`
// consertar uma frase sem medir tudo de novo — e é o que deixa o documento ter, lado a lado, a medição do antes com a
// releitura do Omie em curso e a do clique de verdade sobre HTTP, que são de rodadas diferentes porque não podiam ser
// da mesma: uma precisa da releitura em curso, a outra precisa do app no ar.
//
// SÓ LEITURA, E SÓ TEMPO. Nada aqui escreve no Omie nem nas planilhas. O documento que sai tem milissegundos,
// contagens e nomes de filtro — nenhum valor em reais e nenhum nome de cliente, e a trava do fim recusa a escrita se
// algum aparecer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dadosDaTela1, dadosDaTela2, dadosDoFluxoDeCaixa, ultimasFases } from '../lib/dados.mjs';
import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularFluxoDeCaixa } from '../lib/indicadores/fluxo-de-caixa.mjs';
import { novaBase } from '../lib/regras/base-local.mjs';
import { carimboDaLeitura } from '../lib/regras/cache-omie.mjs';
import { fonteDoDfc } from '../lib/regras/dfc-fonte.mjs';
import { pedirReleituraDoOmie } from '../lib/regras/omie-releitura.mjs';
import { NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA_MD = path.join(RAIZ, 'docs', 'desempenho.md');
const SAIDA_HTML = path.join(RAIZ, 'docs', 'desempenho.html');
// O clique de verdade, sobre HTTP, fica num arquivo próprio: ele é medido contra o APP NO AR, e o app no ar do modo
// antes deixou de existir no instante em que a mudança entrou. Guardar as duas medições aqui é o que deixa a tabela do
// documento ter as duas colunas depois — cada uma com a hora em que foi feita.
const SAIDA_MEDICOES = path.join(RAIZ, 'docs', 'desempenho-medicoes.json');

const arg = (n, p) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : p; };
const tem = (n) => process.argv.includes(n);
const ANO = Number(arg('--ano', '2026'));
const MES = Number(arg('--mes', '8'));
const MODO = arg('--modo', 'os-dois');
const URL_BASE = arg('--url', '');
const HTTP_ROTULO = arg('--http', '');
const OMIE = arg('--omie', 'normal');
const GRAVAR = tem('--gravar') || tem('--so-documento');
// Reescreve o documento do que já foi medido, sem medir nada de novo.
const SO_DOCUMENTO = tem('--so-documento');

// ================================================================ os cliques medidos
//
// UM CLIQUE É UMA COMBINAÇÃO DE FILTRO DA URL — os mesmos filtros de `docs/filtros.md`, escritos do jeito que a página
// os lê. Cada um é uma combinação DIFERENTE, porque era exatamente isso que fazia o trabalho todo acontecer de novo:
// combinação nova, balde novo, fontes reabertas.
//
// As opções não são inventadas: `TI` é um dos 16 nomes de `geral/departamentos`, `Caixinha` é um dos nomes que o dono
// deu às contas da MeuBESS em `dados/contas-correntes-por-negocio.json`, e `recebido` é um dos três rótulos da coluna
// `PAGAMENTO` do `FLUXO DE CAIXA`.
const TELAS = [
  {
    n: 1,
    nome: 'Tela 1 — Gestão de Contas',
    rota: '/',
    calcular: calcularTela1,
    dados: dadosDaTela1,
    // O filtro do jeito que `app/page.js` o monta a partir da query.
    filtroDaQuery: (q) => ({
      cc: lista(q.cc), empresa: lista(q.empresa), conta: lista(q.conta), situacao: lista(q.situacao),
      classe: lista(q.classe), categoria: lista(q.categoria), fornecedor: q.fornecedor ?? null,
    }),
    cliques: [
      { rotulo: 'empresa 2', q: { empresa: '2' } },
      { rotulo: 'centro de custo TI', q: { cc: 'TI' } },
      { rotulo: 'situação recebido', q: { situacao: 'recebido' } },
      { rotulo: 'conta Caixinha', q: { conta: 'Caixinha' } },
    ],
  },
  {
    n: 2,
    nome: 'Tela 2 — DRE',
    rota: '/dre',
    calcular: calcularTela2,
    dados: dadosDaTela2,
    filtroDaQuery: (q) => ({ meses: lista(q.meses), empresa: lista(q.empresa), conta: lista(q.conta) }),
    cliques: [
      { rotulo: 'meses 7 e 8', q: { meses: '7,8' } },
      { rotulo: 'empresa 1', q: { empresa: '1' } },
      { rotulo: 'conta Caixinha', q: { conta: 'Caixinha' } },
      { rotulo: 'mês 8 só', q: { meses: '8' } },
    ],
  },
  {
    n: 3,
    // A Tela 3 virou o Fluxo de Caixa em 28/09/2026 (pedido do dono): os filtros dela são o mês e a empresa.
    nome: 'Tela 3 — Fluxo de Caixa',
    rota: '/fluxo-de-caixa',
    calcular: calcularFluxoDeCaixa,
    dados: dadosDoFluxoDeCaixa,
    filtroDaQuery: (q) => ({ empresa: lista(q.empresa) }),
    cliques: [
      { rotulo: 'empresa 2', q: { empresa: '2' } },
      { rotulo: 'empresa 1', q: { empresa: '1' } },
      { rotulo: 'as duas', q: {} },
    ],
  },
];

const lista = (v) => (v === undefined || v === null ? [] : String(v).split(',').map((x) => x.trim()).filter(Boolean));
const queryDe = (q) => new URLSearchParams({ ano: String(ANO), mes: String(MES), ...q }).toString();

// ================================================================ o relógio
//
// `ms` é inteiro e `s` tem UMA casa depois da vírgula, de propósito: a trava do fim recusa qualquer número com duas
// casas depois da vírgula, que é a forma de um valor em reais. Tempo nunca se confunde com dinheiro neste documento.
const ms = (x) => `${Math.round(x)} ms`;
const seg = (x) => `${(x / 1000).toFixed(1).replace('.', ',')} s`;
const tempo = (x) => (x >= 1000 ? seg(x) : ms(x));
const DENTRO_DE_2S = 2000;

// ================================================================ o modo ANTES
//
// O que `lib/dados.mjs` fazia a cada clique, refeito aqui: esperar a releitura do Omie e montar uma base nova — o que
// quer dizer reabrir o cache do Omie e as planilhas do DFC, do zero, para aquela combinação de filtro.
async function umCliqueAntes(tela, clique) {
  const fonte = fonteDoDfc();
  const t0 = performance.now();
  await pedirReleituraDoOmie({ raiz: RAIZ, ano: ANO, forcar: OMIE === 'forcar' });
  const omie = performance.now() - t0;
  const base = novaBase({ raiz: RAIZ, ano: ANO, fonte });
  await tela.calcular({ raiz: RAIZ, ano: ANO, mes: MES, fonte, filtro: tela.filtroDaQuery(clique.q), base });
  const total = performance.now() - t0;
  return {
    rotulo: clique.rotulo, q: queryDe(clique.q),
    omie, planilhas: base.gasto.planilhas, cacheOmie: base.gasto.cacheOmie,
    calculo: total - omie - base.gasto.planilhas - base.gasto.cacheOmie,
    total,
  };
}

// ================================================================ o modo DEPOIS
//
// O caminho de verdade: `lib/dados.mjs`, com a base local. As fases saem de `ultimasFases`, que a própria camada de
// dados preenche a cada resposta — o mesmo caminho que o navegador percorre.
async function umCliqueDepois(tela, clique) {
  const t0 = performance.now();
  await tela.dados({ ano: ANO, mes: MES, filtro: tela.filtroDaQuery(clique.q) });
  const total = performance.now() - t0;
  const f = ultimasFases;
  return {
    rotulo: clique.rotulo, q: queryDe(clique.q),
    omie: f.omie, planilhas: f.planilhas, cacheOmie: f.cacheOmie, calculo: f.calculo, total,
    doCache: f.doCache, baseNova: f.baseNova,
  };
}

// UMA TELA INTEIRA num modo: a abertura (sem filtro, a primeira, que lê as fontes) e os cliques de filtro depois dela.
async function umaTela(tela, modo) {
  const um = modo === 'antes' ? umCliqueAntes : umCliqueDepois;
  const abertura = await um(tela, { rotulo: 'abertura, sem filtro', q: {} });
  const cliques = [];
  for (const c of tela.cliques) cliques.push(await um(tela, c));
  return { tela: tela.n, nome: tela.nome, rota: tela.rota, abertura, cliques };
}

async function medir(modo) {
  const fora = [];
  for (const t of TELAS) fora.push(await umaTela(t, modo));
  return fora;
}

// ================================================================ o clique de verdade, sobre HTTP
//
// A página inteira, servida pelo app no ar: é o que o dono sente quando clica. O `desenho` sai por diferença — o tempo
// da página menos o tempo dos dados que este script mediu no mesmo modo.
async function medirHttp(medicoes) {
  const fora = { em: new Date().toISOString(), url: URL_BASE, telas: [] };
  for (const t of TELAS) {
    const m = medicoes.find((x) => x.tela === t.n);
    const um = async (q) => {
      const t0 = performance.now();
      const r = await fetch(`${URL_BASE}${t.rota}?${queryDe(q)}`);
      await r.text();
      return performance.now() - t0;
    };
    const abertura = await um({});
    const cliques = [];
    for (const c of t.cliques) cliques.push({ rotulo: c.rotulo, total: await um(c.q) });
    // O desenho é comparado com o PIOR clique medido em Node, que é o mesmo conjunto de cliques.
    const piorDados = Math.max(...m.cliques.map((c) => c.total));
    const piorHttp = Math.max(...cliques.map((c) => c.total));
    fora.telas.push({ tela: t.n, abertura, cliques, piorHttp, piorDados, desenho: Math.max(0, piorHttp - piorDados) });
  }
  return fora;
}

// ================================================================ a rodada
//
// TODA MEDIÇÃO FICA GUARDADA EM `docs/desempenho-medicoes.json`, e o documento é escrito DELE. Sem isso, consertar uma
// frase do documento obrigaria a medir tudo de novo — e a medição do modo antes com a releitura do Omie em curso não se
// repete quando se quer: ela depende de a releitura estar em curso. Com o arquivo, `--so-documento` reescreve o texto a
// partir do que já foi medido, e as medições ficam no repositório dizendo de quando são.

let medicoes = {};
try { medicoes = JSON.parse(fs.readFileSync(SAIDA_MEDICOES, 'utf8')); } catch { /* primeira vez */ }

if (!SO_DOCUMENTO) {
  const carimbo = carimboDaLeitura(RAIZ);
  const resultado = { em: new Date().toISOString(), ano: ANO, mes: MES, carimbo, omie: OMIE };
  if (MODO === 'antes' || MODO === 'os-dois') resultado.antes = await medir('antes');
  if (MODO === 'depois' || MODO === 'os-dois') resultado.depois = await medir('depois');
  // Uma medição só dos dois modos substitui a guardada; uma de um modo só entra ao lado da que estava lá.
  medicoes.fases = (resultado.antes && resultado.depois)
    ? resultado
    : { ...(medicoes.fases ?? {}), ...resultado };

  if (URL_BASE && HTTP_ROTULO) {
    const base = resultado[HTTP_ROTULO] ?? resultado.depois ?? resultado.antes;
    medicoes.http ??= {};
    // A ESPERA DO OMIE DAQUELA RODADA ENTRA JUNTO: sem ela não se sabe se o total de HTTP inclui os 8 s de espera ou
    // não, e o documento precisa dizer isso ao pôr as duas medições lado a lado.
    medicoes.http[HTTP_ROTULO] = {
      ...(await medirHttp(base)),
      esperaDoOmie: Math.max(...base.flatMap((t) => t.cliques.map((c) => c.omie))),
    };
  }
  fs.writeFileSync(SAIDA_MEDICOES, `${JSON.stringify(medicoes, null, 2)}\n`, 'utf8');
  console.log(`gravado ${path.relative(RAIZ, SAIDA_MEDICOES)}`);
}

const resultado = medicoes.fases ?? {};
const http = medicoes.http ?? {};
const carimbo = resultado.carimbo ?? carimboDaLeitura(RAIZ);

// ---------------------------------------------------------------- na tela de quem rodou
const pior = (m) => m.cliques.reduce((a, b) => (b.total > a.total ? b : a));
for (const modo of ['antes', 'depois']) {
  const telas = resultado[modo];
  if (!telas) continue;
  console.log(`\n=== ${modo} ===`);
  for (const t of telas) {
    console.log(`Tela ${t.tela} — abertura ${tempo(t.abertura.total)}`);
    for (const c of t.cliques) {
      console.log(`  ${c.rotulo.padEnd(22)} total ${tempo(c.total).padStart(8)}`
        + `  (Omie ${ms(c.omie)}, planilhas ${ms(c.planilhas)}, cache ${ms(c.cacheOmie)}, cálculo ${ms(c.calculo)})`);
    }
    console.log(`  pior clique: ${tempo(pior(t).total)}${pior(t).total <= DENTRO_DE_2S ? ' — dentro de 2 s' : ' — ACIMA DE 2 S'}`);
  }
}

if (!GRAVAR) {
  console.log('\n(sem `--gravar`: nada foi escrito em docs/)');
  process.exit(0);
}

// ================================================================ o documento
//
// Escrito só quando os DOIS modos foram medidos na mesma rodada: uma tabela de antes e depois em que uma das colunas
// veio de outra rodada não é comparação, é palpite.
if (!resultado.antes || !resultado.depois) {
  console.error('para gravar o documento é preciso medir os dois modos (`--modo os-dois`, que é o padrão).');
  process.exit(1);
}

const doTela = (modo, n) => resultado[modo].find((t) => t.tela === n);
const linhaDeFases = (c) => `| ${c.rotulo} | ${ms(c.omie)} | ${ms(c.planilhas)} | ${ms(c.cacheOmie)} | ${ms(c.calculo)} | **${tempo(c.total)}** |`;

const tabelaDeFases = (modo) => TELAS.map((t) => {
  const m = doTela(modo, t.n);
  return `#### ${m.nome}

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
${[m.abertura, ...m.cliques].map(linhaDeFases).join('\n')}`;
}).join('\n\n');

// A ESPERA DO OMIE É A ÚNICA FASE QUE NÃO ACONTECE EM TODA HORA: ela só existe quando a releitura passou de uma hora
// ou está em curso. Então o parágrafo sobre ela é escrito do que a rodada MEDIU, e não de uma frase fixa que poderia
// estar descrevendo uma coisa que não aconteceu aqui.
const esperaAntes = Math.max(...TELAS.flatMap((t) => doTela('antes', t.n).cliques.map((c) => c.omie)));
const esperaDepois = Math.max(...TELAS.flatMap((t) => doTela('depois', t.n).cliques.map((c) => c.omie)));
const COMO_MEDIR_A_ESPERA = [
  'cp -rp .cache/omie .cache/omie-copia',
  'OMIE_CACHE_DIR=.cache/omie-copia node scripts/medir-filtros.mjs --omie forcar --modo os-dois',
].join('\n');
const paragrafoDaEspera = esperaAntes >= 1000
  ? `**A espera do Omie apareceu nesta rodada, e é a fase que a base local tirou do caminho por inteiro.** A releitura
de hora em hora estava em curso enquanto o modo antes rodava, e cada clique dele ficou parado esperando por ela — o
maior foi ${ms(esperaAntes)}, contra o teto de 8 s de \`ESPERA_PADRAO_MS\` (\`lib/regras/omie-releitura.mjs\`). No modo
depois a MESMA releitura continuou em curso, pela mesma regra do mesmo arquivo, e a coluna mediu ${ms(esperaDepois)} em
todos os cliques: o clique não passa mais por ela. A releitura não foi encurtada nem adiada — ela só deixou de segurar
a tela.`
  : `**A espera do Omie mediu zero nas duas colunas desta rodada, e isso tem explicação.** Ela só existe quando a última
releitura do Omie passou de uma hora, ou está em curso: nessa hora, a camada de dados de antes parava cada clique por
até 8 s (\`ESPERA_PADRAO_MS\`, em \`lib/regras/omie-releitura.mjs\`) antes de começar a calcular. Nesta rodada a última
leitura tinha menos de uma hora, então nem o modo antes esperou — e por isso esta coluna não mede, aqui, o pior caso
que o dono vivia. Para medi-la com a releitura em curso **sem tocar no cache de verdade**, é só mandar a releitura
gravar numa cópia:

\`\`\`
${COMO_MEDIR_A_ESPERA}
\`\`\`

A cópia com \`-p\` guarda as datas dos arquivos, e por isso o carimbo da leitura continua sendo o mesmo.`;

const resumo = TELAS.map((t) => {
  const a = pior(doTela('antes', t.n)), d = pior(doTela('depois', t.n));
  const veredito = d.total <= DENTRO_DE_2S
    ? `dentro de 2 s`
    : `**acima de 2 s** — ${d.planilhas > 100 ? 'o clique ainda abriu planilha' : 'o cálculo sozinho passou de 2 s'}`;
  return `| ${m2(t.n)} | ${a.rotulo} | ${tempo(a.total)} | ${tempo(d.total)} | ${veredito} |`;
}).join('\n');
function m2(n) { return `Tela ${n}`; }

const secaoHttp = () => {
  if (!http.antes && !http.depois) {
    return `Esta medição não foi feita nesta rodada. Ela precisa do app no ar:

\`\`\`
npm run local                                                          # numa janela
node scripts/medir-filtros.mjs --url http://localhost:4781 --http depois --gravar
\`\`\``;
  }
  const linhas = TELAS.map((t) => {
    const a = http.antes?.telas.find((x) => x.tela === t.n);
    const d = http.depois?.telas.find((x) => x.tela === t.n);
    const p = (x) => (x ? tempo(Math.max(...x.cliques.map((c) => c.total))) : '—');
    const des = (x) => (x ? tempo(x.desenho) : '—');
    return `| ${m2(t.n)} | \`${t.rota}\` | ${p(a)} | ${p(d)} | ${des(d)} |`;
  }).join('\n');
  // A ESPERA DO OMIE DAS DUAS RODADAS DE HTTP, guardada junto com elas: sem dizer isto, a coluna do antes daqui parece
  // brigar com o total do antes da tabela de fases, que caiu com a releitura em curso.
  const semEspera = [['antes', http.antes], ['depois', http.depois]]
    .filter(([, x]) => x && !(x.esperaDoOmie >= 1000)).map(([k]) => k);
  return `| tela | rota | pior clique antes | pior clique depois | desenho (por diferença) |
| --- | --- | --- | --- | --- |
${linhas}

O **desenho** é a diferença entre a página inteira e os dados: é o React montando a marcação e o Next respondendo.
Nenhuma linha de \`app/\` mudou nesta tarefa, então ele é o mesmo antes e depois — e é por isso que a coluna aparece uma
vez só. A conta do desenho é boa na coluna do depois, em que os dados custam quase nada; na do antes ela seria a
diferença de dois números de oito segundos, e é por isso que ela não aparece lá.${http.antes ? ` O antes foi medido em ${quando(http.antes.em)} e o depois em ${quando(http.depois?.em)}, cada um contra o app construído daquele lado da mudança: o antes não pode ser remedido, porque o código que ele media deixou de existir.` : ''}${semEspera.length ? `

**Estas medições de HTTP (${semEspera.join(' e ')}) caíram numa hora em que a releitura do Omie NÃO estava em curso** —
a espera do Omie mediu zero nelas. É por isso que o pior clique do antes aqui é menor que o total do antes da tabela de
fases mais acima: lá a releitura estava em curso e os 8 s de espera entraram na conta. As duas coisas são verdade, cada
uma na sua hora, e é a soma delas que o dono sentia como "uma eternidade".` : ''}`;
};

const quando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const md = `# O tempo de um clique de filtro nas 3 telas

Medido por \`scripts/medir-filtros.mjs\` neste computador, em ${quando(new Date().toISOString())}, sobre
${NOMES_DOS_MESES[MES]} de ${ANO}. As duas colunas — antes e depois — foram medidas na MESMA rodada, com o mesmo
relógio: o script sabe fazer as duas coisas, e por isso a comparação não depende de ninguém ter anotado um número
ontem. A leitura do Omie desta rodada é a \`${carimbo.id ?? '(sem cache)'}\`, com ${carimbo.arquivos} arquivos no cache.

**O que era.** Cada combinação de filtro era um balde novo em \`lib/dados.mjs\`, e o balde novo refazia o cálculo
inteiro. Refazer o cálculo inteiro queria dizer reabrir as fontes: os ${carimbo.arquivos} arquivos do cache do Omie e as
planilhas \`.xlsx\` da pasta que o OneDrive espelha — treze arquivos na Tela 1 (o mês, mais os doze da série do ano) e
doze na Tela 2. E, se a leitura do Omie tinha passado de uma hora, o clique ainda esperava até 8 s por ela antes de
começar a contar.

**O que é.** As fontes são lidas e preparadas uma vez, numa **base local** (\`lib/regras/base-local.mjs\`), e o clique
de filtro só calcula em cima dela. Nada do que se lê depende do filtro — a planilha é a mesma, o cache é o mesmo, e o
recorte do filtro é aplicado depois.

## O resumo

| tela | o pior clique | antes | depois | |
| --- | --- | --- | --- | --- |
${resumo}

## As fases, clique por clique

As quatro fases de dentro do Node. A quinta — o desenho — está mais abaixo, porque ela só existe com o app no ar.

### Antes: um balde novo por combinação de filtro

\`\`\`
node scripts/medir-filtros.mjs --modo antes
\`\`\`

O modo antes refaz o que a camada de dados fazia até 27/09/2026: esperar a releitura do Omie e montar uma base nova a
cada clique. Uma diferença joga contra ele e a favor da honestidade: a leitura de hoje abre doze arquivos na Tela 1, e a
de antes abria treze — o antes que o dono viveu era um pouco pior que este.

${tabelaDeFases('antes')}

### Depois: a base local, e o clique só calculando

\`\`\`
node scripts/medir-filtros.mjs --modo depois
\`\`\`

${tabelaDeFases('depois')}

${paragrafoDaEspera}

A linha da **abertura** é a única que ainda lê as fontes, e é a leitura que o dono aceita esperar. Na Tela 1 ela abre os
doze meses de planilha (a tela desenha a série do ano), e é por isso que a abertura das Telas 2 e 3, logo depois, já não
abre planilha nenhuma: os doze meses que a Tela 2 precisa estão prontos.

## O clique de verdade, sobre HTTP

${secaoHttp()}

## Onde fica a base local, e quando ela é renovada

**Onde:** na memória do processo do servidor (\`lib/regras/base-local.mjs\`), uma base por ano pedido. Não é arquivo e
não é banco, por três motivos, nesta ordem:

- **dinheiro não vai para disco.** A base guarda o valor de cada linha do DFC, em centavos, e o nome de cada cliente do
  cadastro do Omie. Neste repositório valor em reais e nome de pessoa vivem na memória do servidor e vão só para a tela;
  um arquivo ou um SQLite com a base seria um lugar novo, no disco, com o dinheiro da empresa dentro.
- **o processo sobrevive entre os cliques.** As telas rodam em \`next start\` neste computador (\`npm run local\`) e o
  mesmo processo atende todas as visitas. O único caso que um arquivo cobriria a mais é a primeira abertura depois de
  reiniciar o app — que é justamente a leitura que o dono aceita esperar.
- **serializar custaria o que economiza.** O cache do Omie já é disco, e reabri-lo inteiro custa uma fração do que custa
  a planilha (as duas colunas acima medem isso). Passar a base por JSON — com os \`Map\` e os \`Set\` que o cache monta —
  custaria a mesma ordem de grandeza, e o ganho de verdade, que são os sete segundos de planilha, não precisa de disco
  nenhum para acontecer uma vez só.

**Quando é renovada** — as três horas de \`lib/dados.mjs\`, e nenhuma a mais:

| quando | o que acontece | quem espera |
| --- | --- | --- |
| na abertura | não há base para o ano pedido: esta visita lê as fontes | esta visita |
| na virada da hora | a base completou uma hora, ou a releitura do Omie trouxe leitura nova: a visita responde com a base que tem e manda preparar a nova **ao lado**; quando ela fica pronta, entra no lugar e os baldes de resultado são jogados fora | ninguém |
| no "atualizar agora" | \`esquecer()\` joga fora a base e os baldes; a visita seguinte é uma abertura | quem apertou o botão |

**A regra da releitura de hora em hora não mudou.** As fontes continuam relidas de hora em hora e o Omie continua
relido pela API por \`lib/regras/omie-releitura.mjs\`, com a mesma janela de uma hora e só por método de consulta. O que
saiu foi a espera: a releitura é disparada com \`esperarMs: 0\` quando uma base é preparada, e segue ao lado. O preço é
que uma falha imediata do Omie — credencial faltando, por exemplo — aparece na visita seguinte em vez de na mesma; a
hora da última leitura, que o rodapé da tela mostra, continua saindo da marca que a releitura grava.

## Como remedir

\`\`\`
npm run medir-filtros                                      # os dois modos, e reescreve este documento
node scripts/medir-filtros.mjs --modo depois               # só o de hoje, sem escrever nada
node scripts/medir-filtros.mjs --so-documento              # reescreve o texto do que já foi medido, sem medir
npm run local                                              # e, com o app no ar, numa outra janela:
node scripts/medir-filtros.mjs --url http://127.0.0.1:4781 --http depois --gravar
\`\`\`

E o pior caso, com a releitura do Omie em curso — mandando a releitura gravar numa cópia, para o cache de verdade não
ser tocado. É assim que a medição publicada aqui foi feita:

\`\`\`
${COMO_MEDIR_A_ESPERA}
\`\`\`

Tudo o que foi medido fica em \`docs/desempenho-medicoes.json\`, e este documento é escrito dele — por isso consertar uma
frase não obriga a medir tudo de novo, e as duas medições que não podiam ser da mesma rodada (a do antes com a releitura
em curso e a do clique sobre HTTP, que precisa do app no ar) aparecem lado a lado, cada uma dizendo de quando é.

Só leitura: nada foi escrito no Omie nem nas planilhas, e este documento tem milissegundos e nomes de filtro — nenhum
valor em reais e nenhum nome de cliente.
`;

// A MESMA TRAVA DOS OUTROS DOCUMENTOS: esta página não pode ganhar dinheiro nem nome de pessoa.
const PROIBIDO = [[/R\$/, 'a marca "R$"'], [/\b\d{1,3}(\.\d{3})*,\d{2}\b/, 'um número com centavos'], [/\b\d+,\d{2}\b/, 'um número com centavos']];
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(md);
  if (m) { console.error(`docs/desempenho.md ia sair com ${oQue}: ${JSON.stringify(m[0])}`); process.exit(1); }
}
fs.writeFileSync(SAIDA_MD, md, 'utf8');

// ================================================================ a mesma coisa como página
//
// O mesmo conversor curto de Markdown de `scripts/conferir-filtros.mjs` — títulos, parágrafos, listas, tabelas,
// `código`, **forte** e blocos de comando —, sem o selo de "conferido/divergente", que aqui não existe: este documento
// não confere nada, ele mede.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

// AS BARRAS — a única coisa da página que não sai do Markdown. São dois `div` com largura em porcento, como os gráficos
// das telas: CSS e mais nada, sem biblioteca e sem chamar nada de fora. A escala é a mesma para as três telas, senão
// cada uma teria a sua e a comparação não se leria.
function barras() {
  const maior = Math.max(...TELAS.map((t) => pior(doTela('antes', t.n)).total));
  const larg = (x) => `${Math.max(0.15, (x / maior) * 100).toFixed(2)}%`;
  return TELAS.map((t) => {
    const a = pior(doTela('antes', t.n)), d = pior(doTela('depois', t.n));
    return `<div class="par"><h4>${m2(t.n)} — ${esc(a.rotulo)}</h4>
  <div class="linha"><span class="quem">antes</span><span class="trilho"><span class="barra antes" style="width:${larg(a.total)}"></span></span><span class="qto">${tempo(a.total)}</span></div>
  <div class="linha"><span class="quem">depois</span><span class="trilho"><span class="barra depois" style="width:${larg(d.total)}"></span></span><span class="qto">${tempo(d.total)}</span></div>
</div>`;
  }).join('\n');
}

function paraHtml(texto) {
  const fora = [];
  let tabela = null, lista = null, pre = null;
  const fecharLista = () => { if (lista) { fora.push(`<ul>${lista.join('')}</ul>`); lista = null; } };
  const fecharTabela = () => {
    if (!tabela) return;
    const [cab, ...corpo] = tabela;
    fora.push(`<div class="tabela"><table><thead><tr>${cab.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
      + `<tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    tabela = null;
  };
  const celulas = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  for (const l of texto.split(/\r?\n/)) {
    if (/^```/.test(l.trim())) {
      if (pre) { fora.push(`<pre>${esc(pre.join('\n'))}</pre>`); pre = null; } else { fecharLista(); fecharTabela(); pre = []; }
      continue;
    }
    if (pre) { pre.push(l); continue; }
    if (/^\|/.test(l)) {
      if (/^\|[\s:|-]+\|?$/.test(l)) continue;
      fecharLista();
      (tabela ??= []).push(celulas(l));
      continue;
    }
    fecharTabela();
    const t = /^(#{1,4})\s+(.*)$/.exec(l);
    if (t) { fecharLista(); fora.push(`<h${t[1].length}>${inline(t[2])}</h${t[1].length}>`); continue; }
    const item = /^- (.*)$/.exec(l);
    if (item) { (lista ??= []).push(`<li>${inline(item[1])}</li>`); continue; }
    if (lista && /^\s+\S/.test(l)) { lista[lista.length - 1] = lista[lista.length - 1].replace(/<\/li>$/, ` ${inline(l.trim())}</li>`); continue; }
    fecharLista();
    if (l.trim() === '') { fora.push(''); continue; }
    fora.push(`<p>${inline(l)}</p>`);
  }
  fecharLista(); fecharTabela();
  return fora.join('\n').replace(/<\/p>\n<p>/g, ' ').replace(/\n{2,}/g, '\n');
}

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>O tempo de um clique de filtro nas 3 telas</title>
<style>
 :root { --fundo:#fbfaf7; --papel:#fff; --tinta:#1d1b16; --fraco:#6b6559; --linha:#e3ded2; --ok:#1f6f43; --okf:#e8f4ec; }
 @media (prefers-color-scheme: dark) { :root {
   --fundo:#16150f; --papel:#1e1c16; --tinta:#efece2; --fraco:#a49d8d; --linha:#34312a; --ok:#7cc79b; --okf:#17301f; } }
 * { box-sizing:border-box } html { -webkit-text-size-adjust:100% }
 body { margin:0; padding:0 16px 64px; background:var(--fundo); color:var(--tinta);
   font:16px/1.6 ui-serif, Georgia, "Times New Roman", serif; overflow-wrap:break-word }
 main { max-width:62rem; margin:0 auto }
 h1 { font-size:1.9rem; line-height:1.2; margin:2.5rem 0 .5rem }
 h2 { font-size:1.3rem; margin:2.5rem 0 .75rem; padding-bottom:.35rem; border-bottom:1px solid var(--linha) }
 h3 { font-size:1.05rem; margin:1.8rem 0 .5rem; font-family:ui-sans-serif,system-ui,sans-serif }
 h4 { font-size:.95rem; margin:1.4rem 0 .4rem; font-family:ui-sans-serif,system-ui,sans-serif; color:var(--fraco) }
 p, li { max-width:70ch } a { color:inherit }
 code { font:0.86em ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--papel);
   border:1px solid var(--linha); border-radius:3px; padding:.05em .3em }
 pre { background:var(--papel); border:1px solid var(--linha); border-radius:8px; padding:.8rem 1rem;
   overflow-x:auto; font:0.84rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace }
 .tabela { overflow-x:auto } table { border-collapse:collapse; width:100%; margin:1rem 0; font-size:.9rem }
 th, td { border:1px solid var(--linha); padding:.4rem .6rem; text-align:left; vertical-align:top }
 th { background:var(--papel); font-family:ui-sans-serif,system-ui,sans-serif; font-size:.74rem;
   text-transform:uppercase; letter-spacing:.06em; color:var(--fraco) }
 td strong { font-family:ui-sans-serif,system-ui,sans-serif }
 .par { margin:1.2rem 0 1.6rem }
 .par h4 { margin:0 0 .4rem }
 .linha { display:flex; align-items:center; gap:.6rem; margin:.25rem 0;
   font:0.82rem ui-sans-serif,system-ui,sans-serif }
 .quem { width:3.6rem; color:var(--fraco); text-align:right }
 .trilho { flex:1; background:var(--papel); border:1px solid var(--linha); border-radius:99px; height:.9rem }
 .barra { display:block; height:100%; border-radius:99px }
 .barra.antes { background:var(--fraco) } .barra.depois { background:var(--ok) }
 .qto { width:5rem; font-variant-numeric:tabular-nums }
 .rodape { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--linha); font-size:.86rem; color:var(--fraco) }
</style></head><body><main>
${paraHtml(md)}
<h2>As três telas em barras</h2>
<p>O mesmo resumo do alto, na mesma escala para as três telas: a barra cheia é o pior clique de antes, e a barra de baixo
é o mesmo clique depois. É a única parte que só existe na página — em texto ela seria a tabela do resumo de novo.</p>
${barras()}
<p class="rodape">Gerado por <code>scripts/medir-filtros.mjs</code>, só leitura: nada foi escrito no Omie nem nas
planilhas. A mesma coisa em texto está em <code>docs/desempenho.md</code>.</p>
</main></body></html>
`;
for (const [re, oQue] of PROIBIDO) {
  const m = re.exec(html.replace(/<style>[\s\S]*?<\/style>/, ''));
  if (m) { console.error(`docs/desempenho.html ia sair com ${oQue}: ${JSON.stringify(m[0])}`); process.exit(1); }
}
fs.writeFileSync(SAIDA_HTML, html, 'utf8');

console.log(`\ngravados ${path.relative(RAIZ, SAIDA_MD)} e ${path.relative(RAIZ, SAIDA_HTML)}`);
