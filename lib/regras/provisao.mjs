// A ABA `PROVISÃO` DO DFC — o quadro por projeto que o financeiro abriu em setembro de 2026 (lida em 29/09/2026).
//
// O QUE ELA É. Uma linha por projeto vendido (o kit), com a data da provisão, o código do projeto, o cliente e o
// consultor, e o que o financeiro já provisiona para cada um: o valor do projeto, o recebido, o a receber, a compra, o
// frete, o repasse, a comissão, a comissão head, o imposto e o valor final. O significado de cada coluna, a regra de
// soma e o que ficou de fora da tela estão em `docs/fontes.md`, "A aba PROVISÃO".
//
// O QUE ENTRA NA TELA 2 (bloco "Compromissos") — as respostas do dono de 29/09/2026:
//
//   PROVISÕES POR PROJETO   frete, comissão, comissão head, imposto e compra: dinheiro que a MeuBESS vai pagar a
//                           terceiros por um projeto já vendido. O IMPOSTO é 9,25% do valor do projeto, e só entra a
//                           linha em que a célula BATE com 9,25% × `VALOR PROJETO` (um centavo de folga, do
//                           arredondamento); as outras saem "a conferir", com o número da linha — a regra não calcula
//                           no lugar da planilha. A COMPRA entra quando for preenchida (em setembro está vazia, e conta
//                           zero).
//   REPASSE                 é pagamento a fazer a CLIENTES: obrigação com clientes, e não provisão. Sai da soma das
//                           provisões e vai para o quadro "Obrigações com clientes", à parte dos sinais do Omie, com o
//                           projeto e o cliente. Não entra no "resultado sem dinheiro de terceiros".
//   PAGO                    o que o financeiro confirmar como pago sai: quando a aba tiver uma coluna "pago em" (ou um
//                           nome equivalente, `ROTULOS_DO_PAGO`), a linha escrita nela não entra em nada. Sem a coluna,
//                           tudo o que está na aba é "provisionado".
//   FORA                    o valor final (só em duas linhas) e o recebido / a receber: o sinal do cliente continua
//                           vindo do Omie, com a NF que a aba não tem.
//
// O QUADRO VEM EM TODO ARQUIVO DE MÊS, a partir de setembro de 2026, com a data do fim do mês, e a tela lê a aba do mês
// escolhido. De abril a agosto a aba `PROVISÃO` existe, mas é outra coisa: um razão com `SUB 2` = "RECEBIMENTO
// CLIENTE - PROVISÃO" / "COMPRAS - PROVISÃO" e saldo corrido, sem projeto nem consultor. A leitura acha o quadro pelo
// CABEÇALHO, não pelo mês: o mês que não o tiver sai "sem provisão por projeto neste mês", e não zero.
//
// A LEITURA É `lerAba`, a de todo o app. Foi nesta aba que o defeito da célula vazia apareceu (a `VALOR DE COMPRA`
// vazia engolia o `VALOR FRETE` ao lado); a correção vale para todas desde 29/09/2026 (ver `linhasCruas` em `xlsx.mjs`).
//
// SÓ LEITURA, e dinheiro só em memória, em centavos inteiros, como no resto do app.

import { lerAba, dataDaCelula } from './xlsx.mjs';

const norm = (s) => String(s ?? '').toLocaleUpperCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cent = (v) => Math.round(Number(v ?? 0) * 100);

// A COLUNA DO PAGO ainda não existe na aba (29/09/2026). Quando o financeiro a abrir, ela é achada por qualquer um
// destes rótulos (normalizados como os outros).
const ROTULOS_DO_PAGO = ['PAGO EM', 'PAGO', 'DATA PAGAMENTO', 'DATA DE PAGAMENTO', 'DATA DO PAGAMENTO', 'PAGAMENTO', 'PAGO DIA', 'DATA PAGO'];

// AS COLUNAS, pelo rótulo do cabeçalho (normalizado: sem acento, maiúsculo). `VALIR A RECEBER` é como a planilha
// escreve. A letra não entra: o financeiro pode inserir uma coluna e a leitura continua certa.
const COLUNAS = {
  data: 'DATA', projeto: 'PROJETO', cliente: 'CLIENTE', consultor: 'CONSULTOR',
  valorProjeto: 'VALOR PROJETO', recebido: 'VALOR RECEBIDO', aReceber: 'VALIR A RECEBER', compra: 'VALOR DE COMPRA',
  frete: 'VALOR FRETE', repasse: 'VALOR REPASSE', comissao: 'VALOR COMISSAO', comissaoHead: 'VALOR COMISSAO HEAD',
  imposto: 'IMPOSTO', valorFinal: 'VALOR FINAL', pago: ROTULOS_DO_PAGO,
};
const rotulosDe = (r) => (Array.isArray(r) ? r : [r]);
// O QUADRO POR PROJETO é reconhecido por estas: sem qualquer uma delas, a aba é a do razão (abril a agosto).
const OBRIGATORIAS = ['projeto', 'cliente', 'consultor', 'frete', 'repasse', 'comissao', 'comissaoHead'];

// AS PROVISÕES QUE ENTRAM NO BLOCO, na ordem em que a tela as mostra. O repasse não é uma delas: é obrigação com
// clientes (o `repasse` de `provisoesDoMes`).
const PROVISOES = [
  { id: 'frete', rotulo: 'frete' },
  { id: 'comissao', rotulo: 'comissão' },
  { id: 'comissaoHead', rotulo: 'comissão head' },
  { id: 'imposto', rotulo: 'imposto (9,25% do projeto)' },
  { id: 'compra', rotulo: 'compra' },
];

// O IMPOSTO: 9,25% do valor do projeto (resposta do dono, 29/09/2026). A célula BATE quando fica a até um centavo da
// conta — a planilha grava o resultado da fórmula com as casas que o Excel tiver, e aqui tudo é centavo inteiro.
const ALIQUOTA_DO_IMPOSTO = 0.0925;
const impostoEsperado = (valorProjeto) => Math.round((valorProjeto ?? 0) * ALIQUOTA_DO_IMPOSTO);
const impostoBate = (p) => (p.valorProjeto ?? 0) > 0 && p.imposto !== null
  && Math.abs(p.imposto - impostoEsperado(p.valorProjeto)) <= 1;

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
      const achadas = Object.fromEntries(Object.entries(COLUNAS).map(([k, r]) =>
        [k, rotulosDe(r).map((x) => rotulos.get(x)).find(Boolean) ?? null]));
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
      // A data de pagamento, quando a coluna existir. Célula escrita que não é data (um "PAGO", um "x") também conta
      // como paga: o financeiro marcou a linha, e é a marca que tira a provisão.
      pago: mapa.pago ? (dataDaCelula(cel('pago')) ?? (texto('pago') || (cel('pago')?.v ? 'marcado' : null))) : null,
    });
  }
  if (!mapa) {
    return {
      ok: false, aba: aba.nome,
      motivo: 'a aba PROVISÃO deste mês não tem o quadro por projeto (projeto, cliente, consultor, frete, repasse e comissão) — ele começa no arquivo de setembro de 2026; de abril a agosto a aba é um razão de recebimentos e compras de provisão, que a tela não lê',
    };
  }
  return { ok: true, aba: aba.nome, cabecalho, projetos, temPago: Boolean(mapa.pago), colunaDoPago: mapa.pago };
}

// AS PROVISÕES DO MÊS: a soma de cada coluna nas linhas de projeto ainda não pagas (célula vazia conta zero), quantos
// projetos têm cada uma maior que zero, e a data da provisão — a coluna `data`, o fim do mês em todas as linhas.
// O imposto soma só as linhas que batem com 9,25% do projeto; as outras vão para `impostoAConferir`, com a linha.
// O repasse sai à parte (`repasse`), para o quadro das obrigações com clientes.
function provisoesDoMes(lida) {
  if (!lida?.ok) return { ok: false, motivo: lida?.motivo ?? 'o arquivo do DFC deste mês não foi lido' };
  const pagos = lida.projetos.filter((p) => p.pago);
  const abertos = lida.projetos.filter((p) => !p.pago);
  const bate = abertos.filter(impostoBate);
  // A CONFERIR: toda linha em aberto cujo imposto não bate — com imposto escrito, ou com valor de projeto e o imposto
  // vazio. Linha sem valor de projeto e sem imposto não tem o que conferir.
  const aConferir = abertos.filter((p) => !impostoBate(p) && ((p.imposto ?? 0) !== 0 || (p.valorProjeto ?? 0) > 0));
  const valorDe = (p, id) => (id === 'imposto' ? (impostoBate(p) ? p.imposto : 0) : (p[id] ?? 0));
  const soma = (id) => abertos.reduce((s, p) => s + valorDe(p, id), 0);
  const com = (id) => abertos.filter((p) => valorDe(p, id) > 0).length;
  const porProvisao = PROVISOES.map((p) => ({ ...p, total: soma(p.id), projetos: com(p.id) }));
  const datas = [...new Set(lida.projetos.map((p) => (p.data ? `${p.data.a}-${p.data.m}-${p.data.d}` : null)))];
  const doRepasse = abertos.filter((p) => (p.repasse ?? 0) > 0);
  return {
    ok: true, aba: lida.aba, temPago: Boolean(lida.temPago),
    total: porProvisao.reduce((s, p) => s + p.total, 0),
    porProvisao,
    projetos: abertos.map((p) => ({
      ...p, impostoNaSoma: valorDe(p, 'imposto'), total: PROVISOES.reduce((s, x) => s + valorDe(p, x.id), 0),
    })),
    pagos,
    impostoAConferir: aConferir.map((p) => ({
      linha: p.linha, projeto: p.projeto, cliente: p.cliente, valorProjeto: p.valorProjeto, imposto: p.imposto,
      esperado: impostoEsperado(p.valorProjeto),
      motivo: !((p.valorProjeto ?? 0) > 0) ? 'sem valor do projeto'
        : (p.imposto === null ? 'imposto vazio' : 'não é 9,25% do valor do projeto'),
    })),
    repasse: {
      total: doRepasse.reduce((s, p) => s + p.repasse, 0),
      projetos: doRepasse.map((p) => ({ linha: p.linha, projeto: p.projeto, cliente: p.cliente, valor: p.repasse })),
    },
    data: datas.length === 1 && datas[0] ? lida.projetos[0].data : null,
    contagem: {
      projetos: lida.projetos.length, pagos: pagos.length,
      ...Object.fromEntries(porProvisao.map((p) => [p.id, p.projetos])),
      impostoBate: bate.length, impostoAConferir: aConferir.length, repasse: doRepasse.length,
    },
  };
}

export {
  lerProvisao, provisoesDoMes, PROVISOES, COLUNAS as COLUNAS_DA_PROVISAO, ROTULOS_DO_PAGO, E_CODIGO_DE_PROJETO,
  ALIQUOTA_DO_IMPOSTO, impostoEsperado, impostoBate,
};
