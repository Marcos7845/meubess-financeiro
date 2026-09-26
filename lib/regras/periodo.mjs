// Datas, do jeito que o Omie e o DFC as escrevem. Sem regra de negócio: só calendário.

const NOMES_DOS_MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
  'outubro', 'novembro', 'dezembro'];

const dois = (x) => String(x).padStart(2, '0');
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();

// `dd/mm/aaaa` — o formato do Omie em todo campo de data.
const dataBR = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '')); return m ? { d: +m[1], m: +m[2], a: +m[3] } : null; };

// Os recortes de período que as telas usam. `noMes` é o regime de caixa: o lançamento conta no mês em que foi pago.
const noMesDe = (ano, mes) => (s) => { const d = dataBR(s); return Boolean(d) && d.a === ano && d.m === mes; };
const noAnoDe = (ano) => (s) => { const d = dataBR(s); return Boolean(d) && d.a === ano; };

const periodoBR = (ano, mes) => `01/${dois(mes)}/${ano} a ${ultimoDia(ano, mes)}/${dois(mes)}/${ano}`;

export { NOMES_DOS_MESES, dois, ultimoDia, dataBR, noMesDe, noAnoDe, periodoBR };
