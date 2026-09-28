// O DINHEIRO E O PERCENTUAL, FORMATADOS NUM LUGAR SÓ.
//
// POR QUE EXISTE. Desde que os gráficos da Tela 1 passaram a ser desenhados por uma biblioteca (Recharts, em
// `app/graficos.js`), o mesmo número aparece em dois lados da linha: no cartão, que é desenhado no servidor, e no
// eixo do gráfico, que é desenhado no navegador. Os dois TÊM de sair com a mesma letra — senão a página pisca ao
// hidratar, e, pior, `scripts/capturar-tela.mjs` deixaria passar um formato que a troca de dinheiro dele não conhece.
//
// O FORMATO É O DE SEMPRE, o `Intl` em pt-BR: `R$ 1.634.743` (com espaço fixo depois do `R$`) e `-R$ 946.786`. É
// exatamente essa forma que a expressão `MOEDA` de `scripts/capturar-tela.mjs` procura para trocar por "—" antes de
// a captura entrar no repositório. Mudar o formato aqui sem mudar lá faria dinheiro entrar em arquivo versionado.
//
// NENHUM NÚMERO NASCE AQUI: o valor chega pronto de `lib/indicadores/`, em centavos, e daqui sai só o texto.

const DINHEIRO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const PORCENTO = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

// Centavos → `R$ 1.634.743`. O valor guardado é sempre inteiro, em centavos; a divisão por 100 é só de apresentação.
export const emReais = (centavos) => DINHEIRO.format((centavos ?? 0) / 100);

// Razão (0,24) → `24%`. `null` é "não dá para calcular", e vira um travessão.
export const emPorcento = (razao) => (razao === null || razao === undefined ? '—' : PORCENTO.format(razao));
