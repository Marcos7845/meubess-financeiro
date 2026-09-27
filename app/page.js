// TELA 1 — GESTÃO DE CONTAS. Layout de `docs/referencias/tela-1-gestao-de-contas.jpg` (as cores daquela imagem não
// valem; as da marca ficam em `app/globals.css`).
//
// COMPONENTE DE SERVIDOR: o cálculo roda aqui, no Node, e para o navegador vai só o número já pronto. Nenhuma chave,
// nenhum caminho de pasta e nenhum arquivo cruzam essa linha.
//
// OS FILTROS DESTA TELA são os de `docs/fontes.md`: ano · mês · CENTRO DE CUSTO (seleção múltipla) · EMPRESA. Todos
// moram na URL, como as pílulas de ano e mês sempre moraram — `?ano=2026&mes=8&cc=TI,RH&empresa=2` —, e é por isso que
// um link colado no chat e a captura da tela mostram exatamente a mesma coisa. O centro de custo é uma pílula por nome
// de departamento, juntando as empresas 1 e 2 pelo nome (decisão do dono, 25/09/2026); clicar acende, clicar de novo
// apaga, e "todos" limpa a escolha. A EMPRESA (decisão do dono, 27/09/2026) são três escolhas exclusivas — empresa 1,
// empresa 2 ou as duas — e o desenho dela mora em `app/empresa.js`, que as três telas usam. Onde um filtro não alcança
// o número, o próprio cartão ou bloco diz isso — ver `app/filtrado.js` e `docs/filtros.md`.

import { dadosDaTela1, mesCorrente } from '../lib/dados.mjs';
import { NOMES_DOS_MESES, dois } from '../lib/regras/periodo.mjs';
import { comoLista } from '../lib/regras/filtros.mjs';
import Atualizar from './atualizar.js';
import FiltroDeEmpresa from './empresa.js';
import Filtrado from './filtrado.js';
import UltimaLeitura, { AvisoDoOmie } from './ultima-leitura.js';

// Sem cache do Next: quem decide quando reler é `lib/dados.mjs`, de hora em hora.
export const dynamic = 'force-dynamic';

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// O dinheiro é formatado aqui, na hora de desenhar, e só aqui. Nada disso é gravado em arquivo.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const emReais = (centavos) => dinheiro.format((centavos ?? 0) / 100);

function Cartao({ c }) {
  const valor = c.tipo === 'percentual'
    ? (c.valor === null ? '—' : porcento.format(c.valor))
    : emReais(c.valor);
  return (
    <div className="cartao">
      <div className="rotulo" title={c.nome}>{c.nome}</div>
      <div className={`numero${c.negativo ? ' neg' : ''}`}>{c.negativo ? `-${valor}` : valor}</div>
      <div className="pe">
        {c.contagem.dfc !== null ? `${c.contagem.dfc} do DFC · ` : ''}{c.contagem.omie} do Omie
      </div>
      <Filtrado i={c} />
    </div>
  );
}

// O NOME DO CLIENTE, sempre com o código ao lado no `data-codigo`: é por ele que `scripts/capturar-tela.mjs` troca o
// nome antes de a captura entrar no repositório. Igual à Tela 3 — toda aparição de nome de cliente passa por aqui.
function Cliente({ c }) {
  return <span className="cliente" data-codigo={c.codigo}>{c.nome ?? `cliente ${c.codigo}`}</span>;
}

function Barras({ itens, conteudo = (i) => i.nome, titulo = (i) => i.nome }) {
  const maior = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
  return (
    <div className="barras">
      {itens.length === 0 && <p className="legenda">nenhum lançamento entrou neste mês.</p>}
      {itens.map((i, n) => (
        <div className="barra" key={n}>
          <span className="nome" title={titulo(i)}>{conteudo(i)}</span>
          <span className="trilho"><span className="preenche" style={{ width: `${(Math.abs(i.valor) / maior) * 100}%` }} /></span>
          <span className="valor">{emReais(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Pagina({ searchParams }) {
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  // O FILTRO DE CENTRO DE CUSTO vem da URL como lista de nomes; quem o resolve em código de departamento de cada
  // empresa é `lib/regras/filtros.mjs`, dentro do cálculo, contra o cadastro que o cache tem.
  const cc = comoLista(q?.cc);
  // O FILTRO DE EMPRESA vai cru do mesmo jeito: `lib/regras/filtros.mjs` o normaliza dentro do cálculo.
  const empresa = comoLista(q?.empresa);
  const d = await dadosDaTela1({ ano, mes, filtro: { cc, empresa } });
  const fcc = d.filtros.cc;
  const femp = d.filtros.empresa;

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const bloco = (id) => d.blocos.find((b) => b.id === id);
  const dias = bloco('receita-despesa-por-dia').dados;
  const meses = bloco('receita-despesa-por-mes').dados;
  const maiorDia = Math.max(1, ...dias.flatMap((x) => [x.entradas, x.gastos]));
  const maiorMes = Math.max(1, ...meses.flatMap((x) => [x.entradas, x.gastos]));
  const anos = [2026];

  // A URL da tela com uma troca: é assim que cada pílula sabe para onde levar, e é o único lugar onde o estado do
  // filtro é escrito. `cc` sai da URL quando a escolha fica vazia, para o link do sem-filtro ser o de sempre.
  const url = ({ ano: a = ano, mes: m = mes, cc: c = fcc.escolhidos, empresa: e = (femp.ativo ? femp.escolhidas : []) }) => {
    const p = new URLSearchParams({ ano: String(a), mes: String(m) });
    if (c.length) p.set('cc', c.join(','));
    if (e.length) p.set('empresa', e.join(','));
    return `/?${p}`;
  };
  const alternar = (nome) => (fcc.escolhidos.includes(nome)
    ? fcc.escolhidos.filter((x) => x !== nome)
    : [...fcc.escolhidos, nome]);
  // A EMPRESA ESCOLHIDA ATRAVESSA AS ABAS: ela é o filtro das três telas, e trocar de tela não pode desfazê-la.
  const paraOutraTela = femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : '';

  return (
    <>
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">Gestão de Contas</span>
        <nav className="abas">
          <span className="ativa">Dashboard</span>
          <a href={`/dre?ano=${ano}&mes=${mes}${paraOutraTela}`}>DRE</a>
          <a href={`/receber?ano=${ano}&mes=${mes}${paraOutraTela}`}>Contas a Receber</a>
          <span>Centro de Custo</span>
          <span>Fluxo de caixa</span>
        </nav>
      </header>

      <AvisoDoOmie leituras={d.leituras} />

      {!d.dfc.ok && (
        <p className="aviso">
          <strong>O DFC não foi lido nesta rodada</strong> — {d.dfc.motivo}. Os cartões cuja fonte principal é o DFC
          aparecem zerados; o lado do Omie segue valendo.
        </p>
      )}

      {fcc.faltaLeitura.length > 0 && fcc.escolhidos.length > 0 && (
        <p className="aviso">
          <strong>O filtro de centro de custo não pôde ser aplicado</strong> — a leitura do Omie com
          <code> cExibirDepartamentos: &quot;S&quot;</code>, a única que traz o rateio por departamento, não está no
          cache local da empresa {fcc.faltaLeitura.join(' e ')}. A tela está mostrando o mês inteiro, sem filtro, e
          diz isso aqui em vez de fingir que filtrou. Rode <code>node scripts/ler-omie-faltante.mjs</code>.
        </p>
      )}

      {fcc.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Nome de centro de custo que não existe no cadastro:</strong> {fcc.desconhecidos.join(', ')}. Ele foi
          ignorado — o filtro usa os {fcc.opcoes.length} nomes de <code>geral/departamentos</code>.
        </p>
      )}

      <div className="barra-filtros">
        <span className="rotulo-filtro">ano</span>
        <span className="grupo">
          {anos.map((a) => (
            <a className={`pilula${a === ano ? ' ativa' : ''}`} href={url({ ano: a })} key={a}>{a}</a>
          ))}
        </span>
        <span className="rotulo-filtro">mês</span>
        <span className="grupo">
          {MESES_CURTOS.slice(1).map((m, i) => (
            <a className={`pilula${i + 1 === mes ? ' ativa' : ''}`} href={url({ mes: i + 1 })} key={m}>{m}</a>
          ))}
        </span>
      </div>

      <div className="barra-filtros">
        <span className="rotulo-filtro">centro de custo</span>
        <span className="grupo">
          <a className={`pilula limpar${fcc.escolhidos.length === 0 ? ' ativa' : ''}`} href={url({ cc: [] })}>todos</a>
          {fcc.opcoes.map((nome) => (
            <a className={`pilula${fcc.escolhidos.includes(nome) ? ' ativa' : ''}`} href={url({ cc: alternar(nome) })} key={nome}>
              {nome}
            </a>
          ))}
        </span>
      </div>

      <FiltroDeEmpresa f={femp} href={(e) => url({ empresa: e ? [e] : [] })}>
        Ele vale em toda contagem do Omie desta tela, no &quot;Top 10 receitas&quot; inteiro — que é do Omie — e no
        cartão &quot;Desp. Pendentes&quot; inteiro, que sai dos títulos a pagar por vencimento. O que vem do DFC não:
        cada cartão e cada bloco de fonte DFC diz, ali mesmo, que o número é das duas empresas somadas.
      </FiltroDeEmpresa>

      <p className="aviso leve">
        {fcc.aplicado
          ? <>
            <strong>Filtrado por centro de custo:</strong> {fcc.escolhidos.join(', ')}. O filtro vale sobre o rateio do
            Omie (<code>departamentos[].nDistrValor</code>), juntando as empresas 1 e 2 pelo nome do departamento
            (decisão do dono, 25/09/2026). Cartão ou bloco em que ele não alcança o número diz isso ali mesmo.
          </>
          : <>
            <strong>Sem filtro de centro de custo:</strong> a tela mostra {NOMES_DOS_MESES[mes]} de {ano} inteiro. Os
            {' '}{fcc.opcoes.length} nomes são os de <code>geral/departamentos</code>, os mesmos nas duas empresas, e o
            filtro junta os dois cadastros pelo nome porque nenhum código coincide (decisão do dono, 25/09/2026).
            {' '}{fcc.semRateio.empresa1 + fcc.semRateio.empresa2} lançamentos do mês
            ({fcc.semRateio.empresa1} na empresa 1 e {fcc.semRateio.empresa2} na 2) não têm rateio de departamento
            nenhum: eles não têm nome para juntar e ficam fora de qualquer escolha de centro de custo.
          </>}
      </p>

      <section className="cartoes">
        {['saldo', 'receitas', 'despesas', 'despesas-pagas', 'despesas-pendentes', 'despesas-funcionarios', 'percentual-funcionarios']
          .map((id) => <Cartao c={cartao(id)} key={id} />)}
      </section>

      <div className="grade">
        <section className="painel">
          <h2 className="alt">Top 10 despesas</h2>
          <div className="corpo">
            <Barras itens={bloco('top-10-despesas').dados} />
            <Filtrado i={bloco('top-10-despesas')} />
          </div>
        </section>

        <section className="painel">
          <h2>Top 10 receitas</h2>
          <div className="corpo">
            <Barras itens={bloco('top-10-receitas').dados}
              conteudo={(i) => <Cliente c={i.cliente} />}
              titulo={(i) => i.cliente.nome ?? `cliente ${i.cliente.codigo}`} />
            <Filtrado i={bloco('top-10-receitas')} />
          </div>
        </section>

        <section className="painel">
          <h2>Receita × despesa por dia</h2>
          <div className="corpo">
            <p className="legenda">
              <span className="chave rec" />receita &nbsp; <span className="chave desp" />despesa &nbsp;
              — {NOMES_DOS_MESES[mes]} de {ano}
            </p>
            <div className="dias">
              {dias.map((x) => (
                <div className="dia" key={x.dia} title={`dia ${dois(x.dia)}: ${emReais(x.entradas)} / ${emReais(x.gastos)}`}>
                  <span className="rec" style={{ height: `${(x.entradas / maiorDia) * 55}px` }} />
                  <span className="desp" style={{ height: `${(x.gastos / maiorDia) * 55}px` }} />
                  <span className="n">{x.dia}</span>
                </div>
              ))}
              {dias.length === 0 && <p className="legenda">o bloco por dia do arquivo do mês não foi lido.</p>}
            </div>
            <Filtrado i={bloco('receita-despesa-por-dia')} />
          </div>
        </section>

        <section className="painel larga">
          <h2>Receita × despesa por mês — {ano}</h2>
          <div className="corpo">
            <p className="legenda"><span className="chave rec" />receita &nbsp; <span className="chave desp" />despesa</p>
            <div className="dias" style={{ height: '150px' }}>
              {meses.map((x) => (
                <div className="dia" key={x.mes} title={`${MESES_CURTOS[x.mes]}: ${emReais(x.entradas)} / ${emReais(x.gastos)}`}>
                  <span className="rec" style={{ height: `${(x.entradas / maiorMes) * 65}px` }} />
                  <span className="desp" style={{ height: `${(x.gastos / maiorMes) * 65}px` }} />
                  <span className="n">{MESES_CURTOS[x.mes]}</span>
                </div>
              ))}
              {meses.length === 0 && <p className="legenda">a série do ano não foi lida.</p>}
            </div>
            <Filtrado i={bloco('receita-despesa-por-mes')} />
          </div>
        </section>
      </div>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          Empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora — o Omie pela API, só consulta.
          {d.dfc.ok ? ` DFC: ${d.dfc.fonte}, ${d.dfc.arquivo}.` : ''}
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </>
  );
}
