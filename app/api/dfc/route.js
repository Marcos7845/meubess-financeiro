// O DFC CHEGANDO DO PC — `/api/dfc`, protegida por um segredo e não pelo login das pessoas.
//
// Quem chama é `scripts/financeiro-enviar-dfc.mjs`, no PC do dono, sempre com `Authorization: Bearer
// <DFC_ENVIO_SEGREDO>`. As planilhas vão inteiras, como o PC as leu da pasta sincronizada, em três passos:
//
//   GET  /api/dfc   → o envio que vale hoje (nome, tamanho e sha256 de cada arquivo, e a hora) — para o PC saber o
//                     que o servidor já tem
//   PUT  /api/dfc   → uma planilha, o corpo cru (application/octet-stream); devolve o sha256 dela
//   POST /api/dfc   → fecha o envio: `{ arquivos: [{ nome, sha256 }] }`, a lista inteira da pasta. Grava a hora do
//                     envio, e as telas abrem as planilhas novas na próxima visita. Se faltar uma planilha, 409 com
//                     `faltam` e nada muda.
//
// Guarda no volume do servidor (`lib/regras/dfc-guardado.mjs`). Não escreve em planilha nenhuma nem no Omie.
// Sem `DFC_ENVIO_SEGREDO` no ambiente a rota recusa tudo: nunca fica aberta por esquecimento. Ela fica fora do
// `proxy.js` (o proxy só guardaria os primeiros 10 MB do corpo), e por isso confere o segredo antes de qualquer coisa.

import crypto from 'node:crypto';
import { fecharEnvio, guardarPedaco, ultimoEnvio } from '../../../lib/regras/dfc-guardado.mjs';
import { esquecerSemIrAoOmie } from '../../../lib/dados.mjs';
import { zipDentroDoTeto } from '../../../lib/regras/xlsx.mjs';

export const dynamic = 'force-dynamic';

const LIMITE_BYTES = 60 * 1024 * 1024;

function segredoConfere(pedido) {
  const esperado = process.env.DFC_ENVIO_SEGREDO;
  if (!esperado) return false;
  const veio = (pedido.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  // Compara os resumos, que têm sempre o mesmo tamanho, em tempo constante.
  const h = (t) => crypto.createHash('sha256').update(String(t)).digest();
  return crypto.timingSafeEqual(h(veio), h(esperado));
}

const recusado = () => Response.json({ ok: false, erro: 'segredo do envio ausente ou errado' }, { status: 401 });

export async function GET(pedido) {
  if (!segredoConfere(pedido)) return recusado();
  return Response.json({ ok: true, envio: ultimoEnvio() });
}

export async function PUT(pedido) {
  if (!segredoConfere(pedido)) return recusado();
  if (Number(pedido.headers.get('content-length') ?? 0) > LIMITE_BYTES) {
    return Response.json({ ok: false, erro: 'planilha grande demais' }, { status: 413 });
  }
  const conteudo = Buffer.from(await pedido.arrayBuffer());
  if (conteudo.length > LIMITE_BYTES) return Response.json({ ok: false, erro: 'planilha grande demais' }, { status: 413 });
  // O limite acima é do comprimido; o zip descompactado tem teto próprio, lido do diretório central.
  const zip = zipDentroDoTeto(conteudo);
  if (!zip.ok) return Response.json({ ok: false, erro: zip.motivo }, { status: zip.soma ? 413 : 400 });
  try { return Response.json({ ok: true, sha256: guardarPedaco(conteudo) }); }
  catch (e) { return Response.json({ ok: false, erro: e.message }, { status: 400 }); }
}

export async function POST(pedido) {
  if (!segredoConfere(pedido)) return recusado();
  let corpo;
  try { corpo = await pedido.json(); } catch { return Response.json({ ok: false, erro: 'corpo não é JSON' }, { status: 400 }); }
  try {
    const r = fecharEnvio(corpo?.arquivos);
    if (!r.ok) return Response.json({ ok: false, erro: 'faltam planilhas', faltam: r.faltam }, { status: 409 });
    esquecerSemIrAoOmie();
    return Response.json({ ok: true, em: r.envio.em, arquivos: r.envio.arquivos.length });
  } catch (e) {
    return Response.json({ ok: false, erro: e.message }, { status: 400 });
  }
}
