import { saidasPagasDoDfc } from './dfc.mjs';

// PAGO é caixa baixado no DFC. A PAGAR já vem da leitura de títulos CP em aberto,
// recortada por nCodCC na Tela 1. Não se misturam os dois regimes no mesmo total.
function selecionarSaidas({ situacao = 'pago', linhas = [], banco = null, pendentes = { valor: null, contagem: { omie: null } } }) {
  if (situacao === 'a-pagar') return {
    fonte: 'Omie', linhas: [], valor: pendentes.valor, contagem: pendentes.contagem.omie,
  };
  const pagas = saidasPagasDoDfc(linhas, banco);
  return {
    fonte: 'DFC', linhas: pagas,
    valor: pagas.reduce((s, l) => s + Math.abs(l.valor), 0), contagem: pagas.length,
  };
}

export { selecionarSaidas };
