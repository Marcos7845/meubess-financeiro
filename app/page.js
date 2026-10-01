// TELA 1 — GESTÃO DE CONTAS.
//
// O LAYOUT É O DA SKILL DE VISUALIZAÇÃO DE DADOS que o dono mandou em 28/09/2026 — guardada em
// `.claude/skills/visualizacao-de-dados/SKILL.md`, com as adaptações deste repositório no topo dela. A história da
// tela (para quem é, que decisão ajuda a tomar, a frase de 5 segundos, as perguntas que ela responde) e o plano de
// gráficos, pergunta por pergunta, estão em `docs/layout.md`. Quais BLOCOS a tela tem continua sendo
// `docs/referencias/tela-1-gestao-de-contas.jpg`; o que mudou foi só como eles são desenhados.
//
// A ORDEM DA PÁGINA É A DO "F" da skill, de cima para baixo e da esquerda para a direita:
//   1. título e a frase de 5 segundos;  2. o recorte (os filtros);  3. a fila de números do topo;
//   4. o gráfico principal, maior e à esquerda;  5. os gráficos de apoio;  6. a tabela de detalhe.
//
// NENHUM NÚMERO, INDICADOR, FILTRO OU REGRA MUDOU nesta reforma: os 11 indicadores continuam vindo inteiros de
// `lib/indicadores/tela-1.mjs`, e `npm run conferir-telas` e `npm run conferir-filtros` continuam conferindo os
// mesmos 36 e 19.
//
// COMPONENTE DE SERVIDOR: o cálculo roda aqui, no Node, e para o navegador vai só o número já pronto. Nenhuma chave,
// nenhum caminho de pasta e nenhum arquivo cruzam essa linha. Os gráficos são o único pedaço de navegador da tela
// (`app/graficos.js`), e o que atravessa é só rótulo, valor e código de cliente.
//
// OS FILTROS DESTA TELA. Os de `docs/fontes.md` — ano · mês · CENTRO DE CUSTO (seleção múltipla) — mais a EMPRESA e os
// quatro que o dono aprovou em 27/09/2026. Todos moram na URL, como o ano e o mês sempre moraram, e é por isso que um
// link colado no chat e a captura da tela mostram exatamente a mesma coisa:
//
//   ?cc=TI,RH                        centro de custo, por nome de departamento (decisão do dono, 25/09/2026)
//   ?empresa=2                       empresa 1, empresa 2 ou as duas — `app/empresa.js`, as três telas
//   ?conta=Caixinha,Stone            conta bancária — `app/conta.js`, as três telas
//   ?situacao=pago,recebido          situação: os três rótulos da coluna `PAGAMENTO` do DFC
//   ?classe=RECEITA DE CLIENTE       categoria, a ponta do DFC: a `CLASS. CONTABIL` que os cartões já usam
//   ?categoria=1.01.01               categoria, a ponta do Omie: o `cCodCateg` do lançamento
//   ?fornecedor=2-1234567            cliente/fornecedor: empresa + `nCodCliente`, como o cliente da Tela 3
//
// O DESENHO DELES É O DE 28/09/2026, pedido do dono ao rever esta tela: as etiquetas saíram e cada filtro de escolha
// virou uma LISTA SUSPENSA COM CAIXAS DE MARCAR (`app/suspensa.js`). Os sete estão num formulário `GET` só, e apertar
// "aplicar" escreve todas as escolhas na URL de uma vez. Nenhum estado mora no navegador. Onde um filtro não alcança o
// número, o próprio cartão ou bloco diz isso — ver `app/filtrado.js` e `docs/filtros.md`.

import { dadosDaTela1, mesCorrente } from '../lib/dados.mjs';
import { NOMES_DOS_MESES } from '../lib/regras/periodo.mjs';
import { comoLista, comoTexto } from '../lib/regras/filtros.mjs';
import Atualizar from './atualizar.js';
import ChaveDoOmie, { AvisoSemOmie } from './chave-omie.js';
import FiltroDeConta, { ExplicaConta } from './conta.js';
import { emReais } from './dinheiro.js';
import FiltroDeEmpresa, { ExplicaEmpresa } from './empresa.js';
import Filtrado from './filtrado.js';
import { AnoInteiro, DeQuemVeioAReceita, DiaADia, ParaOndeFoiADespesa } from './graficos.js';
import { Kpi, Quadro } from './quadro.js';
import CartaoExplodivel from './cartao-explodivel.js';
import Suspensa from './suspensa.js';
import UltimaLeitura, { AvisoDoOmie } from './ultima-leitura.js';
import Sessao, { exigirLogin } from './sessao.js';

// Sem cache do Next: quem decide quando reler é `lib/dados.mjs`, de hora em hora.
export const dynamic = 'force-dynamic';

const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default async function Pagina({ searchParams }) {
  await exigirLogin();
  const q = await searchParams;
  const corrente = mesCorrente();
  const ano = Number(q?.ano ?? corrente.ano);
  const mes = Number(q?.mes ?? corrente.mes);
  // O FILTRO DE CENTRO DE CUSTO vem da URL como lista de nomes; quem o resolve em código de departamento de cada
  // empresa é `lib/regras/filtros.mjs`, dentro do cálculo, contra o cadastro que o cache tem.
  const cc = comoLista(q?.cc);
  // OS OUTROS FILTROS VÃO CRUS DO MESMO JEITO: `lib/regras/filtros.mjs` normaliza cada um dentro do cálculo, e é lá
  // que mora a única definição de cada um.
  const empresa = comoLista(q?.empresa);
  const conta = comoLista(q?.conta);
  const situacao = comoLista(q?.situacao);
  const classe = comoLista(q?.classe);
  const categoria = comoLista(q?.categoria);
  const fornecedor = comoTexto(q?.fornecedor);
  // A CHAVE "INCLUIR DADOS DO OMIE" (decisão do dono, 28/09/2026). Vai crua, como os filtros: quem a lê é
  // `lib/regras/filtros.mjs`, e sem nada na URL ela está LIGADA — a tela é a de sempre.
  const omie = comoLista(q?.omie);
  const d = await dadosDaTela1({ ano, mes, filtro: { cc, empresa, conta, situacao, classe, categoria, fornecedor, omie } });
  const fcc = d.filtros.cc;
  const femp = d.filtros.empresa;
  const fconta = d.filtros.conta;
  const fsit = d.filtros.situacao;
  const fclasse = d.filtros.classe;
  const fcat = d.filtros.categoria;
  const ffor = d.filtros.fornecedor;
  const comOmie = d.filtros.omie.ligado;

  const cartao = (id) => d.cartoes.find((c) => c.id === id);
  const bloco = (id) => d.blocos.find((b) => b.id === id);
  const dias = bloco('receita-despesa-por-dia').dados;
  const meses = bloco('receita-despesa-por-mes').dados;
  const anos = [2026];

  // A FRASE DE 5 SEGUNDOS. Ela não traz número novo nenhum: é o cartão "Saldo", logo ali embaixo, dito em português.
  //
  // O DONO TIROU A MAIOR SAÍDA DELA em 28/09/2026, revendo esta tela: a frase era "o caixa fechou em X e a maior saída
  // foi Y". Ficou só o caixa do mês, que é a decisão que ele toma aqui; a maior saída continua na tela, na primeira
  // barra de "Para onde foi a despesa".
  const saldo = cartao('saldo');

  // O ÚNICO LINK DE FILTRO QUE SOBROU. Todo o resto é o formulário: as caixas de marcar escrevem a escolha na URL
  // quando o "aplicar" é apertado. "limpar" volta a tela ao sem-filtro, guardando o mês que está sendo lido.
  // A CHAVE ATRAVESSA O "limpar", como as duas leituras da tabela da Tela 2 atravessam o dela: ela não é filtro, é
  // uma forma de ver, e quem limpou o recorte não pediu para o Omie voltar.
  const semFiltro = `/?ano=${ano}&mes=${mes}${comOmie ? '' : '&omie=0'}`;
  // A EMPRESA E A CONTA ESCOLHIDAS ATRAVESSAM AS ABAS: são os dois filtros das três telas, e trocar de tela não pode
  // desfazê-los.
  // E A CHAVE DO OMIE TAMBÉM ATRAVESSA AS ABAS: ela vale nas três telas, e trocar de tela não pode religá-la.
  const paraOutraTela = `${femp.ativo ? `&empresa=${femp.escolhidas.join(',')}` : ''}`
    + `${fconta.ativo ? `&conta=${encodeURIComponent(fconta.escolhidas.join(','))}` : ''}`
    + `${comOmie ? '' : '&omie=0'}`;

  return (
    <div className="tela">
      <header className="topo">
        <img className="logo" src="/marca/logo-meubess.png" alt="MeuBESS" />
        <span className="titulo">Gestão de Contas</span>
        <nav className="abas">
          <span className="ativa">Dashboard</span>
          <a href={`/dre?ano=${ano}&mes=${mes}${paraOutraTela}`}>DRE</a>
          <a href={`/fluxo-de-caixa?ano=${ano}&mes=${mes}${paraOutraTela}`}>Fluxo de Caixa</a>
          <span>Centro de Custo</span>
        </nav>
      </header>

      {/* 1. O TÍTULO E A FRASE DE 5 SEGUNDOS — o que o dono tem de levar daqui se olhar a tela e sair. */}
      <section className="chamada">
        <h1>{NOMES_DOS_MESES[mes]} de {ano}, empresas 1 e 2 somadas</h1>
        <p className="frase">
          O caixa do mês fechou em <b>{emReais(saldo.valor)}</b>.
        </p>
        <p className="para-que">
          Para decidir o que pagar, o que segurar e onde cortar neste mês. Cada número diz, embaixo, quantos
          lançamentos entraram nele; onde um filtro não alcança a fonte, o número diz isso ali mesmo.
        </p>
      </section>

      {/* O aviso da releitura do Omie só faz sentido com o Omie na conta: com a chave desligada, de que hora foi a
          última leitura dele não muda número nenhum desta tela. */}
      {comOmie && <AvisoDoOmie leituras={d.leituras} />}

      <AvisoSemOmie ligado={comOmie}>
        <strong>O que sobra desta tela:</strong> 9 dos 11 indicadores, que são do DFC — os cartões
        &quot;Saldo&quot;, &quot;Receitas&quot;, &quot;Despesas&quot;, &quot;Desp. Pagas&quot;,
        &quot;Desp. Funcionários&quot; e &quot;% D. Func. / Rec. Líquida&quot;, o &quot;Para onde foi a despesa&quot; e
        os dois gráficos de receita × despesa. A frase de 5 segundos lá em cima é o cartão &quot;Saldo&quot;, e por
        isso continua inteira. <strong>O que sai:</strong> o cartão &quot;Desp. Pendentes&quot; e o bloco
        &quot;De quem veio a receita&quot; (o Top 10 receitas), que são do Omie, e a contagem
        &quot;do Omie&quot; embaixo de cada número e na tabela do fim. <strong>E os filtros</strong> de centro de
        custo, de categoria do Omie e de cliente/fornecedor continuam na tela, mas só recortam o lado do Omie:
        enquanto a chave está desligada, eles não alcançam número nenhum.
      </AvisoSemOmie>

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

      {fsit.desconhecidos.length > 0 && (
        <p className="aviso leve">
          <strong>Situação que não existe:</strong> {fsit.desconhecidos.join(', ')}. Foi ignorada — as três são as da
          coluna <code>PAGAMENTO</code> do <code>FLUXO DE CAIXA</code>: pago, recebido e a pagar.
        </p>
      )}

      {(fclasse.desconhecidos.length > 0 || fcat.desconhecidos.length > 0) && (
        <p className="aviso leve">
          <strong>Categoria que não tem lançamento neste mês:</strong>{' '}
          {[...fclasse.desconhecidos, ...fcat.desconhecidos].join(', ')}. Foi ignorada — as opções saem do próprio mês,
          e não do cadastro inteiro: escolher uma categoria sem lançamento aqui só daria tela vazia.
        </p>
      )}

      {/* 2. O RECORTE. Os mesmos sete filtros de sempre, com as mesmas opções e na mesma URL de sempre; o que mudou em
          28/09/2026, a pedido do dono, é que as ETIQUETAS SAÍRAM e cada filtro de escolha virou uma lista suspensa com
          caixas de marcar (`app/suspensa.js`). Onde eram quatro faixas de etiquetas antes do primeiro número, é uma
          linha de caixas fechadas. Os sete vão num formulário `GET` só: o "aplicar" escreve todas as escolhas na URL de
          uma vez. O que cada um alcança continua escrito inteiro — dentro do "o que cada filtro alcança", logo abaixo. */}
      <section className="recorte">
        <form className="barra-filtros filtros-form" method="get" action="/">
          <Suspensa nome="ano" campo="ano" unica
            opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), marcada: a === ano }))} />

          <Suspensa nome="mês" campo="mes" unica
            opcoes={MESES_CURTOS.slice(1).map((m, i) => ({ valor: String(i + 1), rotulo: m, marcada: i + 1 === mes }))} />

          <Suspensa nome="centro de custo" campo="cc"
            opcoes={fcc.opcoes.map((nome) => ({ valor: nome, rotulo: nome, marcada: fcc.escolhidos.includes(nome) }))} />

          <FiltroDeEmpresa f={femp} />

          <FiltroDeConta f={fconta} />

          <ChaveDoOmie ligado={comOmie} />

          <Suspensa nome="situação" campo="situacao" vazio="todas"
            opcoes={fsit.opcoes.map((o) => ({
              valor: o.chave, rotulo: o.nome, marcada: fsit.escolhidos.includes(o.chave),
              dica: `${o.nome}: coluna PAGAMENTO = ${o.dfc.join(', ')}`,
            }))} />

          <label className="campo-filtro">
            <span>categoria — classificação do DFC ({fclasse.opcoes.length} no mês)</span>
            <select name="classe" defaultValue={fclasse.escolhidos[0] ?? ''}>
              <option value="">todas</option>
              {fclasse.opcoes.map((o) => <option value={o} key={o}>{o}</option>)}
            </select>
          </label>
          <label className="campo-filtro">
            <span>categoria — a do Omie ({fcat.opcoes.length} no mês)</span>
            <select name="categoria" defaultValue={fcat.escolhidos[0] ?? ''}>
              <option value="">todas</option>
              {fcat.opcoes.map((o) => <option value={o.codigo} key={o.codigo}>{o.codigo} — {o.descricao}</option>)}
            </select>
          </label>
          <label className="campo-filtro">
            <span>
              cliente/fornecedor ({ffor.opcoes.length} no mês{comOmie ? `, ${ffor.semCliente} sem código` : ''})
            </span>
            <select name="fornecedor" defaultValue={ffor.escolhido ?? ''}>
              <option value="">todos</option>
              {ffor.opcoes.map((o) => (
                <option value={o.chave} key={o.chave} data-codigo={o.codigo}>
                  {o.nome ?? `cliente ${o.codigo}`}
                </option>
              ))}
            </select>
          </label>
          <button className="botao filtro" type="submit">aplicar</button>
          <a className="limpar-tudo" href={semFiltro}>limpar</a>
        </form>

        {/* O QUE CADA FILTRO ALCANÇA. Tudo o que estava escrito continua escrito, palavra por palavra — só deixou de
            empurrar os números para baixo da dobra. Nada aqui é a frase de "o filtro não vale": aquela é parte do
            número e continua dentro do cartão, do gráfico e da linha da tabela. */}
        <details className="explica">
          <summary>o que cada filtro alcança, e o que ele não alcança</summary>

          {/* A CHAVE DO OMIE NÃO É FILTRO, mas é aqui que o dono vem perguntar o que ela faz — e, desligada, ela muda
              a resposta de três dos sete filtros desta tela. */}
          <p>
            <strong>A chave &quot;incluir dados do Omie&quot;</strong>{' '}
            {comOmie
              ? <>está ligada, que é o padrão: os 11 indicadores são os de sempre, com o lado do DFC e o lado do Omie
                lado a lado. Desligá-la tira da conta todo número cuja fonte é o Omie — o cartão
                {' '}&quot;Desp. Pendentes&quot;, o bloco &quot;De quem veio a receita&quot; e a contagem
                {' '}&quot;do Omie&quot; de cada indicador —, e deixa os 9 que são do DFC intactos. Ela não é filtro:
                não recorta lançamento nenhum, tira uma FONTE inteira.</>
              : <>está desligada. Os filtros de <strong>centro de custo</strong>, de <strong>categoria do Omie</strong>{' '}
                e de <strong>cliente/fornecedor</strong> só recortam o lado do Omie, e por isso não alcançam número
                nenhum enquanto ela estiver assim — eles continuam na tela, com as mesmas opções, para a escolha não se
                perder quando a chave voltar. Os de <strong>situação</strong> e de{' '}
                <strong>categoria pela classificação do DFC</strong> continuam valendo inteiros, porque alcançam o
                valor da planilha; os de <strong>empresa</strong> e de <strong>conta bancária</strong>, que só
                alcançavam o lado do Omie desta tela, também ficam sem número para recortar.</>}
          </p>

          <ExplicaEmpresa f={femp}>
            {comOmie
              ? <>Ele vale em toda contagem do Omie desta tela, no &quot;Top 10 receitas&quot; inteiro — que é do Omie —
                e no cartão &quot;Desp. Pendentes&quot; inteiro, que sai dos títulos a pagar por vencimento. O que vem
                do DFC não: cada cartão e cada bloco de fonte DFC diz, ali mesmo, que o número é das duas empresas
                somadas.</>
              : <>Com a chave &quot;incluir dados do Omie&quot; desligada ele não alcança número nenhum desta tela: o
                que ele alcançava era o lado do Omie, e o lado do DFC nunca se recortou por empresa.</>}
          </ExplicaEmpresa>

          <ExplicaConta f={fconta}>
            {comOmie
              ? <>Ele vale em toda contagem do Omie desta tela, no &quot;Top 10 receitas&quot; inteiro e no cartão
                &quot;Desp. Pendentes&quot; inteiro. O que vem do DFC não: a planilha tem uma coluna <code>BANCO</code>,
                mas os rótulos dela não são as contas do Omie — o cruzamento de 27/09/2026
                (<code>scripts/de-para-conta-dfc.mjs</code>) casou o rótulo <code>ITAU</code>, que é 95% das linhas
                cruzáveis do ano, com quatro contas diferentes. Cada cartão e cada bloco de fonte DFC diz isso ali
                mesmo, e as contagens inteiras do cruzamento estão em <code>docs/filtros.md</code>.</>
              : <>Com a chave &quot;incluir dados do Omie&quot; desligada ele não alcança número nenhum desta tela,
                pelo mesmo motivo do de empresa: o que ele alcançava era o lado do Omie.</>}
          </ExplicaConta>

          <p>
            {fsit.ativo
              ? <>
                <strong>Filtrado por situação:</strong> {fsit.escolhidos.join(', ')}. Este é o único dos filtros novos que
                alcança o VALOR do DFC: os três rótulos são, letra por letra, os da coluna <code>PAGAMENTO</code> (N) do
                {' '}<code>FLUXO DE CAIXA</code>. Do lado do Omie o de-para é a natureza do lançamento — a leitura das
                Telas 1 e 2 é de caixa e tudo nela já está baixado —, e &quot;a pagar&quot; é o cartão
                {' '}&quot;Desp. Pendentes&quot;, que sai dos títulos a pagar por vencimento sem baixa.
              </>
              : <>
                <strong>Sem filtro de situação:</strong> a tela mostra as três. No DFC do mês há
                {' '}{fsit.noDfc.pago} linhas <code>PAGO</code>, {fsit.noDfc.recebido} <code>RECEBIDO</code> e
                {' '}{fsit.noDfc['a-pagar']} <code>A PAGAR</code> — a linha <code>A PAGAR</code> nunca entra nesta tela,
                que é de caixa, e por isso &quot;a pagar&quot; aqui é só o cartão &quot;Desp. Pendentes&quot;.
                {fsit.foraDosTres > 0 && <> Outras {fsit.foraDosTres} linhas do mês têm um rótulo de
                  {' '}<code>PAGAMENTO</code> que não é nenhum dos três, e ficam fora de qualquer escolha.</>}
              </>}
          </p>

          <p>
            <strong>A categoria tem duas pontas, e não é descuido:</strong> a classificação do DFC
            (<code>CLASS. CONTABIL</code>, a mesma que o &quot;Para onde foi a despesa&quot; agrupa) recorta o lado do
            DFC, e a categoria do Omie (<code>cCodCateg</code>) recorta o lado do Omie. As duas fontes não escrevem o
            de-para entre os dois vocabulários, então escolher uma ponta só não recorta a outra — e cada número diz
            isso ali mesmo. O cliente/fornecedor é só do lado do Omie: no DFC ele é um nome digitado à mão, sem
            código, e 76% das linhas cruzáveis de 2026 não acham nome nenhum no cadastro.
          </p>

          <p>
            {!comOmie
              ? <>
                <strong>O centro de custo sai da conta com o Omie:</strong> o rateio por departamento
                (<code>departamentos[].nDistrValor</code>) é do Omie, e o DFC não tem coluna de centro de custo
                nenhuma — a aba <code>FLUXO DE CAIXA</code> classifica cada linha por <code>CLASS. CONTABIL</code> e
                {' '}<code>SUB 2</code>. Por isso os números que este filtro mostrava ao lado — quantos lançamentos do
                mês não têm rateio nenhum — também saem: eles são contagem do Omie.
              </>
              : fcc.aplicado
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
        </details>
      </section>

      {/* 3. A FILA DE NÚMEROS DO TOPO. Os 7 cartões de sempre, na ordem de sempre; o "Saldo" é o primeiro e o maior
          porque é dele que a frase de 5 segundos fala. Cada um abre, no clique, o que soma (01/10/2026). */}
      <section className="kpis">
        {['saldo', 'receitas', 'despesas', 'despesas-pagas', 'despesas-pendentes', 'despesas-funcionarios', 'percentual-funcionarios']
          .map((id, n) => (
            <CartaoExplodivel nome={cartao(id).nome} composicao={cartao(id).composicao} key={id}>
              <Kpi c={cartao(id)} destaque={n === 0} />
            </CartaoExplodivel>
          ))}
      </section>

      {/* 4 e 5. O GRÁFICO PRINCIPAL E OS DE APOIO. */}
      <div className="grade-g">
        <Quadro className="principal" titulo={`O ano inteiro, e onde ${NOMES_DOS_MESES[mes].toLowerCase()} cai nele`}
          fonte={`receita e despesa de cada mês de ${ano}, do bloco pronto de cada arquivo do DFC`}>
          <AnoInteiro meses={meses} mesEmFoco={mes} />
          {meses.length === 0 && <p className="legenda">a série do ano não foi lida.</p>}
          <Filtrado i={bloco('receita-despesa-por-mes')} />
        </Quadro>

        <Quadro titulo="Para onde foi a despesa"
          fonte="as dez maiores classificações de saída do mês, do DFC">
          <ParaOndeFoiADespesa itens={bloco('top-10-despesas').dados} />
          {bloco('top-10-despesas').dados.length === 0 && <p className="legenda">nenhum lançamento entrou neste mês.</p>}
          <Filtrado i={bloco('top-10-despesas')} />
        </Quadro>

        <Quadro className="principal" titulo="O mês, dia a dia"
          fonte={`entradas e gastos de cada dia de ${NOMES_DOS_MESES[mes].toLowerCase()}, do bloco pronto da aba do mês`}>
          <DiaADia dias={dias} mes={mes} ano={ano} />
          {dias.length === 0 && <p className="legenda">o bloco por dia do arquivo do mês não foi lido.</p>}
          <Filtrado i={bloco('receita-despesa-por-dia')} />
        </Quadro>

        <Quadro titulo="De quem veio a receita"
          fonte="os dez maiores recebimentos do mês, do Omie recortado da MeuBESS">
          <DeQuemVeioAReceita itens={bloco('top-10-receitas').dados} />
          {bloco('top-10-receitas').dados.length === 0 && <p className="legenda">nenhum lançamento entrou neste mês.</p>}
          <Filtrado i={bloco('top-10-receitas')} />
        </Quadro>
      </div>

      {/* 6. A TABELA DE DETALHE. Nenhum número novo: é a MESMA contagem que cada cartão e cada gráfico já mostra no
          pé, reunida numa lista só — a que `docs/conferencia.md` publica e `npm run conferir-telas` compara. Serve
          para o dono conferir, indicador por indicador, de onde o desenho saiu. */}
      <section className="quadro detalhe">
        <h2>Os números exatos, indicador por indicador</h2>
        <p className="fonte-do-quadro">
          quantos lançamentos entraram em cada um dos 11 indicadores desta tela — o mesmo que
          <code> npm run conferir-telas </code> compara com <code>docs/conferencia.md</code>
        </p>
        <table className="tabela-detalhe">
          <thead>
            <tr><th>indicador</th><th>fonte</th><th className="num">do DFC</th><th className="num">do Omie</th></tr>
          </thead>
          <tbody>
            {[...d.cartoes, ...d.blocos].map((i) => (
              <tr key={i.id}>
                <th>{i.nome}</th>
                <td className="fonte">{i.fonte}</td>
                <td className="num">{i.contagem.dfc === null ? '—' : i.contagem.dfc}</td>
                <td className="num">{i.contagem.omie === null ? 'sem o Omie' : i.contagem.omie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="rodape">
        <Atualizar ano={ano} />
        <span>
          {NOMES_DOS_MESES[mes]} de {ano} · empresas 1 e 2 somadas, recorte da MeuBESS. Fontes relidas de hora em hora
          — o Omie pela API, só consulta.
          {d.dfc.ok ? ` DFC: ${d.dfc.fonte}, ${d.dfc.arquivo}.` : ''}
        </span>
        <UltimaLeitura leituras={d.leituras} dfc={d.dfc} />
        <Sessao />
        <span>{d.doCache ? 'números do guardado desta hora' : 'números lidos agora das fontes'}</span>
      </footer>
    </div>
  );
}
