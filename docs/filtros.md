# Os filtros das 3 telas

**DFC por unidade desde 06/10/2026.** O consolidado de janeiro a julho de 2026 usa `3N`, `B3N` e `B3W`: a `N3` só passou a existir em agosto e sua falta anterior não gera aviso. Em agosto as quatro unidades entram. De setembro em diante, se a planilha de uma unidade esperada faltar, os cartões e o cabeçalho avisam qual falta e o consolidado soma apenas as unidades com planilha, sem inventar a parte ausente. `?unidade=N3`, `3N`, `B3N` ou `B3W` continua a escolher a planilha física daquela unidade; se ela não existe no mês, não mostra o consolidado parcial das outras como se fosse dela.

Este documento diz, **tela por tela e filtro por filtro**, em que cartões e blocos o filtro vale, em quais **não** vale
e por quê, e traz **um caso real filtrado conferido contra a fonte** para cada um.

Quais filtros cada tela tem não é escolha deste documento: está em [`docs/fontes.md`](fontes.md), tirado das
referências que o dono mandou, e nas decisões dele — a Tela 1 na linha 771, a Tela 2 na 845, a Tela 3 na 911. Aqui eles
são construídos, e nada além deles.

**Os quatro filtros de 27/09/2026.** Nessa data o dono aprovou mais quatro, e eles estão construídos: **categoria**,
**cliente/fornecedor** e **situação** na Tela 1, e **conta bancária** nas três telas. Nenhum dos quatro fica em aberto
e nenhum espera decisão — o que cada um alcança e o que não alcança está medido abaixo, filtro por filtro.

**Dois filtros atravessam as três telas**, e cada um tem seção própria no fim, porque o que alcançam e o que não
alcançam é a mesma coisa nas três, e porque o "não alcança" dos dois tem uma prova medida atrás:

- **empresa** (decisão do dono, 27/09/2026) — empresa 1, empresa 2 ou as duas. O de-para da coluna `EMP.` do DFC com as
  filiais do Omie **não fecha**.
- **conta bancária** (decisão do dono, 27/09/2026) — as contas da MeuBESS. O de-para da coluna `BANCO` do DFC com as
  contas correntes do Omie **também não fecha**: o rótulo `ITAU`, que é 4.449 das 4.670 linhas cruzáveis do ano, casa
  com **quatro** contas diferentes.

**O DFC diz o banco, mas não diz QUAL conta do Omie.** O dono sabia que isso podia acontecer e pediu o filtro assim
mesmo; foi medido, não deu, e por isso todo número de fonte DFC mostra **todas as contas somadas** e escreve isso ao
lado do valor. A medida inteira está em "O filtro de conta bancária", no fim.

**E uma coisa que NÃO é filtro, mas mora ao lado deles:** a **chave "incluir dados do Omie"** (decisão do dono,
28/09/2026), ligada por padrão nas três telas. Um filtro recorta os lançamentos que entram num número; a chave tira uma
**fonte inteira** da conta. Ela tem seção própria no fim, [logo antes dos casos conferidos](#a-chave-incluir-dados-do-omie--as-três-telas),
com o que cada bloco de cada tela mostra **sem o Omie**.

**Onde o filtro mora: na URL.** É o mesmo lugar em que o ano e o mês sempre moraram. A tela é componente de
servidor, então o estado do filtro chega pela query — e assim um link colado no chat, a página que o navegador mostra e
a captura versionada mostram exatamente a mesma coisa.

**A regra que atravessa as três telas.** Número que vem de uma fonte que **não aceita** o filtro escolhido nunca é
mostrado como se estivesse filtrado: o cartão, o bloco ou a linha escreve, ali mesmo, junto do número, qual filtro não
o alcança e por quê. Quem desenha essa frase é [`app/filtrado.js`](../app/filtrado.js); quem a escreve é o próprio
cálculo, em `naoVale[]` (ver [`lib/indicadores/`](../lib/indicadores/)). Cada uma delas está listada abaixo.

**Onde cada filtro é lido e normalizado:** [`lib/regras/filtros.mjs`](../lib/regras/filtros.mjs), num lugar só, como as
outras regras do projeto. A aplicação fica em `lib/indicadores/tela-1.mjs`, `tela-2.mjs` e `tela-3.mjs`.

**Com os filtros vazios, nada muda.** Cada filtro é transparente quando não há escolha, e é por isso que
`npm run conferencia` e `npm run conferir-telas` continuam dando os mesmos **36 conferidos** de antes — a conferência
roda sempre com filtro vazio, contra [`docs/conferencia.md`](conferencia.md).

---

## Tela 1 — Gestão de Contas

**Filtros:** ano · mês · **centro de custo** · **categoria (as duas pontas)** · **cliente/fornecedor** ·
**situação** — e mais os dois das três telas, empresa e conta bancária. Ano, mês e centro de custo já existiam; os três
do meio são os que o dono aprovou em 27/09/2026.

Os de escolha curta são **listas suspensas com caixas de marcar** (ano, mês, centro de custo, situação, empresa, conta
bancária — decisão do dono de 28/09/2026, que tirou as etiquetas das três telas); as três listas longas —
classificação do DFC, categoria do Omie e cliente/fornecedor — continuam campos de lista. Os sete vão juntos num
formulário `GET`: apertar "aplicar" escreve todas as escolhas na URL de uma vez. Onde o filtro aceita vários valores a
caixa é de marcar; no ano e no mês, que são um valor só na URL, ela é bolinha.

### centro de custo

Na URL: `?ano=2026&mes=8&cc=FISCAL,TI` — uma caixa de marcar por nome, na lista suspensa "centro de custo"; nenhuma
marcada são todos.

**As opções são os 16 NOMES de departamento**, juntando as empresas 1 e 2 pelo nome (decisão do dono, 25/09/2026): o
`cCodDepartamento` é próprio de cada empresa e **nenhum** código coincide entre as duas, então o nome é a única chave
que casa os dois cadastros. Por trás de cada nome ficam os códigos de cada empresa, e é por eles que o filtro escolhe.
Os nomes saem de `geral/departamentos` → `ListarDepartamentos`.

**Como ele é aplicado**, das duas pontas:

- na **contagem** — entra o lançamento que tem alguma linha de rateio num dos centros escolhidos;
- no **valor** — vale o `departamentos[].nDistrValor` daquelas linhas, e não o valor inteiro do lançamento. Um título
  repartido 50/50 entre dois centros entra com metade em cada. É o que `docs/fontes.md` manda somar, e é por isso que
  somar os 16 centros não dá a mesma coisa que a tela sem filtro: o rateio reparte, não duplica.

**De onde vem o rateio.** A API do Omie **não filtra por departamento** — o rateio só vem no retorno, e só quando a
consulta pede `cExibirDepartamentos: "S"`. A leitura das Telas 1 e 2 não pede; quem pede é a leitura de confronto do
"Top 10 despesas" (`MF_DEP` no cache), que é a **mesma** consulta, na mesma janela. As duas devolvem os mesmos
lançamentos, um a um, então o rateio é casado pela identidade do lançamento (`nCodMovCC` + `nCodTitulo` + `cGrupo`). Se
essa leitura faltar no cache, o filtro **se declara indisponível** e a tela avisa, em vez de mostrar tela vazia.

#### Em que cartões e blocos vale

| cartão / bloco | fonte principal | o filtro de centro de custo |
|---|---|---|
| Saldo | DFC | **só na contagem do Omie.** O valor e a contagem do DFC são do mês inteiro |
| Receitas | DFC | **só na contagem do Omie.** O valor e a contagem do DFC são do mês inteiro |
| Despesas | DFC | **só na contagem do Omie.** O valor e a contagem do DFC são do mês inteiro |
| Desp. Pagas | DFC | **só na contagem do Omie.** O valor e a contagem do DFC são do mês inteiro |
| Desp. Pendentes | Omie, títulos a pagar por vencimento | **não vale, nem no valor nem na contagem** |
| Desp. Funcionários | DFC | **só na contagem do Omie** (categorias de pessoal, no centro escolhido) |
| % D. Func. / Rec. Líquida | DFC nas duas pontas | **só na contagem do Omie.** As duas pontas da razão são do DFC |
| Top 10 despesas | DFC, por `CLASS. CONTABIL` | **só na contagem do Omie.** As barras são do DFC |
| Top 10 receitas | **Omie** | **vale inteiro** — valor (pelo `nDistrValor` escolhido) e contagem |
| Receita × despesa por dia | DFC, bloco pronto da aba do mês | **só na contagem do Omie.** As barras são do DFC |
| Receita × despesa por mês | DFC, bloco pronto de cada mês | **só na contagem do Omie.** As barras são do DFC |

#### Onde não vale, e por quê

- **Todo número que vem do DFC.** A aba `FLUXO DE CAIXA` classifica cada linha por `CLASS. CONTABIL` e `SUB 2`, e **não
  por departamento**: não existe coluna de centro de custo para filtrar. Isso alcança o valor dos seis cartões de fonte
  DFC, as barras do "Top 10 despesas" e as barras dos dois gráficos de receita × despesa. Nesses lugares a tela mostra o
  número do mês inteiro **e diz, ao lado dele, que o DFC não tem centro de custo** — a contagem do Omie, no mesmo
  cartão, está filtrada.
- **O cartão "Desp. Pendentes", inteiro.** Ele é a exceção ao regime de caixa (`docs/fontes.md`): sai de
  `cTpLancamento: "CP"` por **vencimento**, uma consulta que não pede `cExibirDepartamentos` e não traz
  `departamentos[]`. E um título ainda não pago nem está na leitura de caixa de onde o rateio vem. Este cartão não
  aceita o filtro em nada, e o cartão diz isso.
- **O lançamento sem rateio de departamento.** Em agosto de 2026 são 265 dos 419 lançamentos do mês (121 na empresa 1 e
  144 na 2). Eles **não têm nome para juntar** (`docs/fontes.md`, "3. Departamentos") e por isso ficam fora de qualquer
  escolha de centro de custo — inclusive da escolha dos 16 nomes ao mesmo tempo. A tela mostra esse número junto do
  filtro, para o dono saber de quanto a escolha nunca vai dar conta.
- **O nome que não está no cadastro.** Um `?cc=` escrito errado é ignorado, com aviso na tela: filtro errado não pode
  virar filtro vazio que esconde a tela inteira.

Um filtro que não está construído e continua esperando: o seletor **"ver por centro de custo (Omie)"** que
`docs/fontes.md` descreve na linha do "Top 10 despesas" — ele trocaria as barras do DFC por barras do Omie agrupadas por
departamento. É uma forma de ver, não um filtro, e fica para outra tarefa.

### categoria — e por que ela tem DUAS pontas

Na URL, duas: `?classe=RECEITA DE CLIENTE` e `?categoria=1.01.01`. A primeira é a **classificação do DFC**
(`CLASS. CONTABIL`, coluna I do `FLUXO DE CAIXA` — **a mesma que os cartões já usam**, e a mesma pela qual o
"Top 10 despesas" agrupa as barras); a segunda é a **categoria do Omie** (`cCodCateg` do lançamento).

**Por que não é um filtro só.** As duas fontes classificam com vocabulários diferentes e **nenhuma delas escreve o
de-para entre eles**: o `SUB 2` e a `CLASS. CONTABIL` do DFC saem do cadastro da aba `BASE` da própria planilha (em
setembro, 69 contas de `SUB 2` e 24 de `CLASS. CONTABIL`, `docs/fontes.md`), e o `cCodCateg` sai do plano de contas do
Omie. Um filtro só, com um vocabulário só, teria de adivinhar a tradução — e este projeto não adivinha. Então são duas
pontas, lado a lado, e **cada uma diz, ao lado do número da outra, que não a alcança**.

**As opções saem do próprio mês**, e não do cadastro inteiro: em agosto de 2026 são 22 classificações no DFC e 56
categorias no Omie. Categoria sem lançamento no mês não vira opção, porque escolhê-la só daria tela vazia — e um
`?classe=` ou `?categoria=` que não esteja no mês é ignorado, com aviso na tela.

#### Em que cartões e blocos vale

| cartão / bloco | fonte principal | `?classe=` (DFC) | `?categoria=` (Omie) |
|---|---|---|---|
| Saldo · Receitas · Despesas · Desp. Pagas · Desp. Funcionários · % D. Func. / Rec. Líquida | DFC | **vale no valor e na contagem do DFC** | **só na contagem do Omie** |
| Desp. Pendentes | Omie, títulos a pagar por vencimento | **não vale** | **vale inteiro** — valor e contagem |
| Top 10 despesas | DFC, por `CLASS. CONTABIL` | **vale nas barras e na contagem do DFC** | **só na contagem do Omie** |
| Top 10 receitas | Omie | **não vale** | **vale inteiro** |
| Receita × despesa por dia · por mês | DFC, bloco pronto | **não vale** | **só na contagem do Omie** |

#### Onde não vale, e por quê

- **A classificação do DFC não alcança nenhum número do Omie.** O lançamento do Omie não tem `CLASS. CONTABIL` — essa
  coluna é da planilha. Isso alcança a contagem do Omie dos sete cartões e dos quatro blocos, o "Top 10 receitas"
  inteiro e o cartão "Desp. Pendentes" inteiro, e cada um diz isso ali mesmo, convidando a escolher também uma
  categoria do Omie.
- **A categoria do Omie não alcança nenhum valor do DFC**, pelo mesmo motivo do outro lado: a planilha não tem
  `cCodCateg`. O valor dos seis cartões de fonte DFC e as barras do "Top 10 despesas" saem do mês inteiro, e dizem isso.
- **Os dois gráficos de receita × despesa não aceitam nem uma ponta nem a outra nas barras.** Elas não são linha de
  lançamento nenhuma: são o bloco `Entradas`/`Gastos` já somado da aba do mês, que não tem coluna de classificação para
  filtrar. É a mesma razão pela qual o centro de custo não as alcança.

### cliente/fornecedor

Na URL: `?fornecedor=2-5199865257` — **empresa + `nCodCliente`**, como o cliente da Tela 3, porque o código é próprio de
cada empresa. A lista mostra o nome, sempre com o código ao lado em `data-codigo`: é por ele que
`scripts/capturar-tela.mjs` troca o nome antes de a captura entrar no repositório. As opções saem do próprio mês (176
pares em agosto de 2026).

#### Em que cartões e blocos vale

| cartão / bloco | o filtro de cliente/fornecedor |
|---|---|
| Saldo · Receitas · Despesas · Desp. Pagas · Desp. Funcionários · % D. Func. / Rec. Líquida | **só na contagem do Omie** |
| Desp. Pendentes | **vale inteiro** — valor e contagem. É o cartão do Omie |
| Top 10 receitas | **vale inteiro** |
| Top 10 despesas · Receita × despesa por dia · por mês | **só na contagem do Omie.** As barras são do DFC |

#### Onde não vale, e por quê

- **Todo valor que vem do DFC, e a medida disso.** A planilha TEM a coluna `FORNECEDOR / CLIENTE` (G), mas ela é um
  **nome digitado à mão, sem código nenhum**, e o filtro escolhe pelo `nCodCliente` do cadastro do Omie. O de-para foi
  procurado no dado em 27/09/2026 por [`scripts/de-para-conta-dfc.mjs`](../scripts/de-para-conta-dfc.mjs), que cruza
  cada linha do `FLUXO DE CAIXA` com os lançamentos do Omie por data, valor e nome (a mesma comparação estrita do
  cruzamento de `EMP.`): das **4.670 linhas cruzáveis do ano, 3.550 — 76% — não acharam nome nenhum** no cadastro
  `geral/clientes`. Sem de-para, o número do DFC é de todos os clientes e fornecedores, e a tela diz isso ao lado dele.
- **O lançamento sem `nCodCliente`.** Em 2026 são 97 dos 3.569 lançamentos do recorte da MeuBESS. Eles não têm código
  para casar e ficam fora de qualquer escolha; a contagem do mês aparece no caso real, no fim deste documento.

### situação — pago · recebido · a pagar

Na URL: `?situacao=pago,recebido` — caixas de marcar na lista suspensa "situação", seleção múltipla; nenhuma marcada
são todas.

**Os três rótulos não foram inventados:** eles são, letra por letra, os valores da coluna `PAGAMENTO` (N) do
`FLUXO DE CAIXA` que `docs/fontes.md` registra — `PAGO`, `RECEBIDO` e `A PAGAR`. Por isso **este é o único dos quatro
filtros novos que alcança o VALOR do DFC**, e não só a contagem do Omie.

**Do lado do Omie o de-para é a NATUREZA do lançamento**, e não um `cStatus` novo: a leitura das Telas 1 e 2 é de
**caixa** (`financas/mf` por data de pagamento), e nela todo lançamento já está baixado — os 3.569 lançamentos de 2026
no recorte da MeuBESS têm só dois `cStatus`, `PAGO` nos 2.217 de natureza `P` e `RECEBIDO` nos 1.352 de natureza `R`
(medido em 27/09/2026 por [`scripts/de-para-conta-dfc.mjs`](../scripts/de-para-conta-dfc.mjs)). Então **pago é a
natureza `P`, recebido é a `R`**, e **"a pagar" é o cartão "Desp. Pendentes"** — o único lugar da tela onde mora um
título ainda não pago.

#### Em que cartões e blocos vale

| cartão / bloco | o filtro de situação |
|---|---|
| Saldo · Receitas · Despesas · Desp. Pagas · Desp. Funcionários · % D. Func. / Rec. Líquida | **vale inteiro** — valor e contagem do DFC (pela coluna `PAGAMENTO`) e contagem do Omie (pela natureza) |
| Desp. Pendentes | **vale como cartão inteiro**: "a pagar" o deixa cheio, "pago" ou "recebido" o deixam vazio — e a tela escreve isso junto do zero |
| Top 10 despesas | **vale inteiro** — nas barras e nas duas contagens |
| Top 10 receitas | **vale** — escolher só "pago" o deixa vazio, e a tela diz isso |
| Receita × despesa por dia · por mês | **só na contagem do Omie.** As barras não aceitam |

#### Onde não vale, e por quê

- **As barras dos dois gráficos de receita × despesa.** Como no centro de custo e na categoria: elas são o bloco
  `Entradas`/`Gastos` já somado da aba do mês, que não tem a coluna `PAGAMENTO` para filtrar.
- **"A pagar" é sempre 0 do lado do DFC, e não é falha do filtro.** A linha `A PAGAR` da planilha **nunca entra nesta
  tela**: o regime de caixa (`docs/fontes.md`) só conta linha já baixada, e `BAIXADO()` a deixa de fora antes de
  qualquer filtro. Em agosto de 2026 o mês tem 285 linhas `PAGO` e 103 `RECEBIDO`, que somam as 388 do cartão "Saldo",
  e nenhuma `A PAGAR`. A tela mostra essas três contagens junto do filtro, para o zero não ficar sem explicação.
- **O rótulo de `PAGAMENTO` que não é nenhum dos três** fica fora de qualquer escolha. No ano de 2026 são 95 linhas
  (`CARTAO DE CREDITO` 66, `TRANSFERENCIA` 19, `C. CREDITO` 8, `RETIRADA SOCIO - PAGO` 2); em agosto, nenhuma. A tela
  mostra esse número junto do filtro quando ele existe.

---

## Tela 2 — DRE

**Filtros:** **mês, seleção múltipla** — vários meses de uma vez. Na URL: `?meses=7,8`, ao lado do `ah` e do `av` que já
moravam lá. Uma caixa de marcar por mês, na lista suspensa "meses"; nenhuma marcada são todos, e a tela volta ao de
sempre. E mais os dois filtros das três telas, **empresa** e **conta bancária**, cada um com a sua seção no fim deste
documento.

**Este filtro não muda regra nenhuma.** Os doze meses continuam sendo calculados pelas mesmas regras; o filtro escolhe
**quais** aparecem. O que ele muda, e a tela diz:

- as **colunas** da tabela passam a ser só os meses escolhidos;
- os **cartões do topo**, que mostravam um mês, passam a **somar** os meses escolhidos;
- a **margem de lucro** é refeita da soma (lucro líquido dos meses sobre a receita bruta dos meses), e **nunca** a média
  das margens de cada mês;
- a coluna **"Total"** passa a ser o total dos meses escolhidos, e o cabeçalho dela diz isso ("Total dos N meses");
- a **AH** da primeira coluna escolhida não tem mês anterior dentro da escolha, e sai "—".

#### Em que cartões e blocos vale

| cartão / linha | o filtro de meses |
|---|---|
| Receita total · Custos e despesas · EBITDA · Lucro líquido · Margem de lucro | **vale inteiro** — valor somado, contagem somada, e a fita ao lado do número passa a ter só os meses escolhidos |
| as 12 linhas da tabela, as 2 de detalhe de "(+) Receitas", a AH e a AV de cada coluna | **vale inteiro** |
| a coluna "Total" | **vale inteiro** — passa a ser o total dos meses escolhidos |
| a última linha, "De quanta leitura a coluna saiu" | **vale inteiro** |
| as 2 contagens de cadastro ao lado de "(=) Receita bruta" | **não vale** |

#### Onde não vale, e por quê

- **As duas contagens de cadastro do DRE** que a linha "(=) Receita bruta" leva ao lado — quantas contas o DRE tem e
  quantas delas totalizam. Elas saem de `geral/dre` → `ListarCadastroDRE`, que é **cadastro e não tem mês**: somá-las em
  dois meses daria o dobro do cadastro. Ficam como estão, valendo para o ano inteiro, e a linha diz isso na tela.
- **Mês escolhido que não tem coluna aqui.** Três motivos, nenhum novo: **janeiro a março** ficam fora desta tela
  (decisão do dono, 27/09/2026, porque o Omie quase não tem lançamento da MeuBESS nesses meses); um mês **sem a planilha
  do DFC** lida nesta rodada; e um mês **sem lançamento nenhum** dos dois lados (outubro a dezembro de 2026, que ainda
  não aconteceram). A tela lista o mês pedido e o motivo, e o deixa fora da conta dos cartões e do Total — em vez de
  somar um mês vazio como se fosse mês cheio.

---

## Tela 3 — Contas a Receber

**Filtros:** **data de vencimento (de–até) · status · cliente · categoria**. Os quatro são campos da própria consulta
que a tela faz (`financas/pesquisartitulos` → `PesquisarLancamentos`), e os quatro moram na URL. E mais os dois das três
telas, **empresa** e **conta bancária** — este último vale INTEIRO aqui, porque a conta é o `cabecTitulo.nCodCC`, o
mesmo campo pelo qual a tela já faz o recorte da MeuBESS:

| filtro | na URL | o que é |
|---|---|---|
| vencimento de–até | `?de=2026-07-01&ate=2026-08-31` | a janela da consulta, `dDtVencDe` / `dDtVencAte`. Sem ela, é o mês escolhido |
| status | `?status=pago,atrasado` | as três faixas do de-para do dono (25/09/2026). `CANCELADO` nunca é opção |
| cliente | `?cliente=2-5199865257` | empresa + `nCodCliente`, porque o código é próprio de cada empresa |
| categoria | `?categoria=1.01.03` | o `cCodCateg` do título |

**O status fala a língua da tela.** As opções são **pago**, **atrasado** e **em aberto**, e cada uma é o conjunto de
`cStatus` que o de-para do dono lhe dá: pago = `RECEBIDO` e `LIQUIDADO`; atrasado = `ATRASADO`; em aberto = `EMABERTO`,
`AVENCER`, `VENCEHOJE` e `PAGTO_PARCIAL`. `CANCELADO` fica **fora da tela inteira** e por isso não é opção de filtro.

**As opções de cliente e de categoria saem da própria janela**, e não do cadastro inteiro: cliente ou categoria sem
título vencendo ali não vira opção, porque escolhê-lo só daria tela vazia. E elas são montadas **antes** de o próprio
cliente e a própria categoria serem aplicados — senão escolher um cliente apagaria os outros da lista e não haveria como
trocar. **O nome do cliente aparece na lista do filtro**, como aparece no gráfico e na lista de títulos, sempre com o
código ao lado em `data-codigo`: é por ele que `scripts/capturar-tela.mjs` troca o nome pelo código antes de a captura
entrar no repositório.

#### Em que cartões e blocos vale

| cartão / bloco | vencimento | status | cliente | categoria |
|---|---|---|---|---|
| Valor Previsto | vale | vale | vale | vale |
| Valor Recebido (faixa pago) | vale | vale | vale | vale |
| Valor Pendente (faixa em aberto) | vale | vale | vale | vale |
| Valor Vencido (faixa atrasado) | vale | vale | vale | vale |
| Lançamentos por mês e status | **não vale** | vale | vale | vale |
| Valor previsto por cliente e status | vale | vale | vale | vale |
| Lista de títulos | vale | vale | vale | vale |
| Lançamentos por status (rosca) | vale | vale | vale | vale |
| a contagem de `CANCELADO` ao lado do "Valor Previsto" | vale | **não vale** | vale | vale |
| as 2 contagens do cadastro de clientes ao lado do gráfico por cliente | **não vale** | **não vale** | **não vale** | **não vale** |

#### Onde não vale, e por quê

- **O gráfico "Lançamentos por mês e status" não aceita a janela de vencimento**, de propósito: ele tem **uma coluna por
  mês do ano**, como a tela de referência, e recortá-lo pela janela deixaria uma coluna só. Ele lê o ano inteiro, e a
  coluna em destaque é a do mês em que a janela começa. Os outros três filtros — status, cliente e categoria — valem
  nele como no resto da tela, e o bloco diz na tela qual dos quatro não o alcança.
- **A contagem de `CANCELADO` que ficaram fora não aceita o filtro de status**, porque `CANCELADO` fica fora da tela
  inteira (decisão do dono, 25/09/2026) e nunca é opção do filtro. Essa contagem é a da janela, recortada só por cliente
  e categoria. O cartão diz isso.
- **As duas contagens do cadastro de clientes** ao lado do gráfico por cliente são o tamanho do cadastro
  `geral/clientes` de cada empresa — **não são títulos**, e nenhum dos quatro filtros as alcança. O bloco diz isso.
- **Um cartão de faixa fica vazio quando o filtro de status não escolheu a faixa dele.** Aí o filtro **vale** — o cartão
  é que não tem mais nada para mostrar —, e a tela escreve isso junto do zero, em vez de deixar um zero sem explicação.
- **Janela fora do ano lido.** O cache local guarda a leitura de títulos a receber de 2026; uma janela que saia do ano
  não tem título para mostrar, e a tela avisa. Quando a janela pedida não está inteira no cache, a tela recorta a
  leitura do ano — o rodapé diz qual das duas leituras foi usada.

---

## O filtro de empresa — nas três telas

**Filtro das três telas** (decisão do dono, 27/09/2026): **empresa 1, empresa 2 ou as duas**. Não é regra nova nenhuma —
as telas sempre somaram as filiais `/0001-42` (empresa 1, as rotinas administrativas) e `/0002-23` (empresa 2, compra,
venda e logística) do Omie, e a terceira (`/0003-04`) sempre ficou fora. O filtro escolhe **quais das duas entram na
soma**.

Na URL: `?empresa=1` ou `?empresa=2`. São **três escolhas exclusivas**, e não seleção múltipla: `?empresa=1,2` é o mesmo
que sem filtro. Na lista suspensa "empresa" são duas caixas de marcar: nenhuma, ou as duas, é a soma de sempre. Um `?empresa=` que não seja 1 nem 2 é ignorado, com aviso na tela.
A escolha **atravessa as abas**: os links do topo levam a empresa escolhida para a outra tela. O desenho da lista está
em [`app/empresa.js`](../app/empresa.js), um lugar só para as três telas; a leitura e a normalização, em
[`lib/regras/filtros.mjs`](../lib/regras/filtros.mjs) (`filtroDeEmpresa`).

### Onde ele NÃO vale, e a prova disso: o DFC

**Todo número que vem do DFC.** A planilha tem uma coluna de empresa — `EMP.` (A), com `B3W` em todos os meses e `N3` a
partir de agosto —, mas **nenhum dos dois rótulos é filial do Omie**. Isso não é suposição: foi medido em 27/09/2026 por
[`scripts/de-para-empresa-dfc.mjs`](../scripts/de-para-empresa-dfc.mjs), que cruza cada linha do `FLUXO DE CAIXA` com os
lançamentos do Omie de cada empresa por **data, valor e nome do cliente/fornecedor**. Das 4.670 linhas cruzáveis:

| `EMP.` | casou só com a empresa 1 | casou só com a empresa 2 | casou com as duas | não casou |
|---|---|---|---|---|
| `B3W` | **565** | **481** | 66 | 3.539 |
| `N3` | **4** | **4** | 0 | 10 |

Duas linhas `B3W` do arquivo de agosto, as duas com `DIA PG` 03/08/2026, casam com empresas diferentes: a linha 4 com o
título `6026263192` da empresa 1 e a linha 9 com o título `5279147389` da empresa 2. O de-para **não fecha**, e por isso
o DFC é tratado como **não filtrável por empresa** — a prova inteira está em
[`docs/fontes.md`](fontes.md), em "A coluna `EMP.` não é a filial do Omie (cruzamento de 27/09/2026)".

Onde o DFC é a fonte, a tela mostra o número **das duas empresas somadas** e escreve isso ali mesmo, junto do valor. A
contagem do Omie, no mesmo cartão, está filtrada.

### Em que cartões, blocos e linhas ele vale

**Tela 1 — Gestão de Contas**

| cartão / bloco | o filtro de empresa |
|---|---|
| Saldo · Receitas · Despesas · Desp. Pagas · Desp. Funcionários · % D. Func. / Rec. Líquida | **só na contagem do Omie.** O valor e a contagem do DFC são das duas empresas |
| **Desp. Pendentes** | **vale inteiro** — valor e contagem. É o cartão do Omie (títulos a pagar por vencimento), e aqui ele aceita o filtro que o de centro de custo não aceita |
| Top 10 receitas | **vale inteiro** — é do Omie |
| Top 10 despesas · Receita × despesa por dia · Receita × despesa por mês | **só na contagem do Omie.** As barras são do DFC |

**Tela 2 — DRE**

| linha / cartão | fonte do valor | o filtro de empresa |
|---|---|---|
| (+) Receitas (e as 2 linhas de detalhe) · (=) Receita bruta · (−) Despesas gerais · (+/−) Resultado financeiro · (=) sem conta | Omie | **vale inteiro** |
| (−) Deduções · (−) Custos de vendas · (−) Impostos pagos (guias) | DFC | **não vale no valor**; a contagem do Omie ao lado, sim |
| Receita total · Custos e despesas (os 2 primeiros cartões do topo) | DFC | **não vale no valor**; a contagem do Omie ao lado, sim |
| (=) Receita líquida · (=) Lucro bruto · (=) EBITDA · (=) Lucro líquido · Margem de lucro | mistura as duas | **vale em parte** — a ponta do Omie é filtrada, a do DFC não, e a linha diz isso |
| as 2 contagens de cadastro ao lado de "(=) Receita bruta" | cadastro `geral/dre` | **não vale** |
| a última linha, "De quanta leitura a coluna saiu" | as duas | **vale no lado do Omie**; o lado do DFC é das duas empresas |

**Tela 3 — Contas a Receber**

| cartão / bloco | o filtro de empresa |
|---|---|
| Valor Previsto · Valor Recebido · Valor Pendente · Valor Vencido | **vale inteiro** — valor e contagem |
| Lançamentos por mês e status · Valor previsto por cliente e status · Lista de títulos · Lançamentos por status | **vale inteiro** |
| a contagem de `CANCELADO` ao lado do "Valor Previsto" | **vale** |
| as 2 contagens do cadastro de clientes ao lado do gráfico por cliente | **não vale** |

### As outras três ressalvas

- **As duas contagens de cadastro do DRE** ("quantas contas o DRE tem" e "quantas totalizam", ao lado de "(=) Receita
  bruta") são o cadastro `geral/dre` **da empresa 1**, e as duas empresas têm as mesmas 28 contas
  ([`docs/fontes.md`](fontes.md), "A soma das empresas 1 e 2"). A escolha de empresa não as muda, e a linha diz isso.
- **As duas contagens do cadastro de clientes** da Tela 3 são o tamanho do cadastro `geral/clientes` de **cada** empresa:
  elas já vêm quebradas por empresa, e continuam as duas ali, lado a lado, em qualquer escolha — apagar a da outra
  esconderia o tamanho do cadastro, que é o que elas servem para mostrar. O bloco diz isso.
- **A lista de clientes do filtro da Tela 3 passa a ser só a da empresa escolhida.** O `nCodCliente` é próprio de cada
  empresa (é por isso que o filtro de cliente é o par `empresa-código`), então oferecer cliente da outra empresa só daria
  tela vazia. Este é o único caso em que o filtro de empresa muda as **opções** de outro filtro.

### O que ele NÃO muda

Nem o recorte da MeuBESS (`dados/contas-correntes-por-negocio.json` continua valendo inteiro, e uma conta da empresa que
não é da MeuBESS continua fora), nem o regime de caixa, nem a trava de agosto, nem regra de indicador nenhuma. A empresa
3 (`/0003-04`) continua fora das três telas e não é opção do filtro.

---

## O filtro de conta bancária — nas três telas

**Filtro das três telas** (decisão do dono, 27/09/2026): as **contas bancárias da MeuBESS**, "onde a fonte disser o
banco". Na URL: `?conta=Caixinha,Stone` — seleção múltipla, como o centro de custo: uma caixa de marcar por conta,
nenhuma marcada são todas. A escolha **atravessa as abas**, como a de empresa. O desenho da lista está em
[`app/conta.js`](../app/conta.js), um lugar só para as três telas; a leitura e a normalização, em
[`lib/regras/filtros.mjs`](../lib/regras/filtros.mjs) (`contasBancarias` e `filtroDeConta`).

**As nove opções são as contas que o DONO disse serem da MeuBESS**, em
[`dados/contas-correntes-por-negocio.json`](../dados/contas-correntes-por-negocio.json) — as mesmas que já fazem o
recorte das três telas. O **nome** de cada opção é o `dito_como` daquele arquivo, o nome que o próprio dono deu à conta
quando respondeu de que negócio ela era (24 e 25/09/2026): Adiantamento ao Fornecedor · Adiantamento de Cliente · Banco
do Brasil (empresas 1 e 2) · Banco Implementação · Caixinha · cartão Itaú 1106 · Cora · Itaú (empresas 1 e 2) · Stone.

**É esse nome que junta as duas empresas**, como o nome do departamento junta os dois cadastros no centro de custo: a
mesma conta física está cadastrada nas duas com `nCodCC` diferente e, às vezes, com descrição diferente
(`CARTÃO B3W ITAU (1106)` na empresa 1 e `CARTÃO B3W ITAU (1106) - FILIAL` na 2). O de-para é a resposta do dono, e não
semelhança de texto adivinhada por código.

### Onde ele NÃO vale, e a prova disso: o DFC

**Todo número que vem do DFC.** A planilha **tem** uma coluna de banco — `BANCO` (C), com 17 rótulos diferentes em 2026
(`ITAU`, `BB`, `SICOOB`, `CORA`, `APP BB`, `BANCO DO BRASIL`, `STONE`, `CRED.REPASSE`, `INFINITYPAY`, `SANTANDER`,
`VEXPENSES`, `SALDO ANTERIOR`…) —, mas **nenhum deles é uma conta corrente do Omie**. Isso não é suposição: foi medido
em 27/09/2026 por [`scripts/de-para-conta-dfc.mjs`](../scripts/de-para-conta-dfc.mjs), que cruza cada linha do
`FLUXO DE CAIXA` com os lançamentos do Omie por **data, valor e nome do cliente/fornecedor** — a mesma comparação
estrita do cruzamento de `EMP.` — e olha em que conta do Omie cada rótulo cai. Das 4.670 linhas cruzáveis:

| `BANCO` | linhas cruzáveis | sem par no Omie | casou com mais de uma conta ao mesmo tempo | casou com uma conta só |
|---|---|---|---|---|
| `ITAU` | **4.449** | 3.347 | **113** | Itaú (empresas 1 e 2) **918** · cartão Itaú 1106 **50** · Adiantamento de Cliente **18** · Banco Implementação **3** |
| `(vazio)` | 63 | 58 | 0 | Banco do Brasil **4** · Stone **1** |
| `BANCO DO BRASIL` | 11 | 7 | 0 | Banco do Brasil 4 |
| `CORA` | 15 | 12 | 0 | Cora 3 |
| `BB` · `SICOOB` · `APP BB` · `STONE` · `CRED.REPASSE` · `INFINITYPAY` · `SANTANDER` · `APLIC.BB` · `APLIC.SANTANDER` · `BRADESCO` · `SICOOBI` · `VEXPENSES` · `SALDO ANTERIOR` | 132 | 132 | 0 | nenhuma — estes rótulos não dizem nada sobre conta |

**O rótulo `ITAU` é 95% das linhas do ano e casa com QUATRO contas diferentes do Omie**, e ainda deixa 113 linhas
casando com mais de uma ao mesmo tempo. O rótulo `(vazio)` casa com duas. E o `STONE` do DFC não casou com a conta
Stone do Omie nenhuma vez — as nove linhas dele não acharam par. **O de-para não fecha**, e por isso o DFC é tratado
como **não filtrável por conta**: onde ele é a fonte, a tela mostra o número de **todas as contas somadas** e escreve
isso ali mesmo, junto do valor. A contagem do Omie, no mesmo cartão, está filtrada.

O dono sabia que isso podia acontecer — ele pediu o filtro "onde a fonte disser o banco" — e foi assim que a resposta
saiu: a fonte diz um banco, mas não diz a conta.

### Em que cartões, blocos e linhas ele vale

**Tela 1 — Gestão de Contas**

| cartão / bloco | o filtro de conta bancária |
|---|---|
| Saldo · Receitas · Despesas · Desp. Pagas · Desp. Funcionários · % D. Func. / Rec. Líquida | **só na contagem do Omie.** O valor e a contagem do DFC são de todas as contas |
| **Desp. Pendentes** | **vale inteiro** — valor e contagem. É o cartão do Omie, e é nele que o caso real confere |
| Top 10 receitas | **vale inteiro** — é do Omie |
| Top 10 despesas · Receita × despesa por dia · Receita × despesa por mês | **só na contagem do Omie.** As barras são do DFC |

**Tela 2 — DRE**

| linha / cartão | fonte do valor | o filtro de conta bancária |
|---|---|---|
| (+) Receitas (e as 2 de detalhe) · (=) Receita bruta · (−) Despesas gerais · (+/−) Resultado financeiro · (=) sem conta | Omie | **vale inteiro** |
| (−) Deduções · (−) Custos de vendas · (−) Impostos pagos (guias) | DFC | **não vale no valor**; a contagem do Omie ao lado, sim |
| Receita total · Custos e despesas (os 2 primeiros cartões do topo) | DFC | **não vale no valor**; a contagem do Omie ao lado, sim |
| (=) Receita líquida · (=) Lucro bruto · (=) EBITDA · (=) Lucro líquido · Margem de lucro | mistura as duas | **vale em parte** — a ponta do Omie é filtrada, a do DFC não, e a linha diz isso |
| as 2 contagens de cadastro ao lado de "(=) Receita bruta" | cadastro `geral/dre` | **não vale** |

**Tela 3 — Contas a Receber**

| cartão / bloco | o filtro de conta bancária |
|---|---|
| Valor Previsto · Valor Recebido · Valor Pendente · Valor Vencido | **vale inteiro** — valor e contagem |
| Lançamentos por mês e status · Valor previsto por cliente e status · Lista de títulos · Lançamentos por status | **vale inteiro** |
| as 2 contagens do cadastro de clientes ao lado do gráfico por cliente | **não vale** |

### As duas outras ressalvas

- **As duas contagens de cadastro do DRE** ("quantas contas o DRE tem" e "quantas totalizam") saem de `geral/dre` →
  `ListarCadastroDRE`, que é o **plano de contas do DRE** e não tem conta corrente nenhuma para filtrar. A linha
  "(=) Receita bruta" diz isso na tela.
- **As duas contagens do cadastro de clientes** da Tela 3 são o tamanho do cadastro `geral/clientes` de cada empresa —
  não são títulos, e um cadastro de cliente não tem conta corrente. O bloco diz isso.

### Somar as contas uma a uma NÃO dá a tela sem filtro, e é de propósito

Nos **três baldes de caixa** das Telas 1 e 2, um título e a baixa dele podem estar em contas diferentes. Sem filtro, a
regra de `lib/regras/movimentos.mjs` conta o **título** e joga a baixa fora, para não contar duas vezes; com a conta da
baixa escolhida sozinha, o título não está mais no conjunto e **a baixa volta a contar por si**. Em agosto de 2026 isso
dá **425 lançamentos somando as nove contas uma a uma, contra 419 da tela sem filtro** — seis casos.

Isso não é erro do filtro: é o que escolher uma conta quer dizer. Escolher **as nove de uma vez** dá exatamente os 419,
e é essa a conferência do conjunto. Já o cartão **"Desp. Pendentes"** e a **Tela 3 inteira** são um **título por
linha**, sem essa junção — lá a conta reparte o conjunto exatamente, as contas uma a uma somam o total, e é por isso
que os casos reais da conta bancária conferem nesses dois lugares.

### O que ele NÃO muda

Nem o recorte da MeuBESS (as nove opções **são** esse recorte; conta de outro negócio continua fora e não é opção), nem
o regime de caixa, nem a trava de agosto, nem regra de indicador nenhuma.

---

## A chave "incluir dados do Omie" — as três telas

Na URL: `?omie=0` desliga e `?omie=1` liga; **sem `omie` nenhum na URL ela está ligada**, que é o padrão. Na tela ela é
uma lista suspensa com uma caixa de marcar — o mesmo formato dos outros filtros de escolha (`app/suspensa.js`) —, e o
formulário manda um `omie=0` escondido junto: uma caixa **desmarcada** não manda nada, e sem o `0` a chave voltaria a
ligar sozinha a cada "aplicar". É o mesmo desenho das duas leituras da tabela da Tela 2 (`?ah=`, `?av=`), pelo mesmo
motivo. Ela atravessa as três telas e o "limpar", como a empresa e a conta bancária: trocar de aba ou limpar o recorte
não a religa.

**Por que ela existe.** O dono suspeita de informação desatualizada ou imprecisa no Omie e quis ver como as três telas
ficam **sem ela** (28/09/2026). A chave é uma **forma de ver**, e não um julgamento sobre o dado: ela não corrige nada,
não apaga nada no Omie e não muda regra nenhuma.

**Ela não é filtro, e a diferença importa.** Um filtro escolhe QUAIS lançamentos entram num número e o número continua
existindo; a chave tira a FONTE, e o número que só vinha dali **deixa de existir**. Por isso, onde ela derruba um
número, a tela escreve um travessão e a frase de "sem o Omie" ali mesmo, junto do lugar onde o número estava — e nunca
um zero. Zero seria dado: diria "a despesa pendente do mês é zero", que é justamente a afirmação que esta tela não pode
fazer sem ter lido o Omie.

**O que ela NÃO faz.** Não mexe em número do DFC — **os números do DFC ficam exatamente como estão** —, não muda regra
nenhuma, não muda o recorte da MeuBESS, não muda o regime de caixa e **não mexe na trava de agosto**. Também não para
de ler o Omie: o cache continua sendo relido de hora em hora, porque a chave é uma forma de ver e não um jeito de
parar de ler. E não tira os filtros da tela: as listas de opções continuam saindo do cadastro, inclusive as que saem do
cadastro do Omie, porque **uma lista de opções não é número da tela** — é o que se pode escolher, e a escolha tem de
continuar ali para a chave poder ser religada sem o recorte se perder no caminho. O que cada tela diz, enquanto a chave
está desligada, é **quais filtros deixaram de alcançar número**.

**Com a chave ligada, nada muda.** É por isso que `npm run conferir-telas` continua dando **36 conferidos** e
`npm run conferir-filtros`, **19 conferidos**, com os mesmos números: os dois chamam o cálculo sem a chave, e a chave é
transparente. Quem prova isso, afirmação por afirmação, é
[`scripts/conferir-chave-omie.mjs`](../scripts/conferir-chave-omie.mjs) (`npm run conferir-chave-omie`).

### Tela 1 — o que cada bloco mostra sem o Omie

Esta é a tela que menos perde: **9 dos 11 indicadores são do DFC e ficam inteiros**, com o mesmo valor de sempre.

| cartão / bloco | fonte principal | **sem o Omie** |
|---|---|---|
| Saldo | DFC | **fica inteiro** — o valor e a contagem do DFC; a contagem "do Omie", embaixo, vira "sem o Omie" |
| Receitas | DFC | **fica inteiro**, do mesmo jeito |
| Despesas | DFC | **fica inteiro**, do mesmo jeito |
| Desp. Pagas | DFC | **fica inteiro**, do mesmo jeito |
| Desp. Pendentes | **Omie**, títulos a pagar por vencimento | **sai**: o cartão fica sem número e diz que ele sai de `cTpLancamento: "CP"` do Omie, e que o DFC não tem carteira a pagar para pôr no lugar — a aba `FLUXO DE CAIXA` é de caixa e a linha `A PAGAR` nunca entra nesta tela |
| Desp. Funcionários | DFC | **fica inteiro**, do mesmo jeito |
| % D. Func. / Rec. Líquida | DFC nas duas pontas | **fica inteiro** — as duas pontas da razão são do DFC |
| Top 10 despesas | DFC, por `CLASS. CONTABIL` | **fica inteiro** — as barras são do DFC |
| Top 10 receitas ("De quem veio a receita") | **Omie** | **sai**: o bloco fica sem barras e diz que os dez maiores recebimentos saem do Omie e que ele nunca teve lado do DFC — as SAÍDAS do mês continuam ali ao lado, no "Para onde foi a despesa" |
| Receita × despesa por dia | DFC, bloco pronto da aba do mês | **fica inteiro** |
| Receita × despesa por mês | DFC, bloco pronto de cada mês | **fica inteiro** |

**A frase de 5 segundos continua inteira** ("o caixa do mês fechou em X"): ela é o cartão "Saldo", que é do DFC. Na
tabela do fim, a coluna **do Omie** passa a dizer "sem o Omie" nas onze linhas.

**Os filtros que deixam de alcançar número:** centro de custo, categoria do Omie, cliente/fornecedor, empresa e conta
bancária — os cinco só recortavam o lado do Omie desta tela. **Continuam valendo:** situação e categoria pela
classificação do DFC, que alcançam o valor da planilha.

### Tela 2 — o que cada bloco mostra sem o Omie

| cartão / linha | fonte do valor | **sem o Omie** |
|---|---|---|
| Receita total | DFC | **fica inteiro** |
| Custos e despesas | DFC | **fica inteiro** |
| EBITDA · Lucro líquido · Margem de lucro | mistura as duas | **saem**, com a fita dos doze meses |
| (+) Receitas (e as duas linhas de detalhe) | Omie | **sai** |
| (=) Receita bruta | Omie | **sai** |
| (−) Deduções | DFC | **fica inteira**, com a AH |
| (=) Receita líquida | mistura | **sai** |
| (−) Custos de vendas | DFC | **fica inteira**, com a AH |
| (=) Lucro bruto | mistura | **sai** |
| (−) Despesas gerais | Omie | **sai** |
| (=) EBITDA | mistura | **sai** |
| (+/−) Resultado financeiro | Omie | **sai** |
| (−) Impostos pagos (guias) | DFC | **fica inteira**, com a AH |
| (=) Lucro líquido | mistura | **sai** |
| (=) sem conta | Omie | **sai** |

**As linhas "(=)" saem porque somam as DUAS fontes.** Escrever só a metade do DFC daria um EBITDA que não é o EBITDA —
e é por isso que a frase delas na tela é "sem o Omie, **esta conta não fecha**", e não "esta linha não tem número".

**A coluna AV sai de todas as linhas, inclusive das de fonte DFC**: ela é a linha sobre a **receita líquida** do mês, e
a receita líquida mistura as duas fontes — sem o Omie não há denominador. A **AH** de uma linha de fonte DFC continua,
porque compara o DFC com o DFC. **Os dois gráficos saem** (a margem no ano e o peso de cada linha sobre a receita): os
dois desenham números que precisam do Omie (o terceiro, o mapa da variação, saiu da tela em 29/09/2026, a pedido do
dono). E a **frase de 5 segundos sai**, porque o lucro
líquido e a margem do ano são mistura — no lugar dela a tela diz de onde as duas descem.

**Os filtros que deixam de alcançar número:** empresa e conta bancária. **Continua valendo:** o de meses, que escolhe
QUAIS colunas a tabela mostra — e as três linhas do DFC seguem essa escolha.

### Tela 3 — o que sobra dela sem o Omie

**Nada de número.** Esta tela é do Omie inteira: os **4 cartões** (Valor Previsto, Valor Recebido, Valor Pendente,
Valor Vencido) e os **4 blocos** (De quem é o vencido, a rosca por status, O que vence quando, e a lista de títulos)
saem todos de **uma consulta só** — `financas/pesquisartitulos` → `PesquisarLancamentos`, os títulos a receber por
vencimento. E não há lado do DFC para pôr no lugar: a planilha é de **caixa**, e não tem carteira a receber nem
cadastro de cliente (`docs/fontes.md`, "Esta tela fica no Omie, inteira").

**O que sobra dela:** o título com a janela de vencimento escolhida — que é a **pergunta**, e vem da URL, não do Omie
—, os sete filtros com as opções que já tinham, a própria chave, e a hora da última leitura no rodapé. Os oito
indicadores ficam com um travessão e a frase que diz que a tela inteira é do Omie; os três gráficos não são desenhados,
porque um eixo vazio ou uma rosca de raio zero seriam um desenho fingindo número. **Nenhum dos sete filtros alcança
número nenhum** enquanto ela estiver desligada.

### O caso real, conferido com a chave desligada

Escrito por [`scripts/conferir-chave-omie.mjs`](../scripts/conferir-chave-omie.mjs) (`npm run conferir-chave-omie`),
em **agosto de 2026**, e com a mesma regra dos outros: **só contagem**, nunca dinheiro e nunca nome.

**Dois cartões vizinhos da Tela 1, o mesmo mês, um de cada lado da chave:**

- **"Despesas" (fonte DFC).** Com a chave **ligada**: `281 do DFC · 299 do Omie`. Com a chave **desligada**:
  `281 do DFC · sem o Omie` — **as mesmas 281 linhas da planilha**, e o valor em reais do cartão **intacto**, byte por
  byte igual ao da chave ligada. É o que o pedido do dono manda: ver a tela sem o Omie, e não ver outra tela.
- **"Desp. Pendentes" (fonte Omie).** Com a chave **ligada**: `161 títulos a pagar do Omie`. Com a chave
  **desligada**: o cartão fica **sem valor** (`null`, e não zero) e com **uma frase** no lugar do número, dizendo que
  ele sai da leitura de títulos a pagar por vencimento do Omie e que o DFC não tem carteira a pagar.

**E as 18 afirmações que o script confere**, seis por tela — as três que a chave precisa provar:

1. **Ligada, ela não existe.** A tela com `?omie=1` e a tela sem `omie` na URL saem **idênticas**, indicador por
   indicador, no valor e nas duas contagens: 11 indicadores na Tela 1, 17 na Tela 2, 8 na Tela 3. É isso que mantém os
   **36** e os **19** dos outros dois conferidores.
2. **Desligada, o lado do DFC não se move.** A contagem do DFC dos 11 + 17 + 8 indicadores é a mesma de quando a chave
   está ligada, e o valor dos **6** indicadores de fonte DFC da Tela 1 e dos **5** da Tela 2 também.
3. **Desligada, o lado do Omie sai como ausência.** Toda contagem do Omie vira `null` — nunca zero — nos 36
   indicadores, e os **2** da Tela 1, **12** da Tela 2 e **8** da Tela 3 cuja fonte principal é o Omie ficam sem valor
   **e com a frase** que diz por quê.

Saída da rodada de 28/09/2026: **18 afirmações: 18 conferidas, 0 divergentes**.

### As três capturas, com a chave desligada

As três telas, servidas pelo app a partir do código novo, com todo valor em dinheiro trocado por "—" e todo nome de
cliente trocado pelo código:

- [`docs/tela-1-captura-sem-omie.html`](tela-1-captura-sem-omie.html)
- [`docs/tela-2-captura-sem-omie.html`](tela-2-captura-sem-omie.html)
- [`docs/tela-3-captura-sem-omie.html`](tela-3-captura-sem-omie.html)

---

## Os casos reais conferidos

Um caso real por filtro, aplicado pela **mesma camada de dados que o navegador recebe** e reencontrado na **fonte**.
Quem escreve este bloco é [`scripts/conferir-filtros.mjs`](../scripts/conferir-filtros.mjs) (`npm run conferir-filtros`),
na mesma rodada em que ele grava [`docs/filtros.html`](filtros.html): o texto daqui e o da página são sempre da mesma
leitura. **Só contagem e código** — nenhum valor em dinheiro e nenhum nome de cliente, como em
[`docs/conferencia.md`](conferencia.md).

O que é "a fonte" em cada tela:

- **Telas 1 e 3** — os **arquivos crus do cache do Omie**, abertos pelo script com `fs` e `JSON.parse`, sem passar pela
  montagem de `lib/regras/cache-omie.mjs`: o lado da fonte não sai da mesma função que o lado do cálculo. Na Tela 1 o
  recorte é refeito lançamento a lançamento pelo `departamentos[]` cru e pelo cadastro cru de departamentos; na Tela 3,
  título a título, pelo `cabecTitulo` cru.
- **Tela 2** — [`docs/conferencia.md`](conferencia.md), pelo caminho mais curto que prova o filtro: escolher **só** o mês
  conferido tem de dar, indicador por indicador, o mesmo que a tela sem filtro dá naquele mês — e esse número é o que
  `npm run conferir-telas` já compara com o arquivo. O segundo caso fecha a soma: dois meses escolhidos são a soma dos
  dois meses calculados sozinhos.

<!-- casos-conferidos:inicio -->
<!-- Escrito por scripts/conferir-filtros.mjs. Não edite à mão: rode `npm run conferir-filtros`. -->

**17 filtros conferidos**: 17 conferidos e 0 divergentes. Leitura do Omie:
`9c876008cad2` — 508 arquivos no cache local. Mês do caso: agosto de 2026.

Cada linha é um filtro real aplicado pela **mesma camada de dados que o navegador recebe**, e reencontrado na **fonte** —
os arquivos crus do cache do Omie, abertos aqui com `fs` e `JSON.parse`, sem passar pela montagem de
`lib/regras/cache-omie.mjs`. **Só contagem e código:** nenhum valor em dinheiro e nenhum nome de cliente, como em
[`docs/conferencia.md`](conferencia.md).

- **Tela 1 — centro de custo = FISCAL.** **Vale em:** os 7 cartões (a contagem do Omie de cada um), o "Top 10 despesas" e os dois gráficos de receita × despesa (a contagem do Omie) e o "Top 10 receitas" inteiro, que é do Omie. **Na tela:** 78. **Na fonte:** 78 — contados um a um na base do mês pelo `departamentos[]` que está nos arquivos crus de `financas/mf` com `cExibirDepartamentos: "S"`, casando o `cCodDepartamento` de cada empresa com o nome FISCAL pelo cadastro cru `geral/departamentos`. **Caso real:** o lançamento do grupo `CONTA_A_RECEBER` da empresa 2, título `5276599584`, categoria `1.01.01`: no arquivo cru do cache ele tem `cCodDepartamento` `5191334709`, que o cadastro `geral/departamentos` da empresa 2 chama de FISCAL, com `nDistrPercentual` 50 em 2 linhas de rateio.
- **Tela 1 — centro de custo = os 16 nomes de uma vez.** **Vale em:** os mesmos cartões e blocos; é a conferência do conjunto, e não de um nome. **Na tela:** 154. **Na fonte:** 154 — a base do mês menos os lançamentos cujo `departamentos[]` vem vazio no arquivo cru — contados aqui, um a um. **Caso real:** a base do mês tem 425 lançamentos e 271 deles não têm nenhuma linha de rateio nos arquivos crus: escolhendo os 16 nomes, sobram 154.
- **Tela 1 — empresa = 2.** **Vale em:** a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro (que é do Omie) e o cartão "Desp. Pendentes" inteiro, que sai dos títulos a pagar por vencimento. **Na tela:** 242. **Na fonte:** 242 — os lançamentos da base do mês que só aparecem em arquivo `2-financas-mf-ListarMovimentos…` do cache, contados aqui um a um pela identidade `nCodMovCC` + `nCodTitulo` + `cGrupo`. **Caso real:** a base do mês tem 425 lançamentos, e nos arquivos crus do cache 183 deles só aparecem em arquivo da empresa 1 e 242 só em arquivo da empresa 2 — 0 das 8.013 identidades lidas aparecem nos arquivos das duas, então o arquivo diz a empresa sem ambiguidade. Os números do DFC não são recortados por este filtro, e cada cartão de fonte DFC diz isso na tela: o de-para de `EMP.` não fecha.
- **Tela 2 — meses = só agosto.** **Vale em:** os 5 cartões do topo, as 13 linhas da tabela, o quadro "Fora do DRE" e a coluna Total — a tela inteira é por mês. **Na tela:** 19. **Na fonte:** 19 — a tela sem filtro em agosto, que é a que `docs/conferencia.md` confere indicador por indicador. **Caso real:** os 19 indicadores da tela com o filtro em agosto sozinho batem, um a um, com os mesmos 19 da tela sem filtro no mesmo mês — que são os que `docs/conferencia.md` publica e `scripts/conferir-telas.mjs` confere contra o arquivo.
- **Tela 2 — meses = julho e agosto.** **Vale em:** os mesmos cartões, linhas e a coluna Total, que passa a ser o total dos dois meses. **Na tela:** 19. **Na fonte:** 19 — cada mês calculado sozinho, sem filtro, e somado aqui — agosto é o mês que `docs/conferencia.md` publica. **Caso real:** a coluna de julho tem 636 lançamentos do Omie e a de agosto, 425; com os dois meses escolhidos a tela mostra 1.061, e os 19 indicadores somam os dois meses um a um. As duas contagens de cadastro do DRE não somam, de propósito, e a linha "(=) Receita bruta" diz isso na tela.
- **Tela 2 — empresa = 1 e empresa = 2, somadas.** **Vale em:** as linhas e os cartões de fonte Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "Retirada de sócio", "(=) sem conta", o quadro "Fora do DRE" — e toda contagem do Omie da tela. **Na tela:** 19. **Na fonte:** 19 — cada empresa calculada sozinha e somada aqui, indicador por indicador, contra a tela sem filtro — e a contagem do DFC conferida parada nas três. **Caso real:** a coluna de agosto tem 425 lançamentos do Omie sem filtro, 183 com a empresa 1 e 242 com a empresa 2; os 19 indicadores somam as duas empresas um a um, e a contagem do DFC de cada um fica igual nas três telas — é o filtro não alcançando o DFC, como `docs/filtros.md` diz.
- **Tela 3 — vencimento de 01/07/2026 a 31/08/2026.** **Vale em:** os 4 cartões, o gráfico por cliente e status, a lista de títulos e a rosca por status. **Na tela:** 262. **Na fonte:** 262 — os `titulosEncontrados` dos arquivos crus de `financas/pesquisartitulos`, recortados aqui pelo `nCodCC` da MeuBESS, pelo `dDtVenc` na janela e sem os `CANCELADO`. **Caso real:** a janela pega 262 títulos nos arquivos crus, e o mais antigo deles é o título `5252426426` da empresa 2, com vencimento 01/07/2026 e `cStatus` `ATRASADO`.
- **Tela 3 — status = pago.** **Vale em:** os 4 cartões, os 4 blocos — inclusive o gráfico por mês e status, que é o único que a janela de vencimento não alcança. **Na tela:** 91. **Na fonte:** 91 — o mesmo conjunto cru do caso acima, recortado aqui pela faixa do `cStatus` de cada título, pelo de-para de `lib/regras/listas.mjs`. **Caso real:** o título `5268010983` da empresa 2 tem `cStatus` `RECEBIDO` no arquivo cru, que o de-para do dono (25/09/2026) põe na faixa pago; as três faixas do mês são pago 91, atrasado 37, em aberto 0.
- **Tela 3 — cliente = `2-5199865257` (empresa + `nCodCliente`).** **Vale em:** os 4 cartões e os 4 blocos. **Na tela:** 4. **Na fonte:** 4 — o mesmo conjunto cru, recortado aqui pelo par empresa + `nCodCliente` do `cabecTitulo`. **Caso real:** nos arquivos crus, 4 dos 128 títulos da janela têm esse `nCodCliente` na empresa 2, em 87 códigos de cliente distintos na janela.
- **Tela 3 — categoria = `1.01.03`, na janela de 01/07/2026 a 31/08/2026.** **Vale em:** os 4 cartões e os 4 blocos. **Na tela:** 1. **Na fonte:** 1 — o mesmo conjunto cru da janela, recortado aqui pelo `cCodCateg` do `cabecTitulo`. **Caso real:** o título `5272798590` da empresa 2 tem `cCodCateg` `1.01.03` no arquivo cru; a janela tem 2 categorias distintas e 1 dos 262 títulos está nesta.
- **Tela 3 — empresa = 1, na janela de 01/01/2026 a 31/12/2026.** **Vale em:** os 4 cartões e os 4 blocos, no valor e na contagem — a tela é do Omie inteira. **Na tela:** 9. **Na fonte:** 9 — os `titulosEncontrados` lidos dos arquivos `1-financas-pesquisartitulos-…` do cache, recortados aqui pelo `nCodCC` da MeuBESS, pelo `dDtVenc` no ano e sem os `CANCELADO`. **Caso real:** dos 773 títulos do ano nos arquivos crus, 9 estão em arquivo da empresa 1 e 764 em arquivo da empresa 2; o título `5986750138` é um dos da empresa 1, com `cStatus` `RECEBIDO` e vencimento 03/03/2026. Em agosto sozinho a carteira é inteira da empresa 2 (128 de 128 títulos), e escolher a empresa 2 ali não tira nenhum — é por isso que o caso é o do ano. As duas contagens do cadastro de clientes continuam as duas, e o bloco delas diz isso.
- **Tela 1 — categoria pela categoria do Omie = `1.01.01`.** **Vale em:** a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro. **Na tela:** 111. **Na fonte:** 111 — os lançamentos da base do mês contados aqui, um a um, pelo `cCodCateg` de cada um. **Caso real:** a base do mês tem 425 lançamentos em 57 categorias distintas, e 111 deles estão nesta. O valor do DFC NÃO é recortado por este filtro, e cada cartão de fonte DFC diz isso na tela: a planilha classifica cada linha por `CLASS. CONTABIL` e `SUB 2`, que saem do cadastro da aba `BASE`, e nenhuma das duas fontes escreve o de-para entre os dois vocabulários.
- **Tela 1 — cliente/fornecedor = `2-5198391628` (empresa + `nCodCliente`).** **Vale em:** a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro. **Na tela:** 28. **Na fonte:** 28 — o `nCodCliente` de cada lançamento da base do mês, lido dos arquivos crus de `financas/mf` do cache — e não da montagem de `lib/regras/cache-omie.mjs`. **Caso real:** nos arquivos crus do cache, 28 dos 425 lançamentos da base do mês têm esse `nCodCliente` na empresa 2, em 178 pares empresa + código distintos — e 12 lançamentos do mês não têm `nCodCliente` nenhum e ficam fora de qualquer escolha. O lado do DFC não é recortado: lá o cliente/fornecedor é um NOME digitado à mão, e das 4.670 linhas cruzáveis do ano 3.550 não acham nome nenhum no cadastro (`scripts/de-para-conta-dfc.mjs`).
- **Tela 1 — conta bancária = Caixinha.** **Vale em:** a contagem do Omie dos 7 cartões e dos 4 blocos, o "Top 10 receitas" inteiro e o cartão "Desp. Pendentes" inteiro — é neste último que o caso confere, porque ele é um título por linha. **Na tela:** 3. **Na fonte:** 3 — os `movimentos` dos arquivos crus da leitura de títulos a pagar por vencimento do cache, achados aqui pela chave exata da consulta e recortados pelo `nCodCC` da MeuBESS, pelo `dDtVenc` no mês, por `cLiquidado = "N"` e sem os `CANCELADO`. **Caso real:** nos arquivos crus da leitura `cTpLancamento: "CP"` do cache, 3 dos 161 títulos a pagar vencendo no mês têm o `nCodCC` desta conta — o título `5269208232`, com `nCodCC` `5191219611` e vencimento 17/08/2026, é um deles. A carteira toda se reparte em cartão Itaú 1106 96, Itaú (empresas 1 e 2) 62, Caixinha 3, que somam os 161 do cartão. Os números do DFC não são recortados por este filtro, e cada cartão de fonte DFC diz isso na tela: o rótulo `ITAU` da coluna `BANCO` casa com quatro contas diferentes do Omie.
- **Tela 1 — conta bancária = as 9 contas de uma vez.** **Vale em:** os mesmos cartões e blocos; é a conferência do conjunto, e não de uma conta. **Na tela:** 425. **Na fonte:** 425 — a base do mês sem filtro — a mesma que `docs/conferencia.md` confere indicador por indicador. **Caso real:** a base do mês tem 425 lançamentos e 0 deles estão em conta que não é da MeuBESS nos arquivos crus: escolhendo as 9 contas, a tela mostra a base inteira. Nos arquivos crus ela se reparte em Itaú (empresas 1 e 2) 343, Adiantamento de Cliente 76, Stone 6 — que somam mais que 425, e é assim de propósito: um título pago de outra conta faz a baixa dele voltar a contar sozinha quando só a conta da baixa é escolhida.
- **Tela 2 — conta bancária = as 9 contas de uma vez, e depois só Caixinha.** **Vale em:** as linhas e os cartões de fonte Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "Retirada de sócio", "(=) sem conta", o quadro "Fora do DRE" — e toda contagem do Omie da tela. **Na tela:** 19. **Na fonte:** 19 — a tela sem filtro, a tela com todas as contas e a tela com uma só, comparadas aqui indicador por indicador — e a contagem do DFC conferida parada nas três. **Caso real:** a coluna de agosto tem 425 lançamentos do Omie sem filtro e os mesmos 425 com as 9 contas escolhidas; com só Caixinha ela cai para 3, e a contagem do DFC de cada um dos 19 indicadores fica igual nas três leituras — é o filtro não alcançando o DFC, como `docs/filtros.md` diz. As duas contagens de cadastro do DRE também não mudam, e a linha "(=) Receita bruta" diz isso na tela.
- **Tela 3 — conta bancária = Banco do Brasil (empresas 1 e 2).** **Vale em:** os 4 cartões e os 4 blocos, no valor e na contagem — a tela é do Omie inteira, e a conta é o mesmo `cabecTitulo.nCodCC` do recorte da MeuBESS. **Na tela:** 1. **Na fonte:** 1 — os `titulosEncontrados` dos arquivos crus de `financas/pesquisartitulos`, recortados aqui pelo `cabecTitulo.nCodCC` da conta escolhida, pelo `dDtVenc` no mês e sem os `CANCELADO`. **Caso real:** dos 128 títulos da janela nos arquivos crus, 1 têm o `nCodCC` desta conta; o título `5267029155` da empresa 2 é um deles, com `cStatus` `ATRASADO` e vencimento 01/08/2026. A janela toda se reparte em Itaú (empresas 1 e 2) 99, Adiantamento de Cliente 28, Banco do Brasil (empresas 1 e 2) 1, que somam os 128 títulos dela. As duas contagens do cadastro de clientes continuam as duas, e o bloco delas diz isso.
<!-- casos-conferidos:fim -->

---

## Como refazer tudo isto

```
npm run conferencia        # docs/conferencia.md e docs/fontes.md — 36 indicadores, filtro vazio
npm run conferir-telas     # docs/telas-conferidas.md — as telas contra a conferência, filtro vazio
npm run conferir-filtros   # este documento e docs/filtros.html — os filtros contra a fonte
npm run conferir-chave-omie  # a chave "incluir dados do Omie" — 18 afirmações, as três telas
```

E para ver uma tela com um filtro aplicado, sem dinheiro e sem nome de cliente, num arquivo que pode entrar no git:

```
npm run local                                                        # sobe em 127.0.0.1:4781
node scripts/capturar-tela.mjs --tela 1 --q "cc=FISCAL"  --nome filtro
node scripts/capturar-tela.mjs --tela 2 --q "meses=7,8"  --nome filtro
node scripts/capturar-tela.mjs --tela 3 --q "status=atrasado" --nome filtro
node scripts/capturar-tela.mjs --tela 1 --q "empresa=2" --nome empresa
node scripts/capturar-tela.mjs --tela 3 --q "empresa=1&de=2026-01-01&ate=2026-12-31" --nome empresa
node scripts/capturar-tela.mjs --tela 1 --q "situacao=recebido&conta=Caixinha" --nome situacao-conta
node scripts/capturar-tela.mjs --tela 1 --q "omie=0" --nome sem-omie
node scripts/capturar-tela.mjs --tela 2 --q "omie=0" --nome sem-omie
node scripts/capturar-tela.mjs --tela 3 --q "omie=0" --nome sem-omie
```

As duas últimas são as capturas do filtro de empresa que estão no repositório —
[`docs/tela-1-captura-empresa.html`](tela-1-captura-empresa.html) e
[`docs/tela-3-captura-empresa.html`](tela-3-captura-empresa.html). Na da Tela 1 dá para ver a regra inteira de uma vez:
as contagens do DFC ficam como na captura sem filtro (388, 101, 281, 281, 109, 109) e as do Omie caem (419 → 242, 120 → 110,
299 → 132, 92 → 53, e "Desp. Pendentes" 161 → 44), com as 9 frases de "o filtro de empresa não vale" ao lado dos números
que vêm do DFC.

E os dois cruzamentos que descobriram o que o DFC **não** deixa filtrar — por empresa, por conta bancária e por
cliente/fornecedor. Os dois são só leitura e imprimem contagem, código e data, nunca dinheiro; o nome sai mascarado:

```
node scripts/de-para-empresa-dfc.mjs   # a coluna EMP. contra as filiais do Omie
node scripts/de-para-conta-dfc.mjs     # a coluna BANCO contra as contas correntes do Omie,
                                       # a coluna FORNECEDOR / CLIENTE contra o cadastro geral/clientes,
                                       # e os cStatus da base do Omie, que são o de-para da situação
```

E a captura da Tela 1 com **dois filtros novos ao mesmo tempo** — situação "recebido" e conta "Caixinha" — está em
[`docs/tela-1-captura-situacao-conta.html`](tela-1-captura-situacao-conta.html). Nela dá para ver a regra inteira de
uma vez: a contagem do DFC do cartão "Saldo" cai de **388 para 103** (a situação alcança o DFC, pela coluna
`PAGAMENTO`), a do Omie cai de **419 para 3** (a conta só alcança o Omie), e as **9 frases de "o filtro de conta
bancária não vale"** estão ao lado de cada número que vem do DFC — nenhuma para a situação, porque ela alcança os
dois lados.
