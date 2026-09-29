// O botão "atualizar agora" da tela (decisão do dono, 25/09/2026): joga fora o que está guardado para a próxima
// leitura ir às fontes, sem esperar a hora virar.
//
// E, desde 27/09/2026, ir às fontes quer dizer ir ao OMIE: esta rota dispara a releitura pela API — só métodos de
// consulta — ali mesmo, sem esperar que ela termine, para que ela já esteja andando quando o navegador recarregar a
// página. Quem recalcula os números é a página; esta rota só esquece e dispara.
//
// NÃO ESCREVE NO OMIE NEM NAS PLANILHAS. O único lugar em que a releitura escreve é o cache local `.cache/omie/`.

import { esquecer, mesCorrente, RAIZ } from '../../../lib/dados.mjs';
import { pedirReleituraDoOmie } from '../../../lib/regras/omie-releitura.mjs';
import { quemPediu } from '../../../lib/acesso/sessao.mjs';

// SÓ COM LOGIN (desde 29/09/2026): o `proxy.js` já barra, e a rota confere de novo por conta própria.
export async function POST(pedido) {
  if (!quemPediu(pedido)) return Response.json({ ok: false, erro: 'é preciso entrar' }, { status: 401 });
  esquecer();
  // O ano da tela de onde o botão foi apertado — o cache do Omie é guardado por ano. Sem corpo, o ano corrente.
  let ano = mesCorrente().ano;
  try {
    const corpo = await pedido.json();
    if (Number(corpo?.ano)) ano = Number(corpo.ano);
  } catch { /* sem corpo: fica o ano corrente */ }

  // `esperarMs: 0` — dispara e volta na hora. A releitura segue ao lado; a tela mostra o último guardado enquanto ela
  // não termina, e diz que está em curso.
  const omie = await pedirReleituraDoOmie({ raiz: RAIZ, ano, forcar: true, esperarMs: 0 });
  return Response.json({ ok: true, em: new Date().toISOString(), omie });
}
