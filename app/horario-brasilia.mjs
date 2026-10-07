// Datas recebidas como instantes ISO: a apresentação das telas usa sempre o horário de Brasília.
const FUSO = 'America/Sao_Paulo';
const HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO,
});
const DIA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO,
});

function formatar(iso, formato) {
  if (!iso) return '—';
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '—' : formato.format(data);
}

export const quandoEmBrasilia = (iso) => formatar(iso, HORA);
export const diaEmBrasilia = (iso) => formatar(iso, DIA);

export const avisoDuranteReleitura = (omie) => omie?.estado === 'em curso'
  ? 'Atualizando dados do Omie… os números podem mudar em instantes.'
  : null;
