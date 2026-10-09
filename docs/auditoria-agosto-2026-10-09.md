# Auditoria independente de agosto/2026 — rodada de 09/10/2026

Relatório sem valores em reais nem nomes: só contagens, linhas, datas e códigos. O detalhe com valores fica no HTML
local `docs/auditoria-2026-08.html` (ignorado pelo git), gerado nesta rodada.

## Como rodou

```
npm run auditar -- --mes 2026-08 --cache-omie --dfc-dir .cache/dfc-2026/B3W
```

- **Omie lido do cache local, não ao vivo.** O pedido proibia ler o Omie, e o modo padrão do auditor consulta o Omie
  diretamente. Com `--cache-omie` nenhuma chamada sai da máquina, mas, por desenho do auditor
  (`scripts/auditar.mjs`, motivo "Omie lido do cache local; falta resposta direta desta execução"), **todo indicador
  que depende do Omie fica "não auditável"**. A última gravação do cache do Omie é de 07/10/2026.
- **DFC:** o espelho local atual da B3W (`.cache/dfc-2026/B3W/08 - DFC AGOSTO 2026.xlsx`, de 08/10/2026), que já tem
  as mudanças da Stone, das datas e da N3. A rodada de 01/10 usou a cópia isolada `.cache/auditoria-dfc-2026`, de 23/09.
- **Extratos:** os CSV já convertidos em `extratos/` (Itaú, Banco do Brasil, Santander e Stone de agosto). Os
  documentos vêm da cópia local `.cache/master-2026-08`. Não li a pasta master nesta rodada.
- **O que foi escrito:** o auditor regrava `docs/auditoria-2026-08.html` (ignorado pelo git). O HTML de 01/10 foi
  guardado antes em `.cache/auditoria-2026-08-rodada-2026-10-01.html`. Nada foi escrito no Omie, nas planilhas, na
  master nem no cache do app.

## Resultado: 47 indicadores — 6 conferidos, 0 divergentes, 41 não auditáveis

| tela | conferidos | divergentes | não auditáveis |
|---|---|---|---|
| Gestão de Contas | 0 | 0 | 11 |
| DRE | 6 | 0 | 18 |
| Fluxo de Caixa | 0 | 0 | 12 |
| **total** | **6** | **0** | **41** |

**Conferidos (6):** (−) Custos de vendas, (−) Deduções, (−) Impostos pagos, Capital de giro tomado, Provisões por
projeto e Resultado sem dinheiro de terceiros.

### Comparação com a rodada de 01/10/2026 (31 / 0 / 16, Omie ao vivo)

| | 01/10 (Omie ao vivo, DFC de 23/09) | 09/10 (Omie do cache, DFC de 08/10) |
|---|---|---|
| conferidos | 31 | 6 |
| divergentes | 0 | 0 |
| não auditáveis | 16 | 41 |

- **Os 25 que saíram de "conferido" mudaram de estado por um único motivo: o Omie veio do cache, não de resposta
  direta.** Não houve divergência. São eles:
  - **DRE:** (+) Receitas, (=) Receita bruta, (=) Receita líquida, (=) Lucro bruto, (−) Despesas gerais,
    (=) EBITDA, (+/−) Resultado financeiro, (=) Lucro líquido, (=) sem conta, Retirada de sócio, Fora do DRE:
    implantação de saldos, os cartões EBITDA, Lucro líquido e Margem de lucro, e Obrigações com clientes.
  - **Fluxo de Caixa:** Valor previsto, Valor recebido, Valor pendente, Valor vencido, Lançamentos por mês e status,
    Lançamentos por status, Valor previsto por cliente e status e Lista de títulos.
  - **Gestão de Contas:** Despesas pendentes e Top 10 receitas.
- A rodada controlada de 01/10 no mesmo modo (`--cache-omie`) também deu **6 / 0 / 41**
  (`docs/auditoria.md`, seção "Agrupamento da maquininha e julho"). **No modo cache, o número não mudou.**
- **Os 16 não auditáveis de 01/10 continuam não auditáveis.** O motivo agora é outro, pela mudança do DFC da Stone
  (abaixo).
- Para comparar com os 31 de 01/10, falta uma rodada com o Omie ao vivo (`npm run auditar -- --mes 2026-08
  --dfc-dir .cache/dfc-2026/B3W`), que esta tarefa não podia fazer.

### Os 41 não auditáveis, por motivo

| grupo | quantos | motivo | dado que falta |
|---|---|---|---|
| dependem do Omie | 25 | Omie lido do cache local | resposta direta do Omie nesta execução (rodada ao vivo) |
| caixa com Stone e espécie: Saldo, Receitas, Receita total, O mês dia a dia, Receita × despesa por dia e por mês, Dívida líquida | 7 | 16 linhas de `BANCO STONE--2` (extrato não concilia) e 1 ou 2 linhas de `DINHEIRO--4` | Stone: ver "Caixa, conta a conta". Espécie: comprovante das 2 linhas de `DINHEIRO--4` ou decisão do dono |
| despesas com Stone e espécie: Despesas, Despesas pagas, Top 10 despesas, Custos e despesas | 4 | 4 linhas da Stone e 1 de `DINHEIRO--4` sem prova bancária | o mesmo da linha acima |
| só espécie: Despesas com funcionários, % funcionários, Despesas fixas pagas, Fixas / receita líquida | 4 | 1 linha de `DINHEIRO--4` sem prova | comprovante da linha em espécie ou decisão do dono |
| Projeção do mês | 1 | só existe em mês aberto; agosto está fechado | nenhum (não há número a provar) |

Total: 25 + 7 + 4 + 4 + 1 = 41.

**Diferença em relação a 01/10 nos 16:** Despesas, Despesas pagas, Top 10 despesas e Custos e despesas dependiam
só da espécie. Agora dependem também de 4 linhas da Stone, porque o DFC ganhou as saídas da Stone. As linhas de
Stone que entram no caixa passaram de 9 para 16.

## Caixa, conta a conta (DFC B3W × extratos)

| conta (bloco do DFC) | extrato | linhas DFC | transações extrato | casadas | só no DFC | só no extrato | abertura e fechamento | estado |
|---|---|---|---|---|---|---|---|---|
| `ITAU--1` | PDF, 01–31/08, 21 saldos conferidos | 377 | 347 | 327 exatas, 3 com data deslocada, 11 lotes, 1 lote do dia | 0 | 0 | fecham | **concilia** |
| `BANCO STONE--2` | Comprovante de Extrato, 01–31/08, 22 saldos conferidos | 16 | 22 | 3 exatas, 1 com data deslocada, 5 lotes, 2 com diferença de centavos, 7 agrupamentos de maquininha | 1 (linha 408) | 3 | **não fecham** | **não concilia** |
| `BANCO DO BRASIL--3` | PDF, mês 08 | 0 | 0 | — | 0 | 0 | fecham (sem movimento) | **concilia** |
| `DINHEIRO--4` | não há | 2 | — | — | — | — | — | **não auditável** (declaração do dono de 30/09 não prova as 2 linhas) |
| `BANCO SANTANDER--5` | PDF, 09/08–08/09 | 0 (o DFC B3W de agosto não tem mais o bloco Santander) | 4 | 0 | 0 | 4 | não fecham | **não concilia** (o extrato não cobre 01–08/08 e os 4 movimentos não estão no DFC) |

**Stone, antes e depois.**
- **Em 01/10:** 9 linhas no DFC contra 22 no extrato, 0 exatas e 9 movimentos só no extrato. Eram as quatro saídas
  PIX para o Itaú e créditos de antecipação.
- **Agora:** as saídas entraram no DFC e casam, com 3 exatas e 1 deslocada.
- **Sobra no extrato:**
  - `xlsx-1` e `xlsx-2`, de 03/08: "Crédito Transferência entre contas Stone". São a entrada da conta principal
    da Stone, que o DFC não registra.
  - `xlsx-14`, de 18/08: "Crédito Recebível de Cartão".
- **Sobra no DFC:** a linha 408 (21/08, `RECEITA COM VENDAS`, sem histórico).
- **Abertura e fechamento ainda não fecham**, o que pede rever o saldo de abertura do bloco Stone (`docs/auditoria.md`,
  proposta 1).
- **Possível duplicidade, das 13 do auditor:** 12 grupos foram resolvidos pelo extrato. Fica pendente só o grupo das
  linhas 400+404 da Stone (mesmo dia; documentos `…992` e `…993`). As duas entram juntas num agrupamento de
  maquininha com 405 e 407, e o lote fecha com as duas.

## Unidades: N3, 3N e B3N

| unidade | linhas baixadas em agosto | conferência |
|---|---|---|
| N3 dentro da B3W (`EMP.=N3`) | 11 | as 11 casam uma a uma com o DFC separado de N3 da cópia da master (dia, valor e `SUB 2`). Mesma movimentação, não um adicional |
| 3N (DFC separado) | 23 (bloco `SAFRA`) | 0 casam com a B3W. Contas fora do DFC B3W. Extrato Safra em PDF sem conversor: **não auditável** contra banco |
| B3N (DFC separado) | 78 na cópia da master de 30/09; **72 no espelho atual** do portal | 0 casam com a B3W. Extrato Sicoob em PDF sem conversor: **não auditável** contra banco. A diferença 78 × 72 é entre cópias de datas diferentes e não foi investigada |

## A linha da N3 que o portal ainda mostra em agosto

**A linha da N3 que ainda aparece no portal em agosto é a linha 7 da antiga planilha N3.** O consolidado do espelho
`.cache/dfc-2026` (o mesmo que o portal mostra: 491 linhas) deduz 10 linhas da N3 repetidas na B3W e deixa 1
exclusiva. Ela é:

- linha 7 do arquivo `N3__DFC AGOSTO2026.xlsx`, dia 07/08, banco ITAU;
- `SUB 2` `DESPESAS PJ`, classe `SERVICO DE TERCEIROS`, `PAGO`;
- histórico e título **"NF 06"**.

A linha 71 da B3W tem mesmo dia, mesmo valor e mesma `SUB 2`, mas histórico "NF 07". Por isso a regra de 09/10 não
a deduz: só o sufixo "-N3" é ignorado, e número de nota diferente não é a mesma. Fica contada nas duas unidades até
a resposta da pendência `dfc-agosto-b3w-linha-71-nf-07`, aberta.

## Algo do DFC em dobro, por unidade

Busquei linhas com o mesmo dia, valor e histórico dentro de cada unidade e entre unidades, depois da dedução da N3.

| unidade | linhas | grupos repetidos | o que são | em dobro? |
|---|---|---|---|---|
| B3W | 395 | 1: linhas 96+97 | IPTU (SEDE) PARC 6/10, 10/08, Itaú | **não**: o extrato do Itaú tem dois débitos próprios, de mesmo valor, em 10/08 ("BOLETO PAGO MUNICIPIO") |
| B3N | 72 | 2: 12+13 (03/08) e 68+70 (21/08) | `RECEITA COM SERVICOS`, Sicoob | **sem prova**: não há extrato Sicoob convertido |
| 3N | 23 | 2: 10+11+17+18+19 e 12+16 (20/08) | `RECEITA EM SERVICOS`, Safra | **sem prova**: não há extrato Safra convertido |
| N3 | 11 (1 exclusiva após a dedução) | 0 | — | não |
| entre unidades | — | 2 pares de mesmo dia e valor | B3W 71 × N3 7 (NF 07 × NF 06, a pendência acima); B3N 42 (`CONSORCIOS`) × B3W 187 (`TRANSFERENCIAS BANCARIAS - CUSTO`, "TRANSF. REF CONSORCIO") | o primeiro é a pendência aberta. O segundo parece transferência B3W→B3N para pagar consórcio (dois lados de um movimento), não cópia. Não foi conferido em extrato |

Nenhuma unidade aparece duas vezes no consolidado: 3N 23 + B3N 72 + B3W 395 + N3 1 = 491.

## O que continua sem conferência contra o banco

- **Caixa:** os indicadores de caixa não fecham contra o banco enquanto a Stone não conciliar e as 2 linhas em
  espécie não tiverem comprovante.
- **Stone:** o extrato agora cobre as saídas, mas sobram 3 créditos só no extrato e 1 linha só no DFC, e o saldo de
  abertura e fechamento não bate.
- **Santander:** o PDF só cobre a partir de 09/08, e os 4 movimentos dele não estão no DFC de agosto.
- **3N e B3N:** os extratos Safra e Sicoob existem só em PDF sem conversor.
- **Omie:** sem rodada ao vivo, esta rodada não reconfirma os 25 indicadores do Omie.
