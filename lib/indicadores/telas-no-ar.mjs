// OS NÚMEROS DAS TRÊS TELAS, SEM HTML — o que `GET /api/pendencias/ponte/telas` devolve à ponte da Central e o que
// `scripts/conferir-no-ar.mjs` imprime. Serve para provar, sem sessão de navegador, qual mês o portal abre e o que cada
// cartão mostra nele.
//
// NÃO HÁ CÁLCULO AQUI. Cada tela é pedida à mesma função que a página usa (`dadosDaTela1`, `dadosDaTela2` e
// `dadosDoFluxoDeCaixa`, de `lib/dados.mjs`), com o mesmo mês padrão e o mesmo filtro cru que a página monta da URL; o
// que sai é só a lista de cartões de cada uma, com a fonte que o próprio cartão declara. As funções entram por
// parâmetro, para o teste rodar sobre as fixtures.
//
// Só os filtros `ano`, `mes` e `unidade` são aceitos: os outros filtros das telas ficam vazios, que é a tela aberta
// sem escolha nenhuma.

import { comoLista, comoTexto } from '../regras/filtros.mjs';
import { segredoDaPonteConfere, recusarPonte } from '../pendencias-acesso.mjs';

// O mês que cada página mostra, pela mesma regra dela: sem `?ano=`/`?mes=`, o mês corrente; a Tela 2 só tem coluna de
// abril em diante (`app/dre/page.js`), e um mês de janeiro a março cai em abril.
const TELAS = [
  { tela: 'Tela 1', rota: '/gestao-de-contas', dados: 'tela1', mesDaTela: (mes) => mes,
    filtro: (q, unidade) => ({ cc: comoLista(q.cc), empresa: comoLista(q.empresa), conta: comoLista(q.conta),
      situacao: comoLista(q.situacao), classe: comoLista(q.classe), categoria: comoLista(q.categoria),
      fornecedor: comoTexto(q.fornecedor), unidade, omie: comoLista(q.omie) }) },
  { tela: 'Tela 2', rota: '/dre', dados: 'tela2', mesDaTela: (mes) => Math.max(4, mes),
    filtro: (q, unidade) => ({ meses: comoLista(q.meses), empresa: comoLista(q.empresa), conta: comoLista(q.conta),
      omie: comoLista(q.omie), unidade }) },
  { tela: 'Tela 3', rota: '/fluxo-de-caixa', dados: 'fluxo', mesDaTela: (mes) => mes,
    filtro: (q, unidade) => ({ empresa: comoLista(q.empresa), omie: comoLista(q.omie), unidade,
      saidas: comoTexto(q.saidas), banco: comoTexto(q.banco), mesesDoDia: [] }) },
];

// A FONTE DE CADA CARTÃO, em etiqueta curta: a parte "principal" do texto que o cartão já traz (o que vem antes de
// " / ... (confronto)"). Um cartão que é conta de outros cartões ("conta desta tela: ...") fica com `conta`.
function etiquetas(fonte) {
  const principal = String(fonte ?? '').split(' / ')[0];
  const achadas = ['DFC', 'Omie'].filter((f) => principal.includes(f));
  return achadas.length ? achadas : ['conta'];
}

const paraCartao = (c) => ({
  id: c.id, nome: c.nome, tipo: c.tipo ?? 'dinheiro', negativo: Boolean(c.negativo),
  valor: typeof c.valor === 'number' ? c.valor : null,
  fonte: c.fonte ?? null, fontes: etiquetas(c.fonte),
  contagem: { dfc: c.contagem?.dfc ?? null, omie: c.contagem?.omie ?? null },
  ...(c.recorteB3W ? { recorteB3W: c.recorteB3W } : {}),
});

// `q` é o objeto cru dos parâmetros da URL; `corrente` é `mesCorrente()` (a função entra por parâmetro, para o teste).
export function lerPedido(q, corrente) {
  const ano = Number(q.ano ?? corrente.ano);
  const mes = Number(q.mes ?? corrente.mes);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { erro: 'ano inválido' };
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { erro: 'mes inválido' };
  return { ano, mes, unidade: comoTexto(q.unidade), padrao: q.mes === undefined };
}

// `dados` = { tela1, tela2, fluxo, mesCorrente }: as funções de `lib/dados.mjs` (ou, no teste, as mesmas contas sobre
// as fixtures).
export async function lerTelas(q, dados) {
  const pedido = lerPedido(q, dados.mesCorrente());
  if (pedido.erro) return pedido;
  const { ano, mes, unidade, padrao } = pedido;
  const telas = [];
  for (const t of TELAS) {
    const mesDaTela = t.mesDaTela(mes);
    const d = await dados[t.dados]({ ano, mes: mesDaTela, filtro: t.filtro(q, unidade) });
    telas.push({
      tela: t.tela, rota: t.rota, ano: d.ano ?? ano, mes: d.mes ?? mesDaTela,
      dfc: { ok: Boolean(d.dfc?.ok), arquivo: d.dfc?.arquivo ?? null, unidadesFaltantes: d.dfc?.unidadesFaltantes ?? [] },
      leituras: { dfcEm: d.leituras?.dfc?.em ?? null, omieOkEm: d.leituras?.omie?.okEm ?? null },
      cartoes: (d.cartoes ?? []).map(paraCartao),
    });
  }
  return { ano, mes, unidade, mesPadrao: padrao, telas };
}

// A rota inteira, menos o `import` de `lib/dados.mjs` — que fica no `route.js`, para o teste não abrir a base real.
export async function responderTelas(pedido, dados) {
  if (!segredoDaPonteConfere(pedido)) return recusarPonte();
  const q = Object.fromEntries(new URL(pedido.url).searchParams);
  const r = await lerTelas(q, dados);
  if (r.erro) return Response.json({ ok: false, erro: r.erro }, { status: 400 });
  return Response.json({ ok: true, ...r });
}
