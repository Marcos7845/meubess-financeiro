'use client';

// O botão "atualizar agora" (decisão do dono, 25/09/2026). Chama a rota que esquece o guardado da hora e dispara a
// releitura do Omie pela API, e depois recarrega a página — que então relê o cache já renovado e as planilhas do DFC.
//
// A RELEITURA DO OMIE É MAIS LENTA QUE O CLIQUE (são centenas de páginas, com a pausa que o limite de consumo pede).
// Por isso o botão não espera por ela: recarrega a página, e a página mostra o último guardado com a nota de que a
// releitura está em curso. Apertar de novo depois traz o que já chegou.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Atualizar({ ano }) {
  const [indo, setIndo] = useState(false);
  const router = useRouter();
  async function agora() {
    setIndo(true);
    try {
      await fetch('/api/atualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ano }),
      });
      router.refresh();
    } finally {
      setIndo(false);
    }
  }
  return (
    <button className="botao" onClick={agora} disabled={indo}>
      {indo ? 'atualizando…' : 'atualizar agora'}
    </button>
  );
}
