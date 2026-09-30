// Sugestão isolada do auditor. O histórico bruto só existe em memória; jamais entra no HTML ou no log.
import { normal } from './core.mjs';

const URL = 'https://openrouter.ai/api/alpha/decisions';
const MODELO = 'typesafe/jev-1.13';
export const LIMIAR_PADRAO = 0.8;

// Lista fechada de palavras de natureza financeira. Qualquer token desconhecido, inclusive nome próprio,
// banco, documento, data, conta, agência ou valor, é descartado antes de montar a requisição.
const VOCABULARIO = new Set(`ALUGUEL AGUA ARMAZENAGEM CARTAO COMISSAO COMPRA CONTRIBUICAO CSLL DEVOLUCAO
  EMPRESTIMO ENERGIA ESTORNO FGTS FOLHA FORNECEDOR FRETE IMPOSTO INSS INTERNET IOF IRPJ ISS
  JUROS MERCADORIA PAGAMENTO PESSOAL PIX PROLABORE RECEBIMENTO REEMBOLSO RENDIMENTO
  RESCISAO SALARIO SERVICO TARIFA TELEFONIA TRANSFERENCIA VENDA`.split(/\s+/).filter(Boolean));
const GENERICAS = new Set('PAGAMENTO RECEBIMENTO PIX CARTAO COMPRA SERVICO'.split(' '));

export function limparDescricao(bruta) {
  if (typeof bruta !== 'string' || bruta.length > 2000) return null;
  const tokens = normal(bruta).match(/[A-Z]+/g) ?? [];
  const limpos = tokens.filter((t) => VOCABULARIO.has(t));
  if (!limpos.some((t) => !GENERICAS.has(t))) return null;
  return limpos.slice(0, 20).join(' ').slice(0, 160) || null;
}

export async function sugerirClassificacoes(descricoes, categorias, { chave = process.env.OPENROUTER_API_KEY,
  fetcher = fetch, timeoutMs = 5000 } = {}) {
  const escolhas = [...new Set(categorias)].sort();
  const criterios = Object.fromEntries(escolhas.map((nome, i) => [`c${i + 1}`, nome]));
  const porCodigo = new Map(Object.entries(criterios));
  const resultados = new Map();
  const estatisticas = { chamadas: 0, caracteres: 0 };
  const perguntas = { categoria: { type: 'choice', instructions: 'Choose the best DFC category for message. If there is insufficient evidence, choose uncertain.',
    criteria: { ...criterios, uncertain: 'Insufficient information in the description' } } };
  for (const bruta of descricoes) {
    const limpa = limparDescricao(bruta);
    if (!limpa || resultados.has(limpa)) continue;
    if (!chave || !escolhas.length) { resultados.set(limpa, null); continue; }
    estatisticas.chamadas++;
    estatisticas.caracteres += limpa.length;
    try {
      const resposta = await fetcher(URL, { method: 'POST', headers: {
        Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', 'X-Title': 'MeuBESS auditoria',
      }, body: JSON.stringify({ model: MODELO, state: { message: limpa }, questions: perguntas }),
      signal: AbortSignal.timeout(timeoutMs) });
      const json = await resposta.json();
      const escolha = json?.answers?.categoria?.choice;
      const confianca = Number(json?.answers?.categoria?.confidence);
      resultados.set(limpa, resposta.ok && porCodigo.has(escolha) && Number.isFinite(confianca)
        && confianca >= 0 && confianca <= 1 ? { categoria: porCodigo.get(escolha), confianca } : null);
    } catch {
      resultados.set(limpa, null);
    }
  }
  return { resultados, estatisticas };
}

export function compararComDfc(dfc, extratos, conciliacao, resultados, limiar = LIMIAR_PADRAO) {
  const porPar = new Map();
  for (const l of dfc.linhas) {
    const ids = conciliacao?.casadas.get(l.n) ?? [];
    if (ids.length !== 1) continue;
    const k = `${normal(l.conta)}|${ids[0]}`;
    porPar.set(k, [...(porPar.get(k) ?? []), l]);
  }
  const linhas = extratos.filter((e) => e.valor !== 0).map((e) => {
    const pares = porPar.get(`${normal(e.conta)}|${e.id}`) ?? [];
    const dfcLinha = pares.length === 1 ? pares[0] : null;
    const sugestao = resultados.get(limparDescricao(e.historico)) ?? null;
    return { linhaDfc: dfcLinha?.n ?? null, verdade: dfcLinha?.sub2 ?? null,
      sugestao: sugestao?.categoria ?? null, confianca: sugestao?.confianca ?? null,
      revisao: !sugestao || sugestao.confianca < limiar };
  });
  const elegiveis = linhas.filter((l) => l.verdade && l.sugestao);
  const categorias = [...new Set(dfc.linhas.map((l) => l.sub2).filter(Boolean))].sort().map((categoria) => {
    const c = elegiveis.filter((l) => l.verdade === categoria);
    return { categoria, totalDfc: dfc.linhas.filter((l) => l.sub2 === categoria).length,
      avaliadas: c.length, concordantes: c.filter((l) => l.sugestao === categoria).length };
  });
  return { linhas, categorias, avaliadas: elegiveis.length,
    concordantes: elegiveis.filter((l) => l.verdade === l.sugestao).length,
    baixaConfianca: linhas.filter((l) => l.sugestao && l.revisao).length,
    naoClassificadas: linhas.filter((l) => !l.sugestao).length };
}
