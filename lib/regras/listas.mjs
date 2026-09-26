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

// Resultado financeiro (decisão do dono, 25/09/2026, grupo d): 7 códigos na empresa 1 e 8 na 2.
const RESULTADO_FINANCEIRO = {
  1: ['1.01.02', '1.02.02', '1.04.95', '2.05.01', '2.05.02', '2.05.04', '2.06.95'],
  2: ['1.02.02', '1.04.94', '2.04.91', '2.05.01', '2.05.02', '2.05.04', '2.05.99', '2.06.95'],
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

// Ficam FORA do DRE: hoje, só os Intercompany. O Financiamento Veiculo (`2.11.95`, empresa 1) esteve nesta lista por um
// dia: a terceira resposta do dono, em 25/09/2026 ("financiamento de veiculo é despesas gerais sim"), o mandou para
// "(−) Despesas gerais", e ele saiu daqui — continua fora do resultado financeiro, como já estava decidido.
const FORA_DO_DRE = INTERCOMPANY;

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

export { VENDA_DE_PRODUTOS, faixa, PESSOAL, CUSTO_DE_VENDAS, RESULTADO_FINANCEIRO, DEDUCOES, IMPOSTOS_GUIAS, INTERCOMPANY, FORA_DO_DRE, FAIXA_DO_STATUS };
