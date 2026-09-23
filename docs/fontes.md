# Fontes dos dashboards

O contrato do projeto: cada indicador das três telas, de onde vem e como é calculado. Indicador sem linha aqui não entra
na tela. "Conferido" é a data em que o número da tela bateu com a fonte num caso real.

As referências (`referencias/`) valem pelo **layout e pela disposição das informações**, não pelas cores. Os números que
aparecem nelas são de exemplo — nenhum é da MeuBESS.

## As fontes

| fonte | o que é | como lemos | quem libera o acesso |
|---|---|---|---|
| ERP | _a definir_ | _API, banco só de leitura ou exportação de relatório_ | _a definir_ |
| Planilhas | _a definir_ | _onde moram (Google Sheets, Excel no OneDrive, arquivo local)_ | _a definir_ |

## Navegação

As três telas num app só, com menu no topo. A referência da tela 1 mostra também Contas a Pagar, Centro de Custo, Fluxo
de Caixa e Detalhes como abas; ficam de fora até o dono pedir.

---

## Tela 1 — Gestão de Contas (visão geral)

Referência: `referencias/tela-1-gestao-de-contas.jpg`

**Filtros (valem para a tela inteira):** ano · mês (jan–dez) · centro de custo (seleção múltipla).

**Cartões no topo (linha de 7):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Saldo | | | receitas − despesas do período | |
| Receitas | | | soma das receitas do período | |
| Despesas | | | soma das despesas do período | |
| Despesas pagas | | | despesas com baixa no período | |
| Despesas pendentes | | | despesas sem baixa, vencendo no período | |
| Despesas com funcionários | | | despesas dos centros de custo de pessoal | |
| % desp. funcionários / receita líquida | | | desp. funcionários ÷ receita líquida | |

Mais um botão **Fluxo de caixa** (leva à visão de fluxo, fora do escopo agora).

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Top 10 despesas | barras horizontais | total por centro de custo, as 10 maiores | | | |
| Top 10 receitas | barras horizontais | maiores lançamentos de receita (data, status, descrição) | | | |
| Receita × despesa por dia | colunas (receita acima, despesa abaixo) | totais diários no mês escolhido | | | |
| Receita × despesa por mês | duas linhas | totais mensais, com seletor de meses anteriores | | | |

**Centros de custo da referência** (a confirmar contra o ERP): assessoria jurídica · depósito · escritório · funcionários
do escritório · funcionários de obra · marketing · material de obra · telefonia · veículos · despesa bancária · despesa
com sócios · receita.

---

## Tela 2 — DRE (demonstrativo de resultados)

Referência: `referencias/tela-2-dre.jpg`

**Filtros:** mês (seleção múltipla). **Botões:** análise horizontal (AH, variação contra o mês anterior) e análise
vertical (AV, peso sobre a receita).

**Cartões no topo (5, cada um com a linha do período embaixo):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Receita total | | | | |
| Custos e despesas | | | | |
| EBITDA | | | | |
| Lucro líquido | | | | |
| Margem de lucro | | | lucro líquido ÷ receita | |

**Tabela:** uma coluna por mês (realizado e AH com seta) e o total do período. Linhas agrupadas, abrindo e fechando:

| linha | fonte | contas do plano / abas | conferido |
|---|---|---|---|
| (+) Receitas: outras receitas, vendas de produtos | | | |
| (=) Receita bruta | | | |
| (−) Deduções: devoluções, taxas de serviço | | | |
| (=) Receita líquida | | | |
| (−) Custos de vendas: custo do produto, outros custos | | | |
| (=) Lucro bruto | | | |
| (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI | | | |
| (−) Impostos | | | |
| (=) EBITDA / lucro líquido | | | |

O agrupamento real sai do **plano de contas do ERP**; a lista acima é a da referência e muda com ele.

---

## Tela 3 — Contas a receber

Referência: `referencias/tela-3-contas-a-receber.jpg`

**Filtros:** data de vencimento (de–até) · status · cliente · categoria.

**Cartões no topo (4):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Valor previsto | | | soma dos títulos do período | |
| Valor recebido | | | títulos com baixa | |
| Valor pendente | | | em aberto e ainda não vencidos | |
| Valor vencido | | | em aberto e vencidos | |

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Lançamentos por mês e status | colunas empilhadas (pago, atrasado, em aberto) | quantidade de títulos por mês | | | |
| Valor previsto por cliente e status | barras horizontais empilhadas | valor por cliente, dividido por status | | | |
| Lista de títulos | tabela com total | código, cliente, categoria, descrição, valor previsto, vencimento, status | | | |
| Lançamentos por status | rosca com o total no centro | quantidade e % por status | | | |
