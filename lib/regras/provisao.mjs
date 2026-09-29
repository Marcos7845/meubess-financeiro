// A ABA `PROVISÃO` DO DFC — o quadro por projeto que o financeiro abriu em setembro de 2026 (lida em 29/09/2026).
//
// O QUE ELA É. Uma linha por projeto vendido (o kit), com a data da provisão, o código do projeto, o cliente e o
// consultor, e o que o financeiro já provisiona para cada um: o valor do projeto, o recebido, o a receber, a compra, o
// frete, o repasse, a comissão, a comissão head, o imposto e o valor final. O significado de cada coluna, a regra de
// soma e o que ficou de fora da tela estão em `docs/fontes.md`, "A aba PROVISÃO".
//
// O QUE ENTRA NA TELA 2 (bloco "Compromissos"): só as quatro colunas que são dinheiro que a MeuBESS vai pagar a
// TERCEIROS por um projeto já vendido — `VALOR FRETE`, `VALOR REPASSE`, `VALOR COMISSÃO` e `VALOR COMISSÃO HEAD`.
// O resto fica fora, e o porquê de cada uma está em `docs/fontes.md`: a compra vem vazia em toda linha; o imposto
// muda de base de uma linha para outra; o valor final só existe em duas linhas; e o recebido / a receber é o sinal
// do cliente, que o bloco já conta pelo Omie (as obrigações com clientes), com a NF que a aba não tem.
//
// SÓ SETEMBRO DE 2026 TEM ESTE QUADRO. De abril a agosto a aba `PROVISÃO` existe, mas é outra coisa: um razão com
// `SUB 2` = "RECEBIMENTO CLIENTE - PROVISÃO" / "COMPRAS - PROVISÃO" e saldo corrido, sem projeto nem consultor. A
// leitura acha o quadro pelo CABEÇALHO, não pelo mês: o mês que não o tiver sai sem número, com a frase que diz por quê.
//
// A LEITURA É `lerAba`, a de todo o app. Foi nesta aba que o defeito da célula vazia apareceu (a `VALOR DE COMPRA`
// vazia engolia o `VALOR FRETE` ao lado); a correção vale para todas desde 29/09/2026 (ver `linhasCruas` em `xlsx.mjs`).
//
// SÓ LEITURA, e dinheiro só em memória, em centavos inteiros, como no resto do app.

import { lerAba, dataDaCelula } from './xlsx.mjs';

const norm = (s) => String(s ?? '').toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cent = (v) => Math.round(Number(v ?? 0) * 100);

// AS COLUNAS, pelo rótulo do cabeçalho (normalizado: sem acento, maiúsculo). `VALIR A RECEBER` é como a planilha
// escreve. A letra não entra: o financeiro pode inserir uma coluna e a leitura continua certa.
const COLUNAS = {
  data: 'DATA', projeto: 'PROJETO', cliente: 'CLIENTE', consultor: 'CONSULTOR',
  valorProjeto: 'VALOR PROJETO', recebido: 'VALOR RECEBIDO', aReceber: 'VALIR A RECEBER', compra: 'VALOR DE COMPRA',
  frete: 'VALOR FRETE', repasse: 'VALOR REPASSE', comissao: 'VALOR COMISSAO', comissaoHead: 'VALOR COMISSAO HEAD',
  imposto: 'IMPOSTO', valorFinal: 'VALOR FINAL',
};
// O QUADRO POR PROJETO é reconhecido por estas: sem qualquer uma delas, a aba é a do razão (abril a agosto).
const OBRIGATORIAS = ['projeto', 'cliente', 'consultor', 'frete', 'repasse', 'comissao', 'comissaoHead'];

// AS QUATRO PROVISÕES QUE ENTRAM NO BLOCO, na ordem em que a tela as mostra.
const PROVISOES = [
  { id: 'frete', rotulo: 'frete' },
  { id: 'repasse', rotulo: 'repasse' },
  { id: 'comissao', rotulo: 'comissão' },
  { id: 'comissaoHead', rotulo: 'comissão head' },
];

// O CÓDIGO DO PROJETO: oito dígitos de data, um hífen e o número — o mesmo código que o Omie escreve em `det[].produto
// .codigo` do pedido de venda ("Kit Gerador Fotovoltaico … - 20260910-19348817"). Linha sem ele não é projeto: as três
// linhas do fim da aba (56 a 58 em setembro) são sobra do razão antigo, com o rótulo "SALDO FINAL PROVISÃO" e zero.
const E_CODIGO_DE_PROJETO = /^\d{8}-\d+$/;

// LÊ O QUADRO de um arquivo de mês já aberto (`zip`, `ss`, `abas` de `lerMesDoDfc`). Devolve `{ ok: false, motivo }`
// quando não há aba ou quando a aba não tem o quadro por projeto.
function lerProvisao(zip, ss, abas) {
  const aba = abas.find((a) => norm(a.nome) === 'PROVISAO');
  if (!aba) return { ok: false, motivo: 'o arquivo deste mês não tem a aba PROVISÃO' };
  const linhas = lerAba(zip, aba.parte, ss) ?? [];
  let mapa = null, cabecalho = null;
  const projetos = [];
  for (const l of linhas) {
    if (!mapa) {
      const rotulos = new Map([...l.cel.entries()].filter(([, c]) => c.t).map(([col, c]) => [norm(c.t), col]));
      const achadas = Object.fromEntries(Object.entries(COLUNAS).map(([k, r]) => [k, rotulos.get(r) ?? null]));
      if (OBRIGATORIAS.every((k) => achadas[k])) { mapa = achadas; cabecalho = l.n; }
      continue;
    }
    const cel = (k) => (mapa[k] ? l.cel.get(mapa[k]) : undefined);
    const texto = (k) => cel(k)?.t ?? '';
    const valor = (k) => (cel(k)?.v !== undefined ? cent(cel(k).v) : null);
    const projeto = texto('projeto');
    if (!E_CODIGO_DE_PROJETO.test(projeto)) continue;
    projetos.push({
      linha: l.n, data: dataDaCelula(cel('data')), projeto, cliente: texto('cliente'), consultor: texto('consultor'),
      valorProjeto: valor('valorProjeto'), recebido: valor('recebido'), aReceber: valor('aReceber'), compra: valor('compra'),
      frete: valor('frete'), repasse: valor('repasse'), comissao: valor('comissao'), comissaoHead: valor('comissaoHead'),
      imposto: valor('imposto'), valorFinal: valor('valorFinal'),
    });
  }
  if (!mapa) {
    return {
      ok: false, aba: aba.nome,
      motivo: 'a aba PROVISÃO deste mês não tem o quadro por projeto (projeto, cliente, consultor, frete, repasse e comissão) — ele começa no arquivo de setembro de 2026; de abril a agosto a aba é um razão de recebimentos e compras de provisão, que a tela não lê',
    };
  }
  return { ok: true, aba: aba.nome, cabecalho, projetos };
}

// AS QUATRO PROVISÕES DO MÊS: a soma de cada coluna nas linhas de projeto (célula vazia conta zero), quantos projetos
// têm cada uma maior que zero, e a data da provisão — a coluna `data`, que em setembro é a mesma nas 21 linhas.
function provisoesDoMes(lida) {
  if (!lida?.ok) return { ok: false, motivo: lida?.motivo ?? 'o arquivo do DFC deste mês não foi lido' };
  const soma = (id) => lida.projetos.reduce((s, p) => s + (p[id] ?? 0), 0);
  const com = (id) => lida.projetos.filter((p) => (p[id] ?? 0) > 0).length;
  const porProvisao = PROVISOES.map((p) => ({ ...p, total: soma(p.id), projetos: com(p.id) }));
  const datas = [...new Set(lida.projetos.map((p) => (p.data ? `${p.data.a}-${p.data.m}-${p.data.d}` : null)))];
  return {
    ok: true, aba: lida.aba,
    total: porProvisao.reduce((s, p) => s + p.total, 0),
    porProvisao,
    projetos: lida.projetos,
    data: datas.length === 1 && datas[0] ? lida.projetos[0].data : null,
    contagem: { projetos: lida.projetos.length, ...Object.fromEntries(porProvisao.map((p) => [p.id, p.projetos])) },
  };
}

export { lerProvisao, provisoesDoMes, PROVISOES, COLUNAS as COLUNAS_DA_PROVISAO, E_CODIGO_DE_PROJETO };
