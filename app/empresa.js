// O FILTRO DE EMPRESA — o primeiro dos dois filtros que as TRÊS telas dividem, desenhado num lugar só.
//
// DECISÃO DO DONO, 27/09/2026: empresa 1, empresa 2 ou as duas. Quem lê e normaliza é `lib/regras/filtros.mjs`; quem
// aplica, cada `lib/indicadores/tela-*.mjs`.
//
// DESENHO NOVO (decisão do dono, 28/09/2026): lista suspensa com caixas de marcar, como todos os outros filtros de
// escolha das três telas — `app/suspensa.js` explica a troca. Aqui são DUAS caixas, uma por empresa, e a conta é a
// mesma de sempre: nenhuma marcada, ou as duas marcadas, é a soma de sempre e o filtro fica desligado
// (`filtroDeEmpresa` só liga quando a escolha é MENOR que o total); uma marcada é aquela empresa sozinha.
//
// COMPONENTE DE SERVIDOR, como as três telas: nada aqui calcula número. E ele mora DENTRO do formulário de filtros de
// cada tela — é o "aplicar" daquele formulário que escreve a escolha na URL.
//
// ONDE O FILTRO NÃO VALE é assunto de cada tela, e entra como `children` de `ExplicaEmpresa`: o que todas têm em comum
// é o lado do DFC, que não se recorta por empresa porque o de-para da coluna `EMP.` com as filiais do Omie não fecha
// (`docs/fontes.md`, "A coluna `EMP.` do DFC não é a filial do Omie"). A Tela 3 não tem lado do DFC e não tem essa
// ressalva nenhuma.

import Suspensa from './suspensa.js';

const NOMES = { 1: 'Empresa 1', 2: 'Empresa 2' };
const FILIAIS = { 1: '/0001-42, as rotinas administrativas', 2: '/0002-23, compra, venda e logística' };

export default function FiltroDeEmpresa({ f }) {
  return (
    <Suspensa
      nome="empresa"
      campo="empresa"
      vazio="as duas"
      opcoes={f.opcoes.map((e) => ({
        valor: String(e),
        rotulo: NOMES[e],
        marcada: f.ativo && f.escolhidas.includes(e),
        dica: `${NOMES[e]} — ${FILIAIS[e]}`,
      }))}
    />
  );
}

// A FRASE DO QUE ELE ALCANÇA, separada da caixa: na Tela 1 ela mora dentro do "o que cada filtro alcança", que abre e
// fecha, e nas Telas 2 e 3 continua onde sempre esteve. O aviso de empresa que não existe vem junto — ele é a resposta
// a um `?empresa=` escrito errado, e tem de aparecer perto do filtro.
export function ExplicaEmpresa({ f, children }) {
  return (
    <>
      {f.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Empresa que não existe:</strong> {f.desconhecidos.join(', ')}. Foi ignorada — as telas somam as
          filiais <code>/0001-42</code> (empresa 1) e <code>/0002-23</code> (empresa 2) do Omie, e a terceira
          (<code>/0003-04</code>) fica fora delas.
        </p>
      )}

      <p className="aviso leve">
        {f.ativo
          ? <>
            <strong>Filtrado por empresa:</strong> {f.escolhidas.map((e) => NOMES[e]).join(' e ')}{' '}
            ({f.escolhidas.map((e) => FILIAIS[e].split(',')[0]).join(' e ')}). O filtro escolhe quais filiais do Omie
            entram na soma (decisão do dono, 27/09/2026). {children}
          </>
          : <>
            <strong>As duas empresas:</strong> a tela soma as filiais <code>/0001-42</code> e <code>/0002-23</code> do
            Omie, como sempre — a terceira fica fora. A lista suspensa escolhe uma delas; marcar as duas é a soma de
            sempre.
          </>}
      </p>
    </>
  );
}
