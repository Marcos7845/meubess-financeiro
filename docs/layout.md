# O layout das três telas

Qual skill guiou este layout: **a skill de visualização de dados que o dono mandou em 28/09/2026**, guardada no
repositório em [`.claude/skills/visualizacao-de-dados/SKILL.md`](../.claude/skills/visualizacao-de-dados/SKILL.md).
Ela manda não começar pelo gráfico: primeiro a história (para quem é, que decisão ajuda a tomar, o que a pessoa leva
em 5 segundos, que perguntas a tela responde), depois os dados, depois a escolha de cada gráfico por uma árvore de
decisão, depois o desenho num layout em "F", e no fim um checklist de revisão.

**A página para o dono ler é [`layout.html`](layout.html)**, com a captura das três telas dentro. Este arquivo é a
fonte dela: quem escreve o HTML é `node scripts/pagina-de-layout.mjs`, lendo este `.md` e as três capturas.

## O que o dono respondeu, 28/09/2026

Ele viu a Tela 1 refeita e respondeu quatro coisas. Elas já estão feitas, e cada uma está escrita de novo no lugar
onde manda:

1. **Os filtros em etiquetas estão feios e ocupam espaço — troque por lista suspensa com caixas de marcar (escolher um
   ou vários), nas três telas.** Feito, com os mesmos filtros, as mesmas opções e a mesma URL: só o desenho mudou. A
   seção abaixo conta como.
2. **A frase de 5 segundos da Tela 1 fica só com o caixa do mês, sem a maior saída.** Feito: a frase é *"o caixa do mês
   fechou em X"*. A maior saída continua na tela, na primeira barra de "Para onde foi a despesa".
3. **Na Tela 3, "não entrou" é vago — use "venceu e ainda não foi recebido".** Feito, e é o termo dele, letra por
   letra. "Não entrou" não dizia se o título tinha sido cancelado, renegociado ou só não pago; "venceu e ainda não foi
   recebido" é exatamente o que o número é — o valor em aberto dos títulos na faixa ATRASADO, que são os vencidos, não
   cancelados e sem baixa.
4. **O tema está aprovado, e a frase da Tela 2 está aprovada.** O tema fica como está ("clean analytical", abaixo). A
   frase da Tela 2 — *"o lucro líquido do ano até aqui é X, e a margem é Y%"* — está aprovada mas **ainda não está na
   tela**, e de propósito: "o ano até aqui" não é nenhum dos 12 indicadores que a Tela 2 tem hoje (os cartões dela são
   do mês, ou dos meses escolhidos), e escrevê-la agora seria criar número novo — o que esta reforma não pode fazer.
   Ela entra quando a Tela 2 for refeita, junto com o cartão de onde o número sai.

## Os filtros das três telas: lista suspensa com caixas de marcar

Antes, cada opção de filtro era uma etiqueta acesa ou apagada, e todas ficavam na tela o tempo todo: dezesseis centros
de custo, doze meses, as contas, as situações. Na Tela 1 isso eram quatro faixas de etiquetas antes do primeiro número.
Agora cada filtro é **uma caixa fechada que diz o que está escolhido**, e as opções aparecem só quando ela abre —
`app/suspensa.js`, que as três telas usam.

**Nenhum filtro mudou**: as opções são as mesmas, na mesma ordem, com os mesmos valores na mesma URL, e o que cada um
alcança continua sendo decisão de `lib/regras/filtros.mjs`. É por isso que `npm run conferir-filtros` continua dando 19
conferidos e `npm run conferir-telas` 36, com os mesmos números. Quatro coisas valem a pena ficarem escritas:

- **Caixa de marcar onde o filtro aceita vários; bolinha onde ele aceita um.** Centro de custo, situação, conta
  bancária, empresa, os meses da Tela 2 e o status da Tela 3 aceitam vários e são caixas de marcar. O **ano** e o
  **mês** são um valor só na URL (`?mes=8`) e são bolinhas: uma caixa de marcar ali prometeria uma escolha múltipla
  que o filtro não tem.
- **A empresa continua sendo "1, 2 ou as duas"**, agora como duas caixas: nenhuma marcada, ou as duas marcadas, é a
  soma de sempre (o filtro fica desligado); uma marcada é aquela empresa sozinha.
- **Existe um botão "aplicar", e ele não é enfeite.** Quem abre e fecha a caixa é o `<details>` do próprio HTML, sem
  uma linha de JavaScript — as telas são componentes de servidor e `scripts/capturar-tela.mjs` joga fora todo
  `<script>`. Sem JavaScript, marcar uma caixa não recarrega a tela sozinho: é o "aplicar" que escreve todas as
  escolhas na URL de uma vez. Em troca, dá para mexer em vários filtros e recarregar a tela uma vez só.
- **As listas longas continuam campos, e não viraram caixas de marcar:** a classificação do DFC, a categoria e o
  cliente/fornecedor da Tela 1, o cliente e a categoria da Tela 3, e as duas datas de vencimento. Elas nunca foram
  etiquetas — já eram listas suspensas —, e são listas de centenas de nomes: caixa de marcar ali só aumentaria a
  rolagem. Na Tela 3, os dois campos de data passaram a vir **vazios** quando a janela é a do mês, que é como
  `lib/regras/filtros.mjs` sempre leu o vazio: agora que o mês e as datas estão no mesmo formulário, um campo
  preenchido venceria a troca de mês.

Nas Telas 2 e 3 os filtros também se juntaram numa faixa só, antes dos números, porque agora os quatro (ou sete)
escrevem a mesma URL de uma vez e têm de viver no mesmo formulário. **Fora isso, e fora a frase da Tela 3, nada nas
Telas 2 e 3 mudou**: nenhum gráfico, nenhuma tabela, nenhum número.

## As adaptações que valem mais que a skill (pedido do dono, 28/09/2026)

1. **Nada de MotherDuck, DuckDB nem app Vite à parte.** As três telas continuam no app Next que já existe, com os
   dados da camada que já existe (`lib/dados.mjs`). A "Fase 0" da skill, que escolhe entre modo local e MotherDuck,
   não se aplica: o modo é sempre este app. Biblioteca de gráfico só como dependência npm local — **Recharts**, que é
   a preferida da própria skill. Nenhum número sai desta máquina.
2. **As perguntas da história não foram feitas ao dono.** Elas foram respondidas a partir de
   [`fontes.md`](fontes.md), de [`referencias/`](referencias/) — as três imagens dizem **quais blocos** cada tela tem;
   o visual é da skill — e da marca em [`public/marca/`](../public/marca/). Estão escritas abaixo **para o dono
   corrigir**.
3. **Só o visual muda.** Nenhum número, indicador, filtro, regra ou a trava de agosto. É por isso que
   `npm run conferir-telas` continua dando 36 conferidos e `npm run conferir-filtros` 19, com os mesmos números.

## O tema: "clean analytical" com as cores da marca

Das quatro opções da skill (Tufte minimal, Financial Times, Dark mode, Clean analytical), **clean analytical**: fundo
branco, tipografia sem serifa, régua horizontal cinza-clara, sem moldura e sem sombra nos painéis. O motivo é o
público — o dono lê a tela para decidir pagamento, não para explorar —, e é também o que combina com uma marca que é
só azul.

As cores continuam vindo de um lugar só, `app/globals.css`, e nenhuma é inventada (todas saem de pixel real das
imagens que o dono mandou em 27/09/2026):

| papel na tela | variável | cor |
|---|---|---|
| receita | `--marca-escura` | `#102040` |
| despesa | `--destaque` | `#0079cb` |
| o número de destaque e o mês em foco | `--marca` / `--marca-clara` | `#004888` / `#0060a8` |
| número negativo | `--negativo` | `#c4453b` |
| régua, borda e texto fraco | `--borda` / `--texto-fraco` | `#d5dbe4` / `#5d6b7e` |

Receita e despesa ficam nos dois extremos de claridade da marca — `#102040` e `#0079cb` — e não em dois azuis
parecidos, para as duas séries continuarem separadas impressas em cinza. **A mesma cor quer dizer a mesma coisa nos
quatro gráficos da Tela 1**, e é essa a razão de `app/graficos.js` não ter cor nenhuma escrita: cada série leva só uma
`className`, e quem diz a cor é o CSS.

---

# Tela 1 — Gestão de Contas

<!-- captura 1 -->

## A história (escrita por mim; corrigida pelo dono em 28/09/2026)

- **Para quem é:** o dono da MeuBESS, sozinho, neste computador. Não é um analista — é quem assina o pagamento.
- **Que decisão ela ajuda a tomar:** *o que pagar, o que segurar e onde cortar neste mês.*
- **A mensagem de 5 segundos:** *"o caixa do mês fechou em X."* É exatamente a frase que a tela escreve embaixo do
  título, e ela não traz número novo nenhum: X é o cartão "Saldo", logo abaixo. **O dono tirou a maior saída dela em
  28/09/2026** — a frase dizia "e a maior saída foi Y" e ficou só o caixa, que é a decisão que ele toma aqui. A maior
  saída continua na tela, na primeira barra de "Para onde foi a despesa".
- **As perguntas que a tela responde:**
  1. O caixa do mês fechou positivo ou negativo, e quanto entrou e saiu?
  2. Para onde foi a despesa — que classificações pesam mais?
  3. De quem veio a receita?
  4. Este mês foi típico dentro do ano, ou fora da curva?
  5. Quanto ainda está por pagar, e quanto o pessoal come da receita líquida?
  6. De onde saiu cada número que estou vendo?

## O plano de gráficos

| A pergunta | Caminho na árvore da skill | Gráfico | Por quê |
|---|---|---|---|
| "O caixa fechou positivo? Quanto entrou, saiu, já foi pago e ainda falta pagar?" | não passa pela árvore: é um número por vez | fila de 7 números, o "Saldo" maior e primeiro | um número sozinho não vira gráfico; vira número grande. A fila é a "linha de KPIs" da skill, e o "Saldo" é maior porque é dele que a frase de 5 segundos fala |
| "Este mês foi típico dentro do ano?" | TIME SERIES → várias séries → poucas séries (<7) → **Multi-linha** | duas linhas (receita e despesa) nos 12 meses, com uma linha de referência tracejada no mês que a tela está mostrando | eixo do tempo ordenado e contínuo, duas séries só; a linha tracejada põe o mês escolhido dentro do ano sem precisar de um segundo gráfico. É o gráfico **principal**: o maior e no canto de cima à esquerda |
| "Para onde foi a despesa?" | NUMÉRICO + CATEGÓRICO → uma observação por grupo → 1 numérico → **Barra** | barra deitada, as 10 maiores classificações do DFC, valor na ponta de cada barra | ranking categórico; deitada porque `IMPOSTOS E CONTRIBUIÇÕES` não cabe embaixo de uma coluna. O valor vai na ponta (rotulagem direta) porque ler o número é a tarefa aqui, e aí o eixo de valor some |
| "De quem veio a receita?" | NUMÉRICO + CATEGÓRICO → uma observação por grupo → 1 numérico → **Barra** | barra deitada, os 10 maiores recebimentos do mês, por cliente | mesmo caso do anterior, e de propósito com a mesma forma: os dois rankings ficam lado a lado e a única diferença de leitura é a cor — escuro é receita, claro é despesa |
| "Em que dias o dinheiro entrou e saiu?" | TIME SERIES → várias séries → poucas séries (<7) → Multi-linha, **trocado por colunas agrupadas** | colunas agrupadas, receita e despesa de cada dia do mês | a folha desta árvore seria multi-linha, e não segui: pagamento e recebimento acontecem em dias certos e a maior parte dos dias do mês é zero. Uma linha ligaria o dia 3 ao dia 9 como se houvesse fluxo no meio — a coluna não mente sobre isso. É também o que a imagem de referência do dono mostra |
| "De onde saiu cada número que estou vendo?" | não é gráfico: é a "tabela de detalhe" que fecha o F | tabela dos 11 indicadores com a fonte e a contagem de cada um | é a mesma contagem que cada cartão e cada gráfico já mostra no pé, reunida — a que `docs/conferencia.md` publica e `npm run conferir-telas` compara. Nenhum número novo entra por ela |

### A ordem da página (o "F" da skill)

De cima para baixo: o título e a frase de 5 segundos; o recorte (os filtros, numa faixa só); a fila de 7 números; o
gráfico principal, o maior, no canto de cima à esquerda; os três de apoio; a tabela de detalhe; e o rodapé com a
fonte, o período e a hora da leitura.

Os filtros viraram **uma faixa só**, entre o título e os números, e o que cada um alcança — que antes empurrava os
números para baixo da dobra — ficou num `o que cada filtro alcança` que abre e fecha. Desde 28/09/2026 essa faixa é
**uma linha só**: as etiquetas saíram e cada filtro é uma lista suspensa com caixas de marcar (a seção lá em cima
conta). **A frase de "o filtro não vale" NÃO entrou no que abre e fecha:** ela é parte do número, e continua dentro do
cartão, do gráfico e da linha da tabela, como `docs/filtros.md` manda.

## O que fica igual

- **Os 11 indicadores**, um por um, com o mesmo valor e a mesma contagem: eles continuam vindo inteiros de
  `lib/indicadores/tela-1.mjs`, que não foi tocado.
- **Os 7 filtros** (ano, mês, centro de custo, empresa, conta bancária, situação, categoria nas duas pontas e
  cliente/fornecedor), com as mesmas opções e na mesma URL de sempre — um link colado no chat continua abrindo a mesma
  tela. O que mudou em 28/09/2026 foi só o desenho deles.
- **Onde cada filtro não alcança**, com a frase ao lado do número (`app/filtrado.js`).
- **As fontes e as regras**: `lib/regras/` e `lib/dados.mjs` não mudaram uma linha.
- **A trava de agosto de 2026** e as três conferências.
- **Os gráficos, as tabelas e os números das Telas 2 e 3.** Nelas mudaram três coisas, e só estas: os filtros, que
  viraram listas suspensas como os desta tela; o lugar da faixa de filtros, que subiu para antes dos cartões porque
  agora todos escrevem a mesma URL de uma vez; e a frase de 5 segundos da Tela 3. Nenhum gráfico, nenhuma linha de
  tabela e nenhum indicador foi tocado.

## O checklist da fase 5 da skill, respondido

- [x] **Dá para entender a mensagem principal em 5 segundos?** Sim: a frase está escrita em português embaixo do
  título, em corpo maior que o resto — *"o caixa do mês fechou em X"* — e o número dela é o primeiro e o maior da fila
  logo abaixo. Ela tinha uma segunda metade (a maior saída), e o dono a tirou em 28/09/2026.
- [x] **Cada gráfico responde a uma pergunta específica?** Sim, e o título de cada um é a pergunta respondida, não a
  descrição do desenho: "O ano inteiro, e onde agosto cai nele", "Para onde foi a despesa", "O mês, dia a dia", "De
  quem veio a receita". A tabela de amarração está acima.
- [x] **Há hierarquia visual clara?** Sim: frase > número do "Saldo" (28px) > os outros seis (20px) > gráfico
  principal (duas colunas de três) > os de apoio > tabela de detalhe (11,5px). Os filtros, que antes ocupavam o
  primeiro terço da tela, viraram uma linha de caixas fechadas.
- [x] **Funcionaria impresso em cinza?** Sim para as séries: receita `#102040` e despesa `#0079cb` estão nos dois
  extremos de claridade da marca (relação de luminância de cerca de 3,5 para 1), e nos dois rankings a cor nem é
  necessária — cada gráfico tem uma série só e o valor está escrito na ponta da barra. O único lugar que perde
  informação em cinza é o vermelho do número negativo, que continua tendo o sinal "−" na frente.
- [x] **Há linha de referência e a fonte dos dados?** Linha de referência: a tracejada no mês em foco, no gráfico do
  ano, e a linha do zero no gráfico por dia. **Não pus média nem meta**, e é de propósito: média do ano seria um
  número novo, e esta reforma não pode criar número. Fonte: cada gráfico diz a sua numa linha embaixo do título, a
  tabela de detalhe diz a de cada indicador, e o rodapé diz o período, as empresas somadas, o arquivo do DFC e a hora
  das duas leituras.
- [x] **A paleta é consistente e tem significado?** Sim: quatro cores no total, todas da marca. Escuro é sempre
  receita, claro é sempre despesa, nos quatro gráficos. Nenhuma cor está escrita em `app/graficos.js` — todas moram
  em `app/globals.css`.
- [x] **A narrativa desce de contexto para ação?** Sim: contexto (que mês é, quanto sobrou) → tensão (onde o mês cai
  dentro do ano) → o que explica (para onde foi a despesa, de quem veio a receita, em que dias) → prova (a tabela de
  detalhe, indicador por indicador).

**A captura** está lá em cima, logo abaixo do título desta tela: [`tela-1-captura.html`](tela-1-captura.html), gerada
por `node scripts/capturar-tela.mjs --tela 1`, de 08/2026, com todo valor em dinheiro trocado por "—" e todo nome de
cliente trocado pelo código.

---

# Tela 2 — DRE (o desenho, a fazer; os filtros, feitos em 28/09/2026)

<!-- captura 2 -->

## A história (escrita por mim; o dono aprovou a frase em 28/09/2026)

- **Para quem é:** o dono e quem conversa com a contabilidade.
- **Que decisão ela ajuda a tomar:** *em que linha do resultado o dinheiro está escapando, e desde quando.*
- **A mensagem de 5 segundos:** *"o lucro líquido do ano até aqui é X, e a margem é Y%."* **Aprovada pelo dono em
  28/09/2026, e ainda não escrita na tela:** "o ano até aqui" não é nenhum dos 12 indicadores que esta tela tem hoje —
  os cartões dela são do mês, ou dos meses escolhidos —, e escrevê-la agora seria criar número novo. Ela entra quando
  esta tela for refeita, junto com o cartão de onde o número sai.
- **As perguntas que a tela responde:**
  1. Em que mês a margem caiu (ou subiu)?
  2. Qual linha do DRE explica a variação — é receita que caiu ou custo que subiu?
  3. Quanto cada linha pesa sobre a receita do mês (a análise vertical)?
  4. O ano está melhorando ou piorando?

## O plano de gráficos

| A pergunta | Caminho na árvore da skill | Gráfico | Por quê |
|---|---|---|---|
| "Quanto é a receita, o custo, o EBITDA, o lucro e a margem?" | não passa pela árvore | fila de 5 números, cada um com a fita dos 12 meses embaixo | é o que a tela já tem; a fita é um gráfico de linha miúdo, e a skill aceita isso como contexto do número |
| "Em que mês a margem caiu?" | TIME SERIES → 1 série → **Linha** | linha da margem nos 12 meses, com a linha do zero como referência | a margem já é calculada mês a mês (é o que a fita do cartão "Margem de lucro" desenha); promovê-la a gráfico próprio responde a pergunta sem criar número |
| "Qual linha do DRE explica a variação?" | CATEGÓRICO 2+ → subgrupo (linha do DRE × mês) → **Heatmap** | a coluna AH da tabela vira um mapa de calor: uma célula por linha do DRE e por mês | são doze colunas de variação percentual; em número, o olho não acha o pior mês. A mesma variação em intensidade de cor, sim. O número continua escrito na célula |
| "Quanto cada linha pesa sobre a receita?" | NUMÉRICO + CATEGÓRICO → uma observação por grupo → 1 numérico → **Barra** | barra deitada da análise vertical do mês escolhido | AV é uma proporção sobre a receita; barra deitada a partir do zero é a leitura mais direta disso |
| "Quero o número exato de cada linha e de cada mês" | tabela de detalhe | a tabela do DRE de hoje, inteira | ela já é a tabela de detalhe que fecha o F: fica, e só ganha menos moldura |

## O que fica igual

Os 12 indicadores da tela, a tabela do DRE linha por linha, as duas leituras (análise horizontal e vertical), os
filtros de mês (seleção múltipla), empresa e conta bancária, as frases de "o filtro não vale" e a conferência. O que já
mudou em 28/09/2026 foi só o desenho dos filtros — as etiquetas viraram listas suspensas com caixas de marcar, e as
duas leituras viraram duas caixas de marcar na mesma faixa.

---

# Tela 3 — Contas a Receber (o desenho, a fazer; os filtros e a frase, feitos em 28/09/2026)

<!-- captura 3 -->

## A história (escrita por mim; corrigida pelo dono em 28/09/2026)

- **Para quem é:** quem cobra — hoje o próprio dono.
- **Que decisão ela ajuda a tomar:** *para quem eu ligo hoje.*
- **A mensagem de 5 segundos:** *"X venceu e ainda não foi recebido."* Já está escrita na tela, embaixo do título, e
  não traz número novo: X é o cartão "Valor Vencido", logo abaixo. **A primeira escrita dizia "X já venceu e não
  entrou", e o dono trocou em 28/09/2026:** "não entrou" é vago — não diz se o título foi cancelado, renegociado ou só
  não pago. "Venceu e ainda não foi recebido" é exatamente o que o número é: o valor em aberto dos títulos na faixa
  ATRASADO, que são os vencidos, não cancelados e sem baixa.
- **As perguntas que a tela responde:**
  1. Quanto já venceu e ainda não foi recebido?
  2. De quem — quais clientes concentram o vencido?
  3. O que vence nos próximos meses?
  4. Como está a divisão entre pago, em aberto e atrasado?

## O plano de gráficos

| A pergunta | Caminho na árvore da skill | Gráfico | Por quê |
|---|---|---|---|
| "Quanto está previsto, recebido, pendente e vencido?" | não passa pela árvore | fila de 4 números, o "Valor Vencido" em destaque | é o número que decide a ligação de hoje |
| "Como se divide entre pago, em aberto e atrasado?" | CATEGÓRICO → 1 variável → **Rosca** | a rosca de hoje, com as três fatias | são três fatias, e a skill só proíbe pizza acima de cinco. Fica, com o número escrito ao lado de cada fatia |
| "De quem é o vencido?" | CATEGÓRICO 2+ → subgrupo (cliente × status) → **Barra empilhada** | barra deitada empilhada por cliente, uma faixa por status | mostra de uma vez quem deve mais e quanto disso já venceu — é a lista de quem ligar, na ordem |
| "O que vence quando?" | TIME SERIES → várias séries → poucas séries (<7) → Multi-linha, **trocado por colunas empilhadas** | colunas empilhadas por mês, uma faixa por status | mesma troca da Tela 1 e pelo mesmo motivo: vencimento é evento de um mês, não fluxo contínuo. Empilhado porque a soma das três faixas é o total do mês, e essa soma é uma leitura que interessa |
| "Quais títulos, um a um?" | tabela de detalhe | a lista de títulos de hoje | já é a tabela de detalhe que fecha o F |

## O que fica igual

Os 8 indicadores da tela, o de-para dos `cStatus` do Omie para pago / atrasado / em aberto, a janela de vencimento,
os filtros de status, cliente, categoria, empresa e conta bancária, as frases de "o filtro não vale" e a conferência.
O que já mudou em 28/09/2026 foram duas coisas: o desenho dos filtros (as etiquetas viraram listas suspensas com
caixas de marcar, e os dois campos de data passaram a vir vazios quando a janela é a do mês) e a frase de 5 segundos,
que passou a existir — nenhum número entrou na tela por causa dela.

---

# O que da skill não foi seguido, e por quê

1. **A Fase 0 inteira (MotherDuck / DuckDB / app Vite).** Pedido do dono: as telas ficam no app Next que já existe,
   com `lib/dados.mjs`. Não há Dive, não há DuckDB-WASM e nenhum número sai da máquina.
2. **As quatro perguntas da Fase 1 e a do tema não foram feitas ao dono.** Pedido do dono: respondê-las eu, a partir
   de `docs/fontes.md`, `docs/referencias/` e da marca, e deixá-las escritas para ele corrigir. É o que está acima.
3. **A Fase 2 (inspecionar a tabela com DuckDB) não roda.** A fonte deste projeto não é uma tabela: é o cache do
   Omie mais as planilhas do DFC, e o que elas têm está levantado, coluna por coluna, em `docs/fontes.md` —
   documento mais completo do que um `DESCRIBE` devolveria. A "forma dos dados" que a fase pede já estava pronta.
4. **Não perguntei "este plano de gráficos faz sentido?" antes de construir.** A tarefa pedia a Tela 1 refeita naquela
   passagem; o plano ficou escrito aqui para o dono responder com a tela na frente, e **em 28/09/2026 ele respondeu** —
   as quatro respostas estão lá em cima, e as quatro estão feitas. O plano das Telas 2 e 3 continua esperando a
   passagem em que elas forem refeitas.
5. **Nenhuma linha de referência de média, meta ou benchmark.** A skill pede "thresholds, benchmarks ou guias onde
   couber". Média do ano ou meta de despesa seriam números novos, e esta reforma não pode criar número. Só entraram
   as referências que não inventam nada: o mês em foco e a linha do zero.
6. **Sem filtro cruzado (clicar numa barra para filtrar o resto).** A skill sugere isso como interatividade. Os
   filtros desta tela são decisão do dono, moram na URL e estão conferidos um a um em `docs/filtros.md`; acrescentar
   um caminho novo de filtrar mudaria filtro, que está fora do combinado. Fica como proposta.
7. **O `ResponsiveContainer` do Recharts não é usado, e a versão é a 2 e não a 3.** As duas coisas pelo mesmo motivo:
   `scripts/capturar-tela.mjs` joga fora todo `<script>` da página, então o gráfico tem de sair pronto do servidor. O
   Recharts 3 devolve uma caixa vazia no servidor (conferido em 28/09/2026); o 2.15.4 desenha o SVG inteiro, desde que
   com largura e altura fixas e sem animação. Quem faz o desenho acompanhar a largura do painel é o `viewBox` do SVG,
   pelo CSS.
