// OS DADOS QUE CADA GRÁFICO DESENHA, SEPARADOS DO DESENHO.
//
// POR QUE EXISTE (08/10/2026, quando os gráficos ganharam o estilo novo). `app/graficos.js` tem JSX e só o Next o lê;
// o teste (`testes/graficos-dados.test.mjs`) precisa importar o que vira ponto, barra e coluna sem subir o Next. Daqui
// sai exatamente a lista que antes era montada dentro de cada componente — mesma chave, mesma conta, mesmo `null` —
// e o teste a confere contra o código de antes. Nenhum número nasce aqui: cada valor chega pronto de
// `lib/indicadores/`, em centavos (ou em razão, na margem e no AV), e sai igual.

export const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ---------------------------------------------------------------- Tela 1
export const dadosAnoInteiro = (meses) =>
  meses.map((m) => ({ rotulo: MESES_CURTOS[m.mes], receita: m.entradas, despesa: m.gastos }));

export const dadosDiaADia = (dias) =>
  dias.map((d) => ({ rotulo: String(d.dia), receita: d.entradas, despesa: d.gastos }));

export const dadosRankingDespesa = (itens) => itens.map((i) => ({ chave: i.nome, valor: i.valor }));

// A CHAVE DO EIXO É A POSIÇÃO, e não o nome: dois clientes podem ter o mesmo nome.
export const dadosRankingReceita = (itens) =>
  itens.map((i, n) => ({
    chave: String(n), valor: i.valor,
    nome: i.cliente.nome ?? `cliente ${i.cliente.codigo}`, codigo: i.cliente.codigo,
  }));

// ---------------------------------------------------------------- Tela 2
export const dadosMargem = (serie) => serie.map((x) => ({ rotulo: MESES_CURTOS[x.mes], margem: x.valor }));

export const dadosPesoNaReceita = (linhas) =>
  linhas.map((l, n) => ({ chave: String(n), rotulo: l.rotulo, valor: l.av }));

// ---------------------------------------------------------------- Tela 3
export const FAIXAS_DA_TELA_3 = [
  { chave: 'pago', nome: 'pago' },
  { chave: 'atrasado', nome: 'atrasado' },
  { chave: 'aberto', nome: 'em aberto' },
];

export const dadosPorCliente = (clientes) =>
  clientes.map((c, n) => ({
    chave: String(n), nome: c.nome ?? `cliente ${c.codigo}`, codigo: c.codigo,
    ...Object.fromEntries(FAIXAS_DA_TELA_3.map((f) => [f.chave, c[f.chave]])),
  }));

export const dadosPorMes = (porMes) =>
  porMes.map((x) => ({
    rotulo: MESES_CURTOS[x.mes], total: x.total,
    ...Object.fromEntries(FAIXAS_DA_TELA_3.map((f) => [f.chave, x[f.chave]])),
  }));

// O fluxo de caixa dia a dia. Zero vira `null` (a dica mostra só o que aconteceu); a saída é desenhada para baixo.
export function dadosFluxo(dias, hoje) {
  const dados = dias.map((d) => ({
    rotulo: d.rotulo ?? String(d.dia),
    entrou: d.entrou || null, aReceber: d.aReceber || null, saiu: d.saiu ? -d.saiu : null, aPagar: d.aPagar ? -d.aPagar : null,
    posicao: d.fase === 'previsao' ? null : d.acumulado,
    posicaoPrevista: d.fase === 'consolidado' ? null : d.acumulado,
  }));
  // Sem mês em andamento não há "hoje": num mês à frente tudo é previsão, e a linha inteira fica cinza.
  if (!hoje && dados.length && dias.every((d) => d.fase === 'previsao')) for (const x of dados) x.posicao = null;
  return dados;
}

// ---------------------------------------------------------------- os pontos de destaque
// Os únicos pontos que a linha desenha: o maior valor, o menor e o selecionado (o mês em foco, ou hoje). Quando a
// série é toda igual — tudo zero, por exemplo — não há máximo nem mínimo a destacar, e só o selecionado fica.
// `valores` é a lista na ordem do eixo; `null`/`undefined`/não-finito são lacunas e não entram.
export function pontosDeDestaque(valores, selecionado = -1) {
  const idx = new Set();
  let max = -1, min = -1;
  valores.forEach((v, i) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    if (max < 0 || v > valores[max]) max = i;
    if (min < 0 || v < valores[min]) min = i;
  });
  if (max >= 0 && valores[max] !== valores[min]) { idx.add(max); idx.add(min); }
  if (selecionado >= 0) idx.add(selecionado);
  return idx;
}

// ---------------------------------------------------------------- as linhas do quadro (a dica)
// O Recharts entrega à dica customizada TODA série do gráfico, inclusive as que só ajudam a desenhar — o degradê sob a
// linha, o contorno da cor do fundo — e que levam `tooltipType="none"`. Só a dica padrão do Recharts respeita essa
// marca; a nossa (`Dica`, em `app/graficos.js`) não respeitava, e o quadro do Fluxo de Caixa repetia a posição de caixa
// uma vez por série auxiliar (09/10/2026, print do dono). Aqui sai a lista que o quadro mostra: sem série auxiliar,
// sem série escondida, sem lacuna (`null`) e uma linha só por `dataKey`. O valor de cada linha não é tocado.
export function linhasDaDica(payload) {
  const vistas = new Set();
  const linhas = [];
  for (const p of payload ?? []) {
    if (!p || p.type === 'none' || p.hide) continue;
    if (typeof p.value !== 'number' || !Number.isFinite(p.value)) continue;
    const chave = String(p.dataKey);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    linhas.push(p);
  }
  return linhas;
}
