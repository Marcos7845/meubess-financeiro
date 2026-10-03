// O LIMITE DE TENTATIVAS DO LOGIN — um mapa em memória, `chave → { desde, n }`, com janela e TETO DE TAMANHO.
//
// O mapa nunca passa de `teto` entradas: antes de abrir uma chave nova com o mapa cheio, poda as vencidas; se ainda
// estiver cheio, descarta as mais antigas. Toda tentativa errada regrava a chave no fim do mapa, então quem está sendo
// atacado agora fica entre as últimas e é a última a sair. `/api/entrar` usa um mapa só, para as duas chaves dela.

function criarLimite({ janelaMs, teto }) {
  const mapa = new Map();
  const viva = (r, agora) => Boolean(r) && agora - r.desde < janelaMs;
  return {
    bloqueado(chave, limite, agora = Date.now()) {
      const r = mapa.get(chave);
      return viva(r, agora) && r.n >= limite;
    },
    errou(chave, agora = Date.now()) {
      const r = mapa.get(chave);
      mapa.delete(chave);
      if (mapa.size >= teto) for (const [k, v] of mapa) if (!viva(v, agora)) mapa.delete(k);
      while (mapa.size >= teto) mapa.delete(mapa.keys().next().value);
      mapa.set(chave, viva(r, agora) ? { desde: r.desde, n: r.n + 1 } : { desde: agora, n: 1 });
    },
    esquecer(chave) { mapa.delete(chave); },
    get tamanho() { return mapa.size; },
  };
}

export { criarLimite };
