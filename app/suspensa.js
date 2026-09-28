// A LISTA SUSPENSA COM CAIXAS DE MARCAR — o desenho de TODO filtro de escolha das três telas, num lugar só.
//
// DECISÃO DO DONO, 28/09/2026, revendo a Tela 1: "os filtros em etiquetas estão feios e ocupam espaço: troque por
// lista suspensa com checkbox (escolher um ou vários), nas 3 telas". Antes, cada opção era uma etiqueta (`.pilula`)
// que ficava o tempo todo na tela: dezesseis centros de custo, doze meses, as contas e as situações somavam quatro
// faixas de etiquetas antes do primeiro número. Agora cada filtro é UMA caixa fechada, que diz o que está escolhido,
// e as opções só aparecem quando ela abre.
//
// NENHUM FILTRO MUDOU. As opções são as mesmas, na mesma ordem, com os mesmos valores na mesma URL, e o que cada um
// alcança continua sendo decisão de `lib/regras/filtros.mjs` — aqui só mora a forma. É por isso que
// `npm run conferir-filtros` e `npm run conferir-telas` continuam dando os mesmos 19 e 36.
//
// SEM UMA LINHA DE JAVASCRIPT, e é uma amarra e não um gosto: `scripts/capturar-tela.mjs` joga fora todo `<script>`
// da página antes de a captura entrar no repositório, e as três telas são componentes de servidor. Quem abre e fecha
// a caixa é o `<details>` do próprio HTML; quem guarda a escolha é a URL, como sempre. O preço é o botão "aplicar":
// marcar uma caixa não recarrega a tela sozinho, e é ele que escreve as escolhas na URL de uma vez só.
//
// CAIXA DE MARCAR OU BOLINHA. `unica` decide, e ela não é escolha de desenho: é o que o filtro aceita.
//   - caixa de marcar (`<input type="checkbox">`) onde o filtro aceita vários — centro de custo, situação, conta
//     bancária, empresa, meses da Tela 2, status da Tela 3;
//   - bolinha (`<input type="radio">`) onde ele aceita UM — o ano e o mês, que são um valor só na URL (`?mes=8`).
//     Uma caixa de marcar ali prometeria uma escolha múltipla que o filtro não tem.

// `opcoes` é uma lista de `{ valor, rotulo, marcada, campo?, dica? }`. `campo` só é escrito quando a opção vai para
// um parâmetro diferente do da caixa (é o caso das duas leituras da tabela da Tela 2, `ah` e `av`, que dividem a
// mesma caixa). `marcada` vem sempre do filtro já normalizado — nunca é adivinhada aqui.
export default function Suspensa({ nome, campo, opcoes, vazio = 'todos', unica = false }) {
  const marcadas = opcoes.filter((o) => o.marcada);
  const escolha = marcadas.length ? marcadas.map((o) => o.rotulo).join(', ') : vazio;
  return (
    <details className={`suspensa${marcadas.length && !unica ? ' escolhida' : ''}`}>
      <summary>
        <span className="nome">{nome}</span>
        <span className="escolha">{escolha}</span>
      </summary>
      <div className="opcoes">
        {opcoes.map((o) => (
          <label key={`${o.campo ?? campo}|${o.valor}`} title={o.dica}>
            <input
              type={unica ? 'radio' : 'checkbox'}
              name={o.campo ?? campo}
              value={o.valor}
              defaultChecked={Boolean(o.marcada)}
            />
            <span>{o.rotulo}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
