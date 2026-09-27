// A HORA DA ÚLTIMA LEITURA DAS DUAS FONTES, e o aviso de quando o Omie não respondeu.
//
// COMPONENTE DE SERVIDOR, usado no rodapé das três telas. Recebe só `d.leituras` e `d.dfc`, que a camada de dados já
// montou: hora, estado e motivo. Nenhuma chave, nenhum caminho de pasta e nenhum valor em reais passam por aqui.
//
// POR QUE A TELA MOSTRA ISSO. As duas fontes falham de jeitos diferentes e em horas diferentes — o Omie pela API, o
// DFC pela pasta —, e o dono precisa saber de quando é o número que está lendo antes de decidir com ele
// (decisão do dono, 27/09/2026: as telas rodam neste computador, só para ele).

const HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// `2026-09-27T14:05:00.000Z` → "27/09, 11:05". Sem data nenhuma, um travessão.
const quando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : HORA.format(d);
};

// A frase que descreve o estado da releitura do Omie, sem repetir a hora.
function situacaoDoOmie(omie) {
  if (omie.estado === 'em curso') return `releitura em curso desde ${quando(omie.comecouEm)}`;
  if (omie.estado === 'ok') return `${omie.paginas} páginas nas ${omie.leiturasTotal} leituras`;
  if (omie.estado === 'parcial') return `${omie.leiturasOk} das ${omie.leiturasTotal} leituras — o resto ficou com o guardado anterior`;
  if (omie.estado === 'falhou') return 'a última tentativa não trouxe nada';
  return 'nunca relido por esta tela — o que está aqui foi gravado pelos scripts';
}

// O RODAPÉ. `usaDfc` é falso na Tela 3, que não lê planilha nenhuma: dizer "DFC: —" ali daria a entender que faltou
// leitura, quando na verdade aquela tela não tem esse lado.
export default function UltimaLeitura({ leituras, dfc = null, usaDfc = true }) {
  const omie = leituras.omie;
  return (
    <span className="ultima-leitura">
      <strong>Última leitura</strong> — Omie: {quando(omie.okEm)} ({situacaoDoOmie(omie)}).{' '}
      {usaDfc
        ? (dfc?.ok
          ? `DFC: ${quando(leituras.dfc.em)} (${dfc.fonte}).`
          : 'DFC: não lido nesta rodada.')
        : 'DFC: esta tela não lê o DFC.'}
    </span>
  );
}

// O AVISO, acima dos números, quando o Omie não respondeu ou ainda está respondendo. Mesma faixa que o aviso do DFC.
export function AvisoDoOmie({ leituras }) {
  const omie = leituras.omie;
  if (omie.estado === 'ok') return null;
  if (omie.estado === 'em curso') {
    return (
      <p className="aviso">
        <strong>A releitura do Omie está em curso</strong> — começou {quando(omie.comecouEm)} e leva alguns minutos.
        Os números abaixo são os da última leitura guardada ({quando(omie.okEm)}); recarregue a página daqui a pouco
        para ver os que chegaram.
      </p>
    );
  }
  if (omie.estado === 'falhou' || omie.estado === 'parcial') {
    return (
      <p className="aviso">
        <strong>
          {omie.estado === 'falhou'
            ? 'O Omie não respondeu na última releitura'
            : `O Omie respondeu só a ${omie.leiturasOk} das ${omie.leiturasTotal} leituras`}
        </strong>{' '}
        (tentada {quando(omie.tentadaEm)}). Os números são os da <strong>última leitura guardada</strong>
        {omie.okEm ? `, de ${quando(omie.okEm)}` : ''} — nada foi perdido, mas pode não estar do dia. Motivo:{' '}
        {omie.motivo ?? 'sem detalhe'}.
      </p>
    );
  }
  return (
    <p className="aviso">
      <strong>Esta tela ainda não releu o Omie</strong> — os números são os do cache que os scripts de leitura
      gravaram. Aperte <strong>atualizar agora</strong> no rodapé para buscar os de hoje.
    </p>
  );
}
