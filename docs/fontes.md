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

Toda consulta roda nas duas chaves e os resultados se somam. Medido no Omie em 24/09/2026 por
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

**2. Lançamentos entre as duas empresas, que contariam duas vezes na soma: 3 em 2026.** Os três foram lidos na empresa 2
e têm a `/0001-42` como contraparte (`detalhes.cCPFCNPJCliente` com a mesma raiz de CNPJ, filial diferente): 2 a receber,
na categoria `1.01.01` "RECEITA DE VENDA DE PRODUTOS", e 1 a pagar, na `2.01.03` "Compras de Materia Prima". Lidos na
empresa 1, **zero** — nenhum lançamento de 2026 dela tem outra filial como contraparte, então esses três não aparecem
espelhados do outro lado. Nenhum dos dois lados usa categoria marcada como transferência (`transferencia = "S"`) em
2026. **lacuna:** se esses lançamentos saem da soma, entram inteiros ou entram de um lado só é decisão da MeuBESS.

**3. Departamentos: os mesmos 16 nomes nas duas empresas, e nenhum código em comum.** A empresa 1 tem 16 departamentos,
todos ativos, e a empresa 2 também; os 16 nomes são os mesmos dos dois lados, mas **zero** códigos coincidem — o
`cCodDepartamento` é próprio de cada empresa. Os da empresa 1, com os lançamentos de 2026: DIRETORIA (619), INSIDE SALES
(252), TI (152), RH (98), COMERCIAL (75), MARKETING (67), COMPRAS (54), ESTOQUE (52), FACILITIES (32), ADMINISTRATIVO
(20), MEU BESS (18), FISCAL (12), FINANCEIRO (8), CONTÁBIL (8), LOGÍSTICA (4) e OPERACIONAL (0). Sem departamento:
1.142 lançamentos na empresa 1 e 1.138 na empresa 2. **lacuna:** o filtro de centro de custo da Tela 1 tem de casar os
dois cadastros pelo nome (o código não serve) ou tratar cada empresa em separado — a MeuBESS decide qual.

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
  lançamento avulso entram à mão. Título com `cOrigem = "MANR"` fica sem descrição de pedido.

O que o pedido **não** é: não traz data de pagamento nem quanto já foi recebido, então não substitui o
`ListarMovimentos` nos números (o regime de caixa continua no título). Ele entra só onde o título não responde —
descrição e produto — e essas linhas dizem "pedido de venda" na coluna de filtro.

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
  `FORNECEDORES COGS`, `PESSOAL PJ`, `REEMBOLSO`, `DESPESA PJ`, `OUTRAS DESPESAS`, `FOLHA, IMPOSTOS E ADIANTAMENTOS`,
  `IMPOSTOS E CONTRIBUIÇÕES`, `COMPRA DE MERCADORIA`, `DESPESA CLT`, `ESTORNO`, `REPASSE`, `RESCISÃO`,
  `REPASSE CREDITO`, `TRANSFERENCIA`, `TRANSFERÊNCIA`, `CARTÃO DE CREDITO`, `SEGURO`, `EMPRÉSTIMO`,
  `RETIRADA DE SÓCIO`, `ADIANTAMENTO JURÍDICO`, `ALUGUEL` (`TRANSFERENCIA` e `TRANSFERÊNCIA` são a mesma coisa escrita
  de dois jeitos).
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
arquivos.

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
dono aprovou a proposta da seção 7 de [`docs/confronto-dfc-omie.html`](confronto-dfc-omie.html) em 24/09/2026. Nenhuma
linha deste resumo é candidatura em aberto: ele diz o que existe no DFC, e "A escolha entre Omie e DFC", mais abaixo,
diz quem leva cada indicador. O resumo:

| tela | o que o DFC pode alimentar | aba e coluna/linha |
|---|---|---|
| 1 | Saldo, Receitas, Despesas, Despesas pagas, Despesas pendentes | `FLUXO DE CAIXA`: `ENTRADA` (K) e `SAIDA` (L), com o mês vindo de `DIA PG` (F) — ou de `VENCIMENTO` (E) no caso do pendente; `PAGAMENTO` (N) separa `PAGO` / `RECEBIDO` / `A PAGAR` |
| 1 | Despesas com funcionários e o % sobre a receita | `FLUXO DE CAIXA`: `CLASS. CONTABIL` (I) e `SUB 2` (J) nomeiam pessoal na própria linha — o Omie não marca isso |
| 1 | Top 10 despesas e Top 10 receitas | `FLUXO DE CAIXA` agrupado por `CLASS. CONTABIL` (I) ou `SUB 2` (J); a descrição da receita já está em `FORNECEDOR / CLIENTE` (G), `TITULO` (H) e `OBS:` (Q) |
| 1 | Receita × despesa por dia e por mês | aba do mês, linhas `Entradas` (43) e `Gastos` (44), um dia por coluna de `D` a `AH` — o bloco já existe pronto |
| 2 | Receita total, Custos e despesas, Lucro líquido, Margem | `FLUXO DE CAIXA` por `CLASS. CONTABIL` (I) — `FORNECEDORES COGS` é custo e `FORNECEDORES G&A` é despesa geral; e a aba do mês já traz `Receitas` (B15), `Gastos` (B20) e `Lucro Liquido` (B25), **de caixa** |
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
  das telas e uma **proposta** de fonte principal e confronto para cada indicador com a antiga **lacuna: Omie ou DFC**.
  A página é [`docs/confronto-dfc-omie.html`](confronto-dfc-omie.html) — é onde ficam os valores em reais. **Essa
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
  por `B3W` e `N3` e não diz qual é qual.
- **O Omie tem outras unidades de negócio no mesmo CNPJ, e elas não são a MeuBESS** (explicação do dono, 24/09/2026; o DFC das três outras unidades foi lido em 24/09/2026 por `scripts/confronto-dfc-omie.mjs`, só leitura, e está em [`docs/confronto-dfc-omie.html`](confronto-dfc-omie.html)). **O único campo do Omie que separa é a conta corrente** (`detalhes.nCodCC`). Departamento **não** separa (a árvore inteira pende de uma raiz só, `MEU BESS`, e os filhos são setores), categoria, projeto e vendedor também não. **Esta lacuna está fechada:** o dono disse de que negócio é cada conta corrente, a lista está em `dados/contas-correntes-por-negocio.json` e é ela que as telas aplicam — ver "O recorte da MeuBESS: quais contas correntes são dela", logo abaixo. Nenhuma outra lacuna deste documento mudou, e nenhuma fonte foi trocada por causa disto.

### O recorte da MeuBESS: quais contas correntes são dela

**De onde vem a lista.** Do dono, em 24/09/2026, em resposta à pergunta de que negócio é cada conta corrente da tabela da
seção 4 de [`docs/confronto-dfc-omie.html`](confronto-dfc-omie.html). **Não** foi deduzida de movimento, de nome de banco nem de
nenhuma leitura: o Omie só forneceu o cadastro das contas (`nCodCC`, `descricao`, `codigo_banco`, `tipo_conta_corrente`,
`inativo`), por `geral/contacorrente` → `ListarContasCorrentes` nas duas chaves, só leitura.

**Onde ela mora.** Em [`dados/contas-correntes-por-negocio.json`](../dados/contas-correntes-por-negocio.json) — é de lá que o
código dos dashboards lê, e é de lá que `scripts/confronto-dfc-omie.mjs` lê. Uma linha por conta do cadastro do Omie (43 linhas,
somando as duas empresas), com a chave `empresa|nCodCC`, a descrição ao lado e o campo `negocio`. `recorte_das_telas` diz qual
negócio as telas mostram: `MeuBESS`.

| negócio | o que o dono disse | contas |
|---|---|---|
| **MeuBESS** — o recorte das telas | Itaú (empresas 1 e 2), Cora, cartão Itaú 1106, Banco Implementação, Adiantamento de Cliente, Stone, Banco do Brasil (empresas 1 e 2) e Caixinha | 14 |
| MX3 | todas as contas Sicoob, inclusive a `Sicoob - B3N`, e o cartão Itaú 6826 | 5 |
| 3N Capital | Safra e o cartão Itaú 9120 | 3 |
| **sem dono dito** | o que o dono não citou | 21 |

**Como as telas aplicam.** Toda leitura de `financas/mf` das Telas 1 e 2 guarda só os lançamentos cujo `detalhes.nCodCC` está na
lista com `negocio = "MeuBESS"`. Conta **sem dono dito** fica **fora** do recorte, e o código **não adivinha pelo nome do banco**:
conta corrente nova aparece no cadastro do Omie sem dono e fica fora do número da tela até o dono dizer de quem é. Das contas com
movimento em 2026, seguem sem dono dito `Adiantamento ao Fornecedor` (empresas 1 e 2 — a maior delas, e quase toda fora do filtro
`cTpLancamento: "CPCR"`), `Santander` (empresa 1), `Aplicação financeira Banco do Brasil` (empresa 1), `CARTÃO B3W CORA (4309)`
(empresa 1) e `Bradesco` (empresa 1).

**O que o recorte mede** (leitura de 24/09/2026, janeiro a setembro): ele pega 1.938 dos 2.148 lançamentos do Omie no período
(90,2%) e 99,3% do dinheiro movimentado. Do lado do casamento com o DFC, a taxa do lado do Omie vai de 59,4% (sem recorte, contra
o CNPJ inteiro) para 65,3% (com recorte). A leitura empírica da página — que marca cada conta pela unidade do DFC com que os
lançamentos dela casaram — **concorda com a lista do dono em todas as contas que ela consegue julgar, e não a contradiz em
nenhuma**; nas contas pequenas ela não tem casados suficientes para opinar, e quem responde é o dono.

**O que o recorte não resolve, e não é lacuna deste documento.** Ele acaba com a contaminação (o número do Omie deixa de ser o do
CNPJ inteiro) e **não** aproxima as duas fontes: com os dois lados só da MeuBESS, o DFC fica acima do Omie do lado das saídas em 6
dos 7 meses comparáveis. A causa é o filtro `cTpLancamento: "CPCR"` e a cobertura do ano, medidos nas seções 4, 5 e 7 da página —
e a escolha entre as duas fontes **foi feita pelo dono em 24/09/2026**, sobre esses mesmos números — ver "A escolha
entre Omie e DFC", logo abaixo. Ela não apaga a diferença: escolhe de qual lado vem o número da tela e manda o outro
lado para o selo de confronto. A Tela 3 lê
títulos (`financas/contareceber`), não movimentos, e o recorte dela não fazia parte desta rodada.

### A escolha entre Omie e DFC (decisão do dono, 24/09/2026)

**O que foi decidido.** Em 24/09/2026 o dono aprovou, em uma palavra ("sim"), a proposta da seção 7 de
[`docs/confronto-dfc-omie.html`](confronto-dfc-omie.html) (commit `4c20aad`). Com isso **as 21 lacunas "Omie ou DFC"
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
| 1 | Despesas com funcionários | DFC | Omie recortado, por departamento | não |
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
| 2 | (−) Deduções | DFC | Omie recortado (`cOperacao` 13 e retenções) | não |
| 2 | (−) Custos de vendas | DFC | Omie recortado, pela lista de categorias que o dono decidiu (25/09/2026) | não |
| 2 | (−) Despesas gerais | **Omie recortado** (quebra por categoria) | DFC por `SUB 2` | não |
| 2 | (−) Impostos | DFC (guias pagas) | Omie recortado (`cTipo` e retenções) | não |

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
  caixa, e precisa cobrir o ano) e a linha é do Omie (é a única com quebra por produto). O cartão bate com o de
  "Receitas" da Tela 1, que é o que as duas telas precisam mostrar igual.

**O que esta decisão não fecha.** Ela escolhe **de onde vem** cada número, não **o que** cada número mede. Seguem em
aberto, e cada uma está escrita na linha do indicador a que pertence: quais departamentos são "de funcionários"; o que
fazer com despesa sem rateio de departamento; o que aparece como "descrição" no Top 10 receitas; quais categorias são
depreciação, amortização e resultado financeiro; a quebra entre "outras receitas" e "vendas de produtos" e como
repartir o valor de um título entre os produtos; quais categorias do Omie são dedução; quais contas do DRE são de
custo; e se a linha de impostos mede a retenção ou a guia paga. Várias delas encolheram — passaram a valer só para a
coluna de confronto, porque no lado principal a classificação já vem escrita na linha do DFC —, mas nenhuma foi
respondida por esta decisão.

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
| Saldo | **DFC** / confronto: Omie recortado | **Principal — DFC:** aba `FLUXO DE CAIXA` do arquivo do mês, na pasta do DFC **da MeuBESS**: `ENTRADA` (K) menos `SAIDA` (L), pelo mês de `DIA PG` (F). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CPCR"` e `dDtPagtoDe` / `dDtPagtoAte` no mês, fora os `detalhes.cStatus = "CANCELADO"`, guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"` em `dados/contas-correntes-por-negocio.json`. Selo ao lado do valor acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | receitas − despesas do período | |
| Receitas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, coluna `ENTRADA` (K), somada pelo mês de `DIA PG` (F). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` (ou `cNatureza: "R"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês; soma `detalhes.nValorTitulo`, fora os `CANCELADO`, com o recorte da MeuBESS por `detalhes.nCodCC`. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das receitas do período | |
| Despesas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, coluna `SAIDA` (L), pelo mês de `DIA PG` (F) — a classificação vem escrita na própria linha. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` (ou `cNatureza: "P"`) e `dDtPagtoDe` / `dDtPagtoAte` no mês, fora os `CANCELADO`, com o recorte da MeuBESS por `detalhes.nCodCC`. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das despesas do período | |
| Despesas pagas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) das linhas com `PAGAMENTO` (N) = `PAGO`, pelo mês de `DIA PG` (F). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` e `dDtPagtoDe` / `dDtPagtoAte` no mês; soma `resumo.nValPago` (cobre também o `PAGTOPARCIAL`), com o recorte da MeuBESS por `detalhes.nCodCC`. O `nValPago` é o único dos dois lados que separa o pagamento parcial — por isso ele entra no **tooltip** do cartão, e não como número da tela. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas com baixa no período | |
| Despesas pendentes | **Omie recortado** / confronto: DFC (só jan–set) | **Principal — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtVencDe` / `dDtVencAte` no mês (exceção ao caixa: sem baixa não há data de pagamento) e `resumo.cLiquidado = "N"` (equivale a `cStatus` em `EMABERTO`, `AVENCER`, `VENCEHOJE`, `ATRASADO`, `PAGTOPARCIAL`); soma `resumo.nValAberto`, com o recorte da MeuBESS por `detalhes.nCodCC`. **Confronto — DFC, só nos meses fechados:** `SAIDA` (L) das linhas com `PAGAMENTO` (N) = `A PAGAR`, pelo mês de `VENCIMENTO` (E) — a mesma exceção ao caixa. De outubro a dezembro o DFC só tem provisão e **não** tem carteira, então o selo aparece só de janeiro a setembro. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas sem baixa, vencendo no período | |
| Despesas com funcionários | **DFC** / confronto: Omie recortado, por departamento | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) das linhas de pessoal, pelo mês de `DIA PG` (F) — a classificação já vem na linha, em `CLASS. CONTABIL` (I: `FOLHA, IMPOSTOS E ADIANTAMENTOS`, `PESSOAL PJ`, `DESPESA CLT`, `DESPESA PJ`, `RESCISÃO`) e em `SUB 2` (J: `DESPESAS CLT`, `DESPESAS PJ`, `PRÓ-LABORE ( retirada de sócio )`, `COMISSÃO DE VENDAS`, `REEMBOLSO`). **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtPagtoDe` / `dDtPagtoAte` no mês e `cExibirDepartamentos: "S"`; soma `departamentos[].nDistrValor` dos códigos de pessoal, com o recorte da MeuBESS aplicado antes. **lacuna:** quais departamentos são "de funcionários" — o Omie não marca departamento como de pessoal, e a lista é decisão da MeuBESS (na referência seriam "funcionários do escritório" e "funcionários de obra"). **Enquanto ela não vier, o confronto do Omie não aparece** e o cartão mostra só o DFC; a lacuna deixou de travar o número da tela, porque a classificação que ela pedia já está escrita na linha do DFC. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | despesas de pessoal do período (no DFC, pela classificação da linha; no confronto, pelos centros de custo de pessoal) | |
| % desp. funcionários / receita líquida | **DFC nas duas pontas** / confronto: a mesma conta no Omie recortado | **Principal — DFC:** numerador, a linha acima. Denominador, a receita líquida do mesmo mês de caixa montada no DFC — `ENTRADA` (K) das linhas de receita menos as linhas de dedução (`SUB 2` (J) = `DEVOLUCÃO`, `CLASS. CONTABIL` (I) = `ESTORNO`) —, que é a linha "(=) Receita líquida" da Tela 2. **Confronto:** a mesma razão feita toda no Omie recortado; o selo herda a **maior** das duas diferenças. As duas pontas passam a vir da mesma fonte e do mesmo recorte, que era o defeito antigo desta linha. Quais categorias são dedução: **decisão do dono (24/09/2026)**, a lista das 12 categorias, com os códigos por empresa, registrada na linha "(−) Deduções" da Tela 2 (ICMS, PIS, COFINS, ISS RETIDO, devoluções de vendas e Reembolso por cancelamento). Ela pesa no denominador do **confronto** do Omie; no número da tela não, porque no DFC a dedução vem marcada na própria linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | desp. funcionários ÷ receita líquida | |

Mais um botão **Fluxo de caixa** (leva à visão de fluxo, fora do escopo agora).

**Blocos:**

| bloco | forma | indicador | fonte | tabela/aba e filtro | conferido |
|---|---|---|---|---|---|
| Top 10 despesas | barras horizontais | as 10 maiores despesas do período, por classificação | **DFC** / confronto: Omie recortado, por centro de custo | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) no período do filtro por `DIA PG` (F), agrupada por `CLASS. CONTABIL` (I — 24 valores na leitura de setembro) ou por `SUB 2` (J — as 69 contas da aba `BASE`); pega as 10 maiores. No DFC cada linha tem **uma** classificação só, então não há rateio a repartir. **Confronto — Omie recortado, por centro de custo,** num seletor "ver por centro de custo (Omie)" ao lado do título: `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"`, `dDtPagtoDe` / `dDtPagtoAte` no período e `cExibirDepartamentos: "S"`; o recorte da MeuBESS por `detalhes.nCodCC` entra **antes** de agrupar — é o que impede uma despesa grande de outra unidade de subir no Top 10 —, e só então se somam os `departamentos[].nDistrValor` por `cCodDepartamento`; nome em `geral/departamentos` → `ListarDepartamentos` (`codigo` → `descricao`). **lacuna:** o que fazer com despesa sem rateio de departamento (ficar de fora, ou virar "sem centro de custo") — decisão da MeuBESS. Vale agora só para o seletor do Omie; as barras da tela não dependem dela. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| Top 10 receitas | barras horizontais | maiores lançamentos de receita (data, status, descrição) | **Omie recortado** / confronto: DFC | **Principal — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` no período do filtro (caixa), guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`; ordena no app por `detalhes.nValorTitulo`; data em `detalhes.dDtVenc`, status em `detalhes.cStatus`. Aqui quem decide é o **cadastro** — cliente e pedido de venda —, que só o Omie tem; e é exatamente aqui que um cliente de outra unidade apareceria nomeado no Top 10 da MeuBESS, o que o recorte impede. **"Descrição":** o título do Omie não tem campo de descrição, mas o pedido de venda que o originou tem — o elo é `detalhes.nCodOS` do lançamento, que é o `cabecalho.codigo_pedido`, e com ele `produtos/pedido` → `ConsultarPedido` traz `det[].produto.descricao` (com `codigo_produto`) e `cabecalho.numero_pedido` (= `detalhes.cNumOS`). **Confronto — DFC:** as linhas de `FLUXO DE CAIXA` com `CLASS. CONTABIL` (I) = `RECEITA DE CLIENTE`, ordenadas por `ENTRADA` (K); é de lá que a descrição cai quando o pedido de venda não responde, porque ali ela já está na própria linha — `FORNECEDOR / CLIENTE` (G), o número do projeto em `TITULO` (H) e o texto livre de `OBS:` (Q). **lacuna:** (a) o que aparece como "descrição" — a descrição dos produtos do pedido, o número do pedido, `detalhes.observacao` (só vem com `lDadosCad: true`) ou a `descricao` da categoria — é decisão da MeuBESS; (b) a receita que não nasceu de pedido (`cOrigem = "MANR"`, 7 em 100 na amostra) fica sem descrição de pedido, e é o caso em que o DFC responde. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207); o número da tela, não |
| Receita × despesa por dia | colunas (receita acima, despesa abaixo) | totais diários no mês escolhido | **DFC** / confronto: Omie recortado | **Principal — DFC:** aba do mês do arquivo da pasta da MeuBESS (`JANEIRO2026`, `FEVEREIRO`, `Mrço2026`, ` 2026` de abril em diante), linhas `Entradas` (43) e `Gastos` (44), uma coluna por dia de `D` a `AH`, com `Inicial` (42) e `Final` (45) do dia — o bloco já existe pronto na planilha, e com ele o gráfico deixa de sumir em janeiro e fevereiro. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CPCR"` e `dDtPagtoDe` / `dDtPagtoAte` no mês, com o recorte da MeuBESS por `detalhes.nCodCC`; agrupa pelo dia de `detalhes.dDtPagamento` e separa por `detalhes.cNatureza`. O dia com diferença acima de **5%** ganha traço pontilhado. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| Receita × despesa por mês | duas linhas | totais mensais, com seletor de meses anteriores | **DFC** / confronto: Omie recortado | **Principal — DFC:** um arquivo por mês na pasta da MeuBESS, somando as linhas `Entradas` (43) e `Gastos` (44) da aba do mês, na faixa do seletor. É a série do ano inteiro, e **só o DFC cobre o ano** — janeiro a setembro de 2026 com movimento, outubro a dezembro só com provisão (ver "As planilhas de fluxo de caixa (DFC) de 2026"). **Confronto — Omie recortado:** a mesma chamada do bloco de cima com `dDtPagtoDe` / `dDtPagtoAte` cobrindo a faixa do seletor, agrupada por ano-mês de `detalhes.dDtPagamento`, desenhada em cinza claro atrás; a legenda diz a diferença média em %. Somar aqui as quatro pastas do DFC, ou o Omie sem recorte, seria comparar grupo com unidade. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |

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
| Receita total | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `ENTRADA` (K) das linhas de receita (`SUB 2` (J) = `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`), somada pelo mês de `DIA PG` (F) — ou, pronta, a linha `Receitas` (B15) da aba do mês. É o **mesmo número** do cartão "Receitas" da Tela 1, de propósito: as duas telas mostram a mesma receita. **Confronto — Omie recortado:** `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (caixa), fora os `CANCELADO`, com o recorte da MeuBESS por `detalhes.nCodCC`. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das linhas de receita do `FLUXO DE CAIXA` no mês de caixa — **não** é mais a soma da linha "(+) Receitas" da tabela abaixo, que ficou no Omie; ver "A escolha entre Omie e DFC" | |
| Custos e despesas | **DFC** / confronto: Omie recortado | **Principal — DFC:** `SAIDA` (L) de `FLUXO DE CAIXA` da pasta da MeuBESS agrupada por `CLASS. CONTABIL` (I), pelo mês de `DIA PG` (F): `FORNECEDORES COGS` é custo e `FORNECEDORES G&A` é despesa geral — **essa separação só existe no DFC**, o Omie não a faz sozinho. Pronta e sem a separação, é a linha `Gastos` (B20) da aba do mês. **Confronto — Omie recortado:** a mesma leitura da tela (`dDtPagtoDe` / `dDtPagtoAte`) com `cTpLancamento: "CP"` e o recorte da MeuBESS por `detalhes.nCodCC`, contra o total. Selo acima de 2%. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | soma das linhas de custos, despesas gerais e impostos | |
| EBITDA | **Omie recortado (calculado)** / confronto: DFC, só no resultado financeiro | **Principal — Omie recortado:** as linhas da tabela abaixo, com o recorte da MeuBESS por `detalhes.nCodCC` já aplicado na leitura — o EBITDA deixa de ser o do CNPJ inteiro. **Confronto — DFC, parcial:** o DFC **não** ajuda na depreciação nem na amortização, porque nenhuma das duas sai do caixa e não existe linha para elas nas planilhas; o resultado financeiro, sim — `SUB 2` (J) em `JUROS`, `RENDIMENTO FINANCEIRO`, `EMPRESTIMO`, `TARIFAS BANCÁRIAS`. Como o confronto é parcial, este cartão **não leva selo de %**: leva nota de rodapé dizendo que depreciação e amortização não existem no DFC. **lacuna:** quais categorias são depreciação, amortização e resultado financeiro — o Omie não marca isso, e o `codigo_dre` só diz em que conta do DRE a categoria cai. Sem essa lista o EBITDA não se distingue do lucro operacional. Há uma **sugestão** de lista, feita pelo nome e pela conta do DRE de cada categoria, em [`docs/categorias-do-dre.html`](categorias-do-dre.html) — é sugestão, e **não fecha esta lacuna**. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC (parcial)"; ver "A escolha entre Omie e DFC" | receita líquida − custos − despesas operacionais, antes de juros, impostos, depreciação e amortização | |
| Lucro líquido | **Omie recortado (calculado)** / confronto: DFC (lucro de caixa) | **Principal — Omie recortado:** as linhas da tabela abaixo — o lucro do DRE depende de **cadastro** (categoria e conta do DRE), que só o Omie tem. **Confronto — DFC:** o `Lucro Liquido` pronto da linha 25 (`B25`) da aba do mês, na pasta da MeuBESS, que é lucro **de caixa** (entradas menos saídas do mês), sem deduções, sem impostos por competência e sem depreciação. Aparece numa segunda linha do cartão, rotulado "lucro de caixa", **sem selo de %** — são contas diferentes, e comparar as duas em % não diria nada. O recorte entra nos dois lados: no DFC ele é a pasta da MeuBESS, no Omie é o `detalhes.nCodCC`. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | receita líquida − custos − despesas gerais − impostos | |
| Margem de lucro | **Omie recortado (calculado)** / confronto: DFC | **Principal — Omie recortado:** o lucro líquido do cartão ao lado dividido pela receita das linhas de receita da tabela abaixo — os **dois** termos do Omie recortado, para a razão não misturar fontes. **Confronto — DFC:** a mesma razão feita com os números do DFC (lucro de caixa ÷ receita do `FLUXO DE CAIXA`). O recorte entra nos dois termos; sem ele a margem saía distorcida duas vezes. Continua herdando a lacuna de depreciação e amortização do cartão de EBITDA. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | lucro líquido ÷ receita | |

**Tabela:** uma coluna por mês (realizado e AH com seta) e o total do período. Linhas agrupadas, abrindo e fechando:

| linha | fonte | contas do plano / abas | conferido |
|---|---|---|---|
| (+) Receitas: outras receitas, vendas de produtos | **Omie recortado** / confronto: DFC | **Principal — Omie recortado:** categorias com `conta_receita = "S"` e `totalizadora = "N"` em `geral/categorias` → `ListarCategorias`, agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` (caixa), guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`. Fonte mantida — ao contrário do cartão "Receita total" — porque aqui quem decide é a **quebra por produto**, que só o pedido de venda do Omie tem; o recorte impede que produto de outra unidade entre na linha. **"Vendas de produtos":** o título não diz qual produto foi vendido, o pedido de venda diz — chega-se nele por `detalhes.nCodOS` (= `cabecalho.codigo_pedido`) e `produtos/pedido` → `ConsultarPedido`, com os itens em `det[].produto` (`codigo_produto`, `descricao`, `valor_total`), o total em `total_pedido.valor_total_pedido` e a categoria do pedido em `informacoes_adicionais.codigo_categoria`. **Confronto — DFC:** as linhas de `FLUXO DE CAIXA` da pasta da MeuBESS com `SUB 2` (J) em `RECEITA COM VENDAS`, `RECEITA COM SERVIÇOS`, `OUTRAS RECEITAS`, `REEMBOLSO RECEITA`, `RENDIMENTO FINANCEIRO`, `REPASSE` e `REPASSE - CREDITO`, pelo mês de `DIA PG` (F); selo acima de 2%. A quebra por produto não existe lá: a linha aponta o projeto (`TITULO`, coluna H), não o produto. **lacuna:** (a) a quebra entre "outras receitas" e "vendas de produtos" depende de como a MeuBESS montou o plano de contas e o DRE no Omie — esses nomes não existem no cadastro padrão, e se "outras receitas" é a receita que não vem de pedido de produto é decisão dela; (b) como repartir o valor recebido de um título entre os produtos do pedido (proporcional ao `valor_total` dos itens ou o pedido inteiro numa linha) é decisão dela. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | ligação `nCodOS` e os campos de `det[].produto` e `total_pedido` conferidos no Omie em 24/09/2026 (pedido 827); a quebra em linhas do DRE, não |
| (=) Receita bruta | **Omie recortado (calculado)** | soma das linhas de receita acima; no Omie a conta totalizadora é a que tem `totalizaDRE = "S"` em `geral/dre` → `ListarCadastroDRE`. Segue a fonte da linha "(+) Receitas", que é o Omie recortado | |
| (−) Deduções: devoluções, taxas de serviço | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS — a devolução vem marcada na **própria linha**: `SUB 2` (J) = `DEVOLUCÃO`, com `ESTORNO` em `CLASS. CONTABIL` (I) —, pelo mês de `DIA PG` (F). É exatamente o que falta no Omie, que não marca categoria como "dedução". **Confronto — Omie recortado,** numa segunda coluna "retido no título": `detalhes.cOperacao = "13"` (devolução de venda) e os campos de retenção do título (`nValorPIS`, `nValorCOFINS`, `nValorCSLL`, `nValorIR`, `nValorISS`, `nValorINSS`, com o `cRet…` correspondente em `"S"`). Na leitura de 24/09/2026 **nenhum** lançamento do Omie recortado no período trazia `cOperacao = "13"`, então o confronto se apoia só nas retenções. **Decisão do dono (24/09/2026), resposta "c" à pergunta do grupo (a) de [`docs/categorias-do-dre.html`](categorias-do-dre.html) — categorias do Omie que são dedução da receita:** **empresa 1** — `2.06.01` ICMS, `2.06.03` PIS SOBRE VENDAS, `2.06.04` COFINS SOBRE VENDAS, `2.06.07` ISS RETIDO, `2.09.01` Devoluções de Vendas de Mercadoria, `2.09.02` Devoluções de Vendas de Serviços Prestados; **empresa 2** — `2.06.01` ICMS, `2.06.03` PIS A RECOLHER, `2.06.04` COFINS A RECOLHER, `2.06.07` ISS RETIDO, `2.09.01` Devoluções de Vendas de Mercadoria, `2.09.02` Devoluções de Vendas de Produtos, `2.02.97` Reembolso por cancelamento. São as 10 sugeridas do grupo (a) mais ISS RETIDO (nas duas empresas) e Reembolso por cancelamento (só na empresa 2): 12 categorias, que dão 13 códigos por empresa (6 na empresa 1 e 7 na 2, porque ISS RETIDO existe nas duas). A lista vale para a **coluna de confronto**, não para o número da tela, que o DFC marca na linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) Receita líquida | **mistura as duas** (calculado) | receita bruta (Omie recortado, linha acima) − deduções (DFC, linha acima). **É a soma que a decisão de 24/09/2026 deixou com uma fonte de cada lado** — consequência aritmética da escolha por linha, não uma escolha nova; está marcada em "A escolha entre Omie e DFC" para o dono ver. O denominador do cartão "% desp. funcionários / receita líquida" da Tela 1 **não** usa esta linha: lá as duas pontas são do DFC | |
| (−) Custos de vendas: custo do produto, outros custos | **DFC** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `FORNECEDORES COGS` ou `COMPRA DE MERCADORIA` e `SUB 2` (J) em `COMPRAS DE MERCADORIAS`, `FRETE E CARRETO` e `ARMAZENAGEM E MANUSEIO`. **Confronto — Omie recortado, pela lista de categorias abaixo (decisão do dono, 25/09/2026), e não por `codigo_dre`:** os lançamentos de `ListarMovimentos` com `cTpLancamento: "CP"` cujo `detalhes.cCodCateg` está na lista, com o recorte por `detalhes.nCodCC`; selo acima de **5%**. Era a linha menos contaminada de todas — as outras unidades quase não têm custo de mercadoria, vendem serviço —, então o recorte muda pouco aqui, e isso é esperado. **Decisão do dono (25/09/2026), resposta "c" à pergunta do grupo (b) de [`docs/categorias-do-dre.html`](categorias-do-dre.html) — categorias do Omie que são custo de vendas:** **empresa 1 (22 códigos)** — `2.01.01` Compras de Mercadorias para Revenda, `2.01.02` Fretes s/ compras, `2.01.03` Compras de Materia Prima, `2.01.04` Compra de Serviços, `2.01.82` Uniformes e equipamentos de Segurança - Custo (estoque), `2.01.83` Terceiros e Estagiários - Custo (estoque), `2.01.84` Outros Benefícios - Custo (estoque), `2.01.85` Seguro de Vida - Custo (estoque), `2.01.86` Vale Refeição - Custo (estoque), `2.01.87` Vale Transporte - Custo (estoque), `2.01.88` Assistência Médica e social - Custo (estoque), `2.01.89` Pensão Alimentícia - Custo (estoque), `2.01.90` IRRF S/ Salários - Custo (estoque), `2.01.91` FGTS - Custo (estoque), `2.01.92` INSS - Custo (estoque), `2.01.93` 13º Salário - Custo (estoque), `2.01.94` Rescisões - Custo (estoque), `2.01.95` Férias - Custo (estoque), `2.01.96` Adiantamento de Salário (custo), `2.01.97` Salários - Custo (estoque), `2.01.99` Gás para empilhadeira - Custos, `2.04.88` Armazém e Manuseio; **empresa 2 (13 códigos)** — `2.01.01` Compras de Mercadorias para Revenda, `2.01.02` Fretes s/ compras, `2.01.03` Compras de Materia Prima, `2.01.04` Compra de Serviços, `2.01.90` Vigilância e Monitoramento - Custos, `2.01.91` Locação de Máquinas e Equipamentos - Custos, `2.01.93` Seguros de carga - Custo, `2.01.94` IPTU - Custo, `2.01.95` Telefone e Internet - Custo, `2.01.97` Água e Esgoto - Custo, `2.01.98` Aluguel - Custo, `2.01.99` CUSTO DOS PRODUTOS VENDIDOS, `2.08.99` Reembolso - Custo. São **35 códigos** (22 na empresa 1 e 13 na 2): as **18 sugeridas** do grupo (b) — as duas pistas concordavam, nome e conta do DRE — mais **17 que a página apontava como "em dúvida" e que têm movimento no período, todas apontadas só pelo nome** (compras de matéria-prima e de mercadorias para revenda, fretes sobre compras e os gastos com "Custo" no nome: aluguel, IPTU, locação de máquinas, seguros de carga, vigilância, telefone, água, salários, uniformes, terceiros, reembolso-custo, armazém e manuseio). **Ficaram de fora:** as 2 em dúvida apontadas só pela conta do DRE — `2.08.99` OUTRAS DESPESAS e `2.08.98` Reembolso, da empresa 1 — e as 6 em dúvida sem movimento no período. **Várias dessas categorias estão hoje numa conta de despesa do DRE no Omie** (Despesas Variáveis, Despesas Administrativas, Despesas com Pessoal) ou sem conta do DRE; **a tela reclassifica pela lista, e não pela conta do DRE em que a categoria está pendurada** — o lançamento vai para "(−) Custos de vendas" pelo código da categoria, e sai da linha de despesas gerais. Vale para a coluna de confronto, não para o número da tela, que o DFC marca na linha. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) Lucro bruto | **mistura as duas** (calculado) | receita líquida (linha acima, que já mistura) − custos de vendas (DFC). Mesma observação da linha "(=) Receita líquida": é consequência aritmética da decisão de 24/09/2026, e está marcada em "A escolha entre Omie e DFC" | |
| (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI | **Omie recortado** / confronto: DFC por `SUB 2` | **Principal — Omie recortado:** categorias com `conta_despesa = "S"` agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (regime de caixa, como as demais linhas da tela), fora os `cStatus = "CANCELADO"`, guardando só os lançamentos cujo `detalhes.nCodCC` tem `negocio = "MeuBESS"`. **Quebra por categoria do plano de contas (decisão do dono, 24/09/2026):** cada lançamento entra na linha pela categoria dele — `codigo_categoria` do lançamento, que no retorno é `detalhes.cCodCateg` (ou `categorias[].cCodCateg`, com `nDistrValor`, quando o título é rateado) — e **não** por departamento; `departamentos[]` não entra na quebra desta linha (o centro de custo segue sendo o recorte da Tela 1). O cadastro das categorias, com a conta do DRE de cada uma, está em `docs/plano-de-categorias-omie.html`. A fonte ficou no Omie porque essa quebra por categoria é decisão do dono e só o Omie a tem; o recorte era indispensável aqui, porque as categorias são as mesmas nas quatro unidades — quem separa é a conta corrente. **Confronto — DFC,** numa coluna "no DFC" ao lado, linha a linha: `CLASS. CONTABIL` (I) = `FORNECEDORES G&A`, quebrado pelas contas de `SUB 2` (J) — o cadastro da aba `BASE`, coluna A, com 69 contas em setembro. **Decisão do dono (24/09/2026)** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (−) Impostos | **DFC (guias pagas)** / confronto: Omie recortado | **Principal — DFC:** `FLUXO DE CAIXA` da pasta da MeuBESS, `SAIDA` (L) pelo mês de `DIA PG` (F), com `CLASS. CONTABIL` (I) = `IMPOSTOS E CONTRIBUIÇÕES` e `SUB 2` (J) em `ISS`, `INSS` e `IRPJ / CSLL`. **Confronto — Omie recortado:** as guias, que entram como conta a pagar e se reconhecem por `detalhes.cTipo` (`DAS`, `DRF`, `GUIA`) ou pela categoria de imposto, com o recorte por `detalhes.nCodCC`; selo acima de **5%**, e a retenção no título (`nValorPIS`, `nValorCOFINS`, `nValorCSLL`, `nValorIR`, `nValorISS`, `nValorINSS`) numa nota, porque só o Omie a tem. No período inteiro o Omie recortado tem um punhado de lançamentos com `cTipo` em `DAS` / `DRF` / `GUIA`, contra dezenas de linhas de imposto no DFC — o que reforçou a escolha. **lacuna:** o que esta linha do DRE deve medir — (a) os impostos **retidos** no próprio título ou (b) as **guias pagas** — continua sendo decisão da MeuBESS. Com o DFC como fonte principal o número da tela é hoje o (b), porque o DFC não registra retenção; mas se a linha deveria medir (a), isso a decisão de fonte não responde. **Decisão do dono (24/09/2026) sobre a fonte** — fecha a lacuna "Omie ou DFC"; ver "A escolha entre Omie e DFC" | |
| (=) EBITDA / lucro líquido | **Omie recortado (calculado)** | segue os dois cartões de EBITDA e Lucro líquido do topo, que são do Omie recortado. **lacuna:** a referência junta os dois numa linha só e eles não são a mesma coisa. Qual dos dois a linha mostra (ou se vira duas linhas) é decisão da MeuBESS; o EBITDA ainda depende da lacuna de depreciação, amortização e resultado financeiro do cartão | |
| (=) sem conta | **Omie recortado** | os lançamentos cujas categorias não têm `codigo_dre` no cadastro da própria empresa — 13 categorias na empresa 1 (355 lançamentos) e 1 na empresa 2 (111), medidas em 24/09/2026 e listadas em "A soma das empresas 1 e 2". Mesma leitura das demais linhas: `financas/mf` → `ListarMovimentos` com `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro e o recorte da MeuBESS por `detalhes.nCodCC`; entram aqui os lançamentos cuja `detalhes.cCodCateg` cai numa categoria com `codigo_dre` vazio. **Decisão do dono (24/09/2026):** eles ganham esta linha própria em vez de serem repartidos nas outras ou deixados de fora. A linha fica no fim da tabela e **fora dos totalizadores** do DRE, e serve de alarme — enquanto tiver valor, há lançamento que o DRE não está classificando. Esvazia sozinha se o contador preencher o `codigo_dre` no Omie | |

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

**Esta tela fica no Omie, inteira.** O DFC não entra: ele é caixa — registra o que entrou e o que saiu, não a carteira
em aberto — e não tem cadastro de cliente nem os oito `cStatus`. O que mais se aproxima é a aba `PROVISÃO`
(`CLIENTE`, `VALOR PROJETO`, `VALOR RECEBIDO`, `VALIR A RECEBER` por projeto), que é um controle manual de poucas
linhas, e a coluna `STATUS` (O) do `FLUXO DE CAIXA`, que diz se o recebimento foi `INTEGRAL`, `PARCIAL` ou `SINAL`.
Nenhum dos dois cobre a tela. Ver "O que o DFC pode alimentar e o que fica no Omie".

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
| Lista de títulos | tabela com total | código, cliente, categoria, descrição, valor previsto, vencimento, status | Omie | a mesma consulta, um título por linha: código `cabecTitulo.nCodTitulo` (o `cNumTitulo` **não serve** como código visível: veio vazio em 97 dos 100 títulos lidos em 24/09/2026; o número legível que sobra é o do pedido, `cNumOS` — se é esse mesmo que a tela do ERP mostra não foi conferido), cliente por `nCodCliente` em `geral/clientes` → `ListarClientesResumido`, categoria `cCodCateg` com a `descricao` de `geral/categorias` → `ListarCategorias`, valor `nValorTitulo`, vencimento `dDtVenc`, status `cStatus`. **"Descrição":** o título não tem esse campo no Omie; o pedido de venda de origem tem, e o elo é `cabecTitulo.nCodOS` (= `cabecalho.codigo_pedido`) — `produtos/pedido` → `ConsultarPedido` (`det[].produto.descricao`, `cabecalho.numero_pedido`), como na Tela 1. **lacuna:** o que aparece como "descrição" é decisão da MeuBESS, e título sem pedido (`cOrigem = "MANR"`) fica sem ela | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207), nos dois sentidos; `cNumTitulo` conferido como vazio na maioria. O número da tela, não |
| Lançamentos por status | rosca com o total no centro | quantidade e % por status | Omie | a mesma consulta; conta os títulos por `cStatus` e usa `nTotRegistros` como total do centro. Mesma lacuna de de-para do primeiro bloco | |
