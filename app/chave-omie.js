// A CHAVE "INCLUIR DADOS DO OMIE" — a terceira peça que as TRÊS telas dividem, ao lado do filtro de empresa
// (`app/empresa.js`) e do de conta bancária (`app/conta.js`), e desenhada num lugar só como eles.
//
// DECISÃO DO DONO, 28/09/2026: "suspeito de informação desatualizada ou imprecisa no Omie e quero ver como as 3 telas
// ficam sem ela". Ela é UMA FORMA DE VER e não um filtro — um filtro recorta os lançamentos que entram num número,
// esta chave tira a FONTE inteira da conta —, mas mora junto dos filtros porque é ali que o dono a procura, e no
// mesmo formato dos outros: lista suspensa com caixa de marcar (`app/suspensa.js`).
//
// LIGADA POR PADRÃO, e ligada NADA muda: a tela é a de sempre, com os mesmos números, as mesmas regras e a mesma
// trava de agosto. Quem lê e normaliza é `lib/regras/filtros.mjs` (`filtroDoOmie`); quem apaga o lado do Omie é cada
// `lib/indicadores/tela-*.mjs`. Nada é decidido aqui.
//
// O `omie=0` ESCONDIDO É PARTE DA CHAVE, e por isso vem daqui e não de cada tela: uma caixa DESMARCADA não manda
// nada, e sem o `0` no formulário a chave voltaria a ligar sozinha a cada "aplicar". É o mesmo desenho das duas
// leituras da tabela da Tela 2 (`?ah=`, `?av=`), pelo mesmo motivo.
//
// COMPONENTE DE SERVIDOR, como as três telas: nada aqui calcula número. Ele mora DENTRO do formulário de filtros de
// cada tela — é o "aplicar" daquele formulário que escreve a escolha na URL.

import Suspensa from './suspensa.js';

export default function ChaveDoOmie({ ligado }) {
  return (
    <>
      <input type="hidden" name="omie" value="0" />
      <Suspensa
        nome="Omie"
        campo="omie"
        vazio="sem o Omie"
        opcoes={[{
          valor: '1',
          rotulo: 'incluir dados do Omie',
          marcada: ligado,
          dica: 'desmarcada, todo número que vem do Omie sai da tela, e cada bloco que dependia dele diz isso ali mesmo',
        }]}
      />
    </>
  );
}

// O AVISO DA TELA INTEIRA, acima dos números, quando a chave está desligada. A frase do que SOBRA em cada tela é
// própria de cada uma e entra como `children`: a Tela 1 fica com o lado do DFC quase inteiro, a Tela 2 com três
// linhas e dois cartões, e a Tela 3 — que é do Omie inteira — não fica com número nenhum.
export function AvisoSemOmie({ ligado, children }) {
  if (ligado) return null;
  return (
    <p className="aviso">
      <strong>A chave “incluir dados do Omie” está desligada</strong> — todo número cuja fonte é o Omie saiu da conta
      desta tela, e no lugar dele ficou um travessão e a frase que diz por quê, junto do próprio número. Nenhuma regra
      mudou e nenhum número do DFC mudou: a chave é uma forma de ver, e religá-la traz a tela de sempre de volta.
      {' '}{children}
    </p>
  );
}
