// Sugestão isolada do auditor. O histórico bruto só existe em memória; jamais entra no HTML ou no log.
import { normal } from './core.mjs';

const URL = 'https://openrouter.ai/api/alpha/decisions';
const MODELO = 'typesafe/jev-1.13';
export const LIMIAR_PADRAO = 0.8;

// Lista fechada de palavras de natureza financeira. Qualquer token desconhecido, inclusive nome próprio,
// banco, documento, data, conta, agência ou valor, é descartado antes de montar a requisição.
const VOCABULARIO = new Set(`ALUGUEL AGUA ARMAZENAGEM BOLETO BOLETOS CARTAO CARTOES COBRANCA COMISSAO
  COMPRA CONTRIBUICAO CREDITO CSLL DARF DEB DEBITO DEPOSITO DEVOLUCAO EMPRESTIMO ENERGIA
  ESTORNO FATURA FGTS FOLHA FORNECEDOR FRETE IMPOSTO INSS INTERNET IOF IRPJ ISS JUROS
  MERCADORIA PAGAMENTO PAGAMENTOS PAGTO PESSOAL PGTO PIX PROLABORE RECEBIDO RECEBIMENTO
  RECEBIMENTOS REEMBOLSO RENDIMENTO RENDIMENTOS RESCISAO RESGATE SALARIO SEGURO SEGUROS
  SERVICO TARIFA TARIFAS TED TELEFONIA TRANSFERENCIA TRIBUTO VENDA`.split(/\s+/).filter(Boolean));

export function limparDescricao(bruta) {
  if (typeof bruta !== 'string' || bruta.length > 2000) return null;
  const tokens = normal(bruta).match(/[A-Z]+/g) ?? [];
  const limpos = tokens.filter((t) => VOCABULARIO.has(t));
  return limpos.slice(0, 20).join(' ').slice(0, 160) || null;
}

export async function sugerirClassificacoes(descricoes, categorias, { chave = process.env.OPENROUTER_API_KEY,
  fetcher = fetch, timeoutMs = 5000 } = {}) {
  const escolhas = [...new Set(categorias)].sort();
  const criterios = Object.fromEntries(escolhas.map((nome, i) => [`c${i + 1}`, nome]));
  const porCodigo = new Map(Object.entries(criterios));
  const resultados = new Map();
  const estatisticas = { chamadas: 0, caracteres: 0, lancamentosEnviados: 0 };
  // Por que um texto limpo ficou sem categoria válida. Só guarda o motivo, nunca o texto, e é contado por lançamento.
  const motivos = new Map();
  const porMotivo = { classificada: 0, incerta: 0, foraDaLista: 0, malformada: 0, erroOuLimite: 0, semChave: 0 };
  const perguntas = { categoria: { type: 'choice', instructions: 'Choose the best DFC category for message. If there is insufficient evidence, choose uncertain.',
    criteria: { ...criterios, uncertain: 'Insufficient information in the description' } } };
  for (const bruta of descricoes) {
    const limpa = limparDescricao(bruta);
    if (!limpa) continue;
    if (chave && escolhas.length) estatisticas.lancamentosEnviados++;
    if (!resultados.has(limpa)) {
      if (!chave || !escolhas.length) { resultados.set(limpa, null); motivos.set(limpa, 'semChave'); }
      else {
        estatisticas.chamadas++;
        estatisticas.caracteres += limpa.length;
        try {
          const resposta = await fetcher(URL, { method: 'POST', headers: {
            Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', 'X-Title': 'MeuBESS auditoria',
          }, body: JSON.stringify({ model: MODELO, state: { message: limpa }, questions: perguntas }),
          signal: AbortSignal.timeout(timeoutMs) });
          const json = await resposta.json().catch(() => ({}));
          const escolha = json?.answers?.categoria?.choice;
          const confianca = Number(json?.answers?.categoria?.confidence);
          if (!resposta.ok) { resultados.set(limpa, null); motivos.set(limpa, 'erroOuLimite'); }
          else if (escolha === 'uncertain') { resultados.set(limpa, null); motivos.set(limpa, 'incerta'); }
          else if (!porCodigo.has(escolha)) { resultados.set(limpa, null); motivos.set(limpa, 'foraDaLista'); }
          else if (!(Number.isFinite(confianca) && confianca >= 0 && confianca <= 1)) { resultados.set(limpa, null); motivos.set(limpa, 'malformada'); }
          else resultados.set(limpa, { categoria: porCodigo.get(escolha), confianca });
        } catch {
          resultados.set(limpa, null);
          motivos.set(limpa, 'erroOuLimite');
        }
      }
    }
    porMotivo[motivos.get(limpa) ?? 'classificada']++;
  }
  return { resultados, estatisticas, porMotivo };
}

export function compararComDfc(dfc, extratos, conciliacao, resultados, limiar = LIMIAR_PADRAO) {
  // A identidade por conta, dia e valor fica inteiramente local. Só é segura quando
  // há uma linha de cada lado; lotes e multiplicidades não ganham categoria por acaso.
  const porChaveDfc = new Map(), porChaveExtrato = new Map(), porPar = new Map(), idsExtrato = new Map();
  const chaveDfc = (l) => `${normal(l.conta)}|${l.data?.a}-${l.data?.m}-${l.data?.d}|${l.movimento}`;
  const chaveExtrato = (e) => `${normal(e.conta)}|${Number(e.data?.slice(0, 4))}-${Number(e.data?.slice(5, 7))}-${Number(e.data?.slice(8, 10))}|${e.valor}`;
  for (const l of dfc.linhas) {
    const kDia = chaveDfc(l);
    porChaveDfc.set(kDia, [...(porChaveDfc.get(kDia) ?? []), l]);
    const ids = conciliacao?.casadas.get(l.n) ?? [];
    if (ids.length !== 1) continue;
    const k = `${normal(l.conta)}|${ids[0]}`;
    porPar.set(k, [...(porPar.get(k) ?? []), l]);
  }
  for (const e of extratos.filter((e) => e.valor !== 0)) {
    const k = chaveExtrato(e);
    porChaveExtrato.set(k, (porChaveExtrato.get(k) ?? 0) + 1);
    const id = `${normal(e.conta)}|${e.id}`;
    idsExtrato.set(id, (idsExtrato.get(id) ?? 0) + 1);
  }
  const exatos = new Set([...porChaveDfc].filter(([k, linhas]) => linhas.length === 1 && porChaveExtrato.get(k) === 1)
    .map(([, linhas]) => linhas[0].n));
  const linhas = extratos.filter((e) => e.valor !== 0).map((e) => {
    const chave = chaveExtrato(e);
    const candidatos = porChaveDfc.get(chave) ?? [];
    const exato = candidatos.length === 1 && porChaveExtrato.get(chave) === 1 ? candidatos[0] : null;
    const id = `${normal(e.conta)}|${e.id}`;
    const pares = porPar.get(id) ?? [];
    const dfcLinha = exato ?? (idsExtrato.get(id) === 1 && pares.length === 1 && !exatos.has(pares[0].n) ? pares[0] : null);
    const texto = limparDescricao(e.historico);
    const sugestao = resultados.get(texto) ?? null;
    return { texto, linhaDfc: dfcLinha?.n ?? null, verdade: dfcLinha?.sub2 ?? null,
      sugestao: sugestao?.categoria ?? null, confianca: sugestao?.confianca ?? null,
      revisao: !sugestao || sugestao.confianca < limiar, pareamento: exato ? 'dia e valor' : dfcLinha ? 'conciliacao' : null };
  });
  const elegiveis = linhas.filter((l) => l.verdade && l.sugestao);
  const categorias = [...new Set(dfc.linhas.map((l) => l.sub2).filter(Boolean))].sort().map((categoria) => {
    const c = elegiveis.filter((l) => l.verdade === categoria);
    return { categoria, totalDfc: dfc.linhas.filter((l) => l.sub2 === categoria).length,
      avaliadas: c.length, concordantes: c.filter((l) => l.sugestao === categoria).length };
  });
  // Erro por falta de informação no texto limpo: o mesmo texto limpo aparece, no par individual com o DFC, em mais de
  // uma categoria verdadeira. Nenhum classificador acerta os dois lados; o erro vem da limpeza, não do modelo.
  const verdadesPorTexto = new Map();
  for (const l of linhas.filter((l) => l.verdade && l.texto)) {
    verdadesPorTexto.set(l.texto, new Set([...(verdadesPorTexto.get(l.texto) ?? []), l.verdade]));
  }
  const erros = elegiveis.filter((l) => l.verdade !== l.sugestao);
  const errosPorTextoAmbiguo = erros.filter((l) => verdadesPorTexto.get(l.texto).size > 1).length;
  const sugeridas = [...new Set(elegiveis.map((l) => l.sugestao))].sort().map((categoria) => {
    const c = elegiveis.filter((l) => l.sugestao === categoria);
    return { categoria, sugeridas: c.length, acertos: c.filter((l) => l.verdade === categoria).length };
  });
  return { linhas, categorias, sugeridas, erros: erros.length, errosPorTextoAmbiguo, avaliadas: elegiveis.length,
    concordantes: elegiveis.filter((l) => l.verdade === l.sugestao).length,
    baixaConfianca: linhas.filter((l) => l.sugestao && l.revisao).length,
    naoClassificadas: linhas.filter((l) => !l.sugestao).length,
    classificadas: linhas.filter((l) => l.sugestao).length,
    paresPorDiaValor: linhas.filter((l) => l.pareamento === 'dia e valor').length,
    paresPorConciliacao: linhas.filter((l) => l.pareamento === 'conciliacao').length };
}
