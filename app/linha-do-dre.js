'use client';

// UMA LINHA DO DRE QUE ABRE O QUE ELA SOMA (pedido do dono, 30/09/2026: "cada linha do DRE explodir"). É o mesmo jeito
// de `app/conta-explodivel.js`: a linha chega pronta do servidor (as células são `children`), e o clique acrescenta,
// embaixo dela, uma linha com o detalhamento.
//
// O QUE ABRE é `composicao`, que `lib/indicadores/tela-2.mjs` monta com os MESMOS lançamentos que o valor da linha
// somou — no mês da URL, ou nos meses escolhidos somados, e já com os filtros de empresa e de conta:
//   linha "(=)"       as linhas que ela soma, com o sinal de cada uma, e o resultado;
//   as outras         a soma por categoria (do Omie, ou a `SUB 2` do DFC) e, embaixo, cada lançamento.
// O total de cada tabela é o valor da linha; `scripts/testar-detalhe-dre.mjs` confere isso.
//
// `Detalhamento` também é o que os cartões das três telas abrem (01/10/2026, `app/cartao-explodivel.js`), e por isso
// desenha uma terceira forma, a razão (margem, percentual): o numerador e o denominador, cada um aberto à parte. O
// formato das três mora em `lib/indicadores/composicao.mjs`.
//
// FECHADA, A LISTA NÃO ESTÁ NO HTML: `scripts/capturar-tela.mjs` joga fora todo `<script>`, e por isso nenhum título do
// DFC entra na captura que vai para o repositório.

import React, { useState } from 'react';

import { emPorcento, emReais } from './dinheiro.js';

const MESES = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function Detalhamento({ c }) {
  const quando = c.meses.map((m) => MESES[m]).join(' + ');
  if (c.razao) {
    const { numerador: n, denominador: d } = c.razao;
    return (
      <>
        <p className="legenda">
          em {quando}, este número é uma razão: <strong>{n.rotulo}</strong> ({emReais(n.valor)}) ÷{' '}
          <strong>{d.rotulo}</strong> ({emReais(d.valor)}) = <strong>{emPorcento(c.valor)}</strong>. Cada um dos dois abre
          abaixo.
        </p>
        <h4 className="parte-da-razao">{n.rotulo}</h4>
        <Detalhamento c={n} />
        <h4 className="parte-da-razao">{d.rotulo}</h4>
        <Detalhamento c={d} />
      </>
    );
  }
  if (c.partes) {
    return (
      <>
        <p className="legenda">em {quando}, este número é a conta das linhas abaixo — no DRE, clique em cada uma delas, na tabela, para abrir o que ela soma</p>
        <table>
          <thead><tr><th>sinal</th><th>linha</th><th className="num">valor</th></tr></thead>
          <tbody>
            {c.partes.map((p) => (
              <tr key={p.id}><td>{p.sinal > 0 ? '+' : '−'}</td><td>{p.rotulo}</td><td className="num">{emReais(p.valor)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><th>=</th><th>esta linha</th><th className="num">{emReais(c.valor)}</th></tr></tfoot>
        </table>
      </>
    );
  }
  if (!c.itens.length) return <p className="legenda">nenhum lançamento entrou nesta linha em {quando}.</p>;
  return (
    <>
      <p className="legenda">
        em {quando}: {c.itens.length} lançamento(s) em {c.porCategoria.length} categoria(s). O valor vai com o sinal com
        que entra no número: numa linha ou num cartão de gasto, o gasto aparece positivo; num saldo, num resultado e em
        &quot;sem conta&quot;, a saída aparece negativa.
      </p>
      <table>
        <thead><tr><th>fonte</th><th>empresa</th><th>categoria / SUB 2</th><th>nome no cadastro / classe</th><th className="num">lançamentos</th><th className="num">valor</th></tr></thead>
        <tbody>
          {c.porCategoria.map((g) => (
            <tr key={`${g.fonte}|${g.empresa}|${g.categoria}`}>
              <td>{g.fonte}</td><td>{g.empresa}</td><td>{g.categoria}</td><td>{g.nome}</td>
              <td className="num">{g.n}</td><td className="num">{emReais(g.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={4}>total</th><th className="num">{c.itens.length}</th><th className="num">{emReais(c.valor)}</th></tr></tfoot>
      </table>
      <table>
        <thead><tr><th>fonte</th><th>empresa</th><th>data</th><th>categoria / SUB 2 · nome / classe</th><th>tipo</th><th>código no Omie / linha da planilha</th><th>título / parcela, ou título no DFC</th><th className="num">valor</th></tr></thead>
        <tbody>
          {c.itens.map((i, n) => (
            <tr key={n}>
              <td>{i.fonte}</td><td>{i.empresa}</td><td>{i.data || '—'}</td><td>{i.categoria} · {i.nomeCategoria}</td><td>{i.tipo}</td>
              <td>{i.codigo}</td><td>{i.documento || '—'}</td><td className="num">{emReais(i.valor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={7}>total ({c.itens.length})</th><th className="num">{emReais(c.valor)}</th></tr></tfoot>
      </table>
    </>
  );
}

export default function LinhaDoDre({ className = '', colunas, composicao, children }) {
  const [aberta, setAberta] = useState(false);
  if (!composicao) return <tr className={className}>{children}</tr>;
  return (
    <>
      <tr className={`${className} explodivel${aberta ? ' aberta' : ''}`} onClick={() => setAberta((x) => !x)}
        title={aberta ? 'fechar o detalhamento' : 'ver o que esta linha soma'}>
        {children}
      </tr>
      {aberta && (
        <tr className="explodida">
          <td colSpan={colunas}><Detalhamento c={composicao} /></td>
        </tr>
      )}
    </>
  );
}
