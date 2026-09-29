# Passagem — Tela 3, Fluxo de Caixa

**Registro vivo.** Branch: `claude/fluxo-de-caixa` (a partir da `master`). Quem continua o trabalho lê este arquivo
primeiro, e depois o `README.md`, a seção **"Tela 3 — Fluxo de Caixa (desde 28/09/2026)"** de
[`docs/fontes.md`](fontes.md) (o contrato de cada número) e a seção **"Tela 3 — Fluxo de Caixa"** de
[`docs/layout.md`](layout.md) (a história e o plano de gráficos). Quem termina uma sessão escreve aqui o que achou.

| sessão | onde rodou | o que fez |
|---|---|---|
| 28/09/2026 | nuvem, **sem as fontes** | construiu a tela inteira, testada com dados de mentira |
| 29/09/2026 | computador do dono, **com as fontes** | conferiu a posição de caixa com o saldo dos bancos, achou e consertou a leitura do saldo corrido, e pôs os quatro números novos na conferência de um mês fechado |

## Posição de caixa contra o SALDO dos bancos: confere

Medido em 29/09/2026 no computador do dono, com as planilhas de verdade, em **setembro** (o mês corrente, corte no dia
29) e em **agosto** (o mês fechado da conferência). Nos dois a diferença é **R$ 0,00 — 0,0000%**, sem um centavo sem
explicação. Antes do conserto a diferença em setembro era de **26% do saldo dos bancos**.

A conta não é "a posição é igual ao último `SALDO`", porque não deve ser: **o saldo corrido da planilha corre até a
última linha digitada do mês**, e essas linhas finais incluem lançamentos que ainda não foram baixados — que o caixa
consolidado, com razão, deixa de fora. O que fecha é a ponte:

> posição no último dia consolidado **+** o que o saldo já desconta e não está baixado **+** o baixado depois do corte
> **−** o que a planilha lançou depois de parar de escrever o saldo **=** o último saldo escrito, somado entre os bancos

Os dois últimos termos não são enfeite: em setembro há **14 linhas** ainda `A PAGAR` (ou sem `PAGAMENTO`) que o saldo
já desconta, e em agosto **dois dos cinco blocos** param de escrever o saldo no meio e seguem lançando (a STONE na
linha 400, com mais de vinte lançamentos depois dela). A tela escreve essa ponte embaixo do gráfico diário, o
`scripts/diagnostico-dia-a-dia.mjs` a escreve no terminal com os valores, e a conferência a publica como veredito.

**Como reproduzir** (traz valor em dinheiro, e por isso só no terminal):

```powershell
node scripts/diagnostico-dia-a-dia.mjs --mes 9 --saldos
node scripts/diagnostico-dia-a-dia.mjs --mes 8
```

### A causa, e o conserto

A leitura de `saldosPorBanco` (`lerMesDoDfc`, `lib/regras/dfc.mjs`) partia de uma suposição errada sobre a planilha:
que `ENTRADA` (K), `SAIDA` (L) e `SALDO` (M) fossem entrada, saída e saldo. **Não são.** Medido nos doze arquivos de
2026:

- em **setembro**, `K` traz o **valor com sinal de toda linha** e `L` e `M` são a **mesma coluna de saldo corrido**,
  partida pelo sinal — o saldo depois da linha vai em `L` quando o movimento é positivo e em `M` quando é negativo;
- em **abril**, `K` vem vazio, `L` traz a saída (negativa) e `M`, o saldo;
- em **julho**, não há saldo nenhum e `L` traz a entrada.

Com a suposição antiga, a abertura de um banco saía da **primeira linha com a célula `M` preenchida**. No bloco do BB
de setembro essa linha é a 375ª, vinte e cinco linhas depois do começo: a abertura saiu muito acima do zero em que o
banco realmente abre, e no bloco 46267 saiu o valor de uma transferência acima. Somadas, as três aberturas começavam a
linha do gráfico **15% acima** do caixa de verdade.

O conserto não confia em coluna nenhuma: **só aceita um número como saldo quando ele é o saldo anterior mais o
movimento da linha**, e conta quantas vezes isso não aconteceu (`desvios`). Duas provas de que a leitura nova está
certa:

- **onde os dois meses têm as mesmas contas, a abertura de um passou a ser o fechamento do outro, ao centavo** — o que
  a leitura antiga não dava (com ela, fevereiro abria em zero com janeiro fechando em seis dígitos). Vale de janeiro para
  fevereiro e de fevereiro para março; de abril em diante os blocos de banco mudam de um arquivo para o outro, e aí os
  dois números não têm por que ser iguais;
- **nos seis meses de 2026 sem nenhum desvio (jan, fev, ago, set, nov, dez) a ponte fecha em R$ 0,00; nos seis com
  desvio (mar, abr, mai, jun, jul, out) ela não fecha.** A correlação é perfeita nos doze, o que diz que o que sobra
  nesses seis é a planilha não mantendo a própria coluna, e não a leitura.

Onde a coluna não é mantida, a tela **não dá veredito**: diz que a conferência não pode ser feita naquele mês e quantos
blocos pulam.

**Nada mudou nas Telas 1 e 2.** As quatro condições de uma linha do fluxo (não ser linha de saldo, ter movimento, estar
baixada, ter data no mês) são as mesmas; só passaram a ser lidas num lugar só. Conferido linha por linha contra o
código anterior: as **4.694 linhas** dos doze arquivos de 2026 saem idênticas, e `cruas` e `abaDoMes` também.

## Onde está cada coisa

| o quê | onde |
|---|---|
| o cálculo da tela | `lib/indicadores/fluxo-de-caixa.mjs` (usa `calcularTela1` e `calcularTela3` para os cartões que já existiam) |
| a página | `app/fluxo-de-caixa/page.js`; `/receber` redireciona para ela |
| os gráficos | `app/graficos.js`: `FluxoNoAno` (o mês contra os anteriores) e `DiaADiaDoFluxo` (o dia a dia) |
| largura real dos gráficos no navegador (conserta o mouse em **todos** os gráficos das três telas) | `useLargura` em `app/graficos.js` |
| a lista de despesas fixas | `dados/despesas-fixas.json`, gravado por `scripts/despesas-fixas.mjs` a partir da planilha respondida (`docs/despesas-fixas-respondida-2026-09-28.xlsx`) |
| o **saldo corrido** de cada banco (abertura, último saldo escrito, o não baixado e os desvios) | `saldoDoBanco` e `saldosPorBanco` em `lerMesDoDfc`, `lib/regras/dfc.mjs` |
| a **ponte** entre a linha do gráfico e o saldo dos bancos | `conferenciaDosBancos` em `lib/indicadores/fluxo-de-caixa.mjs`; a frase da tela em `app/fluxo-de-caixa/page.js` |
| diagnóstico do dia a dia e a ponte, só no terminal (traz valor em dinheiro) | `scripts/diagnostico-dia-a-dia.mjs --mes 9 [--dias 1,31] [--saldos]` |
| os quatro números novos na conferência de um mês fechado | `scripts/numeros-das-telas.mjs`, seção "Tela 3, os números que o Fluxo de Caixa trouxe" |
| vários meses no dia a dia (`?meses=4,5,6,7,8`, a lista "dia a dia" do recorte; pedido de 29/09) | `periodo` em `lib/indicadores/fluxo-de-caixa.mjs`; cada mês recomeça na abertura dos bancos dele (`saldosPorBanco`) |
| as fixas de um período e "explodir" cada conta nos lançamentos (29/09) | `fixas` em `periodo` e `lancamentos` em cada conta (`lib/indicadores/fluxo-de-caixa.mjs`); o clique é `app/conta-explodivel.js`; `quem`/`titulo` em `lerMesDoDfc` |
| o gráfico do ano saiu da tela (29/09: "meio sem propósito"); ficaram as frases de fora da curva | `d.serie` continua calculado, e a conferência o lê |
| os cinzas da previsão | `--previsao-escuro` / `--previsao-claro` em `app/globals.css` |

## Decisões e achados que não se adivinham

1. **Lucro ou prejuízo é o resultado do mês = Entrou − Saiu** (os cartões da Tela 1). A primeira versão usou a projeção
   e disse "prejuízo" em agosto com entrou > saiu; o dono corrigiu. A **projeção** (resultado + a receber − a pagar) só
   existe com o mês em andamento; num mês fechado o cartão do Omie vira "Venceu no mês e não foi pago".
2. **Despesa fixa não existe nas fontes**: quem decide é a gestora. Ela respondeu **33 fixas e 21 variáveis** (na coluna
   C, vocabulário "DESPESA FIXAS"/"DESPESA VARIAVEL" — o script aceita). **Três** contas de despesa não voltaram na
   resposta e ficam fora: `COMPRA PROVISÃO`, `COMPRAS - PROVISÃO`, `CRÉDITO REPASSE - CUSTO` (`ausentesDaResposta` em
   `dados/despesas-fixas.json`). Não confundir com as **14** de `semResposta`, que são receitas, saldos e transferências
   da outra aba — não são despesa e nunca foram para ela classificar.
3. **O gráfico do ano** sai das linhas do `FLUXO DE CAIXA` de cada mês, pela conta dos cartões, de janeiro ao mês
   escolhido. A primeira versão usava o bloco `Entradas`/`Gastos` da aba do mês e não batia com os cartões.
4. **O quadro do caixa da aba do mês NÃO é mantido** (diagnóstico no PC do dono, 28/09): `Entradas`/`Gastos` quase
   sempre zero, `Final` parado, `Inicial` do dia 1 com o mesmo valor em agosto e setembro. Não serve de saldo, e fica
   só como reserva para uma planilha sem saldo corrido.
5. **As três colunas de dinheiro do `FLUXO DE CAIXA` não são entrada, saída e saldo** — ver "A causa, e o conserto",
   acima. É o achado de 29/09/2026, e é o que a leitura do saldo corrido tem de tratar.
6. **A posição de caixa parte da abertura dos bancos**: o saldo corrido escrito na **primeira linha do bloco** de cada
   banco (a linha de abertura, que não tem `PAGAMENTO` e por isso nunca entra no fluxo), somado entre os bancos. A
   posição soma **todas** as linhas do dia (transferência inclusive); as colunas entrou/saiu seguem a conta dos cartões.
7. **Nenhuma linha cai no dia pelo vencimento** — todas têm `DIA PG` (medido). A suspeita inicial estava errada.
8. **Um eixo só** no dia a dia (com dois, uma posição positiva parecia negativa). A dica do mouse mostra a posição com
   sinal e a saída como positiva, e esconde o que é zero.
9. **Os gráficos são desenhados no servidor com largura fixa** (`scripts/capturar-tela.mjs` joga fora todo `<script>`)
   e, no navegador, `useLargura` os redesenha na largura do quadro — sem isso, o mouse caía no dia errado.

## Onde está a prova

- **Conferência de um mês fechado (agosto de 2026):** `npm run conferencia` → **40 indicadores, 40 conferidos, 0
  divergentes, 0 a conferir**. Os quatro que entraram nesta sessão são "Despesas fixas pagas", "Fixas / receita
  líquida", "Projeção do mês" e "O mês dia a dia", em [`docs/conferencia.md`](conferencia.md). A trava de agosto
  (`docs/trava-agosto-2026.json`) foi conferida e **não** refeita.
- **A tela contra a conferência:** `npm run conferir-telas` → **40 indicadores, 40 conferidos, 0 divergentes**
  ([`docs/telas-conferidas.md`](telas-conferidas.md)). A linha de "O mês dia a dia" compara também o veredito da ponte
  com os bancos, os dias com movimento, os blocos de banco e as linhas não baixadas.
- **Os filtros contra a fonte:** `npm run conferir-filtros` → **19 filtros, 19 conferidos, 0 divergentes**.
- **A captura da tela:** [`docs/tela-3-captura.html`](tela-3-captura.html), refeita da Tela 3 nova com
  `npm run capturar-tela-3` (era a da antiga Contas a Receber). [`docs/layout.html`](layout.html) refeito com ela
  dentro, agora na seção do Fluxo de Caixa e não na da tela antiga.
- **O clique de filtro:** `npm run medir-filtros` → pior clique de 38 ms na Tela 1, 613 ms na Tela 2 e 32 ms na Tela 3
  ([`docs/desempenho.md`](desempenho.md)).

## O que está em aberto

Cada item é uma pergunta ao dono ou à gestora, com a recomendação de quem escreveu esta passagem. `- [ ]` é aberto,
`- [x]` é resolvido.

- [x] **A posição de caixa bate com o saldo dos bancos?** Bate: a ponte fecha em R$ 0,00 em setembro e em agosto de
      2026. A causa da diferença anterior e o conserto estão acima.
- [x] **Os quatro números novos foram conferidos com dado real?** Foram, com agosto de 2026, no mesmo formato dos
      outros — 40 de 40 conferidos nos dois lados.
- [x] **A captura da Tela 3 é a da tela nova?** É, refeita nesta sessão.

- [ ] **O vencido a receber entra na projeção do mês?** Hoje **não entra**: a projeção é resultado do mês + o que ainda
      vence no mês a receber − o que ainda vence a pagar, e o que já venceu e não foi recebido aparece à parte.
      **Pergunta ao dono:** a "Projeção do mês" deve somar também o vencido a receber?
      **Recomendação: não somar, e manter como está.** A projeção responde "se eu receber e pagar o que vence neste mês,
      o caixa fecha positivo?"; jogar o vencido dentro dela é supor que um título já atrasado entra no mês, o que é
      justamente o que não se sabe. O vencido tem o lugar dele, ao lado, e é ele que dá a conversa com o comercial.
- [ ] **A régua do "fora da curva" está boa?** Hoje é um desvio-padrão dos meses anteriores do mesmo ano, e só com 3
      meses anteriores ou mais. **Pergunta ao dono:** um desvio-padrão é a régua certa, ou o senhor quer um percentual
      fixo (por exemplo 20% acima ou abaixo da média)?
      **Recomendação: manter um desvio-padrão.** Ele se adapta a um negócio com meses muito diferentes entre si, que é o
      caso aqui; um percentual fixo acusaria "fora da curva" quase todo mês. Se for para trocar, o percentual é mais
      fácil de explicar numa reunião — a troca é de uma linha (`comparar` em `lib/indicadores/fluxo-de-caixa.mjs`).
- [ ] **As três contas de despesa que a gestora não devolveu.** `COMPRA PROVISÃO`, `COMPRAS - PROVISÃO` e
      `CRÉDITO REPASSE - CUSTO` ficaram sem classificação e por isso **fora** das despesas fixas.
      **Pergunta à gestora:** cada uma delas é fixa ou variável?
      **Recomendação: perguntar, e enquanto não vier, manter fora.** As três têm cara de conta de provisão e de repasse,
      que variam com a venda — mas "ter cara de" não é fonte, e a regra do projeto é que despesa fixa é decisão dela.
      São 27 das 33 contas fixas que apareceram em agosto, então a lista já está quase inteira em uso: as três mudam
      pouco o total e não valem travar a tela.
- [ ] **Os títulos a pagar vencidos e não baixados no Omie.** Em setembro de 2026 há **140 títulos** a pagar que
      venceram antes de hoje e não têm baixa, num valor alto — ou são contas pagas sem baixa no Omie, ou atrasos reais.
      Eles ficam **fora** do gráfico diário (não têm dia previsto) e **entram** na projeção, que a tela escreve à parte.
      **Pergunta à gestora:** dá para conferir uma amostra desses títulos e dizer se já foram pagos sem baixa?
      **Recomendação: conferir dez deles, os de maior valor, antes de usar a projeção numa decisão.** Se a maioria já
      estiver paga, o número não é dívida e sim um vazio de baixa no Omie, e aí a projeção da tela está pessimista por
      um motivo que não é do negócio. O valor em reais sai no terminal, nunca em arquivo.
- [x] **Reescrever o histórico da branch antes do merge.** Resolvido em 29/09/2026 com o *squash* recomendado: a branch
      entrou na `master` num commit só, com a mensagem escrita do zero e sem valor em dinheiro.
      (O texto original da pergunta segue abaixo.) Quatro mensagens de commit desta branch (as de 28/09/2026)
      trazem valores em reais, contra a regra do projeto de que dinheiro não entra em mensagem de commit.
      **Pergunta ao dono:** reescrevo o histórico da `claude/fluxo-de-caixa` para tirar os valores das mensagens antes
      do merge, ou o senhor prefere um *squash* na hora do merge?
      **Recomendação: squash no merge.** Um `git rebase` interativo reescreve todos os commits da branch e é mais
      trabalho e mais risco; um squash resolve o mesmo problema com uma mensagem só, escrita do zero e sem dinheiro. Em
      qualquer dos dois casos, a decisão é do dono e nada foi feito: **o histórico está como estava**.
- [x] **Merge com a `master`.** Feito em 29/09/2026, por *squash*, sem pull request e sem push; a conferência foi refeita
      na `master` depois dele (40 de 40 nas telas, 19 de 19 nos filtros). (O texto original segue abaixo.)
      **Pergunta ao dono:** posso abrir o pull request?
      **Recomendação: abrir depois de o senhor ver a tela.** A conferência e os testes passam, mas o veredito de "a tela
      responde a pergunta que eu faço" é do dono, e a tela só roda neste computador.
- [ ] **Os seis meses em que a planilha não mantém o saldo corrido** (mar, abr, mai, jun, jul e out de 2026). Neles a
      tela não confere a posição com os bancos, e diz isso.
      **Pergunta à gestora:** a coluna de saldo desses meses pode ser refeita, ou ela não é usada no dia a dia?
      **Recomendação: não mexer na planilha por causa da tela.** A tela já diz quando não pode conferir, que é o
      comportamento certo. Vale perguntar só para saber se a coluna é usada — se não for, a conferência com os bancos
      será sempre possível apenas nos meses em que a gestora a mantém, e isso está bom.

## Como o dono vê

```powershell
cd C:\Users\vrmfe\Documents\GitHub\meubess-financeiro
git checkout claude/fluxo-de-caixa
npm run local        # http://127.0.0.1:4781/fluxo-de-caixa?ano=2026&mes=9
```

Se a porta 4781 já estiver ocupada por um app antigo, ele serve o código velho: pare-o antes, ou suba ao lado com o
passo a passo de "Sem derrubar o app que está no ar", no `README.md`.

## Regra que não se negocia

**Valor em dinheiro não entra em arquivo versionado** — nem em comentário, nem em documento, nem em mensagem de commit.
O que tem dinheiro vai só para o terminal do dono (`scripts/diagnostico-dia-a-dia.mjs`,
`scripts/confronto-dfc-omie.mjs`). Nome de cliente também não: a captura troca cada nome pelo código antes de gravar, e
recusa a captura se sobrar um. E **nada aqui escreve** no Omie, nas planilhas ou em qualquer sistema financeiro.
