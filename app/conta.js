// A PÍLULA DE CONTA BANCÁRIA — o segundo filtro que as TRÊS telas dividem, desenhado num lugar só, como o de empresa.
//
// DECISÃO DO DONO, 27/09/2026: filtrar por conta bancária nas três telas, "onde a fonte disser o banco". É seleção
// múltipla, como o centro de custo: clicar acende, clicar de novo apaga, e "todas" limpa a escolha.
//
// AS OPÇÕES SÃO AS CONTAS DA MEUBESS, pelo nome que o PRÓPRIO DONO deu a cada uma em
// `dados/contas-correntes-por-negocio.json` (`dito_como`) — é esse nome que junta as duas empresas, porque a mesma
// conta física está cadastrada nas duas com `nCodCC` diferente. Quem lê e normaliza é `lib/regras/filtros.mjs`; quem
// aplica, cada `lib/indicadores/tela-*.mjs`.
//
// COMPONENTE DE SERVIDOR, como as três telas: nada aqui calcula número, e o `href` de cada pílula vem da própria
// página, que é a única que sabe montar a sua URL.
//
// ONDE O FILTRO NÃO VALE é assunto de cada tela, e entra aqui como `children`: o que as Telas 1 e 2 têm em comum é o
// lado do DFC. A planilha TEM uma coluna `BANCO`, mas os rótulos dela não são as contas do Omie — o cruzamento de
// 27/09/2026 (`scripts/de-para-conta-dfc.mjs`) casou o rótulo `ITAU`, que é 4.449 das 4.670 linhas cruzáveis do ano,
// com quatro contas diferentes. A Tela 3 não tem lado do DFC e não tem essa ressalva.

export default function FiltroDeConta({ f, href, alternar, children }) {
  return (
    <>
      {f.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Conta que não existe na lista da MeuBESS:</strong> {f.desconhecidos.join(', ')}. Foi ignorada — as
          opções são as {f.opcoes.length} contas com <code>negocio = &quot;MeuBESS&quot;</code> em
          {' '}<code>dados/contas-correntes-por-negocio.json</code>, pelo nome que o dono deu a cada uma.
        </p>
      )}

      <div className="barra-filtros">
        <span className="rotulo-filtro">conta bancária</span>
        <span className="grupo">
          <a className={`pilula limpar${f.ativo ? '' : ' ativa'}`} href={href([])}>todas</a>
          {f.opcoes.map((nome) => (
            <a className={`pilula${f.escolhidas.includes(nome) ? ' ativa' : ''}`}
              href={href(alternar(nome))} key={nome}>{nome}</a>
          ))}
        </span>
      </div>

      <p className="aviso leve">
        {f.ativo
          ? <>
            <strong>Filtrado por conta bancária:</strong> {f.escolhidas.join(', ')}. O filtro é o
            {' '}<code>nCodCC</code> do lançamento, e as duas empresas são juntadas pelo nome que o dono deu à conta
            (decisão do dono, 27/09/2026). {children}
          </>
          : <>
            <strong>Todas as contas da MeuBESS:</strong> a tela soma as {f.opcoes.length} contas com
            {' '}<code>negocio = &quot;MeuBESS&quot;</code>, como sempre — conta de outro negócio continua fora. As
            pílulas escolhem uma ou mais delas.
          </>}
      </p>
    </>
  );
}
