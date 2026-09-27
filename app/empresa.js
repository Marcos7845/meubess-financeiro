// A PÍLULA DE EMPRESA — o único filtro que as TRÊS telas dividem, desenhado num lugar só.
//
// DECISÃO DO DONO, 27/09/2026: empresa 1, empresa 2 ou as duas. São três escolhas exclusivas, e não uma seleção
// múltipla como o centro de custo: escolher as duas é a soma de sempre, e é isso que a pílula "as duas" faz — limpa o
// `empresa` da URL. Quem lê e normaliza é `lib/regras/filtros.mjs`; quem aplica, cada `lib/indicadores/tela-*.mjs`.
//
// COMPONENTE DE SERVIDOR, como as três telas: nada aqui calcula número, e o `href` de cada pílula vem da própria
// página, que é a única que sabe montar a sua URL.
//
// ONDE O FILTRO NÃO VALE é assunto de cada tela, e entra aqui como `children`: o que todas têm em comum é o lado do
// DFC, que não se recorta por empresa porque o de-para da coluna `EMP.` com as filiais do Omie não fecha
// (`docs/fontes.md`, "A coluna `EMP.` do DFC não é a filial do Omie"). A Tela 3 não tem lado do DFC e não tem essa
// ressalva nenhuma.

const NOMES = { 1: 'Empresa 1', 2: 'Empresa 2' };
const FILIAIS = { 1: '/0001-42, as rotinas administrativas', 2: '/0002-23, compra, venda e logística' };

export default function FiltroDeEmpresa({ f, href, children }) {
  return (
    <>
      {f.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Empresa que não existe:</strong> {f.desconhecidos.join(', ')}. Foi ignorada — as telas somam as
          filiais <code>/0001-42</code> (empresa 1) e <code>/0002-23</code> (empresa 2) do Omie, e a terceira
          (<code>/0003-04</code>) fica fora delas.
        </p>
      )}

      <div className="barra-filtros">
        <span className="rotulo-filtro">empresa</span>
        <span className="grupo">
          <a className={`pilula limpar${f.ativo ? '' : ' ativa'}`} href={href(null)}>as duas</a>
          {f.opcoes.map((e) => (
            <a className={`pilula${f.ativo && f.escolhidas.includes(e) ? ' ativa' : ''}`}
              href={href(e)} key={e} title={`${NOMES[e]} — ${FILIAIS[e]}`}>{NOMES[e]}</a>
          ))}
        </span>
      </div>

      <p className="aviso leve">
        {f.ativo
          ? <>
            <strong>Filtrado por empresa:</strong> {f.escolhidas.map((e) => NOMES[e]).join(' e ')}{' '}
            ({f.escolhidas.map((e) => FILIAIS[e].split(',')[0]).join(' e ')}). O filtro escolhe quais filiais do Omie
            entram na soma (decisão do dono, 27/09/2026). {children}
          </>
          : <>
            <strong>As duas empresas:</strong> a tela soma as filiais <code>/0001-42</code> e <code>/0002-23</code> do
            Omie, como sempre — a terceira fica fora. As pílulas escolhem uma delas.
          </>}
      </p>
    </>
  );
}
