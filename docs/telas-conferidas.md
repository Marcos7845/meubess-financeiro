# As telas conferidas contra a conferência — agosto de 2026

Gerado por [`scripts/conferir-telas.mjs`](../scripts/conferir-telas.mjs), só leitura. Uma linha por indicador das 3
telas. Para cada um, o número que **a tela mostra** e o número que **[`docs/conferencia.md`](conferencia.md) publica**
— e se os dois batem.

**O que é comparado é a CONTAGEM**, não o valor: quantos lançamentos entraram naquele indicador, de cada lado (o DFC e
o Omie). É o que prende o filtro — dois filtros diferentes quase nunca pegam o mesmo número de lançamentos. O valor em
reais aparece só na tela, lido na hora, e não entra nesta página nem em nenhum arquivo versionado.

Os números esperados são **lidos do texto** de [`docs/conferencia.md`](conferencia.md), gerado antes por
[`scripts/numeros-das-telas.mjs`](../scripts/numeros-das-telas.mjs). Os obtidos saem da **mesma camada de dados que o
navegador recebe** ([`lib/indicadores/`](../lib/indicadores/)), que filtra pelas regras de
[`lib/regras/`](../lib/regras/) — as mesmas que a conferência usa.

Onde a conferência publica a linha **repartida** — quanto veio de venda de produtos e quanto de outras receitas,
quantos títulos e quantos avulsos, quanto em cada empresa —, cada pedaço também é comparado, e aparece na linha em
**Também conferido**. Um total pode bater por acaso com a repartição errada; é o que esses pedaços fecham.

**O cadastro de clientes é conferido pela relação, não pelo tamanho.** A linha "Valor previsto por cliente e status"
não compara mais quantos clientes cada empresa tem cadastrados — esse número cresce toda vez que a MeuBESS cadastra um
cliente, e derrubava a linha a cada releitura do Omie, com os títulos intactos; o que é comparado é o que a mesma frase
da conferência afirma e que a releitura não mexe: **todos os códigos de cliente da janela estão no cadastro com nome**
(o `semNome` da linha, que é 0 quando nenhum cliente do gráfico ficou sem rótulo). O tamanho continua escrito em
[`docs/conferencia.md`](conferencia.md), como contexto.

Linha que começa com **divergente:** quer dizer que os dois números não bateram; o motivo está no fim da linha. Linha
que começa com **a conferir:** quer dizer que não deu para comparar; o motivo está no fim da linha.

**45 indicadores**: 45 conferidos, 0 divergentes e 0 a conferir.

As três telas estão construídas e nenhum indicador ficou de fora.

A **Tela 3 fica no Omie inteira** (`docs/fontes.md`): ela é a carteira de títulos a receber, e o DFC, que é caixa,
não registra carteira em aberto nem tem cadastro de cliente. Por isso as linhas dela trazem só o lado do Omie.

**Um indicador não é de agosto, e a regra de cada um explica por quê.** A faixa "em aberto" do cartão
"Valor pendente" da Tela 3 é vazia em qualquer mês fechado — os quatro `cStatus` dela são os de um título que ainda
não venceu, e num mês fechado todo título já venceu. `docs/conferencia.md` mede essa faixa noutra janela de
vencimento, 01/11/2026 a 30/11/2026, e diz na própria linha qual foi;
este teste lê a janela **do arquivo** e pede à camada de dados a mesma Tela 3 nela — a regra não muda, muda a janela.
Os outros 44 indicadores são de agosto de 2026.

O DFC desta rodada saiu de **pasta sincronizada**, só para leitura: a Tela 1 leu `08 - DFC AGOSTO 2026.xlsx`, e a Tela 2, que tem uma coluna por mês, leu 12 dos 12 arquivos do ano.

## Os indicadores

- **Tela 1 — Saldo.** **Na tela:** DFC 388 e Omie 419. **Na conferência:** DFC 388 e Omie 419. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Receitas.** **Na tela:** DFC 101 e Omie 120. **Na conferência:** DFC 101 e Omie 120. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Despesas.** **Na tela:** DFC 281 e Omie 299. **Na conferência:** DFC 281 e Omie 299. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Despesas pagas.** **Na tela:** DFC 281 e Omie 299. **Na conferência:** DFC 281 e Omie 299. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Despesas pendentes.** **Na tela:** Omie 161. **Na conferência:** Omie 161. **Fonte:** Omie recortado (principal) / DFC (confronto).
- **Tela 1 — Despesas com funcionários.** **Na tela:** DFC 109 e Omie 92. **Na conferência:** DFC 109 e Omie 92. **Fonte:** DFC (principal) / Omie recortado por categoria de pessoal (confronto).
- **Tela 1 — % desp. funcionários / receita líquida.** **Na tela:** DFC 109 e Omie 120. **Na conferência:** DFC 109 e Omie 120. **Fonte:** DFC nas duas pontas (principal) / a mesma razão no Omie recortado (confronto).
- **Tela 1 — Top 10 despesas.** **Na tela:** DFC 281 e Omie 299. **Na conferência:** DFC 281 e Omie 299. **Fonte:** DFC (principal) / Omie recortado por centro de custo (confronto).
- **Tela 1 — Top 10 receitas.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Fonte:** Omie recortado (principal) / DFC (confronto).
- **Tela 1 — Receita × despesa por dia.** **Na tela:** DFC 31 e Omie 419. **Na conferência:** DFC 31 e Omie 419. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Receita × despesa por mês.** **Na tela:** DFC 12 e Omie 419. **Na conferência:** DFC 12 e Omie 419. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — Receita total.** **Na tela:** DFC 101 e Omie 120. **Na conferência:** DFC 101 e Omie 120. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — Custos e despesas.** **Na tela:** DFC 281 e Omie 299. **Na conferência:** DFC 281 e Omie 299. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — EBITDA.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Também conferido:** receita 120, despesa 299. **Fonte:** Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto).
- **Tela 2 — Lucro líquido.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Também conferido:** receita 120, despesa 299. **Fonte:** Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto).
- **Tela 2 — Margem de lucro.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Também conferido:** receita 120, despesa 299. **Fonte:** Omie recortado, calculado a partir das linhas da tabela (principal) / DFC (confronto).
- **Tela 2 — (+) Receitas: outras receitas, vendas de produtos.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Também conferido:** venda 107, outras 13. **Fonte:** Omie recortado (principal) / DFC (confronto).
- **Tela 2 — (=) Receita bruta.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Também conferido:** contasDoDre 28, totalizadoras 9. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (−) Deduções: devoluções, taxas de serviço.** **Na tela:** DFC 2 e Omie 0. **Na conferência:** DFC 2 e Omie 0. **Também conferido:** oper13 0. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Receita líquida.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Fonte:** mistura as duas, calculado.
- **Tela 2 — (−) Custos de vendas: custo do produto, outros custos.** **Na tela:** DFC 68 e Omie 82. **Na conferência:** DFC 68 e Omie 82. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro bruto.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Também conferido:** despesa 299. **Fonte:** mistura as duas, calculado.
- **Tela 2 — (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI.** **Na tela:** Omie 198. **Na conferência:** Omie 198. **Também conferido:** titulos1 94, baixas1 2, avulsos1 42, titulos2 4, baixas2 0, avulsos2 56. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (=) EBITDA.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (+/−) Resultado financeiro: receitas e despesas financeiras.** **Na tela:** Omie 28. **Na conferência:** Omie 28. **Também conferido:** receita1 10, receita2 3, despesa1 11, despesa2 4. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (−) Impostos pagos (guias).** **Na tela:** DFC 5 e Omie 4. **Na conferência:** DFC 5 e Omie 4. **Também conferido:** titulos 1, baixas 0, avulsos 3. **Fonte:** DFC, guias pagas (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro líquido.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (=) sem conta.** **Na tela:** Omie 21. **Na conferência:** Omie 21. **Também conferido:** empresa1 21, empresa2 0. **Fonte:** Omie recortado.
- **Tela 2 — Capital de giro tomado.** **Na tela:** DFC 2 e Omie 3. **Na conferência:** DFC 2 e Omie 3. **Também conferido:** pares 2, lancamentos 3, captado 0, amortizado 3, juros 0, iof 0, contratos 3. **Fonte:** fluxo do mês: Omie recortado + DFC por `SUB 2`, sem duplicar pagamentos; saldo: CCBs Itaú pelo Anexo I e planilha para contrato sem CCB legível.
- **Tela 2 — Obrigações com clientes.** **Na tela:** Omie 78. **Na conferência:** Omie 78. **Também conferido:** pedidoCancelado 37, noInicio 58, novos 45, baixados 25. **Fonte:** Omie, sinais `ADVR` recebidos de pedidos ainda sem NF, pelo valor nominal; à parte, o repasse a clientes da aba `PROVISÃO` do DFC.
- **Tela 2 — Dívida líquida.** **Na tela:** DFC 5. **Na conferência:** DFC 5. **Também conferido:** contratos 3. **Fonte:** capital de giro tomado (CCBs Itaú e planilha) − saldo dos bancos da Tela 3 (DFC, `FLUXO DE CAIXA` do mês).
- **Tela 2 — Resultado sem dinheiro de terceiros.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Também conferido:** sinais 70. **Fonte:** lucro líquido do DRE do mês − variação dos sinais em aberto (sinais recebidos de pedidos sem NF − sinais baixados).
- **Tela 2 — Provisões por projeto.** **Na tela:** DFC 4. **Na conferência:** DFC 4. **Também conferido:** frete 0, comissao 0, comissaoHead 0, compra 4, repasse 0. **Fonte:** DFC, aba `PROVISÃO` do arquivo do mês: frete, comissão, comissão head e compra de cada projeto vendido (toda linha da aba é ainda não paga; o imposto é crédito e fica fora).
- **Tela 3 — Valor previsto.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** empresa1 0, empresa2 128, cancelados 15. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor recebido.** **Na tela:** Omie 91. **Na conferência:** Omie 91. **Também conferido:** empresa1 0, empresa2 91. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor pendente.** **Na tela:** Omie 1. **Na conferência:** Omie 1. **Também conferido:** empresa1 0, empresa2 1. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor vencido.** **Na tela:** Omie 37. **Na conferência:** Omie 37. **Também conferido:** empresa1 0, empresa2 37. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lançamentos por mês e status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** pago 91, atrasado 37, aberto 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor previsto por cliente e status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** clientes 87, semNome 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lista de títulos.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** comPedido 128, semPedido 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lançamentos por status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** pago 91, atrasado 37, aberto 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Despesas fixas pagas.** **Na tela:** DFC 119. **Na conferência:** DFC 119. **Também conferido:** contasFixasNoMes 27, contasDaGestora 33, ausentesDaResposta 3. **Fonte:** DFC, pelas contas que a gestora marcou como fixas.
- **Tela 3 — Fixas / receita líquida.** **Na tela:** DFC 119. **Na conferência:** DFC 119. **Também conferido:** receita 101, deducoes 2. **Fonte:** DFC nas duas pontas.
- **Tela 3 — Projeção do mês.** **Na tela:** DFC 382. **Na conferência:** DFC 382. **Fonte:** conta desta tela: resultado do mês (DFC) + a receber (Omie) − a pagar (Omie).
- **Tela 3 — O mês dia a dia.** **Na tela:** DFC 388. **Na conferência:** DFC 388. **Também conferido:** diasComMovimento 21, bancos 5, bancosQueFecham 5, linhasNaoBaixadasNoSaldo 4, bancosComLancamentoDepoisDoSaldo 1, ponteFecha true. **Fonte:** consolidado: DFC, as linhas baixadas do `FLUXO DE CAIXA` do mês pelo dia de `DIA PG` (a conta dos cartões Entrou e Saiu); previsão: Omie, os títulos a receber em aberto e a pagar sem baixa pelo dia de vencimento (os títulos dos cartões "Ainda a receber" e "Ainda a pagar").

## Antes e depois da correção do leitor

Medido em 29/09/2026, com as planilhas do DFC de 2026 e o mesmo cache do Omie nas duas rodadas: primeiro com o leitor
antigo, depois com o corrigido (`lerAba`, o único leitor de planilha do repositório — ver `linhasCruas` em
[`lib/regras/xlsx.mjs`](../lib/regras/xlsx.mjs)). "Linha" é a linha da planilha, na aba `FLUXO DE CAIXA` do arquivo
do mês. Nenhuma regra de indicador mudou; mudou o que a leitura entrega às regras.

| tela | indicador | o que mudou | linha da planilha que causou | motivo |
|---|---|---|---|---|
| Tela 2 | (−) Custos de vendas | agosto: **62 → 68** linhas do DFC; e as colunas de maio (+9 linhas), junho (+1) e setembro (+6) | agosto: 117, 197, 221, 257, 260 e 262; maio: 242 e 245 a 252; junho: 261; setembro: 46, 47, 48, 137, 226 e 234 | a `CLASS. CONTABIL` (`FORNECEDORES COGS`, e na 226 de setembro `COMPRA DE MERCADORIA`) era engolida pela célula vazia de `TITULO`, ao lado. A regra do custo pede a classe **e** a `SUB 2`, e a linha ficava fora |
| Tela 2 | (=) Lucro bruto, (=) EBITDA e (=) Lucro líquido | as mesmas colunas (maio, junho, agosto e setembro) e o total; contagem do Omie igual | as mesmas do custo de vendas | são subtotais abaixo do custo de vendas |
| Tela 2 | cartões EBITDA, Lucro líquido e Margem de lucro | o número de agosto e a série; contagens iguais | as 6 de agosto do custo de vendas | idem |
| Tela 2 | Resultado sem dinheiro de terceiros (Compromissos) | o número de agosto; contagens iguais | as 6 de agosto do custo de vendas | parte do lucro líquido do mês |
| Tela 2 | cartão Receita total | a coluna de abril da série; contagem de agosto igual | abril: 544 | a `SUB 2` (`RECEITA COM VENDAS`) se perdia, e a linha não entrava na receita |
| Tela 2 | cartão Custos e despesas | a coluna de julho da série (+8 linhas); contagem de agosto igual | julho: 678, 680, 683, 688, 691, 697, 711 e 713 | no cabeçalho do bloco da STONE de julho (linha 671), a célula vazia `J` engolia o rótulo `ENTRADA`, ao lado; sem ele, a leitura tomava a `SAIDA` como movimento — e a `SAIDA` vazia, pelo mesmo defeito, trazia o `SALDO`. As 8 saídas (transferências) sumiam |
| Tela 2 | Dívida líquida (Compromissos) | o saldo dos bancos que o item mostra; o número do item segue vazio (não há contrato), e a contagem, 5 blocos, é a mesma | agosto, bloco da STONE: 401, 404, 408 e 409 | a `SAIDA` das 3 primeiras era engolida, e o último saldo escrito parecia ser o da 400; lida certa, a STONE escreve o saldo até a 409 |
| Tela 3 | O mês dia a dia | linhas que o saldo desconta e não estão baixadas: **1 → 4**; bancos que lançam depois do último saldo: **2 → 1**; linhas do consolidado (388), dias com movimento (21) e bancos que fecham (5) iguais, e a ponte com os bancos continua fechando | agosto: 401, 404, 408 e 409 | as mesmas da dívida líquida: as 3 saídas sem `PAGAMENTO` passaram a ser lidas |
| Tela 3 | Agosto contra a média dos meses anteriores | a média e a variação típica de Entrou, Saiu, Resultado e Despesas fixas; o veredito de cada uma (fora da curva ou não) é o mesmo | abril: 396; julho: 674 a 710 (22 entradas) e as 8 saídas do cartão Custos e despesas | a 396 perdia a `SUB 2` (`TARIFAS BANCARIAS`, uma fixa); as 22 de julho saíam com o saldo corrido no lugar do valor, pelo cabeçalho da linha 671 |
| Tela 1 | Top 10 despesas | **22 → 24** classes distintas nas mesmas 281 linhas; a barra "(vazio)" sai, e as classes voltam para as suas barras (a lista do filtro de classe também perde o "(vazio)") | as 39 linhas de agosto que perdiam a classe (entre elas as 6 de custo e as 2 de pessoal, 3 e 309) | classe engolida pela célula vazia de `TITULO` |
| Tela 1 | filtro por classe (`docs/filtros.md`) | agosto, classe `RECEITA DE CLIENTE`: **90 → 91** linhas; as 388 linhas do mês passam de 22 a 26 classes distintas | agosto: 409 | idem; o filtro confere igual dos dois lados (19 de 19) |

**As 8 linhas de agosto numa classe de custo ou de pessoal:** as 6 de custo (117, 197, 221, 257, 260 e 262) mudaram o
custo de vendas; as 2 de pessoal (3 e 309, `FOLHA, IMPOSTOS E ADIANTAMENTOS`) **não mudaram número nenhum** — elas já
entravam pela `SUB 2` `DESPESAS CLT`, que a regra de pessoal aceita sozinha.

**O que não mudou:** Saldo, Receitas, Despesas, Despesas pagas, Despesas pendentes, Despesas com funcionários, o
percentual de funcionários, Top 10 receitas e os dois gráficos de receita × despesa da Tela 1; na Tela 2, (+) Receitas,
Receita bruta, Deduções, Receita líquida, Despesas gerais, Resultado financeiro, Impostos, "sem conta", Capital de giro
tomado, Obrigações com clientes e Provisões por projeto (esta já usava o leitor certo); na Tela 3, todos os indicadores
do Omie e os cartões Entrou, Saiu, Despesas fixas pagas, Fixas / receita líquida e Projeção do mês.

**As duas compensações do defeito saíram.** A data de uma linha era procurada também em `TIPO`, que só tinha data
porque a célula vazia dele engolia a de `VENCIMENTO` (8 linhas de abril); lida certa, `TIPO` não tem data em linha
nenhuma dos doze arquivos, e a data é `DIA PG` ou `VENCIMENTO`. E o saldo corrido era aceito em `SAIDA` (L) ou em
`SALDO` (M); lido certo, `ENTRADA` só traz número positivo, `SAIDA` só negativo, nunca os dois na mesma linha, e o
saldo é sempre `SALDO`.

**A linha vazia `<row …/>` existe de fato** nas planilhas (68 na primeira aba dos arquivos de abril a julho, 287 na `BASE` de abril, e outras nas
abas de cartão, comissão e vendas PJ), mas em nenhuma aba que as telas leem ela mudou um número: o `FLUXO DE CAIXA` não
tem nenhuma, e o quadro `Inicial` / `Entradas` / `Gastos` / `Final` da primeira aba saiu igual nos doze meses.
