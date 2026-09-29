'use client';

// UMA CONTA DA TABELA DAS FIXAS QUE SE "EXPLODE" NOS LANÇAMENTOS QUE A COMPÕEM (pedido do dono, 29/09/2026: "ao clicar,
// conseguir explodir cada linha nos lançamentos que a compõe").
//
// A linha da conta chega pronta do servidor (as células são `children`); este componente só acrescenta o clique e,
// aberta, uma linha a mais embaixo com os lançamentos: mês e dia do pagamento, fornecedor/cliente e título como a
// planilha os escreve, a linha da aba `FLUXO DE CAIXA` (para achar de volta na planilha) e o valor.
//
// POR QUE NO NAVEGADOR, e não um `<details>` do servidor: `<details>` não cabe entre duas linhas de tabela. E há uma
// vantagem: fechada, a lista não está no HTML — `scripts/capturar-tela.mjs` joga fora todo `<script>`, e por isso nenhum
// nome de fornecedor entra na captura que vai para o repositório.

import React, { useState } from 'react';

import { emReais } from './dinheiro.js';

const MESES = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export default function ContaExplodivel({ colunas, lancamentos, children }) {
  const [aberta, setAberta] = useState(false);
  const ordem = [...(lancamentos ?? [])].sort((a, b) => b.valor - a.valor);
  return (
    <>
      <tr className={`explodivel${aberta ? ' aberta' : ''}`} onClick={() => setAberta((x) => !x)}
        title={aberta ? 'fechar os lançamentos' : `ver os ${ordem.length} lançamentos desta conta`}>
        {children}
      </tr>
      {aberta && (
        <tr className="explodida">
          <td colSpan={colunas}>
            <table>
              <thead><tr><th>data</th><th>fornecedor / cliente</th><th>título</th><th className="num">linha da planilha</th><th className="num">valor</th></tr></thead>
              <tbody>
                {ordem.map((l) => (
                  <tr key={`${l.mes}-${l.linha}`}>
                    <td>{String(l.dia).padStart(2, '0')}/{MESES[l.mes]}</td>
                    <td>{l.quem || '—'}</td>
                    <td>{l.titulo || '—'}</td>
                    <td className="num">{l.linha}</td>
                    <td className="num">{emReais(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
