// O QUE A TELA DIZ JUNTO DO NÚMERO QUANDO O FILTRO NÃO O ALCANÇA.
//
// A REGRA, e vale para as três telas: número que vem de uma fonte que não aceita o filtro escolhido não pode ser
// mostrado como se estivesse filtrado. O indicador traz essa frase pronta de `lib/indicadores/`, em `naoVale[]`, e
// este componente a escreve ao lado do número — no cartão, no bloco ou na linha da tabela. `avisos[]` é o vizinho
// mais fraco: o filtro VALE ali, e a frase só explica o que o dono está vendo (um cartão de faixa que ficou vazio
// porque o filtro de status não escolheu a faixa dele, por exemplo).
//
// Onde cada frase aparece, e por quê, está em `docs/filtros.md`. Nada é decidido aqui.
//
// COMPONENTE DE SERVIDOR, como as três telas: só desenha o que o cálculo já disse.

// As frases vêm com `código` entre acentos graves, como no resto do projeto; aqui isso vira <code>.
function comCodigo(s) {
  return String(s ?? '').split(/`([^`]+)`/).map((p, i) => (i % 2 ? <code key={i}>{p}</code> : p));
}

export default function Filtrado({ i }) {
  const naoVale = i?.naoVale ?? [];
  const avisos = i?.avisos ?? [];
  if (!naoVale.length && !avisos.length) return null;
  return (
    <div className="sem-filtro">
      {naoVale.map((x, n) => (
        <span key={`n${n}`}>
          <strong>o filtro de {x.filtro} não vale {comCodigo(x.onde)}</strong> — {comCodigo(x.porque)}.
        </span>
      ))}
      {avisos.map((x, n) => <span key={`a${n}`}>{comCodigo(x)}</span>)}
    </div>
  );
}

export { comCodigo };
