// O QUE UM NÚMERO SOMA, ITEM POR ITEM — o "explodir" das três telas (pedido do dono: cada linha do DRE em 30/09/2026,
// e os cartões das três telas em 01/10/2026).
//
// NÃO É REGRA. Nenhum filtro mora aqui: quem decide o que entra num número é `lib/regras/` e o arquivo da tela. Aqui só
// se devolve, um a um e com o sinal com que entram, os MESMOS lançamentos do Omie e as MESMAS linhas do DFC que o
// número já somou. Por construção a soma dos itens é o número, e `scripts/testar-detalhe-dre.mjs` (linhas do DRE) e
// `scripts/testar-detalhe-cartoes.mjs` (cartões das três telas) conferem isso ao centavo.
//
// TRÊS FORMAS, e a tela (`app/linha-do-dre.js`, `Detalhamento`) desenha as três:
//   lista   os itens e a soma deles por categoria — o total é o número;
//   conta   (`contaDasPartes`) as linhas que o número soma e subtrai ("(=) EBITDA" = lucro bruto − despesas gerais);
//   razao   um número que é divisão (margem, percentual): o numerador e o denominador, cada um aberto à parte.
//
// O QUE VAI PARA A TELA de cada item: fonte, empresa, data, categoria (código e nome do cadastro), o tipo, o código do
// Omie (ou a linha da planilha), o número do título (ou o `TITULO` do DFC) e o valor. O registro cru do Omie fica no
// servidor — ele traz CPF/CNPJ e código do cliente —, e do DFC o `FORNECEDOR / CLIENTE` não vai.

import { valorOmie } from '../regras/movimentos.mjs';

const dois = (n) => String(n).padStart(2, '0');

const tipoOmie = (d) => (d.cGrupo === 'CONTA_A_RECEBER' || d.cGrupo === 'CONTA_A_PAGAR' ? 'título'
  : (d.nCodTitulo ? 'baixa de parcial' : 'avulso'));

// UM LANÇAMENTO DE CAIXA DO OMIE (`financas/mf`), pelo valor que as telas somam (`valorOmie`).
const itemOmie = (categorias, emp, mes, sinal = 1) => (d) => ({
  mes, fonte: 'Omie', empresa: String(emp), data: d.dDtPagamento ?? '',
  categoria: String(d.cCodCateg ?? ''), nomeCategoria: categorias[emp]?.get(String(d.cCodCateg ?? ''))?.descricao ?? '(fora do cadastro)',
  tipo: tipoOmie(d), codigo: String(tipoOmie(d) === 'título' ? d.nCodTitulo : d.nCodMovCC),
  documento: [d.cNumTitulo, d.cNumParcela].filter(Boolean).join(' · '),
  valor: sinal * valorOmie(d),
});

// UM TÍTULO EM ABERTO DO OMIE (a pagar ou a receber, por vencimento): a data é o vencimento e o valor, o que está
// em aberto, já em centavos — é o que os cartões "Desp. Pendentes" e "Valor Pendente" somam.
const itemTitulo = (categorias, emp, mes, valor, sinal = 1) => (t) => ({
  mes, fonte: 'Omie', empresa: String(emp), data: t.dDtVenc ?? '',
  categoria: String(t.cCodCateg ?? ''), nomeCategoria: categorias[emp]?.get(String(t.cCodCateg ?? ''))?.descricao ?? '(fora do cadastro)',
  tipo: 'título em aberto (vencimento)', codigo: String(t.nCodTitulo ?? ''),
  documento: [t.cNumTitulo, t.cNumParcela].filter(Boolean).join(' · '),
  valor: sinal * valor(t),
});

// UMA LINHA DA ABA `FLUXO DE CAIXA` DO DFC. Sem `comSinal`, o módulo — a saída que se subtrai aparece positiva, como a
// tela a escreve; com `comSinal`, a entrada positiva e a saída negativa (o "Saldo" da Tela 1). `sinal` vira o item
// inteiro, para uma conta que subtrai a linha (o "Resultado do mês" da Tela 3).
const itemDfc = (ano, mes, { comSinal = false, sinal = 1 } = {}) => (l) => ({
  mes, fonte: 'DFC', empresa: '1 e 2', data: l.dia ? `${dois(l.dia)}/${dois(mes)}/${ano}` : '',
  categoria: l.sub2, nomeCategoria: l.classe, tipo: 'linha do FLUXO DE CAIXA', codigo: String(l.linha),
  documento: l.titulo ?? '', valor: sinal * (comSinal ? l.valor : Math.abs(l.valor)),
});

// A LISTA: os itens, e a soma por categoria (fonte + empresa + categoria). O total de cada uma é `valor`.
function lista(meses, valor, itens) {
  const grupos = new Map();
  for (const i of itens) {
    const k = `${i.fonte}|${i.empresa}|${i.categoria}`;
    const g = grupos.get(k) ?? { fonte: i.fonte, empresa: i.empresa, categoria: i.categoria, nome: i.nomeCategoria, n: 0, valor: 0 };
    g.n += 1; g.valor += i.valor; grupos.set(k, g);
  }
  return {
    meses, valor,
    porCategoria: [...grupos.values()].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)),
    itens: [...itens].sort((a, b) => a.mes - b.mes || Math.abs(b.valor) - Math.abs(a.valor)),
  };
}

// A CONTA: `partes` é [{ id, rotulo, sinal, valor }]; o número é a soma de `sinal × valor`.
const contaDasPartes = (meses, valor, partes) => ({ meses, valor, partes });

// A RAZÃO: `numerador` e `denominador` são composições (lista ou conta), cada uma com o seu rótulo.
const razao = (meses, valor, numerador, denominador) => ({ meses, valor, razao: { numerador, denominador } });

export { itemOmie, itemTitulo, itemDfc, lista, contaDasPartes, razao };
