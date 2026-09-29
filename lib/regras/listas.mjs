// AS LISTAS QUE O DONO DECIDIU — a fonte única delas.
//
// Saíram de `scripts/numeros-das-telas.mjs` para cá quando o app começou: o script da conferência e a camada de dados
// do app importam ESTE arquivo, e nenhum dos dois guarda cópia. Mudar uma decisão do dono é mudar aqui, num lugar só.
// Cada lista só REGISTRA o que `docs/fontes.md` já escreve — nenhuma é heurística.

//
// Cada lista abaixo só REGISTRA uma decisão do dono já escrita em `docs/fontes.md`. Nenhuma é heurística, e a chave é
// sempre o par empresa + código: o mesmo código é coisa diferente nas duas empresas.

// Venda de produtos × outras receitas na linha "(+) Receitas" (decisão do dono, 25/09/2026).
const VENDA_DE_PRODUTOS = ['1.01.01', '1.01.03', '1.04.01'];

const faixa = (pre, de, ate) => Array.from({ length: ate - de + 1 }, (_, i) => `${pre}${String(de + i).padStart(2, '0')}`);

// Categorias de pessoal, para o confronto do cartão "Despesas com funcionários" (decisão do dono, 25/09/2026).
const PESSOAL = {
  1: [...faixa('2.03.', 1, 14), '2.03.97', '2.03.98', '2.03.99', '2.11.96', '2.02.01', '2.02.02', ...faixa('2.01.', 81, 97)],
  2: [...faixa('2.03.', 1, 14), '2.03.97', '2.03.98', '2.03.99', '2.02.01', '2.02.02', '2.08.01'],
};

// Custo de vendas (decisão do dono, 25/09/2026, grupo b): 22 códigos na empresa 1 e 16 na 2.
// Os três últimos da empresa 2 entraram na segunda resposta do dono, também em 25/09/2026 ("1 ok"): a contagem
// corrigida mostrou que `2.01.96` Energia Elétrica-Custo, `2.01.89` Gas para empilhadeira-Custos e `2.01.92`
// Armanezagem e manuseio de Carga-Custos têm movimento e são apontadas pelo nome, o mesmo critério das outras.
const CUSTO_DE_VENDAS = {
  1: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', ...faixa('2.01.', 82, 97), '2.01.99', '2.04.88'],
  2: ['2.01.01', '2.01.02', '2.01.03', '2.01.04', '2.01.90', '2.01.91', '2.01.93', '2.01.94', '2.01.95', '2.01.97', '2.01.98', '2.01.99', '2.08.99',
      '2.01.89', '2.01.92', '2.01.96'],
};

// Resultado financeiro (decisão do dono, 25/09/2026, grupo d): 7 códigos na empresa 1 e 7 na 2. Eram 8 na 2 até
// 29/09/2026, quando o `2.04.91` Emprestimo dela saiu daqui para a amortização de dívida (ver AMORTIZACAO_DE_DIVIDA).
const RESULTADO_FINANCEIRO = {
  1: ['1.01.02', '1.02.02', '1.04.95', '2.05.01', '2.05.02', '2.05.04', '2.06.95'],
  2: ['1.02.02', '1.04.94', '2.05.01', '2.05.02', '2.05.04', '2.05.99', '2.06.95'],
};

// Dedução da receita (decisão do dono, 24/09/2026; o ISS retido `2.06.07` saiu em 25/09/2026): 5 na empresa 1 e 6 na 2.
const DEDUCOES = {
  1: ['2.06.01', '2.06.03', '2.06.04', '2.09.01', '2.09.02'],
  2: ['2.06.01', '2.06.03', '2.06.04', '2.09.01', '2.09.02', '2.02.97'],
};

// Impostos pagos (guias) — o confronto do Omie, pela categoria e não pelo `cTipo` (decisão do dono, 25/09/2026).
const IMPOSTOS_GUIAS = { 1: ['2.06.05', '2.06.06', '2.06.07', '2.03.06', '2.01.92'], 2: ['2.06.05', '2.06.06', '2.06.07', '2.03.06'] };

// Os empréstimos e transferências entre as empresas (Intercompany), que ficam fora do DRE (decisão do dono, 25/09/2026).
const INTERCOMPANY = { 1: ['2.08.02', '2.05.99', '1.04.99'], 2: ['1.04.99', '2.10.98'] };

// AMORTIZAÇÃO DE DÍVIDA (decisão do dono, 29/09/2026, a Tela 2 ganha o passivo): o Giro de Capital (`2.04.89`) e o
// Financiamento Veiculo (`2.11.95`), os dois só na empresa 1, saem de "(−) Despesas gerais" e viram amortização de
// dívida, FORA do lucro — pagar a parcela de um empréstimo não é despesa. Os juros e o IOF da mesma dívida continuam no
// resultado financeiro (`2.05.01` e `2.06.95`, já em RESULTADO_FINANCEIRO). O Financiamento Veiculo tinha ido para
// "(−) Despesas gerais" pela terceira resposta do dono em 25/09/2026; esta decisão o tira de lá.
// Na empresa 2, o `2.04.91` Emprestimo (a parcela de giro dela, pelo que a planilha escreve) entrou aqui na segunda
// decisão do mesmo dia (29/09/2026): sai do resultado financeiro, onde a decisão de 25/09/2026 o tinha posto, e fica
// fora do lucro como os outros dois.
const AMORTIZACAO_DE_DIVIDA = { 1: ['2.04.89', '2.11.95'], 2: ['2.04.91'] };

// O FLUXO DA DÍVIDA do bloco "Compromissos" da Tela 2 (decisão do dono, 29/09/2026), do lado do Omie, pelo código da
// categoria. A amortização é a lista de cima; a captação é o Recebimento de Empréstimos Bancários; juros e IOF são os
// dois códigos da dívida que já moram no resultado financeiro — o bloco os MOSTRA, e o DRE continua os contando lá.
// O `2.05.02` (Juros e Multas pagos) fica de fora: é multa de conta paga em atraso, não juro de empréstimo.
// A captação (`1.04.03` Recebimento de Empréstimos Bancários) também fica FORA do DRE desde a segunda decisão de
// 29/09/2026: até ali ela entrava em "Outras receitas", e dinheiro emprestado não é receita.
const CAPTACAO_DE_EMPRESTIMO = { 1: ['1.04.03'], 2: ['1.04.03'] };

// Ficam FORA do DRE: os Intercompany (25/09/2026), a amortização de dívida e a captação de empréstimo (29/09/2026).
// Vale nas duas pontas: a despesa não entra em "(−) Despesas gerais" e a receita não entra em "Outras receitas" — é
// por isso que o Recebimento de Empréstimo Intercompany (`1.04.99`, "como a regra de intercompany já manda") e o
// Recebimento de Empréstimos Bancários (`1.04.03`) saem da receita (decisões do dono, 29/09/2026).
const FORA_DO_DRE = Object.fromEntries(Object.keys(INTERCOMPANY).map((emp) =>
  [emp, [...INTERCOMPANY[emp], ...AMORTIZACAO_DE_DIVIDA[emp], ...CAPTACAO_DE_EMPRESTIMO[emp]]]));
const JUROS_DE_EMPRESTIMO = { 1: ['2.05.01'], 2: ['2.05.01'] };
const IOF_DE_EMPRESTIMO = { 1: ['2.06.95'], 2: ['2.06.95'] };

// De-para dos `cStatus` do Omie para as três faixas da Tela 3 (decisão do dono, 25/09/2026). O Omie devolve
// `"A VENCER"` com espaço nos títulos a vencer; pelos campos é o mesmo `AVENCER`, e o código o trata como tal.
const FAIXA_DO_STATUS = (s) => {
  const x = String(s ?? '').replace(/\s+/g, '').toUpperCase();
  if (x === 'CANCELADO') return 'fora';
  if (x === 'RECEBIDO' || x === 'LIQUIDADO') return 'pago';
  if (x === 'ATRASADO') return 'atrasado';
  if (['EMABERTO', 'AVENCER', 'VENCEHOJE', 'PAGTOPARCIAL'].includes(x)) return 'aberto';
  return 'outro';
};

export {
  VENDA_DE_PRODUTOS, faixa, PESSOAL, CUSTO_DE_VENDAS, RESULTADO_FINANCEIRO, DEDUCOES, IMPOSTOS_GUIAS, INTERCOMPANY, FORA_DO_DRE,
  AMORTIZACAO_DE_DIVIDA, CAPTACAO_DE_EMPRESTIMO, JUROS_DE_EMPRESTIMO, IOF_DE_EMPRESTIMO, FAIXA_DO_STATUS,
};
