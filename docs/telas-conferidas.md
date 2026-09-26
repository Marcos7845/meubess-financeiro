# As telas conferidas contra a conferência — agosto de 2026

Gerado por [`scripts/conferir-telas.mjs`](../scripts/conferir-telas.mjs), só leitura. Uma linha por indicador das 3
telas. Para cada um, o número que **a tela mostra** e o número que **[`docs/conferencia.md`](conferencia.md) publica**
— e se os dois batem.

**O que é comparado é a CONTAGEM**, não o valor: quantos lançamentos entraram naquele indicador, de cada lado (o DFC e
o Omie). É o que prende o filtro — dois filtros diferentes quase nunca pegam o mesmo número de lançamentos. O valor em
reais aparece só na tela, lido na hora, e não entra nesta página nem em nenhum arquivo versionado.

Os números esperados são **lidos do texto** de [`docs/conferencia.md`](conferencia.md), gerado antes por
[`scripts/numeros-das-telas.mjs`](../scripts/numeros-das-telas.mjs). Os obtidos saem da **mesma camada de dados que o
navegador recebe** ([`lib/indicadores/tela-1.mjs`](../lib/indicadores/tela-1.mjs)), que filtra pelas regras de
[`lib/regras/`](../lib/regras/) — as mesmas que a conferência usa.

Linha que começa com **divergente:** quer dizer que os dois números não bateram; o motivo está no fim da linha. Linha
que começa com **a conferir:** quer dizer que não deu para comparar; o motivo está no fim da linha.

**36 indicadores**: 11 conferidos, 0 divergentes e 25 a conferir.

As Telas 2 e 3 ainda não foram construídas — esta tarefa fez a Tela 1. Os indicadores delas aparecem abaixo, marcados
"a conferir:", para a lista continuar sendo a das 3 telas inteiras.

O DFC desta rodada saiu de **pasta sincronizada**, arquivo `08 - DFC AGOSTO 2026.xlsx`, só para leitura.

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
- a conferir: **Tela 2 — Receita total.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — Custos e despesas.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — EBITDA.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — Lucro líquido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — Margem de lucro.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (+) Receitas: outras receitas, vendas de produtos.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) Receita bruta.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (−) Deduções: devoluções, taxas de serviço.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) Receita líquida.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (−) Custos de vendas: custo do produto, outros custos.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) Lucro bruto.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) EBITDA.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (+/−) Resultado financeiro: receitas e despesas financeiras.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (−) Impostos pagos (guias).** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) Lucro líquido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 2 — (=) sem conta.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor previsto.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor recebido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor pendente.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor vencido.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lançamentos por mês e status.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Valor previsto por cliente e status.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lista de títulos.** **Motivo:** tela ainda não construída.
- a conferir: **Tela 3 — Lançamentos por status.** **Motivo:** tela ainda não construída.
