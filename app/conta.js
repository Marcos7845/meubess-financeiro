// O FILTRO DE CONTA BANCÁRIA — o segundo filtro que as TRÊS telas dividem, desenhado num lugar só, como o de empresa.
//
// DECISÃO DO DONO, 27/09/2026: filtrar por conta bancária nas três telas, "onde a fonte disser o banco". É seleção
// múltipla, como o centro de custo.
//
// DESENHO NOVO (decisão do dono, 28/09/2026): lista suspensa com caixas de marcar — `app/suspensa.js` explica a
// troca. Nenhuma caixa marcada são todas as contas, como o "todas" de antes.
//
// AS OPÇÕES SÃO AS CONTAS DA MEUBESS, pelo nome que o PRÓPRIO DONO deu a cada uma em
// `dados/contas-correntes-por-negocio.json` (`dito_como`) — é esse nome que junta as duas empresas, porque a mesma
// conta física está cadastrada nas duas com `nCodCC` diferente. Quem lê e normaliza é `lib/regras/filtros.mjs`; quem
// aplica, cada `lib/indicadores/tela-*.mjs`.
//
// COMPONENTE DE SERVIDOR, como as três telas: nada aqui calcula número. Ele mora DENTRO do formulário de filtros de
// cada tela — é o "aplicar" daquele formulário que escreve a escolha na URL.
//
// ONDE O FILTRO NÃO VALE é assunto de cada tela, e entra como `children` de `ExplicaConta`: o que as Telas 1 e 2 têm em
// comum é o lado do DFC. A planilha TEM uma coluna `BANCO`, mas os rótulos dela não são as contas do Omie — o
// cruzamento de 27/09/2026 (`scripts/de-para-conta-dfc.mjs`) casou o rótulo `ITAU`, que é 4.449 das 4.670 linhas
// cruzáveis do ano, com quatro contas diferentes. A Tela 3 não tem lado do DFC e não tem essa ressalva.

import Suspensa from './suspensa.js';

export default function FiltroDeConta({ f }) {
  return (
    <Suspensa
      nome="conta bancária"
      campo="conta"
      vazio="todas"
      opcoes={f.opcoes.map((nome) => ({
        valor: nome,
        rotulo: nome,
        marcada: f.escolhidas.includes(nome),
      }))}
    />
  );
}

// A FRASE DO QUE ELE ALCANÇA, separada da caixa, como em `app/empresa.js`.
export function ExplicaConta({ f, children }) {
  return (
    <>
      {f.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Conta que não existe na lista da MeuBESS:</strong> {f.desconhecidos.join(', ')}. Foi ignorada — as
          opções são as {f.opcoes.length} contas com <code>negocio = &quot;MeuBESS&quot;</code> em
          {' '}<code>dados/contas-correntes-por-negocio.json</code>, pelo nome que o dono deu a cada uma.
        </p>
      )}

      <p className="aviso leve">
        {f.ativo
          ? <>
            <strong>Filtrado por conta bancária:</strong> {f.escolhidas.join(', ')}. O filtro é o
            {' '}<code>nCodCC</code> do lançamento, e as duas empresas são juntadas pelo nome que o dono deu à conta
            (decisão do dono, 27/09/2026). {children}
          </>
          : <>
            <strong>Todas as contas da MeuBESS:</strong> a tela soma as {f.opcoes.length} contas com
            {' '}<code>negocio = &quot;MeuBESS&quot;</code>, como sempre — conta de outro negócio continua fora. A lista
            suspensa escolhe uma ou mais delas.
          </>}
      </p>
    </>
  );
}
