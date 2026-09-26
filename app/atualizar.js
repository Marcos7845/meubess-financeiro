'use client';

// O botão "atualizar agora" (decisão do dono, 25/09/2026). Chama a rota que esquece o guardado da hora e recarrega
// a página, que então relê o cache do Omie e as planilhas do DFC.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Atualizar() {
  const [indo, setIndo] = useState(false);
  const router = useRouter();
  async function agora() {
    setIndo(true);
    try {
      await fetch('/api/atualizar', { method: 'POST' });
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
