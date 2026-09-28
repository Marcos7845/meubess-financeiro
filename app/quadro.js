// AS DUAS PEÇAS DO LAYOUT EM F QUE AS TRÊS TELAS DIVIDEM: o número do topo e o quadro de um gráfico.
//
// DE ONDE VÊM. Da skill de visualização de dados do dono (`.claude/skills/visualizacao-de-dados/SKILL.md`), fase 4:
// "KPI cards — headline numbers in a row" e um quadro por gráfico, com o título contando a história. Nasceram na
// Tela 1 em 28/09/2026 e, quando o dono aprovou aquele padrão e pediu as outras duas iguais, no mesmo dia, mudaram
// para cá: três cópias do mesmo cartão sairiam do lugar uma de cada vez.
//
// COMPONENTES DE SERVIDOR, como as três telas. Nenhum número nasce aqui: o cartão chega pronto de
// `lib/indicadores/`, com valor, contagem e as frases de "o filtro não vale".
//
// NENHUMA COR AQUI, como em `app/graficos.js`: o que se escreve é `className`, e quem diz a cor é `app/globals.css`.

import { emPorcento, emReais } from './dinheiro.js';
import Filtrado from './filtrado.js';

// O NÚMERO DO TOPO. Sem moldura e sem sombra — só uma régua à esquerda separando um do outro —, o rótulo miúdo por
// cima e, embaixo, a contagem que a conferência publica, porque é ela que prova de onde o número saiu.
//
//   destaque  o número de que a frase de 5 segundos daquela tela fala: sai maior e na cor da marca.
//   tom       a classe de cor da faixa a que o número pertence (`f-pago`, `f-atrasado`, `f-aberto` na Tela 3), para
//             o cartão e o gráfico que falam da mesma faixa terem a mesma cor.
//   pe        troca a linha de baixo, quando a tela conta a contagem com outras palavras ("N títulos do Omie").
//   texto     troca o número já escrito. Existe por um caso só: a margem de lucro da Tela 2, que sempre teve UMA casa
//             decimal (13,9%), e o `emPorcento` daqui arredonda para inteiro — serve ao eixo do gráfico, não a um
//             número em que meio ponto percentual conta. Quem manda o `texto` manda formatado.
//   children  entra entre o número e o pé — é por onde a Tela 2 põe a fita dos doze meses.
export function Kpi({ c, destaque = false, tom = null, pe = null, texto = null, children = null }) {
  const valor = texto ?? (c.tipo === 'percentual' ? emPorcento(c.valor) : emReais(c.valor));
  return (
    <div className={`kpi${destaque ? ' destaque' : ''}`}>
      <div className="rotulo" title={c.nome}>
        {tom && <span className={`chave ${tom}`} aria-hidden="true" />}{c.nome}
      </div>
      <div className={`numero${c.negativo ? ' neg' : ''}`}>{c.negativo ? `-${valor}` : valor}</div>
      {children}
      <div className="pe">
        {pe ?? <>{c.contagem.dfc !== null ? `${c.contagem.dfc} do DFC · ` : ''}{c.contagem.omie} do Omie</>}
      </div>
      <Filtrado i={c} />
    </div>
  );
}

// O QUADRO DE UM GRÁFICO. O título conta a história ("Para onde foi a despesa"), e não descreve o desenho
// ("gráfico de barras por classificação"); embaixo dele, numa linha só, de que fonte aquele gráfico é.
export function Quadro({ titulo, fonte, className = '', children }) {
  return (
    <section className={`quadro ${className}`}>
      <h2>{titulo}</h2>
      {fonte && <p className="fonte-do-quadro">{fonte}</p>}
      {children}
    </section>
  );
}
