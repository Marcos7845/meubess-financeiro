// Segunda conta dos "Compromissos" da Tela 2, sobre a resposta crua do Omie e as células da planilha de contratos.
// Não importa nada de lib/regras nem de lib/indicadores: as regras são as do contrato em docs/fontes.md, escritas
// de novo aqui para que um erro da camada da tela apareça como diferença.
import { centavos, normal, soma } from './core.mjs';

const data = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '')); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; };
const fimDoMes = (a, m) => Date.UTC(a, m, 0);

// Sinais de clientes (título a receber `ADVR`) pagos e ainda sem NF no fim do dia. A NF sai quando o pedido está
// faturado e o sinal traz o número dela; a data é a emissão do primeiro `VENR` do mesmo pedido com o mesmo número, ou
// o `dFat` do pedido. Pedido cancelado não tira o sinal.
export function sinaisDeClientes({ titulos, pedidos, recorte, ano, mes }) {
  const sinais = [];
  for (const emp of ['1', '2']) {
    const doEmp = titulos.filter((t) => t.emp === emp).map((t) => t.cabecTitulo ?? {});
    const porPedido = new Map();
    for (const c of doEmp) if (c.nCodOS) porPedido.set(String(c.nCodOS), [...(porPedido.get(String(c.nCodOS)) ?? []), c]);
    const pedidoDe = new Map(pedidos.filter((p) => p.emp === emp).map((p) => [String(p.cabecalho?.codigo_pedido), p]));
    for (const c of doEmp) {
      if (c.cOrigem !== 'ADVR' || !recorte.has(`${emp}|${c.nCodCC}`)) continue;
      if (!['RECEBIDO', 'LIQUIDADO'].includes(normal(c.cStatus).replace(/\s/g, ''))) continue;
      const pago = data(c.dDtPagamento);
      if (pago === null) continue;
      const pedido = pedidoDe.get(String(c.nCodOS)) ?? null;
      const nf = String(c.cNumDocFiscal ?? '').trim();
      const comNf = pedido?.infoCadastro?.faturado === 'S' && Boolean(nf);
      let nfEm = null;
      if (comNf) {
        const venr = (porPedido.get(String(c.nCodOS)) ?? []).filter((v) => v.cOrigem === 'VENR' && String(v.cNumDocFiscal ?? '').trim() === nf)
          .map((v) => data(v.dDtEmissao)).filter((x) => x !== null).sort((a, b) => a - b);
        nfEm = venr[0] ?? data(pedido?.infoCadastro?.dFat);
      }
      sinais.push({ emp, titulo: String(c.nCodTitulo), valor: centavos(c.nValorTitulo), pago, comNf, nfEm });
    }
  }
  const aberto = (s, dia) => s.pago <= dia && !(s.comNf && (s.nfEm === null || s.nfEm <= dia));
  const fim = fimDoMes(ano, mes), inicio = fimDoMes(ano, mes - 1);
  const noFim = sinais.filter((s) => aberto(s, fim)), noInicio = sinais.filter((s) => aberto(s, inicio));
  const valor = (xs) => soma(xs.map((s) => s.valor));
  return { saldo: valor(noFim), inicio: valor(noInicio), variacao: valor(noFim) - valor(noInicio), linhas: noFim, lidos: sinais.length };
}

// Saldo devedor dos contratos de capital de giro no corte: principal mais juros já corridos, sem juros futuros. Juros
// compostos pela taxa ao mês, pró-rata em meses de 30 dias; cada parcela vencida até o corte é paga; parcela é a da
// planilha ou a da tabela Price. Contrato quitado (nenhuma parcela futura) tem saldo zero.
export function saldoDeContratos(linhas, corte) {
  const cab = linhas.find((l) => [...l.cel.values()].some((c) => normal(c.t) === 'BANCO'));
  if (!cab) return { ok: false, motivo: 'planilha sem cabeçalho BANCO' };
  const col = {};
  for (const [letra, c] of cab.cel) col[normal(c.t)] = letra;
  const num = (l, nome) => { const c = l.cel.get(col[nome]); return c?.v ?? (c?.t ? Number(String(c.t).replace(/\./g, '').replace(',', '.')) : null); };
  const serial = (v) => (typeof v === 'number' ? Date.UTC(1899, 11, 30) + Math.round(v) * 86400000 : null);
  const contratos = [];
  for (const l of linhas.filter((x) => x.n > cab.n)) {
    const taxaCol = Object.keys(col).find((k) => k.startsWith('TAXA'));
    const c = { linha: l.n, valor: num(l, 'VALOR'), data: serial(num(l, 'DATA')), n: num(l, 'PARCELAS'),
      taxa: taxaCol ? num(l, taxaCol) : null, primeiro: serial(num(l, 'PRIMEIRO VENCIMENTO')), parcela: num(l, 'VALOR DA PARCELA') };
    if (c.valor === null && !l.cel.get(col.BANCO)?.t) continue;
    if ([c.valor, c.data, c.n, c.taxa, c.primeiro].some((x) => x === null || Number.isNaN(x)) || c.taxa < 0) continue;
    contratos.push(c);
  }
  const vencimento = (primeiro, k) => {
    const d = new Date(primeiro), alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d.getUTCDate(), ultimo));
  };
  const saldos = contratos.map((c) => {
    if (corte < c.data) return { linha: c.linha, saldo: 0 };
    const i = c.taxa / 100, n = Math.round(c.n), valor = Math.round(c.valor * 100);
    const pmt = c.parcela !== null && !Number.isNaN(c.parcela) ? Math.round(c.parcela * 100)
      : Math.round(i === 0 ? valor / n : valor * i / (1 - (1 + i) ** -n));
    let s = valor, ultimo = c.data, futuras = 0;
    for (let k = 0; k < n; k++) {
      const v = vencimento(c.primeiro, k);
      if (v <= corte) { s = s * (1 + i) ** ((v - ultimo) / 86400000 / 30) - pmt; ultimo = v; } else futuras++;
    }
    return { linha: c.linha, saldo: futuras ? Math.max(0, Math.round(s * (1 + i) ** ((corte - ultimo) / 86400000 / 30))) : 0 };
  });
  return { ok: true, saldo: soma(saldos.map((x) => x.saldo)), contratos: saldos };
}
