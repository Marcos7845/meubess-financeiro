// O botão "atualizar agora" da tela (decisão do dono, 25/09/2026): joga fora o que está guardado para a próxima
// leitura ir às fontes, sem esperar a hora virar. Não escreve em lugar nenhum — só esquece.
import { esquecer } from '../../../lib/dados.mjs';

export async function POST() {
  esquecer();
  return Response.json({ ok: true, em: new Date().toISOString() });
}
