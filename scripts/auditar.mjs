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
import { dreIndependente, maioresReceitas } from './auditoria/dre.mjs';
import { sinaisDeClientes, saldoDeContratos } from './auditoria/compromissos.mjs';
import * as documentos from './auditoria/documentos.mjs';
import { lerZip, sharedStrings, abasDo, lerAba } from '../lib/regras/xlsx.mjs';
import { centavos, normal, soma, lerDfcBruto, indicadoresDfc, lerCsvExtrato, lerOfxExtrato, reconciliar, aberturasDfc, estado } from './auditoria/core.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i < 0 ? padrao : args[i + 1]; };
const periodo = opt('mes', '2026-08');
if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(periodo)) throw new Error('use --mes AAAA-MM');
const [ano, mes] = periodo.split('-').map(Number);
const anterior = new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
const janela = Math.max(1, Number(opt('janela', '1')));
const meses = Array.from({ length: janela }, (_, i) => new Date(Date.UTC(ano, mes - 1 - i, 1)).toISOString().slice(0, 7)).reverse();
const modoOmie = args.includes('--cache-omie') ? 'cache' : 'ao vivo';
const pastaDfc = path.resolve(opt('dfc-dir', path.join(raiz, '.cache', `dfc-${ano}`)));
const pastaMaster = opt('master-dir', null);
// Cópia local, feita da master, dos documentos do mês (mesma estrutura de pastas). É dela que os documentos são lidos;
// com --master-dir, cada arquivo da cópia é comparado por SHA-256 com o da master.
const pastaCopia = path.resolve(opt('copia-master', path.join(raiz, '.cache', `master-${periodo}`)));
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
  // A cópia local de cada documento usado é o mesmo arquivo da master?
  const copias = listarRecursivo(pastaCopia).map((arq) => {
    const naMaster = path.join(master, path.relative(pastaCopia, arq));
    return fs.existsSync(naMaster) ? hash(arq) === hash(naMaster) : null;
  });
  const ultimos = {
    cpa: documentos.ultimaPastaMensal(path.join(master, 'B3W', 'FINANCEIRO', '2. CPA B3W', 'CPA 2026 B3W')),
    cr: documentos.ultimaPastaMensal(path.join(master, 'B3W', 'FINANCEIRO', '3. C.R B3W', '01. C. RECEBER B3W 2026')),
  };
  return { dfc, extratos, mesesFiscais, saidasFiscais, n3Dfc, fechamentoPdf: fechamentoArquivos.filter((f) => /\.pdf$/i.test(f)).length,
    copias: { total: copias.length, iguais: copias.filter((x) => x === true).length, diferentes: copias.filter((x) => x === false).length,
      semPar: copias.filter((x) => x === null).length }, ultimos,
    comprovantes: Object.fromEntries(Object.entries(comprovantes)
    .map(([tipo, arqs]) => [tipo, { total: arqs.length,
      mes: arqs.filter((a) => new RegExp(`(?:${prefixoDoMes(periodo)}[-. ]${ano}|${prefixoDoMes(periodo)}\\.${ano})`, 'i').test(path.dirname(a))).length }])) };
})();

function prefixoDoMes(p) { return p.slice(5); }

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
  const L = leiturasDe(ano), result = { titulos: [], pendentes: [], movimentos: [], categorias: [], titulosAno: [], pedidos: [] };
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
    // Os sinais de clientes são posição de fim de mês: pedem a carteira do ano (vencimento em 2026) e os pedidos.
    if (modo === 'ao vivo')
      for (const [de, ate] of L.FAIXAS_TIT_R) result.titulosAno.push(...(await consulta(emp, 'financas/pesquisartitulos', 'PesquisarLancamentos', (n) => L.TIT_R(n, de, ate), 'titulosEncontrados', modo)).map((x) => ({ ...x, emp })));
    else result.titulosAno.push(...titulos.map((x) => ({ ...x, emp })));
    result.pedidos.push(...(await consulta(emp, 'produtos/pedido', 'ListarPedidos', L.PEDIDOS, 'pedido_venda_produto', modo)).map((x) => ({ ...x, emp })));
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
  const encontrados = [], erros = [], provas = new Map();
  if (!fs.existsSync(pastaExtratos)) return { encontrados, erros: ['pasta extratos/ ausente'], provas };
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
        // A prova da conversão de PDF (scripts/auditoria/extrato-pdf.py), quando o CSV saiu de um PDF.
        const prova = arq.replace(/\.(csv|ofx)$/i, '.json');
        if (fs.existsSync(prova)) provas.set(normal(conta), JSON.parse(fs.readFileSync(prova, 'utf8')));
      } catch (e) { erros.push(`${nome}: ${e.message}`); }
    }
  };
  visitar(pastaExtratos);
  return { encontrados, erros, provas };
}

function duplicidades(dfc, omie) {
  const grupos = new Map();
  for (const l of dfc?.linhas ?? []) {
    const k = `${l.banco}|${l.data?.d}|${l.movimento}|${l.sub2}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l.n]);
  }
  const dfcPossiveis = [...grupos.values()].filter((x) => x.length > 1);
  // Identidade de uma linha de movimento: o movimento de conta corrente, o título e a baixa. Uma baixa em lote é um
  // nCodMovCC só com uma linha por título baixado (nCodTitulo e nCodBaixa próprios); sem os três, o lote parecia
  // repetição. Os lotes são contados à parte, com a prova de que as partes somam o movimento.
  const omieIds = new Set(); let omieDuplicados = 0;
  const porMovimento = new Map();
  for (const m of omie?.movimentos ?? []) {
    const d = m.detalhes ?? {};
    if (!d.nCodMovCC && !d.nCodTitulo) continue;
    const id = `${m.emp}|${d.nCodMovCC ?? ''}|${d.nCodTitulo ?? ''}|${d.nCodBaixa ?? ''}|${d.cGrupo}|${d.cNatureza}|${d.dDtPagamento ?? ''}`;
    if (omieIds.has(id)) omieDuplicados++; else omieIds.add(id);
    if (d.nCodMovCC && String(d.dDtPagamento ?? '').slice(3, 10) === `${String(mes).padStart(2, '0')}/${ano}`) {
      const k = `${m.emp}|${d.nCodMovCC}|${d.cGrupo}`;
      porMovimento.set(k, [...(porMovimento.get(k) ?? []), m]);
    }
  }
  const lotes = [...porMovimento].filter(([, xs]) => xs.length > 1).map(([chave, xs]) => ({
    chave, linhas: xs.length, titulos: new Set(xs.map((m) => m.detalhes.nCodTitulo)).size,
    baixas: new Set(xs.map((m) => m.detalhes.nCodBaixa)).size,
    fecha: soma(xs.map((m) => centavos(m.resumo?.nValPago))) === centavos(xs[0].detalhes.nValorMovCC),
  }));
  const tituloIds = new Set(); let omieTitulosDuplicados = 0;
  for (const t of omie?.titulos ?? []) {
    const id = `${t.emp}|${t.cabecTitulo?.nCodTitulo ?? ''}`;
    if (!t.cabecTitulo?.nCodTitulo) continue;
    if (tituloIds.has(id)) omieTitulosDuplicados++; else tituloIds.add(id);
  }
  return { dfcPossiveis, omieDuplicados, omieTitulosDuplicados, lotes };
}

const dfcs = new Map(meses.map((p) => [p, abrirDfc(p)]));
for (const [p, d] of dfcs) if (d.erro) avisos.push(d.erro);
const atual = dfcs.get(periodo);
const linhasN3 = (atual?.linhas ?? []).filter((l) => normal(l.empDfc) === 'N3');
const extratosPorMes = new Map(meses.map((p) => [p, lerExtratos(p)]));
const extratos = extratosPorMes.get(periodo);
for (const [p, grupo] of extratosPorMes) for (const erro of grupo.erros) avisos.push(`Extrato ${p}: ${erro}`);
const conciliacoes = new Map(meses.map((p) => {
  const d = dfcs.get(p), ex = extratosPorMes.get(p);
  // Toda conta (bloco) do FLUXO DE CAIXA, com ou sem movimento no mês, precisa de extrato.
  const contas = [...new Set((d?.brutas ?? []).map((l) => normal(l.conta)))];
  const presentes = new Set(ex.encontrados.map((l) => l.conta));
  const faltam = contas.filter((b) => !presentes.has(b));
  if (faltam.length) avisos.push(`Extratos ${p}: faltam ${faltam.length} conta(s): ${faltam.join(', ')}`);
  return [p, { contas, faltam, resultado: d?.linhas?.length && ex.encontrados.length && !ex.erros.length
    ? reconciliar(d, ex.encontrados, { provas: ex.provas }) : null }];
}));
const faltamExtratos = conciliacoes.get(periodo).faltam;
const conciliacao = conciliacoes.get(periodo).resultado;
const caixaCompleto = Boolean(conciliacao?.confere && !faltamExtratos.length);
if (conciliacao) for (const r of conciliacao.porConta.values()) if (!r.confere)
  avisos.push(`Conciliação ${r.conta}: ${r.soExtrato.length} movimento(s) só no extrato, ${r.soDfc.length} linha(s) só no DFC${r.mesInteiro ? '' : `; o PDF cobre só ${r.prova?.periodoDoPdf?.join(' a ')}`}${r.saldosFecham ? '' : '; abertura ou fechamento não fecham'}`);
// Por que uma conta não prova as linhas dela; null quando concilia inteira.
const motivoDaConta = (conta) => {
  const r = conciliacao?.porConta.get(conta);
  if (r?.confere) return null;
  if (r) return `${conta}: extrato não concilia (${[r.soExtrato.length && `${r.soExtrato.length} movimento(s) só no extrato`,
    r.soDfc.length && `${r.soDfc.length} linha(s) só no DFC`, !r.mesInteiro && `o PDF cobre só ${r.prova?.periodoDoPdf?.join(' a ')}`,
    !r.saldosFecham && 'abertura ou fechamento não fecham'].filter(Boolean).join('; ')})`;
  if (/^DINHEIRO/.test(conta)) return `${conta}: caixa em espécie, sem extrato bancário, e sem recibo na master do mês`;
  return `${conta}: sem extrato na master de ${periodo}`;
};
const provadas = new Set((atual?.linhas ?? []).filter((l) => conciliacao?.porConta.get(normal(l.conta))?.confere
  && conciliacao.casadas.has(l.n)).map((l) => l.n));
const eLinhaDfc = (l) => l && typeof l.n === 'number' && typeof l.conta === 'string';
// Linhas do DFC de um número que o extrato não prova, agrupadas pela conta e com o motivo dela.
function semProvaBancaria(linhas) {
  const dfc = (linhas ?? []).filter(eLinhaDfc);
  const falta = dfc.filter((l) => !provadas.has(l.n));
  if (!falta.length) return null;
  const porConta = new Map();
  for (const l of falta) porConta.set(normal(l.conta), (porConta.get(normal(l.conta)) ?? 0) + 1);
  return `sem prova bancária para ${falta.length} de ${dfc.length} linha(s) do DFC — ${[...porConta]
    .map(([c, n]) => `${n} linha(s) de ${motivoDaConta(c) ?? `${c}: linha sem par no extrato`}`).join('; ')}`;
}

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
    const porCampo = (grupo) => Object.entries(grupo.alterados.flatMap((x) => x.campos)
      .reduce((m, campo) => { m[campo] = (m[campo] ?? 0) + 1; return m; }, {}))
      .map(([campo, n]) => `${campo}: ${n}`).join(', ') || 'nenhum';
    const mesmaConsultaAlterada = [];
    const conferirMesmoRecorte = async (tipo, grupo) => {
      const caso = grupo.alterados[0];
      if (!caso) return;
      const antigo = anteriorCru[tipo].find((m) => chave(m) === caso.chave);
      if (!antigo) return;
      const L = leiturasDe(ano), emp = antigo.emp;
      let servico, call, param, campo;
      if (tipo === 'titulos') {
        const venc = antigo.cabecTitulo?.dDtVenc ?? '';
        const ordem = (d) => d.split('/').reverse().join('-');
        const faixa = L.FAIXAS_TIT_R.find(([de, ate]) => ordem(venc) >= ordem(de) && ordem(venc) <= ordem(ate));
        if (!faixa) return;
        [servico, call, param, campo] = ['financas/pesquisartitulos', 'PesquisarLancamentos',
          (n) => L.TIT_R(n, ...faixa), 'titulosEncontrados'];
      } else {
        [servico, call, param, campo] = ['financas/mf', 'ListarMovimentos', L.MF, 'movimentos'];
      }
      const novaResposta = await consulta(emp, servico, call, param, campo, 'ao vivo');
      const novo = novaResposta.find((m) => chave({ ...m, emp }) === caso.chave);
      const mudados = novo ? Object.keys(campos(antigo)).filter((k) => String(campos(antigo)[k] ?? '') !== String(campos(novo)[k] ?? '')) : [];
      mesmaConsultaAlterada.push(`${tipo} ${caso.chave}: ${novo
        ? (mudados.length ? `mesma consulta atual difere do cache nos campos ${mudados.join(', ')}`
          : 'mesma consulta atual coincide com o cache nos campos comparados; diferença da janela mensal')
        : 'ausente na mesma consulta atual'}`);
    };
    for (const [tipo, grupo] of [['movimentos', mov], ['titulos', tit]]) {
      try { await conferirMesmoRecorte(tipo, grupo); }
      catch (erro) { mesmaConsultaAlterada.push(`${tipo}: repetição da consulta indisponível (${erro.message})`); }
    }
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
    diagnosticoOmie = `Movimentos: ${mov.somenteAtual.length} apenas na consulta mensal atual, ${mov.somenteCache.length} apenas no cache anual no mês, ${mov.alterados.length} identificadores com campos alterados (${porCampo(mov)}); exemplo só atual ${mov.somenteAtual[0] ?? 'nenhum'}. `
      + `Títulos: ${tit.somenteAtual.length} apenas na consulta mensal atual, ${tit.somenteCache.length} apenas no cache anual no mês, ${tit.alterados.length} alterados (${porCampo(tit)}); exemplo só atual ${tit.somenteAtual[0] ?? 'nenhum'}. `
      + (exemplo ? `Exemplo: código ${exemplo.chave}; campos diferentes: ${exemplo.campos.join(', ')}. ` : '')
      + (mesmaConsultaAlterada.length ? `Mesmo recorte: ${mesmaConsultaAlterada.join('; ')}. ` : '') + mesmaConsulta;
  } catch (erro) { diagnosticoOmie = `Comparação com cache indisponível: ${erro.message}`; }
}
const dup = duplicidades(atual, cru);
// Um grupo suspeito do DFC (mesma conta, dia, valor e SUB 2) deixa de ser suspeito quando cada linha dele casou com uma
// transação própria do extrato de uma conta que concilia inteira.
const dfcPendentes = dup.dfcPossiveis.filter((g) => g.some((n) => !provadas.has(n)));
if (dup.dfcPossiveis.length) avisos.push(`DFC: ${dup.dfcPossiveis.length} grupo(s) de possível duplicidade; ${dup.dfcPossiveis.length - dfcPendentes.length} resolvido(s) pelo extrato (cada linha com transação própria)${dfcPendentes.length ? `; pendentes: linhas ${dfcPendentes.map((g) => g.join('+')).join(', ')}` : ''}`);
if (dup.omieDuplicados) avisos.push(`Omie: ${dup.omieDuplicados} movimentos com identificador repetido`);
if (dup.lotes.length) avisos.push(`Omie: ${dup.lotes.length} baixa(s) em lote no mês (${soma(dup.lotes.map((l) => l.linhas))} linhas, ${soma(dup.lotes.map((l) => l.linhas - 1))} além da primeira de cada lote); cada linha tem título e baixa próprios; partes somam o movimento em ${dup.lotes.filter((l) => l.fecha).length} de ${dup.lotes.length}`);
if (dup.omieTitulosDuplicados) avisos.push(`Omie: ${dup.omieTitulosDuplicados} títulos com identificador repetido`);

const fixasJson = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'despesas-fixas.json'), 'utf8'));
const contasParaDre = JSON.parse(fs.readFileSync(path.join(raiz, 'dados', 'contas-correntes-por-negocio.json'), 'utf8'));
const recorteDre = new Set(contasParaDre.contas.filter((c) => c.negocio === 'MeuBESS').map((c) => c.chave));
const esperado = new Map([...(atual?.linhas ? indicadoresDfc(atual, fixasJson.fixas.map(normal)) : []),
  ...(cru ? calcularOmie(cru) : []), ...(cru && atual?.linhas ? dreIndependente(cru, recorteDre, atual, periodo) : [])]);
// Séries refeitas a partir das linhas cruas, sem usar os agrupadores das telas.
if (atual?.linhas) {
  const porClasse = new Map();
  const saidas = atual.linhas.filter((l) => l.movimento < 0);
  for (const l of saidas) porClasse.set(l.classe, (porClasse.get(l.classe) ?? 0) - l.movimento);
  const serie = [...porClasse].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 10);
  esperado.set('top-10-despesas', { valor: soma(serie.map((x) => x.valor)), serie, linhas: saidas,
    fonte: 'DFC / FLUXO DE CAIXA; saídas agrupadas por CLASS. CONTABIL, dez maiores' });
}
if (cru) {
  const faixa = (s) => {
    const x = normal(s).replace(/\s/g, '');
    if (x === 'CANCELADO') return null;
    if (['RECEBIDO', 'LIQUIDADO'].includes(x)) return 'pago';
    if (x === 'ATRASADO') return 'atrasado';
    if (['EMABERTO', 'AVENCER', 'VENCEHOJE', 'PAGTOPARCIAL'].includes(x)) return 'aberto';
    return 'outro';
  };
  const titulosMes = cru.titulos.filter((t) => recorteDre.has(`${t.emp}|${t.cabecTitulo?.nCodCC}`)
    && String(t.cabecTitulo?.dDtVenc ?? '').slice(3, 10) === `${String(mes).padStart(2, '0')}/${ano}`
    && faixa(t.cabecTitulo?.cStatus) !== null);
  const status = { total: titulosMes.length, pago: 0, atrasado: 0, aberto: 0 };
  const clientes = new Map();
  for (const t of titulosMes) {
    const f = faixa(t.cabecTitulo?.cStatus);
    if (f in status) status[f]++;
    const codigo = String(t.cabecTitulo?.nCodCliente ?? ''), chave = `${t.emp}|${codigo}`;
    if (!clientes.has(chave)) clientes.set(chave, { empresa: t.emp, codigo, total: 0, pago: 0, atrasado: 0, aberto: 0 });
    const c = clientes.get(chave), v = centavos(t.cabecTitulo?.nValorTitulo);
    c.total += v;
    if (f in c) c[f] += v;
  }
  const porCliente = [...clientes.values()].sort((a, b) => a.empresa.localeCompare(b.empresa) || a.codigo.localeCompare(b.codigo));
  const fonte = 'Omie / PesquisarLancamentos; títulos com vencimento no mês, sem CANCELADO, conta MeuBESS';
  for (const id of ['por-status', 'por-mes-e-status'])
    esperado.set(id, { valor: status.total, serie: status, linhas: titulosMes, fonte });
  esperado.set('por-cliente-e-status', { valor: soma(porCliente.map((c) => c.total)), serie: porCliente,
    linhas: titulosMes, fonte: `${fonte}; por empresa e código de cliente` });
}
// ---------------------------------------------------------------- recálculos desta rodada
const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const corteDoMes = Date.UTC(ano, mes - 1, ultimoDia);
const TRANSFERENCIA = 'TRANSFERENCIAS BANCARIAS - RECEITA';
// As partes do DFC que entram nas linhas mistas do DRE (deduções, custos e impostos): a prova bancária vale para elas.
if (atual?.linhas) {
  const partes = (ids) => ids.flatMap((id) => esperado.get(id)?.linhas ?? []);
  for (const id of ['dre-receita-liquida']) if (esperado.has(id)) esperado.get(id).linhasDfc = partes(['dre-deducoes']);
  for (const id of ['dre-lucro-bruto', 'dre-ebitda', 'cartao-ebitda']) if (esperado.has(id)) esperado.get(id).linhasDfc = partes(['dre-deducoes', 'dre-custos-de-vendas']);
  for (const id of ['dre-lucro-liquido', 'cartao-lucro-liquido', 'cartao-margem']) if (esperado.has(id)) esperado.get(id).linhasDfc = partes(['dre-deducoes', 'dre-custos-de-vendas', 'dre-impostos']);
}
if (cru) {
  const mr = maioresReceitas(cru, recorteDre, periodo);
  esperado.set('top-10-receitas', { valor: soma(mr.serie.map((x) => x.valor)), serie: mr.serie.map((x) => x.valor), linhas: mr.linhas,
    fonte: 'Omie / financas/mf ListarMovimentos; recebimentos do mês, contas MeuBESS, sem transferência nem par de adiantamento; dez maiores por valor',
    valorDaSerie: (s) => soma(s ?? []) });
}
// Receita × despesa: a tela desenha o bloco pronto Entradas/Gastos da primeira aba do arquivo do mês. O esperado é o
// caixa do mês por dia, das linhas baixadas do FLUXO DE CAIXA (a mesma base conciliada com o extrato). À parte, o
// bloco é refeito das próprias fórmulas (SUMIFS sobre a tabela de lançamentos da aba) para separar erro de conta de
// tabela não mantida.
let blocoDoMes = null;
if (atual?.linhas) {
  const doDia = (d) => atual.linhas.filter((l) => l.data.d === d);
  const serieDia = Array.from({ length: ultimoDia }, (_, k) => ({ dia: k + 1,
    entradas: soma(doDia(k + 1).filter((l) => l.movimento > 0 && l.sub2 !== TRANSFERENCIA).map((l) => l.movimento)),
    gastos: soma(doDia(k + 1).filter((l) => l.movimento < 0).map((l) => -l.movimento)) }));
  try {
    const zip = lerZip(fs.readFileSync(path.join(pastaDfc, atual.arquivo))), ss = sharedStrings(zip), aba = abasDo(zip)[0];
    const rs = lerAba(zip, aba.parte, ss);
    // O quadro diário: a linha "Inicial" que tem a linha de dias logo acima; Entradas e Gastos logo abaixo dela.
    const dias = rs.find((r) => rs.some((x) => x.n === r.n + 1 && normal(x.cel.get('B')?.t) === 'INICIAL') && r.cel.get('D')?.v === 1);
    const abaixo = (t) => rs.find((r) => dias && r.n > dias.n && r.n <= dias.n + 4 && normal(r.cel.get('B')?.t) === t);
    const [ent, gas] = [abaixo('ENTRADAS'), abaixo('GASTOS')];
    if (!dias || !ent || !gas) throw new Error('quadro Inicial/Entradas/Gastos não encontrado');
    const colunas = dias ? [...dias.cel].filter(([c, v]) => c !== 'C' && typeof v.v === 'number').map(([c, v]) => [c, v.v]) : [];
    const gravado = (r) => colunas.map(([c]) => centavos(r?.cel.get(c)?.v ?? 0));
    // As fórmulas: SUMIFS(E, D, dia, F, "RECEBIDO") e SUMIFS(J, I, dia, K, "PAGO") sobre a tabela abaixo do bloco.
    // O dia da tabela vem como texto ("06"), e o Excel o casa com o número do dia.
    const tabela = rs.filter((r) => r.n > (gas?.n ?? 0) + 4);
    const refeito = (colDia, colValor, colStatus, status) => colunas.map(([, dia]) => soma(tabela
      .filter((r) => Number(r.cel.get(colDia)?.v ?? r.cel.get(colDia)?.t) === dia && normal(r.cel.get(colStatus)?.t) === status).map((r) => centavos(r.cel.get(colValor)?.v))));
    blocoDoMes = { aba: aba.nome.trim(), entradas: gravado(ent), gastos: gravado(gas).map((v) => -v),
      formulasIguais: JSON.stringify(gravado(ent)) === JSON.stringify(refeito('D', 'E', 'F', 'RECEBIDO'))
        && JSON.stringify(gravado(gas)) === JSON.stringify(refeito('I', 'J', 'K', 'PAGO')) };
  } catch (e) { avisos.push(`Bloco Entradas/Gastos: ${e.message}`); }
  const diasComEntrada = (s) => s.filter((x) => x.entradas).length;
  const explicacao = blocoDoMes ? `a tela reproduz o bloco pronto Entradas/Gastos da aba "${blocoDoMes.aba}" (${blocoDoMes.formulasIguais
    ? 'as fórmulas SUMIFS refeitas dão os valores gravados' : 'as fórmulas SUMIFS refeitas NÃO dão os valores gravados'}), mas a tabela que o bloco soma não foi mantida no mês: entrada em ${blocoDoMes.entradas.filter(Boolean).length} dia(s) e gasto em ${blocoDoMes.gastos.filter(Boolean).length}, contra entrada em ${diasComEntrada(serieDia)} dia(s) e gasto em ${serieDia.filter((x) => x.gastos).length} no FLUXO DE CAIXA conciliado`
    : 'bloco Entradas/Gastos não lido';
  const saldoDaSerie = (s) => (Array.isArray(s) ? soma(s.map((x) => x.entradas - x.gastos)) : s ? s.entradas - s.gastos : null);
  esperado.set('receita-despesa-por-dia', { valor: saldoDaSerie(serieDia), serie: serieDia, linhas: atual.linhas,
    fonte: 'DFC / FLUXO DE CAIXA; por dia, entradas sem transferência e saídas, linhas baixadas (valor = entradas − gastos do mês)',
    valorDaSerie: saldoDaSerie, motivoSerie: explicacao });
  const doMes = { entradas: soma(serieDia.map((x) => x.entradas)), gastos: soma(serieDia.map((x) => x.gastos)) };
  esperado.set('receita-despesa-por-mes', { valor: saldoDaSerie(doMes), serie: doMes, linhas: atual.linhas,
    fonte: `DFC / FLUXO DE CAIXA; coluna de ${periodo} (entradas sem transferência − saídas). Os outros meses da série ficam fora da janela`,
    valorDaSerie: saldoDaSerie, motivoSerie: explicacao });
  // O dia a dia: a posição parte da soma das aberturas de todas as contas e anda com todas as linhas do dia
  // (transferência inclusive); entrou e saiu são as dos cartões.
  let posicao = soma([...aberturasDfc(atual).values()]);
  const serieCaixa = Array.from({ length: ultimoDia }, (_, k) => {
    const ls = doDia(k + 1);
    posicao += soma(ls.map((l) => l.movimento));
    return { dia: k + 1, entrou: soma(ls.filter((l) => l.movimento > 0 && l.sub2 !== TRANSFERENCIA).map((l) => l.movimento)),
      saiu: soma(ls.filter((l) => l.movimento < 0).map((l) => -l.movimento)), acumulado: posicao };
  });
  esperado.set('dia-a-dia', { valor: posicao, serie: serieCaixa, linhas: atual.linhas,
    fonte: 'DFC / FLUXO DE CAIXA; aberturas (SALDO INICIAL) de todas as contas + linhas baixadas por dia (valor = posição no último dia)',
    valorDaSerie: (s) => (Array.isArray(s) ? s.at(-1)?.acumulado ?? null : null) });
}
// Transferência entre contas escrita só pela metade: a saída de uma conta sem data nem PAGAMENTO (fica fora do caixa
// baixado) e a entrada do mesmo valor noutra conta como TRANSFERENCIAS BANCARIAS - RECEITA (fica dentro). O saldo do
// mês e a posição dia a dia contam a entrada sem a saída.
const meiasTransferencias = (atual?.brutas ?? []).filter((b) => b.movimento < 0 && !b.pagamento && !b.data)
  .map((b) => ({ saida: b, entrada: atual.linhas.find((l) => l.sub2 === TRANSFERENCIA && l.movimento === -b.movimento && l.conta !== b.conta) }))
  .filter((x) => x.entrada);
if (meiasTransferencias.length) avisos.push(`Transferências pela metade: ${meiasTransferencias.length} saída(s) de ${[...new Set(meiasTransferencias.map((x) => x.saida.conta))].join(', ')} sem data nem PAGAMENTO (linhas ${meiasTransferencias.map((x) => x.saida.n).join(', ')}) têm a entrada no ${[...new Set(meiasTransferencias.map((x) => x.entrada.conta))].join(', ')} (linhas ${meiasTransferencias.map((x) => x.entrada.n).join(', ')}${meiasTransferencias.every((x) => provadas.has(x.entrada.n)) ? ', todas casadas no extrato' : ''}); o Saldo do mês e a posição dia a dia somam a entrada sem a saída`);
// Capital de giro: cada contrato pela melhor fonte documental. As CCBs do Itaú (PDF na master) pelo Anexo I; os
// contratos sem CCB legível pela planilha de contratos. À parte, a planilha inteira é refeita pela regra do dono para
// dizer se a tela reproduz a planilha.
const contratos = (() => {
  const planilha = [path.join(pastaCopia, 'B3W', 'DFC', String(ano), 'CONTRATOS - CAPITAL DE GIRO.xlsx'),
    path.join(raiz, '.cache', 'contratos', 'CONTRATOS - CAPITAL DE GIRO.xlsx')].find((a) => fs.existsSync(a));
  if (!planilha) return null;
  const zip = lerZip(fs.readFileSync(planilha)), rs = lerAba(zip, abasDo(zip)[0].parte, sharedStrings(zip));
  const pelaPlanilha = saldoDeContratos(rs, corteDoMes);
  const numeroDa = (linha) => String(rs.find((r) => r.n === linha)?.cel.get('B')?.t ?? rs.find((r) => r.n === linha)?.cel.get('B')?.v ?? '').trim();
  const ccbs = documentos.listar(path.join(pastaCopia, 'B3W', 'DFC', String(ano))).filter((a) => /ContratoCCB.*\.pdf$/i.test(a))
    .map((a) => documentos.contratoCcb(a)).filter((c) => c?.numero && c.financiado);
  const ext = extratos.encontrados;
  const porContrato = (pelaPlanilha.contratos ?? []).map((c) => {
    const numero = numeroDa(c.linha), ccb = ccbs.find((x) => x.numero === numero);
    if (!ccb) return { numero, fonte: 'planilha', saldo: c.saldo, planilha: c.saldo };
    const vencidas = ccb.parcelas.filter((p) => p.venc <= corteDoMes);
    const doMes = vencidas.filter((p) => new Date(p.venc).getUTCMonth() + 1 === mes);
    const debitadas = doMes.filter((p) => ext.some((t) => t.valor === -(p.juros + p.principal)
      && Math.abs(Date.parse(`${t.data}T00:00:00Z`) - p.venc) <= 4 * 86400000));
    return { numero, fonte: 'CCB', saldo: documentos.saldoCcb(ccb, corteDoMes), planilha: c.saldo,
      completas: vencidas.every((p, i) => p.n === i + 1), credito: ccb.credito, financiado: ccb.financiado,
      carencia: ccb.parcelas.findIndex((p) => p.principal > 0), doMes: doMes.length, debitadas: debitadas.length };
  });
  return { ok: pelaPlanilha.ok, planilha: pelaPlanilha.saldo, porContrato, saldo: soma(porContrato.map((c) => c.saldo ?? 0)),
    completo: porContrato.every((c) => c.saldo !== null) };
})();
if (contratos?.ok) {
  const ccb = contratos.porContrato.filter((c) => c.fonte === 'CCB'), soPlanilha = contratos.porContrato.filter((c) => c.fonte === 'planilha');
  esperado.set('capital-de-giro', { valor: contratos.saldo, linhas: contratos.porContrato, contratos,
    fonte: `CCB do Itaú, Anexo I (${ccb.length} contrato(s)): total financiado − principal vencido + juros corridos desde a última parcela; ${soPlanilha.length} contrato(s) pela planilha de contratos` });
}
// Dívida líquida: capital de giro − saldo final das contas do FLUXO DE CAIXA (abertura + linhas do mês).
if (esperado.has('capital-de-giro') && atual?.linhas) {
  const aberturas = aberturasDfc(atual);
  const finais = [...aberturas].map(([conta, abertura]) => abertura + soma(atual.linhas.filter((l) => l.conta === conta).map((l) => l.movimento)));
  esperado.set('divida-liquida', { valor: esperado.get('capital-de-giro').valor - soma(finais), linhas: atual.linhas,
    fonte: 'capital de giro (acima) − saldo final de cada conta do FLUXO DE CAIXA (SALDO INICIAL + linhas baixadas do mês)' });
}
if (cru?.titulosAno?.length) {
  const s = sinaisDeClientes({ titulos: cru.titulosAno, pedidos: cru.pedidos, recorte: recorteDre, ano, mes });
  const fonteSinais = 'Omie / PesquisarLancamentos (carteira com vencimento no ano) + produtos/pedido ListarPedidos; sinais ADVR pagos e sem NF no fim do mês';
  esperado.set('obrigacoes-clientes', { valor: s.saldo, linhas: s.linhas, fonte: fonteSinais });
  if (esperado.has('dre-lucro-liquido'))
    esperado.set('resultado-sem-terceiros', { valor: esperado.get('dre-lucro-liquido').valor - s.variacao, linhas: s.linhas,
      linhasDfc: esperado.get('dre-lucro-liquido').linhasDfc, fonte: `lucro líquido (recálculo acima) − variação dos sinais em aberto no mês; ${fonteSinais}` });
}
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
let app = null, erroApp = null, fluxoApp = null;
try {
  const [t1, t2, t3, fluxo] = await Promise.all([
    calcularTela1({ raiz, ano, mes, fonte: fonteLocal }), calcularTela2({ raiz, ano, mes, fonte: fonteLocal }),
    calcularTela3({ raiz, ano, mes, fonte: fonteLocal }), calcularFluxoDeCaixa({ raiz, ano, mes, fonte: fonteLocal }),
  ]);
  fluxoApp = fluxo;
  app = new Map([...t1.cartoes, ...t1.blocos, ...t2.cartoes, ...t2.tabela, ...t2.compromissos.itens,
    ...t3.cartoes, ...t3.blocos, ...fluxo.cartoes.filter((x) => ['fixas', 'peso-fixas', 'projecao'].includes(x.id)), ...fluxo.blocos]
    .map((x) => [x.id, x]));
} catch (e) { erroApp = `indicadores locais indisponíveis: ${e.message}`; avisos.push(erroApp); }

// A aba PROVISÃO de agosto: o que ela tem, contado aqui, para o motivo do número que a tela não mostra.
const provisaoDoMes = (() => {
  try {
    const zip = lerZip(fs.readFileSync(path.join(pastaDfc, atual.arquivo))), ss = sharedStrings(zip);
    const aba = abasDo(zip).find((a) => normal(a.nome) === 'PROVISAO');
    if (!aba) return null;
    const rs = lerAba(zip, aba.parte, ss).filter((r) => r.n > 1);
    const sub2 = rs.map((r) => normal(r.cel.get('H')?.t)).filter((x) => x && !x.startsWith('SALDO'));
    return { linhas: sub2.length, tipos: [...new Set(sub2)].length, projetos: new Set(rs.map((r) => r.cel.get('E')?.t ?? r.cel.get('E')?.v).filter(Boolean)).size };
  } catch { return null; }
})();
const semRecalculo = {
  'provisoes-projetos': `não há número a provar: a tela mostra "sem provisão por projeto neste mês", porque a aba PROVISÃO de ${periodo} é uma lista de lançamentos${provisaoDoMes ? ` (${provisaoDoMes.linhas} linhas de ${provisaoDoMes.tipos} tipos de SUB 2, ${provisaoDoMes.projetos} projetos)` : ''} e não o quadro por projeto que a regra do dono lê (o quadro existe a partir de setembro). Aplicar a regra a essa lista é decisão do dono`,
  projecao: `não há número a provar: a projeção só existe em mês aberto e ${periodo} está fechado; a tela não mostra valor`,
  'capital-de-giro': 'planilha de contratos ausente na cópia local',
  'obrigacoes-clientes': 'carteira do ano e pedidos do Omie não foram lidos nesta execução',
  'resultado-sem-terceiros': 'depende dos sinais de clientes e do lucro líquido recalculados',
  'divida-liquida': 'depende do capital de giro recalculado',
};
const rows = Object.entries(titulos).map(([id, [tela, nome]]) => {
  const e = esperado.get(id), i = app?.get(id);
  const serieMostrada = id === 'top-10-despesas' ? i?.dados?.map(({ nome, valor }) => ({ nome: normal(nome), valor }))
    : id === 'por-cliente-e-status' ? i?.dados?.map(({ empresa, codigo, total, pago, atrasado, aberto }) =>
      ({ empresa, codigo, total, pago, atrasado, aberto })).sort((a, b) => a.empresa.localeCompare(b.empresa) || a.codigo.localeCompare(b.codigo))
    : id === 'por-status' ? i?.dados
    : id === 'por-mes-e-status' ? i?.dados?.find((x) => x.mes === mes)
    : id === 'top-10-receitas' ? i?.dados?.map((x) => x.valor)
    : id === 'receita-despesa-por-dia' ? i?.dados?.map(({ dia, entradas, gastos }) => ({ dia, entradas, gastos }))
    : id === 'receita-despesa-por-mes' ? (({ entradas, gastos } = {}) => (entradas === undefined ? null : { entradas, gastos }))(i?.dados?.find((x) => x.mes === mes))
    : id === 'dia-a-dia' ? fluxoApp?.diaADia?.dias?.map(({ dia, entrou, saiu, acumulado }) => ({ dia, entrou, saiu, acumulado })) : null;
  const serieComparavel = id === 'por-mes-e-status' && serieMostrada
    ? Object.fromEntries(['total', 'pago', 'atrasado', 'aberto'].map((k) => [k, serieMostrada[k]])) : serieMostrada;
  const mostrado = e?.valorDaSerie ? e.valorDaSerie(serieComparavel)
    : e?.serie && serieComparavel
      ? (Array.isArray(serieComparavel) ? soma(serieComparavel.map((x) => x.valor ?? x.total)) : serieComparavel.total)
      : i?.valor ?? i?.porMes?.find((coluna) => coluna.mes === mes)?.valor
      ?? (id === 'lista-de-titulos' ? i?.total : null);
  const diferente = e && mostrado !== null && mostrado !== undefined && Math.abs(mostrado - e.valor) > (percentuais.has(id) ? 0.0000001 : 0);
  // As linhas do DFC que este número usa e o extrato precisa provar (as do próprio número, ou as partes do DFC de uma
  // linha mista do DRE).
  const linhasDfc = e ? (e.linhasDfc ?? (e.fonte.startsWith('DFC') || ['receita-despesa-por-dia', 'receita-despesa-por-mes', 'dia-a-dia', 'divida-liquida'].includes(id) ? e.linhas : [])) : [];
  const provaBanco = semProvaBancaria(linhasDfc);
  const dupDfc = dfcPendentes.filter((g) => g.some((n) => linhasDfc.some((l) => l.n === n)));
  let motivo = null;
  if (!e) motivo = falhaOmie && !caixaIds.has(id) ? `leitura direta do Omie indisponível: ${falhaOmie}` : semRecalculo[id] ?? 'regra ainda sem recálculo independente do valor ou série';
  else if (e.linhas?.length === 0 && id !== 'valor-pendente' && id !== 'valor-vencido') motivo = 'nenhum documento no recorte; conferir cobertura antes de aceitar zero';
  else if (e.fonte.startsWith('Omie') && modoOmie === 'cache') motivo = 'Omie lido do cache local; falta resposta direta desta execução';
  else if (e.fonte.includes('PesquisarLancamentos') && dup.omieTitulosDuplicados) motivo = 'títulos com identificador repetido na resposta do Omie';
  else if (e.serie && JSON.stringify(e.serie) !== JSON.stringify(serieComparavel)) motivo = e.motivoSerie ?? 'agrupamento da série difere entre fonte atual e tela';
  else if (e.fonte.includes('financas/mf') && dup.omieDuplicados) motivo = 'identificadores duplicados na resposta de movimentos do Omie';
  else if (e.fonte.startsWith('Omie') && modoOmie === 'ao vivo' && ultimaRespostaNoCache && diferente)
    motivo = e.fonte.includes('PesquisarLancamentos')
      ? 'resposta atual difere do cache usado pela tela; mesma consulta confirmou alteração de título em pago e aberto'
      : 'resposta atual do Omie difere do cache usado pela tela; consultar a causa por lançamento';
  else if (id === 'capital-de-giro' || (id === 'divida-liquida' && diferente)) {
    const c = esperado.get('capital-de-giro').contratos;
    const ccb = c.porContrato.filter((x) => x.fonte === 'CCB');
    const capitalNaTela = id === 'capital-de-giro' ? mostrado : i?.saldoDevedor ?? null;
    const bancosNaTela = i?.saldoDosBancos ?? null;
    const bancosEsperados = id === 'divida-liquida' ? esperado.get('capital-de-giro').valor - e.valor : null;
    motivo = [diferente ? `o capital de giro da tela ${c.planilha === capitalNaTela ? 'reproduz ao centavo' : 'NÃO reproduz'} a planilha de contratos (recálculo independente pela regra do dono), e a planilha não segue as CCBs` : null,
      id === 'divida-liquida' && bancosNaTela !== null ? `saldo dos bancos: tela ${dinheiro(bancosNaTela)} (último SALDO escrito em cada bloco) × ${dinheiro(bancosEsperados)} (SALDO INICIAL + linhas baixadas)${meiasTransferencias.length ? `; a diferença ${bancosNaTela - bancosEsperados === -soma(meiasTransferencias.map((x) => x.entrada.movimento)) ? 'é exatamente' : 'inclui'} a(s) ${meiasTransferencias.length} saída(s) de transferência sem PAGAMENTO (linhas ${meiasTransferencias.map((x) => x.saida.n).join(', ')}), que o saldo escrito desconta e as linhas baixadas não` : ''}` : null,
      ...ccb.map((x) => `CCB ${x.numero}: a planilha usa o valor do crédito, a CCB financia o crédito mais IOF e ECG${x.credito === x.financiado ? ' (iguais)' : ''}; ${x.carencia > 0 ? `as ${x.carencia} primeiras parcelas são só de juros` : 'amortiza desde a 1ª parcela'}, e a planilha amortiza pela Price desde a 1ª; parcela(s) de ${periodo} debitada(s) no extrato: ${x.debitadas} de ${x.doMes}${x.completas ? '' : '; cronograma lido incompleto'}`),
      ...c.porContrato.filter((x) => x.fonte === 'planilha').map((x) => `contrato ${x.numero}: sem CCB legível na master (o PDF do Sicoob é imagem sem texto), saldo pela planilha`),
      id === 'divida-liquida' ? provaBanco : null].filter(Boolean).join('. ');
  }
  else if (provaBanco) motivo = provaBanco + (['saldo', 'dia-a-dia'].includes(id) && meiasTransferencias.length
    ? `; além disso, ${meiasTransferencias.length} transferência(s) entram pela metade (saídas nas linhas ${meiasTransferencias.map((x) => x.saida.n).join(', ')} sem data nem PAGAMENTO, entradas nas linhas ${meiasTransferencias.map((x) => x.entrada.n).join(', ')}): o número soma ${dinheiro(soma(meiasTransferencias.map((x) => x.entrada.movimento)))} de entrada sem a saída` : '');
  else if (dupDfc.length) motivo = `possível duplicidade no DFC sem prova bancária: linhas ${dupDfc.map((g) => g.join('+')).join(', ')}`;
  const avaliacao = estado(e?.valor ?? null, mostrado, motivo, percentuais.has(id) ? 0.0000001 : 0);
  const amostra = e?.linhas?.[0];
  const codigo = !amostra ? '—' : eLinhaDfc(amostra) ? `${atual.arquivo}, linha ${amostra.n}${provadas.has(amostra.n) ? ` ↔ extrato ${normal(amostra.conta)} ${conciliacao.casadas.get(amostra.n).join('+')}` : ''}`
    : amostra.numero ? `contrato ${amostra.numero} (${amostra.fonte})`
    : amostra.titulo && amostra.pago ? `empresa ${amostra.emp}; sinal ${amostra.titulo}`
    : `empresa ${amostra.emp}; título ${amostra.cabecTitulo?.nCodTitulo ?? amostra.detalhes?.nCodTitulo ?? amostra.nCodTitulo ?? '—'}${amostra.nCodMovCC ? `; movimento ${amostra.nCodMovCC}` : ''}`;
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
// ---------------------------------------------------------------- documentos da master (cópia local)
const mm = String(mes).padStart(2, '0');
const docs = (() => {
  if (!fs.existsSync(pastaCopia)) return null;
  const F = path.join(pastaCopia, 'B3W', 'FISCAL & CONTABIL', 'FISCAL', `${mm}-${ano}`);
  const C = path.join(pastaCopia, 'B3W', 'FISCAL & CONTABIL', 'CONTABIL', `${mm}-${ano}`);
  const fiscal = documentos.listar(F);
  const saidas = fiscal.filter((a) => normal(path.basename(a)).startsWith('REL. SAIDAS') && /\.xlsx$/i.test(a))
    .map((a) => ({ onde: path.relative(F, path.dirname(a)).split(path.sep)[0], ...documentos.notasDeSaida(a, periodo) }));
  const servicos = fiscal.filter((a) => normal(path.basename(a)).startsWith('REL. SERVICOS PRESTADOS') && /\.xlsx$/i.test(a))
    .map((a) => ({ onde: path.relative(F, path.dirname(a)).split(path.sep)[0], ...documentos.servicosPrestados(a, periodo) }));
  const contabil = documentos.listar(C);
  const fat = contabil.find((a) => /FATURAMENTO/i.test(path.basename(a)) && /\.pdf$/i.test(a));
  const faturamento = fat ? documentos.faturamentoDoContador(fat, periodo) : null;
  const fechamento = contabil.filter((a) => /BALANCETE|DRE|RAZ[AÃ]O|BALAN[CÇ]O|DEMONSTRA/i.test(normal(path.basename(a))));
  const notasPj = documentos.notasPj(path.join(pastaCopia, 'B3W', 'FINANCEIRO', '7. NFs PJ - B3W', `NFs PJ ${mm}.${ano}`));
  const unidade = (sigla, rel) => { const arq = documentos.listar(path.join(pastaCopia, rel)).find((a) => /\.xlsx$/i.test(a));
    return arq && atual?.linhas ? { sigla, ...documentos.compararUnidade(atual, arq, sigla, ano, mes) } : null; };
  const unidades = [unidade('N3', path.join('N3', 'DFC', String(ano))), unidade('3N', path.join('3N', 'DFC', String(ano))),
    unidade('B3N', path.join('B3N', 'DFC', String(ano)))].filter(Boolean);
  const extratosPdf = documentos.listar(path.join(pastaCopia, 'B3W', 'FINANCEIRO', '1. EXTRATOS B3W', String(ano)))
    .filter((a) => /\.(pdf|png)$/i.test(a)).map((a) => path.basename(a));
  return { saidas, servicos, faturamento, contabil: contabil.map((a) => path.basename(a)), fechamento, notasPj, unidades, extratosPdf };
})();
const chavesFiscais = new Map((docs?.saidas ?? []).flatMap((s) => s.notas.map((n) => [n.chave, { ...n, onde: s.onde }])));
const tituloDoAno = new Map((cru?.titulosAno ?? []).map((t) => [`${t.emp}|${t.cabecTitulo?.nCodTitulo}`, t.cabecTitulo]));
const noExtrato = (valor, quando) => extratos.encontrados.find((t) => t.valor === valor && quando !== null
  && Math.abs(Date.parse(`${t.data}T00:00:00Z`) - quando) <= 4 * 86400000 && conciliacao?.porConta.get(t.conta)?.confere);
const dataOmie = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '')); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; };
// A amostra de cada tela, do número até o documento.
const amostras = (() => {
  const out = [];
  // Tela 1: uma saída do DFC provada pelo extrato cujo valor é o de uma nota de prestador PJ do mês.
  const pj = (docs?.notasPj ?? []);
  // Só nota cujo valor é único entre as notas do mês, e de preferência linha de pessoal PJ: casar por valor não pode
  // ser coincidência.
  const unicas = (v) => pj.filter((n) => n.valores.includes(v));
  const ePj = (l) => ['DESPESAS PJ', 'COMISSAO DE VENDAS'].includes(l.sub2) || ['PESSOAL PJ', 'DESPESA PJ'].includes(l.classe);
  const l1 = (esperado.get('despesas')?.linhas ?? []).filter((l) => provadas.has(l.n)).sort((a, b) => ePj(b) - ePj(a))
    .map((l) => ({ l, notas: unicas(-l.movimento) })).filter((x) => x.notas.length === 1).map((x) => ({ l: x.l, nota: x.notas[0] }))[0];
  out.push(l1 ? { tela: 'Gestão de Contas · Despesas', cadeia: [`DFC ${atual.arquivo}, linha ${l1.l.n} (${l1.l.sub2}, ${String(l1.l.data.d).padStart(2, '0')}/${mm})`,
    `extrato ${normal(l1.l.conta)} ${conciliacao.casadas.get(l1.l.n).join('+')}`, `NFs PJ ${mm}.${ano}/${l1.nota.grupo}, NF ${l1.nota.numero} (mesmo valor)`],
  falta: `comprovante de pagamento em CPA: a pasta CPA 2026 da master vai até ${resumoMaster?.ultimos?.cpa?.n ?? 'mês não identificado'}` }
    : { tela: 'Gestão de Contas · Despesas', cadeia: [], falta: 'nenhuma saída provada pelo extrato tem o valor de uma nota PJ do mês' });
  // Telas 2 e 3: um recebimento do Omie com a NF-e de saída do mês (pela chave de acesso) e o crédito no extrato.
  const comNota = (xs, excluir) => xs.map((d) => {
    const emp = d.emp, cod = String(d.nCodTitulo ?? d.cabecTitulo?.nCodTitulo ?? '');
    const cab = tituloDoAno.get(`${emp}|${cod}`) ?? d.cabecTitulo;
    const nota = cab?.cChaveNFe ? chavesFiscais.get(String(cab.cChaveNFe).trim()) : null;
    const valor = centavos(d.resumo?.nValPago ?? d.nValorTitulo ?? d.cabecTitulo?.nValorTitulo);
    const pago = dataOmie(d.dDtPagamento ?? d.cabecTitulo?.dDtPagamento ?? cab?.dDtPagamento);
    return { emp, cod, nota, ext: noExtrato(valor, pago) };
  }).find((x) => x.nota && x.ext && x.cod !== excluir);
  const t2 = comNota(esperado.get('dre-receitas')?.linhas ?? []);
  out.push(t2 ? { tela: 'DRE · (+) Receitas', cadeia: [`Omie empresa ${t2.emp}, título ${t2.cod}`, `NF-e ${t2.nota.numero} (${t2.nota.onde}, REL. SAÍDAS ${mm}-${ano}, linha ${t2.nota.linha}, chave de acesso igual)`,
    `extrato ${t2.ext.conta} ${t2.ext.id} (${t2.ext.data}, mesmo valor)`], falta: `comprovante em C.R.: a pasta C. RECEBER 2026 da master vai até ${resumoMaster?.ultimos?.cr?.n ?? 'mês não identificado'}` }
    : { tela: 'DRE · (+) Receitas', cadeia: [], falta: 'nenhum recebimento do mês tem ao mesmo tempo NF-e de saída do mês e crédito num extrato conciliado' });
  const t3 = comNota(esperado.get('valor-recebido')?.linhas ?? [], t2?.cod);
  out.push(t3 ? { tela: 'Fluxo de Caixa · Valor recebido', cadeia: [`Omie empresa ${t3.emp}, título ${t3.cod}`, `NF-e ${t3.nota.numero} (${t3.nota.onde}, REL. SAÍDAS ${mm}-${ano}, linha ${t3.nota.linha}, chave de acesso igual)`,
    `extrato ${t3.ext.conta} ${t3.ext.id} (${t3.ext.data}, mesmo valor)`], falta: `comprovante em C.R.: a pasta C. RECEBER 2026 da master vai até ${resumoMaster?.ultimos?.cr?.n ?? 'mês não identificado'}` }
    : { tela: 'Fluxo de Caixa · Valor recebido', cadeia: [], falta: 'nenhum título recebido com vencimento no mês tem ao mesmo tempo NF-e de saída do mês e crédito num extrato conciliado' });
  return out;
})();
// N3: o caso da linha 169 até o Omie e o extrato.
const n3 = docs?.unidades.find((u) => u.sigla === 'N3') ?? null;
const casoN3 = (() => {
  const l = atual?.linhas?.find((x) => x.n === 169 && normal(x.empDfc) === 'N3') ?? atual?.linhas?.find((x) => normal(x.empDfc) === 'N3');
  if (!l) return null;
  const par = n3?.pares.find(([b]) => b === l.n)?.[1] ?? null;
  const omie = (cru?.movimentos ?? []).find((m) => String(m.detalhes?.nCodTitulo) === '6039461776');
  return { linha: l.n, dia: l.data.d, sub2: l.sub2, par, extrato: provadas.has(l.n) ? conciliacao.casadas.get(l.n).join('+') : null,
    omie: omie ? { emp: omie.emp, pago: omie.detalhes.dDtPagamento, igual: centavos(omie.resumo?.nValPago ?? omie.detalhes.nValorTitulo) === -l.movimento } : null };
})();
const tabelaContas = `<table><thead><tr><th>Conta do DFC (bloco)</th><th>Extrato</th><th>Casamentos</th><th>Abertura e fechamento</th><th>Estado</th></tr></thead><tbody>${conciliacoes.get(periodo).contas.map((conta) => {
  const r = conciliacao?.porConta.get(conta);
  if (!r) return `<tr class="na"><td>${esc(conta)}</td><td>—</td><td>—</td><td>—</td><td>${esc(motivoDaConta(conta))}</td></tr>`;
  return `<tr class="${r.confere ? 'ok' : 'bad'}"><td>${esc(conta)}</td><td>${esc(r.prova?.pdf ?? 'CSV/OFX')}${r.prova ? `<br><small>${r.prova.saldosConferidos} saldo(s) do PDF conferidos na conversão; período do PDF ${esc(r.prova.periodoDoPdf?.join(' a '))}${Object.keys(r.prova.excluidos ?? {}).length ? `; fora: ${esc(Object.entries(r.prova.excluidos).map(([k, n]) => `${n} ${k}`).join(', '))}` : ''}</small>` : ''}</td><td>${r.transacoes} transações × ${r.linhasDfc} linhas: ${r.tipos.exato} exatos, ${r.tipos.deslocado} com data deslocada, ${r.tipos.agrupado} lotes, ${r.tipos.loteDoDia} lote(s) do dia${r.soDfc.length ? `<br><small>só no DFC: linhas ${esc(r.soDfc.join(', '))}</small>` : ''}${r.soExtrato.length ? `<br><small>só no extrato: ${esc(r.soExtrato.join(', '))}</small>` : ''}</td><td>abertura DFC ${dinheiro(r.aberturaDfc)} × extrato ${dinheiro(r.aberturaExtrato)}<br>fechamento DFC ${dinheiro(r.fechamentoDfc)} × extrato ${dinheiro(r.fechamentoExtrato)}</td><td><strong>${r.confere ? 'concilia' : 'não concilia'}</strong>${r.confere ? '' : `<br><small>${esc(motivoDaConta(conta))}</small>`}</td></tr>`;
}).join('')}</tbody></table>`;
const secaoDocumentos = !docs ? '<section><h2>Documentos da master</h2><p>Cópia local da master ausente: nenhum documento fiscal, contábil ou comprovante foi lido.</p></section>' : (() => {
  const nfe = soma(docs.saidas.map((s) => s.valorFaturado)), nfse = soma(docs.servicos.map((s) => s.valor));
  const f = docs.faturamento;
  const receitaDre = esperado.get('dre-receitas')?.valor ?? null;
  const notasComTitulo = [...chavesFiscais.values()].filter((n) => [...tituloDoAno.values()].some((c) => String(c.cChaveNFe ?? '').trim() === n.chave));
  return `<section><h2>Documentos da master: fiscal e contábil de ${esc(periodo)}</h2>
<table><thead><tr><th>Documento</th><th>O que diz</th><th>Confronto</th></tr></thead><tbody>
${docs.saidas.map((s) => `<tr><td>FISCAL/${mm}-${ano}/${esc(s.onde)}/${esc(s.arquivo)}</td><td>${s.total} NF-e emitidas no mês: ${s.faturadas} faturadas (${dinheiro(s.valorFaturado)}), ${s.canceladas} canceladas, ${s.outras} em outra situação</td><td>—</td></tr>`).join('')}
${docs.servicos.map((s) => `<tr><td>FISCAL/${mm}-${ano}/${esc(s.onde)}/${esc(s.arquivo)}</td><td>${s.total} NFS-e no mês, ${s.validas} válidas (${dinheiro(s.valor)}), ${s.canceladas} canceladas</td><td>—</td></tr>`).join('')}
<tr class="${f?.achado && f.saidas === nfe && f.servicos === nfse ? 'ok' : 'bad'}"><td>CONTABIL/${mm}-${ano}, relatório de faturamento do contador${f?.assinado ? ' (assinado digitalmente)' : ''}</td><td>${f?.achado ? `saídas ${dinheiro(f.saidas)}, serviços ${dinheiro(f.servicos)}, total ${dinheiro(f.total)}; CNPJ ${esc(f.cnpj ?? '—')}` : 'linha do mês não encontrada'}</td><td>${f?.achado ? `contador − NF-e faturadas: ${dinheiro(f.saidas - nfe)}; contador − NFS-e válidas: ${dinheiro(f.servicos - nfse)}. ${f.saidas === nfe && f.servicos === nfse ? 'Iguais.' : 'Divergente: nenhuma combinação das naturezas de operação das NF-e reproduz o total de saídas do contador; o relatório dele não lista as notas, então a diferença não se explica com os documentos da master.'}` : '—'}</td></tr>
<tr class="${docs.fechamento.length ? 'ok' : 'na'}"><td>CONTABIL/${mm}-${ano} (fechamento)</td><td>${docs.contabil.length} arquivo(s): ${esc(docs.contabil.join('; '))}</td><td>${docs.fechamento.length ? 'balancete ou DRE do contador presente' : 'Não auditável: não há balancete nem DRE do contador para o mês na master; só o faturamento e os coeficientes. O DRE da tela não tem contraparte contábil a confrontar.'}</td></tr>
<tr class="na"><td>DRE (+) Receitas × notas do mês</td><td>DRE de caixa (Omie, pagamento no mês): ${dinheiro(receitaDre)}; NF-e faturadas + NFS-e válidas (emissão no mês): ${dinheiro(nfe + nfse)}</td><td>diferença ${receitaDre === null ? '—' : dinheiro(receitaDre - nfe - nfse)} — regimes diferentes (caixa × emissão), não é erro por si. Das ${chavesFiscais.size} NF-e faturadas do mês, ${notasComTitulo.length} têm título no Omie pela chave de acesso (carteira do ano lida agora).</td></tr>
</tbody></table>
<p>Notas de prestadores PJ do mês: ${docs.notasPj.length} PDF(s) lidos, ${docs.notasPj.filter((n) => n.valores.length).length} com valor impresso. Comprovantes: a pasta CPA 2026 da master vai até ${esc(resumoMaster?.ultimos?.cpa?.n ?? 'mês não identificado')} e a C. RECEBER 2026 até ${esc(resumoMaster?.ultimos?.cr?.n ?? 'mês não identificado')}; não há pasta de ${esc(periodo)} em nenhuma das duas. Extratos em PDF/imagem na pasta do mês: ${esc(docs.extratosPdf.join('; '))}.</p></section>
<section><h2>Amostra de cada tela até o documento</h2><table><thead><tr><th>Tela e número</th><th>Cadeia</th><th>O que falta</th></tr></thead><tbody>${amostras.map((a) => `<tr class="${a.cadeia.length ? 'ok' : 'na'}"><td>${esc(a.tela)}</td><td>${a.cadeia.length ? esc(a.cadeia.join(' → ')) : '—'}</td><td>${esc(a.falta)}</td></tr>`).join('')}</tbody></table></section>`;
})();
const secaoN3 = `<section><h2>N3 no DFC B3W</h2><p>O DFC B3W de ${esc(periodo)} tem ${linhasN3.length} linha(s) baixada(s) com <code>EMP.=N3</code>. ${n3
  ? `O DFC separado de N3 da master tem ${n3.linhasSeparado} linha(s) baixada(s) no mês, no bloco ${esc(n3.contasSeparado.join(', '))}: ${n3.pares.length} casam uma a uma com as linhas <code>EMP.=N3</code> do B3W (mesmo dia, valor e SUB 2), ${n3.soSeparado.length} só existem no arquivo de N3 e ${n3.emOutraLinha.length} casam com linha de outra unidade; soma do arquivo de N3 ${dinheiro(n3.somaSeparado)} × soma das linhas N3 do B3W ${dinheiro(n3.somaNoPrincipal)}. <strong>${n3.soSeparado.length === 0 && n3.pares.length === n3.linhasSeparado ? 'N3 já está dentro do DFC B3W: o arquivo separado é a mesma movimentação vista só pelas linhas de N3, não um adicional.' : 'O arquivo de N3 tem lançamentos que o B3W não tem: é adicional nessa parte.'}</strong>`
  : 'O DFC separado de N3 não está na cópia local.'} ${casoN3 ? `Caso: linha ${casoN3.linha} do B3W (dia ${casoN3.dia}, ${esc(casoN3.sub2)}) ${casoN3.par ? `= linha ${casoN3.par} do DFC de N3` : 'sem par no DFC de N3'}${casoN3.extrato ? `; casada no extrato do Itaú (${esc(casoN3.extrato)})` : ''}${casoN3.omie ? `; título 6039461776 no Omie (empresa ${casoN3.omie.emp}, pago em ${esc(casoN3.omie.pago)}, ${casoN3.omie.igual ? 'mesmo valor' : 'valor diferente'})` : '; título 6039461776 não veio na leitura de movimentos do mês'}.` : ''} A tela lê só o DFC B3W e soma as linhas sem filtrar <code>EMP.</code>: cada linha de N3 entra uma vez. Nenhuma soma foi alterada.</p>
${(docs?.unidades ?? []).filter((u) => u.sigla !== 'N3').map((u) => `<p>DFC separado de ${esc(u.sigla)}: ${u.linhasSeparado} linha(s) baixada(s) no mês, bloco(s) ${esc(u.contasSeparado.join(', '))}; ${u.pares.length} casam com linhas <code>EMP.=${esc(u.sigla)}</code> do B3W, ${u.emOutraLinha.length} com linha de outra unidade e ${u.soSeparado.length} só existem no arquivo de ${esc(u.sigla)}. Essas contas não estão no DFC B3W e não entram nas telas.</p>`).join('')}</section>`;
const provaMaster = resumoMaster ? `<section><h2>Master documental</h2>
<p>Leitura direta autorizada em 30/09/2026. A master foi consultada somente para esta auditoria; arquivos usados no cálculo foram copiados para .cache/. As pastas soltas com sufixo numérico foram ignoradas.</p>
<table><thead><tr><th>Mês</th><th>DFC da auditoria × master</th><th>Cache do app × master</th><th>Extratos B3W</th><th>Documentos B3N</th></tr></thead><tbody>${resumoMaster.dfc.map((d, i) => {
  const x = resumoMaster.extratos[i];
  return `<tr><td>${esc(d.mes)}</td><td>${d.master === 1 ? d.igual ? 'hash SHA-256 idêntico' : 'divergente ou ausente' : `${d.master} arquivos na master`}</td><td>${d.cacheApp ? d.cacheAppIgual ? 'hash SHA-256 idêntico' : `hash SHA-256 divergente; ${d.celulasDiferentes} células diferentes` : 'ausente'}</td><td>${x.pastasB3w} pasta(s); OFX ${x.b3w.ofx}, CSV ${x.b3w.csv}, PDF ${x.b3w.pdf}</td><td>OFX ${x.b3n.ofx}, CSV ${x.b3n.csv}, PDF ${x.b3n.pdf}</td></tr>`;
}).join('')}</tbody></table>
<p>Cópias locais dos documentos do mês (.cache/): ${resumoMaster.copias.total} arquivo(s), ${resumoMaster.copias.iguais} com SHA-256 igual ao da master, ${resumoMaster.copias.diferentes} diferente(s), ${resumoMaster.copias.semPar} sem par. A pasta “08 - OUTUBRO” ao lado de “08 - AGOSTO” tem nome errado e não foi usada.</p></section>` : '';
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Auditoria independente · ${periodo}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:system-ui,sans-serif;color:#172337;background:#eef2f5}body{max-width:1500px;margin:auto;padding:28px}h1{margin-bottom:4px}p{line-height:1.5}.cards{display:flex;gap:12px;flex-wrap:wrap}.cards strong{font-size:1.7rem;display:block}.cards>div{background:#fff;padding:14px 22px;border-radius:9px;min-width:130px}section{background:#fff;padding:18px;margin:18px 0;border-radius:9px}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{padding:10px;border-bottom:1px solid #dce3e8;text-align:left;vertical-align:top}th{background:#e5edf3;position:sticky;top:0}td:nth-child(3),td:nth-child(4),td:nth-child(5){white-space:nowrap;font-variant-numeric:tabular-nums}.bad{background:#fff0ee}.na{background:#fff9e9}.ok{background:#edf8f1}small{color:#536273}ul{line-height:1.6}caption{text-align:left;padding:8px 0} .scroll{overflow:auto}</style></head><body>
<h1>Auditoria independente · ${periodo}</h1><p>Gerado em ${esc(new Date().toLocaleString('pt-BR'))}. Janela: ${esc(meses.join(' a '))}; comparação: ${esc(anterior)}. Fonte DFC: cópia local. Omie: ${esc(modoOmie)}. Cache usado pela tela: última gravação ${ultimaRespostaNoCache ? esc(new Date(ultimaRespostaNoCache).toLocaleString('pt-BR')) : 'indisponível'}. Divergências aparecem primeiro. Valores em centavos foram somados a partir das células e respostas brutas; o valor mostrado foi calculado pela camada da tela em processo CLI, sem servidor.</p>
<div class="cards"><div><strong>${counts.divergente}</strong>divergentes</div><div><strong>${counts['não auditável']}</strong>não auditáveis</div><div><strong>${counts.conferido}</strong>conferidos</div><div><strong>${rows.length}</strong>indicadores</div></div>
<section><h2>Procedimentos e limites</h2><ul>${avisos.length ? avisos.map((a) => `<li>${esc(a)}</li>`).join('') : '<li>Nenhuma falta ou duplicidade detectada nas verificações executadas.</li>'}</ul>
<p>Completude: ${meses.map((p) => `${p}: ${dfcs.get(p)?.erro ? 'ausente ou inválido' : `${dfcs.get(p).arquivo}, ${dfcs.get(p).abas.length} abas`}`).join(' · ')}. Corte: DRE gerencial segue caixa; DFC usa DIA PG e, quando vazio, VENCIMENTO. Extratos: ${extratos.encontrados.length} transações lidas em ${periodo}; contas sem extrato: ${faltamExtratos.length ? esc(faltamExtratos.join(', ')) : 'nenhuma'}.</p>
<p>Duplicidades: ${dup.dfcPossiveis.length} grupos suspeitos no DFC, ${dfcPendentes.length} sem prova bancária; ${dup.omieDuplicados} movimentos e ${dup.omieTitulosDuplicados} títulos com identificador repetido no Omie; ${dup.lotes.length} baixas em lote. Caixa: ${caixaCompleto ? 'todas as contas conciliadas' : 'nem todas as contas conciliadas (tabela abaixo)'}.</p></section>
<section><h2>Caixa: DFC × extratos, conta a conta</h2>${tabelaContas}<p>Casamento: mesma data e valor; mesmo valor com até 4 dias de diferença; várias linhas do DFC num débito só do banco (lote), ou o contrário; e, no fim, o que sobra no mesmo dia se as somas forem iguais ao centavo. Os CSV saíram dos PDFs da master por <code>scripts/auditoria/extrato-pdf.py</code>, que só grava se cada saldo impresso no PDF fechar com as transações.</p></section>
${provaMaster}
${secaoN3}
${secaoDocumentos}
<section><h2>Omie</h2><p>Omie atual × cache anterior: ${esc(diagnosticoOmie)}</p></section>
<section><h2>Ponte DRE × caixa</h2><p>${esc(ponteDre)}</p><p>O DRE deste dashboard é gerencial em regime de caixa. Uma ponte contábil por competência exigiria documentos de reconhecimento por competência e não pode ser concluída a partir destas duas fontes. A ponte acima fecha a aritmética e separa os valores por origem; a atribuição causal ainda depende dos documentos e de extratos de todas as contas.</p></section>
<section><h2>${esc(anterior)} × ${esc(periodo)}</h2>${comparacao}<p>Variação = mês auditado menos mês anterior. São valores recalculados do DFC bruto; o estado depende da conciliação de ambos os meses.</p></section>
<section class="scroll"><h2>Dashboard × fonte</h2><table><thead><tr><th>Indicador</th><th>Fonte, filtro e amostra</th><th>Esperado</th><th>Mostrado</th><th>Diferença</th><th>Estado e motivo</th></tr></thead><tbody>${rows.map(linhaHtml).join('')}</tbody></table></section>
<p><small>Página local fora do git. Não contém credencial nem nome de cliente. Os valores não saíram desta máquina.</small></p></body></html>`;
fs.mkdirSync(path.dirname(htmlSaida), { recursive: true });
fs.writeFileSync(htmlSaida, html, 'utf8');
console.log(`ARTEFATO: ${path.relative(raiz, htmlSaida).replace(/\\/g, '/')}`);
console.log(`${rows.length} indicadores: ${counts.conferido} conferidos, ${counts.divergente} divergentes, ${counts['não auditável']} não auditáveis`);
