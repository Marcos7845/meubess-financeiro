'use client';

// UM CARTÃO DO TOPO QUE ABRE O QUE ELE SOMA (pedido do dono, 01/10/2026: levar o "explodir" das linhas do DRE aos
// cartões das três telas). É o mesmo jeito de `app/linha-do-dre.js`: o cartão chega pronto do servidor (o `Kpi` é
// `children`), e o clique acrescenta, numa faixa da largura da fila de cartões, o mesmo `Detalhamento` que a linha do
// DRE abre — lista, conta ou razão, conforme `lib/indicadores/composicao.mjs`.
//
// `depois` entra no cartão mas fora da área de clique: é por onde a Tela 3 põe o "de onde saiu", que tem clique próprio.
//
// FECHADA, A LISTA NÃO ESTÁ NO HTML: `scripts/capturar-tela.mjs` joga fora todo `<script>`, e por isso nenhum título do
// DFC entra na captura que vai para o repositório.
//
// NENHUMA COR AQUI: as classes `cartao-explodivel` e `cartao-explodido` ganham cor em `app/globals.css`.

import React, { useState } from 'react';

import { Detalhamento } from './linha-do-dre.js';

export default function CartaoExplodivel({ nome, composicao, depois = null, aviso = null, children }) {
  const [aberto, setAberto] = useState(false);
  if (!composicao) return <div className="cartao-explodivel parado">{children}{aviso && <p className="aviso-do-cartao">{aviso}</p>}{depois}</div>;
  const alternar = () => setAberto((x) => !x);
  return (
    <>
      <div className={`cartao-explodivel${aberto ? ' aberto' : ''}`}>
        <div className="abre-cartao" role="button" tabIndex={0} aria-expanded={aberto} onClick={alternar}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } }}
          title={aberto ? 'fechar o detalhamento' : 'ver o que este número soma'}>
          {children}
        </div>
        {aviso && <p className="aviso-do-cartao">{aviso}</p>}
        {depois}
      </div>
      {aberto && (
        <div className="cartao-explodido">
          <p className="titulo-do-detalhe">
            <strong>{nome}</strong> — o que o número soma
            <button type="button" className="fechar" onClick={alternar}>fechar</button>
          </p>
          <Detalhamento c={composicao} />
        </div>
      )}
    </>
  );
}
