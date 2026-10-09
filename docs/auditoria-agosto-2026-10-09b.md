# Auditoria independente de agosto/2026: rodada b de 09/10/2026 (Safra e Sicoob ligados)

Este relatório não traz valores em reais nem nomes: só contagens, linhas, datas e identificadores de transação do
extrato (`pdf-N`, `xlsx-N`). O detalhe com valores fica no HTML local `docs/auditoria-2026-08.html`, ignorado pelo
git. A rodada anterior é `docs/auditoria-agosto-2026-10-09.md`.

## O que mudou nesta rodada

**Conversor.** `scripts/auditoria/extrato-pdf.py` ganhou dois modelos. Os dois são só leitura, rodam com PyMuPDF e
não chamam nenhum serviço de fora:

- **`safra`**: lê o "Extrato de Movimentação". Confere cada "SALDO TOTAL" do dia contra as transações.
- **`sicoob`**: lê o "Extrato de conta corrente" do SISBR, que vem do mais recente ao mais antigo. Parte do
  "SALDO ANTERIOR" e confere cada "SALDO DO DIA".

Como os outros modelos, o conversor só grava se todos os saldos impressos fecharem. A conversão de agosto deu:

| banco · conta | PDF (cópia local) | lançamentos no mês | saldos conferidos | período | mês inteiro |
|---|---|---|---|---|---|
| Safra · `BANCO SAFRA--1` (3N) | `SAFRA - 08 AGOS.pdf` | 26 | 16 | 03/08–31/08 | sim (01 e 02/08 são sábado e domingo) |
| Sicoob · `BANCO SICOOB--1` (B3N) | `EXTRATO SICOOB 08-2026.pdf` | 52 | 15 (1 "saldo bloqueado" fora) | 01/08–31/08 | sim |

**Teste.** `scripts/auditoria/extrato-pdf.test.mjs` usa um caso real de cada banco e entrou em
`npm run testar-auditoria`. São 28 testes, todos passaram:

- **Safra:** confere as contagens, a cadeia de saldos e os cinco PIX recebidos de mesmo valor em 19/08.
- **Sicoob:** confere as contagens, a cadeia de saldos e o PIX emitido com seu estorno em 03/08.
- **Modelo errado:** se o modelo não é o do banco, o conversor não grava nada.

**Auditor.** Os CSV ficam em `extratos/3N/` e `extratos/B3N/`, ignorados pelo git. O auditor os concilia só contra o
DFC da unidade, que lê do espelho `.cache/dfc-2026/<UNIDADE>/`. Isso aparece numa seção nova do HTML, "Unidades
separadas". Esses extratos não entram na conciliação do DFC B3W.

## Resultado: 47 indicadores, 6 conferidos, 0 divergentes, 41 não auditáveis

```
npm run auditar -- --mes 2026-08 --cache-omie --dfc-dir .cache/dfc-2026/B3W
47 indicadores: 6 conferidos, 0 divergentes, 41 não auditáveis
```

| | rodada de 09/10 | rodada b de 09/10 |
|---|---|---|
| conferidos | 6 | 6 |
| divergentes | 0 | 0 |
| não auditáveis | 41 | 41 |

**Os números não mudaram, e por desenho não podiam mudar.** Os 47 indicadores do auditor são refeitos a partir do DFC
B3W, e as contas Safra e Sicoob não estão nele. Os 15 que dependem de caixa continuam presos pela Stone (a linha 408,
abaixo) e pelas 2 linhas de `DINHEIRO--4`. Os 25 que dependem do Omie continuam presos pela leitura do cache. O que
Safra e Sicoob acrescentam é a prova das linhas da 3N e da B3N, que o portal soma no consolidado (491 linhas).

## Unidades separadas: DFC da unidade contra o extrato

| unidade · conta | linhas DFC | transações extrato | casadas | só no DFC | só no extrato | abertura e fechamento | estado |
|---|---|---|---|---|---|---|---|
| 3N · `BANCO SAFRA--1` | 23 | 26 | 11 exatas, 6 com data deslocada, 1 lote | 4 (linhas 24, 25, 26, 27) | 8 | não fecham | não concilia |
| B3N · `BANCO SICOOB--1` | 72 | 52 | 40 exatas, 10 lotes | 0 | 2 (`pdf-5`, `pdf-6`) | **fecham** | não concilia |
| B3N · `BANCO ITAU--2` | 6 | — | — | — | — | — | não auditável (não há extrato desse bloco) |

**Sicoob (B3N).** Abertura e fechamento do DFC são iguais aos do extrato, e todas as 72 linhas do DFC têm par no
banco. Sobram só duas transações do extrato que o DFC não registra: um PIX emitido e o estorno dele, no mesmo dia
03/08, de mesmo valor e sinais opostos. A soma das duas é zero. A conta não concilia apenas porque a regra pede que
toda transação tenha par.

**Safra (3N).**

- **Abertura:** o bloco do DFC abre em zero, sem linha `SALDO INICIAL`, mas o banco abre com saldo.
- **Linhas 24, 25 e 27** (`PRO LABORE`, `REEMBOLSO` e `TRANSFERENCIAS BANCARIAS - CUSTO`): o DFC data as três em
  20/08. No extrato há três PIX enviados de mesmo valor em 31/08 (`pdf-25`, `pdf-24` e `pdf-26`). São 11 dias de
  diferença, fora da folga de 4 dias, então não casam. Pelo valor, são os mesmos movimentos com a data errada no DFC.
- **Linha 26** (`TRANSFERENCIAS BANCARIAS - RECEITA`, 20/08): tem o mesmo valor da linha 5 (16/08), e a linha 5 já
  casou com o PIX recebido de 14/08 (`pdf-4`). Não há no banco segunda entrada desse valor. É **possível dobra da
  linha 5**.
- **Só no extrato, sem linha no DFC**, cinco transações:
  - `pdf-1`, 05/08: tarifa de pacote;
  - `pdf-2`, 11/08: PIX recebido da própria empresa;
  - `pdf-3`, 12/08: tarifa de baixa de boleto;
  - `pdf-5`, 17/08: PIX recebido de um centavo;
  - `pdf-23`, 28/08: compra no débito.
- Os três PIX de 31/08 (`pdf-24`, `pdf-25`, `pdf-26`) também aparecem como "só no extrato", pelo motivo das linhas
  24, 25 e 27.

## As repetidas da 3N e da B3N: nenhuma é dobra

Cada linha repetida casou com uma transação própria do extrato, diferente das outras do grupo.

| unidade | linhas (dia no DFC, `SUB 2`) | transações próprias no extrato | veredito |
|---|---|---|---|
| 3N | 10 + 11 + 17 + 18 + 19 (20/08, `RECEITA EM SERVICOS`) | `pdf-8`, `pdf-9`, `pdf-10`, `pdf-11`, `pdf-12`: cinco PIX recebidos de mesmo valor em 19/08 | **não é dobra**: são cinco recebimentos. O DFC data em 20/08 o que o banco creditou em 19/08 |
| 3N | 12 + 16 (20/08, `RECEITA EM SERVICOS`) | `pdf-15`, `pdf-19`: dois PIX recebidos de mesmo valor em 20/08 | **não é dobra** |
| B3N | 12 + 13 (03/08, `RECEITA COM SERVICOS`) | `pdf-1`, `pdf-2`: dois créditos de mesmo valor em 03/08 | **não é dobra** |
| B3N | 68 + 70 (21/08, `RECEITA COM SERVICOS`) | `pdf-42`, `pdf-43`: dois créditos de mesmo valor em 21/08 | **não é dobra** |

A única linha de unidade com cara de dobra é a **3N 26**, que não estava entre os grupos pedidos (ver acima).

## O par B3W 187 × B3N 42: não é cópia

O auditor lista as linhas de mesmo dia e mesmo valor entre a unidade e o DFC B3W. Em 17/08 há três:

| linha | o que é | prova no banco |
|---|---|---|
| B3W 187, `TRANSFERENCIAS BANCARIAS - CUSTO` | saída do Itaú | Itaú `pdf-180` |
| B3N 41, `TRANSFERENCIAS BANCARIAS - RECEITA` | entrada no Sicoob | Sicoob `pdf-26`: PIX recebido da mesma titularidade, marcado "intercompany" |
| B3N 42, `CONSORCIOS` | pagamento do consórcio | Sicoob `pdf-24`: débito de convênio da administradora de consórcio |

**Leitura:** a B3W transferiu para a conta Sicoob da B3N, nas linhas 187 e 41, que são os dois lados do mesmo
movimento. A B3N pagou o consórcio com esse dinheiro, na linha 42. Cada linha tem a sua transação no banco, então
nada está em dobro.

O mesmo vale para B3W 246 × 3N 21 (20/08). É a transferência do Safra para o Itaú, com sinais opostos: Safra `pdf-20`
e Itaú `pdf-237`.

## Stone: o que falta para fechar o bloco

Com o DFC atual, **a abertura e o fechamento do bloco `BANCO STONE--2` são iguais aos do extrato, ao centavo**. A
linha `SALDO INICIAL` (397) já traz o saldo do banco. A conta só não concilia por isto:

- **A linha 408** (21/08, `RECEITA COM VENDAS`, `RECEBIDO`, sem histórico) não tem crédito correspondente na janela de
  5 dias.
- **Sobram três créditos só no extrato:**
  - `xlsx-1`, 03/08: "Crédito Transferência entre contas Stone";
  - `xlsx-2`, 03/08: "Crédito Transferência entre contas Stone";
  - `xlsx-14`, 18/08: "Crédito Recebível de Cartão".
- **A soma desses três créditos é igual ao valor da linha 408 menos 3 centavos.** Esses 3 centavos compensam,
  exatamente, as diferenças de centavos já aceitas em dois lotes de maquininha: +2 nas linhas 400+404+405+407 e +1
  nas linhas 401+402. Por isso o saldo final bate.
- **O auditor ainda marca "abertura ou fechamento não fecham"** porque soma essas diferenças aceitas ao fechamento do
  DFC, e a compensação está na linha 408, que ficou sem par.

**O que falta, sem alterar o DFC:**

1. **Confirmação do dono ou da gestora** de que a linha 408 é o registro, numa linha só e datado de 21/08, dos créditos
   `xlsx-1` e `xlsx-2` (03/08) e `xlsx-14` (18/08). Se a resposta for sim, o acerto do DFC seria datar e separar a
   408 nesses três créditos. Isso é proposta, não foi feito.
2. **Se não for:** o comprovante do recebimento de 21/08 da linha 408 e a origem dos três créditos. Os dois de 03/08
   vêm da conta principal da Stone; isso pede o extrato dessa conta, que não está na cópia local.
3. **Os 3 centavos** se resolvem sozinhos quando a 408 tiver par.

Fora a Stone, os 15 indicadores de caixa dependem também das 2 linhas de `DINHEIRO--4`, que precisam de comprovante
ou de decisão do dono.

## O que continua sem conferência contra o banco

- **Caixa B3W:** a Stone (linha 408) e o dinheiro em espécie (2 linhas). O Santander (PDF a partir de 09/08) segue
  como na rodada anterior.
- **3N (Safra):** abertura ausente no DFC, três datas erradas (24, 25, 27), uma possível dobra (26) e cinco
  movimentos do banco fora do DFC.
- **B3N:** o Sicoob fecha em saldo e sobra só um PIX estornado no mesmo dia. O bloco `BANCO ITAU--2` (6 linhas) não
  tem extrato.
- **Omie:** sem rodada ao vivo, os 25 indicadores do Omie não foram reconfirmados.
