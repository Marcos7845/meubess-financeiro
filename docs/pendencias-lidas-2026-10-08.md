# Pendências lidas em 08/10/2026

Consulta ao portal publicado por GET /api/pendencias/ponte/listar, GET /api/pendencias/ponte?desde=0 e GET /api/pendencias/ponte/anexos/{id}. O segredo foi usado apenas no cabeçalho Bearer. Respostas e anexos estão em .cache/pendencias-recebidas/. Não houve POST de confirmação de recebimento.

| Pendência | Em 05/10 | Em 08/10 | Resposta e anexo |
|---|---|---|---|
| stone-agosto-2026-seis-entradas | Encerrada | Encerrada | Camila Costa, 05/10/2026 16h57 (Brasília); Comprovante de Extrato _4_.pdf. Nada novo desde 05/10. |
| saidas-setembro-2026-diferenca-dfc | Aberta | Aberta | Camila Costa, 05/10/2026 17h06; 09 - DFC SETEMBRO 2026.xlsx. Nada novo desde 05/10. |
| dfc-julho-agosto-santander-faltas | Aberta | Aberta | Camila Costa, 08/10/2026 13h46; novo extrato-pj-08_10_2026_13h45m18s.pdf. |
| dre-agosto-conta-do-dre-omie | Aberta | Aberta | Camila Costa, 08/10/2026 14h18; sem anexo. |

Horários convertidos das marcas ISO 8601 da ponte (UTC−3). A consulta trouxe cinco respostas no total, marcador 5; a quinta pertence a outra pendência, fora deste pedido. As respostas novas conservam recebidoEm nulo no GET, pois nenhuma confirmação foi enviada.

## Stone — bate no recorte solicitado

O PDF Stone de 01/07 a 31/08 já estava no cache. Ele mostra seis créditos de “Recebimento vendas / Antecipação | Crédito” em 21, 24 e 25/08. A conferência de 05/10 registrou correspondência individual de data e valor com os seis lançamentos EXTR da empresa 1; esta passagem releu as seis linhas do comprovante, sem consultar o Omie. O documento mostra movimentação na Stone em agosto, contrariando a declaração anterior de conta sem movimento. A existência das seis entradas está comprovada; o fechamento de agosto continua parado na trava por decisão do dono. Não refixei a trava.

## Saídas de setembro — o recorte da soma não bate com o cartão

Camila informou soma da coluna L nas linhas 3–371 da aba FLUXO DE CAIXA, sem linhas ocultas, apenas do Itaú; disse que a planilha foi alterada após 30/09 e pediu mostrar tanto “A pagar” quanto “Pago”, com opção de ver cada situação. No arquivo anexado, esse recorte contém 257 saídas, todas PAGO: a soma indicada bate com essas 257 linhas. O leitor do projeto, aplicado ao anexo e ao espelho local, encontrou 303 saídas pagas no consolidado: 257 do Itaú, 38 do Sicoob, uma do cartão Stone e sete do Banco do Brasil/Cielo. As duas cópias têm conteúdos binários distintos, mas esses totais e contagens coincidem.

O cartão Saiu segue a regra de caixa do DFC: somente saídas baixadas, em todas as contas. O seletor Saídas → A pagar usa títulos em aberto do Omie, outra fonte, não a coluna L do anexo. Assim, a soma de um banco não bate com Saiu de todas as contas por diferença de recorte; a resposta não justifica misturar pago e a pagar no mesmo total. O valor ao vivo dos cartões Saiu e Saídas → A pagar não foi lido nesta passagem: os GETs autorizados são os da ponte de pendências, e o pedido exclui leitura do Omie. A comparação do valor publicado e do lado a pagar permanece não verificável aqui.

## DFC de julho/agosto e Santander — cobre parte; correção não comprovada

Camila escreveu “1. corrigido” para o bloco Stone de julho e “2. Não tem comprovante” para as duas linhas de dinheiro em espécie de agosto. Não anexou DFC de julho atualizado. No espelho local de julho, anterior à resposta, **batem com o PDF Stone** os 11 créditos de 27–31/07, os cinco créditos de 24/07 e os Pix de 24, 27 e 28/07, inclusive as datas (linhas 694–699, 706 e 709; os números de linha mudaram em relação ao pedido). Isso confirma esses movimentos **na cópia local**, mas não prova que a resposta tenha alterado o arquivo atual da equipe. O espelho de agosto ainda contém as linhas 440 e 441, mas não há comprovante para elas.

O PDF novo é um extrato Santander de 01 a 31/08/2026; há movimentos em 03/08, inclusive no trecho 01–08/08 que faltava no extrato anterior de 09/08–08/09. Ele fecha a lacuna documental de cobertura de agosto desse banco. Não é extrato de julho; esse mês segue sem documento. O DFC local de julho e agosto não tem bloco Santander identificável, logo o PDF isolado não permite conciliar todas as movimentações do banco com a planilha nem resolver as quatro ausências anteriormente apontadas. O comprovante de dinheiro e o DFC de julho atualizado continuam faltando.

## DRE de agosto — declaração sem prova documental

Camila respondeu “correção realizada”, sem arquivo. A resposta cobre verbalmente os dois itens do pedido: Conta do DRE das categorias 2.01.03, 2.01.01, 2.03.96 e o lançamento de agosto na categoria totalizadora 2.01. Sem o arquivo pedido e sem consultar o Omie, não dá para saber quais campos foram preenchidos nem se o lançamento foi corrigido. Nada nesta resposta autoriza mudar a regra do DRE.

## O que destrava e decisão pendente

- Stone: prova a existência das seis entradas; o dono ainda precisa decidir se e quando refixar a trava de agosto diante da declaração anterior de ausência de movimento.
- Setembro: explica o recorte da soma do Itaú e permite conferir as saídas pagas no anexo. O dono precisa decidir se quer um total combinado de pago + a pagar e, nesse caso, como deve ser rotulado e apresentado ao lado dos recortes separados. Saiu hoje mede caixa pago.
- Santander/DFC: o PDF novo permite examinar 01–08/08 do Santander; o espelho local de julho já bate com os itens Stone especificados. Ainda faltam o extrato Santander de julho, uma cópia atual do DFC de julho para verificar a declaração de correção e o comprovante do dinheiro.
- DRE: a declaração orienta uma futura conferência, mas não a substitui; falta o arquivo ou outra evidência das correções.

Nenhum número, regra, cartão, planilha, ERP ou trava foi alterado.
