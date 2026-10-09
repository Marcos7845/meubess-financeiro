# Auditoria independente de agosto/2026 — Omie ao vivo, 09/10/2026

Relatório sem valores em reais, nomes de pessoas ou credenciais. O auditor gerou o detalhe local em `docs/auditoria-2026-08.html` (ignorado pelo git). Esta rodada usou apenas cópias locais do DFC, dos documentos e dos extratos; não leu pastas sincronizadas e não escreveu no Omie, nas planilhas, no ERP ou no banco.

## Execução e resultado

```text
npm run auditar -- --mes 2026-08 --dfc-dir .cache/dfc-2026/B3W
47 indicadores: 22 conferidos, 9 divergentes, 16 não auditáveis
```

O Omie foi consultado ao vivo, sem `--cache-omie`, pelos métodos de leitura do auditor. Safra (3N) e Sicoob (B3N) já estavam ligados em `extratos/3N/` e `extratos/B3N/`; são conciliados em seção separada e não mudam os 47 estados do DFC B3W.

Também foi executado o comando sem `--dfc-dir`, com o mesmo resultado **22 / 9 / 16**. Esse comando escolheu a cópia plana antiga em `.cache/dfc-2026/`; a rodada válida para comparação com o espelho atual e com o portal é a de caminho explícito `B3W/`, acima. O resultado agregado igual não torna iguais as linhas dos dois DFCs: no plano antigo, a Stone tinha 9 linhas; no atual, 16.

| Rodada | Conferidos | Divergentes | Não auditáveis | Base |
|---|---:|---:|---:|---|
| 01/10 | 31 | 0 | 16 | Omie ao vivo; cópia isolada do DFC de 23/09 |
| 09/10, rodada b | 6 | 0 | 41 | Omie do cache; DFC B3W atual; Safra e Sicoob ligados |
| **09/10, rodada c** | **22** | **9** | **16** | **Omie ao vivo; DFC B3W atual; Safra e Sicoob ligados** |

Ante 01/10, nove indicadores passaram de conferidos a divergentes; os 16 não auditáveis permaneceram. Ante a rodada b, os 25 antes sem resposta direta do Omie passaram a 16 conferidos e nove divergentes. A contagem dos nove divergentes não prova que houve nove lançamentos novos: vários indicadores dependem do mesmo conjunto de movimentos.

## Nove divergentes e causa provável

O diagnóstico do auditor encontrou **dois movimentos somente na consulta mensal atual**, nenhum somente no cache anual no mês, e **um identificador com o campo `pago` diferente**. Um movimento somente atual é `1|6034369059|CONTA_A_PAGAR`. O exemplo de campo diferente é `2|5296639013|CONTA_CORRENTE_PAG`; ao repetir a mesma consulta, esse movimento coincide com o cache nos campos comparados, o que aponta para diferença de janela mensal × anual nesse caso. Não se demonstrou ainda, título a título, qual movimento explica cada divergência. Por isso a causa abaixo é provável, não um diagnóstico fechado de lançamento ou de regra.

| Indicador divergente | Causa provável a investigar |
|---|---|
| DRE `(−) Despesas gerais` | Movimentos de despesa na resposta mensal ao vivo diferem dos usados pelo cache da tela; verificar os dois movimentos só atuais e o campo `pago`. |
| DRE `(=) sem conta` | Diferença no mesmo recorte de movimentos Omie; verificar a classificação de conta dos movimentos só atuais. É um alarme sobreposto, não uma parcela adicional do DRE. |
| DRE `(=) EBITDA` | Herda a diferença de despesas gerais no totalizador. |
| DRE `(=) Lucro líquido` | Herda a diferença do EBITDA; a reconciliação por lançamento ainda falta. |
| Cartão DRE `EBITDA` | Mostra o totalizador divergente do DRE. |
| Cartão DRE `Lucro líquido` | Mostra o lucro líquido divergente do DRE. |
| Cartão DRE `Margem de lucro` | Razão afetada pelo lucro líquido divergente. |
| DRE `Resultado sem dinheiro de terceiros` | Derivado do lucro líquido; sua diferença acompanha o mesmo grupo de resultados, sem causa própria demonstrada. |
| Gestão de Contas `Despesas pendentes` | Resposta atual e cache da tela diferem no recorte do Omie; verificar pagamento e estado dos títulos ligados aos movimentos só atuais. |

As linhas `(=) EBITDA`, `(=) Lucro líquido`, os cartões EBITDA, Lucro líquido e Resultado sem dinheiro de terceiros, e Despesas pendentes têm a mesma diferença numérica nesta rodada; `(=) sem conta`, `(−) Despesas gerais` e Margem de lucro formam diferenças próprias. Isso orienta a investigação, mas não identifica a causa por lançamento.

## Dezesseis não auditáveis: dado que falta

**Stone:** o DFC B3W atual tem 16 linhas para `BANCO STONE--2` e o extrato tem 22 transações. Sobram a linha DFC **408** e três créditos do extrato (`xlsx-1`, `xlsx-2`, `xlsx-14`); a conciliação também marca abertura ou fechamento sem fechar após as diferenças de centavos aceitas. Falta resposta do dono ou da gestora se a linha 408 agrega esses três créditos, ou comprovante do recebimento da 408 e origem dos três créditos, inclusive extrato da conta principal Stone para os dois de 03/08. **Espécie:** duas linhas de `DINHEIRO--4` continuam sem prova; falta comprovante dessas linhas ou decisão do dono. A declaração de ausência de movimento não prova os lançamentos.

| Indicador não auditável | Dado necessário |
|---|---|
| Gestão de Contas `Saldo` | Conciliação Stone da linha 408 e três créditos; prova das duas linhas em espécie. |
| Gestão de Contas `Receitas` | Conciliação Stone das entradas, inclusive a 408; prova da entrada em espécie. |
| Gestão de Contas `Despesas` | Conciliação das quatro saídas Stone usadas pelo cartão; prova da saída em espécie. |
| Gestão de Contas `Despesas pagas` | Mesma prova das quatro saídas Stone e da saída em espécie. |
| Gestão de Contas `Despesas com funcionários` | Comprovante ou decisão sobre a saída em espécie. |
| Gestão de Contas `% desp. funcionários / receita líquida` | Mesma prova da saída em espécie. |
| Gestão de Contas `Top 10 despesas` | Conciliação das quatro saídas Stone; prova da saída em espécie. |
| Gestão de Contas `Receita × despesa por dia` | Conciliação Stone e prova das duas linhas em espécie para a série diária. |
| Gestão de Contas `Receita × despesa por mês` | Mesmas provas para a série mensal. |
| DRE `Receita total` | Conciliação Stone das entradas e prova da entrada em espécie. |
| DRE `Custos e despesas` | Conciliação das quatro saídas Stone e prova da saída em espécie. |
| DRE `Dívida líquida` | Conciliação Stone e prova das duas linhas em espécie que sustentam a posição de caixa. |
| Fluxo de Caixa `Despesas fixas pagas` | Comprovante ou decisão sobre a saída em espécie. |
| Fluxo de Caixa `Fixas / receita líquida` | Mesma prova da saída em espécie. |
| Fluxo de Caixa `O mês dia a dia` | Conciliação Stone e prova das duas linhas em espécie para a posição diária. |
| Fluxo de Caixa `Projeção do mês` | Nenhum dado a buscar: agosto está fechado, então não há projeção nem número a provar. |

## Conciliação separada e limites adicionais

- **Safra, 3N:** 23 linhas DFC × 26 transações; quatro linhas só no DFC (24–27) e oito transações só no extrato. Falta corrigir ou explicar as datas 24, 25 e 27, a possível repetição da 26, cinco movimentos sem linha no DFC e a abertura sem `SALDO INICIAL`.
- **Sicoob, B3N:** 72 linhas DFC × 52 transações; todas as linhas do DFC têm par, mas `pdf-5` e `pdf-6` são PIX emitido e estornado no mesmo dia sem linhas no DFC. Falta registrar ou justificar as duas transações para a conta conciliar. O bloco `BANCO ITAU--2` da B3N tem seis linhas e segue sem extrato.
- **Santander, B3W:** o PDF começa em 09/08 e traz quatro movimentos ausentes do DFC atual. Falta cobertura de 01–08/08 e explicação para os quatro movimentos.
- **Contabilidade:** continua sem balancete ou DRE do contador de agosto para a ponte por competência.

## Portal publicado

`git push origin HEAD:master` publicou `8f817d561f6e2633518d6dbe54876c70ffbeef0f`; `railway status --json` mostrou `SUCCESS` para esse commit no projeto `meubess-calc-financ`. `npm test` passou com 88 testes e `npm run typecheck` passou. `npm run conferir-no-ar -- 2026 8` confirmou as contagens pedidas **DFC 491, Receitas 155 e Receita total 141**, mas terminou com erro por **nove cartões** cuja contagem Omie difere em uma unidade de `docs/telas-conferidas.md`. A resposta do portal trouxe 426 movimentos onde o documento tem 425 e 160 despesas pendentes onde o documento tem 161. O documento esperado não foi editado: uma releitura e nova conferência com o Omie atual são necessárias para separar lançamento retroativo de cache antigo.
