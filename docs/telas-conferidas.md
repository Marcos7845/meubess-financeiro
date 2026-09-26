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

Linha que começa com **divergente:** quer dizer que os dois números não bateram; o motivo está no fim da linha. Linha
que começa com **a conferir:** quer dizer que não deu para comparar; o motivo está no fim da linha.

**36 indicadores**: 28 conferidos, 0 divergentes e 8 a conferir.

A Tela 3 ainda não foi construída. Os 8 indicadores dela aparecem abaixo, marcados "a conferir:", para a lista continuar sendo a das 3 telas inteiras.

O DFC desta rodada saiu de **pasta sincronizada**, só para leitura: a Tela 1 leu `08 - DFC AGOSTO 2026.xlsx`, e a Tela 2, que tem uma coluna por mês, leu 12 dos 12 arquivos do ano.

## Os indicadores

- **Tela 1 — Saldo.** **Na tela:** DFC 388 e Omie 419. **Na conferência:** DFC 388 e Omie 419. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 1 — Receitas.** **Na tela:** DFC 107 e Omie 120. **Na conferência:** DFC 107 e Omie 120. **Fonte:** DFC (principal) / Omie recortado (confronto).
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
- **Tela 2 — (−) Custos de vendas: custo do produto, outros custos.** **Na tela:** DFC 62 e Omie 82. **Na conferência:** DFC 62 e Omie 82. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro bruto.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Também conferido:** despesa 299. **Fonte:** mistura as duas, calculado.
- **Tela 2 — (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI.** **Na tela:** Omie 201. **Na conferência:** Omie 201. **Também conferido:** titulos1 94, baixas1 2, avulsos1 45, titulos2 4, baixas2 0, avulsos2 56. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (=) EBITDA.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (+/−) Resultado financeiro: receitas e despesas financeiras.** **Na tela:** Omie 28. **Na conferência:** Omie 28. **Também conferido:** receita1 10, receita2 3, despesa1 11, despesa2 4. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (−) Impostos pagos (guias).** **Na tela:** DFC 5 e Omie 4. **Na conferência:** DFC 5 e Omie 4. **Também conferido:** titulos 1, baixas 0, avulsos 3. **Fonte:** DFC, guias pagas (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro líquido.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (=) sem conta.** **Na tela:** Omie 21. **Na conferência:** Omie 21. **Também conferido:** empresa1 21, empresa2 0. **Fonte:** Omie recortado.
- a conferir: **Tela 3 — Valor previsto.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor recebido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor pendente.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor vencido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lançamentos por mês e status.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor previsto por cliente e status.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lista de títulos.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lançamentos por status.** **Motivo:** tela ainda não construída.
