# O tempo de um clique de filtro nas 3 telas

Medido por `scripts/medir-filtros.mjs` neste computador, em 29/09/2026, 02:21, sobre
agosto de 2026. As duas colunas — antes e depois — foram medidas na MESMA rodada, com o mesmo
relógio: o script sabe fazer as duas coisas, e por isso a comparação não depende de ninguém ter anotado um número
ontem. A leitura do Omie desta rodada é a `f650b50ab90b`, com 359 arquivos no cache.

**O que era.** Cada combinação de filtro era um balde novo em `lib/dados.mjs`, e o balde novo refazia o cálculo
inteiro. Refazer o cálculo inteiro queria dizer reabrir as fontes: os 359 arquivos do cache do Omie e as
planilhas `.xlsx` da pasta que o OneDrive espelha — treze arquivos na Tela 1 (o mês, mais os doze da série do ano) e
doze na Tela 2. E, se a leitura do Omie tinha passado de uma hora, o clique ainda esperava até 8 s por ela antes de
começar a contar.

**O que é.** As fontes são lidas e preparadas uma vez, numa **base local** (`lib/regras/base-local.mjs`), e o clique
de filtro só calcula em cima dela. Nada do que se lê depende do filtro — a planilha é a mesma, o cache é o mesmo, e o
recorte do filtro é aplicado depois.

## O resumo

| tela | o pior clique | antes | depois | |
| --- | --- | --- | --- | --- |
| Tela 1 | empresa 2 | 7,9 s | 38 ms | dentro de 2 s |
| Tela 2 | mês 8 só | 8,4 s | 613 ms | dentro de 2 s |
| Tela 3 | empresa 1 | 7,8 s | 32 ms | dentro de 2 s |

## As fases, clique por clique

As quatro fases de dentro do Node. A quinta — o desenho — está mais abaixo, porque ela só existe com o app no ar.

### Antes: um balde novo por combinação de filtro

```
node scripts/medir-filtros.mjs --modo antes
```

O modo antes refaz o que a camada de dados fazia até 27/09/2026: esperar a releitura do Omie e montar uma base nova a
cada clique. Uma diferença joga contra ele e a favor da honestidade: a leitura de hoje abre doze arquivos na Tela 1, e a
de antes abria treze — o antes que o dono viveu era um pouco pior que este.

#### Tela 1 — Gestão de Contas

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 1 ms | 7046 ms | 176 ms | 41 ms | **7,3 s** |
| empresa 2 | 1 ms | 7724 ms | 170 ms | 23 ms | **7,9 s** |
| centro de custo TI | 1 ms | 7333 ms | 159 ms | 37 ms | **7,5 s** |
| situação recebido | 2 ms | 7513 ms | 153 ms | 49 ms | **7,7 s** |
| conta Caixinha | 2 ms | 7464 ms | 157 ms | 43 ms | **7,7 s** |

#### Tela 2 — DRE

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 1 ms | 7694 ms | 166 ms | 480 ms | **8,3 s** |
| meses 7 e 8 | 1 ms | 7513 ms | 154 ms | 562 ms | **8,2 s** |
| empresa 1 | 2 ms | 7551 ms | 160 ms | 249 ms | **8,0 s** |
| conta Caixinha | 2 ms | 7197 ms | 151 ms | 548 ms | **7,9 s** |
| mês 8 só | 2 ms | 7730 ms | 161 ms | 503 ms | **8,4 s** |

#### Tela 3 — Fluxo de Caixa

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 2 ms | 7430 ms | 157 ms | 80 ms | **7,7 s** |
| empresa 2 | 1 ms | 7594 ms | 149 ms | 32 ms | **7,8 s** |
| empresa 1 | 1 ms | 7638 ms | 156 ms | 49 ms | **7,8 s** |
| as duas | 2 ms | 7202 ms | 158 ms | 53 ms | **7,4 s** |

### Depois: a base local, e o clique só calculando

```
node scripts/medir-filtros.mjs --modo depois
```

#### Tela 1 — Gestão de Contas

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 4 ms | 7188 ms | 157 ms | 52 ms | **7,4 s** |
| empresa 2 | 1 ms | 0 ms | 0 ms | 22 ms | **23 ms** |
| centro de custo TI | 1 ms | 0 ms | 0 ms | 37 ms | **38 ms** |
| situação recebido | 0 ms | 0 ms | 0 ms | 25 ms | **26 ms** |
| conta Caixinha | 0 ms | 0 ms | 0 ms | 30 ms | **31 ms** |

#### Tela 2 — DRE

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 0 ms | 0 ms | 0 ms | 427 ms | **429 ms** |
| meses 7 e 8 | 0 ms | 0 ms | 0 ms | 611 ms | **613 ms** |
| empresa 1 | 0 ms | 0 ms | 0 ms | 225 ms | **227 ms** |
| conta Caixinha | 0 ms | 0 ms | 0 ms | 481 ms | **483 ms** |
| mês 8 só | 1 ms | 0 ms | 0 ms | 579 ms | **581 ms** |

#### Tela 3 — Fluxo de Caixa

| clique | espera do Omie | planilhas do DFC | cache do Omie | cálculo | total |
| --- | --- | --- | --- | --- | --- |
| abertura, sem filtro | 1 ms | 0 ms | 0 ms | 34 ms | **36 ms** |
| empresa 2 | 1 ms | 0 ms | 0 ms | 30 ms | **32 ms** |
| empresa 1 | 0 ms | 0 ms | 0 ms | 20 ms | **21 ms** |
| as duas | 0 ms | 0 ms | 0 ms | 0 ms | **1 ms** |

**A espera do Omie mediu zero nas duas colunas desta rodada, e isso tem explicação.** Ela só existe quando a última
releitura do Omie passou de uma hora, ou está em curso: nessa hora, a camada de dados de antes parava cada clique por
até 8 s (`ESPERA_PADRAO_MS`, em `lib/regras/omie-releitura.mjs`) antes de começar a calcular. Nesta rodada a última
leitura tinha menos de uma hora, então nem o modo antes esperou — e por isso esta coluna não mede, aqui, o pior caso
que o dono vivia. Para medi-la com a releitura em curso **sem tocar no cache de verdade**, é só mandar a releitura
gravar numa cópia:

```
cp -rp .cache/omie .cache/omie-copia
OMIE_CACHE_DIR=.cache/omie-copia node scripts/medir-filtros.mjs --omie forcar --modo os-dois
```

A cópia com `-p` guarda as datas dos arquivos, e por isso o carimbo da leitura continua sendo o mesmo.

A linha da **abertura** é a única que ainda lê as fontes, e é a leitura que o dono aceita esperar. Na Tela 1 ela abre os
doze meses de planilha (a tela desenha a série do ano), e é por isso que a abertura das Telas 2 e 3, logo depois, já não
abre planilha nenhuma: os doze meses que a Tela 2 precisa estão prontos.

## O clique de verdade, sobre HTTP

| tela | rota | pior clique antes | pior clique depois | desenho (por diferença) |
| --- | --- | --- | --- | --- |
| Tela 1 | `/` | 8,5 s | 75 ms | 27 ms |
| Tela 2 | `/dre` | 8,2 s | 676 ms | 91 ms |
| Tela 3 | `/fluxo-de-caixa` | 140 ms | 29 ms | 26 ms |

O **desenho** é a diferença entre a página inteira e os dados: é o React montando a marcação e o Next respondendo.
Nenhuma linha de `app/` mudou nesta tarefa, então ele é o mesmo antes e depois — e é por isso que a coluna aparece uma
vez só. A conta do desenho é boa na coluna do depois, em que os dados custam quase nada; na do antes ela seria a
diferença de dois números de oito segundos, e é por isso que ela não aparece lá. O antes foi medido em 27/09/2026, 22:49 e o depois em 27/09/2026, 22:53, cada um contra o app construído daquele lado da mudança: o antes não pode ser remedido, porque o código que ele media deixou de existir.

**Estas medições de HTTP (antes e depois) caíram numa hora em que a releitura do Omie NÃO estava em curso** —
a espera do Omie mediu zero nelas. É por isso que o pior clique do antes aqui é menor que o total do antes da tabela de
fases mais acima: lá a releitura estava em curso e os 8 s de espera entraram na conta. As duas coisas são verdade, cada
uma na sua hora, e é a soma delas que o dono sentia como "uma eternidade".

## Onde fica a base local, e quando ela é renovada

**Onde:** na memória do processo do servidor (`lib/regras/base-local.mjs`), uma base por ano pedido. Não é arquivo e
não é banco, por três motivos, nesta ordem:

- **dinheiro não vai para disco.** A base guarda o valor de cada linha do DFC, em centavos, e o nome de cada cliente do
  cadastro do Omie. Neste repositório valor em reais e nome de pessoa vivem na memória do servidor e vão só para a tela;
  um arquivo ou um SQLite com a base seria um lugar novo, no disco, com o dinheiro da empresa dentro.
- **o processo sobrevive entre os cliques.** As telas rodam em `next start` neste computador (`npm run local`) e o
  mesmo processo atende todas as visitas. O único caso que um arquivo cobriria a mais é a primeira abertura depois de
  reiniciar o app — que é justamente a leitura que o dono aceita esperar.
- **serializar custaria o que economiza.** O cache do Omie já é disco, e reabri-lo inteiro custa uma fração do que custa
  a planilha (as duas colunas acima medem isso). Passar a base por JSON — com os `Map` e os `Set` que o cache monta —
  custaria a mesma ordem de grandeza, e o ganho de verdade, que são os sete segundos de planilha, não precisa de disco
  nenhum para acontecer uma vez só.

**Quando é renovada** — as três horas de `lib/dados.mjs`, e nenhuma a mais:

| quando | o que acontece | quem espera |
| --- | --- | --- |
| na abertura | não há base para o ano pedido: esta visita lê as fontes | esta visita |
| na virada da hora | a base completou uma hora, ou a releitura do Omie trouxe leitura nova: a visita responde com a base que tem e manda preparar a nova **ao lado**; quando ela fica pronta, entra no lugar e os baldes de resultado são jogados fora | ninguém |
| no "atualizar agora" | `esquecer()` joga fora a base e os baldes; a visita seguinte é uma abertura | quem apertou o botão |

**A regra da releitura de hora em hora não mudou.** As fontes continuam relidas de hora em hora e o Omie continua
relido pela API por `lib/regras/omie-releitura.mjs`, com a mesma janela de uma hora e só por método de consulta. O que
saiu foi a espera: a releitura é disparada com `esperarMs: 0` quando uma base é preparada, e segue ao lado. O preço é
que uma falha imediata do Omie — credencial faltando, por exemplo — aparece na visita seguinte em vez de na mesma; a
hora da última leitura, que o rodapé da tela mostra, continua saindo da marca que a releitura grava.

## Como remedir

```
npm run medir-filtros                                      # os dois modos, e reescreve este documento
node scripts/medir-filtros.mjs --modo depois               # só o de hoje, sem escrever nada
node scripts/medir-filtros.mjs --so-documento              # reescreve o texto do que já foi medido, sem medir
npm run local                                              # e, com o app no ar, numa outra janela:
node scripts/medir-filtros.mjs --url http://127.0.0.1:4781 --http depois --gravar
```

E o pior caso, com a releitura do Omie em curso — mandando a releitura gravar numa cópia, para o cache de verdade não
ser tocado. É assim que a medição publicada aqui foi feita:

```
cp -rp .cache/omie .cache/omie-copia
OMIE_CACHE_DIR=.cache/omie-copia node scripts/medir-filtros.mjs --omie forcar --modo os-dois
```

Tudo o que foi medido fica em `docs/desempenho-medicoes.json`, e este documento é escrito dele — por isso consertar uma
frase não obriga a medir tudo de novo, e as duas medições que não podiam ser da mesma rodada (a do antes com a releitura
em curso e a do clique sobre HTTP, que precisa do app no ar) aparecem lado a lado, cada uma dizendo de quando é.

Só leitura: nada foi escrito no Omie nem nas planilhas, e este documento tem milissegundos e nomes de filtro — nenhum
valor em reais e nenhum nome de cliente.
