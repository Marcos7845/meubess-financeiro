# Os filtros das 3 telas

Este documento diz, **tela por tela e filtro por filtro**, em que cartões e blocos o filtro vale, em quais **não** vale
e por quê, e traz **um caso real filtrado conferido contra a fonte** para cada um.

Quais filtros cada tela tem não é escolha deste documento: está em [`docs/fontes.md`](fontes.md), tirado das
referências que o dono mandou — a Tela 1 na linha 716, a Tela 2 na 788, a Tela 3 na 852. Aqui eles são construídos, e
nada além deles: **empresa, fornecedor, conta corrente e qualquer outro filtro esperam decisão do dono** e não existem
nas telas.

**Onde o filtro mora: na URL.** É o mesmo lugar em que as pílulas de ano e mês sempre moraram. A tela é componente de
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

**Filtros:** ano · mês · **centro de custo (seleção múltipla)**. Os dois primeiros já existiam, em pílulas; o terceiro é
o que esta tarefa construiu.

### centro de custo

Na URL: `?ano=2026&mes=8&cc=FISCAL,TI` — uma pílula por nome, clicar acende, clicar de novo apaga, "todos" limpa.

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

---

## Tela 2 — DRE

**Filtros:** **mês, seleção múltipla** — vários meses de uma vez. Na URL: `?meses=7,8`, ao lado do `ah` e do `av` que já
moravam lá. Cada pílula de mês acende e apaga; "todos" limpa e a tela volta ao de sempre.

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
que a tela faz (`financas/pesquisartitulos` → `PesquisarLancamentos`), e os quatro moram na URL:

| filtro | na URL | o que é |
|---|---|---|
| vencimento de–até | `?de=2026-07-01&ate=2026-08-31` | a janela da consulta, `dDtVencDe` / `dDtVencAte`. Sem ela, é o mês das pílulas |
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

**8 filtros conferidos**: 8 conferidos e 0 divergentes. Leitura do Omie:
`ece646d1a56e` — 357 arquivos no cache local. Mês do caso: agosto de 2026.

Cada linha é um filtro real aplicado pela **mesma camada de dados que o navegador recebe**, e reencontrado na **fonte** —
os arquivos crus do cache do Omie, abertos aqui com `fs` e `JSON.parse`, sem passar pela montagem de
`lib/regras/cache-omie.mjs`. **Só contagem e código:** nenhum valor em dinheiro e nenhum nome de cliente, como em
[`docs/conferencia.md`](conferencia.md).

- **Tela 1 — centro de custo = FISCAL.** **Vale em:** os 7 cartões (a contagem do Omie de cada um), o "Top 10 despesas" e os dois gráficos de receita × despesa (a contagem do Omie) e o "Top 10 receitas" inteiro, que é do Omie. **Na tela:** 78. **Na fonte:** 78 — contados um a um na base do mês pelo `departamentos[]` que está nos arquivos crus de `financas/mf` com `cExibirDepartamentos: "S"`, casando o `cCodDepartamento` de cada empresa com o nome FISCAL pelo cadastro cru `geral/departamentos`. **Caso real:** o lançamento do grupo `CONTA_A_RECEBER` da empresa 2, título `5276599584`, categoria `1.01.01`: no arquivo cru do cache ele tem `cCodDepartamento` `5191334709`, que o cadastro `geral/departamentos` da empresa 2 chama de FISCAL, com `nDistrPercentual` 50 em 2 linhas de rateio.
- **Tela 1 — centro de custo = os 16 nomes de uma vez.** **Vale em:** os mesmos cartões e blocos; é a conferência do conjunto, e não de um nome. **Na tela:** 154. **Na fonte:** 154 — a base do mês menos os lançamentos cujo `departamentos[]` vem vazio no arquivo cru — contados aqui, um a um. **Caso real:** a base do mês tem 419 lançamentos e 265 deles não têm nenhuma linha de rateio nos arquivos crus: escolhendo os 16 nomes, sobram 154.
- **Tela 2 — meses = só agosto.** **Vale em:** os 5 cartões do topo, as 12 linhas da tabela e a coluna Total — a tela inteira é por mês. **Na tela:** 17. **Na fonte:** 17 — a tela sem filtro em agosto, que é a que `docs/conferencia.md` confere indicador por indicador. **Caso real:** os 17 indicadores da tela com o filtro em agosto sozinho batem, um a um, com os mesmos 17 da tela sem filtro no mesmo mês — que são os que `docs/conferencia.md` publica e `scripts/conferir-telas.mjs` confere contra o arquivo.
- **Tela 2 — meses = julho e agosto.** **Vale em:** os mesmos cartões, linhas e a coluna Total, que passa a ser o total dos dois meses. **Na tela:** 17. **Na fonte:** 17 — cada mês calculado sozinho, sem filtro, e somado aqui — agosto é o mês que `docs/conferencia.md` publica. **Caso real:** a coluna de julho tem 636 lançamentos do Omie e a de agosto, 419; com os dois meses escolhidos a tela mostra 1.055, e os 17 indicadores somam os dois meses um a um. As duas contagens de cadastro do DRE não somam, de propósito, e a linha "(=) Receita bruta" diz isso na tela.
- **Tela 3 — vencimento de 01/07/2026 a 31/08/2026.** **Vale em:** os 4 cartões, o gráfico por cliente e status, a lista de títulos e a rosca por status. **Na tela:** 262. **Na fonte:** 262 — os `titulosEncontrados` dos arquivos crus de `financas/pesquisartitulos`, recortados aqui pelo `nCodCC` da MeuBESS, pelo `dDtVenc` na janela e sem os `CANCELADO`. **Caso real:** a janela pega 262 títulos nos arquivos crus, e o mais antigo deles é o título `5252426426` da empresa 2, com vencimento 01/07/2026 e `cStatus` `ATRASADO`.
- **Tela 3 — status = pago.** **Vale em:** os 4 cartões, os 4 blocos — inclusive o gráfico por mês e status, que é o único que a janela de vencimento não alcança. **Na tela:** 91. **Na fonte:** 91 — o mesmo conjunto cru do caso acima, recortado aqui pela faixa do `cStatus` de cada título, pelo de-para de `lib/regras/listas.mjs`. **Caso real:** o título `5293814087` da empresa 2 tem `cStatus` `RECEBIDO` no arquivo cru, que o de-para do dono (25/09/2026) põe na faixa pago; as três faixas do mês são pago 91, atrasado 37, em aberto 0.
- **Tela 3 — cliente = `2-5199865257` (empresa + `nCodCliente`).** **Vale em:** os 4 cartões e os 4 blocos. **Na tela:** 4. **Na fonte:** 4 — o mesmo conjunto cru, recortado aqui pelo par empresa + `nCodCliente` do `cabecTitulo`. **Caso real:** nos arquivos crus, 4 dos 128 títulos da janela têm esse `nCodCliente` na empresa 2, em 87 códigos de cliente distintos na janela.
- **Tela 3 — categoria = `1.01.03`, na janela de 01/07/2026 a 31/08/2026.** **Vale em:** os 4 cartões e os 4 blocos. **Na tela:** 1. **Na fonte:** 1 — o mesmo conjunto cru da janela, recortado aqui pelo `cCodCateg` do `cabecTitulo`. **Caso real:** o título `5272798590` da empresa 2 tem `cCodCateg` `1.01.03` no arquivo cru; a janela tem 2 categorias distintas e 1 dos 262 títulos está nesta.
<!-- casos-conferidos:fim -->

---

## Como refazer tudo isto

```
npm run conferencia        # docs/conferencia.md e docs/fontes.md — 36 indicadores, filtro vazio
npm run conferir-telas     # docs/telas-conferidas.md — as telas contra a conferência, filtro vazio
npm run conferir-filtros   # este documento e docs/filtros.html — os filtros contra a fonte
```

E para ver uma tela com um filtro aplicado, sem dinheiro e sem nome de cliente, num arquivo que pode entrar no git:

```
npm run local                                                        # sobe em 127.0.0.1:4781
node scripts/capturar-tela.mjs --tela 1 --q "cc=FISCAL"  --nome filtro
node scripts/capturar-tela.mjs --tela 2 --q "meses=7,8"  --nome filtro
node scripts/capturar-tela.mjs --tela 3 --q "status=atrasado" --nome filtro
```
