# Fontes dos dashboards

O contrato do projeto: cada indicador das três telas, de onde vem e como é calculado. Indicador sem linha aqui não entra
na tela. "Conferido" diz o que já foi verificado contra o Omie num caso real, e o que ainda não: a data em que o número
da tela bateu com a fonte — ou, enquanto a tela não existe, quais campos foram lidos de verdade e em que leitura.

As referências (`referencias/`) valem pelo **layout e pela disposição das informações**, não pelas cores. Os números que
aparecem nelas são de exemplo — nenhum é da MeuBESS.

## As fontes

| fonte | o que é | como lemos | quem libera o acesso |
|---|---|---|---|
| ERP | **Omie** — o ERP da MeuBESS (razão social NON IMPORTACAO E DISTRIBUICAO LTDA, em **três filiais**). **Papel das empresas (dono, 24/09/2026):** a empresa 1, filial `/0001-42`, é a das **rotinas administrativas** (o escritório); a empresa 2, filial `/0002-23`, é a de **compra, venda e logística**, a principal. **As três telas mostram a soma das empresas 1 e 2 (decisão do dono, 24/09/2026).** Cada consulta roda nas **duas** chaves — `OMIE_MEUBESS_1` e `OMIE_MEUBESS_2` — e os resultados se somam; toda linha deste documento que diz "`ListarMovimentos` com tal filtro" quer dizer a mesma chamada, com o mesmo filtro, nas duas empresas. A empresa 3 (`/0003-04`) **fica fora**. Só a `/0002-23` tem os pedidos, clientes e produtos que a plataforma envia (na leitura de 24/09/2026, 783 pedidos de venda, 814 contas a receber e 1.085 contas a pagar, contra 20 / 131 / 1.529 da `/0001-42` e 0 / 0 / 17 da `/0003-04` — comparação em `docs/comparacao-chaves-omie.html`), então a descrição vinda do pedido de venda só existe para a empresa 2. O que a soma exige dos dois cadastros está medido em "A soma das empresas 1 e 2", logo abaixo. Usamos os módulos Finanças (contas a pagar, contas a receber, movimentos financeiros), Geral (categorias, departamentos, clientes, contas do DRE) e Produtos (pedido de venda) | **API REST do Omie**: `POST https://app.omie.com.br/api/v1/<serviço>/`, corpo JSON com `call`, `app_key`, `app_secret` e `param`. **Cada consulta é feita duas vezes, uma por empresa, e os resultados se somam.** As chaves estão no `.env`: a da filial `/0001-42` em **`OMIE_MEUBESS_1_APP_KEY`** / **`OMIE_MEUBESS_1_APP_SECRET`** e a da `/0002-23` em **`OMIE_MEUBESS_2_APP_KEY`** / **`OMIE_MEUBESS_2_APP_SECRET`**. A terceira, `OMIE_MEUBESS_3_…` (filial `/0003-04`), a leitura das telas não usa. **Toda leitura de `financas/mf` das Telas 1 e 2 filtra a conta corrente**: guarda só os lançamentos cujo `detalhes.nCodCC` está marcado como da MeuBESS em `dados/contas-correntes-por-negocio.json` — ver "O recorte da MeuBESS: quais contas correntes são dela", abaixo. Sem esse filtro o número é o do CNPJ inteiro, que tem outras unidades de negócio dentro. Só métodos de consulta (`Listar*`, `Consultar*`, `Pesquisar*`, `Obter*`) — nenhum que inclua, altere ou exclua. Documentação: https://developer.omie.com.br/service-list/ | A chave de API (app key e app secret) é gerada pelo dono, uma por filial; já existe um aplicativo de integração cadastrado no Omie e as três chaves estão gravadas no `.env` local |
| Planilhas | **DFC** — as planilhas de **fluxo de caixa** que o financeiro da MeuBESS mantém, **uma por mês**: 12 arquivos `.xlsx` de 2026, de `01 - DFC - JAN2026.xlsx` a `12 - DFC DEZEMBRO 2026.xlsx`. Cada arquivo traz o movimento do mês lançado linha a linha (banco, vencimento, dia de pagamento, fornecedor/cliente, classificação contábil, entrada, saída, saldo, status), um painel do mês com o caixa dia a dia e um **cadastro próprio de contas** (a aba `BASE`) — um terceiro plano, diferente dos dois do Omie. Não é um DRE: é caixa. A estrutura completa está em "As planilhas de fluxo de caixa (DFC) de 2026", logo abaixo | **A pasta DFC/2026 sincronizada** — a pasta do SharePoint do financeiro que o OneDrive espelha neste computador. Lemos o arquivo `.xlsx` local, **só leitura**: `scripts/estrutura-dfc.mjs` (sem dependências; o `.xlsx` é um zip, lido com `zlib`) abre o arquivo com `fs.readFileSync` e **nunca grava, move ou abre para edição** — qualquer alteração o OneDrive mandaria de volta para o SharePoint. Nenhuma planilha é copiada para dentro do repositório, e o caminho da pasta não fica escrito no código: o script acha a subpasta de 2026 sozinho (ou aceita `DFC_DIR`) | O dono — é ele que libera a pasta do SharePoint e a mantém sincronizada neste computador |

### A soma das empresas 1 e 2 (vale para as três telas)

Toda consulta roda nas duas chaves e os resultados se somam, **inclusive os 3 lançamentos entre as duas empresas, que
entram como estão** (decisão do dono, 25/09/2026; item 2 abaixo). Medido no Omie em 24/09/2026 por
`scripts/plano-de-contas-omie.mjs` (só leitura), sobre os lançamentos do `financas/mf` **emitidos em 2026**, fora os
`cStatus = "CANCELADO"` — 2.572 lançamentos na empresa 1 e 2.846 na empresa 2. O cadastro inteiro, lado a lado, está em
[`docs/plano-de-categorias-omie.html`](plano-de-categorias-omie.html).

**1. Os dois planos de categorias usam a mesma numeração, mas não são o mesmo plano.** São 187 códigos somando as duas
(183 na empresa 1, 167 na empresa 2):

| | códigos |
|---|---|
| iguais nas duas (mesmo código, mesma descrição, mesma conta do DRE) | 86 |
| mesmo código, cadastro diferente | 77 — sendo 63 com descrição diferente e 46 com `codigo_dre` diferente |
| só na empresa 1 | 20 |
| só na empresa 2 | 4 |

Nenhum lançamento usa código fora do cadastro, nas duas empresas. As divergências não são cosméticas: o código `2.01.89`
é "Pensão Alimentícia- Custo (estoque)" (DRE `1.21.03`) na empresa 1 e "Gas para empilhadeira -Custos" (DRE `2.11.02`)
na empresa 2; o `2.01.02` é "Fretes s/ compras" nas duas, mas cai em `1.21.03` numa e em `2.01.01` na outra.
**Decisão do dono (24/09/2026): as três telas somam as empresas 1 e 2 pela conta do DRE de cada empresa, sem unificar os planos de categorias.** Cada lançamento cai na linha do DRE pelo `codigo_dre` da categoria dele **na própria empresa** — e não pelo código da categoria —, e o contador **não** vai unificar os planos. Assim os 77 códigos com cadastro diferente deixam de bloquear a soma: o mesmo código pode ter outro nome ou outra conta do DRE na outra empresa, e cada lançamento segue a conta da empresa dele. O que a soma exige é que as contas do DRE das duas empresas sejam as mesmas, e **são** — medido em 24/09/2026 por `scripts/contas-dre-omie.mjs` (só leitura, `geral/dre` → `ListarCadastroDRE` nas duas chaves):

| contas do DRE | |
|---|---|
| em cada empresa | 28 na empresa 1 e 28 na empresa 2 |
| iguais (mesmo código e mesma descrição) | 28 — e também com o mesmo nível, sinal, "totaliza" e exibição |
| mesmo código, descrição diferente | 0 |
| só na empresa 1 | 0 |
| só na empresa 2 | 0 |

As 28 contas, iguais nas duas: 9 totalizadoras (`1` Lucro Bruto, `1.01` Receita Líquida Operacional, `1.11` Receita Líquida Indireta, `1.21` Custos, `2` Despesas, `2.01` Variáveis, `2.11` Fixas, `3` Investimentos, `3.01` Investimentos) e 19 que recebem categoria: `1.01.01` Receita Bruta de Vendas, `1.01.02` Impostos, `1.01.03` Deduções de Receita, `1.11.01` Outras Receitas, `1.11.02` Receitas Financeiras, `1.11.03` Outras Deduções de Receita, `1.21.01` Custo Médio (CMC) das Vendas, `1.21.02` Custo dos Serviços Prestados, `1.21.03` Outros Custos, `2.01.01` Despesas Variáveis, `2.01.02` Recuperação de Despesas Variáveis, `2.11.01` Despesas com Pessoal, `2.11.02` Despesas Administrativas, `2.11.03` Despesas Financeiras, `2.11.04` Despesas de Vendas e Marketing, `2.11.05` Outros Tributos, `2.11.10` Recuperação de Despesas Fixas, `3.01.01` Ativos e `3.01.02` Serviços. A `1.21.01` está marcada para não aparecer no DRE, nas duas empresas.

**Categoria sem `codigo_dre`: linha própria "sem conta" (decisão do dono, 24/09/2026).** Categoria usada em lançamento sem `codigo_dre` não cai em nenhuma linha do DRE por essa regra. A mesma leitura, sobre os lançamentos emitidos em 2026 (fora os `CANCELADO`; um lançamento conta uma vez por categoria), achou **13 categorias sem `codigo_dre` na empresa 1, em 355 lançamentos** (a empresa tem 87 categorias usadas e 2.569 lançamentos contados), e **1 na empresa 2, em 111 lançamentos** (35 categorias usadas, 2.845 lançamentos). Nenhuma categoria usada está fora do cadastro de categorias, e nenhuma tem `codigo_dre` que não exista no DRE da própria empresa. Havia três saídas — virar uma linha "sem conta", o contador preencher o `codigo_dre` no Omie, ou ligarmos cada categoria a uma conta por nós. **O dono escolheu a primeira, em 24/09/2026: esses lançamentos aparecem na Tela 2 numa linha própria do DRE, chamada "sem conta", e não são distribuídos nas outras linhas nem deixados de fora.** A linha fica no fim da tabela, fora dos totalizadores do DRE (ela não tem conta, então não pertence a nenhum), e serve também de alarme: enquanto ela tiver valor, há lançamento que o DRE não está classificando. Se um dia o contador preencher o `codigo_dre` dessas categorias no Omie, a linha esvazia sozinha — nada no app precisa mudar.

| empresa | código | descrição | lançamentos em 2026 |
|---|---|---|---|
| 1 | `1.04.99` | Recebimento de Empréstimo Intercompany [terceiro] | 2 |
| 1 | `2.01` | Custos/Despesas Diretas | 10 |
| 1 | `2.01.01` | Compras de Mercadorias para Revenda | 18 |
| 1 | `2.01.03` | Compras de Materia Prima | 76 |
| 1 | `2.01.82` | Uniformes e equipamentos de Segurança - Custo (estoque) | 4 |
| 1 | `2.01.83` | Terceiros e Estagiários-  Custo (estoque) | 2 |
| 1 | `2.02` | Despesas de Vendas e Marketing | 24 |
| 1 | `2.08.01` | Adiantamento/Retirada de Sócio | 13 |
| 1 | `2.08.02` | Pagamento empréstimo Intercompany [terceiro] | 7 |
| 1 | `2.10.97` | Adiantamentos a Fornecedores | 8 |
| 1 | `2.10.98` | Pagamento [terceiro] - Adto acordo Juridico | 30 |
| 1 | `2.10.99` | Implantação de saldos (saidas) | 159 |
| 1 | `2.11` | Despesas Diretoria | 2 |
| 2 | `2.10.96` | Implantação de saldos (saidas) | 111 |

Para consulta, os 77 códigos com cadastro diferente entre as duas empresas (leitura de 24/09/2026; nome de terceiro que aparece em 3 descrições está trocado por `[terceiro]`). Pela decisão acima, cada um segue a conta do DRE da própria empresa:

| código | descrição na empresa 1 | descrição na empresa 2 | difere em |
|---|---|---|---|
| `1.01.02` | Rendimento Bancários | Clientes - Serviços Prestados | descrição e conta do DRE |
| `1.01.97` | Marketing | `<Disponível>` | descrição |
| `1.01.98` | Comissão de Venda | `<Disponível>` | descrição |
| `1.01.99` | RECEITA DE SERVIÇOS PRESTADOS | `<Disponível>` | descrição e conta do DRE |
| `1.02` | Receitas Indiretas | Receitas Indiretas/Outras receitas | descrição |
| `1.02.98` | `<Disponível>` | Outras receitas - Aluguel (sublocação barracão) | descrição e conta do DRE |
| `1.03` | Devoluções | Devoluções de Compras | descrição |
| `1.03.04` | Devoluções de Compra de Ativo | Devoluções de Compra de Ativo | conta do DRE |
| `1.04.01` | Adiantamento de Clientes | Adiantamento de Clientes | conta do DRE |
| `1.04.02` | Recebimento de Reembolso de Despesas | Receb. de Reembolso de Despesas | descrição |
| `1.04.95` | Rendimento Bancário | Prêmios de Seguros / Sinistros | descrição e conta do DRE |
| `1.04.96` | `<Disponível>` | Transferencia | descrição e conta do DRE |
| `1.04.97` | TRANSFERENCIA | Prêmios de Seguros / Sinistros | descrição e conta do DRE |
| `1.04.98` | Implantação de saldo (entradas) | Implantação de saldos (entradas) | descrição |
| `2.01.01` | Compras de Mercadorias para Revenda | Compras de Mercadorias para Revenda | conta do DRE |
| `2.01.02` | Fretes s/ compras | Fretes s/ compras | conta do DRE |
| `2.01.03` | Compras de Materia Prima | Compras de Materia Prima | conta do DRE |
| `2.01.89` | Pensão Alimentícia- Custo (estoque) | Gas para empilhadeira -Custos | descrição e conta do DRE |
| `2.01.90` | IRRF S/ Salários-  Custo (estoque) | Vigilância e Monitoramento -Custos | descrição e conta do DRE |
| `2.01.91` | FGTS-  Custo (estoque) | Locação de Máquinas e Equipamentos-Custos | descrição e conta do DRE |
| `2.01.92` | INSS-  Custo (estoque) | Armanezagem e manuseio de Carga -Custos | descrição e conta do DRE |
| `2.01.93` | 13º Salário- Custo (estoque) | Seguros de carga -Custo | descrição e conta do DRE |
| `2.01.94` | Rescisões- Custo (estoque) | IPTU- Custo | descrição e conta do DRE |
| `2.01.95` | Férias - Custo (estoque) | Telefone e Internet -Custo | descrição e conta do DRE |
| `2.01.96` | Adiantamento de Salário (custo) | Energia Elétrica-Custo | descrição e conta do DRE |
| `2.01.97` | Salários - Custo (estoque) | Água e Esgoto-Custo | descrição e conta do DRE |
| `2.01.98` | Disponível2 | Aluguel -Custo | descrição e conta do DRE |
| `2.01.99` | Gás para empilhadeira - Custos | CUSTO DOS PRODUTOS VENDIDOS | descrição |
| `2.02.01` | Desp com Rep. Comercial- COMISSÕES s/ vendas | Desp repr. Comercial- COMISSÕES s/ vendas | descrição e conta do DRE |
| `2.02.02` | Desp com Rep. Comercial - AJUDA DE CUSTO PJS | Desp com Rep. Comercial - AJUDA DE CUSTO PJS | conta do DRE |
| `2.02.04` | Bonificações/Brindes a clientes | Bonificações | descrição |
| `2.02.95` | Despesa vendas: Combustíveis | Despesa Marketing | descrição e conta do DRE |
| `2.02.96` | Despesas vendas: Lanches/Refeições | Estorno de venda | descrição |
| `2.02.97` | Despesas vendas:  Pedágio/Uber/99 | Reembolso por cancelamento | descrição |
| `2.02.98` | Despesas Vendas - Propaganda e Marketing | Despesas Vendas - Propaganda e Marketing | conta do DRE |
| `2.02.99` | Despesas vendas: Hospedagens /passagens | Despesas de Viagens (Vendas e MKT) | descrição e conta do DRE |
| `2.03` | Despesas com Pessoal | Despesas com Pessoal-ADM | descrição |
| `2.03.02` | Adiantamento de Salário- Adm | Adiantamento de Salário | descrição |
| `2.03.09` | Pensão Alimentícia - Adm | Pensão Alimentícia | descrição |
| `2.03.14` | Outros Benefícios- ADM | Outros Benefícios | descrição |
| `2.03.96` | Acordo Trabalhista | Aluguel - PE | descrição e conta do DRE |
| `2.03.97` | Mensalidade/Contribuição Sindical- Adm | Mensalidade/Contribuição Sindical-ADM | descrição |
| `2.03.98` | Uniformes e equipamentos de Segurança -Adm | Uniformes e equipamentos de Segurança -Adm | conta do DRE |
| `2.04.91` | Despesa Insumo Escritório | Emprestimo | descrição e conta do DRE |
| `2.04.92` | Despesas com Brindes - Endomarketing | Cartão de Crédito | descrição |
| `2.04.93` | Locação de Software- Adm | Mantimentos | descrição |
| `2.04.94` | Despesas com confraternizações | Mensalidade Hardware | descrição |
| `2.04.95` | Locação de veículos | Brindes e Marketing | descrição |
| `2.04.96` | Despesas Indedutíveis | Certificado Digital | descrição e conta do DRE |
| `2.04.97` | Agua e esgoto -ADM | Despesa Insumos Escritório | descrição e conta do DRE |
| `2.04.99` | Mensalidades de Software-ADM | Mensalidades de Software | descrição |
| `2.05.98` | `<Disponível>` | Transferencia | descrição e conta do DRE |
| `2.05.99` | Transferência Intercompany | Tarifas Bancarias | descrição |
| `2.06.02` | IPI | IPI A RECOLHER | descrição |
| `2.06.03` | PIS SOBRE VENDAS | PIS A RECOLHER | descrição |
| `2.06.04` | COFINS SOBRE VENDAS | COFINS A RECOLHER | descrição |
| `2.06.05` | IRPJ | IRPJ/CSLL | descrição |
| `2.07` | Investimento | Investimento/ Imobilizado | descrição |
| `2.07.01` | Máquinas e Equipamentos | Máquinas e Equipamentos | conta do DRE |
| `2.07.02` | Consórcio | Veículos | descrição e conta do DRE |
| `2.07.03` | Instalações | Instalações | conta do DRE |
| `2.07.04` | Equipamentos de Informática | Equipamentos de Informática | conta do DRE |
| `2.07.05` | Móveis e Utensílios | Móveis e Utensílios | conta do DRE |
| `2.07.06` | Comunicação | Comunicação | conta do DRE |
| `2.08.01` | Adiantamento/Retirada de Sócio | Adiantamento/Retirada de Sócio | conta do DRE |
| `2.08.02` | Pagamento empréstimo Intercompany [terceiro] | Outras Despesas | descrição e conta do DRE |
| `2.08.98` | Reembolso | `<Disponível>` | descrição e conta do DRE |
| `2.08.99` | OUTRAS DESPESAS | Reembolso - Custo | descrição e conta do DRE |
| `2.09.02` | Devoluções de Vendas de Serviços Prestados | Devoluções de Vendas de Produtos | descrição |
| `2.10.97` | Adiantamentos a Fornecedores | Pagamento [terceiro] - adto Juridico | descrição e conta do DRE |
| `2.10.98` | Pagamento [terceiro] - Adto acordo Juridico | Pagamento empréstimo Intercompany [terceiro] | descrição |
| `2.10.99` | Implantação de saldos (saidas) | Adiantamentos a Fornecedores | descrição e conta do DRE |
| `2.11.98` | Cartão de Credito | Seguro de Vida - Diretoria | descrição e conta do DRE |
| `2.11.99` | Aluguel Veiculo | Veiculos | descrição e conta do DRE |
| `2.12.97` | Aguá / Esgoto | Energia Eletrica | descrição |
| `2.12.98` | Energia Elétrica | [terceiro] | descrição |
| `2.12.99` | Aluguel | Aluguel do Barracão | descrição |

**2. Lançamentos entre as duas empresas: 3 em 2026, e entram na soma como estão.** Os três foram lidos na empresa 2
e têm a `/0001-42` como contraparte (`detalhes.cCPFCNPJCliente` com a mesma raiz de CNPJ, filial diferente): 2 a receber,
na categoria `1.01.01` "RECEITA DE VENDA DE PRODUTOS", e 1 a pagar, na `2.01.03` "Compras de Materia Prima". Lidos na
empresa 1, **zero** — nenhum lançamento de 2026 dela tem outra filial como contraparte, então esses três não aparecem
espelhados do outro lado. Nenhum dos dois lados usa categoria marcada como transferência (`transferencia = "S"`) em
2026. **Decisão do dono (25/09/2026): esses lançamentos entram na soma das empresas 1 e 2 como estão** — inteiros, sem
tirar nenhum e sem descontar o espelho do outro lado (que, na leitura de 2026, nem existe: a empresa 1 tem zero). Vale
para as três telas e para todo número que soma as duas chaves. Não é a mesma coisa que os empréstimos e transferências
Intercompany, que têm categoria própria e ficam fora do DRE por decisão de 25/09/2026 (ver a linha "EBITDA" da Tela 2):
estes três estão em categorias comuns, `1.01.01` e `2.01.03`, e contam na receita e na compra como qualquer outro.

**3. Departamentos: os mesmos 16 nomes nas duas empresas, e nenhum código em comum.** A empresa 1 tem 16 departamentos,
todos ativos, e a empresa 2 também; os 16 nomes são os mesmos dos dois lados, mas **zero** códigos coincidem — o
`cCodDepartamento` é próprio de cada empresa. Os da empresa 1, com os lançamentos de 2026: DIRETORIA (619), INSIDE SALES
(252), TI (152), RH (98), COMERCIAL (75), MARKETING (67), COMPRAS (54), ESTOQUE (52), FACILITIES (32), ADMINISTRATIVO
(20), MEU BESS (18), FISCAL (12), FINANCEIRO (8), CONTÁBIL (8), LOGÍSTICA (4) e OPERACIONAL (0). Sem departamento:
1.142 lançamentos na empresa 1 e 1.138 na empresa 2. **Decisão do dono (25/09/2026): o filtro de centro de custo da
Tela 1 junta os dois cadastros pelo nome.** O código não serve para casar, porque nenhum coincide; então o filtro mostra
**um nome por departamento** (a `descricao` de `geral/departamentos` → `ListarDepartamentos`, os mesmos 16 dos dois lados)
e, por trás de cada nome, guarda o `cCodDepartamento` de cada empresa. Ao escolher um nome, o app filtra os
`departamentos[]` de cada empresa pelo código dela. Vale onde a Tela 1 usa departamento ou centro de custo: o filtro da
tela e "Top 10 despesas" (seletor do Omie). **O lançamento sem departamento não
tem nome para juntar** — os 1.142 da empresa 1 e os 1.138 da 2 não entram em nenhum nome. **Decisão do dono
(25/09/2026): eles não ficam de fora; aparecem numa barra "sem centro de custo"**, que concorre ao Top 10 despesas como
qualquer outro departamento (detalhe na linha "Top 10 despesas" da Tela 1).

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
  feito no app, depois de ler o período inteiro, e agrupa as duas empresas pelo **nome** do departamento, com o código
  de cada empresa por trás (decisão do dono, 25/09/2026; ver "3. Departamentos" acima).
- **Não existe método que devolva o DRE já calculado.** O `geral/dre` → `ListarCadastroDRE` devolve só o *cadastro* das
  contas do DRE. Os valores da Tela 2 são somados por nós, categoria a categoria.

**As categorias de transferência que ficam fora das somas das Telas 1 e 2 — decisão do dono, 25/09/2026, opção B; cinco
na empresa 1, quatro na empresa 2.** Transferência entre contas não é receita nem despesa: entra numa conta e sai de
outra, e somar as duas pontas infla as duas. O cadastro do Omie marca duas delas (`transferencia = "S"`), mas outras
categorias chamadas "Transferência" estão **sem** a marca, e até 25/09/2026 as somas as contavam. **As marcadas, nas
duas empresas:** `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência. **As sem marca:** `1.04.96` e
`2.05.98` nas duas empresas, e `1.04.97` **só na empresa 1**. O nome muda de empresa para empresa: na empresa 1 a
`1.04.97` se chama "TRANSFERENCIA" e a `1.04.96` e a `2.05.98` estão como "&lt;Disponível&gt;" (código reservado, sem
uso); na empresa 2 a `1.04.96` e a `2.05.98` se chamam "Transferencia", mas a `1.04.97` se chama **"Prêmios de Seguros /
Sinistros"** e não é transferência — por isso a **decisão do dono de 25/09/2026** (resposta "aceito todas as sugestões")
deixa a `1.04.97` da empresa 2 **dentro** das somas, como **outra receita**, e a decisão passa a valer por empresa, e
não pelo código solto: `1.04.97` fica fora só na empresa 1. Em 2026 a `1.04.97` da empresa 2 não teve nenhum lançamento
no recorte, então nenhuma contagem deste documento muda por causa dela.
**O que as sem marca tiram das somas de 2026** (jan–set, recorte da MeuBESS, cache local da leitura de 27/09/2026,
09h11–09h17): empresa 1, **1 lançamento** — 1 avulso de entrada da `1.04.97`; empresa 2, **34** — 12 avulsos de entrada
da `1.04.96` e 22 avulsos de saída da `2.05.98`. Nenhuma delas aparece como título nem como baixa de parcial: todas só
vêm como lançamento avulso de conta corrente. Vale para toda linha de receita e de despesa das Telas 1 e 2; a Tela 3 é
carteira de títulos e não soma avulso, então não muda. **Do lado do DFC, a mesma ideia virou decisão em 27/09/2026:**
transferência entre contas também não é receita lá, e as linhas de `SUB 2` `TRANSFERENCIAS BANCARIAS - RECEITA` saíram do cartão
"Receitas" da Tela 1 — a regra inteira está na linha desse cartão, na Tela 1. As contagens das linhas abaixo já estão com elas
fora.

**A conta Adiantamento ao Fornecedor entra no recorte — decisão do dono, 25/09/2026, opção A.** As duas contas
`Adiantamento ao Fornecedor` do Omie (`tipo_conta_corrente = "AD"`; `nCodCC` 5969631123 na empresa 1 e 5191263988 na
empresa 2, esta inativa no Omie desde 16/07/2026) estavam **sem dono dito** em
`dados/contas-correntes-por-negocio.json` e, por isso, fora do recorte. O dono disse que as duas **são da MeuBESS** e
entram nas Telas 1 e 2; no arquivo elas passaram a `negocio: "MeuBESS"` com `dito_pelo_dono: true`.

**Como o dinheiro chega nessa conta** (conferido no cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a
API). Não é transferência marcada nem lançamento solto: é sempre o mesmo **par**, dentro da MeuBESS.

- **A ida, no banco.** Um **título a pagar** (`cGrupo = "CONTA_A_PAGAR"`) com `detalhes.cOrigem = "ADCP"`, pago de conta
  da MeuBESS — Itaú Unibanco na empresa 1; Itaú Unibanco, Caixinha e BANCO IMPLEMENTAÇÃO na 2 —, com a baixa dele na
  mesma conta (`CONTA_CORRENTE_PAG`, `cOrigem = "BAXP"`). **Empresa 1: 11 títulos** em 2026 — 4 de `2.10.97`
  Adiantamentos a Fornecedores e 7 de `2.01.99` Gás para empilhadeira - Custos. **Empresa 2: 42** — 39 de `2.10.99`
  Adiantamentos a Fornecedores e 3 de `2.01.03` Compras de Materia Prima.
- **A chegada, na conta do adiantamento.** Uma **entrada** de conta corrente (`cGrupo = "CONTA_CORRENTE_REC"`,
  `cNatureza = "R"`) com `detalhes.cOrigem = "ADCR"`, `nCodTitulo` 0 e `nCodOS` preenchido — e esse `nCodOS` é pedido de
  **compra**: nenhum deles é pedido de venda do cache. A categoria é `1.04.01` **Adiantamento de Clientes**, e aqui o
  nome engana: o dinheiro é da própria MeuBESS, não de cliente. **Empresa 1: 11 entradas; empresa 2: 44** (um título
  `ADCP` pode virar mais de uma entrada). A soma dos títulos `ADCP` é **igual, ao centavo**, à soma das entradas `ADCR`,
  nas duas empresas: é o mesmo dinheiro, só mudando de conta.
- **A saída, quando o fornecedor é pago.** A baixa do título da nota do fornecedor (título que nasce com
  `cOrigem = "COMP"`) sai da conta do adiantamento (`CONTA_CORRENTE_PAG`, `cOrigem = "BAXP"`): **11 na empresa 1 e 49 na
  2**. A linha de título desses `COMP` fica na conta do **banco**, que já estava no recorte — por isso essa despesa já
  era contada antes desta decisão, e é ela que deve contar.

**Não é nenhuma das categorias de transferência.** Nem as duas marcadas (`0.01.01` e `0.01.02`) nem as sem marca
(`1.04.96`, `2.05.98` e, só na empresa 1, `1.04.97`): a ida vem em `2.10.97` / `2.10.99` / `2.01.99` / `2.01.03` e a
chegada em `1.04.01`. Então o filtro de categoria não pega essa ida; o filtro é outro.

**A regra contra contar o mesmo dinheiro duas vezes.** A despesa conta **uma vez só, quando o fornecedor é pago** — pelo
título da nota (`COMP`), que a leitura já traz pela conta do banco. **A ida do banco para o adiantamento não é
despesa**, é dinheiro andando entre duas contas da MeuBESS, e a chegada na conta do adiantamento não é receita. **O
filtro, que vale para toda linha de receita, de despesa e de saldo das Telas 1 e 2:** ficam fora das somas **(a)** todo
lançamento com `detalhes.cOrigem = "ADCR"` e **(b)** todo lançamento de um título cujo `nCodTitulo` tenha, na mesma
leitura, alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida **e a baixa dele**, os dois. Os dois, porque
tirar só o título faria a baixa voltar pela regra da "baixa sem título irmão" (ver "Sem contar duas vezes", nas linhas
abaixo) e o dinheiro seguiria contado duas vezes.

**O que muda nas contagens de 2026** (jan–set, recorte da MeuBESS, cache local da leitura de 24/09/2026, 14h46–14h49,
sem chamar a API; o cadastro das contas correntes vem do mesmo cache).

| linha | empresa | antes (conta fora do recorte) | depois (conta dentro, com o filtro) |
|---|---|---|---|
| total da leitura de **despesa** — Despesas, Despesas pagas, Custos e despesas, (−) Despesas gerais, Top 10 despesas, Receita × despesa por dia e Saldo | 1 | 815 títulos + 8 baixas de parcial + 272 avulsos = 1.095 | **804 + 8 + 272 = 1.084** (−11 títulos: os 11 `ADCP`) |
| idem | 2 | 591 + 0 + 539 = 1.130 | **550 + 3 + 539 = 1.092** (−42 títulos `ADCP`, +1 título da própria conta do adiantamento, +3 baixas de parcial) |
| (−) Custos de vendas | 1 | 72 + 1 + 19 = 92 | **65 + 1 + 19 = 85** (−7: os `ADCP` de `2.01.99`, que está na lista de custo de vendas) |
| idem | 2 | 443 + 0 + 130 = 573 | **441 + 3 + 130 = 574** (−3 `ADCP` de `2.01.03`, +1 título, +3 baixas) |
| total da leitura de **receita** — Receitas, Receita total, Top 10 receitas, (+) Receitas e Saldo | 1 e 2 | 9 + 0 + 159 = 168 e 523 + 24 + 607 = 1.154 | **os mesmos** — as 11 entradas `ADCR` da empresa 1 e as 44 da 2 entrariam como `1.04.01`, mas o filtro as tira |

**O que não muda:** as Despesas com funcionários (nenhuma das categorias afetadas — `2.10.97`, `2.10.99`, `2.01.99`,
`2.01.03` e `2.01.01` — está na lista de pessoal); a linha "(−) Impostos pagos (guias)" (os 14 títulos de guia seguem os
mesmos; o único título a pagar que a conta nova traz para o recorte é de `2.01.03`, e por isso só as contagens de
títulos do recorte citadas naquela linha sobem em 1); as Despesas pendentes (a conta nova não tem título em aberto — o
único título dela em 2026 está `PAGO`); o resultado financeiro; e a Tela 3, que é carteira de títulos e não soma avulso.

**Onde o filtro está escrito no código.** Em `scripts/categorias-de-receita.mjs` (só o lado `ADCR`, porque ele lê só
receita, e `ADCP` é `cNatureza = "P"`) e, desde 25/09/2026, em `scripts/confronto-dfc-omie.mjs`, que lê a mesma lista de
contas e por isso passou a incluir a conta nova. No confronto o filtro tira **53 lançamentos** do lado do Omie — os 11
títulos `ADCP` da empresa 1 e os 42 da 2, exatamente os mesmos da seção acima. A regra (a) não tira nada **naquela
página** porque ela lê com `cTpLancamento: "CPCR"`, que já deixa de fora o lançamento avulso de conta corrente — e a
chegada `ADCR` é avulso; pelo mesmo motivo a baixa `BAXP` do título da ida também não aparece lá, e o que sai é a linha
de título. Nas Telas 1 e 2, que leem **sem** `cTpLancamento`, as duas regras tiram.

**Os três pagamentos em parte da empresa 2 entram agora.** Os títulos `nCodTitulo` 5228016911, 5232855897 e 5237326453 —
os três que a leitura de 25/09/2026 apontou como em parte pagos e que ficavam de fora — tinham a baixa exatamente nesta
conta, que era a "conta corrente sem dono dito". Com a conta no recorte, os três passam a entrar como **baixa de
parcial** na despesa da empresa 2 (de 0 para 3). Vêm sem `departamentos[]` e sem `categorias[]`, como toda baixa de
parcial, e trazem `detalhes.cCodCateg` (`2.01.03` em dois e `2.01.01` no terceiro) e `resumo.nValPago`.

Outros serviços de consulta usados: `financas/pesquisartitulos` → `PesquisarLancamentos` (pesquisa de títulos, com
filtro por vencimento, status, cliente e categoria de uma vez) e `geral/clientes` → `ListarClientesResumido` (nome do
cliente). O `financas/resumo` → `ObterResumoFinancas` não serve aqui: é um retrato de **um dia** (`dDia`), não de um
período.

**Pedido de venda — `produtos/pedido` → `ListarPedidos` (lista) e `ConsultarPedido` (um pedido, por `codigo_pedido`).**
É o elo anterior ao título financeiro: a plataforma MeuBESS cria o pedido de venda no Omie (no arquivo de integrações do
dono, 171 `Order` com código do Omie, de 17/04 a 23/09/2026) e o título a receber só aparece depois do faturamento. O
título não tem descrição nem produto; o pedido tem.

**Conferido no Omie em 24/09/2026** (`scripts/conferir-pedido-titulo.mjs`, só leitura, chave `OMIE_MEUBESS_2`), num
pedido faturado de verdade — pedido `numero_pedido` 827, `codigo_pedido` 5298679806, `etapa` `"60"` e
`infoCadastro.faturado` `"S"`. Os treze campos que este documento citava existiam todos no retorno do `ConsultarPedido`,
com o nome certo:

| campo do pedido | conferido |
|---|---|
| `cabecalho.codigo_pedido` | existe |
| `cabecalho.numero_pedido` | existe |
| `cabecalho.codigo_cliente` | existe |
| `cabecalho.data_previsao` | existe |
| `cabecalho.etapa` | existe |
| `det[]` (um item por linha) | existe |
| `det[].produto.codigo_produto` | existe |
| `det[].produto.descricao` | existe (preenchida em todos os itens do pedido lido) |
| `det[].produto.quantidade` | existe |
| `det[].produto.valor_unitario` | existe |
| `det[].produto.valor_total` | existe |
| `total_pedido.valor_total_pedido` | existe |
| `informacoes_adicionais.codigo_categoria` | existe |

Vale saber que **a `etapa` sozinha não diz se o pedido foi faturado**: na página lida havia pedido em `etapa` `"80"` com
`infoCadastro.faturado` `"N"`. Quem responde isso é `infoCadastro.faturado` (`S` / `N`), ao lado de `cancelado`,
`denegado`, `devolvido` e `devolvido_parcial`. O `ListarPedidos` devolve em ordem crescente de código e não aceita
`ordenar_por` nem `ordem_decrescente` — os pedidos recentes estão na **última** página.

**O campo que liga título e pedido: `nCodOS`.** O nome vem de "ordem de serviço", mas é nele que o Omie guarda o código
do pedido de venda que gerou o título — foi o que a leitura mostrou.

- No título, `cabecTitulo.nCodOS` = `cabecalho.codigo_pedido` do pedido, e `cabecTitulo.cNumOS` =
  `cabecalho.numero_pedido`. Em `financas/mf` → `ListarMovimentos` os mesmos dois vêm como `detalhes.nCodOS` e
  `detalhes.cNumOS`. No `financas/contareceber` → `ListarContasReceber` o campo se chama `nCodPedido` (e há também
  `numero_pedido`), mas as três telas não usam esse serviço.
- **A ligação funciona nos dois sentidos.** Do título para o pedido: `ConsultarPedido` com
  `codigo_pedido = cabecTitulo.nCodOS` devolveu o pedido 827. Do pedido para o título: `nCodOS` também é aceito como
  **filtro** — `PesquisarLancamentos` com `cNatureza: "R"` e `nCodOS: 5298679806` devolveu exatamente o título
  `nCodTitulo` 5298681207, e o `ListarMovimentos` com `nCodOS` devolveu o mesmo lançamento. Ou seja, dá para ler os
  títulos do período e buscar os pedidos pelos `nCodOS` que vierem, sem varrer os 783 pedidos.
- **Não confundir com `cNumTitulo`.** Num primeiro pedido lido o `cNumTitulo` era igual ao `numero_pedido` por
  coincidência; no pedido 827 o `cNumTitulo` veio **vazio**, e numa amostra de 100 títulos a receber 97 estavam sem ele.
  O que liga é `nCodOS`, não `cNumTitulo`.
- **Cobertura, na mesma amostra de 100 títulos a receber** (de 814): 93 com `nCodOS` preenchido e 7 sem. A divisão é
  limpa por `cabecTitulo.cOrigem` — `VENR` (venda, 55) e `ADVR` (adiantamento de venda, 38) têm todos `nCodOS`; `MANR`
  (lançamento manual, 7) não tem nenhum. Bate com a regra de negócio: receita da plataforma nasce em pedido, despesa e
  lançamento avulso entram à mão. Título com `cOrigem = "MANR"` fica sem descrição de pedido, e a descrição dele é a da categoria (decisão do dono de 25/09/2026, nas linhas do Top 10 receitas e da Lista de títulos).

O que o pedido **não** é: não traz data de pagamento nem quanto já foi recebido, então não substitui o
`ListarMovimentos` nos números (o regime de caixa continua no título). Ele entra só onde o título não responde —
descrição e produto — e essas linhas dizem "pedido de venda" na coluna de filtro.

<!-- CONTAGENS-JAN-SET:INICIO -->
### As contagens de jan–set desta leitura (bloco gerado — não edite à mão)

Escrito por [`scripts/numeros-das-telas.mjs`](../scripts/numeros-das-telas.mjs) a cada rodada da conferência, na mesma
passagem que grava [`docs/conferencia.md`](conferencia.md) — as contagens daqui e as de lá são sempre da mesma leitura
do Omie, e é assim que este documento e aquela página não têm como discordar.

**De que leitura são as contagens desta tabela:** leitura `f650b50ab90b` — 359 arquivos no cache local, o mais novo gravado em 29/09/2026 às 02h12; a última releitura do app que trouxe dado do Omie foi em 29/09/2026 às 02h12 (ok, 287 páginas).

**De que leitura são as contagens escritas em PROSA neste documento:** da leitura de 27/09/2026, 09h11–09h17 — a
leitura de referência. Elas são história e ficam como estão; a coluna da direita repete cada uma ao lado da contagem de
agora. Uma diferença não é erro: o app relê o Omie de hora em hora e o Omie recebe lançamento com data retroativa, então
um mês já passado muda de contagem sozinho. Quem trava o que não pode mudar é
[`docs/trava-agosto-2026.json`](trava-agosto-2026.json), que fixa agosto de 2026 — os baldes do mês, as faixas da
Tela 3, a identidade de cada caso real conferido e a impressão digital dos campos de cadastro de todos os lançamentos
do mês.

| o que | esta leitura (`f650b50ab90b`) | a leitura de referência (27/09/2026, 09h11–09h17) | igual? |
|---|---|---|---|
| total da leitura de **receita** da empresa 1, jan–set (títulos, baixas de parcial, avulsos) | 9, 0, 162 | 9, 0, 162 | sim |
| total da leitura de **despesa** da empresa 1, jan–set (títulos, baixas de parcial, avulsos) | 812, 9, 282 | 809, 9, 276 | **não** — a releitura mexeu |
| total da leitura de **receita** da empresa 2, jan–set (títulos, baixas de parcial, avulsos) | 540, 25, 620 | 536, 25, 611 | **não** — a releitura mexeu |
| total da leitura de **despesa** da empresa 2, jan–set (títulos, baixas de parcial, avulsos) | 558, 3, 564 | 556, 3, 547 | **não** — a releitura mexeu |
| custos de vendas, jan–set (títulos + baixas + avulsos da empresa 1, depois da 2) | 66, 1, 20, 449, 3, 148 | 66, 1, 20, 447, 3, 137 | **não** — a releitura mexeu |
| resultado financeiro, jan–set (receita emp. 1, receita emp. 2, despesa emp. 1, despesa emp. 2) | 55, 11, 98, 33 | 55, 11, 98, 33 | sim |
| pessoal pago, jan–set (empresa 1, empresa 2) | 255, 325 | 253, 322 | **não** — a releitura mexeu |
| impostos pagos (guias), jan–set (títulos, baixas de parcial, avulsos, somando as duas empresas) | 14, 0, 10 | 14, 0, 10 | sim |
| códigos de outra receita no cadastro (empresa 1, empresa 2) | 26, 28 | 26, 28 | sim |
| títulos `ADCP` do par do adiantamento em 2026 (no ano todo, em agosto) | 53, 1 | 53, 1 | sim |

<!-- CONTAGENS-JAN-SET:FIM -->

### As planilhas de fluxo de caixa (DFC) de 2026 (vale para as três telas)

Lidas em 24/09/2026 por `scripts/estrutura-dfc.mjs` (só leitura; o script imprime estrutura e contagens, nunca valor de
célula); a mesma leitura, numa página para ler de uma vez, está em
[`docs/planilhas-dfc.html`](planilhas-dfc.html). São **12 arquivos, um por mês**, todos de 2026. Os arquivos **não são cópias uns dos outros** — cada mês foi
salvo a partir do anterior e ganhou abas pelo caminho —, mas **três abas existem nos 12** e são o modelo comum:

| aba | o que é | onde ficam os meses/dias |
|---|---|---|
| a aba do mês (`JANEIRO2026`, `FEVEREIRO`, `Mrço2026`; de abril em diante ` 2026`, com espaço na frente) | painel do mês: `Saldo Inicial` (B6), `Provisões` (B10), `Receitas` (B15), `Gastos` (B20), `Lucro Liquido` (B25); depois o quadro do caixa **dia a dia**, linhas `Inicial` (42), `Entradas` (43), `Gastos` (44), `Final` (45); e, da linha 47 para baixo, o lançamento de recebimentos e pagamentos por banco e dia | **um dia por coluna**, de `D` a `AH` nas linhas 42–45 (31 dias). O mês é o do arquivo |
| `FLUXO DE CAIXA` | o extrato do mês, **uma linha por lançamento**. É o coração da planilha | um arquivo por mês; dentro dele, a data em `VENCIMENTO` (E) e em `DIA PG` (F) |
| `BASE` (`base` em janeiro–março) | o **cadastro de contas do DFC**: a coluna A lista as contas de `SUB 2` | — |

**Cabeçalho de `FLUXO DE CAIXA`** (linha 1, igual em 11 dos 12 arquivos):

| col | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rótulo | `EMP.` | `VER.` | `BANCO` | `TIPO` | `VENCIMENTO` | `DIA PG` | `FORNECEDOR / CLIENTE` | `TITULO` | `CLASS. CONTABIL` | `SUB 2` | `ENTRADA` | `SAIDA` | `SALDO` | `PAGAMENTO` | `STATUS` | `CONCILIADO` | `OBS:` |

**A única diferença de modelo entre os 12:** em `03 - DFC - MAR2026.xlsx` há uma coluna `SALDO` a mais em N, e daí para
a direita tudo anda uma casa (`PAGAMENTO` em O, `STATUS` em P, `CONCILIADO` em Q, `OBS:` em R). Quem ler as planilhas
tem de achar as colunas **pelo nome no cabeçalho**, não pela letra.

Dentro de `FLUXO DE CAIXA` o cabeçalho **se repete**: a aba é dividida em blocos, um por banco, cada um com sua linha
de saldo inicial e seu total (em setembro, três blocos). Ler a aba inteira de uma vez, sem enxergar os blocos, mistura
saldo com lançamento.

**As contas do DFC.** Duas colunas classificam cada linha, e são o que o DFC tem no lugar de um plano de contas:

- **`CLASS. CONTABIL` (I)** — o grupo. Na leitura de setembro, 24 valores: `RECEITA DE CLIENTE`, `FORNECEDORES G&A`,
  `FORNECEDORES COGS` (também escrito `FORNECEODORES COGS`, com erro de digitação — ver abaixo), `PESSOAL PJ`, `REEMBOLSO`, `DESPESA PJ`, `OUTRAS DESPESAS`, `FOLHA, IMPOSTOS E ADIANTAMENTOS`,
  `IMPOSTOS E CONTRIBUIÇÕES`, `COMPRA DE MERCADORIA`, `DESPESA CLT`, `ESTORNO`, `REPASSE`, `RESCISÃO`,
  `REPASSE CREDITO`, `TRANSFERENCIA`, `TRANSFERÊNCIA`, `CARTÃO DE CREDITO`, `SEGURO`, `EMPRÉSTIMO`,
  `RETIRADA DE SÓCIO`, `ADIANTAMENTO JURÍDICO`, `ALUGUEL` (`TRANSFERENCIA` e `TRANSFERÊNCIA` são a mesma coisa escrita
  de dois jeitos).

  **`FORNECEODORES COGS` é `FORNECEDORES COGS` com erro de digitação, e conta igual** (decisão do dono, 25/09/2026:
  "sim fornecedor COGS é custo de vendas"). São **2 linhas em agosto de 2026**, e só nesse mês dos doze arquivos do ano.
  Toda regra deste documento que cita `FORNECEDORES COGS` **aceita as duas grafias** — o código não corrige a planilha
  nem adivinha grafia nova: as duas estão escritas na regra, como `TRANSFERENCIA` e `TRANSFERÊNCIA`. Aceitar a grafia
  **não** fez essas 2 linhas entrarem em "(−) Custos de vendas": o `SUB 2` delas é `MARKETING / PUBLICIDADE`, e a regra
  dessa linha também pede um `SUB 2` de custo. **Decisão do dono, 25/09/2026: "marketing não é custo de vendas"** — a
  regra fica como está e as 2 linhas de agosto continuam fora de "(−) Custos de vendas".
- **`SUB 2` (J)** — a conta. Sai do cadastro da aba `BASE`, coluna A, que em setembro tem **69 contas**:
  `ÁGUA (SANEPAR)`, `ALUGUEL (BARRACÃO)`, `ALUGUEL (SEDE)`, `ALUGUEL (BOX)`, `ALUGUEL (BOX - PE)`,
  `ALUGUEL DE VEÍCULOS`, `APLICAÇÃO TRANS.`, `ARMAZENAGEM E MANUSEIO`, `BRINDES E MARKETING`, `COMISSÃO DE VENDAS`,
  `COMPRA PROVISÃO`, `COMPRAS - PROVISÃO`, `COMPRAS DE MERCADORIAS`, `CONDOMÍNIO`, `CONSÓRCIOS`,
  `CRÉDITO REPASSE - CUSTO`, `CUSTOS COM CARTÃO DE CRÉDITO`, `DESPESAS CLT`, `DESPESAS PJ`, `DESPESAS VEICULOS`,
  `DEVOLUCÃO`, `EMPRESTIMO`, `ENERGIA ELÉTRICA`, `ENERGIA ELÉTRICA (SEDE)`, `FRETE - PROVISÃO`, `FRETE E CARRETO`,
  `HONORÁRIOS CONTÁBEIS`, `HONORÁRIOS JURÍDICOS`, `INDEDUTIVEL`, `INSS`, `IPTU (BARRACÃO)`, `IPTU (SEDE)`,
  `IRPJ / CSLL`, `ISS`, `JUROS`, `LICENÇAS DE SOFTWARE`, `LIMPEZA`, `LOCAÇÃO DE HARDWARE`, `MANTIMENTOS`,
  `MÁQUINAS E EQUIPAMENTOS`, `MARKETING / PUBLICIDADE`, `MATERIAIS DE ESCRITÓRIO`, `MATERIAIS DE LIMPEZA`, `MULTAS`,
  `OUTRAS DESPESAS`, `OUTRAS DESPESAS - PROVISÃO`, `OUTRAS RECEITAS`, `OUTRAS RECEITAS - PROVISÃO`,
  `PRÓ-LABORE ( retirada de sócio )`, `RECEBIMENTO CLIENTE - PROVISÃO`, `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`,
  `REEMBOLSO`, `REEMBOLSO - PROVISÃO`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`, `REPASSE`, `REPASSE - CREDITO`,
  `SALDO FINAL`, `SALDO FINAL PROVISÃO`, `SALDO INICIAL`, `SALDO INICIAL PROVISÃO`, `SEGURO`, `TARIFAS BANCÁRIAS`,
  `TAXA BANCARIA`, `TELEFONIA / INTERNET`, `TRANSFERÊNCIAS BANCÁRIAS - CUSTO`, `TRANSFERÊNCIAS BANCÁRIAS - RECEITA`,
  `VIGILÂNCIA E MONITORAMENTO`.

O cadastro `BASE` **mudou de forma durante o ano**: em janeiro eram três colunas (`SUBCATEGRIA 1`, `categoria`,
`CATEGORIA 2`), em fevereiro e março seis, em abril quatro, em maio duas e de junho em diante uma só
(`SUBCATEGORIA 2`). A coluna `SUB 2` do `FLUXO DE CAIXA`, essa sim, existe nos 12 arquivos. Também há grafia solta nos
lançamentos (`Despesas CLT` ao lado de `DESPESAS CLT`, `RENDIMENTO FINANCEEIRO`), e em janeiro–março as contas foram
escritas em caixa mista.

**Outras colunas que classificam:** `PAGAMENTO` (N), com `PAGO`, `RECEBIDO` e `A PAGAR`; `STATUS` (O), com `INTEGRAL`,
`PARCIAL` e `SINAL` (quanto do projeto aquele recebimento cobriu); `TIPO` (D), com `PRIMEIRO DIA` / `ULTIMO DIA`;
`EMP.` (A), com `B3W` em todos os meses e `N3` a partir de agosto. **Não está escrito em lugar nenhum da planilha qual
`EMP.` é qual empresa do Omie** — o de-para entre `B3W` / `N3` e as filiais `/0001-42` e `/0002-23` não existe nos
arquivos. **Ele foi procurado no dado, em 27/09/2026, e NÃO EXISTE: nenhum dos dois rótulos é filial do Omie** — a prova,
com as contagens do cruzamento, está em "A coluna `EMP.` não é a filial do Omie", logo abaixo.

#### A coluna `EMP.` não é a filial do Omie (cruzamento de 27/09/2026)

**Por que isto foi medido.** O filtro de empresa das três telas (decisão do dono, 27/09/2026: empresa 1, empresa 2 ou as
duas) precisa saber se o lado do DFC pode ser recortado por empresa. A planilha tem a coluna `EMP.` e não diz o que ela
significa; então o de-para foi procurado no ÚNICO caminho que existe sem perguntar: cruzar lançamento por lançamento
pelos campos que os dois lados têm em comum — **data, valor e o nome do cliente/fornecedor**. Quem faz o cruzamento é
[`scripts/de-para-empresa-dfc.mjs`](../scripts/de-para-empresa-dfc.mjs) (`node scripts/de-para-empresa-dfc.mjs`), só
leitura, e ele imprime contagem, código e data — nunca valor em dinheiro, e o nome sai mascarado.

**Como o cruzamento é feito.** Das 5.327 linhas do `FLUXO DE CAIXA` dos 12 arquivos, **4.670 são cruzáveis** (já
baixadas e com `DIA PG` no mês do próprio arquivo — o mesmo recorte de linha que as telas usam). Do outro lado, os
lançamentos do Omie no recorte da MeuBESS pelos mesmos três baldes das telas: **1.271 na empresa 1 e 2.298 na empresa 2**.
Depois, dois níveis:

| nível | como casa | por que não basta o de cima |
|---|---|---|
| 1 — data + valor | mesmo dia e mesmo valor em centavos, em cada empresa | duas contas do mesmo dia e do mesmo valor casam por acaso |
| 2 — data + valor + **nome** | o mesmo do nível 1, e o nome de `FORNECEDOR / CLIENTE` igual ao nome do cadastro `geral/clientes` da empresa — sem acento, em maiúscula, sem as formas jurídicas (LTDA, ME, EIRELI…). Estrito: dois pedaços de nome em comum, um pedaço de 8 letras ou mais, ou um nome inteiro dentro do outro | é o nível que decide |

**O resultado — o de-para NÃO FECHA, para nenhum dos dois rótulos:**

| `EMP.` | linhas cruzáveis (no arquivo) | nível 1: só emp. 1 · só emp. 2 · nas duas · em nenhuma | nível 2 (com nome): só emp. 1 · só emp. 2 · nas duas · em nenhuma |
|---|---|---|---|
| `B3W` | 4.651 (5.202) | 897 · 1.324 · 133 · 2.297 | **565 · 481** · 66 · 3.539 |
| `N3` | 18 (23) | 9 · 6 · 0 · 3 | **4 · 4** · 0 · 10 |
| (vazio) | 1 (102) | 0 · 0 · 0 · 1 | 0 · 0 · 0 · 1 — não diz nada sobre empresa |

**A prova, no mês conferido e no mesmo dia.** As duas linhas abaixo são `EMP.` = `B3W`, as duas do arquivo de agosto, as
duas com `DIA PG` **03/08/2026**, e cada uma casa com uma empresa DIFERENTE — mesmo dia, mesmo valor, mesmo nome de
fornecedor/cliente:

| linha do `FLUXO DE CAIXA` de agosto | `EMP.` | `DIA PG` | casa com | no Omie |
|---|---|---|---|---|
| 4 | `B3W` | 03/08/2026 | **empresa 1** | `CONTA_A_PAGAR`, título `6026263192`, categoria `2.08.99` |
| 9 | `B3W` | 03/08/2026 | **empresa 2** | `CONTA_A_RECEBER`, título `5279147389`, categoria `1.01.01` |

E o mesmo vale para `N3`, também em agosto: a linha 169 (`DIA PG` 17/08/2026) casa com o título `6039461776` da
**empresa 1**, e a linha 11 (`DIA PG` 03/08/2026) com o título `5290113869` da **empresa 2**.

**O que `EMP.` é, então.** Não é a filial. As 23 linhas `N3` do ano têm a marca `N3` escrita também no nome do
fornecedor/cliente ou na coluna `TITULO` da própria linha, e `B3W` é o rótulo de todo o resto — as duas filiais
misturadas. O rótulo separa alguma outra coisa (uma frente de negócio, pelo que as próprias linhas mostram), e essa
outra coisa não é o que as telas somam. `B3N` e `3N`, que aparecem na coluna `EMP.` das pastas de DFC das OUTRAS
unidades, são rótulos daquelas pastas e não entram aqui.

**Consequência para as telas, e é só esta:** o **filtro de empresa não vale em nenhum número que venha do DFC**. Cada
cartão, bloco e linha de fonte DFC mostra o número das duas empresas somadas e escreve isso ao lado, junto do valor —
`docs/filtros.md` lista todos, um a um. **Nenhuma regra de indicador muda por causa disto**, e nada aqui vira heurística:
o código não adivinha empresa a partir de `EMP.`.

**As outras abas** (não estão nos 12; aparecem e somem conforme o mês):

| aba | em quais arquivos | o que é |
|---|---|---|
| `CONTA BANCO` | abril–dezembro | as contas bancárias da empresa: `EMPRESA`, `BANCO`, `AGENCIA`, `CONTA` (11 linhas) |
| `BANCO` e `SALDO BANCARIO` | janeiro–abril | a versão anterior do mesmo controle, com saldo por banco e por dia |
| `CARTÃO DE CRÉDITO` | maio–dezembro | a fatura lançada linha a linha: `CARTÃO`, `DATA`, `NOME`, `VALOR`, `Obs`, **`OBS GU - OMIE`**, `VALOR TOTAL`, `VENCIMENTO`. A coluna `OBS GU - OMIE` é a marca de conferência contra o Omie — o único ponto do DFC que aponta para o ERP |
| `PROVISÃO` | abril–dezembro | controle por projeto: `CLIENTE`, `VALOR PROJETO`, `VALOR RECEBIDO`, `VALIR A RECEBER` [sic], `VALOR DE COMPRA`, `VALOR FRETE`, `VALOR REPASSE`, `VALOR COMISSÃO`, `VALOR FINAL`. Em julho e agosto tinha 13–15 linhas; em setembro, 5 |
| `FRETE` | julho–dezembro | um frete por linha: `CT-e`, `Projeto`, `Transportadora`, `Data Emissão`, `Peso (kg)`, `Valor`, `Orçado` |
| `COMPRRAS` [sic] | agosto | compras: `PROVISÃO DE COMPRA`, `DATA COMPRA`, `FORNECEDOR`, `PROJETO`, `CLIENTE`, `VALOR COMPRA`, `VALOR ESTOQUE`, `PO` |
| `PJ VENDAS` e `COMISSÃO PJ` | abril–dezembro | os prestadores PJ e o cálculo de comissão sobre o faturado |
| `RATEIO B3NXB3W` | abril–dezembro | rateio de despesa comum entre as duas empresas, e **o único lugar que usa código de conta contábil** (`3.4.2.03.0001 - SERVIÇOS DE LIMPEZA` e afins) — que não são os códigos do plano do Omie |
| `Planilha1` … `Planilha10`, `Detalhes1`, `DESPESA`, `FLUXO DE CAIXA-erro`, `FLUXO DE CAIXA (2)` | soltas | rascunhos e versões antigas, quase todas ocultas. Não servem de fonte |

**Quais meses estão preenchidos.** De janeiro a setembro cada arquivo tem o movimento do próprio mês, realizado.
Outubro, novembro e dezembro só têm as contas fixas já provisionadas — **nenhuma receita e nenhum pagamento baixado**:

| arquivo | linhas em `FLUXO DE CAIXA` | pagamentos com data no mês | situação |
|---|---|---|---|
| 01 janeiro | 416 | 413 | preenchido |
| 02 fevereiro | 446 | 421 | preenchido |
| 03 março | 525 | 523 | preenchido |
| 04 abril | 602 | 563 | preenchido |
| 05 maio | 919 | 884 | preenchido |
| 06 junho | 496 | 462 | preenchido |
| 07 julho | 755 | 709 | preenchido |
| 08 agosto | 457 | 388 | preenchido |
| 09 setembro | 346 | 334 | preenchido (o mês em curso) |
| 10 outubro | 136 | 104 | **só provisão** — 104 linhas, todas `A PAGAR`, nenhuma de receita |
| 11 novembro | 132 | 79 | **só provisão** — 79 linhas, todas `A PAGAR` |
| 12 dezembro | 132 | 79 | **só provisão** — 79 linhas, todas `A PAGAR` |

Ou seja: **o DFC só tem mês fechado até setembro de 2026**, e os três últimos arquivos são o gabarito das despesas
recorrentes, não o mês.

### O que o DFC pode alimentar e o que fica no Omie

O que o DFC pode alimentar está abaixo; **qual das duas fontes cada indicador usa de verdade já está decidido** — o
dono aprovou a proposta da seção 7 de `docs/confronto-dfc-omie.html` (página local, fora do git) em 24/09/2026. Nenhuma
linha deste resumo é candidatura em aberto: ele diz o que existe no DFC, e "A escolha entre Omie e DFC", mais abaixo,
diz quem leva cada indicador. O resumo:

| tela | o que o DFC pode alimentar | aba e coluna/linha |
|---|---|---|
| 1 | Saldo, Receitas, Despesas, Despesas pagas, Despesas pendentes | `FLUXO DE CAIXA`: `ENTRADA` (K) e `SAIDA` (L), com o mês vindo de `DIA PG` (F) — ou de `VENCIMENTO` (E) no caso do pendente; `PAGAMENTO` (N) separa `PAGO` / `RECEBIDO` / `A PAGAR` |
| 1 | Despesas com funcionários e o % sobre a receita | `FLUXO DE CAIXA`: `CLASS. CONTABIL` (I) e `SUB 2` (J) nomeiam pessoal na própria linha — o Omie não marca isso |
| 1 | Top 10 despesas e Top 10 receitas | `FLUXO DE CAIXA` agrupado por `CLASS. CONTABIL` (I) ou `SUB 2` (J); a descrição da receita já está em `FORNECEDOR / CLIENTE` (G), `TITULO` (H) e `OBS:` (Q) |
| 1 | Receita × despesa por dia e por mês | aba do mês, linhas `Entradas` (43) e `Gastos` (44), um dia por coluna de `D` a `AH` — o bloco já existe pronto |
| 2 | Receita total, Custos e despesas, Lucro líquido, Margem | `FLUXO DE CAIXA` por `CLASS. CONTABIL` (I) — `FORNECEDORES COGS` (e `FORNECEODORES COGS`, a mesma conta com erro de digitação) é custo e `FORNECEDORES G&A` é despesa geral; e a aba do mês já traz `Receitas` (B15), `Gastos` (B20) e `Lucro Liquido` (B25), **de caixa** |
| 2 | Deduções, Custos de vendas, Despesas gerais, Impostos | `CLASS. CONTABIL` (I) e `SUB 2` (J): `DEVOLUCÃO`; `COMPRAS DE MERCADORIAS` + `FRETE E CARRETO` + `ARMAZENAGEM E MANUSEIO`; `FORNECEDORES G&A`; `IMPOSTOS E CONTRIBUIÇÕES` |
| **3** | **nada** | ver abaixo |

**O que fica no Omie, e por quê:**

- **A Tela 3 inteira.** Ela é uma carteira de contas a receber, filtrada por vencimento, status, cliente e categoria,
  com os oito `cStatus` do Omie. O DFC é caixa: registra o que entrou, não a carteira em aberto. A aba `PROVISÃO` tem
  `VALOR RECEBIDO` e `VALIR A RECEBER` por projeto, que é o mesmo assunto, mas é um controle manual de poucas linhas
  (5 em setembro) e não cobre o cadastro de clientes nem os status.
- **O EBITDA da Tela 2**, na parte de depreciação e amortização: nenhuma das duas sai do caixa, então não existe no
  DFC. O resultado financeiro, esse sim, o DFC nomeia (`JUROS`, `RENDIMENTO FINANCEIRO`, `EMPRESTIMO`,
  `TARIFAS BANCÁRIAS`).
- **A quebra por produto** das receitas do DRE: no DFC a linha aponta o projeto (`TITULO`, coluna H), não o produto.
- **Qualquer coisa que dependa de cadastro** — cliente, categoria, departamento, conta do DRE. O DFC não tem cadastro
  de cliente: escreve o nome direto na célula.

**Onde os dois se sobrepõem — e o que ainda não se sabe:**

- Os dois registram **o mesmo pagamento e o mesmo recebimento**, em regime de caixa. De janeiro a setembro de 2026 há
  dois números possíveis para quase todo indicador das Telas 1 e 2. Os dois números foram **postos lado a lado** em
  24/09/2026 por `scripts/confronto-dfc-omie.mjs` (só leitura das duas fontes; as respostas do Omie ficam num cache
  local em `.cache/omie/`, fora do git): mês a mês, entradas e saídas com a diferença em %, a taxa de casamento dos
  lançamentos, o que a coluna `EMP.` do DFC é (ou não é) no Omie, qual fonte classifica mais lançamentos em cada grupo
  das telas e uma **proposta** de fonte principal e confronto para cada indicador com a antiga pendência "Omie ou DFC".
  A página é `docs/confronto-dfc-omie.html` — é onde ficam os valores em reais. **Ela é gerada localmente por `scripts/confronto-dfc-omie.mjs` e não vai para o git** (está no `.gitignore`; para tê-la, rode o script, que a grava nesse mesmo lugar). **Essa
  proposta foi aprovada pelo dono em 24/09/2026** e virou a seção "A escolha entre Omie e DFC" deste documento: as 21
  lacunas "Omie ou DFC" estão fechadas, e a fonte de cada indicador das Telas 1 e 2 está escrita na linha dele. A
  página segue sendo só medição — quem decidiu foi o dono.
- **Não há chave que ligue uma linha do DFC a um título do Omie.** A coluna `TITULO` (H) guarda o número do projeto
  (`aaaammdd-xxxxxxxx`), o número da PO ou o da nota — nenhum deles é o `nCodTitulo` nem o `codigo_pedido` do Omie. A
  única ponte declarada entre os dois é a coluna `OBS GU - OMIE` da aba `CARTÃO DE CRÉDITO`, e ela é uma marca de
  conferência manual, não um código.
- **Três planos de contas convivem**: os dois do Omie (187 códigos, ver "A soma das empresas 1 e 2") e as 69 contas de
  `SUB 2` do DFC, que não usam código nenhum.
- **O recorte de empresa não bate de saída**: as telas somam as filiais `/0001-42` e `/0002-23` do Omie; o DFC separa
  por `B3W` e `N3` e não diz qual é qual. **Esta lacuna está medida, e ela não fecha:** o cruzamento de 27/09/2026
  (`scripts/de-para-empresa-dfc.mjs`) casou 565 linhas `B3W` só com a empresa 1 e 481 só com a empresa 2, por data,
  valor e nome — duas delas no mesmo dia —, então `EMP.` **não é** a filial do Omie. Ver "A coluna `EMP.` não é a filial
  do Omie (cruzamento de 27/09/2026)", acima. O filtro de empresa das três telas vale no lado do Omie e diz, em cada
  número de fonte DFC, que ali não vale.
- **O Omie tem outras unidades de negócio no mesmo CNPJ, e elas não são a MeuBESS** (explicação do dono, 24/09/2026; o DFC das três outras unidades foi lido em 24/09/2026 por `scripts/confronto-dfc-omie.mjs`, só leitura, e está em `docs/confronto-dfc-omie.html` (página local, fora do git)). **O único campo do Omie que separa é a conta corrente** (`detalhes.nCodCC`). Departamento **não** separa (a árvore inteira pende de uma raiz só, `MEU BESS`, e os filhos são setores), categoria, projeto e vendedor também não. **Esta lacuna está fechada:** o dono disse de que negócio é cada conta corrente, a lista está em `dados/contas-correntes-por-negocio.json` e é ela que as telas aplicam — ver "O recorte da MeuBESS: quais contas correntes são dela", logo abaixo. Nenhuma outra lacuna deste documento mudou, e nenhuma fonte foi trocada por causa disto.

### O recorte da MeuBESS: quais contas correntes são dela

**De onde vem a lista.** Do dono, em 24/09/2026, em resposta à pergunta de que negócio é cada conta corrente da tabela da
seção 4 de `docs/confronto-dfc-omie.html` (página local, fora do git). **Não** foi deduzida de movimento, de nome de banco nem de
nenhuma leitura: o Omie só forneceu o cadastro das contas (`nCodCC`, `descricao`, `codigo_banco`, `tipo_conta_corrente`,
`inativo`), por `geral/contacorrente` → `ListarContasCorrentes` nas duas chaves, só leitura.

**Onde ela mora.** Em [`dados/contas-correntes-por-negocio.json`](../dados/contas-correntes-por-negocio.json) — é de lá que o
código dos dashboards lê, e é de lá que `scripts/confronto-dfc-omie.mjs` lê. Uma linha por conta do cadastro do Omie (43 linhas,
somando as duas empresas), com a chave `empresa|nCodCC`, a descrição ao lado e o campo `negocio`. `recorte_das_telas` diz qual
negócio as telas mostram: `MeuBESS`.

| negócio | o que o dono disse | contas |
|---|---|---|
| **MeuBESS** — o recorte das telas | Itaú (empresas 1 e 2), Cora, cartão Itaú 1106, Banco Implementação, Adiantamento de Cliente, Stone, Banco do Brasil (empresas 1 e 2), Caixinha e — desde 25/09/2026 — `Adiantamento ao Fornecedor` (as duas) | 16 |
| MX3 | todas as contas Sicoob, inclusive a `Sicoob - B3N`, e o cartão Itaú 6826 | 5 |
| 3N Capital | Safra e o cartão Itaú 9120 | 3 |
| **sem dono dito** | o que o dono não citou | 19 |

**Como as telas aplicam.** Toda leitura de `financas/mf` das Telas 1 e 2 guarda só os lançamentos cujo `detalhes.nCodCC` está na
lista com `negocio = "MeuBESS"`. Conta **sem dono dito** fica **fora** do recorte, e o código **não adivinha pelo nome do banco**:
conta corrente nova aparece no cadastro do Omie sem dono e fica fora do número da tela até o dono dizer de quem é. Das contas com
movimento em 2026, seguem sem dono dito `Santander` (empresa 1), `Aplicação financeira Banco do Brasil` (empresa 1),
`CARTÃO B3W CORA (4309)` (empresa 1) e `Bradesco` (empresa 1) — quatro, e não mais cinco: as duas
`Adiantamento ao Fornecedor` saíram desta lista em 25/09/2026, quando o dono disse que são da MeuBESS (ver a seção sobre ela,
acima, e o filtro que veio junto).

**O que o recorte mede** (números refeitos em 25/09/2026, pelo cache da leitura do Omie de 24 e 25/09/2026, janeiro a setembro;
página regerada). O corte por conta corrente **sozinho** pega 1.939 dos 2.148 lançamentos do Omie no período (90,3%) e 99,4% do
dinheiro movimentado — eram 1.938 e 99,3% antes de as duas contas `Adiantamento ao Fornecedor` entrarem na lista, em 25/09/2026.
**Somando o filtro do adiantamento** (o par `ADCP`/`ADCR`, decidido no mesmo dia), saem mais 53 lançamentos, todos de conta da
MeuBESS, e sobram **1.886 (87,8%) e 89,5% do dinheiro**. A queda no dinheiro é esperada e não é perda de informação: adiantamento
a fornecedor é valor graúdo em poucos lançamentos, e esse dinheiro volta a contar quando o fornecedor é pago, pelo título da nota.
Do lado do casamento com o DFC, a taxa do lado do Omie vai de 59,4% (sem recorte, contra o CNPJ inteiro) para **65,7%** com os dois
cortes (era 65,3% com o recorte sozinho). A leitura empírica da página — que marca cada conta pela unidade do DFC com que os
lançamentos dela casaram — **concorda com a lista do dono em todas as contas que ela consegue julgar, e não a contradiz em
nenhuma**; nas contas pequenas ela não tem casados suficientes para opinar, e quem responde é o dono.

**O que o recorte não resolve, e não é lacuna deste documento.** Ele acaba com a contaminação (o número do Omie deixa de ser o do
CNPJ inteiro) e **não** aproxima as duas fontes: com os dois lados só da MeuBESS, o DFC fica acima do Omie do lado das saídas em
**7 dos 7 meses comparáveis** — eram 6 dos 7 antes do filtro do adiantamento, e o mês que virou foi **março**, o único em que o
Omie estava acima (a diferença das saídas em março saiu de −30,1% para +43,1%, sem contar transferências de −37,4% para +28,2%).
Os 53 lançamentos que o filtro tira são todos de fevereiro a agosto (1 em fevereiro, 24 em março, 14 em abril, 4 em maio, 2 em
junho, 7 em julho e 1 em agosto), então janeiro e setembro não mudaram nada.
A causa é o filtro `cTpLancamento: "CPCR"` e a cobertura do ano, medidos nas seções 4, 5 e 7 da página —
e a escolha entre as duas fontes **foi feita pelo dono em 24/09/2026**, sobre esses mesmos números — ver "A escolha
entre Omie e DFC", logo abaixo. Ela não apaga a diferença: escolhe de qual lado vem o número da tela e manda o outro
lado para o selo de confronto. A Tela 3 lê
títulos (`financas/contareceber`), não movimentos, e o recorte dela não fazia parte desta rodada.

### A escolha entre Omie e DFC (decisão do dono, 24/09/2026)

**O que foi decidido.** Em 24/09/2026 o dono aprovou, em uma palavra ("sim"), a proposta da seção 7 de
`docs/confronto-dfc-omie.html` (página local, fora do git) (commit `4c20aad`). Com isso **as 21 lacunas "Omie ou DFC"
das Telas 1 e 2 estão fechadas**: cada indicador tem agora uma fonte principal — o número que aparece na tela — e uma
fonte de confronto — o número que alimenta o selo. As duas estão escritas na linha de cada indicador, mais abaixo.
Esta seção é o resumo; a linha do indicador é o contrato.

**A regra, em uma frase.** Onde o número é **dinheiro que entrou e saiu**, a planilha DFC da pasta da MeuBESS é a
principal e o Omie recortado é o confronto. Onde o número precisa de **categoria, cliente, conta do DRE ou carteira em
aberto**, o Omie recortado pelas contas de [`dados/contas-correntes-por-negocio.json`](../dados/contas-correntes-por-negocio.json)
é o principal e o DFC é o confronto.

Três motivos sustentam a regra, e os três saem de medição, não de preferência:

1. **onde a classificação decide o número, o DFC leva** — ele escreve a classe na própria linha (`CLASS. CONTABIL` e
   `SUB 2`), e o Omie não marca pessoal, dedução, COGS nem imposto;
2. **onde o cadastro decide, o Omie leva** — ele tem cliente, categoria, departamento, conta do DRE, status e
   pagamento parcial, e o DFC escreve o nome direto na célula;
3. **onde a completude do período decide, o DFC leva** — no recorte da MeuBESS o Omie tem 3 e 14 lançamentos pagos em
   janeiro e fevereiro, contra 413 e 420 linhas no DFC; para a série de 2026 inteiro, a única fonte que cobre o ano é
   o DFC.

**As 21 linhas.** Sete mudaram de fonte nesta decisão, todas do Omie para o DFC e todas em número de caixa:

| tela | indicador | principal | confronto | mudou? |
|---|---|---|---|---|
| 1 | Saldo | DFC | Omie recortado | mudou — era Omie |
| 1 | Receitas | DFC | Omie recortado | mudou — era Omie |
| 1 | Despesas | DFC | Omie recortado | não |
| 1 | Despesas pagas | DFC | Omie recortado | mudou — era Omie |
| 1 | Despesas pendentes | **Omie recortado** | DFC (só jan–set) | não |
| 1 | Despesas com funcionários | DFC | Omie recortado, por categoria de pessoal | não |
| 1 | % desp. funcionários / receita líquida | DFC nas duas pontas | a mesma conta no Omie recortado | mudou — era DFC ÷ Omie |
| 1 | Top 10 despesas | DFC | Omie recortado, por centro de custo | não |
| 1 | Top 10 receitas | **Omie recortado** | DFC | não |
| 1 | Receita × despesa por dia | DFC | Omie recortado | mudou — era Omie |
| 1 | Receita × despesa por mês | DFC | Omie recortado | mudou — era Omie |
| 2 | Receita total | DFC | Omie recortado | mudou — era Omie |
| 2 | Custos e despesas | DFC (separa COGS de G&A) | Omie recortado | não |
| 2 | EBITDA | **Omie recortado** | DFC só no resultado financeiro | não |
| 2 | Lucro líquido | **Omie recortado** | DFC (lucro de caixa, `B25`) | não |
| 2 | Margem de lucro | **Omie recortado** | DFC | não |
| 2 | (+) Receitas | **Omie recortado** | DFC | não |
| 2 | (−) Deduções | DFC | Omie recortado (`cOperacao` 13 e a lista de categorias do dono) | não |
| 2 | (−) Custos de vendas | DFC | Omie recortado, pela lista de categorias que o dono decidiu (25/09/2026) | não |
| 2 | (−) Despesas gerais | **Omie recortado** (quebra por categoria) | DFC por `SUB 2` | não |
| 2 | (+/−) Resultado financeiro | **Omie recortado** (lista de categorias que o dono decidiu em 25/09/2026) | DFC por `SUB 2` | não |
| 2 | (−) Impostos pagos (guias) | DFC (guias pagas) | Omie recortado (categorias de imposto: `2.06.05`, `2.06.06`, `2.06.07`, `2.03.06`, `2.01.92`) | não |

**O selo de confronto, em uma regra só** (aprovado como está, na mesma resposta). Todo cartão e toda linha de DRE com
fonte principal e confronto mostra o número da **fonte principal**. Ao lado do valor, um selo pequeno:

- **sem selo** quando a diferença contra a outra fonte fica em até **2%** — é ruído de arredondamento e de data de
  baixa;
- selo âmbar **"confere: X%"** entre **2% e 5%**, com o valor da outra fonte no tooltip;
- selo vermelho **"diverge: X%"** acima de **5%**, que abre a lista dos lançamentos sem par naquele mês.

De **outubro a dezembro o selo não aparece**: ali o DFC só tem provisão, e comparar seria comparar com nada. Não há
selo cinza "sem recorte" — ele existia para avisar que o número do Omie incluía as outras unidades de negócio, e com a
lista do dono aplicada ele não inclui mais; no lugar dele, o rodapé da tela diz de onde vem o recorte e quando a lista
foi atualizada, e as contas **sem dono dito** ficam fora do número, nenhuma entrando silenciosamente. Enquanto a
diferença do filtro `cTpLancamento: "CPCR"` não for explicada (seção 5 da página do confronto), o selo vermelho vai
acender com frequência — **isso é o selo funcionando, não o selo quebrado**.

**Duas consequências da decisão, para o dono ver.** Nenhuma das duas é escolha nova; as duas saem da aritmética de
escolher fonte linha a linha, e nenhuma delas foi decidida aqui:

- **Duas linhas somadas da Tela 2 passam a misturar as fontes** — "(=) Receita líquida" (receita bruta do Omie menos
  deduções do DFC) e, por arrasto, "(=) Lucro bruto". Se o dono preferir as linhas somadas de uma fonte só, é dizer.
- **O cartão "Receita total" da Tela 2 deixa de ser a soma da linha "(+) Receitas" da tabela** — o cartão é do DFC (é
  caixa, e precisa cobrir o ano) e a linha é do Omie (é a única que tem a categoria de cada lançamento, e é por ela
  que a linha se divide entre "vendas de produtos" e "outras receitas"). O cartão bate com o de
  "Receitas" da Tela 1, que é o que as duas telas precisam mostrar igual.

**O que esta decisão não fecha.** Ela escolhe **de onde vem** cada número, não **o que** cada número mede. As duas
dúvidas de medida que ela deixou abertas — a quebra entre "outras receitas" e "vendas de produtos" e como repartir o
valor de um título entre os produtos — o dono respondeu no dia seguinte, em 25/09/2026 (ver a lista abaixo e a linha
"(+) Receitas" da Tela 2). Várias delas encolheram antes disso — passaram a valer só para a coluna de confronto, porque
no lado principal a classificação já vem escrita na linha do DFC —, mas nenhuma foi respondida por esta decisão.

**Já respondidas pelo dono depois desta decisão,** cada uma escrita na linha do indicador: quais categorias do Omie são
dedução da receita (24/09/2026), custo de vendas e resultado financeiro (25/09/2026), o que aparece como "descrição" no Top 10 receitas
e na Lista de títulos (25/09/2026: os produtos do pedido de venda, ou a categoria quando não há pedido), **a divisão da
linha "(+) Receitas" entre "vendas de produtos" e "outras receitas"** (25/09/2026: pela categoria do lançamento, com os
códigos por empresa escritos na linha do indicador — e, com ela, some a dúvida de repartir o valor de um título entre
os produtos do pedido), e o que fazer com depreciação e
amortização (25/09/2026: o Omie não tem categoria delas, então o EBITDA e o lucro líquido saem sem elas, com aviso na
tela), e o que a linha de impostos mede (25/09/2026: só "Impostos pagos (guias)", sem linha de impostos retidos na
nota e sem o ISS retido nas deduções, opção A). As listas por empresa estão em [`docs/categorias-do-dre.html`](categorias-do-dre.html).

## Navegação

As três telas num app só, com menu no topo. A referência da tela 1 mostra também Contas a Pagar, Centro de Custo, Fluxo
de Caixa e Detalhes como abas; ficam de fora até o dono pedir.

---

**De que leitura são as contagens de jan–set citadas daqui para baixo.** Toda contagem de janeiro a setembro escrita nas
linhas das três telas abaixo — "809 títulos + 9 baixas de parcial + 276 avulsos", "os 14 títulos de guia", e as demais —
é da **leitura de referência de 27/09/2026, 09h11–09h17**, a mesma que "A contagem de 2026" cita no começo da Tela 1.
Elas são história e ficam como estão. A contagem de **agora** está em "As contagens de jan–set desta leitura", o bloco
gerado no fim de "Como lemos o Omie": quem o escreve é `scripts/numeros-das-telas.mjs`, na mesma passagem em que grava
`docs/conferencia.md`, então o número deste documento e o da página de conferência são sempre da mesma leitura. Uma
diferença entre as duas colunas não é erro: o app relê o Omie de hora em hora e o Omie recebe lançamento com data
retroativa, então um mês já passado muda de contagem sozinho. O que **não** pode mudar sozinho é agosto de 2026, e é
`docs/trava-agosto-2026.json` que o fixa — os baldes do mês, as faixas da Tela 3, a identidade de cada caso real
conferido e a impressão digital dos campos de cadastro de todos os lançamentos do mês. Se algum deles mudar, a
conferência para e não grava nada.

---

## Tela 1 — Gestão de Contas (visão geral)

Referência: `referencias/tela-1-gestao-de-contas.jpg`

**Filtros (valem para a tela inteira):** ano · mês (jan–dez) · centro de custo (seleção múltipla) · **empresa**.

**E o filtro de EMPRESA (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas** — o primeiro filtro que
atravessa as três telas. Ele escolhe quais das filiais `/0001-42` e `/0002-23` entram na soma que estas telas sempre
fizeram; as duas, ou nenhuma escolha, é a soma de sempre. No lado do Omie ele vale em toda contagem, no "Top 10
receitas" (que é do Omie) e no cartão "Despesas pendentes" inteiro. **No lado do DFC não vale**, e o número diz isso
ao lado: a coluna `EMP.` (`B3W` / `N3`) não é a filial do Omie — ver "A coluna `EMP.` não é a filial do Omie
(cruzamento de 27/09/2026)", acima. Onde cada um vale, cartão por cartão, está em [`docs/filtros.md`](filtros.md).

O filtro de centro de custo é aplicado no app sobre `movimentos[].departamentos[].nDistrValor`, porque a API não filtra
por departamento; **as opções do filtro são os nomes dos departamentos, juntando as empresas 1 e 2 pelo nome, com o
`cCodDepartamento` de cada empresa por trás** (decisão do dono, 25/09/2026). **Regime de caixa (decisão do dono, 23/09):** cada lançamento conta no mês em que foi pago ou recebido.
O período de todos os cartões e dos gráficos é filtrado pela data de pagamento do Omie, `dDtPagtoDe` / `dDtPagtoAte`
(formato `dd/mm/aaaa`; a contagem de `scripts/contar-omie-filtros.mjs` mostrou que o Omie aplica esse filtro, não o
ignora). Única exceção: "Despesas pendentes", que por definição ainda não têm pagamento e usam o vencimento.

**O que o filtro de data de pagamento não traz (conferido no cache local em 25/09/2026, sem chamar a API):** com `dDtPagtoDe` / `dDtPagtoAte`, o
`ListarMovimentos` só devolve a linha `CONTA_A_RECEBER` / `CONTA_A_PAGAR` do título **já liquidado** — as 1.031 linhas de título
da empresa 1 e as 1.117 da 2 vieram todas com `resumo.cLiquidado = "S"`, e nenhuma com `cStatus` de parcial. O título baixado
**em parte** (`cLiquidado = "N"`) não aparece como título: dele vem só a **baixa** de conta corrente (`CONTA_CORRENTE_REC` /
`CONTA_CORRENTE_PAG` com `nCodTitulo` preenchido), uma linha por baixa. No recorte da MeuBESS, em 2026, são 8 baixas de títulos a
pagar na empresa 1, em 8 títulos, e 24 de títulos a receber na empresa 2, em 12 títulos (de 1 a 4 baixas cada): 11 desses 12
seguiam com saldo em aberto e 1 foi quitado depois da leitura, por isso também ficou sem a linha de título. Por
isso a regra de não contar duas vezes, abaixo, guarda essa baixa: descartá-la fazia o pagamento parcial sumir da conta. A baixa
traz `cCodCateg`, mas não `nCodOS`, `categorias[]` nem `departamentos[]` — quem os tem é o título, que esta leitura não devolve.
**A leitura do título a pagar inteiro — feita em 25/09/2026, das 15h23 às 15h24 (só leitura; `financas/pesquisartitulos` →
`PesquisarLancamentos`, `cNatureza = "P"`, em duas passadas, `dDtVencDe` / `dDtVencAte` e `dDtEmisDe` / `dDtEmisAte` de
01/01 a 31/12/2026, com as chaves `OMIE_MEUBESS_1` e `OMIE_MEUBESS_2`; a leitura ficou no cache local `.cache/omie/`,
fora do git):** empresa 1, 1.518 títulos a pagar de 2026 (1.507 por vencimento, 1.438 por emissão, 11 só por emissão),
1.380 no recorte da MeuBESS; empresa 2, 1.087 títulos (1.086 e 1.064, 1 só por emissão), 1.084 no recorte de então — 1.085 com a conta `Adiantamento ao Fornecedor`, que entrou no recorte em 25/09/2026 e tem 1 título a pagar de 2026, já pago. As duas
passadas juntas cobrem tudo o que a leitura por data de pagamento traz: os 823 títulos de despesa da empresa 1 e os 591
da 2 que aparecem nela, no recorte da MeuBESS e em 2026, estão todos aqui — nenhum título pago em 2026 tem vencimento
**e** emissão fora de 2026. **Títulos a pagar em parte pagos, com pagamento em 2026: 6 na empresa 1 e 3 na 2.** Nenhum
dos nove vem com `cStatus = "PAGTO_PARCIAL"` — todos vêm como `"PAGO"`, e quem os identifica é `resumo.cLiquidado = "N"`
com `resumo.nValPago` acima de zero e uma baixa em `lancamentos[]` (uma cada). **Quantos a regra nova já pega:** na
empresa 1, 5 dos 6, como baixa de conta corrente; o sexto (`nCodTitulo` 6051143704) ficou de fora só porque foi baixado
em 24/09/2026, depois da leitura daquele dia (14h46) — não aparece nela em conta nenhuma. Na empresa 2, os 3
(`nCodTitulo` 5228016911, 5232855897 e 5237326453) ficavam de fora porque a baixa dos três saiu de conta corrente **sem
dono dito** em `dados/contas-correntes-por-negocio.json` — a conta `Adiantamento ao Fornecedor` —, ainda que o
`cabecTitulo.nCodCC` do título fosse de conta da MeuBESS: quem os deixava de fora era o recorte por conta corrente, não
a regra de não contar duas vezes. **Em 25/09/2026 o dono disse que essa conta é da MeuBESS** (opção A; ver "A conta Adiantamento ao Fornecedor", acima) e os 3 passaram a entrar, como baixa de parcial. Agora a regra nova pega **8
dos 9**: 5 dos 6 da empresa 1 e os 3 da 2; o único de fora segue o sexto da empresa 1. **Nas contagens das linhas de
despesa:** esta leitura confirma as 8 baixas de título a pagar da empresa 1, em 8 títulos (cinco seguem em parte pagos e
três foram quitados depois da leitura de 24/09), e as 3 da empresa 2, em 3 títulos, que eram 0 antes da decisão de
25/09.

**Cartões no topo (linha de 7):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Saldo | **DFC** / confronto: Omie recortado | **Principal — DFC:** aba `FLUXO DE CAIXA` do arquivo do mês, na pasta do DFC **da MeuBESS**: `ENTRADA` (K) menos `SAIDA` (L), pelo mês de `DIA PG` (F). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CPCR` traz só os títulos e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo` em `CONTA_CORRENTE_PAG` e `CONTA_CORRENTE_REC`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, fora os `detalhes.cStatus = "CANCELADO"` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"` em `dados/contas-correntes-por-negocio.json`; separa entrada de saída por `detalhes.cNatureza`. **Sem contar duas vezes:** o título baixado volta na mesma leitura como `CONTA_A_PAGAR` / `CONTA_A_RECEBER` e como `CONTA_CORRENTE_PAG` / `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o título, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): nas saídas, empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094, e empresa 2, 556 + 3 + 547 = 1.106; nas entradas, empresa 1, 9 + 0 + 162 = 171, e empresa 2, 536 + 25 + 611 = 1.172 — as entradas não mudam com a conta `Adiantamento ao Fornecedor`: as 11 da empresa 1 e as 44 da 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. Selo ao lado do valor acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | receitas − despesas do período | |
| Receitas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, coluna `ENTRADA` (K), somada pelo mês de `DIA PG` (F), **fora as linhas cujo `SUB 2` (J) é `TRANSFERENCIAS BANCARIAS - RECEITA` — decisão do dono, 27/09/2026: transferência entre contas não é receita**, pelo mesmo motivo da decisão de 25/09/2026 sobre as categorias de transferência do Omie (ver "As categorias de transferência", acima): o dinheiro entra numa conta e sai de outra, e somar as duas pontas infla a receita. No lado do Omie essas linhas já saíam desde 25/09/2026, pela categoria; no DFC a marca é o `SUB 2` da própria linha, e este cartão ainda as contava. **É o que faltava para as duas telas darem o mesmo número:** em agosto de 2026 eram **107** linhas de entrada aqui contra **101** em "Receita total" da Tela 2, e as **6** de diferença eram todas desse `SUB 2`; com elas fora, os dois cartões contam **101** linhas do DFC. A regra mora num lugar só, `eReceitaTela1Dfc` em `lib/regras/dfc.mjs`. O corte é pelo `SUB 2`, que é o que a decisão nomeia, e **não** pelo `CLASS. CONTABIL` (I): linha de entrada com `CLASS. CONTABIL` = `TRANSFERENCIA` mas `SUB 2` de receita (`OUTRAS RECEITAS`, `RECEITA COM VENDAS`) continua contando — em 2026 são 4 linhas, nenhuma em agosto. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CR` traz só os títulos a receber e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_REC"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, guardando `detalhes.cNatureza = "R"`; soma `detalhes.nValorTitulo` no título e `resumo.nValPago` no avulso, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), com o recorte da MeuBESS por `detalhes.nCodCC`. **Sem contar duas vezes:** o título recebido volta na mesma leitura como `CONTA_A_RECEBER` e como `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_RECEBER`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): empresa 1, 9 títulos + 0 baixas de parcial + 162 avulsos = 171 lançamentos; empresa 2, 536 + 25 + 611 = 1.172 — a conta `Adiantamento ao Fornecedor`, que entrou no recorte em 25/09/2026, **não mexe nestes números**: as 11 entradas dela na empresa 1 e as 44 na 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das receitas do período | |
| Despesas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, coluna `SAIDA` (L), pelo mês de `DIA PG` (F) — a classificação vem escrita na própria linha. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, guardando `detalhes.cNatureza = "P"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), com o recorte da MeuBESS por `detalhes.nCodCC`. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094 lançamentos; empresa 2, 556 + 3 + 547 = 1.106. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das despesas do período | |
| Despesas pagas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) das linhas com `PAGAMENTO` (N) = `PAGO`, pelo mês de `DIA PG` (F). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, guardando `detalhes.cNatureza = "P"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima); soma `resumo.nValPago` dos três (no título ele é o valor já quitado — o pagamento parcial **não** vem como título nesta leitura, ao contrário do que esta linha dizia até 25/09/2026; na baixa de parcial e no avulso é o próprio valor do movimento), com o recorte da MeuBESS por `detalhes.nCodCC`. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094 lançamentos; empresa 2, 556 + 3 + 547 = 1.106. O `nValPago` é o único dos dois lados que separa o pagamento parcial — por isso ele entra no **tooltip** do cartão, e não como número da tela; nesta leitura o parcial vem pela baixa de conta corrente, não pelo título. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas com baixa no período | |
| Despesas pendentes | **Omie recortado** / confronto: DFC (só jan–set) | **Principal — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtVencDe` / `dDtVencAte` no mês (exceção ao caixa: sem baixa não há data de pagamento) e `resumo.cLiquidado = "N"` (equivale a `cStatus` em `EMABERTO`, `AVENCER`, `VENCEHOJE`, `ATRASADO`, `PAGTOPARCIAL`); soma `resumo.nValAberto`, com o recorte da MeuBESS por `detalhes.nCodCC`. **Confronto — DFC, só nos meses fechados:** `SAIDA` (L) das linhas com `PAGAMENTO` (N) = `A PAGAR`, pelo mês de `VENCIMENTO` (E) — a mesma exceção ao caixa. De outubro a dezembro o DFC só tem provisão e **não** tem carteira, então o selo aparece só de janeiro a setembro. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas sem baixa, vencendo no período | |
| Despesas com funcionários | **DFC** / confronto: Omie recortado, por categoria de pessoal | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) das linhas de pessoal, pelo mês de `DIA PG` (F) — a classificação já vem na linha, em `CLASS. CONTABIL` (I: `FOLHA, IMPOSTOS E ADIANTAMENTOS`, `PESSOAL PJ`, `DESPESA CLT`, `DESPESA PJ`, `RESCISÃO`) e em `SUB 2` (J: `DESPESAS CLT`, `DESPESAS PJ`, `PRÓ-LABORE ( retirada de sócio )`, `COMISSÃO DE VENDAS`, `REEMBOLSO`). **Confronto — Omie recortado, por categoria de pessoal. Decisão do dono (25/09/2026):** o confronto **não é por departamento**; soma os movimentos **pagos no mês** (caixa) das categorias de pessoal do Omie — folha, pró-labore, encargos —, **em qualquer departamento**. `financas/mf` → `ListarMovimentos` **sem** `cTpLancamento` (o `CP` só traz os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`), `dDtPagtoDe` / `dDtPagtoAte` no mês, guardando `detalhes.cNatureza = "P"` e `detalhes.cStatus = "PAGO"`, com o recorte da MeuBESS por `detalhes.nCodCC` aplicado antes. **Sem contar duas vezes:** todo título a pagar pago aparece duas vezes, como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, e do `CONTA_CORRENTE_PAG` só entra o que não tem `CONTA_A_PAGAR` com o mesmo `nCodTitulo` (o avulso, contado uma vez por `detalhes.nCodMovCC`). Guarda os lançamentos cujo `detalhes.cCodCateg` está na lista abaixo, da empresa a que o lançamento pertence, e soma `resumo.nValPago`. A lista vem do plano de categorias no cache local (`geral/categorias` → `ListarCategorias`, empresas 1 e 2), casada **pelo nome** com as classificações de pessoal do DFC (`FOLHA, IMPOSTOS E ADIANTAMENTOS` = salários, adiantamento, férias, 13º, INSS, FGTS, IRRF e pensão; `PESSOAL PJ` e `DESPESA PJ` = ajuda de custo de PJ e terceiros e estagiários; `DESPESA CLT` = benefícios; `RESCISÃO`; `PRÓ-LABORE`; `COMISSÃO DE VENDAS`). **Empresa 1 (filial /0001-42):** `2.03.01` Salários e Ordenados - Adm · `2.03.02` Adiantamento de Salário- Adm · `2.03.03` Férias- Adm · `2.03.04` Rescisões- Adm · `2.03.05` 13º Salário- ADM · `2.03.06` INSS- ADM · `2.03.07` FGTS- ADM · `2.03.08` IRRF S/ Salários- Adm · `2.03.09` Pensão Alimentícia - Adm · `2.03.10` Assistência Médica e social -Adm · `2.03.11` Vale Transporte- Adm · `2.03.12` Vale Refeição-Adm · `2.03.13` Seguro de Vida-Adm · `2.03.14` Outros Benefícios- ADM · `2.03.97` Mensalidade/Contribuição Sindical- Adm · `2.03.98` Uniformes e equipamentos de Segurança -Adm · `2.03.99` Terceiros e Estagiários- ADM · `2.11.96` Pró-Labore · `2.02.01` Desp com Rep. Comercial- COMISSÕES s/ vendas · `2.02.02` Desp com Rep. Comercial - AJUDA DE CUSTO PJS · e as de pessoal lançadas como custo, `2.01.81` a `2.01.97`: `2.01.81` Mensalidade/Contribuição Sindical-  Custo (estoque) · `2.01.82` Uniformes e equipamentos de Segurança - Custo (estoque) · `2.01.83` Terceiros e Estagiários-  Custo (estoque) · `2.01.84` Outros Benefícios-  Custo (estoque) · `2.01.85` Seguro de Vida- Custo (estoque) · `2.01.86` Vale Refeição- Custo (estoque) · `2.01.87` Vale Transporte- Custo (estoque) · `2.01.88` Assistência Médica e social - Custo (estoque) · `2.01.89` Pensão Alimentícia- Custo (estoque) · `2.01.90` IRRF S/ Salários-  Custo (estoque) · `2.01.91` FGTS-  Custo (estoque) · `2.01.92` INSS-  Custo (estoque) · `2.01.93` 13º Salário- Custo (estoque) · `2.01.94` Rescisões- Custo (estoque) · `2.01.95` Férias - Custo (estoque) · `2.01.96` Adiantamento de Salário (custo) · `2.01.97` Salários - Custo (estoque). **Empresa 2 (filial /0002-23):** `2.03.01` Salários e Ordenados - Adm · `2.03.02` Adiantamento de Salário · `2.03.03` Férias- Adm · `2.03.04` Rescisões- Adm · `2.03.05` 13º Salário- Adm · `2.03.06` INSS- Adm · `2.03.07` FGTS- Adm · `2.03.08` IRRF S/ Salários- Adm · `2.03.09` Pensão Alimentícia · `2.03.10` Assistência Médica e social -Adm · `2.03.11` Vale Transporte- Adm · `2.03.12` Vale Refeição-Adm · `2.03.13` Seguro de Vida-Adm · `2.03.14` Outros Benefícios · `2.03.97` Mensalidade/Contribuição Sindical-ADM · `2.03.98` Uniformes e equipamentos de Segurança -Adm · `2.03.99` Terceiros e Estagiários- ADM · `2.02.01` Desp repr. Comercial- COMISSÕES s/ vendas · `2.02.02` Desp com Rep. Comercial - AJUDA DE CUSTO PJS · `2.08.01` Adiantamento/Retirada de Sócio (**decisão do dono, 25/09/2026:** na empresa 2 conta como pró-labore e entra na soma de pessoal; a empresa 1 tem o próprio pró-labore, `2.11.96`, e o `2.08.01` dela segue em dúvida). A empresa 2 não tem categoria de pessoal como custo. **Em dúvida (o nome não deixa claro se é pessoal), fora da soma:** empresa 1 — `2.03.96` Acordo Trabalhista · `2.02.93` Indicação - comissão · `2.02.03` Desp com Repres. Coml -REPASSES · `2.01.78` Recarga Celular · `2.01.79` Sistema de Ponto · `2.04.90` Serviços de Terceiros - PJ ADM · `2.08.01` Adiantamento/Retirada de Sócio; empresa 2 — `2.02.03` Desp com Repres. Coml -REPASSES · `2.11.98` Seguro de Vida - Diretoria. Algumas categorias de custo (`2.01.xx`) também estão no custo de vendas do DRE; cada tela usa a sua conta. **Contagem com esse filtro** (cache da leitura de 24/09/2026, 14h47 às 14h49, jan–set/2026, recorte da MeuBESS, só contagem): 253 lançamentos pagos nas categorias da lista na empresa 1 (221 títulos a pagar, 1 baixa de título pago em parte e 31 avulsos) e 322 na empresa 2 — 1 título a pagar, 0 baixas de título pago em parte e 321 avulsos, dos quais 265 são do `2.08.01` (a empresa 2 contava 57 antes da decisão de 25/09/2026, sem o `2.08.01`: 1 título, 0 baixas e 56 avulsos); na empresa 2 quase todo o pessoal é avulso de conta corrente. O DFC segue como fonte principal do cartão; a classificação já está escrita na linha dele. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas de pessoal do período (no DFC, pela classificação da linha; no confronto, pelas categorias de pessoal do Omie) | |
| % desp. funcionários / receita líquida | **DFC nas duas pontas** / confronto: a mesma conta no Omie recortado | **Principal — DFC:** numerador, a linha acima. Denominador, a receita líquida do mesmo mês de caixa montada no DFC — `ENTRADA` (K) das linhas de receita menos as linhas de dedução (`SUB 2` (J) = `DEVOLUCÃO`, `CLASS. CONTABIL` (I) = `ESTORNO`) —, que é a linha "(=) Receita líquida" da Tela 2. **Confronto:** a mesma razão feita toda no Omie recortado; o selo herda a **maior** das duas diferenças. As duas pontas passam a vir da mesma fonte e do mesmo recorte, que era o defeito antigo desta linha. Quais categorias são dedução: **decisão do dono (24/09/2026)**, a lista de 11 códigos, com os códigos por empresa, registrada na linha "(−) Deduções" da Tela 2 (ICMS, PIS, COFINS, devoluções de vendas e Reembolso por cancelamento; o ISS retido saiu da lista em 25/09/2026). Ela pesa no denominador do **confronto** do Omie; no número da tela não, porque no DFC a dedução vem marcada na própria linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | desp. funcionários ÷ receita líquida | |

Mais um botão **Fluxo de caixa** (leva à visão de fluxo, fora do escopo agora).

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Top 10 despesas | barras horizontais | as 10 maiores despesas do período, por classificação | **DFC** / confronto: Omie recortado, por centro de custo | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) no período do filtro por `DIA PG` (F), agrupada por `CLASS. CONTABIL` (I — 24 valores na leitura de setembro) ou por `SUB 2` (J — as 69 contas da aba `BASE`); pega as 10 maiores. No DFC cada linha tem **uma** classificação só, então não há rateio a repartir. **Confronto — Omie recortado, por centro de custo,** num seletor "ver por centro de custo (Omie)" ao lado do título: `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`), `dDtPagtoDe` / `dDtPagtoAte` no período e `cExibirDepartamentos: "S"`, guardando `detalhes.cNatureza = "P"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima). **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094 lançamentos; empresa 2, 556 + 3 + 547 = 1.106. O avulso não traz `departamentos[]` — nenhum dos 272 avulsos e das 8 baixas de parcial da empresa 1, nem dos 539 avulsos e das 3 baixas de parcial da 2 —, então ele cai inteiro na barra "sem centro de custo" descrita abaixo; o recorte da MeuBESS por `detalhes.nCodCC` entra **antes** de agrupar — é o que impede uma despesa grande de outra unidade de subir no Top 10 —, e só então se somam os `departamentos[].nDistrValor` por departamento, **agrupado pelo nome** (`geral/departamentos` → `ListarDepartamentos`, `codigo` → `descricao`), juntando o `cCodDepartamento` de cada empresa sob o mesmo nome (decisão do dono, 25/09/2026). A despesa sem rateio de departamento não fica de fora: aparece numa barra "sem centro de custo", que concorre ao Top 10 como qualquer outro departamento (decisão do dono, 25/09/2026). Vale só para o seletor do Omie; as barras da tela não dependem dela. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| Top 10 receitas | barras horizontais | maiores lançamentos de receita (data, status, descrição) | **Omie recortado** / confronto: DFC | **Principal — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CR` traz só os títulos a receber e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_REC"`) e `dDtPagtoDe` / `dDtPagtoAte` no período do filtro (caixa), guardando `detalhes.cNatureza = "R"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), e só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`; ordena no app por `detalhes.nValorTitulo` no título e por `resumo.nValPago` no avulso; data em `detalhes.dDtVenc` no título e `detalhes.dDtPagamento` no avulso, status em `detalhes.cStatus`. **Sem contar duas vezes:** o título recebido volta na mesma leitura como `CONTA_A_RECEBER` e como `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_RECEBER`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): empresa 1, 9 títulos + 0 baixas de parcial + 162 avulsos = 171 lançamentos; empresa 2, 536 + 25 + 611 = 1.172 — a conta `Adiantamento ao Fornecedor`, que entrou no recorte em 25/09/2026, **não mexe nestes números**: as 11 entradas dela na empresa 1 e as 44 na 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. O avulso não nasce de pedido de venda (`nCodOS` vazio nos 159 da empresa 1 e nos 607 da 2), e a baixa de parcial também vem sem `nCodOS` (as 24 da empresa 2), então ele entra pelo valor e a descrição dele é a da categoria (regra da decisão de 25/09/2026, abaixo). Aqui quem decide é o **cadastro** — cliente e pedido de venda —, que só o Omie tem; e é exatamente aqui que um cliente de outra unidade apareceria nomeado no Top 10 da MeuBESS, o que o recorte impede. **"Descrição":** o título do Omie não tem campo de descrição, mas o pedido de venda que o originou tem — o elo é `detalhes.nCodOS` do lançamento, que é o `cabecalho.codigo_pedido`, e com ele `produtos/pedido` → `ConsultarPedido` traz `det[].produto.descricao` (com `codigo_produto`) e `cabecalho.numero_pedido` (= `detalhes.cNumOS`). **Confronto — DFC:** as linhas de `FLUXO DE CAIXA` com `CLASS. CONTABIL` (I) = `RECEITA DE CLIENTE`, ordenadas por `ENTRADA` (K); a descrição do confronto vem da própria linha, sem passar pelo pedido de venda — `FORNECEDOR / CLIENTE` (G), o número do projeto em `TITULO` (H) e o texto livre de `OBS:` (Q). **Decisão do dono (25/09/2026, opção 1 da página `docs/descricao-do-titulo.html`):** a descrição é a dos produtos do pedido de venda ligado pelo `nCodOS` (`det[].produto.descricao`); pedido com vários produtos mostra a descrição do primeiro `det[]`, na ordem do pedido, seguida de "+N" com o número de produtos que ficaram de fora (um produto só: sem sufixo). **Sem pedido** (`nCodOS` vazio), a descrição é a `descricao` da categoria em `geral/categorias` → `ListarCategorias`: os títulos lançados à mão (`cOrigem = "MANR"`, 7 em 100 na amostra) e os recebimentos avulsos de conta corrente, que não têm `nCodOS`; a categoria nunca vem vazia. Isso resolve a parte (b) da antiga lacuna (receita sem pedido). **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207); o número da tela, não |
| Receita × despesa por dia | colunas (receita acima, despesa abaixo) | totais diários no mês escolhido | **DFC** / confronto: Omie recortado | **Principal — DFC:** aba do mês do arquivo da pasta da MeuBESS (`JANEIRO2026`, `FEVEREIRO`, `Mrço2026`, ` 2026` de abril em diante), linhas `Entradas` (43) e `Gastos` (44), uma coluna por dia de `D` a `AH`, com `Inicial` (42) e `Final` (45) do dia — o bloco já existe pronto na planilha, e com ele o gráfico deixa de sumir em janeiro e fevereiro. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CPCR` traz só os títulos e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo` em `CONTA_CORRENTE_PAG` e `CONTA_CORRENTE_REC`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), com o recorte da MeuBESS por `detalhes.nCodCC`; agrupa pelo dia de `detalhes.dDtPagamento` e separa por `detalhes.cNatureza`. **Sem contar duas vezes:** o título baixado volta na mesma leitura como `CONTA_A_PAGAR` / `CONTA_A_RECEBER` e como `CONTA_CORRENTE_PAG` / `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o título, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): nas saídas, empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094, e empresa 2, 556 + 3 + 547 = 1.106; nas entradas, empresa 1, 9 + 0 + 162 = 171, e empresa 2, 536 + 25 + 611 = 1.172 — as entradas não mudam com a conta `Adiantamento ao Fornecedor`: as 11 da empresa 1 e as 44 da 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. O dia com diferença acima de **5%** ganha traço pontilhado. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| Receita × despesa por mês | duas linhas | totais mensais, com seletor de meses anteriores | **DFC** / confronto: Omie recortado | **Principal — DFC:** um arquivo por mês na pasta da MeuBESS, somando as linhas `Entradas` (43) e `Gastos` (44) da aba do mês, na faixa do seletor. É a série do ano inteiro, e **só o DFC cobre o ano** — janeiro a setembro de 2026 com movimento, outubro a dezembro só com provisão (ver "As planilhas de fluxo de caixa (DFC) de 2026"). **Confronto — Omie recortado:** a mesma chamada do bloco de cima com `dDtPagtoDe` / `dDtPagtoAte` cobrindo a faixa do seletor, agrupada por ano-mês de `detalhes.dDtPagamento`, desenhada em cinza claro atrás; a legenda diz a diferença média em %. Somar aqui as quatro pastas do DFC, ou o Omie sem recorte, seria comparar grupo com unidade. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |

**Centros de custo da referência** (a confirmar contra o Omie, em `geral/departamentos` → `ListarDepartamentos`):
assessoria jurídica · depósito · escritório · funcionários do escritório · funcionários de obra · marketing · material
de obra · telefonia · veículos · despesa bancária · despesa com sócios · receita.

---

## Tela 2 — DRE (demonstrativo de resultados)

Referência: `referencias/tela-2-dre.jpg`

**Filtros:** mês (seleção múltipla) · **empresa**. **Botões:** análise horizontal (AH, variação contra o mês
anterior) e análise vertical (AV, peso sobre a receita).

**E o filtro de EMPRESA (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas** — o primeiro filtro que
atravessa as três telas. Ele escolhe quais das filiais `/0001-42` e `/0002-23` entram na soma que estas telas sempre
fizeram; as duas, ou nenhuma escolha, é a soma de sempre. Ele vale nas linhas e nos cartões cuja fonte principal é o
Omie — "(+) Receitas", "(=) Receita bruta", "(−) Despesas gerais", "(+/−) Resultado financeiro", "(=) sem conta" — e
em toda contagem do Omie. **Não vale** nas linhas de fonte DFC (deduções, custos de vendas, impostos pagos) nem nos
dois primeiros cartões do topo, e por consequência as linhas "(=)" que somam as duas fontes ficam com uma ponta
filtrada e a outra não — cada uma diz isso na tela, porque a coluna `EMP.` do DFC não é a filial do Omie (ver o
cruzamento de 27/09/2026, acima). Onde cada um vale está em [`docs/filtros.md`](filtros.md).

A tela inteira sai de uma leitura só: `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CPCR` traz só os títulos e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo` em `CONTA_CORRENTE_PAG` e `CONTA_CORRENTE_REC`) e
`dDtPagtoDe` / `dDtPagtoAte` cobrindo os meses do filtro, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), somando `movimentos[].categorias[].nDistrValor` por `cCodCateg` no título e
`resumo.nValPago` por `detalhes.cCodCateg` no avulso, que não tem `categorias[]`, e jogando cada categoria na
sua linha pelo `codigo_dre` do cadastro (`geral/categorias` → `ListarCategorias`), com a árvore e os sinais de
`geral/dre` → `ListarCadastroDRE` (`nivelDRE`, `sinalDRE`, `totalizaDRE`). AH e AV são calculadas no app, sobre os meses
já somados. **Regime de caixa (decisão do dono, 23/09):** cada lançamento conta no mês em que foi pago ou recebido, e a regra vale
para toda a tabela e os cartões — o filtro de data é o de pagamento do Omie, `dDtPagtoDe` / `dDtPagtoAte` (formato
`dd/mm/aaaa`; a contagem de `scripts/contar-omie-filtros.mjs` mostrou que o Omie aplica esse filtro, não o ignora).

**O que o filtro de data de pagamento não traz (conferido no cache local em 25/09/2026, sem chamar a API):** com `dDtPagtoDe` / `dDtPagtoAte`, o
`ListarMovimentos` só devolve a linha `CONTA_A_RECEBER` / `CONTA_A_PAGAR` do título **já liquidado** — as 1.031 linhas de título
da empresa 1 e as 1.117 da 2 vieram todas com `resumo.cLiquidado = "S"`, e nenhuma com `cStatus` de parcial. O título baixado
**em parte** (`cLiquidado = "N"`) não aparece como título: dele vem só a **baixa** de conta corrente (`CONTA_CORRENTE_REC` /
`CONTA_CORRENTE_PAG` com `nCodTitulo` preenchido), uma linha por baixa. No recorte da MeuBESS, em 2026, são 8 baixas de títulos a
pagar na empresa 1, em 8 títulos, e 24 de títulos a receber na empresa 2, em 12 títulos (de 1 a 4 baixas cada): 11 desses 12
seguiam com saldo em aberto e 1 foi quitado depois da leitura, por isso também ficou sem a linha de título. Por
isso a regra de não contar duas vezes, abaixo, guarda essa baixa: descartá-la fazia o pagamento parcial sumir da conta. A baixa
traz `cCodCateg`, mas não `nCodOS`, `categorias[]` nem `departamentos[]` — quem os tem é o título, que esta leitura não devolve.
**A leitura do título a pagar inteiro foi feita em 25/09/2026, das 15h23 às 15h24** (`financas/pesquisartitulos` →
`PesquisarLancamentos`, `cNatureza = "P"`, por vencimento e por emissão em 2026, empresas 1 e 2, no cache local): dos
títulos a pagar em parte pagos com pagamento em 2026 — 6 na empresa 1 e 3 na 2 —, 8 entram pela regra nova, como baixa
de conta corrente, e 1 não: os 3 da empresa 2 passaram a entrar em 25/09/2026, quando o dono disse que a conta
`Adiantamento ao Fornecedor`, de onde saiu a baixa dos três, é da MeuBESS (ver "A conta Adiantamento ao Fornecedor", na Tela 1). A contagem inteira, com os `nCodTitulo` e o motivo de
cada um ficar de fora, está no parágrafo igual a este, na Tela 1.

**Cartões no topo (5, cada um com a linha do período embaixo):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Receita total | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `ENTRADA` (K) das linhas de receita (`SUB 2` (J) = `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`), somada pelo mês de `DIA PG` (F) — ou, pronta, a linha `Receitas` (B15) da aba do mês. É o **mesmo número** do cartão "Receitas" da Tela 1, de propósito: as duas telas mostram a mesma receita. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CR` traz só os títulos a receber e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_REC"`) e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (caixa), guardando `detalhes.cNatureza = "R"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), com o recorte da MeuBESS por `detalhes.nCodCC`. **Sem contar duas vezes:** o título recebido volta na mesma leitura como `CONTA_A_RECEBER` e como `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_RECEBER`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): empresa 1, 9 títulos + 0 baixas de parcial + 162 avulsos = 171 lançamentos; empresa 2, 536 + 25 + 611 = 1.172 — a conta `Adiantamento ao Fornecedor`, que entrou no recorte em 25/09/2026, **não mexe nestes números**: as 11 entradas dela na empresa 1 e as 44 na 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das linhas de receita do `FLUXO DE CAIXA` no mês de caixa — **não** é mais a soma da linha "(+) Receitas" da tabela abaixo, que ficou no Omie; ver "A escolha entre Omie e DFC" | |
| Custos e despesas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `SAIDA` (L) de `FLUXO DE CAIXA` da pasta da MeuBESS agrupada por `CLASS. CONTABIL` (I), pelo mês de `DIA PG` (F): `FORNECEDORES COGS` (e a grafia errada `FORNECEODORES COGS`, que conta igual — decisão do dono, 25/09/2026) é custo e `FORNECEDORES G&A` é despesa geral — **essa separação só existe no DFC**, o Omie não a faz sozinho. Pronta e sem a separação, é a linha `Gastos` (B20) da aba do mês. **Confronto — Omie recortado:** a mesma leitura da tela (`dDtPagtoDe` / `dDtPagtoAte`) **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`), guardando `detalhes.cNatureza = "P"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), com o recorte da MeuBESS por `detalhes.nCodCC`, contra o total. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094 lançamentos; empresa 2, 556 + 3 + 547 = 1.106. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das linhas de custos, despesas gerais e impostos | |
| EBITDA | **Omie recortado (calculado)** / confronto: DFC, só no resultado financeiro | **Principal — Omie recortado:** as linhas da tabela abaixo, com o recorte da MeuBESS por `detalhes.nCodCC` já aplicado na leitura — o EBITDA deixa de ser o do CNPJ inteiro. **Confronto — DFC, parcial:** o DFC **não** ajuda na depreciação nem na amortização, porque nenhuma das duas sai do caixa e não existe linha para elas nas planilhas; o resultado financeiro, sim — `SUB 2` (J) em `JUROS`, `RENDIMENTO FINANCEIRO`, `EMPRESTIMO`, `TARIFAS BANCÁRIAS`. Como o confronto é parcial, este cartão **não leva selo de %**: leva nota de rodapé dizendo que depreciação e amortização não existem no DFC. **Decisão do dono (25/09/2026), resposta "b" à pergunta do grupo (d) de [`docs/categorias-do-dre.html`](categorias-do-dre.html) — categorias do Omie que são resultado financeiro:** **empresa 1 (7 códigos)** — `1.01.02` Rendimento Bancários, `1.02.02` Rendimentos de Aplicações, `1.04.95` Rendimento Bancário, `2.05.01` Juros sobre Empréstimos, `2.05.02` Juros e Multas pagos, `2.05.04` Tarifas Bancárias, `2.06.95` IOF; **empresa 2 (8 códigos)** — `1.02.02` Rendimentos de Aplicações, `1.04.94` Rendimento Financeiro, `2.04.91` Emprestimo, `2.05.01` Juros sobre Empréstimos, `2.05.02` Juros e Multas pagos, `2.05.04` Tarifas Bancárias, `2.05.99` Tarifas Bancarias, `2.06.95` IOF. São **15 códigos**: as 11 sugeridas do grupo (d) (juros, tarifas, rendimentos, empréstimo) mais Rendimentos de Aplicações (`1.02.02`) e IOF (`2.06.95`), nas duas empresas em que existem. **Ficam fora do resultado financeiro, cada uma com seu destino:** Cartão de Credito (`2.11.98`) e Aluguel Veiculo (`2.11.99`), da empresa 1, vão para as **despesas operacionais** — a linha "(−) Despesas gerais" do DRE —, embora hoje estejam penduradas na conta Despesas Financeiras do Omie; e os empréstimos e transferências entre as empresas (Intercompany) ficam **fora do DRE**, como as transferências — empresa 1: `2.08.02` (pagamento de empréstimo), `2.05.99` (transferência) e `1.04.99` (recebimento de empréstimo); empresa 2: `1.04.99` (recebimento de empréstimo) e `2.10.98` (pagamento de empréstimo); e, por uma **segunda resposta do dono no mesmo 25/09/2026** ("2 ok"), **Financiamento Veiculo (`2.11.95`, empresa 1)**, que antes estava anotado como "decidir depois": ele fica **fora do resultado financeiro** porque **a parcela paga a dívida** — 1 lançamento avulso de despesa em jan–set de 2026, na contagem do cache. **Uma terceira resposta do dono, no mesmo 25/09/2026** ("financiamento de veiculo é despesas gerais sim"), **deu o destino dele: "(−) Despesas gerais"**, ao lado de Cartão de Credito e Aluguel Veiculo — e **não** fora do DRE, como este documento registrou por um dia. O que fica fora do DRE são só os empréstimos e transferências Intercompany. **O código sozinho engana; vale sempre o par empresa + código:** `2.05.99` é Transferência Intercompany na empresa 1 (fora do DRE) e Tarifas Bancarias na 2 (resultado financeiro), e `2.10.98` e `2.08.02` só são intercompany na empresa 2 e na 1, respectivamente. **Não entram na decisão, anotadas como "decidir depois"** (sem lançamento no período): Recebimento de Empréstimos Bancários (`1.04.03`) e Pagamento de Empréstimos Bancários (`2.05.03`), nas duas empresas. Financiamento Veiculo (`2.11.95`, empresa 1) estava nesta lista e **saiu dela em 25/09/2026**, decidido como fora do resultado financeiro e, pela terceira resposta do mesmo dia, mandado para "(−) Despesas gerais" (acima). A tela leva o lançamento para o resultado financeiro pelo código da categoria, e não pela conta do DRE; a lista vale no lado do Omie, e o confronto do DFC (`SUB 2` acima) segue como está. **Decisão do dono (25/09/2026), resposta "a" à pergunta do grupo (c) da mesma página — depreciação e amortização:** no Omie não existe categoria delas (o plano das empresas 1 e 2 só tem a **compra** do bem, na conta do DRE `3.01.01` Ativos, e nenhuma das 28 contas do DRE é de depreciação ou amortização), então **o grupo (c) fica sem categorias**. A Tela 2 mostra o EBITDA e o lucro líquido **sem depreciação e sem amortização**, com um aviso escrito ao lado dos números, e **não entra planilha do contador**. O aviso é o mesmo nos dois cartões e nas linhas "(=) EBITDA" e "(=) Lucro líquido" da tabela: **"Sem depreciação e sem amortização: o Omie não tem categoria para elas, então este número não as desconta."** **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC (parcial)"; ver "A escolha entre Omie e DFC" | receita líquida − custos − despesas operacionais, antes de juros, impostos, depreciação e amortização | |
| Lucro líquido | **Omie recortado (calculado)** / confronto: DFC (lucro de caixa) | **Principal — Omie recortado:** as linhas da tabela abaixo — o lucro do DRE depende de **cadastro** (categoria e conta do DRE), que só o Omie tem. **Confronto — DFC:** o `Lucro Liquido` pronto da linha 25 (`B25`) da aba do mês, na pasta da MeuBESS, que é lucro **de caixa** (entradas menos saídas do mês), sem deduções, sem impostos por competência e sem depreciação. Aparece numa segunda linha do cartão, rotulado "lucro de caixa", **sem selo de %** — são contas diferentes, e comparar as duas em % não diria nada. O recorte entra nos dois lados: no DFC ele é a pasta da MeuBESS, no Omie é o `detalhes.nCodCC`. **Decisão do dono (25/09/2026), depreciação e amortização:** o lucro líquido do Omie recortado sai **sem depreciação e sem amortização** (o Omie não tem categoria delas; ver a linha "EBITDA" acima), e o cartão leva ao lado do número o aviso: **"Sem depreciação e sem amortização: o Omie não tem categoria para elas, então este número não as desconta."** **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | receita líquida − custos − despesas gerais + resultado financeiro − impostos pagos (guias) (= EBITDA + resultado financeiro − impostos pagos) | |
| Margem de lucro | **Omie recortado (calculado)** / confronto: DFC | **Principal — Omie recortado:** o lucro líquido do cartão ao lado dividido pela receita das linhas de receita da tabela abaixo — os **dois** termos do Omie recortado, para a razão não misturar fontes. **Confronto — DFC:** a mesma razão feita com os números do DFC (lucro de caixa ÷ receita do `FLUXO DE CAIXA`). O recorte entra nos dois termos; sem ele a margem saía distorcida duas vezes. Como o lucro líquido, sai sem depreciação e sem amortização (decisão do dono, 25/09/2026; ver a linha "Lucro líquido"). **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | lucro líquido ÷ receita | |

**Tabela:** uma coluna por mês (realizado e AH com seta) e o total do período. Linhas agrupadas, abrindo e fechando:

| linha | fonte | contas do plano / abas | conferido |
|---|---|---|---|
| (+) Receitas: outras receitas, vendas de produtos | **Omie recortado** / confronto: DFC | **Principal — Omie recortado:** categorias com `conta_receita = "S"` e `totalizadora = "N"` em `geral/categorias` → `ListarCategorias`, agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CR` traz só os títulos a receber e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_REC"`) e `dDtPagtoDe` / `dDtPagtoAte` (caixa), guardando `detalhes.cNatureza = "R"`, fora os `CANCELADO` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima) (a `0.01.01` tem `conta_receita = "S"` e entraria nesta linha), e só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`. **Sem contar duas vezes:** o título recebido volta na mesma leitura como `CONTA_A_RECEBER` e como `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_RECEBER`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): empresa 1, 9 títulos + 0 baixas de parcial + 162 avulsos = 171 lançamentos; empresa 2, 536 + 25 + 611 = 1.172 — a conta `Adiantamento ao Fornecedor`, que entrou no recorte em 25/09/2026, **não mexe nestes números**: as 11 entradas dela na empresa 1 e as 44 na 2 são a chegada do adiantamento (`cOrigem = "ADCR"`) e o filtro as tira. O avulso e a baixa de parcial têm categoria (`detalhes.cCodCateg`) e caem na linha do DRE por ela; o que ele não tem é pedido de venda, e por isso não se reparte por produto. Fonte mantida — ao contrário do cartão "Receita total" — porque aqui quem decide é a **categoria de cada lançamento**, que só o Omie traz lançamento a lançamento; o recorte impede que receita de outra unidade entre na linha. **A divisão entre "vendas de produtos" e "outras receitas" — decisão do dono, 25/09/2026** (resposta "aceito todas as sugestões" à página `docs/categorias-de-receita.html`, que trouxe a sugestão código a código; o dono aceitou os dois grupos inteiros, sem mudar nenhum código). **A divisão é pela categoria do lançamento** — `movimentos[].categorias[].cCodCateg` no título e `detalhes.cCodCateg` no avulso e na baixa de parcial —, não pelo pedido de venda. **"Vendas de produtos": três códigos, os mesmos nas duas empresas** — `1.01.01` RECEITA DE VENDA DE PRODUTOS · `1.01.03` RECEITA DE REVENDA DE MERCADORIAS · `1.04.01` Adiantamento de Clientes (esta entra em venda porque o recebimento nasce de pedido de venda, `nCodOS` preenchido). **"Outras receitas": todo o resto** das categorias com `conta_receita = "S"` e `totalizadora = "N"`, fora as de transferência — **empresa 1, 26 códigos:** `1.01.02`, `1.01.95`, `1.01.96`, `1.01.97`, `1.01.98`, `1.01.99`, `1.02.01`, `1.02.02`, `1.02.95`, `1.02.96`, `1.02.97`, `1.02.98`, `1.02.99`, `1.03.01`, `1.03.02`, `1.03.03`, `1.03.04`, `1.03.26`, `1.04.02`, `1.04.03`, `1.04.04`, `1.04.05`, `1.04.06`, `1.04.95`, `1.04.98` e `1.04.99`; **empresa 2, 28:** esses mesmos 26 mais `1.04.94` Rendimento Financeiro e `1.04.97` Prêmios de Seguros / Sinistros — o código que na empresa 1 é transferência e fica fora da soma (ver "As categorias de transferência", acima). As quatro totalizadoras `1.01`, `1.02`, `1.03` e `1.04` não recebem lançamento e não entram em nenhum dos dois grupos. **Em 2026, no recorte, só 10 desses códigos tiveram recebimento:** os três de venda e, em outras receitas, `1.02.02`, `1.02.99`, `1.03.03`, `1.04.02`, `1.04.04`, `1.04.94` e `1.04.99`; a contagem código a código está em `docs/categorias-de-receita.html` (só contagens, sem valores; a página conta os **três** — título, baixa de parcial e avulso — e sai de uma leitura só, a de 27/09/2026, 09h11–09h17: até 25/09/2026 o `scripts/categorias-de-receita.mjs` juntava todas as leituras de `financas/mf` do cache e ficava com 541 títulos na empresa 2 em vez de 523 + 24, porque uma leitura só de títulos a receber trazia 18 que esta não tem — 11 recebidos só em parte e 7 baixados depois dela — e esses 18 davam título irmão às 24 baixas de parcial, que assim sumiam da conta). **O pedido de venda não reparte mais esta linha:** como a divisão é pela categoria, não é preciso dividir o valor recebido de um título entre os produtos do pedido. Ele continua sendo a prova da origem — chega-se nele por `detalhes.nCodOS` (= `cabecalho.codigo_pedido`) e `produtos/pedido` → `ConsultarPedido`, com os itens em `det[].produto` (`codigo_produto`, `descricao`, `valor_total`), o total em `total_pedido.valor_total_pedido` e a categoria do pedido em `informacoes_adicionais.codigo_categoria` — e é o que sustenta a `1.04.01` em "vendas de produtos". **Confronto — DFC:** as linhas de `FLUXO DE CAIXA` da pasta da MeuBESS com `SUB 2` (J) em `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`, `REPASSE` e `REPASSE - CREDITO`, pelo mês de `DIA PG` (F); selo acima de 2%. A divisão da decisão de 25/09/2026 não existe lá: o `SUB 2` é a classificação da própria planilha, não a categoria do Omie, e a linha aponta o projeto (`TITULO`, coluna H); por isso o confronto é do total da linha, não de "vendas de produtos" e "outras receitas" separados. **Decisão do dono (25/09/2026)** — fecha a lacuna da divisão entre "outras receitas" e "vendas de produtos" (os nomes não existem no cadastro padrão do Omie, então quem dizia quais categorias são venda de produto era a MeuBESS) e, junto com ela, a de como repartir o valor de um título entre os produtos do pedido, que deixa de existir: a divisão é pela categoria, e nenhum valor se reparte por produto. Ver o parágrafo "A divisão entre..." acima. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | ligação `nCodOS` e os campos de `det[].produto` e `total_pedido` conferidos no Omie em 24/09/2026 (pedido 827); a quebra em linhas do DRE, não |
| (=) Receita bruta | **Omie recortado (calculado)** | soma das linhas de receita acima; no Omie a conta totalizadora é a que tem `totalizaDRE = "S"` em `geral/dre` → `ListarCadastroDRE`. Segue a fonte da linha "(+) Receitas", que é o Omie recortado | |
| (−) Deduções: devoluções, taxas de serviço | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS — a devolução vem marcada na **própria linha**: `SUB 2` (J) = `DEVOLUCÃO`, com `ESTORNO` em `CLASS. CONTABIL` (I) —, pelo mês de `DIA PG` (F). É exatamente o que falta no Omie, que não marca categoria como "dedução". **Confronto — Omie recortado,** numa segunda coluna, `detalhes.cOperacao = "13"` (devolução de venda) e as categorias da lista abaixo. Na leitura de 24/09/2026 **nenhum** lançamento do Omie recortado no período trazia `cOperacao = "13"`, então o confronto se apoia só nas categorias da lista. **Os campos de retenção do título (`nValorPIS`, `nValorISS` e os demais) não entram** — ver a decisão de 25/09/2026 abaixo. **Decisão do dono (24/09/2026), resposta "c" à pergunta do grupo (a) de [`docs/categorias-do-dre.html`](categorias-do-dre.html) — categorias do Omie que são dedução da receita:** **empresa 1** — `2.06.01` ICMS, `2.06.03` PIS SOBRE VENDAS, `2.06.04` COFINS SOBRE VENDAS, `2.09.01` Devoluções de Vendas de Mercadoria, `2.09.02` Devoluções de Vendas de Serviços Prestados; **empresa 2** — `2.06.01` ICMS, `2.06.03` PIS A RECOLHER, `2.06.04` COFINS A RECOLHER, `2.09.01` Devoluções de Vendas de Mercadoria, `2.09.02` Devoluções de Vendas de Produtos, `2.02.97` Reembolso por cancelamento. São as 10 sugeridas do grupo (a) mais Reembolso por cancelamento (só na empresa 2): 11 códigos (5 na empresa 1 e 6 na 2). **Decisão do dono (25/09/2026), opção A — o ISS retido não é dedução da receita:** `2.06.07` ISS RETIDO saiu da lista, nas duas empresas (a lista tinha 13 códigos, com ele). Conferência no cache local do Omie em 25/09/2026: a retenção do recorte da MeuBESS é toda de título **a pagar** — o imposto que ela desconta ao pagar fornecedor; dos 544 títulos a receber do recorte em 2026, **nenhum** tem retenção, ou seja, o cliente nunca retém —, e o ISS retido sai pela guia paga, que está em "(−) Impostos pagos (guias)". Por isso também não há mais a linha "(−) Impostos retidos na nota" na Tela 2. A lista vale para a **coluna de confronto**, não para o número da tela, que o DFC marca na linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) Receita líquida | **mistura as duas** (calculado) | receita bruta (Omie recortado, linha acima) − deduções (DFC, linha acima). **É a soma que a decisão de 24/09/2026 deixou com uma fonte de cada lado** — consequência aritmética da escolha por linha, não uma escolha nova; está marcada em "A escolha entre Omie e DFC" para o dono ver. O denominador do cartão "% desp. funcionários / receita líquida" da Tela 1 **não** usa esta linha: lá as duas pontas são do DFC | |
| (−) Custos de vendas: custo do produto, outros custos | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `FORNECEDORES COGS` ou `COMPRA DE MERCADORIA` e `SUB 2` (J) em `COMPRAS DE MERCADORIAS`, `FRETE E CARRETO` e `ARMAZENAGEM E MANUSEIO`. **As duas grafias de COGS contam (decisão do dono, 25/09/2026, "sim fornecedor COGS é custo de vendas"):** a planilha também escreve `FORNECEODORES COGS`, com erro de digitação, e onde este documento diz `FORNECEDORES COGS` a grafia errada vale igual. São **2 linhas em agosto de 2026**, e só nesse mês dos doze do ano. **A contagem de agosto não muda com isso — segue 62 linhas** (ver `docs/conferencia.md`): as duas têm `SUB 2` `MARKETING / PUBLICIDADE`, que não é um dos três `SUB 2` desta regra, e é o `SUB 2` que as deixa de fora, não a grafia. **Decisão do dono, 25/09/2026: "marketing não é custo de vendas"** — perguntado se uma linha marcada COGS com `SUB 2` de marketing é custo de vendas, ele respondeu que não: a regra fica como está escrita aqui e as 2 linhas de agosto seguem fora de "(−) Custos de vendas". **Confronto — Omie recortado, pela lista de categorias abaixo (decisão do dono, 25/09/2026), e não por `codigo_dre`:** os lançamentos de `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`), guardando `detalhes.cNatureza = "P"` e fora os `CANCELADO`, cujo `detalhes.cCodCateg` está na lista, com o recorte por `detalhes.nCodCC` e fora o **par do adiantamento ao fornecedor** (`cOrigem = "ADCR"` e os lançamentos de título com linha `cOrigem = "ADCP"`; decisão do dono, 25/09/2026, opção A — ver "A conta Adiantamento ao Fornecedor", acima); selo acima de **5%**. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora — `2.01.99` na empresa 1 e `2.01.03` na 2 estão nesta lista e recebiam os títulos `ADCP` da ida do dinheiro): empresa 1, 66 títulos + 1 baixa de parcial + 20 avulsos = 87 lançamentos; empresa 2, 447 + 3 + 137 = 587 — os 14 avulsos a mais na empresa 2 são os das três categorias que entraram na segunda resposta de 25/09/2026 (`2.01.96`, 6; `2.01.89`, 5; `2.01.92`, 3), e nenhuma das três tem título nem baixa de parcial no período. Era a linha menos contaminada de todas — as outras unidades quase não têm custo de mercadoria, vendem serviço —, então o recorte muda pouco aqui, e isso é esperado. **Decisão do dono (25/09/2026), resposta "c" à pergunta do grupo (b) de [`docs/categorias-do-dre.html`](categorias-do-dre.html) — categorias do Omie que são custo de vendas:** **empresa 1 (22 códigos)** — `2.01.01` Compras de Mercadorias para Revenda, `2.01.02` Fretes s/ compras, `2.01.03` Compras de Materia Prima, `2.01.04` Compra de Serviços, `2.01.82` Uniformes e equipamentos de Segurança - Custo (estoque), `2.01.83` Terceiros e Estagiários - Custo (estoque), `2.01.84` Outros Benefícios - Custo (estoque), `2.01.85` Seguro de Vida - Custo (estoque), `2.01.86` Vale Refeição - Custo (estoque), `2.01.87` Vale Transporte - Custo (estoque), `2.01.88` Assistência Médica e social - Custo (estoque), `2.01.89` Pensão Alimentícia - Custo (estoque), `2.01.90` IRRF S/ Salários - Custo (estoque), `2.01.91` FGTS - Custo (estoque), `2.01.92` INSS - Custo (estoque), `2.01.93` 13º Salário - Custo (estoque), `2.01.94` Rescisões - Custo (estoque), `2.01.95` Férias - Custo (estoque), `2.01.96` Adiantamento de Salário (custo), `2.01.97` Salários - Custo (estoque), `2.01.99` Gás para empilhadeira - Custos, `2.04.88` Armazém e Manuseio; **empresa 2 (16 códigos)** — `2.01.01` Compras de Mercadorias para Revenda, `2.01.02` Fretes s/ compras, `2.01.03` Compras de Materia Prima, `2.01.04` Compra de Serviços, `2.01.90` Vigilância e Monitoramento - Custos, `2.01.91` Locação de Máquinas e Equipamentos - Custos, `2.01.93` Seguros de carga - Custo, `2.01.94` IPTU - Custo, `2.01.95` Telefone e Internet - Custo, `2.01.97` Água e Esgoto - Custo, `2.01.98` Aluguel - Custo, `2.01.99` CUSTO DOS PRODUTOS VENDIDOS, `2.08.99` Reembolso - Custo, `2.01.89` Gas para empilhadeira - Custos, `2.01.92` Armanezagem e manuseio de Carga - Custos, `2.01.96` Energia Elétrica - Custo — estes três por uma **segunda resposta do dono no mesmo 25/09/2026** ("1 ok"), que fechou o aviso da página do DRE: a contagem corrigida mostrou que os três têm movimento e são apontados só pelo nome, o mesmo critério das outras 17. São **38 códigos** (22 na empresa 1 e 16 na 2): as **18 sugeridas** do grupo (b) — as duas pistas concordavam, nome e conta do DRE — mais **17 que a página apontava como "em dúvida" e que têm movimento no período, todas apontadas só pelo nome** (compras de matéria-prima e de mercadorias para revenda, fretes sobre compras e os gastos com "Custo" no nome: aluguel, IPTU, locação de máquinas, seguros de carga, vigilância, telefone, água, salários, uniformes, terceiros, reembolso-custo, armazém e manuseio) — e mais as **3 da segunda resposta do dono, no mesmo 25/09/2026** (`2.01.96`, `2.01.89` e `2.01.92`, todas da empresa 2), que a contagem corrigida revelou com movimento e apontadas só pelo nome, o mesmo critério das 17: 18 + 17 + 3. **Ficaram de fora:** as em dúvida apontadas só pela conta do DRE — `2.08.99` OUTRAS DESPESAS e `2.08.98` Reembolso, da empresa 1, e `2.11.95` Financiamento Veiculo, também da empresa 1, que uma **terceira resposta do dono no mesmo 25/09/2026** ("financiamento de veiculo é despesas gerais sim") mandou para **"(−) Despesas gerais"** — ela é a única em dúvida deste grupo com destino escrito, e a conta do DRE em que o Omie a pendura (`1.21.03` Outros Custos) era a única pista a favor do custo de vendas — e as em dúvida sem movimento no período. **Várias dessas categorias estão hoje numa conta de despesa do DRE no Omie** (Despesas Variáveis, Despesas Administrativas, Despesas com Pessoal) ou sem conta do DRE; **a tela reclassifica pela lista, e não pela conta do DRE em que a categoria está pendurada** — o lançamento vai para "(−) Custos de vendas" pelo código da categoria, e sai da linha de despesas gerais. Vale para a coluna de confronto, não para o número da tela, que o DFC marca na linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) Lucro bruto | **mistura as duas** (calculado) | receita líquida (linha acima, que já mistura) − custos de vendas (DFC). Mesma observação da linha "(=) Receita líquida": é consequência aritmética da decisão de 24/09/2026, e está marcada em "A escolha entre Omie e DFC" | |
| (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI | **Omie recortado** / confronto: DFC por `SUB 2` | **Principal — Omie recortado:** categorias com `conta_despesa = "S"` agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`) e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (regime de caixa, como as demais linhas da tela), guardando `detalhes.cNatureza = "P"`, fora os `cStatus = "CANCELADO"` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima) (a `0.01.02` tem `conta_despesa = "S"` e entraria nesta linha), e só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API, já com a conta `Adiantamento ao Fornecedor` no recorte e o par do adiantamento fora): empresa 1, 809 títulos + 9 baixas de parcial + 276 avulsos = 1.094 lançamentos; empresa 2, 556 + 3 + 547 = 1.106 — é o total da leitura de despesa; o que sai desta linha para custos de vendas e para o resultado financeiro está nas linhas próprias. **Quebra por categoria do plano de contas (decisão do dono, 24/09/2026):** cada lançamento entra na linha pela categoria dele — `codigo_categoria` do lançamento, que no retorno é `detalhes.cCodCateg` (ou `categorias[].cCodCateg`, com `nDistrValor`, quando o título é rateado) — e **não** por departamento; `departamentos[]` não entra na quebra desta linha (o centro de custo segue sendo o recorte da Tela 1). O cadastro das categorias, com a conta do DRE de cada uma, está em `docs/plano-de-categorias-omie.html`. A fonte ficou no Omie porque essa quebra por categoria é decisão do dono e só o Omie a tem; o recorte era indispensável aqui, porque as categorias são as mesmas nas quatro unidades — quem separa é a conta corrente. **Decisão do dono (25/09/2026), grupo (d) de [`docs/categorias-do-dre.html`](categorias-do-dre.html):** Cartão de Credito (`2.11.98`) e Aluguel Veiculo (`2.11.99`), da empresa 1, entram nesta linha pelo código da categoria, embora estejam na conta Despesas Financeiras do Omie; as categorias do resultado financeiro (lista por empresa na linha do EBITDA, no topo da tela) ficam de fora dela, e os empréstimos e transferências Intercompany ficam fora do DRE. **Financiamento Veiculo (`2.11.95`, empresa 1) entra nesta linha** pela **terceira resposta do dono, no mesmo 25/09/2026** ("financiamento de veiculo é despesas gerais sim"), embora o Omie o pendure na conta `1.21.03` Outros Custos: ele segue **fora do resultado financeiro**, como a segunda resposta do mesmo dia decidiu, e **não** fica fora do DRE — este documento registrou isso por um dia e a terceira resposta o corrigiu. É 1 lançamento avulso em jan–set de 2026, e 1 em agosto de 2026. **Confronto — DFC,** numa coluna "no DFC" ao lado, linha a linha: `CLASS. CONTABIL` (I) = `FORNECEDORES G&A`, quebrado pelas contas de `SUB 2` (J) — o cadastro da aba `BASE`, coluna A, com 69 contas em setembro. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) EBITDA | **Omie recortado (calculado)** | segue o cartão "EBITDA" do topo, que é do Omie recortado: lucro bruto − despesas gerais, ou seja, receita líquida − custos de vendas − despesas gerais, **antes** do resultado financeiro, dos impostos, da depreciação e da amortização — por isso a linha vem logo abaixo das despesas gerais e **antes** de "(+/−) Resultado financeiro" e de "(−) Impostos pagos (guias)". **Decisão do dono (25/09/2026), resposta "a" à lacuna da linha única da referência, que juntava EBITDA e lucro líquido:** a linha única da referência vira **duas**, "(=) EBITDA" e "(=) Lucro líquido", cada uma seguindo o cartão do topo de mesmo nome. A linha sai **sem depreciação e sem amortização** (decisão do dono, 25/09/2026) e leva ao lado o aviso: **"Sem depreciação e sem amortização: o Omie não tem categoria para elas, então este número não as desconta."** | |
| (+/−) Resultado financeiro: receitas e despesas financeiras | **Omie recortado** / confronto: DFC | **Principal — Omie recortado:** as categorias que o dono decidiu em 25/09/2026 serem resultado financeiro — a lista de 15 códigos por empresa está na linha "EBITDA" dos cartões do topo, e a lista vale pelo código da categoria, não pela conta do DRE. Valores de `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CPCR` traz só os títulos e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo` em `CONTA_CORRENTE_PAG` e `CONTA_CORRENTE_REC`) e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (caixa), separando por `detalhes.cNatureza` o que é `R` (rendimentos) do que é `P` (juros, tarifas, IOF, empréstimo), fora os `cStatus = "CANCELADO"` e fora as **categorias de transferência**, que não são receita nem despesa (**decisão do dono, 25/09/2026, opção B:** as duas que o cadastro marca, `transferencia = "S"` — `0.01.01` Entrada de Transferência e `0.01.02` Saída de Transferência —, e mais as chamadas "Transferência" **sem** a marca: `1.04.96` e `2.05.98` nas duas empresas e `1.04.97` **só na empresa 1** — na empresa 2 esse código se chama "Prêmios de Seguros / Sinistros", não é transferência e conta como outra receita, decisão do dono de 25/09/2026, sem nenhum lançamento em 2026; cinco fora na empresa 1 e quatro na 2, e todas só aparecem no avulso: 37 entradas e 44 saídas de `0.01.01` / `0.01.02` na empresa 1, nenhuma na 2, mais 1 entrada na empresa 1 e 34 lançamentos na 2 pelas sem marca; ver "As categorias de transferência", acima) e fora o **par do adiantamento ao fornecedor**, que também é dinheiro andando entre duas contas da MeuBESS (**decisão do dono, 25/09/2026, opção A:** a conta `Adiantamento ao Fornecedor` passou a ser da MeuBESS e entrou no recorte; ficam fora das somas todo lançamento com `detalhes.cOrigem = "ADCR"` e todo lançamento de um título que tenha alguma linha com `detalhes.cOrigem = "ADCP"` — o título da ida e a baixa dele —, para a despesa contar uma vez só, quando o fornecedor é pago; ver "A conta Adiantamento ao Fornecedor", acima), guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`; **Sem contar duas vezes:** o título baixado volta na mesma leitura como `CONTA_A_PAGAR` / `CONTA_A_RECEBER` e como `CONTA_CORRENTE_PAG` / `CONTA_CORRENTE_REC` com o mesmo `detalhes.nCodTitulo`; fica o título, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): na receita financeira, empresa 1, 7 títulos + 0 baixas de parcial + 48 avulsos = 55 lançamentos, e empresa 2, 0 + 0 + 11 = 11; na despesa financeira, empresa 1, 7 + 0 + 91 = 98, e empresa 2, 2 + 0 + 31 = 33 — nenhum pagamento parcial caiu nas categorias desta linha — a tarifa bancária e o rendimento quase sempre entram como avulso, e é a linha que mais muda com o filtro novo; o número da linha é receitas financeiras menos despesas financeiras. Cartão de crédito, aluguel de veículo e os empréstimos e transferências Intercompany **não** entram aqui (destinos na linha "EBITDA" dos cartões). **Confronto — DFC,** numa coluna "no DFC": `SUB 2` (J) em `JUROS`, `RENDIMENTO FINANCEIRO`, `EMPRESTIMO`, `TARIFAS BANCÁRIAS`, pelo mês de `DIA PG` (F); selo acima de **5%**, a regra das linhas da tabela | |
| (−) Impostos pagos (guias) | **DFC (guias pagas)** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `IMPOSTOS E CONTRIBUIÇÕES` e `SUB 2` (J) em `ISS`, `INSS` e `IRPJ / CSLL`. **Confronto — Omie recortado:** as guias, que entram como conta a pagar e se reconhecem **pela categoria de imposto, e não pelo `cTipo`**: `financas/mf` → `ListarMovimentos` **sem `cTpLancamento`** (o `CP` traz só os títulos a pagar e deixa de fora os lançamentos avulsos de conta corrente, `detalhes.cGrupo = "CONTA_CORRENTE_PAG"`) e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (caixa), guardando `detalhes.cNatureza = "P"`, fora os `cStatus = "CANCELADO"`, com o recorte da MeuBESS por `detalhes.nCodCC`, guardando só os lançamentos cujo `detalhes.cCodCateg` está em `2.06.05` (IRPJ na empresa 1, IRPJ/CSLL na 2), `2.06.06` (CSLL), `2.06.07` (ISS RETIDO), `2.03.06` (INSS- ADM) e `2.01.92` (INSS- Custo (estoque), empresa 1) — as categorias que correspondem às três contas `ISS`, `INSS` e `IRPJ / CSLL` do DFC; selo acima de **5%**. **Sem contar duas vezes:** o título pago volta na mesma leitura como `CONTA_A_PAGAR` e como `CONTA_CORRENTE_PAG` com o mesmo `detalhes.nCodTitulo`; fica o `CONTA_A_PAGAR`, um por `nCodTitulo`, e do conta corrente entram os dois que não têm título irmão nesta leitura: o **avulso**, que vem com `nCodTitulo` 0, e a **baixa do título quitado só em parte**, que vem com `nCodTitulo` preenchido e cujo título a leitura não traz (ver "o que o filtro de data de pagamento não traz", acima) — cada um contado uma vez por `detalhes.nCodMovCC` e com valor em `resumo.nValPago` (= `detalhes.nValorMovCC`; nenhum dos dois tem `nValorTitulo`, `categorias[]` nem `departamentos[]`, e os dois trazem `detalhes.cCodCateg`). Descartar a baixa com `nCodTitulo` preenchido, como esta regra dizia antes, fazia o pagamento parcial sumir da conta (corrigido em 25/09/2026). **Contagem de 2026** (jan–set, recorte da MeuBESS, contagem do cache local da leitura de 27/09/2026, 09h11–09h17, sem chamar a API): os 14 títulos abaixo mais 10 avulsos e nenhuma baixa de parcial — 8 na empresa 1 (4 de `2.06.05`, 2 de `2.06.07`, 1 de `2.03.06` e 1 de `2.01.92`) e 2 na empresa 2 (1 de `2.06.05` e 1 de `2.03.06`), todos em categoria da lista. **Por que a categoria e não o `cTipo` (conferido no cache local do Omie em 25/09/2026, sem chamar a API):** dos 1.387 títulos a pagar do recorte da MeuBESS em 2026 (1.386 antes de a conta `Adiantamento ao Fornecedor` entrar, em 25/09/2026) (fora os `CANCELADO`), só 3 têm `cTipo` `DAS` / `DRF` / `GUIA` (os 3 são `DRF`), e o `cTipo` não separa imposto do que não é — as guias de ISS retido vêm como `IMP` (6, empresa 2) e `99999` (3, empresa 1; o `99999` é também o tipo de 174 títulos a pagar, 133 deles "Implantação de saldos"), e o `IMP` traz também 2 repasses de representação comercial (categoria `2.02.03`) e 2 títulos de `2.06.98` TAXA, que não são guia; uma guia de INSS veio como `IOF` e uma de IRPJ/CSLL como `NFE`. **O filtro novo pega 14 títulos do recorte em 2026** (7 na empresa 1 e 7 na 2), **contra os 3 de antes** — 2 dos 3 antigos continuam dentro (o `DRF` de INSS- ADM e o `DRF` de IRPJ); o terceiro, o `DRF` de IRRF S/ Salários- Adm (`2.03.08`, `nCodTitulo` 6028348210), fica de fora de propósito (abaixo). **Por `cTipo`:** `IMP` 6, `99999` 3, `DRF` 2, `IOF` 1, `BOL` 1, `NFE` 1. **Por categoria:** `2.06.07` ISS RETIDO 9 (3 na empresa 1, 6 na 2), `2.03.06` INSS- ADM 2 (empresa 1), `2.06.05` IRPJ / IRPJ/CSLL 2 (1 em cada empresa), `2.01.92` INSS- Custo (estoque) 1 (empresa 1); `2.06.06` CSLL tem 0. **Nenhum dos 14 deixa de ser imposto:** o CNPJ do favorecido é um só para o ISS (o mesmo nas duas empresas) e um só para INSS e IRPJ (também o mesmo nas duas), e os dois de `cTipo` estranho são o `nCodTitulo` 5989839970 (`IOF`, `2.03.06` INSS- ADM, empresa 1, favorecido igual ao das outras guias de INSS e IRPJ) e o 5245012263 (`NFE`, `2.06.05` IRPJ/CSLL, empresa 2, mesmo CNPJ de favorecido do IRPJ da empresa 1). **Ficaram de fora, mesmo sendo tributo:** `2.06.95` IOF (3 títulos, empresa 1), que é do resultado financeiro por decisão do dono; `2.06.98` TAXA (4 na empresa 1 e 1 na 2), que o Omie pendura em Despesas Variáveis e não é uma das três contas do DFC; IRRF S/ Salários (`2.03.08` e `2.01.90`, 3 títulos na empresa 1), porque a linha do DFC não lista IRRF; e `2.06.99` Simples Nacional (DAS), que tem 0 títulos a pagar em 2026. **Sobreposição, sem mudar a soma:** `2.03.06` e `2.01.92` já estão em despesas gerais e custos de vendas — o filtro serve ao confronto, não à soma do lucro líquido. **Decisão do dono (25/09/2026), opção A, que substitui a resposta "c" da mesma data:** a Tela 2 tem **só** esta linha de impostos, "(−) Impostos pagos (guias)"; a linha "(−) Impostos retidos na nota" foi **retirada** e o ISS retido (`2.06.07`) saiu das deduções da receita. **Por quê (conferido no cache local do Omie em 25/09/2026, sem chamar a API):** dos 1.931 títulos únicos de 2026 do recorte da MeuBESS (fora os `CANCELADO`), 6 têm algum `cRet…` em `"S"` (5 na empresa 1 e 1 na 2), **todos a pagar**, com o `nValorTitulo` bruto (o líquido e o pago batem com ele menos a retenção; exemplo, `nCodTitulo` 5994584719); dos 544 a receber, nenhum. Na MeuBESS, então, o ISS retido é o imposto que ela desconta ao pagar fornecedor — o cliente nunca retém —, já está dentro do bruto de custos e despesas, e a guia dele (categoria `2.06.07`: 3 títulos na empresa 1, `cTipo` `99999`, e 6 na 2, `cTipo` `IMP`; par de exemplo, `nCodTitulo` 5984072772 e 5985139730, em março) é o que esta linha mede. **Decisão do dono (24/09/2026) sobre a fonte** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) Lucro líquido | **Omie recortado (calculado)** | segue o cartão "Lucro líquido" do topo, que é do Omie recortado: EBITDA (linha acima) + resultado financeiro − impostos pagos (guias), isto é, o que sobra **depois** do resultado financeiro e dos impostos — as linhas que ficam entre o EBITDA e esta. **Entram na soma: o resultado financeiro e "(−) Impostos pagos (guias)"**, e só essa linha de impostos: a de impostos retidos na nota foi retirada da tela (decisão do dono, 25/09/2026, opção A, registrada na linha das guias), porque a retenção da MeuBESS é a que ela faz ao pagar fornecedor e já sai pela guia paga. **Decisão do dono (25/09/2026)**, a mesma da linha "(=) EBITDA": a linha única da referência virou duas. A linha sai **sem depreciação e sem amortização** (decisão do dono, 25/09/2026) e leva ao lado o aviso: **"Sem depreciação e sem amortização: o Omie não tem categoria para elas, então este número não as desconta."** O termo de impostos vem da linha "(−) Impostos pagos (guias)", que é do DFC | |
| (=) sem conta | **Omie recortado** | os lançamentos cujas categorias não têm `codigo_dre` no cadastro da própria empresa — 13 categorias na empresa 1 (355 lançamentos) e 1 na empresa 2 (111), medidas em 24/09/2026 e listadas em "A soma das empresas 1 e 2". Mesma leitura das demais linhas: `financas/mf` → `ListarMovimentos` com `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro e o recorte da MeuBESS por `detalhes.nCodCC`; entram aqui os lançamentos cuja `detalhes.cCodCateg` cai numa categoria com `codigo_dre` vazio. **Decisão do dono (24/09/2026):** eles ganham esta linha própria em vez de serem repartidos nas outras ou deixados de fora. A linha fica no fim da tabela e **fora dos totalizadores** do DRE, e serve de alarme — enquanto tiver valor, há lançamento que o DRE não está classificando. Esvazia sozinha se o contador preencher o `codigo_dre` no Omie | |

O agrupamento real sai do **plano de contas do ERP** — no Omie, o `codigo_dre` de cada categoria (`ListarCategorias`)
contra o cadastro de contas do DRE (`ListarCadastroDRE`); a lista acima é a da referência e muda com ele.

---

## Tela 3 — Fluxo de Caixa (desde 28/09/2026)

**Pedido do dono, 28/09/2026:** a tela "Contas a receber" passa a ser o **Fluxo de Caixa**, para o dono e o
departamento financeiro, com a estratégia de venda como a decisão que ela ajuda a tomar. A história e o desenho estão
em [`layout.md`](layout.md); aqui está de onde sai cada número. Rota: `/fluxo-de-caixa` (a antiga `/receber` leva
para cá). Cálculo: `lib/indicadores/fluxo-de-caixa.mjs`.

**Filtros:** ano · mês · empresa · a chave "incluir dados do Omie" — os que ela divide com as outras duas telas. A
empresa só alcança o lado do Omie; os números de fonte DFC dizem isso ao lado, pelo mesmo motivo da Tela 1 ("A coluna
`EMP.` não é a filial do Omie").

**Quase nenhum número nasce nesta tela.** Cinco dos oito cartões são cartões que já existiam, pelo mesmo cálculo e o
mesmo filtro — a tela chama `calcularTela1` e `calcularTela3` e pega o cartão:

| cartão | é o mesmo que | fonte |
|---|---|---|
| Entrou | Tela 1, "Receitas" | DFC, `FLUXO DE CAIXA`, o valor com sinal positivo pelo mês de `DIA PG` (F), fora `SUB 2` = `TRANSFERENCIAS BANCARIAS - RECEITA` |
| Saiu | Tela 1, "Despesas" | DFC, `FLUXO DE CAIXA`, o valor com sinal negativo pelo mês de `DIA PG` (F) |
| Ainda a pagar no mês | Tela 1, "Desp. Pendentes" | Omie, títulos a pagar com vencimento no mês e sem baixa |
| Ainda a receber no mês | antiga Tela 3, "Valor Pendente" | Omie, títulos a receber com vencimento no mês, faixa EM ABERTO |

**As três colunas de dinheiro do `FLUXO DE CAIXA` não são "entrada, saída e saldo" — medido neste computador em
29/09/2026.** `ENTRADA` (K), `SAIDA` (L) e `SALDO` (M) foram lidas assim até 28/09/2026, e a planilha não é isso:

- no arquivo de **setembro**, `ENTRADA` (K) traz o **valor com sinal de toda linha** — positivo na entrada, negativo na
  saída — e `L` e `M` são a **mesma coluna de saldo corrido**, partida pelo sinal: o saldo depois da linha vai em `L`
  quando o movimento é positivo e em `M` quando é negativo (linha 10: `K` = uma entrada, `L` = o saldo já com ela;
  linha 3: `K` = uma saída, `M` = o saldo);
- em **abril** é ao contrário: `K` vem vazio, `L` traz a saída (negativa) e `M`, o saldo;
- em **julho** não há saldo nenhum e `L` traz a entrada.

**Não há uma convenção só, e por isso nenhuma regra aqui confia numa coluna pelo nome.** O valor da linha é
`ENTRADA` (K) quando ela não é zero e `SAIDA` (L) quando é — que é o que o código sempre fez, e é o que os cartões
Entrou, Saiu e as Telas 1 e 2 usam; nada disso mudou (conferido em 29/09/2026: as 4.694 linhas dos doze arquivos de
2026 saem idênticas antes e depois). O que mudou é a leitura do **saldo corrido** (`saldosPorBanco` em `lerMesDoDfc`):
ela só aceita um número como saldo quando ele é o **saldo anterior mais o movimento da linha**, e conta quantas vezes
isso não aconteceu (`desvios`). Em 2026, nos seis meses em que não houve nenhum desvio (jan, fev, ago, set, nov, dez) a
conferência da posição de caixa com os bancos fecha **sem um centavo de sobra**; nos seis em que houve (mar, abr, mai,
jun, jul, out) ela não fecha, e a tela diz isso em vez de dar um veredito.

**Os números que nascem aqui — todos contas simples dos de cima:**

| número | conta | fonte |
|---|---|---|
| Resultado do mês | Entrou − Saiu. **É ele que diz lucro ou prejuízo** na frase e no cartão em destaque: entrou mais do que saiu, é lucro | DFC. **Corrigido em 28/09/2026:** a primeira versão punha na frase a projeção (saldo + a receber − a pagar), e em agosto, com entrou maior que saiu, ela dizia prejuízo — o "a pagar" de um mês já fechado são títulos vencidos que o Omie ainda mostra em aberto. O cartão "Saldo" da Tela 1 saiu desta tela: ele conta as transferências entre contas que entraram, e dava um terceiro número para a mesma pergunta |
| Despesas fixas pagas | soma da `SAIDA` (L) das linhas baixadas do mês cujo `SUB 2` (J) está na lista de fixas | DFC, pela lista `dados/despesas-fixas.json` |
| Fixas / receita líquida | despesas fixas ÷ receita líquida do mês | DFC nas duas pontas. A receita líquida é **a mesma conta** do cartão "% D. Func. / Rec. Líquida" da Tela 1: linhas de `SUB 2` em `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`, menos as de dedução (`SUB 2` `DEVOLUCÃO` ou `CLASS. CONTABIL` `ESTORNO`) |
| Projeção do mês | resultado do mês + ainda a receber no mês − ainda a pagar no mês, **só com o mês em andamento**; num mês fechado o cartão diz "mês fechado", e o "a pagar" vira "venceu no mês e não foi pago" | DFC + Omie. **É projeção de caixa, não lucro contábil** (esse é a Tela 2): diz se, recebendo e pagando o que vence no mês, o caixa fecha positivo ou negativo. O que já venceu e não foi recebido **não entra** — a tela o mostra à parte. **A confirmar pelo dono:** incluir ou não o vencido, e se "lucro/prejuízo" na frase deve ser esta projeção |
| A série do ano | de janeiro ao mês da tela, cada mês pela **mesma conta dos cartões** (entrou, saiu e saldo), das linhas baixadas do `FLUXO DE CAIXA` do arquivo daquele mês | DFC. **Corrigido em 28/09/2026:** a primeira versão desenhava o bloco pronto `Entradas` / `Gastos` da aba do mês (o do gráfico da Tela 1), que é outra conta da planilha — a coluna do mês não batia com os cartões, e o gráfico mostrava o ano inteiro, sem mudar com o mês escolhido |
| O mês dia a dia (pedido do dono, 28/09/2026) | um gráfico com o mês inteiro. **Consolidado** (até hoje no mês corrente; o mês inteiro num mês fechado): as linhas baixadas do `FLUXO DE CAIXA` pelo dia de `DIA PG`, a mesma conta dos cartões Entrou e Saiu. **Previsão** (de hoje ao fim do mês corrente; o mês inteiro num mês à frente; nenhuma num mês fechado): os títulos dos cartões "Ainda a receber" e "Ainda a pagar" pelo dia de vencimento (`cabecTitulo.dDtVenc` / `detalhes.dDtVenc`). A linha é a **posição de caixa**, e soma **todas** as linhas do dia (a transferência que entra compensa a que sai). Ela começa na **abertura dos bancos**: em cada bloco de banco do `FLUXO DE CAIXA`, o **saldo corrido escrito na primeira linha do bloco** — a linha de abertura, que não tem `PAGAMENTO` e por isso nunca entra no fluxo —, somado entre os bancos (`saldosPorBanco` em `lerMesDoDfc`). **A CONFERÊNCIA COM OS BANCOS É UMA PONTE, e é ela que a tela escreve embaixo do gráfico** (medida em 29/09/2026): a posição do último dia consolidado NÃO é o último `SALDO` dos bancos, e não deve ser — o saldo corrido da planilha corre até a **última linha digitada** do mês, e essas linhas finais incluem lançamentos que ainda não foram baixados, que o caixa consolidado com razão deixa de fora. A conta que fecha é:

> posição no último dia consolidado **+** o que o saldo já desconta e não está baixado **+** o baixado depois do corte **−** o que a planilha lançou depois de parar de escrever o saldo **=** o último saldo escrito, somado entre os bancos

Os dois últimos termos existem porque a planilha faz as duas coisas: em setembro de 2026 há 14 linhas ainda `A PAGAR` (ou sem `PAGAMENTO`) que o saldo já desconta, e em agosto de 2026 dois dos cinco blocos **param de escrever o saldo no meio** e seguem lançando (a STONE na linha 400, com mais de vinte lançamentos depois dela). Nos dois meses a ponte fecha em **R$ 0,00**. A tela só dá o veredito quando o saldo corrido da planilha andou exatamente com o movimento em todos os blocos; onde ele pula, ela diz que a conferência não pode ser feita naquele mês. O valor em reais dos dois lados sai só no terminal, em `node scripts/diagnostico-dia-a-dia.mjs --mes N --saldos`. **Por que não o quadro do caixa da aba do mês** (a primeira escolha, de 28/09/2026): o diagnóstico no computador do dono (`scripts/diagnostico-dia-a-dia.mjs`) mostrou que ele não é mantido — `Entradas` e `Gastos` quase sempre zero, o `Final` parado e o `Inicial` do dia 1 igual em agosto e setembro —, e a linha partia de um caixa que não existia. Sem saldo corrido na planilha, o quadro fica como reserva. Título a pagar que venceu antes de hoje sem baixa não tem dia previsto: fica fora do gráfico, e a tela diz quanto é — somado a ele, o fim da linha dá a "Projeção do mês" | DFC (consolidado) + Omie (previsão). A lista título a título sai dos mesmos cálculos dos dois cartões (`porVencimento` em `tela-1.mjs` e `tela-3.mjs`), que não mudaram de valor |
| Fora da curva | o mês se afasta da média dos meses anteriores do mesmo ano mais que um desvio-padrão deles; só com 3 meses anteriores ou mais | a série do ano, acima. **A confirmar pelo dono:** a régua de um desvio-padrão |

**A lista de fixas foi respondida pela gestora em 28/09/2026:** 33 contas fixas e 21 variáveis. A resposta veio na coluna C, com o vocabulário dela ("DESPESA FIXAS" / "DESPESA VARIAVEL"), e está guardada em `docs/despesas-fixas-respondida-2026-09-28.xlsx`. Três contas não voltaram na resposta e ficam fora das fixas até ela dizer: `COMPRA PROVISÃO`, `COMPRAS - PROVISÃO` e `CRÉDITO REPASSE - CUSTO` (`ausentesDaResposta` em `dados/despesas-fixas.json`). Em relação à sugestão que mandamos, ela pôs como fixas também impostos (INSS, ISS, IRPJ / CSLL), juros, cartão de crédito, armazenagem, mantimentos, máquinas e materiais, e deixou o seguro como variável.

**A despesa fixa não existe nas fontes.** Nem o DFC nem o Omie marcam uma despesa como fixa. Quem decide é a
gestora do financeiro (pedido do dono, 28/09/2026), respondendo `docs/despesas-fixas-para-classificar.xlsx` conta por
conta: as 55 contas de despesa do `SUB 2` da aba `BASE` (as outras 14 — receitas, saldos e transferências — ficam
numa aba à parte, para ela conferir). `node scripts/despesas-fixas.mjs <planilha respondida>` grava a resposta em
`dados/despesas-fixas.json`; vale só a coluna "Resposta da gestora", nunca a sugestão. **Enquanto a lista não for
respondida, a tela não mostra número de despesa fixa**, e diz que a classificação está pendente.

**De onde saiu cada número.** Cada cartão tem, embaixo, "de onde saiu": a frase desta tabela e, quando o número é soma
de linhas do DFC, as linhas uma a uma — o número da linha na aba `FLUXO DE CAIXA` do arquivo do mês, o dia, a
`CLASS. CONTABIL`, o `SUB 2` e o valor —, para achar cada uma de volta na planilha.

**Conferido com a fonte em 29/09/2026.** A tela foi construída numa sessão sem acesso às fontes (o cache do Omie e as
planilhas do DFC só existem no computador do dono) e testada com dados de mentira; a conferência com dado real foi feita
no computador do dono. Seis cartões são os mesmos números já conferidos das Telas 1 e 3. Os **quatro que nasceram aqui**
— "Despesas fixas pagas", "Fixas / receita líquida", "Projeção do mês" e "O mês dia a dia" — entraram em
[`docs/conferencia.md`](conferencia.md) com agosto de 2026, o mês fechado das outras, cada um com a contagem de linhas,
o filtro e a linha da planilha achada de volta numa segunda leitura crua da aba: a conferência passou a ter **40
indicadores**, e `npm run conferir-telas` compara os 40 com o que a tela mostra. A linha de "O mês dia a dia" traz também
a ponte com os bancos, banco por banco, e o veredito dela — nunca o valor.

---

## Contas a receber — o cálculo que o Fluxo de Caixa usa

**Desde 28/09/2026 esta não é mais uma tela** (virou o Fluxo de Caixa, acima). O cálculo continua inteiro em
`lib/indicadores/tela-3.mjs`: é dele que sai o "ainda a receber no mês", e as conferências seguem conferindo-o. O que
está abaixo é o contrato dele, como era.

### Tela 3 — Contas a receber (até 28/09/2026)

Referência: `referencias/tela-3-contas-a-receber.jpg`

**Filtros:** data de vencimento (de–até) · status · cliente · categoria · **empresa**.

**E o filtro de EMPRESA (decisão do dono, 27/09/2026): empresa 1, empresa 2 ou as duas** — o primeiro filtro que
atravessa as três telas. Ele escolhe quais das filiais `/0001-42` e `/0002-23` entram na soma que estas telas sempre
fizeram; as duas, ou nenhuma escolha, é a soma de sempre. Nesta tela ele vale **inteiro** — nos 4 cartões e nos 4
blocos, no valor e na contagem —, porque a tela é do Omie inteira e a leitura é feita uma vez por empresa. A única
ressalva são as duas contagens do cadastro de clientes, que continuam as duas, lado a lado. Ver
[`docs/filtros.md`](filtros.md).

A tela sai de uma chamada só: `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"`, e os quatro
filtros indo direto para a API — vencimento em `dDtVencDe` / `dDtVencAte`, status em `cStatus`, cliente em
`nCodCliente`, categoria em `cCodCateg`. O retorno traz, por título, `cabecTitulo` (o cabeçalho), `resumo`
(`cLiquidado`, `nValPago`, `nValAberto`) e `lancamentos[]` (as baixas). O mesmo dá para fazer com `financas/mf` →
`ListarMovimentos` e `cTpLancamento: "CR"`. **Decisão do dono (25/09/2026) — de-para dos oito `cStatus` do Omie para as
três faixas da tela:** **pago** = `RECEBIDO` e `LIQUIDADO`; **atrasado** = `ATRASADO`; **em aberto** = `EMABERTO`,
`AVENCER`, `VENCEHOJE` e `PAGTO_PARCIAL`; `CANCELADO` fica **fora da tela**. Fecha as duas lacunas de status: onde entram
`VENCEHOJE` e `PAGTO_PARCIAL` (os dois na faixa em aberto) e o de-para completo. No `financas/mf` o parcial se escreve
`PAGTOPARCIAL`, sem o sublinhado; é o mesmo status. Vale para os cartões e os blocos abaixo que usam faixa.

**Esta tela fica no Omie, inteira.** O DFC não entra: ele é caixa — registra o que entrou e o que saiu, não a carteira
em aberto — e não tem cadastro de cliente nem os oito `cStatus`. O que mais se aproxima é a aba `PROVISÃO`
(`CLIENTE`, `VALOR PROJETO`, `VALOR RECEBIDO`, `VALIR A RECEBER` por projeto), que é um controle manual de poucas
linhas, e a coluna `STATUS` (O) do `FLUXO DE CAIXA`, que diz se o recebimento foi `INTEGRAL`, `PARCIAL` ou `SINAL`.
Nenhum dos dois cobre a tela. Ver "O que o DFC pode alimentar e o que fica no Omie".

**Cartões no topo (4):**

| indicador | fonte | tabela/aba e filtro | cálculo | conferido |
|---|---|---|---|---|
| Valor previsto | Omie | `financas/pesquisartitulos` → `PesquisarLancamentos` com `cNatureza: "R"` e `dDtVencDe` / `dDtVencAte` no período; soma `cabecTitulo.nValorTitulo`, fora os `cStatus = "CANCELADO"` | soma dos títulos do período | |
| Valor recebido | Omie | a mesma consulta, títulos da faixa **pago** (`cStatus` `RECEBIDO` ou `LIQUIDADO`); soma `resumo.nValPago`. O `PAGTO_PARCIAL` está na faixa em aberto (decisão do dono, 25/09/2026), então a parte já paga dele não entra neste cartão | títulos com baixa total | |
| Valor pendente | Omie | a mesma consulta, títulos da faixa **em aberto** (`cStatus` `EMABERTO`, `AVENCER`, `VENCEHOJE` ou `PAGTO_PARCIAL`, decisão do dono, 25/09/2026); soma `resumo.nValAberto` | faixa em aberto | |
| Valor vencido | Omie | a mesma consulta, títulos da faixa **atrasado** (`cStatus = "ATRASADO"`); soma `resumo.nValAberto` | faixa atrasado | |

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Lançamentos por mês e status | colunas empilhadas (pago, atrasado, em aberto) | quantidade de títulos por mês | Omie | a mesma consulta; agrupa pelo ano-mês de `cabecTitulo.dDtVenc` e conta os títulos por faixa. **Decisão do dono (25/09/2026) — de-para dos oito `cStatus` do Omie (`CANCELADO`, `RECEBIDO`, `LIQUIDADO`, `EMABERTO`, `PAGTO_PARCIAL`, `VENCEHOJE`, `AVENCER`, `ATRASADO`) para as três faixas da tela:** pago = `RECEBIDO` e `LIQUIDADO`; atrasado = `ATRASADO`; em aberto = `EMABERTO`, `AVENCER`, `VENCEHOJE` e `PAGTO_PARCIAL`; `CANCELADO` fica fora da tela | **Contagem lida no Omie por vencimento em 25/09/2026 (só leitura, com tempo limite de 60 s por chamada; a leitura ficou no cache local `.cache/omie/`, fora do git):** `financas/pesquisartitulos` → `PesquisarLancamentos`, `cNatureza = "R"`, sem filtro de status (vêm os cancelados também), `dDtVencDe` / `dDtVencAte` em duas leituras, 01/01/2026 a 25/09/2026 (até hoje) e 26/09/2026 a 31/12/2026 (a vencer), com as chaves `OMIE_MEUBESS_1` e `OMIE_MEUBESS_2`; recorte da MeuBESS por `cabecTitulo.nCodCC` na lista de `dados/contas-correntes-por-negocio.json` (`negocio = "MeuBESS"`); títulos únicos por `nCodTitulo`. **Conferência feita em 25/09/2026, no cache local:** o recorte por `cabecTitulo.nCodCC` pega os mesmos títulos que o por `detalhes.nCodCC` das telas 1 e 2 (empresa 1: 17 e 17; empresa 2: 816 e 816; nenhum título num recorte e não no outro); na empresa 2, 48 títulos têm movimentos em mais de uma conta, todas da MeuBESS, então o campo difere mas o recorte não — um título pago por conta de outro negócio poderia divergir, e nenhum caso assim apareceu. **Empresa 1:** 132 títulos lidos, 17 no recorte (115 em contas de outro negócio ou sem dono dito), todos com vencimento até hoje: `CANCELADO` 8, `RECEBIDO` 9, os outros seis 0; faixas: pago 9, atrasado 0, em aberto 0, fora 8; a vencer até 31/12, nenhum. **Empresa 2:** 816 títulos lidos, todos no recorte (782 até hoje, 34 a vencer): até hoje `CANCELADO` 87, `RECEBIDO` 530, `ATRASADO` 165; a vencer `CANCELADO` 10, `RECEBIDO` 12 e 12 com o `cStatus` escrito `"A VENCER"` (ver abaixo); no total `CANCELADO` 97, `RECEBIDO` 542, `ATRASADO` 165, `"A VENCER"` 12, e `LIQUIDADO`, `EMABERTO`, `PAGTO_PARCIAL`, `VENCEHOJE` e `AVENCER` 0; faixas: pago 542, atrasado 165, em aberto 0 (mais os 12 de `"A VENCER"`), fora 97. **Empresas 1 e 2 somadas:** 833 títulos, `CANCELADO` 105, `RECEBIDO` 551, `ATRASADO` 165, `"A VENCER"` 12; faixas: pago 551, atrasado 165, em aberto 0 (mais os 12), fora 105. **`PAGTO_PARCIAL`: 0 títulos nas duas empresas** (e nenhum `ATRASADO` ou `"A VENCER"` tem valor já pago: os 177 estão com `nValPago` zerado, `nValAberto` positivo e `cLiquidado = "N"`), então hoje não há caso para a regra do cartão "Valor recebido". **Nono `cStatus`:** o Omie devolve `"A VENCER"`, com espaço, e não `AVENCER`, nos 12 títulos a vencer da empresa 2; nenhum título veio com `AVENCER` sem espaço. Pelos campos (nada pago, valor em aberto, não liquidado) é o mesmo status, então o código deve tratar `"A VENCER"` como `AVENCER`; a contagem por faixa acima deixa os 12 à parte porque o de-para do dono de 25/09/2026 cita só a grafia sem espaço. Esta contagem substitui a do cache por data de pagamento (544 títulos, todos `RECEBIDO`), que só trazia título com baixa |
| Valor previsto por cliente e status | barras horizontais empilhadas | valor por cliente, dividido por status | Omie | a mesma consulta; agrupa por `cabecTitulo.nCodCliente` somando `nValorTitulo` e separa pela faixa do `cStatus` (pago, atrasado, em aberto, pelo de-para do dono de 25/09/2026, `CANCELADO` fora); nome do cliente em `geral/clientes` → `ListarClientesResumido` | |
| Lista de títulos | tabela com total | código, cliente, categoria, descrição, valor previsto, vencimento, status | Omie | a mesma consulta, um título por linha: código `cabecTitulo.nCodTitulo` (o `cNumTitulo` **não serve** como código visível: veio vazio em 97 dos 100 títulos lidos em 24/09/2026; o número legível que sobra é o do pedido, `cNumOS` — se é esse mesmo que a tela do ERP mostra não foi conferido), cliente por `nCodCliente` em `geral/clientes` → `ListarClientesResumido`, categoria `cCodCateg` com a `descricao` de `geral/categorias` → `ListarCategorias`, valor `nValorTitulo`, vencimento `dDtVenc`, status `cStatus`. **"Descrição":** o título não tem esse campo no Omie; o pedido de venda de origem tem, e o elo é `cabecTitulo.nCodOS` (= `cabecalho.codigo_pedido`) — `produtos/pedido` → `ConsultarPedido` (`det[].produto.descricao`, `cabecalho.numero_pedido`), como na Tela 1. **Decisão do dono (25/09/2026, opção 1 da página `docs/descricao-do-titulo.html`):** a descrição é a dos produtos do pedido de venda ligado pelo `nCodOS`; pedido com vários produtos mostra a descrição do primeiro `det[]`, na ordem do pedido, seguida de "+N" com o número de produtos que ficaram de fora (um produto só: sem sufixo); título sem pedido (`cOrigem = "MANR"`, lançado à mão) usa a `descricao` da categoria `cCodCateg` que a linha já traz, que nunca vem vazia | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207), nos dois sentidos; `cNumTitulo` conferido como vazio na maioria. O número da tela, não |
| Lançamentos por status | rosca com o total no centro | quantidade e % por faixa | Omie | a mesma consulta; conta os títulos por faixa do `cStatus` (pago, atrasado, em aberto) e usa `nTotRegistros` como total do centro, sem os `CANCELADO`. Mesmo de-para do primeiro bloco (decisão do dono, 25/09/2026) | |
