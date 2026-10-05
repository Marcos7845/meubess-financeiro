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
