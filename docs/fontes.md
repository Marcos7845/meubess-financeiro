# Fontes dos dashboards

O contrato do projeto: cada indicador das três telas, de onde vem e como é calculado. Indicador sem linha aqui não entra
na tela. "Conferido" diz o que já foi verificado contra o Omie num caso real, e o que ainda não: a data em que o número
da tela bateu com a fonte — ou, enquanto a tela não existe, quais campos foram lidos de verdade e em que leitura.

As referências (`referencias/`) valem pelo **layout e pela disposição das informações**, não pelas cores. Os números que
aparecem nelas são de exemplo — nenhum é da MeuBESS.

## As fontes

| fonte | o que é | como lemos | quem libera o acesso |
|---|---|---|---|
| ERP | **Omie** — o ERP da MeuBESS (razão social NON IMPORTACAO E DISTRIBUICAO LTDA, em **três filiais**). **Papel das empresas (dono, 24/09/2026):** a empresa 1, filial `/0001-42`, é a das **rotinas administrativas** (o escritório); a empresa 2, filial `/0002-23`, é a de **compra, venda e logística**, a principal. **As três telas mostram a soma das empresas 1 e 2 (decisão do dono, 24/09/2026).** Cada consulta roda nas **duas** chaves — `OMIE_MEUBESS_1` e `OMIE_MEUBESS_2` — e os resultados se somam; toda linha deste documento que diz "`ListarMovimentos` com tal filtro" quer dizer a mesma chamada, com o mesmo filtro, nas duas empresas. A empresa 3 (`/0003-04`) **fica fora**. Só a `/0002-23` tem os pedidos, clientes e produtos que a plataforma envia (na leitura de 24/09/2026, 783 pedidos de venda, 814 contas a receber e 1.085 contas a pagar, contra 20 / 131 / 1.529 da `/0001-42` e 0 / 0 / 17 da `/0003-04` — comparação em `docs/comparacao-chaves-omie.html`), então a descrição vinda do pedido de venda só existe para a empresa 2. O que a soma exige dos dois cadastros está medido em "A soma das empresas 1 e 2", logo abaixo. Usamos os módulos Finanças (contas a pagar, contas a receber, movimentos financeiros), Geral (categorias, departamentos, clientes, contas do DRE) e Produtos (pedido de venda) | **API REST do Omie**: `POST https://app.omie.com.br/api/v1/<serviço>/`, corpo JSON com `call`, `app_key`, `app_secret` e `param`. **Cada consulta é feita duas vezes, uma por empresa, e os resultados se somam.** As chaves estão no `.env`: a da filial `/0001-42` em **`OMIE_MEUBESS_1_APP_KEY`** / **`OMIE_MEUBESS_1_APP_SECRET`** e a da `/0002-23` em **`OMIE_MEUBESS_2_APP_KEY`** / **`OMIE_MEUBESS_2_APP_SECRET`**. A terceira, `OMIE_MEUBESS_3_…` (filial `/0003-04`), a leitura das telas não usa. Só métodos de consulta (`Listar*`, `Consultar*`, `Pesquisar*`, `Obter*`) — nenhum que inclua, altere ou exclua. Documentação: https://developer.omie.com.br/service-list/ | A chave de API (app key e app secret) é gerada pelo dono (Vitor), uma por filial; já existe um aplicativo de integração cadastrado no Omie e as três chaves estão gravadas no `.env` local |
| Planilhas | _a definir_ | _onde moram (Google Sheets, Excel no OneDrive, arquivo local)_ | _a definir_ |

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
**lacuna:** a decisão do dono (24/09/2026) é que o contador unifica os planos no Omie — mesmo código com a mesma descrição e a mesma conta do DRE nas duas empresas. **Leitura refeita em 24/09/2026** (`scripts/plano-de-contas-omie.mjs`, só leitura) depois de o contador ter avisado que unificou: **a unificação não aparece no Omie.** Os números são os mesmos da primeira leitura — 187 códigos, 86 iguais, **77 com cadastro diferente** (63 na descrição, 46 na conta do DRE, 32 nas duas), 20 só na empresa 1 e 4 só na empresa 2 — e o cadastro de categorias lido é idêntico ao da leitura anterior; só mudou a contagem de lançamentos de 2026 da empresa 1 (2.572 para 2.569). Enquanto os 77 códigos tiverem cadastro diferente, somar por categoria junta coisas distintas, e as 46 com `codigo_dre` diferente caem em linhas diferentes do DRE. A soma por categoria só vale quando uma nova leitura mostrar zero divergências; a lacuna fecha nesse dia. Os 77 que ainda divergem, por código (nome de terceiro que aparece em 3 descrições está trocado por `[terceiro]`):

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
| Top 10 receitas | barras horizontais | maiores lançamentos de receita (data, status, descrição) | Omie | `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` no período do filtro (caixa), ordenado no app por `detalhes.nValorTitulo`; data em `detalhes.dDtVenc`, status em `detalhes.cStatus`. **"Descrição":** o título do Omie não tem campo de descrição, mas o pedido de venda que o originou tem — o elo é `detalhes.nCodOS` do lançamento, que é o `cabecalho.codigo_pedido`, e com ele `produtos/pedido` → `ConsultarPedido` traz `det[].produto.descricao` (com `codigo_produto`) e `cabecalho.numero_pedido` (= `detalhes.cNumOS`). **lacuna:** (a) o que aparece como "descrição" — a descrição dos produtos do pedido, o número do pedido, `detalhes.observacao` (só vem com `lDadosCad: true`) ou a `descricao` da categoria — é decisão da MeuBESS; (b) a receita que não nasceu de pedido (`cOrigem = "MANR"`, 7 em 100 na amostra) fica sem descrição de pedido | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207); o número da tela, não |
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
| (+) Receitas: outras receitas, vendas de produtos | Omie | categorias com `conta_receita = "S"` e `totalizadora = "N"` em `geral/categorias` → `ListarCategorias`, agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CR"` e `dDtPagtoDe` / `dDtPagtoAte` (caixa). **"Vendas de produtos":** o título não diz qual produto foi vendido, o pedido de venda diz — chega-se nele por `detalhes.nCodOS` (= `cabecalho.codigo_pedido`) e `produtos/pedido` → `ConsultarPedido`, com os itens em `det[].produto` (`codigo_produto`, `descricao`, `valor_total`), o total em `total_pedido.valor_total_pedido` e a categoria do pedido em `informacoes_adicionais.codigo_categoria`. **lacuna:** (a) a quebra entre "outras receitas" e "vendas de produtos" depende de como a MeuBESS montou o plano de contas e o DRE no Omie — esses nomes não existem no cadastro padrão, e se "outras receitas" é a receita que não vem de pedido de produto é decisão dela; (b) como repartir o valor recebido de um título entre os produtos do pedido (proporcional ao `valor_total` dos itens ou o pedido inteiro numa linha) é decisão dela | ligação `nCodOS` e os campos de `det[].produto` e `total_pedido` conferidos no Omie em 24/09/2026 (pedido 827); a quebra em linhas do DRE, não |
| (=) Receita bruta | Omie (calculado) | soma das linhas de receita; no Omie a conta totalizadora é a que tem `totalizaDRE = "S"` em `geral/dre` → `ListarCadastroDRE` | |
| (−) Deduções: devoluções, taxas de serviço | Omie | **lacuna:** o Omie não marca categoria como "dedução". Há pistas — `detalhes.cOperacao = "13"` (devolução de venda) e os campos de retenção do título (`nValorPIS`, `nValorCOFINS`, `nValorCSLL`, `nValorIR`, `nValorISS`, `nValorINSS`, com o `cRet…` correspondente em `"S"`) — mas quais categorias entram nesta linha é decisão da MeuBESS | |
| (=) Receita líquida | Omie (calculado) | receita bruta − deduções; depende da lacuna da linha acima | |
| (−) Custos de vendas: custo do produto, outros custos | Omie | categorias com `conta_despesa = "S"` cujo `codigo_dre` cai na conta de custo do DRE. **lacuna:** quais são essas contas no DRE da MeuBESS — sai do cadastro dela, não do padrão do Omie | |
| (=) Lucro bruto | Omie (calculado) | receita líquida − custos de vendas | |
| (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI | Omie | categorias com `conta_despesa = "S"` agrupadas pelo `codigo_dre`; valores de `financas/mf` → `ListarMovimentos` com `cTpLancamento: "CP"` e `dDtPagtoDe` / `dDtPagtoAte` nos meses do filtro (regime de caixa, como as demais linhas da tela), fora os `cStatus = "CANCELADO"`. **Quebra por categoria do plano de contas (decisão do dono, 24/09/2026):** cada lançamento entra na linha pela categoria dele — `codigo_categoria` do lançamento, que no retorno é `detalhes.cCodCateg` (ou `categorias[].cCodCateg`, com `nDistrValor`, quando o título é rateado) — e **não** por departamento; `departamentos[]` não entra na quebra desta linha (o centro de custo segue sendo o recorte da Tela 1). O cadastro das categorias, com a conta do DRE de cada uma, está em `docs/plano-de-categorias-omie.html` | |
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
| Lista de títulos | tabela com total | código, cliente, categoria, descrição, valor previsto, vencimento, status | Omie | a mesma consulta, um título por linha: código `cabecTitulo.nCodTitulo` (o `cNumTitulo` **não serve** como código visível: veio vazio em 97 dos 100 títulos lidos em 24/09/2026; o número legível que sobra é o do pedido, `cNumOS` — se é esse mesmo que a tela do ERP mostra não foi conferido), cliente por `nCodCliente` em `geral/clientes` → `ListarClientesResumido`, categoria `cCodCateg` com a `descricao` de `geral/categorias` → `ListarCategorias`, valor `nValorTitulo`, vencimento `dDtVenc`, status `cStatus`. **"Descrição":** o título não tem esse campo no Omie; o pedido de venda de origem tem, e o elo é `cabecTitulo.nCodOS` (= `cabecalho.codigo_pedido`) — `produtos/pedido` → `ConsultarPedido` (`det[].produto.descricao`, `cabecalho.numero_pedido`), como na Tela 1. **lacuna:** o que aparece como "descrição" é decisão da MeuBESS, e título sem pedido (`cOrigem = "MANR"`) fica sem ela | ligação `nCodOS` conferida no Omie em 24/09/2026 (pedido 827 ↔ título 5298681207), nos dois sentidos; `cNumTitulo` conferido como vazio na maioria. O número da tela, não |
| Lançamentos por status | rosca com o total no centro | quantidade e % por status | Omie | a mesma consulta; conta os títulos por `cStatus` e usa `nTotRegistros` como total do centro. Mesma lacuna de de-para do primeiro bloco | |
