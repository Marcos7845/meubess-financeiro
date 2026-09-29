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

**40 indicadores**: 40 conferidos, 0 divergentes e 0 a conferir.

As três telas estão construídas e nenhum indicador ficou de fora.

A **Tela 3 fica no Omie inteira** (`docs/fontes.md`): ela é a carteira de títulos a receber, e o DFC, que é caixa,
não registra carteira em aberto nem tem cadastro de cliente. Por isso as linhas dela trazem só o lado do Omie.

**Um indicador não é de agosto, e a regra dele explica por quê.** A faixa "em aberto" do cartão
"Valor pendente" da Tela 3 é vazia em qualquer mês fechado — os quatro `cStatus` dela são os de um título que ainda
não venceu, e num mês fechado todo título já venceu. `docs/conferencia.md` mede essa faixa noutra janela de
vencimento, 01/10/2026 a 31/10/2026, e diz na própria linha qual foi;
este teste lê a janela **do arquivo** e pede à camada de dados a mesma Tela 3 nela — a regra não muda, muda a janela.
Os outros 39 indicadores são de agosto de 2026.

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
- **Tela 2 — (−) Custos de vendas: custo do produto, outros custos.** **Na tela:** DFC 62 e Omie 82. **Na conferência:** DFC 62 e Omie 82. **Fonte:** DFC (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro bruto.** **Na tela:** Omie 120. **Na conferência:** Omie 120. **Também conferido:** despesa 299. **Fonte:** mistura as duas, calculado.
- **Tela 2 — (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI.** **Na tela:** Omie 201. **Na conferência:** Omie 201. **Também conferido:** titulos1 94, baixas1 2, avulsos1 45, titulos2 4, baixas2 0, avulsos2 56. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (=) EBITDA.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (+/−) Resultado financeiro: receitas e despesas financeiras.** **Na tela:** Omie 28. **Na conferência:** Omie 28. **Também conferido:** receita1 10, receita2 3, despesa1 11, despesa2 4. **Fonte:** Omie recortado (principal) / DFC por `SUB 2` (confronto).
- **Tela 2 — (−) Impostos pagos (guias).** **Na tela:** DFC 5 e Omie 4. **Na conferência:** DFC 5 e Omie 4. **Também conferido:** titulos 1, baixas 0, avulsos 3. **Fonte:** DFC, guias pagas (principal) / Omie recortado (confronto).
- **Tela 2 — (=) Lucro líquido.** **Na tela:** Omie 419. **Na conferência:** Omie 419. **Fonte:** Omie recortado, calculado.
- **Tela 2 — (=) sem conta.** **Na tela:** Omie 21. **Na conferência:** Omie 21. **Também conferido:** empresa1 21, empresa2 0. **Fonte:** Omie recortado.
- **Tela 3 — Valor previsto.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** empresa1 0, empresa2 128, cancelados 15. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor recebido.** **Na tela:** Omie 91. **Na conferência:** Omie 91. **Também conferido:** empresa1 0, empresa2 91. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor pendente.** **Na tela:** Omie 10. **Na conferência:** Omie 10. **Também conferido:** empresa1 0, empresa2 10. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor vencido.** **Na tela:** Omie 37. **Na conferência:** Omie 37. **Também conferido:** empresa1 0, empresa2 37. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lançamentos por mês e status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** pago 91, atrasado 37, aberto 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Valor previsto por cliente e status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** clientes 87, semNome 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lista de títulos.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** comPedido 128, semPedido 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Lançamentos por status.** **Na tela:** Omie 128. **Na conferência:** Omie 128. **Também conferido:** pago 91, atrasado 37, aberto 0. **Fonte:** Omie, títulos a receber por vencimento.
- **Tela 3 — Despesas fixas pagas.** **Na tela:** DFC 119. **Na conferência:** DFC 119. **Também conferido:** contasFixasNoMes 27, contasDaGestora 33, ausentesDaResposta 3. **Fonte:** DFC, pelas contas que a gestora marcou como fixas.
- **Tela 3 — Fixas / receita líquida.** **Na tela:** DFC 119. **Na conferência:** DFC 119. **Também conferido:** receita 101, deducoes 2. **Fonte:** DFC nas duas pontas.
- **Tela 3 — Projeção do mês.** **Na tela:** DFC 382. **Na conferência:** DFC 382. **Fonte:** conta desta tela: resultado do mês (DFC) + a receber (Omie) − a pagar (Omie).
- **Tela 3 — O mês dia a dia.** **Na tela:** DFC 388. **Na conferência:** DFC 388. **Também conferido:** diasComMovimento 21, bancos 5, bancosQueFecham 5, linhasNaoBaixadasNoSaldo 1, bancosComLancamentoDepoisDoSaldo 2, ponteFecha true. **Fonte:** consolidado: DFC, as linhas baixadas do `FLUXO DE CAIXA` do mês pelo dia de `DIA PG` (a conta dos cartões Entrou e Saiu); previsão: Omie, os títulos a receber em aberto e a pagar sem baixa pelo dia de vencimento (os títulos dos cartões "Ainda a receber" e "Ainda a pagar").
