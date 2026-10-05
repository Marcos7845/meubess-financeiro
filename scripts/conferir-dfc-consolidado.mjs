#!/usr/bin/env node
// Imprime apenas no terminal: nenhum valor em reais é gravado em arquivo versionado.
// DFC_DIR deve apontar para uma cópia local: raiz com 3N/B3N/B3W/N3 ou pasta B3W isolada.
import { fonteDoDfc, UNIDADES } from '../lib/regras/dfc-fonte.mjs';
import { lerDfc, eReceitaTela1Dfc, saidasPagasDoDfc } from '../lib/regras/dfc.mjs';
import { lerZip, sharedStrings, abasDo, lerAba } from '../lib/regras/xlsx.mjs';

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : padrao;
};
const ano = Number(arg('--ano', '2026'));
const mes = Number(arg('--mes', '8'));
if (!process.env.DFC_DIR) throw new Error('use DFC_DIR com cópia local fora de pasta sincronizada');
const fonte = fonteDoDfc();
const r = await lerDfc({ fonte, ano, mes, comSerie: false });
if (!r.ok) throw new Error(r.motivo);
const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const somar = (ls) => ls.reduce((s, l) => s + l.valor, 0);
const publicar = (unidade, ls, arquivo) => {
  const entrou = somar(ls.filter(eReceitaTela1Dfc));
  const saiu = somar(ls.filter((l) => l.natureza === 'P'));
  console.log(`${ano}-${String(mes).padStart(2, '0')} | ${unidade} | ${arquivo} | linhas=${ls.length} | Tela1 Saldo=${reais(somar(ls))} | Tela1 Receitas / Tela3 Entrou=${reais(entrou)} | Tela1 Despesas / Tela3 Saiu=${reais(saiu)} | Tela3 Resultado=${reais(entrou + saiu)}`);
};
for (const u of UNIDADES) if (r.porUnidade[u]) publicar(u, r.linhas.filter((l) => l.unidade === u), r.porUnidade[u].arquivo);
if (Object.keys(r.porUnidade).length === UNIDADES.length) publicar('CONSOLIDADO', r.linhas, '3N+B3N+B3W+N3');
else console.log(`CONSOLIDADO: a conferir; faltam ${UNIDADES.filter((u) => !r.porUnidade[u]).join(', ')}.`);
console.log(`N3 repetidas por data, valor e histórico: ${r.porUnidade.N3 ? r.repetidasN3 : 'a conferir'}; B3N sem bloco BANCO ITAÚ: ${r.porUnidade.B3N ? r.porUnidade.B3N.linhas.length : 'a conferir'} linhas.`);
if (mes === 9 && r.porUnidade.B3W) {
  const z = lerZip(await fonte.ler(r.porUnidade.B3W.arquivo));
  const a = abasDo(z).find((x) => x.nome === 'FLUXO DE CAIXA');
  const linhas = lerAba(z, a.parte, sharedStrings(z));
  const totalL = (selecionadas) => selecionadas.reduce((s, l) => s + Math.round(Number(l.cel.get('L')?.v ?? 0) * 100), 0);
  const itauCru = totalL(linhas.filter((l) => l.n >= 3 && l.n <= 371));
  const totalCru = totalL(linhas);
  const itauTela = saidasPagasDoDfc(r.porUnidade.B3W.linhas, 'ITAU').reduce((s, l) => s + l.valor, 0);
  const totalTela = saidasPagasDoDfc(r.porUnidade.B3W.linhas).reduce((s, l) => s + l.valor, 0);
  if (itauTela !== itauCru || totalTela !== totalCru) throw new Error('Saídas da tela divergiram da coluna L crua da B3W');
  console.log(`B3W fonte crua FLUXO DE CAIXA, SAIDA (L) linhas 3:371=${reais(itauCru)}; coluna L inteira=${reais(totalCru)}; ambos iguais ao cartão Saídas/PAGO.`);
}

if (process.argv.includes('--telas')) {
  const { novaBase } = await import('../lib/regras/base-local.mjs');
  const { calcularTela1 } = await import('../lib/indicadores/tela-1.mjs');
  const { calcularTela2 } = await import('../lib/indicadores/tela-2.mjs');
  const { calcularFluxoDeCaixa } = await import('../lib/indicadores/fluxo-de-caixa.mjs');
  const raiz = process.cwd();
  const base = novaBase({ raiz, ano, fonte });
  const fichas = [
    ['Tela 1', calcularTela1, ['saldo', 'receitas', 'despesas', 'despesas-pagas', 'despesas-pendentes', 'despesas-funcionarios', 'percentual-funcionarios']],
    ['Tela 2', calcularTela2, ['receita-total', 'custos-e-despesas', 'cartao-ebitda', 'cartao-lucro-liquido', 'cartao-margem']],
    ['Tela 3', calcularFluxoDeCaixa, ['entrou', 'saiu', 'saidas', 'resultado', 'a-pagar', 'a-receber', 'projecao', 'fixas', 'peso-fixas']],
  ];
  console.log('Fontes: [DFC] planilha da unidade na linha acima; [Omie] cache local das empresas 1 e 2; [Omie+DFC] linha calculada do DRE; [conta] cálculo dos cartões indicados. Percentuais em %.');
  for (const unidade of [...UNIDADES.filter((u) => r.porUnidade[u]), ...(Object.keys(r.porUnidade).length === 4 ? ['CONSOLIDADO'] : [])]) {
    const filtro = { unidade: unidade === 'CONSOLIDADO' ? null : unidade, meses: [mes] };
    for (const [nome, calcular, ids] of fichas) {
      const d = await calcular({ raiz, ano, mes, fonte, base, filtro });
      const campos = ids.map((id) => {
        const c = d.cartoes.find((x) => x.id === id);
        if (!c || c.valor === null) return `${id}=—`;
        const fonteCurta = ['cartao-ebitda', 'cartao-lucro-liquido', 'cartao-margem'].includes(id) ? 'Omie+DFC'
          : ['despesas-pendentes', 'a-pagar', 'a-receber'].includes(id) ? 'Omie'
            : ['resultado', 'projecao'].includes(id) ? 'conta' : 'DFC';
        const valor = c.negativo ? -c.valor : c.valor;
        const formatado = c.tipo === 'percentual'
          ? `${(valor * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
          : reais(valor);
        return `${id}=${formatado}[${fonteCurta}]`;
      });
      console.log(`${ano}-${String(mes).padStart(2, '0')} ${unidade} ${nome}: ${campos.join(' | ')}`);
    }
  }
}
