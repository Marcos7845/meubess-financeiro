# Passagem — Tela 3, Fluxo de Caixa (29/09/2026)

Para o agente que continua este trabalho. Branch: `claude/fluxo-de-caixa` (a partir da `master`). Tudo o que está aqui
foi feito numa sessão na nuvem **sem acesso às fontes** — o `.env`, o cache `.cache/omie/` e as planilhas do DFC só
existem no computador do dono (`C:\Users\vrmfe\Documents\GitHub\meubess-financeiro`). Foi testado com dados de mentira
e conferido pelo dono na tela e pelo `scripts/diagnostico-dia-a-dia.mjs` rodado no PC dele.

Leia antes: `README.md` (as regras do projeto), `docs/fontes.md` seção **"Tela 3 — Fluxo de Caixa (desde 28/09/2026)"**
(o contrato de cada número) e `docs/layout.md` seção **"Tela 3 — Fluxo de Caixa"** (a história e o plano de gráficos).

## O que o dono pediu (28/09/2026)

A tela "Contas a Receber" virou **Fluxo de Caixa**:

- **para quem:** o dono e o departamento financeiro; **decisão:** a estratégia de venda (o que o comercial precisa fazer);
- **5 segundos:** quanto entrou, quanto saiu e se o mês fecha com lucro ou prejuízo;
- **perguntas:** o caixa do mês fechou positivo ou negativo · para onde foi a despesa (todas as **despesas fixas**) · de
  quem veio a receita (**indiferente**, sem detalhe) · o mês foi típico ou fora da curva (gráfico contra os meses
  anteriores) · quanto falta pagar e quanto as fixas consomem da receita líquida · de onde saiu cada número;
- depois: **o mês dia a dia** num gráfico só — consolidado (o que já foi) e previsão (o que vem) —, com o **valor ao passar
  o mouse**, partindo da **posição de caixa** real, e a **previsão em degradê cinza**.

## Onde está cada coisa

| o quê | onde |
|---|---|
| o cálculo da tela | `lib/indicadores/fluxo-de-caixa.mjs` (usa `calcularTela1` e `calcularTela3` para os cartões que já existiam) |
| a página | `app/fluxo-de-caixa/page.js`; `/receber` redireciona para ela |
| os gráficos | `app/graficos.js`: `FluxoNoAno` (o mês contra os anteriores) e `DiaADiaDoFluxo` (o dia a dia) |
| largura real dos gráficos no navegador (conserta o mouse em **todos** os gráficos das três telas) | `useLargura` em `app/graficos.js` |
| a lista de despesas fixas | `dados/despesas-fixas.json`, gravado por `scripts/despesas-fixas.mjs` a partir da planilha respondida (`docs/despesas-fixas-respondida-2026-09-28.xlsx`) |
| o saldo de cada banco (abertura e último `SALDO` de cada bloco do `FLUXO DE CAIXA`) | `saldosPorBanco` em `lerMesDoDfc`, `lib/regras/dfc.mjs` |
| diagnóstico do dia a dia, só no terminal (traz valor em dinheiro) | `scripts/diagnostico-dia-a-dia.mjs --mes 9 [--dias 1,31] [--saldos]` |
| vários meses no dia a dia (`?meses=4,5,6,7,8`, a lista "dia a dia" do recorte; pedido de 29/09) | `periodo` em `lib/indicadores/fluxo-de-caixa.mjs` |
| os cinzas da previsão | `--previsao-escuro` / `--previsao-claro` em `app/globals.css` |

## Decisões e achados que não se adivinham

1. **Lucro ou prejuízo é o resultado do mês = Entrou − Saiu** (os cartões da Tela 1). A primeira versão usou a projeção e
   disse "prejuízo" em agosto com entrou > saiu; o dono corrigiu. A **projeção** (resultado + a receber − a pagar) só
   existe com o mês em andamento; num mês fechado o cartão do Omie vira "Venceu no mês e não foi pago".
2. **Despesa fixa não existe nas fontes**: quem decide é a gestora. Ela respondeu 33 fixas e 21 variáveis (na coluna C,
   vocabulário "DESPESA FIXAS"/"DESPESA VARIAVEL" — o script aceita). Três contas não voltaram na resposta e ficam fora:
   `COMPRA PROVISÃO`, `COMPRAS - PROVISÃO`, `CRÉDITO REPASSE - CUSTO`.
3. **O gráfico do ano** sai das linhas do `FLUXO DE CAIXA` de cada mês, pela conta dos cartões, de janeiro ao mês
   escolhido. A primeira versão usava o bloco `Entradas`/`Gastos` da aba do mês e não batia com os cartões.
4. **O quadro do caixa da aba do mês NÃO é mantido** (diagnóstico no PC do dono, 28/09): `Entradas`/`Gastos` quase sempre
   zero, `Final` parado, `Inicial` do dia 1 com o mesmo valor em agosto e setembro. Não serve de saldo.
5. **A posição de caixa parte da abertura dos bancos**: em cada bloco de banco do `FLUXO DE CAIXA` (Itáu, 46267, BB), o
   `SALDO` da primeira linha menos o movimento dela (medido no PC do dono: a linha de setembro passou a ficar positiva). A posição
   soma **todas** as linhas do dia (transferência inclusive); as colunas entrou/saiu seguem a conta dos cartões.
6. **Nenhuma linha cai no dia pelo vencimento** — todas têm `DIA PG` (medido). A suspeita inicial estava errada.
7. **Um eixo só** no dia a dia (com dois, uma posição positiva parecia negativa). A dica do mouse mostra a posição com
   sinal e a saída como positiva, e esconde o que é zero.
8. **Os gráficos são desenhados no servidor com largura fixa** (`scripts/capturar-tela.mjs` joga fora todo `<script>`)
   e, no navegador, `useLargura` os redesenha na largura do quadro — sem isso, o mouse caía no dia errado.

## O que está em aberto

- **Conferir a posição com os bancos**: embaixo do gráfico diário a tela compara a linha, no último dia consolidado, com
  a soma do último `SALDO` dos bancos. O dono ainda não disse se deu "Conferido" ou a diferença.
- **Um valor alto (na casa dos milhões) a pagar vencido e não baixado no Omie** em setembro: ou são contas pagas sem baixa no Omie, ou atrasos
  reais. Fica fora do gráfico diário, mas entra na projeção. Sugerido que a gestora confira alguns títulos.
- **Duas decisões do dono, marcadas em `docs/fontes.md`**: se o **vencido a receber** entra na projeção; se a régua do
  **"fora da curva"** (um desvio-padrão dos meses anteriores, com 3 ou mais meses) está boa.
- **As três contas ausentes** da resposta da gestora (item 2 acima).
- **Conferência com dado real**: os números novos (fixas, peso na receita líquida, projeção, dia a dia) ainda não passaram
  pela conferência de um mês fechado, como os outros (`docs/conferencia.md`). `npm run conferir-telas` e
  `conferir-filtros` continuam valendo para os números que já existiam.
- **A captura da Tela 3** (`docs/tela-3-captura.html`) ainda é a da antiga Contas a Receber: rodar
  `npm run capturar-tela-3` no PC do dono. `medir-filtros` também só roda lá.
- **Merge**: nada foi para a `master`. Não há pull request aberto.

## Como trabalhar sem as fontes

Dá para montar dados de mentira: um cache do Omie em `OMIE_CACHE_DIR` (os nomes de arquivo saem de `arqCacheOmie` e
`leiturasDe` em `lib/regras/cache-omie.mjs`) e planilhas em `DFC_DIR` (`NN - NOME.xlsx`, uma aba do mês com `Inicial` /
`Entradas` / `Gastos` / `Final` nas linhas 42–45 e uma aba `FLUXO DE CAIXA` com o cabeçalho de `docs/fontes.md`, a
coluna `SALDO` e a `SAIDA` negativa). `npm run build` e `next start` com essas duas variáveis sobem a tela. Nunca grave
valor em dinheiro em arquivo versionado — nem em comentário, nem em documento, nem em **mensagem de commit** —; o que tem
dinheiro só vai para o terminal do dono. (Quatro mensagens de commit desta branch trazem valores reais; o dono decide se
o histórico é reescrito antes do merge.)

## Como o dono vê

```powershell
cd C:\Users\vrmfe\Documents\GitHub\meubess-financeiro
git pull
npm run local        # http://127.0.0.1:4781/fluxo-de-caixa?ano=2026&mes=9
```
