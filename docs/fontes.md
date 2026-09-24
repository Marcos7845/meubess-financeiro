# Fontes dos dashboards

O contrato do projeto: cada indicador das três telas, de onde vem e como é calculado. Indicador sem linha aqui não entra
na tela. "Conferido" é a data em que o número da tela bateu com a fonte num caso real.

As referências (`referencias/`) valem pelo **layout e pela disposição das informações**, não pelas cores. Os números que
aparecem nelas são de exemplo — nenhum é da MeuBESS.

## As fontes

| fonte | o que é | como lemos | quem libera o acesso |
|---|---|---|---|
| ERP | **Omie** — o ERP da MeuBESS (razão social NON IMPORTACAO E DISTRIBUICAO LTDA, em **três filiais**). A leitura é da **filial `/0002-23`** (CNPJ 32.589.565/0002-23), a única com os pedidos, clientes e produtos que a plataforma envia: na leitura de 24/09/2026, 783 pedidos de venda, 814 contas a receber e 1.085 contas a pagar. As filiais `/0001-42` (20 / 131 / 1.529) e `/0003-04` (0 / 0 / 17) não têm os pedidos da plataforma e ficam de fora — comparação em `docs/comparacao-chaves-omie.html`. Usamos os módulos Finanças (contas a pagar, contas a receber, movimentos financeiros), Geral (categorias, departamentos, clientes, contas do DRE) e Produtos (pedido de venda) | **API REST do Omie**: `POST https://app.omie.com.br/api/v1/<serviço>/`, corpo JSON com `call`, `app_key`, `app_secret` e `param`. A chave da filial `/0002-23` está no `.env` nas variáveis **`OMIE_MEUBESS_2_APP_KEY`** e **`OMIE_MEUBESS_2_APP_SECRET`**; as outras duas filiais são `OMIE_MEUBESS_1_…` e `OMIE_MEUBESS_3_…`, que a leitura das telas não usa. Só métodos de consulta (`Listar*`, `Consultar*`, `Pesquisar*`, `Obter*`) — nenhum que inclua, altere ou exclua. Documentação: https://developer.omie.com.br/service-list/ | A chave de API (app key e app secret) é gerada pelo dono (Vitor), uma por filial; já existe um aplicativo de integração cadastrado no Omie e as três chaves estão gravadas no `.env` local |
| Planilhas | _a definir_ | _onde moram (Google Sheets, Excel no OneDrive, arquivo local)_ | _a definir_ |

### Como lemos o Omie (vale para as três telas)

Quase todo número sai de **um** método: o `ListarMovimentos` do serviço **`financas/mf`** (Movimentos Financeiros), que
devolve contas a pagar, contas a receber e baixas na mesma consulta. O que usamos dele:

- **recorte pago × pendente** — no retorno, `movimentos[].resumo.cLiquidado` (`S` quitado, `N` em aberto),
  `resumo.nValPago` (quanto já entrou ou saiu) e `resumo.nValAberto` (quanto falta). No filtro e no retorno,
  `detalhes.cStatus`, que pode ser `CANCELADO`, `RECEBIDO`, `PAGO`, `VENCEHOJE`, `AVENCER`, `ATRASADO`, `EMABERTO` ou
  `PAGTOPARCIAL` (no serviço `financas/pesquisartitulos` a lista é `CANCELADO`, `RECEBIDO`, `LIQUIDADO`, `EMABERTO`,
  `PAGTO_PARCIAL`, `VENCEHOJE`, `AVENCER`, `ATRASADO`).
- **receita × despesa** — `cNatureza` (`R` a receber, `P` a pagar) ou `cTpLancamento` (`CR`, `CP`, `CPCR`, e `BXCR` /
  `BXCP` para as baixas).
- **datas** — o filtro aceita `dDtVencDe` / `dDtVencAte` (vencimento), `dDtPagtoDe` / `dDtPagtoAte` (pagamento ou
  recebimento), `dDtEmisDe` / `dDtEmisAte` (emissão), `dDtPrevDe` / `dDtPrevAte` (previsão) e `dDtRegDe` / `dDtRegAte`
  (registro).
- **centro de custo = departamento** no Omie (a própria documentação chama o campo de "Código do Departamento / Centro
  de Custo"). Vem rateado no retorno quando se pede `cExibirDepartamentos: "S"`: `movimentos[].departamentos[]` com
  `cCodDepartamento`, `nDistrPercentual` e `nDistrValor`. Os nomes saem de `geral/departamentos` →
  `ListarDepartamentos` (`codigo`, `descricao`).
- **categoria / plano de contas** — `cCodCateg` no filtro, e `movimentos[].categorias[]` (`cCodCateg`, `nDistrValor`) no
  retorno, para título rateado em mais de uma categoria. O cadastro sai de `geral/categorias` → `ListarCategorias`
  (`codigo`, `descricao`, `conta_receita`, `conta_despesa`, `totalizadora`, `tipo_categoria`, `codigo_dre`), e a árvore
  do DRE de `geral/dre` → `ListarCadastroDRE` (`codigoDRE`, `descricaoDRE`, `nivelDRE`, `sinalDRE`, `totalizaDRE`,
  `naoExibirDRE`).

Dois limites da API que valem para tudo abaixo:

- **Nenhum método de consulta filtra por departamento.** O rateio só vem no retorno; o filtro por centro de custo é
  feito no app, depois de ler o período inteiro.
- **Não existe método que devolva o DRE já calculado.** O `geral/dre` → `ListarCadastroDRE` devolve só o *cadastro* das
  contas do DRE. Os valores da Tela 2 são somados por nós, categoria a categoria.

Outros serviços de consulta usados: `financas/pesquisartitulos` → `PesquisarLancamentos` (pesquisa de títulos, com
filtro por vencimento, status, cliente e categoria de uma vez) e `geral/clientes` → `ListarClientesResumido` (nome do
cliente). O `financas/resumo` → `ObterResumoFinancas` não serve aqui: é um retrato de **um dia** (`dDia`), não de um
período.

**Pedido de venda — `produtos/pedido` → `ListarPedidos` (lista) e `ConsultarPedido` (um pedido, por `codigo_pedido`).**
É o elo anterior ao título financeiro: a plataforma MeuBESS cria o pedido de venda no Omie (no arquivo de integrações do
dono, 171 `Order` com código do Omie, de 17/04 a 23/09/2026) e o título a receber só aparece depois do faturamento. O
título não tem descrição nem produto; o pedido tem. O que ele traz, pelos nomes da documentação do Omie:

- `cabecalho` — `codigo_pedido`, `numero_pedido`, `codigo_cliente`, `data_previsao`, `etapa`;
- `det[]`, um item por linha — `produto.codigo_produto`, `produto.descricao`, `produto.quantidade`,
  `produto.valor_unitario`, `produto.valor_total`;
- `total_pedido.valor_total_pedido`;
- `informacoes_adicionais.codigo_categoria`.

O que o pedido **não** é: não traz data de pagamento nem quanto já foi recebido, então não substitui o
`ListarMovimentos` nos números (o regime de caixa continua no título). Ele entra só onde o título não responde —
descrição e produto — e essas linhas dizem "pedido de venda" na coluna de filtro. **Ainda não conferido contra o Omie:**
os nomes de campo acima (vêm da documentação, não de um pedido lido) e qual campo do título aponta para o pedido de
origem; sem esse elo não se liga o título ao pedido. Os dois se conferem numa leitura de um pedido real da filial
`/0002-23`, e a coluna "conferido" das linhas que usam o pedido fica vazia até lá.

## Navegação

As três telas num app só, com menu no topo. A referência da tela 1 mostra também Contas a Pagar, Centro de Custo, Fluxo
de Caixa e Detalhes como abas; ficam de fora até o dono pedir.

---

## Tela 1 — Gestão de Contas (visão geral)

Referência: `referencias/tela-1-gestao-de-contas.jpg`

**Filtros (valem para a tela inteira):** ano · mês (jan–dez) · centro de custo (seleção múltipla).

O filtro de centro de custo é aplicado no app sobre `movimentos[].departamentos[].nDistrValor`, porque a API não filtra
por departamento. **Regime de caixa (decisão do dono, 23/09):** cada lançamento conta no mês em que foi pago ou recebido.
O período de todos os cartões e dos gráficos é filtrado pela data de pagamento do Omie, `dDtPagtoDe` / `dDtPagtoAte`
(formato `dd/mm/aaaa`; a contagem de `scripts/contar-omie-filtros.mjs` mostrou que o Omie aplica esse filtro, não o
ignora). Única exceção: "Despesas pendentes", que por definição ainda não têm pagamento e usam o vencimento.

**Cartões no topo (linha de 7):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Saldo | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CPCR"` e `dDtPagtoDe` / `dDtPagtoAte` no mês (caixa); descarta `detalhes.cStatus = "CANCELADO"` | receitas − despesas do período | |
| Receitas | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` (ou `cNatureza: "R"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês (caixa); soma `detalhes.nValorTitulo`, fora os `CANCELADO` | soma das receitas do período | |
| Despesas | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` (ou `cNatureza: "P"`), `dDtPagtoDe` / `dDtPagtoAte` no mês (caixa) e mesmo descarte de `CANCELADO` | soma das despesas do período | |
| Despesas pagas | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` e `dDtPagtoDe` / `dDtPagtoAte` no mês; soma `resumo.nValPago` (cobre também o `PAGTOPARCIAL`) | despesas com baixa no período | |
| Despesas pendentes | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtVencDe` / `dDtVencAte` no mês (exceção ao caixa: sem baixa não há data de pagamento) e `resumo.cLiquidado = "N"` (equivale a `cStatus` em `EMABERTO`, `AVENCER`, `VENCEHOJE`, `ATRASADO`, `PAGTOPARCIAL`); soma `resumo.nValAberto` | despesas sem baixa, vencendo no período | |
| Despesas com funcionários | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtPagtoDe` / `dDtPagtoAte` no mês (caixa) e `cExibirDepartamentos: "S"`; soma `departamentos[].nDistrValor` dos códigos de pessoal. **lacuna:** quais departamentos são "de funcionários" — o Omie não marca departamento como de pessoal, a lista é decisão da MeuBESS (na referência seriam "funcionários do escritório" e "funcionários de obra") | despesas dos centros de custo de pessoal | |
| % desp. funcionários / receita líquida | Omie (calculado) | numerador: a linha acima. Denominador: a linha "(=) Receita líquida" da Tela 2, no mesmo mês de caixa (`dDtPagtoDe` / `dDtPagtoAte`). **lacuna:** a receita líquida depende de quais categorias a MeuBESS trata como dedução — ver a linha de deduções na Tela 2 | desp. funcionários ÷ receita líquida | |

Mais um botão **Fluxo de caixa** (leva à visão de fluxo, fora do escopo agora).

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Top 10 despesas | barras horizontais | total por centro de custo, as 10 maiores | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtPagtoDe` / `dDtPagtoAte` no período do filtro (caixa) e `cExibirDepartamentos: "S"`; agrupa `departamentos[].cCodDepartamento` somando `nDistrValor` e pega as 10 maiores; nome em `geral/departamentos` → `ListarDepartamentos` (`codigo` → `descricao`). **lacuna:** o que fazer com despesa sem rateio de departamento (ficar de fora, ou virar "sem centro de custo") — decisão da MeuBESS | |
| Top 10 receitas | barras horizontais | maiores lançamentos de receita (data, status, descrição) | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` no período do filtro (caixa), ordenado no app por `detalhes.nValorTitulo`; data em `detalhes.dDtVenc`, status em `detalhes.cStatus`. **"Descrição":** o título do Omie não tem campo de descrição, mas o pedido de venda que o originou tem — `produtos/pedido` → `ListarPedidos` / `ConsultarPedido`: `det[].produto.descricao` (com `codigo_produto`) dos itens e `cabecalho.numero_pedido`. **lacuna:** (a) o que aparece como "descrição" — a descrição dos produtos do pedido, o número do pedido, `detalhes.observacao` (só vem com `lDadosCad: true`), `cNumTitulo` ou a `descricao` da categoria — é decisão da MeuBESS; (b) a receita que não nasceu de pedido (não veio da plataforma) fica sem descrição de pedido; (c) o campo do título que aponta para o pedido ainda não foi conferido no Omie | |
| Receita × despesa por dia | colunas (receita acima, despesa abaixo) | totais diários no mês escolhido | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CPCR"` e `dDtPagtoDe` / `dDtPagtoAte` no mês (caixa); agrupa pelo dia dessa mesma data (`detalhes.dDtPagamento`) e separa por `detalhes.cNatureza` | |
| Receita × despesa por mês | duas linhas | totais mensais, com seletor de meses anteriores | Omie | a mesma chamada do bloco de cima, com `dDtPagtoDe` / `dDtPagtoAte` cobrindo a faixa de meses do seletor; agrupa por ano-mês de `detalhes.dDtPagamento` | |

**Centros de custo da referência** (a confirmar contra o Omie, em `geral/departamentos` → `ListarDepartamentos`):
assessoria jurídica · depósito · escritório · funcionários do escritório · funcionários de obra · marketing · material
de obra · telefonia · veículos · despesa bancária · despesa com sócios · receita.

---

## Tela 2 — DRE (demonstrativo de resultados)

Referência: `referencias/tela-2-dre.jpg`

**Filtros:** mês (seleção múltipla). **Botões:** análise horizontal (AH, variação contra o mês anterior) e análise
vertical (AV, peso sobre a receita).

A tela inteira sai de uma leitura só: `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CPCR"` e
`dDtPagtoDe` / `dDtPagtoAte` cobrindo os meses do filtro, somando `movimentos[].categorias[].nDistrValor` por `cCodCateg` e jogando cada categoria na
sua linha pelo `codigo_dre` do cadastro (`geral/categorias` → `ListarCategorias`), com a árvore e os sinais de
`geral/dre` → `ListarCadastroDRE` (`nivelDRE`, `sinalDRE`, `totalizaDRE`). AH e AV são calculadas no app, sobre os meses
já somados. **Regime de caixa (decisão do dono, 23/09):** cada lançamento conta no mês em que foi pago ou recebido, e a regra vale
para toda a tabela e os cartões — o filtro de data é o de pagamento do Omie, `dDtPagtoDe` / `dDtPagtoAte` (formato
`dd/mm/aaaa`; a contagem de `scripts/contar-omie-filtros.mjs` mostrou que o Omie aplica esse filtro, não o ignora).

**Cartões no topo (5, cada um com a linha do período embaixo):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Receita total | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (caixa), fora os `CANCELADO` | soma das linhas de receita da tabela abaixo | |
| Custos e despesas | Omie | a mesma leitura (`dDtPagtoDe` / `dDtPagtoAte`) com `cTpLancamento: "CP"` | soma das linhas de custos, despesas gerais e impostos | |
| EBITDA | Omie (calculado) | as linhas da tabela abaixo. **lacuna:** quais categorias são depreciação, amortização e resultado financeiro — o Omie não marca isso, e o `codigo_dre` só diz em que conta do DRE a categoria cai. Sem essa lista o EBITDA não se distingue do lucro operacional | receita líquida − custos − despesas operacionais, antes de juros, impostos, depreciação e amortização | |
| Lucro líquido | Omie (calculado) | as linhas da tabela abaixo | receita líquida − custos − despesas gerais − impostos | |
| Margem de lucro | Omie (calculado) | os dois cartões acima | lucro líquido ÷ receita | |

**Tabela:** uma coluna por mês (realizado e AH com seta) e o total do período. Linhas agrupadas, abrindo e fechando:

| linha | fonte | contas do plano / abas | conferido |
|---|---|---|---|
| (+) Receitas: outras receitas, vendas de produtos | Omie | categorias com `conta_receita = "S"` e `totalizadora = "N"` em `geral/categorias` → `ListarCategorias`, agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` (caixa). **"Vendas de produtos":** o título não diz qual produto foi vendido, o pedido de venda diz — `produtos/pedido` → `ListarPedidos` / `ConsultarPedido`, com os itens em `det[].produto` (`codigo_produto`, `descricao`, `valor_total`), o total em `total_pedido.valor_total_pedido` e a categoria do pedido em `informacoes_adicionais.codigo_categoria`. **lacuna:** (a) a quebra entre "outras receitas" e "vendas de produtos" depende de como a MeuBESS montou o plano de contas e o DRE no Omie — esses nomes não existem no cadastro padrão, e se "outras receitas" é a receita que não vem de pedido de produto é decisão dela; (b) como repartir o valor recebido de um título entre os produtos do pedido (proporcional ao `valor_total` dos itens ou o pedido inteiro numa linha) é decisão dela; (c) o campo do título que aponta para o pedido ainda não foi conferido no Omie | |
| (=) Receita bruta | Omie (calculado) | soma das linhas de receita; no Omie a conta totalizadora é a que tem `totalizaDRE = "S"` em `geral/dre` → `ListarCadastroDRE` | |
| (−) Deduções: devoluções, taxas de serviço | Omie | **lacuna:** o Omie não marca categoria como "dedução". Há pistas — `detalhes.cOperacao = "13"` (devolução de venda) e os campos de retenção do título (`nValorPIS`, `nValorCOFINS`, `nValorCSLL`, `nValorIR`, `nValorISS`, `nValorINSS`, com o `cRet…` correspondente em `"S"`) — mas quais categorias entram nesta linha é decisão da MeuBESS | |
| (=) Receita líquida | Omie (calculado) | receita bruta − deduções; depende da lacuna da linha acima | |
| (−) Custos de vendas: custo do produto, outros custos | Omie | categorias com `conta_despesa = "S"` cujo `codigo_dre` cai na conta de custo do DRE. **lacuna:** quais são essas contas no DRE da MeuBESS — sai do cadastro dela, não do padrão do Omie | |
| (=) Lucro bruto | Omie (calculado) | receita líquida − custos de vendas | |
| (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI | Omie | categorias com `conta_despesa = "S"` agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` e `dDtPagtoDe` / `dDtPagtoAte` (caixa). **lacuna:** o Omie também permite essa quebra por departamento (`departamentos[]`), e a referência mistura os dois recortes — a MeuBESS decide se a quebra é por categoria (plano de contas) ou por centro de custo | |
| (−) Impostos | Omie | **lacuna:** duas leituras possíveis, e a MeuBESS escolhe — (a) os impostos retidos no próprio título (`nValorPIS`, `nValorCOFINS`, `nValorCSLL`, `nValorIR`, `nValorISS`, `nValorINSS`), ou (b) as guias pagas, que entram como conta a pagar e se reconhecem por `detalhes.cTipo` (`DAS`, `DRF`, `GUIA`) ou pela categoria de imposto | |
| (=) EBITDA / lucro líquido | Omie (calculado) | **lacuna:** a referência junta os dois numa linha só e eles não são a mesma coisa. Qual dos dois a linha mostra (ou se vira duas linhas) é decisão da MeuBESS; o EBITDA ainda depende da lacuna de depreciação, amortização e resultado financeiro do cartão | |

O agrupamento real sai do **plano de contas do ERP** — no Omie, o `codigo_dre` de cada categoria (`ListarCategorias`)
contra o cadastro de contas do DRE (`ListarCadastroDRE`); a lista acima é a da referência e muda com ele.

---

## Tela 3 — Contas a receber

Referência: `referencias/tela-3-contas-a-receber.jpg`

**Filtros:** data de vencimento (de–até) · status · cliente · categoria.

A tela sai de uma chamada só: `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"`, e os quatro
filtros indo direto para a API — vencimento em `dDtVencDe` / `dDtVencAte`, status em `cStatus`, cliente em
`nCodCliente`, categoria em `cCodCateg`. O retorno traz, por título, `cabecTitulo` (o cabeçalho), `resumo`
(`cLiquidado`, `nValPago`, `nValAberto`) e `lancamentos[]` (as baixas). O mesmo dá para fazer com `financas/mf` →
`ListarMovimentos` e `cTpLancamento: "CR"`. **lacuna:** onde entram `VENCEHOJE` e `PAGTO_PARCIAL` nas faixas da tela é
decisão da MeuBESS; abaixo eles estão como pendente e como recebido-em-parte, que é a leitura mais direta dos campos.

**Cartões no topo (4):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Valor previsto | Omie | `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"` e `dDtVencDe` / `dDtVencAte` no período; soma `cabecTitulo.nValorTitulo`, fora os `cStatus = "CANCELADO"` | soma dos títulos do período | |
| Valor recebido | Omie | a mesma consulta; soma `resumo.nValPago` (pega inteiro o `RECEBIDO` / `LIQUIDADO` e a parte já paga do `PAGTO_PARCIAL`) | títulos com baixa | |
| Valor pendente | Omie | a mesma consulta, títulos com `cStatus` em `AVENCER`, `EMABERTO` ou `VENCEHOJE`; soma `resumo.nValAberto` | em aberto e ainda não vencidos | |
| Valor vencido | Omie | a mesma consulta, títulos com `cStatus = "ATRASADO"`; soma `resumo.nValAberto` | em aberto e vencidos | |

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Lançamentos por mês e status | colunas empilhadas (pago, atrasado, em aberto) | quantidade de títulos por mês | Omie | a mesma consulta; agrupa pelo ano-mês de `cabecTitulo.dDtVenc` e conta os títulos por faixa. **lacuna:** o de-para dos oito `cStatus` do Omie (`CANCELADO`, `RECEBIDO`, `LIQUIDADO`, `EMABERTO`, `PAGTO_PARCIAL`, `VENCEHOJE`, `AVENCER`, `ATRASADO`) para as três faixas da tela é decisão da MeuBESS | |
| Valor previsto por cliente e status | barras horizontais empilhadas | valor por cliente, dividido por status | Omie | a mesma consulta; agrupa por `cabecTitulo.nCodCliente` somando `nValorTitulo` e separa por `cStatus`; nome do cliente em `geral/clientes` → `ListarClientesResumido` | |
| Lista de títulos | tabela com total | código, cliente, categoria, descrição, valor previsto, vencimento, status | Omie | a mesma consulta, um título por linha: código `cabecTitulo.nCodTitulo` (e `cNumTitulo`, que é o que aparece na tela do ERP), cliente por `nCodCliente` em `geral/clientes` → `ListarClientesResumido`, categoria `cCodCateg` com a `descricao` de `geral/categorias` → `ListarCategorias`, valor `nValorTitulo`, vencimento `dDtVenc`, status `cStatus`. **"Descrição":** o título não tem esse campo no Omie; o pedido de venda de origem tem — `produtos/pedido` → `ListarPedidos` / `ConsultarPedido` (`det[].produto.descricao`, `cabecalho.numero_pedido`), como na Tela 1. **lacuna:** o que aparece como "descrição" é decisão da MeuBESS, título sem pedido fica sem ela e o campo do título que aponta para o pedido ainda não foi conferido no Omie | |
| Lançamentos por status | rosca com o total no centro | quantidade e % por status | Omie | a mesma consulta; conta os títulos por `cStatus` e usa `nTotRegistros` como total do centro. Mesma lacuna de de-para do primeiro bloco | |
