# Causa por lançamento das divergências de agosto/2026 — 09/10/2026

Responde ao que `docs/auditoria-agosto-2026-10-09c.md` deixou como "causa provável": os **9 indicadores divergentes**
da auditoria ao vivo de agosto e os **9 cartões** com contagem do Omie diferente em uma unidade no
`npm run conferir-no-ar -- 2026 8`. Sem valores em reais, nomes de pessoas ou credenciais. Só leitura do Omie
(`chamarOmie` com `gravar: false`, métodos `ListarMovimentos` e `ListarCategorias`); nada escrito no Omie, no DFC ou
nas planilhas; a pasta sincronizada não foi lida (DFC do espelho `.cache/dfc-2026/B3W`).

## Resposta curta

A hipótese se confirma: **a diferença é toda entre o Omie atual e o cache da tela, e são só duas mudanças feitas no
Omie depois da gravação do cache local (páginas de `ListarMovimentos` gravadas em 05/10/2026, 10:48–10:55 de
Brasília)**. Nenhuma das duas é defeito de regra da tela nem do auditor:

1. **Baixa retroativa de um título a pagar** — empresa **1**, título **`6034369059`** (`cOrigem` `MANP`, documento
   fiscal 1809), categoria **`2.01`**, emissão 03/08/2026, vencimento e pagamento **25/08/2026**, conta corrente
   `5969611697` (MeuBESS). No cache estava `ATRASADO`, `cLiquidado = N`, sem pagamento; no Omie atual está `PAGO`, com
   a baixa `6060588259` (movimento de conta corrente `6060588256`, `cOrigem` `BAXP`). O código da baixa é posterior a
   todos os do cache: ela foi lançada depois de 05/10, com data de 25/08.
2. **Conta do DRE preenchida no cadastro de categorias** — na empresa **1**, 22 categorias que estavam com
   `codigo_dre` vazio no cache passaram a ter conta do DRE no Omie. Seis delas têm lançamento pago em agosto no recorte
   da MeuBESS; cinco ganharam conta e uma (`2.01`) continua vazia.

**Onde está o erro: no cache.** A tela publicada já alcançou o Omie (o portal mostra 426 movimentos e 160 despesas
pendentes, a mesma contagem da consulta ao vivo). O cache local e os documentos gerados dele
(`docs/conferencia.md`, `docs/telas-conferidas.md`: 425 e 161) são de antes das duas mudanças.

**No auditor havia um defeito de diagnóstico** (não de valor): a comparação "Omie atual × cache" usava a chave
`empresa|nCodMovCC|cGrupo`, que junta as linhas de uma baixa em lote. Daí o falso "campo `pago` diferente" em
`2|5296639013|CONTA_CORRENTE_PAG` — é um lote de quatro títulos (`5277067956`, `5277076477`, `5277086881`,
`5277057192`, pagos em 28/08/2026), e a comparação pegava uma linha diferente do lote de cada lado. Além disso, o
diagnóstico não comparava a leitura do cartão "Despesas pendentes" (CP por vencimento) nem o cadastro de categorias, e
por isso não conseguia dizer a causa por lançamento. Corrigido neste commit (ver "Correção no auditor").

## Os 9 indicadores divergentes da auditoria

| Indicador | Lançamento(s) que explica(m) | Onde está o erro |
|---|---|---|
| DRE `(−) Despesas gerais` | Empresa 1, título `6034369059`, categoria `2.01` (`conta_despesa = S`, fora das listas de custo, financeiro, fora do DRE e retirada), pago em 25/08/2026: entra como 141º lançamento (o cache tem 140). | cache |
| DRE `(=) sem conta` | Duas causas. (a) Cadastro: na empresa 1, `codigo_dre` preenchido em `2.10.99` (7 títulos, ex. `5981017232`), `2.01.03` (8, ex. `6035092271`), `2.08.01` (3, ex. `6042080011`), `2.01.01` (1, `1589788375`) e `2.03.96` (1, `6041576334`) — 20 lançamentos que saem do alarme. (b) O título `6034369059` entra, porque `2.01` segue sem conta do DRE. Cache: 21 lançamentos; Omie atual: 2 (`6033100844` e `6034369059`, ambos `2.01`, empresa 1, pagos em 28/08 e 25/08). | cache (cadastro de categorias) |
| DRE `(=) EBITDA` | Herda a despesa geral a mais do título `6034369059`. | cache |
| DRE `(=) Lucro líquido` | Herda o EBITDA (título `6034369059`). | cache |
| Cartão DRE `EBITDA` | O mesmo do `(=) EBITDA`. | cache |
| Cartão DRE `Lucro líquido` | O mesmo do `(=) Lucro líquido`. | cache |
| Cartão DRE `Margem de lucro` | Lucro líquido menor, receita igual (título `6034369059`); a diferença é de centésimos de ponto percentual. | cache |
| DRE `Resultado sem dinheiro de terceiros` | Lucro líquido − variação dos sinais: herda o título `6034369059`; os sinais não mudaram. | cache |
| Gestão de Contas `Despesas pendentes` | O mesmo título `6034369059`, vencimento 25/08: na leitura CP por vencimento passou de `ATRASADO`/`cLiquidado = N` a `PAGO`/`S` e sai do cartão (161 → 160). | cache |

A mudança de `codigo_dre` não mexe em nenhuma outra linha: o DRE das telas separa custo, despesa geral, financeiro,
retirada e fora do DRE pelo **código da categoria** (`cCodCateg`, listas de `lib/regras/listas.mjs`), e só o alarme
"(=) sem conta" olha o `codigo_dre`. Despesas gerais, EBITDA e lucro diferem pelo valor de um único título.

## Os 9 cartões com contagem diferente em uma unidade (`conferir-no-ar`)

Todos pelo mesmo título, empresa 1, `6034369059`, categoria `2.01`, pago em 25/08/2026:

| Tela · cartão | Portal | `docs/telas-conferidas.md` | Por quê |
|---|---|---|---|
| 1 · Saldo | Omie 426 | 425 | o título pago entra na leitura de caixa do mês |
| 1 · Despesas | Omie 300 | 299 | idem, saída |
| 1 · Despesas pagas | Omie 300 | 299 | idem |
| 1 · Despesas pendentes | Omie 160 | 161 | deixou de estar em aberto |
| 2 · Custos e despesas | Omie 300 | 299 | idem Despesas |
| 2 · EBITDA | Omie 426 | 425 | lançamentos do mês que o DRE lê |
| 2 · Lucro líquido | Omie 426 | 425 | idem |
| 2 · Margem de lucro | Omie 426 | 425 | idem |
| 3 · A pagar | Omie 160 | 161 | mesma leitura CP de Despesas pendentes |

As contagens do DFC (491, 327, 326) batem; a diferença é só no Omie. **Erro no documento esperado / cache local**,
não na tela publicada.

## Como se provou

- Script local fora do git (`.cache/investigar-divergentes.mjs`): lê as páginas anuais do cache como a tela e a mesma
  pergunta mensal que o auditor faz ao vivo, compara por `empresa|cGrupo|nCodMovCC|nCodTitulo|nCodBaixa` e recalcula
  o DRE independente (`scripts/auditoria/dre.mjs`) dos dois lados. Resultado: movimentos no mês 867 (cache) × 869
  (vivo) — os dois a mais são o título e a baixa de `6034369059`; leitura CP no mês 370 × 370, com esse título como
  único alterado; nenhuma chave repetida no cache. Com o cadastro de categorias do cache nos dois lados, só
  Despesas gerais, EBITDA, lucro, margem, sem conta e pendentes mudam, e sempre por esse título (141 × 140; 160 × 161).
- Leitura do cadastro `ListarCategorias` ao vivo × cache: 22 categorias da empresa 1 com `codigo_dre` antes vazio e
  agora preenchido; `conta_despesa`, `conta_receita`, `transferencia` e `totalizadora` iguais.
- `npm run auditar -- --mes 2026-08 --dfc-dir .cache/dfc-2026/B3W` depois da correção: os mesmos 22 / 9 / 16, e agora
  cada divergente traz no motivo o título e as categorias acima.
- `npm run conferir-no-ar -- 2026 8`: os 9 cartões acima, e só eles, com Omie ±1.

## Correção no auditor

- `scripts/auditoria/core.mjs`: `chaveOmie` (inclui `nCodTitulo` e `nCodBaixa`, as linhas do lote não colidem),
  `camposOmie`, `compararOmie` (só registros do mês dos dois lados), `descreverOmie` (empresa, título, grupo,
  categoria, datas e status, sem valor) e `compararCategorias`.
- `scripts/auditar.mjs`: a comparação passa a cobrir também a leitura CP por vencimento e o cadastro de categorias; o
  motivo de cada divergente de `financas/mf` lista os lançamentos e categorias que separam o Omie atual do cache, e o
  "Resultado sem dinheiro de terceiros" diz que herda o lucro líquido.
- Testes em `scripts/auditoria/core.test.mjs`: lote em ordem diferente não é alteração; baixa retroativa aparece como
  "só na resposta atual" e "alterado" na leitura CP; conta do DRE preenchida aparece no cadastro.

## O que falta (não feito aqui)

- **Reler o cache local e regerar a conferência.** `npm run conferencia` vai parar na trava de agosto, porque agosto
  mudou (este título e o cadastro de categorias, além da parada já registrada pelas entradas EXTR da Stone). Refixar a
  trava é com o dono ciente (`node scripts/numeros-das-telas.mjs --refazer-trava`); depois `npm run conferir-telas`
  regrava `docs/telas-conferidas.md` com 426/300/160 e o `conferir-no-ar` volta a bater.
- `docs/fontes.md` ("A regra de '(=) sem conta' não mudou") ainda diz que `2.08.01` e `2.10.99` estão sem
  `codigo_dre`; no Omie de 09/10 já têm. A regra não muda, só o fato medido; atualizar quando a conferência for refeita.
- O título `6034369059` está numa categoria de grupo (`2.01`) sem conta do DRE; quem o tira do alarme é o financeiro,
  reclassificando-o ou preenchendo a conta no Omie.
