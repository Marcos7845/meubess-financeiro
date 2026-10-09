# Pendências lidas em 09/10/2026

Leitura da ponte só por GET: `node scripts/pendencias-ponte.mjs listar`, `GET /api/pendencias/ponte?desde=0` e
`GET /api/pendencias/ponte/anexos/{id}`. O segredo foi só no cabeçalho Bearer. Não houve `POST` de recebimento (por isso
não usei `buscar`, que marca a resposta como recebida). O novo foi gravado em `.cache/pendencias-recebidas/`, sem apagar
nem sobrescrever: a resposta de `dfc-agosto-stone-datas-20-e-21` com o anexo `08 - DFC AGOSTO 2026.xlsx`, e a consulta
inteira em `consulta-2026-10-09.json`. Marcador da ponte: 6 (seis respostas, uma por pendência). As seis respostas vêm do
mesmo login do financeiro. Horários em Brasília (UTC−3). O Omie não foi lido. Nenhuma regra, cartão, trava, planilha ou
pendência foi alterada.

## As seis pendências

| Pendência | Em 08/10 | Hoje | Resposta | Veredito |
|---|---|---|---|---|
| `stone-agosto-2026-seis-entradas` | encerrada | encerrada | 05/10 16h57; extrato Stone jul–ago em PDF | **resolve**: as seis entradas de 21, 24 e 25/08 existem no extrato. As datas delas no DFC são outra pendência (a última desta tabela). |
| `saidas-setembro-2026-diferenca-dfc` | aberta | aberta | 05/10 17h06; `09 - DFC SETEMBRO 2026.xlsx` | **resolve em parte**: explica a soma (coluna L, linhas 3–371, só Itaú; sem linha oculta; planilha alterada depois de 30/09). Pede ver pago e a pagar juntos e separados: decisão do dono. |
| `dfc-julho-agosto-santander-faltas` | aberta | aberta | 08/10 13h46; extrato Santander 01–31/08 em PDF | **resolve em parte**: o extrato fecha a lacuna 01–08/08 do Santander. "Corrigido" (Stone de julho) **só declara**: sem planilha de julho anexa. "Não tem comprovante" (dinheiro de 18/08) **só declara** a falta. Extrato Santander de julho não veio. |
| `dre-agosto-conta-do-dre-omie` | aberta | aberta | 08/10 14h18; sem anexo | **só declara** ("correção realizada"). Sem ler o Omie, **não dá para saber** se a Conta do DRE foi preenchida nem se o lançamento em 2.01 foi corrigido. |
| `n3-agosto-2026-tres-movimentos-saldo` | aberta (não lida no pedido de 08/10) | aberta | 08/10 14h30; sem anexo | **só declara** ("a planilha N3 não existe mais; tudo concentrado na planilha da NON"). Não diz em que linha do extrato cada movimento entrou. O recálculo abaixo acha os três na planilha B3W. |
| `dfc-agosto-stone-datas-20-e-21` | aberta (criada em 08/10) | aberta | 08/10 16h07; `08 - DFC AGOSTO 2026.xlsx` | **não resolve**: a planilha mudou as duas datas, mas trocadas entre si (ver recálculo 1). |

## Recálculo 1 — entradas Stone de agosto contra o comprovante

Leitura do bloco `BANCO STONE` da aba `FLUXO DE CAIXA` do DFC B3W de agosto em duas cópias: o espelho local (alterado em
06/10) e o anexo de 08/10. Entre as duas, só mudaram duas células em toda a aba: `DIA PG` das linhas 410 e 411. O
comprovante é o extrato de conta Stone de 01/07 a 31/08 (anexo de 05/10). Cada linha do DFC soma as duas entradas do
mesmo dia no extrato; os valores, refeitos pelo saldo impresso no extrato, batem ao centavo.

| Linha | O que é | Data no extrato | Espelho (06/10) | Anexo (08/10) | Resultado |
|---|---|---|---|---|---|
| 408 | entrada "receita com vendas" | não existe | 21/08 | 21/08 | **não bate**: não há crédito desse valor no extrato. É o valor exato que leva o saldo do DFC ao saldo do extrato depois de 18/08: a soma dos créditos de 03, 06, 10 e 18/08 que as linhas 398 a 407 não têm. É um ajuste, lançado como receita de 21/08. |
| 409 | saída, Pix para o Itaú | 21/08 | 21/08 | 21/08 | **bate** (data e valor) |
| 410 | entrada = as duas de 24/08 | 24/08 | 20/08 | 21/08 | **não bate**: a data mudou, mas para 21/08 |
| 411 | entrada = as duas de 21/08 | 21/08 | 20/08 | 24/08 | **não bate**: a data mudou, mas para 24/08 |
| 412 | saída, Pix para o Itaú | 24/08 | 25/08 | 25/08 | **não bate**: um dia depois (não foi pedido na pendência) |
| 413 | entrada = as duas de 25/08 | 25/08 | 25/08 | 25/08 | **bate** |

O total do mês e o saldo final do bloco não mudam (o saldo corrido escrito termina igual ao do extrato em 25/08). O que
muda é o dia: com o anexo, 21/08 fica com o valor de 24/08 e vice-versa. A correção das linhas 410 e 411 é trocar as duas
datas entre si; a 412 pede 24/08. Nada disso está no portal nem no espelho, porque o envio do DFC parou antes do anexo
(ver "Envio do DFC parado").

## Recálculo 2 — saídas de setembro: 257 do anexo contra 320 de hoje

Leitor do projeto (`lerMesDoDfc` e `saidasPagasDoDfc`, a regra do cartão Saiu) sobre o anexo de 05/10 e sobre o espelho
local de hoje (B3W de 07/10, B3N de 05/10, 3N de 01/10; a N3 não tem setembro).

| Recorte | Linhas |
|---|---|
| Anexo de 05/10, Itaú (o que a equipe somou) | 257 |
| Espelho de hoje, B3W, Itaú | 257 |
| Espelho de hoje, B3W, Banco do Brasil–Cielo | 7 |
| Espelho de hoje, B3W, cartão de crédito Stone | 1 |
| Espelho de hoje, B3N, Sicoob | 38 |
| Espelho de hoje, 3N, Safra | 17 |
| **Tela de hoje (Saiu, setembro)** | **320** |

Linha a linha, as 257 do Itaú são as mesmas nas duas cópias (linhas 3 a 368: mesmo número de linha, dia, valor e
`PAGAMENTO`); só a `SUB 2` da linha 227 mudou de nome ("SEGURO" para "SEGURO MERCADORIA"), sem mudar valor. A soma das
257 bate ao centavo com a soma informada pela equipe. **A diferença são as 63 linhas de outros bancos e unidades** que o
cartão Saiu soma e a soma do Itaú não: 8 da B3W (Banco do Brasil–Cielo e cartão Stone), 38 da B3N e 17 da 3N. Dessas 63,
14 são transferências entre contas (`TRANSFERENCIAS BANCARIAS - CUSTO`), contadas como saída pela regra atual. Nenhuma
linha `A PAGAR` entra nos dois lados. Correção ao texto de 08/10: as 38 do Sicoob são da B3N, não do arquivo anexo.

Bate, com a diferença explicada por recorte. O valor publicado no portal não foi lido nesta passagem (o pedido exclui
ler o Omie, e a rota de telas da ponte calcula com ele); o espelho é a cópia do último envio confirmado, 08/10 às 14h.

## Recálculo 3 — os quatro movimentos do Santander contra o DFC

O extrato novo (01 a 31/08) tem seis movimentos, refeitos pelo saldo impresso: dois IOF em 03/08, juros em 19/08, um Pix
recebido em 20/08, tarifa em 24/08 e um Pix recebido em 28/08. Os quatro já apontados são os de 19, 20, 24 e 28/08. Os
dois Pix vêm de conta do mesmo CNPJ do titular.

O DFC B3W de agosto, nas duas cópias, **não tem mais bloco Santander** na aba `FLUXO DE CAIXA` (só Itaú, Stone, Banco
do Brasil e dinheiro); o Santander só aparece em descrição de linha.

| Movimento do extrato | No DFC | Resultado |
|---|---|---|
| 20/08, Pix recebido | perna de saída no Itaú, linha 220, 20/08, transferência | **bate pela metade**: a entrada no Santander não está no DFC |
| 28/08, Pix recebido | perna de saída no Itaú, linha 310, 28/08, transferência | **bate pela metade**: idem |
| 19/08, juros | ausente | **não bate** |
| 24/08, tarifa | ausente | **não bate** |
| 03/08, dois IOF (trecho novo) | ausentes | **não bate** |

Sem bloco Santander, o DFC não leva o saldo dessa conta (que abre agosto negativo no extrato). Os valores são pequenos,
mas a conta não concilia.

## Os três movimentos da N3, achados na B3W

Pelo leitor, o consolidado de agosto ainda soma as três linhas da N3 (7, 14 e 15) como exclusivas. Na planilha B3W de
agosto há três linhas com a mesma data e o mesmo valor, no bloco Itaú: 71 (07/08; descrição "NF 07", na N3 "NF 06"),
223 e 224 (20/08; mesmo documento com o sufixo "-N3"). A dedução da N3 não as reconhece porque compara também a
descrição. Com a resposta da equipe (tudo concentrado na planilha da NON), as 223 e 224 são **provavelmente as mesmas**
e a 71 **não dá para saber** (o número da nota difere). Se forem as mesmas, o consolidado de agosto as conta duas vezes
enquanto a planilha N3 estiver no espelho e no servidor. A regra não foi mudada.

## Envio do DFC parado desde 08/10, 15h

`.cache/logs/envio-dfc.log`: sucesso de hora em hora até 08/10 às 14h (Brasília); de 15h em diante, toda passagem para na
"seleção da fonte" com "o envio exige DFC das quatro unidades (3N, B3N, B3W, N3)" (última: 09/10 às 08h24).
`scripts/financeiro-enviar-dfc.mjs` recusa o envio se qualquer unidade de `UNIDADES` (`lib/regras/dfc-fonte.mjs`) vier
com zero planilha. A resposta da equipe sobre a N3 chegou às 14h30 de 08/10 ("a planilha N3 não existe mais"); a
primeira falha é a passagem seguinte, das 15h. **Causa provável: a pasta anual da N3 deixou de ter planilha.** O log não
diz qual unidade falta, e a pasta sincronizada não foi aberta nesta passagem.

Mudança mínima (não feita; decisão do dono): no envio, deixar de exigir a N3 a partir do mês em que ela deixou de existir
— por exemplo, um fim de vigência ao lado de `INICIO_DAS_UNIDADES` e a checagem do envio olhando só as unidades vigentes.
Duas consequências a decidir junto: (1) o servidor troca o envio inteiro, então sem a N3 o arquivo de agosto dela some
do portal e agosto passa a avisar "sem planilha da N3" se a regra não souber que ela acabou; (2) se a N3 sair, as três
linhas acima ficam só na B3W, o que acaba com a provável dupla contagem.

## O que segue aberto e o dado que falta

- **Datas Stone de agosto:** trocar as datas das linhas 410 e 411 entre si e pôr 24/08 na 412; explicar a linha 408 (ajuste
  sem crédito correspondente) ou trocá-la pelos créditos do extrato de 03, 06, 10 e 18/08.
- **Trava de agosto:** segue parada pelas seis entradas Stone; refixar é decisão do dono.
- **Saídas de setembro:** decisão do dono sobre mostrar pago e a pagar juntos (e com que rótulo); transferências entre
  contas seguem dentro de Saiu.
- **Santander:** extrato de julho; voltar o bloco Santander ao DFC de agosto com os seis movimentos, ou dizer por que saiu.
- **Stone de julho:** planilha de julho atual, para conferir o "corrigido".
- **Dinheiro em espécie de 18/08 (linhas 440 e 441):** sem comprovante, declarado pela equipe; decisão do dono.
- **DRE de agosto:** prova da correção (arquivo ou leitura do Omie numa passagem autorizada).
- **N3:** confirmar que as linhas 71, 223 e 224 da B3W são as três da N3 (a 71 traz outra nota) e decidir o fim da N3.
- **Envio do DFC:** decisão do dono sobre a mudança acima. Até lá, portal e espelho ficam no DFC de 08/10 às 14h.
