'use client';

// UM NÚMERO DO BLOCO "COMPROMISSOS" QUE ABRE OS LANÇAMENTOS DE QUE SAIU (decisão do dono, 29/09/2026: "cada número
// abrindo os lançamentos"). É o mesmo jeito de `app/conta-explodivel.js`, fora de uma tabela: um botão com quantos são
// e, aberto, a lista.
//
// FECHADA, A LISTA NÃO ESTÁ NO HTML. `scripts/capturar-tela.mjs` joga fora todo `<script>`, e por isso nenhum nome de
// cliente nem de fornecedor entra na captura que vai para o repositório.
//
// `colunas` é [{ rotulo, chave, tipo }] — `tipo` 'reais' formata centavos, 'num' alinha à direita, o resto é texto.

import React, { useState } from 'react';

import { emReais } from './dinheiro.js';

export default function Lancamentos({ rotulo = 'lançamentos', um = 'lançamento', colunas, linhas }) {
  const [aberta, setAberta] = useState(false);
  const n = linhas?.length ?? 0;
  if (!n) return <span className="abre-lancamentos vazio">nenhum {um}</span>;
  return (
    <span className="abre-lancamentos">
      <button type="button" onClick={() => setAberta((x) => !x)} aria-expanded={aberta}>
        {aberta ? `fechar os ${n} ${rotulo}` : `ver ${n === 1 ? `o ${um}` : `os ${n} ${rotulo}`}`}
      </button>
      {aberta && (
        <table className="lancamentos-do-numero">
          <thead>
            <tr>{colunas.map((c) => <th className={c.tipo === 'reais' || c.tipo === 'num' ? 'num' : ''} key={c.chave}>{c.rotulo}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                {colunas.map((c) => (
                  <td className={c.tipo === 'reais' || c.tipo === 'num' ? 'num' : ''} key={c.chave}>
                    {c.tipo === 'reais' ? emReais(l[c.chave]) : (l[c.chave] === null || l[c.chave] === undefined || l[c.chave] === '' ? '—' : String(l[c.chave]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </span>
  );
}
