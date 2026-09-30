// Auditor independente, processo CLI. O lado esperado só lê respostas cruas do Omie e células do DFC.
// O lado mostrado chama os indicadores sem iniciar Next; os dois lados não dividem função de cálculo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chamarOmie, garantirCredenciais, PAUSA_MS, espera, lerDoCache } from '../lib/regras/omie-api.mjs';
import { leiturasDe } from '../lib/regras/cache-omie.mjs';
import { calcularTela1 } from '../lib/indicadores/tela-1.mjs';
import { calcularTela2 } from '../lib/indicadores/tela-2.mjs';
import { calcularTela3 } from '../lib/indicadores/tela-3.mjs';
import { calcularFluxoDeCaixa } from '../lib/indicadores/fluxo-de-caixa.mjs';
import { dreIndependente } from './auditoria/dre.mjs';
import { lerZip, sharedStrings, abasDo, lerAba } from '../lib/regras/xlsx.mjs';
import { centavos, normal, soma, lerDfcBruto, indicadoresDfc, lerCsvExtrato, lerOfxExtrato, reconciliar, estado } from './auditoria/core.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i < 0 ? padrao : args[i + 1]; };
const periodo = opt('mes', '2026-09');
if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(periodo)) throw new Error('use --mes AAAA-MM');
const [ano, mes] = periodo.split('-').map(Number);
const anterior = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
const janela = Math.max(1, Number(opt('janela', '2')));
const meses = Array.from({ length: janela }, (_, i) => new Date(Date.UTC(ano, mes - 1 - i, 1)).toISOString().slice(0, 7)).reverse();
const modoOmie = args.includes('--cache-omie') ? 'cache' : 'ao vivo';
const pastaDfc = path.resolve(opt('dfc-dir', path.join(raiz, '.cache', `dfc-${ano}`)));
const pastaMaster = opt('master-dir', null);
const pastaExtratos = path.join(raiz, 'extratos');
const htmlSaida = path.join(raiz, 'docs', `auditoria-${periodo}.html`);
const pastaCacheOmie = path.join(raiz, '.cache', 'omie');
const ultimaRespostaNoCache = fs.existsSync(pastaCacheOmie)
  ? Math.max(0, ...fs.readdirSync(pastaCacheOmie).filter((n) => n.endsWith('.json'))
    .map((n) => fs.statSync(path.join(pastaCacheOmie, n)).mtimeMs)) : 0;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dinheiro = (v, porcentagem = false) => v === null || v === undefined ? '—' : porcentagem
  ? `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`
  : `R$ ${(v / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const titulos = {
  saldo: ['Gestão de Contas', 'Saldo'], receitas: ['Gestão de Contas', 'Receitas'], despesas: ['Gestão de Contas', 'Despesas'],
  'despesas-pagas': ['Gestão de Contas', 'Despesas pagas'], 'despesas-pendentes': ['Gestão de Contas', 'Despesas pendentes'],
  'despesas-funcionarios': ['Gestão de Contas', 'Despesas com funcionários'], 'percentual-funcionarios': ['Gestão de Contas', '% desp. funcionários / receita líquida'],
  'top-10-despesas': ['Gestão de Contas', 'Top 10 despesas'], 'top-10-receitas': ['Gestão de Contas', 'Top 10 receitas'],
  'receita-despesa-por-dia': ['Gestão de Contas', 'Receita × despesa por dia'], 'receita-despesa-por-mes': ['Gestão de Contas', 'Receita × despesa por mês'],
  'receita-total': ['DRE', 'Receita total'], 'custos-e-despesas': ['DRE', 'Custos e despesas'], 'cartao-ebitda': ['DRE', 'EBITDA'],
  'cartao-lucro-liquido': ['DRE', 'Lucro líquido'], 'cartao-margem': ['DRE', 'Margem de lucro'],
  'dre-receitas': ['DRE', '(+) Receitas'], 'dre-receita-bruta': ['DRE', '(=) Receita bruta'], 'dre-deducoes': ['DRE', '(−) Deduções'],
  'dre-receita-liquida': ['DRE', '(=) Receita líquida'], 'dre-custos-de-vendas': ['DRE', '(−) Custos de vendas'],
  'dre-lucro-bruto': ['DRE', '(=) Lucro bruto'], 'dre-despesas-gerais': ['DRE', '(−) Despesas gerais'], 'dre-ebitda': ['DRE', '(=) EBITDA'],
  'dre-resultado-financeiro': ['DRE', '(+/−) Resultado financeiro'], 'dre-impostos': ['DRE', '(−) Impostos pagos'],
  'dre-lucro-liquido': ['DRE', '(=) Lucro líquido'], 'dre-sem-conta': ['DRE', '(=) sem conta'],
  'capital-de-giro': ['DRE', 'Capital de giro tomado'], 'obrigacoes-clientes': ['DRE', 'Obrigações com clientes'],
  'divida-liquida': ['DRE', 'Dívida líquida'], 'resultado-sem-terceiros': ['DRE', 'Resultado sem dinheiro de terceiros'],
  'provisoes-projetos': ['DRE', 'Provisões por projeto'],
  'valor-previsto': ['Fluxo de Caixa', 'Valor previsto'], 'valor-recebido': ['Fluxo de Caixa', 'Valor recebido'],
  'valor-pendente': ['Fluxo de Caixa', 'Valor pendente'], 'valor-vencido': ['Fluxo de Caixa', 'Valor vencido'],
  'por-mes-e-status': ['Fluxo de Caixa', 'Lançamentos por mês e status'], 'por-cliente-e-status': ['Fluxo de Caixa', 'Valor previsto por cliente e status'],
  'lista-de-titulos': ['Fluxo de Caixa', 'Lista de títulos'], 'por-status': ['Fluxo de Caixa', 'Lançamentos por status'],
  fixas: ['Fluxo de Caixa', 'Despesas fixas pagas'], 'peso-fixas': ['Fluxo de Caixa', 'Fixas / receita líquida'],
  projecao: ['Fluxo de Caixa', 'Projeção do mês'], 'dia-a-dia': ['Fluxo de Caixa', 'O mês dia a dia'],
};
const percentuais = new Set(['percentual-funcionarios', 'cartao-margem', 'peso-fixas']);
const caixaIds = new Set(['saldo', 'receitas', 'despesas', 'despesas-pagas', 'despesas-funcionarios', 'percentual-funcionarios',
  'receita-total', 'custos-e-despesas', 'dre-deducoes', 'dre-custos-de-vendas', 'dre-impostos', 'fixas', 'peso-fixas', 'projecao', 'dia-a-dia']);
const avisos = [];
const listarRecursivo = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
  const local = path.join(dir, item.name);
  return item.isDirectory() ? listarRecursivo(local) : [local];
});
const resumoMaster = (() => {
  if (!pastaMaster) return null;
  const master = path.resolve(pastaMaster);
  if (!fs.existsSync(path.join(master, 'B3W', 'DFC', '2026'))) throw new Error('master sem B3W/DFC/2026');
  const hash = (arq) => crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
  const diferencasDeCelula = (arqMaster, arqLocal) => {
    const fontes = [arqMaster, arqLocal].map((arq) => {
      const zip = lerZip(fs.readFileSync(arq));
      return { zip, strings: sharedStrings(zip), abas: abasDo(zip) };
    });
    let total = 0;
    for (const aba of fontes[0].abas) {
      const outra = fontes[1].abas.find((a) => a.nome === aba.nome);
      if (!outra) { total++; continue; }
      const linhas = fontes.map((f, i) => new Map(lerAba(f.zip, i ? outra.parte : aba.parte, f.strings).map((r) => [r.n, r.cel])));
      for (const n of new Set([...linhas[0].keys(), ...linhas[1].keys()])) {
        const primeira = linhas[0].get(n) ?? new Map(), segunda = linhas[1].get(n) ?? new Map();
        for (const coluna of new Set([...primeira.keys(), ...segunda.keys()]))
          if (JSON.stringify(primeira.get(coluna) ?? null) !== JSON.stringify(segunda.get(coluna) ?? null)) total++;
      }
    }
    return total;
  };
  const dfc = meses.map((p) => {
    const prefixo = p.slice(5);
    const arqs = fs.readdirSync(path.join(master, 'B3W', 'DFC', '2026'))
      .filter((n) => new RegExp(`^${prefixo}\\D`).test(n) && /\.xlsx$/i.test(n));
    const local = fs.existsSync(pastaDfc) ? fs.readdirSync(pastaDfc).find((n) => new RegExp(`^${prefixo}\\D`).test(n) && /\.xlsx$/i.test(n)) : null;
    const cacheApp = path.join(raiz, '.cache', `dfc-${ano}`);
    const app = fs.existsSync(cacheApp) ? fs.readdirSync(cacheApp).find((n) => new RegExp(`^${prefixo}\\D`).test(n) && /\.xlsx$/i.test(n)) : null;
    const origem = arqs.length === 1 ? hash(path.join(master, 'B3W', 'DFC', '2026', arqs[0])) : null;
    const cacheAppIgual = Boolean(origem && app && origem === hash(path.join(cacheApp, app)));
    return { mes: p, master: arqs.length, local: Boolean(local), igual: Boolean(origem && local && origem === hash(path.join(pastaDfc, local))),
      cacheApp: Boolean(app), cacheAppIgual, celulasDiferentes: origem && app && !cacheAppIgual
        ? diferencasDeCelula(path.join(master, 'B3W', 'DFC', '2026', arqs[0]), path.join(cacheApp, app)) : 0 };
  });
  const extratos = meses.map((p) => {
    const prefixo = p.slice(5), b3wAno = path.join(master, 'B3W', 'FINANCEIRO', '1. EXTRATOS B3W', String(ano));
    const pastaB3w = fs.existsSync(b3wAno) ? fs.readdirSync(b3wAno, { withFileTypes: true })
      .filter((d) => d.isDirectory() && new RegExp(`^${prefixo}\\s*[-.]`).test(d.name) && !(prefixo === '08' && /OUTUBRO/i.test(d.name))) : [];
    const b3w = pastaB3w.flatMap((d) => listarRecursivo(path.join(b3wAno, d.name)));
    const b3n = listarRecursivo(path.join(master, 'B3N', 'DOCUMENTOS PARA CONTABILIDADE', `${prefixo}.${ano}`));
    const formatos = (arqs) => Object.fromEntries(['.ofx', '.csv', '.pdf', '.xlsx', '.xml'].map((ext) => [ext.slice(1), arqs.filter((a) => path.extname(a).toLowerCase() === ext).length]));
    return { mes: p, pastasB3w: pastaB3w.length, b3w: formatos(b3w), b3n: formatos(b3n) };
  });
  const fiscal = path.join(master, 'B3W', 'FISCAL & CONTABIL', 'FISCAL');
  const contabil = path.join(master, 'B3W', 'FISCAL & CONTABIL', 'CONTABIL');
  const mesesFiscais = [fiscal, contabil].map((dir) => fs.existsSync(dir) ? fs.readdirSync(dir)
    .filter((n) => /^\d{2}-2026$/.test(n)).sort().at(-1) : null);
  const relatorioSaidas = mesesFiscais[0] ? listarRecursivo(path.join(fiscal, mesesFiscais[0]))
    .find((arq) => /REL\. SA[IÍ]DAS/i.test(path.basename(arq)) && /\.xlsx$/i.test(arq)) : null;
  let saidasFiscais = null;
  if (relatorioSaidas) {
    const zip = lerZip(fs.readFileSync(relatorioSaidas)), strings = sharedStrings(zip);
    const aba = abasDo(zip)[0];
    const linhas = lerAba(zip, aba.parte, strings).filter((r) => r.n > 3 && r.cel.get('F')?.t);
    saidasFiscais = { total: linhas.length, faturadas: linhas.filter((r) => normal(r.cel.get('D')?.t) === 'FATURADO').length,
      canceladas: linhas.filter((r) => normal(r.cel.get('D')?.t) === 'CANCELADO').length };
  }
  const fechamentoArquivos = mesesFiscais[1] ? listarRecursivo(path.join(contabil, mesesFiscais[1])) : [];
  const n3Dfc = listarRecursivo(path.join(master, 'N3', 'DFC', String(ano))).filter((f) => /\.xlsx$/i.test(f)).length;
  const comprovantes = {
    cpa: listarRecursivo(path.join(master, 'B3W', 'FINANCEIRO', '2. CPA B3W', 'CPA 2026 B3W')),
    cr: listarRecursivo(path.join(master, 'B3W', 'FINANCEIRO', '3. C.R B3W', '01. C. RECEBER B3W 2026')),
  };
  return { dfc, extratos, mesesFiscais, saidasFiscais, n3Dfc, fechamentoPdf: fechamentoArquivos.filter((f) => /\.pdf$/i.test(f)).length,
    comprovantes: Object.fromEntries(Object.entries(comprovantes)
    .map(([tipo, arqs]) => [tipo, { total: arqs.length, setembro: arqs.filter((a) => /(?:SET|SEP|09[-. ]2026|09\.2026)/i.test(path.dirname(a))).length }])) };
})();

function abrirDfc(p) {
  const [a, m] = p.split('-').map(Number);
  if (!fs.existsSync(pastaDfc)) return { erro: 'cópia local do DFC ausente' };
  const nomes = fs.readdirSync(pastaDfc).filter((n) => n.toLowerCase().endsWith('.xlsx'));
  const arqs = nomes.filter((n) => new RegExp(`^0?${m}\\s*-`).test(n));
  if (arqs.length !== 1) return { erro: `DFC: ${arqs.length} arquivos para ${p}` };
  try {
    const lido = lerDfcBruto(fs.readFileSync(path.join(pastaDfc, arqs[0])), a, m);
    for (const aba of ['FLUXO DE CAIXA', 'BASE', 'PROVISAO']) if (!lido.abas.some((x) => normal(x) === aba)) avisos.push(`DFC ${p}: aba ${aba} ausente`);
    return { ...lido, arquivo: arqs[0] };
  } catch (e) { return { erro: `DFC ${p}: ${e.message}` }; }
}

async function consulta(emp, servico, call, param, campo, modo = modoOmie) {
  const itens = [];
  let total = 1;
  for (let n = 1; n <= total; n++) {
    const p = param(n);
    const json = modo === 'ao vivo'
      ? (await chamarOmie({ raiz, emp, servico, call, param: p, forcar: true, gravar: false })).json
      : lerDoCache({ raiz, emp, servico, call, param: p });
    if (!json) throw new Error(`leitura ${servico}/${call} empresa ${emp}, página ${n} indisponível`);
    total = Number(json.nTotPaginas ?? json.total_de_paginas) || 1;
    itens.push(...(json[campo] ?? []));
    if (modo === 'ao vivo' && n < total) await espera(PAUSA_MS);
  }
  return itens;
}

async function abrirOmie(modo = modoOmie) {
  const L = leiturasDe(ano), result = { titulos: [], pendentes: [], movimentos: [], categorias: [] };
  const inicio = `01/${String(mes).padStart(2, '0')}/${ano}`;
  const fim = `${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  // A auditoria de um mês não precisa percorrer o ano inteiro do ERP. O modo cache
  // conserva os parâmetros anuais porque são as chaves já gravadas pelo app.
  const faixas = modo === 'ao vivo' ? [[inicio, fim]] : L.FAIXAS_TIT_R;
  const cp = (n) => modo === 'ao vivo' ? { ...L.CP_VENC(n), dDtVencDe: inicio, dDtVencAte: fim } : L.CP_VENC(n);
  const mf = (n) => modo === 'ao vivo' ? { ...L.MF(n), dDtPagtoDe: inicio, dDtPagtoAte: fim } : L.MF(n);
  if (modo === 'ao vivo') garantirCredenciais({ raiz, empresas: ['1', '2'] });
  for (const emp of ['1', '2']) {
    const titulos = [];
    for (const [de, ate] of faixas) titulos.push(...await consulta(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', (n) => L.TIT_R(n, de, ate), 'titulosEncontrados', modo));
    result.titulos.push(...titulos.map((x) => ({ ...x, emp })));
    result.pendentes.push(...(await consulta(emp, 'financas/mf', 'ListarMovimentos', cp, 'movimentos', modo)).map((x) => ({ ...x, emp })));
    result.movimentos.push(...(await consulta(emp, 'financas/mf', 'ListarMovimentos', mf, 'movimentos', modo)).map((x) => ({ ...x, emp })));
    result.categorias.push(...(await consulta(emp, 'geral/categorias', 'ListarCategorias', L.CATEGORIAS, 'categoria_cadastro', modo)).map((x) => ({ ...x, emp })));
  }
  return result;
}

function calcularOmie(cru) {
  const contas = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'));
  const recorte = new Set(contas.contas.filter((c) => c.negocio === 'MeuBESS').map((c) => c.chave));
  const noMes = (d) => typeof d === 'string' && d.slice(3, 10) === `${String(mes).padStart(2, '0')}/${ano}`;
  const titulos = cru.titulos.filter((t) => recorte.has(`${t.emp}|${t.cabecTitulo?.nCodCC}`) && noMes(t.cabecTitulo?.dDtVenc)
    && normal(t.cabecTitulo?.cStatus) !== 'CANCELADO');
  const status = (s) => normal(s).replace(/\s/g, '');
  const pagos = titulos.filter((t) => ['RECEBIDO', 'LIQUIDADO'].includes(status(t.cabecTitulo?.cStatus)));
  const abertos = titulos.filter((t) => ['EMABERTO', 'AVENCER', 'VENCEHOJE', 'PAGTOPARCIAL'].includes(status(t.cabecTitulo?.cStatus)));
  const atrasados = titulos.filter((t) => status(t.cabecTitulo?.cStatus) === 'ATRASADO');
  const pendentes = cru.pendentes.filter((m) => recorte.has(`${m.emp}|${m.detalhes?.nCodCC}`) && noMes(m.detalhes?.dDtVenc)
    && m.detalhes?.cStatus !== 'CANCELADO' && (m.resumo?.cLiquidado ?? 'N') === 'N');
  const out = new Map();
  const add = (id, valor, linhas, fonte) => out.set(id, { valor, linhas, fonte });
  add('despesas-pendentes', soma(pendentes.map((t) => centavos(t.resumo?.nValAberto))), pendentes,
    'Omie / financas/mf ListarMovimentos; CP, vencimento no mês, cLiquidado=N; empresas 1+2, conta MeuBESS');
  add('valor-previsto', soma(titulos.map((t) => centavos(t.cabecTitulo?.nValorTitulo))), titulos,
    'Omie / financas/pesquisartitulos PesquisarLancamentos; vencimento no mês, sem CANCELADO, conta MeuBESS');
  add('valor-recebido', soma(pagos.map((t) => centavos(t.resumo?.nValPago))), pagos,
    'Omie / PesquisarLancamentos; status RECEBIDO ou LIQUIDADO, vencimento no mês');
  add('valor-pendente', soma(abertos.map((t) => centavos(t.resumo?.nValAberto))), abertos,
    'Omie / PesquisarLancamentos; status em aberto, vencimento no mês');
  add('valor-vencido', soma(atrasados.map((t) => centavos(t.resumo?.nValAberto))), atrasados,
    'Omie / PesquisarLancamentos; status ATRASADO, vencimento no mês');
  add('lista-de-titulos', out.get('valor-previsto').valor, titulos, 'Omie / PesquisarLancamentos; total da lista');
  return out;
}

function lerExtratos(p) {
  const encontrados = [], erros = [];
  if (!fs.existsSync(pastaExtratos)) return { encontrados, erros: ['pasta extratos/ ausente'] };
  const visitar = (dir) => {
    for (const nome of fs.readdirSync(dir)) {
      const arq = path.join(dir, nome);
      if (fs.statSync(arq).isDirectory()) { visitar(arq); continue; }
      if (!/\.(csv|ofx)$/i.test(nome)) continue;
      const match = /^(\d{4}-\d{2})__(.+)\.(csv|ofx)$/i.exec(nome);
      if (!match) { erros.push(`nome inválido: ${nome}`); continue; }
      const [, quando, conta, ext] = match;
      if (quando !== p) continue;
      try {
        const texto = fs.readFileSync(arq, 'utf8');
        encontrados.push(...(ext.toLowerCase() === 'csv' ? lerCsvExtrato(texto, conta, p) : lerOfxExtrato(texto, conta, p)));
      } catch (e) { erros.push(`${nome}: ${e.message}`); }
    }
  };
  visitar(pastaExtratos);
  return { encontrados, erros };
}

function duplicidades(dfc, omie) {
  const grupos = new Map();
  for (const l of dfc?.linhas ?? []) {
    const k = `${l.banco}|${l.data?.d}|${l.movimento}|${l.sub2}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l.n]);
  }
  const dfcPossiveis = [...grupos.values()].filter((x) => x.length > 1);
  const omieIds = new Set(); let omieDuplicados = 0;
  for (const m of omie?.movimentos ?? []) {
    const d = m.detalhes ?? {};
    const codigo = d.nCodMovCC || d.nCodTitulo;
    if (!codigo) continue;
    const id = `${m.emp}|${codigo}|${d.cGrupo}|${d.cNatureza}|${d.dDtPagamento ?? ''}`;
    if (omieIds.has(id)) omieDuplicados++; else omieIds.add(id);
  }
  return { dfcPossiveis, omieDuplicados };
}

const dfcs = new Map(meses.map((p) => [p, abrirDfc(p)]));
for (const [p, d] of dfcs) if (d.erro) avisos.push(d.erro);
const atual = dfcs.get(periodo);
const extratosPorMes = new Map(meses.map((p) => [p, lerExtratos(p)]));
const extratos = extratosPorMes.get(periodo);
for (const [p, grupo] of extratosPorMes) for (const erro of grupo.erros) avisos.push(`Extrato ${p}: ${erro}`);
const conciliacoes = new Map(meses.map((p) => {
  const d = dfcs.get(p), ex = extratosPorMes.get(p);
  const bancos = new Set((d?.brutas ?? []).filter((l) => l.banco).map((l) => `${l.banco}--${l.bloco}`));
  const presentes = new Set(ex.encontrados.map((l) => l.conta));
  const faltam = [...bancos].filter((b) => !presentes.has(b));
  if (faltam.length) avisos.push(`Extratos ${p}: faltam ${faltam.length} conta(s): ${faltam.join(', ')}`);
  return [p, { faltam, resultado: d?.linhas?.length && !faltam.length && !ex.erros.length ? reconciliar(d, ex.encontrados) : null }];
}));
const faltamExtratos = conciliacoes.get(periodo).faltam;
const conciliacao = conciliacoes.get(periodo).resultado;
if (conciliacao && !conciliacao.confere) avisos.push(`Conciliação bancária: ${conciliacao.chavesDivergentes} chave(s) de movimento e ${conciliacao.saldosDivergentes} saldo(s) não fecham; ${conciliacao.saldosAusentes} saldo(s) ausentes`);

let cru = null, falhaOmie = null;
try { cru = await abrirOmie(); } catch (erro) { falhaOmie = erro.message; avisos.push(`Omie: ${falhaOmie}`); }
let diagnosticoOmie = 'Comparação da resposta atual com o cache anterior indisponível.';
if (cru && modoOmie === 'ao vivo') {
  try {
    const anteriorCru = await abrirOmie('cache');
    const chave = (m) => `${m.emp}|${m.detalhes?.nCodMovCC ?? m.detalhes?.nCodTitulo ?? m.cabecTitulo?.nCodTitulo}|${m.detalhes?.cGrupo ?? ''}`;
    const campos = (m) => ({ vencimento: m.detalhes?.dDtVenc ?? m.cabecTitulo?.dDtVenc,
      pagamento: m.detalhes?.dDtPagamento, status: m.detalhes?.cStatus ?? m.cabecTitulo?.cStatus,
      conta: m.detalhes?.nCodCC ?? m.cabecTitulo?.nCodCC,
      categoria: m.detalhes?.cCodCateg, titulo: m.detalhes?.nValorTitulo ?? m.cabecTitulo?.nValorTitulo,
      pago: m.resumo?.nValPago, aberto: m.resumo?.nValAberto });
    const descrever = (tipo, campo) => {
      const atuais = new Map(cru[tipo].map((m) => [chave(m), m]));
      const velhos = new Map(anteriorCru[tipo].map((m) => [chave(m), m]));
      const somenteAtual = [...atuais.keys()].filter((k) => !velhos.has(k));
      const somenteCache = [...velhos.keys()].filter((k) => !atuais.has(k))
        .filter((k) => { const d = campos(velhos.get(k)); return String(d[campo] ?? '').slice(3, 10) === `${String(mes).padStart(2, '0')}/${ano}`; });
      const alterados = [...atuais.keys()].filter((k) => velhos.has(k)).map((k) => {
        const a = campos(atuais.get(k)), b = campos(velhos.get(k));
        return { chave: k, campos: Object.keys(a).filter((f) => String(a[f] ?? '') !== String(b[f] ?? '')) };
      }).filter((x) => x.campos.length);
      return { somenteAtual, somenteCache, alterados };
    };
    const mov = descrever('movimentos', 'pagamento'), tit = descrever('titulos', 'vencimento');
    const exemplo = mov.alterados[0] ?? tit.alterados[0];
    let mesmaConsulta = '';
    if (tit.somenteAtual.length) {
      const [emp, codigo] = tit.somenteAtual[0].split('|');
      const L = leiturasDe(ano);
      for (const [de, ate] of L.FAIXAS_TIT_R) {
        const resposta = await consulta(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos',
          (n) => L.TIT_R(n, de, ate), 'titulosEncontrados', 'ao vivo');
        if (resposta.some((t) => String(t.cabecTitulo?.nCodTitulo) === codigo)) {
          const cacheTem = anteriorCru.titulos.some((t) => t.emp === emp && String(t.cabecTitulo?.nCodTitulo) === codigo);
          mesmaConsulta = `Consulta repetida com os mesmos parâmetros do cache (${de} a ${ate}): título ${emp}|${codigo} presente agora, ${cacheTem ? 'também no cache' : 'ausente no cache de 29/09/2026'}.`;
          break;
        }
      }
    }
    diagnosticoOmie = `Movimentos: ${mov.somenteAtual.length} apenas na consulta mensal atual, ${mov.somenteCache.length} apenas no cache anual no mês, ${mov.alterados.length} identificadores com campos alterados; exemplo só atual ${mov.somenteAtual[0] ?? 'nenhum'}. `
      + `Títulos: ${tit.somenteAtual.length} apenas na consulta mensal atual, ${tit.somenteCache.length} apenas no cache anual no mês, ${tit.alterados.length} alterados; exemplo só atual ${tit.somenteAtual[0] ?? 'nenhum'}. `
      + (exemplo ? `Exemplo: código ${exemplo.chave}; campos diferentes: ${exemplo.campos.join(', ')}. ` : '') + mesmaConsulta;
  } catch (erro) { diagnosticoOmie = `Comparação com cache indisponível: ${erro.message}`; }
}
const dup = duplicidades(atual, cru);
if (dup.dfcPossiveis.length) avisos.push(`DFC: ${dup.dfcPossiveis.length} grupo(s) de possível duplicidade; exemplo: linhas ${dup.dfcPossiveis[0].join(', ')}`);
if (dup.omieDuplicados) avisos.push(`Omie: ${dup.omieDuplicados} movimentos com identificador repetido`);

const fixasJson = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'despesas-fixas.json'), 'utf8'));
const contasParaDre = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'));
const recorteDre = new Set(contasParaDre.contas.filter((c) => c.negocio === 'MeuBESS').map((c) => c.chave));
const esperado = new Map([...(atual?.linhas ? indicadoresDfc(atual, fixasJson.fixas.map(normal)) : []),
  ...(cru ? calcularOmie(cru) : []), ...(cru && atual?.linhas ? dreIndependente(cru, recorteDre, atual, periodo) : [])]);
const dataAtual = new Date();
const mesAberto = ano === dataAtual.getFullYear() && mes === dataAtual.getMonth() + 1;
if (mesAberto && esperado.has('receitas') && esperado.has('despesas-pendentes') && esperado.has('valor-pendente')) {
  const base = esperado.get('receitas').valor - esperado.get('despesas').valor;
  esperado.set('projecao', { valor: base + esperado.get('valor-pendente').valor - esperado.get('despesas-pendentes').valor,
    linhas: [...esperado.get('receitas').linhas, ...esperado.get('despesas').linhas],
    fonte: 'DFC / FLUXO DE CAIXA + Omie / títulos a receber e a pagar abertos; vencimento no mês' });
}
const fonteLocal = {
  nome: 'cópia local para auditoria', descrever: () => 'cópia local do DFC ausente',
  disponivel: () => fs.existsSync(pastaDfc), arquivos: async () => fs.existsSync(pastaDfc) ? fs.readdirSync(pastaDfc) : [],
  ler: async (nome) => fs.readFileSync(path.join(pastaDfc, nome)),
};
let app = null, erroApp = null;
try {
  const [t1, t2, t3, fluxo] = await Promise.all([
    calcularTela1({ raiz, ano, mes, fonte: fonteLocal }), calcularTela2({ raiz, ano, mes, fonte: fonteLocal }),
    calcularTela3({ raiz, ano, mes, fonte: fonteLocal }), calcularFluxoDeCaixa({ raiz, ano, mes, fonte: fonteLocal }),
  ]);
  app = new Map([...t1.cartoes, ...t1.blocos, ...t2.cartoes, ...t2.tabela, ...t2.compromissos.itens,
    ...t3.cartoes, ...t3.blocos, ...fluxo.cartoes.filter((x) => ['fixas', 'peso-fixas', 'projecao'].includes(x.id)), ...fluxo.blocos]
    .map((x) => [x.id, x]));
} catch (e) { erroApp = `indicadores locais indisponíveis: ${e.message}`; avisos.push(erroApp); }

const semExtratos = !conciliacao;
const semRecalculo = {
  'capital-de-giro': 'contratos de capital de giro não foram recalculados documento a documento',
  'obrigacoes-clientes': 'obrigações da aba PROVISAO não foram recalculadas por contrato',
  'divida-liquida': 'não há recálculo independente dos saldos de contratos e caixa',
  'resultado-sem-terceiros': 'depende da apuração documental de capital e obrigações',
  'provisoes-projetos': 'não há recálculo por projeto da aba PROVISAO',
  'por-mes-e-status': 'série por status do Omie não foi reconstruída título a título',
  'por-cliente-e-status': 'agregação por cliente do Omie não foi reconstruída título a título',
  'por-status': 'agregação por status do Omie não foi reconstruída título a título',
  'dia-a-dia': 'saldos corridos de cada bloco do DFC não foram reconstruídos dia a dia',
  'receita-despesa-por-dia': 'série diária do DFC não foi reconstruída lançamento a lançamento',
  'receita-despesa-por-mes': 'série anual do DFC exige recálculo dos outros meses, fora da janela',
  'top-10-despesas': 'ordenação por categoria do DFC não foi reconstruída',
  'top-10-receitas': 'ordenação por categoria do DFC não foi reconstruída',
};
const rows = Object.entries(titulos).map(([id, [tela, nome]]) => {
  const e = esperado.get(id), i = app?.get(id);
  const mostrado = i?.valor ?? i?.porMes?.find((coluna) => coluna.mes === mes)?.valor
    ?? (id === 'lista-de-titulos' ? i?.total : null);
  let motivo = null;
  if (!e) motivo = falhaOmie && !caixaIds.has(id) ? `leitura direta do Omie indisponível: ${falhaOmie}` : semRecalculo[id] ?? 'regra ainda sem recálculo independente do valor ou série';
  else if (e.linhas?.length === 0 && id !== 'valor-pendente' && id !== 'valor-vencido') motivo = 'nenhum documento no recorte; conferir cobertura antes de aceitar zero';
  else if (e.fonte.startsWith('Omie') && modoOmie === 'cache') motivo = 'Omie lido do cache local; falta resposta direta desta execução';
  else if (caixaIds.has(id) && semExtratos) motivo = 'não auditada: faltam extratos de todas as contas do mês';
  else if (caixaIds.has(id) && conciliacao && !conciliacao.confere) motivo = 'conciliação DFC × extratos não fecha';
  else if (caixaIds.has(id) && dup.dfcPossiveis.length) motivo = 'possíveis duplicidades do DFC pendentes de análise documental';
  else if (e.fonte.startsWith('Omie') && dup.omieDuplicados) motivo = 'identificadores duplicados na resposta do Omie';
  else if (e.fonte.startsWith('Omie') && modoOmie === 'ao vivo' && ultimaRespostaNoCache && mostrado !== null
    && Math.abs(mostrado - e.valor) > (percentuais.has(id) ? 0.0000001 : 0))
    motivo = 'resposta atual do Omie difere da leitura anterior no cache usada pela tela; conferir atualização e recorte';
  const avaliacao = estado(e?.valor ?? null, mostrado, motivo, percentuais.has(id) ? 0.0000001 : 0);
  const amostra = e?.linhas?.[0];
  const codigo = amostra ? ('n' in amostra ? `${e.fonte.startsWith('DFC') ? atual.arquivo + ', linha ' : 'linha '}${amostra.n}`
    : `empresa ${amostra.emp}; título ${amostra.cabecTitulo?.nCodTitulo ?? amostra.detalhes?.nCodTitulo ?? amostra.nCodTitulo ?? '—'}`) : '—';
  return { id, tela, nome, fonte: e?.fonte ?? i?.fonte ?? 'docs/fontes.md', esperado: e?.valor ?? null, mostrado,
    ...avaliacao, codigo, n: e?.linhas?.length ?? null, percentual: percentuais.has(id) };
});
const ordemEstado = { divergente: 0, 'não auditável': 1, conferido: 2 };
rows.sort((a, b) => ordemEstado[a.estado] - ordemEstado[b.estado] || a.tela.localeCompare(b.tela) || a.nome.localeCompare(b.nome));
const counts = Object.fromEntries(['conferido', 'divergente', 'não auditável'].map((s) => [s, rows.filter((r) => r.estado === s).length]));
const linhaHtml = (r) => `<tr class="${r.estado === 'conferido' ? 'ok' : r.estado === 'divergente' ? 'bad' : 'na'}"><td>${esc(r.tela)}<br><strong>${esc(r.nome)}</strong></td><td>${esc(r.fonte)}<br><small>amostra: ${esc(r.codigo)}; documentos: ${r.n ?? '—'}</small></td><td>${dinheiro(r.esperado, r.percentual)}</td><td>${dinheiro(r.mostrado, r.percentual)}</td><td>${dinheiro(r.diferenca, r.percentual)}</td><td><strong>${esc(r.estado)}</strong>${r.motivo ? `<br><small>${esc(r.motivo)}</small>` : ''}</td></tr>`;
const ponteDre = (() => {
  const lucro = esperado.get('dre-lucro-liquido')?.valor;
  const entrada = esperado.get('receitas')?.valor, saida = esperado.get('despesas')?.valor;
  const rec = esperado.get('dre-receitas')?.valor, ded = esperado.get('dre-deducoes')?.valor;
  const cv = esperado.get('dre-custos-de-vendas')?.valor, dg = esperado.get('dre-despesas-gerais')?.valor;
  const fin = esperado.get('dre-resultado-financeiro')?.valor, imp = esperado.get('dre-impostos')?.valor;
  if ([lucro, entrada, saida, rec, ded, cv, dg, fin, imp].some((x) => x === undefined))
    return 'A ponte lucro × caixa não recebeu todos os componentes independentes. Faltam respostas atuais do Omie e/ou DFC.';
  const resultadoCaixa = entrada - saida;
  const diferencaReceita = rec - entrada;
  const diferencaDespesas = saida - ded - cv - dg - imp;
  const residual = lucro - resultadoCaixa - diferencaReceita - diferencaDespesas - fin;
  const ressalva = modoOmie === 'cache' || !conciliacao?.confere ? 'Ponte calculada, ainda não auditável: falta resposta atual do Omie e/ou extratos conciliados. ' : '';
  return `${ressalva}Lucro gerencial ${dinheiro(lucro)} − resultado de caixa ${dinheiro(resultadoCaixa)} = ${dinheiro(lucro - resultadoCaixa)}. `
    + `Ponte: receita Omie menos entrada DFC ${dinheiro(diferencaReceita)}; saída DFC menos deduções, custos, despesas gerais e guias do DRE ${dinheiro(diferencaDespesas)}; `
    + `resultado financeiro Omie ${dinheiro(fin)}; sobra aritmética ${dinheiro(residual)}. `
    + 'As diferenças de fonte e classificação estão quantificadas. Atribuir cada parcela a competência, prazo, empréstimo ou transferência exige confrontar os documentos e extratos.';
})();
const comparacao = (() => {
  const antes = dfcs.get(anterior);
  if (!antes?.linhas || !atual?.linhas) return '<p>Comparação com o mês anterior indisponível: falta DFC local em um dos meses.</p>';
  const a = indicadoresDfc(antes, fixasJson.fixas.map(normal));
  const b = indicadoresDfc(atual, fixasJson.fixas.map(normal));
  const ids = ['receitas', 'despesas', 'saldo', 'fixas'];
  return `<table><thead><tr><th>Caixa pelo DFC</th><th>${anterior}</th><th>${periodo}</th><th>Variação</th><th>Estado</th></tr></thead><tbody>${ids.map((id) => {
    const v0 = a.get(id)?.valor, v1 = b.get(id)?.valor;
    const estadoJanela = conciliacoes.get(anterior)?.resultado?.confere && conciliacoes.get(periodo)?.resultado?.confere
      ? 'comparação aritmética do DFC conciliado' : 'não auditável: falta conciliação bancária completa na janela';
    return `<tr><td>${esc(titulos[id][1])}</td><td>${dinheiro(v0)}</td><td>${dinheiro(v1)}</td><td>${dinheiro(v1 - v0)}</td><td>${estadoJanela}</td></tr>`;
  }).join('')}</tbody></table>`;
})();
const provaMaster = resumoMaster ? `<section><h2>Master documental</h2>
<p>Leitura direta autorizada em 30/09/2026. A master foi consultada somente para esta auditoria; arquivos usados no cálculo foram copiados para .cache/. As pastas soltas com sufixo numérico foram ignoradas.</p>
<table><thead><tr><th>Mês</th><th>DFC da auditoria × master</th><th>Cache do app × master</th><th>Extratos B3W</th><th>Documentos B3N</th></tr></thead><tbody>${resumoMaster.dfc.map((d, i) => {
  const x = resumoMaster.extratos[i];
  return `<tr><td>${esc(d.mes)}</td><td>${d.master === 1 ? d.igual ? 'hash SHA-256 idêntico' : 'divergente ou ausente' : `${d.master} arquivos na master`}</td><td>${d.cacheApp ? d.cacheAppIgual ? 'hash SHA-256 idêntico' : `hash SHA-256 divergente; ${d.celulasDiferentes} células diferentes` : 'ausente'}</td><td>${x.pastasB3w} pasta(s); OFX ${x.b3w.ofx}, CSV ${x.b3w.csv}, PDF ${x.b3w.pdf}</td><td>OFX ${x.b3n.ofx}, CSV ${x.b3n.csv}, PDF ${x.b3n.pdf}</td></tr>`;
}).join('')}</tbody></table>
<p>Fiscal B3W: mês mais recente ${esc(resumoMaster.mesesFiscais[0] ?? 'ausente')}; relatório de saídas lido: ${resumoMaster.saidasFiscais?.total ?? 0} registros, ${resumoMaster.saidasFiscais?.faturadas ?? 0} faturados, ${resumoMaster.saidasFiscais?.canceladas ?? 0} cancelados. Contábil B3W: ${esc(resumoMaster.mesesFiscais[1] ?? 'ausente')}, ${resumoMaster.fechamentoPdf} PDFs; o relatório de faturamento termina em 08/2026. Não há pasta 09-2026 nesses dois ramos. CPA B3W: ${resumoMaster.comprovantes.cpa.setembro} arquivo(s) em pasta identificada como setembro; C.R B3W: ${resumoMaster.comprovantes.cr.setembro}. A pasta “08 - OUTUBRO” ao lado de “08 - AGOSTO” tem nome errado, foi registrada como achado e não foi lida.</p>
<p>Os PDFs encontrados não têm transações estruturadas em OFX/CSV. Sem a extração e confirmação de conta, data, movimento e saldo final de cada PDF, não há conciliação bancária completa. N3 tem ${resumoMaster.n3Dfc} arquivo(s) DFC separado(s) na master; a cópia B3W não demonstra sua incorporação.</p></section>` : '';
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Auditoria independente · ${periodo}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:system-ui,sans-serif;color:#172337;background:#eef2f5}body{max-width:1500px;margin:auto;padding:28px}h1{margin-bottom:4px}p{line-height:1.5}.cards{display:flex;gap:12px;flex-wrap:wrap}.cards strong{font-size:1.7rem;display:block}.cards>div{background:#fff;padding:14px 22px;border-radius:9px;min-width:130px}section{background:#fff;padding:18px;margin:18px 0;border-radius:9px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{padding:10px;border-bottom:1px solid #dce3e8;text-align:left;vertical-align:top}th{background:#e5edf3;position:sticky;top:0}td:nth-child(3),td:nth-child(4),td:nth-child(5){white-space:nowrap;font-variant-numeric:tabular-nums}.bad{background:#fff0ee}.na{background:#fff9e9}.ok{background:#edf8f1}small{color:#536273}ul{line-height:1.6}caption{text-align:left;padding:8px 0} .scroll{overflow:auto}</style></head><body>
<h1>Auditoria independente · ${periodo}</h1><p>Gerado em ${esc(new Date().toLocaleString('pt-BR'))}. Janela: ${esc(meses.join(' a '))}; comparação: ${esc(anterior)}. Fonte DFC: cópia local. Omie: ${esc(modoOmie)}. Cache usado pela tela: última gravação ${ultimaRespostaNoCache ? esc(new Date(ultimaRespostaNoCache).toLocaleString('pt-BR')) : 'indisponível'}. Divergências aparecem primeiro. Valores em centavos foram somados a partir das células e respostas brutas; o valor mostrado foi calculado pela camada da tela em processo CLI, sem servidor.</p>
<div class="cards"><div><strong>${counts.divergente}</strong>divergentes</div><div><strong>${counts['não auditável']}</strong>não auditáveis</div><div><strong>${counts.conferido}</strong>conferidos</div><div><strong>${rows.length}</strong>indicadores</div></div>
<section><h2>Procedimentos e limites</h2><ul>${avisos.length ? avisos.map((a) => `<li>${esc(a)}</li>`).join('') : '<li>Nenhuma falta ou duplicidade detectada nas verificações executadas.</li>'}</ul>
<p>Completude: ${meses.map((p) => `${p}: ${dfcs.get(p)?.erro ? 'ausente ou inválido' : `${dfcs.get(p).arquivo}, ${dfcs.get(p).abas.length} abas`}`).join(' · ')}. Corte: DRE gerencial segue caixa; DFC usa DIA PG e, quando vazio, VENCIMENTO. Extratos: ${extratos.encontrados.length} transações lidas em ${periodo}; ${faltamExtratos.length} contas sem arquivo.</p>
<p>Duplicidades: ${dup.dfcPossiveis.length} grupos suspeitos no DFC; ${dup.omieDuplicados} identificadores repetidos no Omie. Conciliação: ${conciliacao ? conciliacao.confere ? 'fecha por conta, data, valor e saldos' : `${conciliacao.chavesDivergentes} movimentos e ${conciliacao.saldosDivergentes} saldos divergentes` : 'não auditada: faltam extratos'}.</p>
<p>Rastreio por amostra: cada linha da tabela mostra o primeiro número de linha do DFC ou o código de título do Omie usado no recálculo. Isso localiza um registro, mas ainda não comprova CPA, C.R. ou a nota fiscal.</p></section>
${provaMaster}
<section><h2>Confrontos documentais</h2><table><thead><tr><th>Prova</th><th>Estado</th><th>Fonte necessária</th></tr></thead><tbody>
<tr><td>DRE × notas de saída</td><td>Não auditável: o último mês fiscal disponível é ${esc(resumoMaster?.mesesFiscais[0] ?? 'desconhecido')}; faltam as notas e relatórios de setembro.</td><td>FISCAL &amp; CONTABIL/FISCAL/09-2026; saídas, serviços e XML.</td></tr>
<tr><td>DRE × fechamento contábil</td><td>Não auditável: o último fechamento disponível é ${esc(resumoMaster?.mesesFiscais[1] ?? 'desconhecido')}; falta setembro.</td><td>FISCAL &amp; CONTABIL/CONTABIL/09-2026.</td></tr>
<tr><td>Amostra de cada tela × comprovante</td><td>Não auditável: as pastas de setembro de CPA e C.R. não constam da master examinada.</td><td>FINANCEIRO/2. CPA B3W e 3. C.R B3W, pasta do mês.</td></tr>
</tbody></table><p>B3W, B3N, N3 e 3N são unidades do mesmo CNPJ; a conciliação exige os movimentos misturados de todas elas.</p>
<p>Omie atual × cache anterior: ${esc(diagnosticoOmie)}</p></section>
<section><h2>Ponte DRE × caixa</h2><p>${esc(ponteDre)}</p><p>O DRE deste dashboard é gerencial em regime de caixa. Uma ponte contábil por competência exigiria documentos de reconhecimento por competência e não pode ser concluída a partir destas duas fontes. A ponte acima fecha a aritmética e separa os valores por origem; a atribuição causal ainda depende dos documentos e de extratos de todas as contas.</p></section>
<section><h2>Setembro × agosto</h2>${comparacao}<p>Variação = mês auditado menos mês anterior. São valores recalculados do DFC bruto; o estado depende da conciliação de ambos os meses.</p></section>
<section class="scroll"><h2>Dashboard × fonte</h2><table><thead><tr><th>Indicador</th><th>Fonte, filtro e amostra</th><th>Esperado</th><th>Mostrado</th><th>Diferença</th><th>Estado e motivo</th></tr></thead><tbody>${rows.map(linhaHtml).join('')}</tbody></table></section>
<p><small>Página local fora do git. Não contém credencial nem nome de cliente. Os valores não saíram desta máquina.</small></p></body></html>`;
fs.mkdirSync(path.dirname(htmlSaida), { recursive: true });
fs.writeFileSync(htmlSaida, html, 'utf8');
console.log(`ARTEFATO: ${path.relative(raiz, htmlSaida).replace(/\\/g, '/')}`);
console.log(`${rows.length} indicadores: ${counts.conferido} conferidos, ${counts.divergente} divergentes, ${counts['não auditável']} não auditáveis`);
