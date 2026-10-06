# As três telas no ar — conferências de 30/09 e 01/10/2026

**Projeto antigo abandonado (06/10/2026):** o projeto `meubess-financeiro` do Railway, de endereço
`meubess-financeiro-production.up.railway.app`, está **abandonado**: o teste gratuito venceu, o `railway up` é
recusado ("Your trial has expired"), os deploys estão `REMOVED` e o endereço responde 404. **O portal real é
`financeiro.meubess.com.br`, no projeto `meubess-calc-financ`, publicado pelo envio à `master` do GitHub** (não por
`railway up`). O que está abaixo sobre o projeto antigo é histórico medido, mantido como estava.

**Estado:** publicado no Railway, com login, e **as três telas abrem** para o administrador. O serviço segue de pé depois
de abri-las. Aqui só vão contagens, códigos e horas; nenhum valor em reais nem credencial.

## Endereço

`https://meubess-financeiro-production.up.railway.app` — domínio `*.up.railway.app` do serviço `meubess-financeiro`
(projeto `meubess-financeiro`, ambiente `production`, volume em `/data`). `http://` responde 301 para o `https://`.

## Publicação de 01/10/2026 — commit `27a7ec9`

O que subiu: o commit `27a7ec9` ("DRE: Retirada de sócio em linha própria abaixo do lucro líquido; 2.10.99 fora do DRE;
cartões das 3 telas abrem o que somam"), da árvore limpa da `master`, do mesmo modo da publicação anterior: `railway up
--ci` com um token de projeto criado só para este envio e apagado em seguida (0 tokens de projeto restantes). Login,
variáveis, comando de início/build/saúde (`npm run servidor`, `npm run build`, `/entrar`) e limite de memória
(`MEMORY_LIMIT_GB` 1,000) **não foram mexidos**.

- **Deploy `1952a59e-d1db-4152-8bed-e9847f7bcd47`: `SUCCESS`**, criado às 12:50:17 UTC, mensagem `commit-27a7ec9`; o
  anterior, `4df298c4`, ficou `REMOVED`. Contêiner iniciado às 12:51:13 UTC ("As três telas sobem em 0.0.0.0:8080,
  com login"), volume `/data` montado; nenhum erro nos logs além do aviso `npm warn config production` de sempre.

Conferido no ar a partir de 12:52:56 UTC (09:52 em Brasília), por HTTP:

- **https e sem login:** `http://` → 301 para `https://`; `/entrar` → 200; `/`, `/dre`, `/fluxo-de-caixa`, `/receber`
  e `/admin` → 307 para `/entrar?volta=…`; `GET` e `POST /api/atualizar` → 401; `GET /api/dfc` sem segredo → 401.
- **E-mail sem cadastro barrado:** `POST /api/entrar` → 303 para `/entrar?erro=1`, sem cookie.
- **Administrador entra:** 303 para `/` com cookie de sessão; `/admin` → 200.
- **As três telas abrem logado:** `/?ano=2026&mes=8`, `/dre?ano=2026&mes=8` e `/fluxo-de-caixa?ano=2026&mes=8` → 200
  (a primeira abertura da Tela 1 levou ~11 s; as seguintes, menos de 1,2 s).
- **DRE de agosto/2026:** a linha **"Retirada de sócio"** está na tabela e abre **51 lançamentos do Omie**; o quadro
  **"Fora do DRE"** está na página, com "Implantação de saldos (saídas)" abrindo **7 lançamentos do Omie**; "(−) Despesas
  gerais" abre **140** (eram 198 em 30/09: 198 − 51 − 7 = 140). As três contagens são as de `docs/telas-conferidas.md`
  (Despesas gerais 140, Retirada de sócio 51) e de `docs/conferencia.md` (Fora do DRE 7).
- **Cada cartão abre o que soma:** em toda composição que a página recebe, a soma dos itens (lista), a conta das partes
  (conta) ou o numerador ÷ denominador (razão) é igual ao valor dela, ao centavo, e o valor em reais das listas aparece
  escrito na página. Tela 1: 7 de 7 iguais; Tela 2: 19 de 19 (5 cartões, 13 linhas do DRE e o quadro "Fora do DRE");
  Fluxo de Caixa: 7 de 7. Um cartão de cada tela, com a contagem de itens:
  - Tela 1 — **Saldo**: lista de 388 linhas do DFC (= DFC 388 de `docs/telas-conferidas.md`), total igual ao cartão.
  - Tela 2 — **Receita total**: lista de 101 linhas do DFC (= DFC 101), total igual ao cartão.
  - Fluxo de Caixa — **Entrou**: lista de 101 linhas do DFC, total igual ao cartão.
- **Memória** (métrica do Railway, amostras de 30 s, de 12:50:00 a 12:54:30 UTC): **pico de 0,521 GB** às 12:54:00 UTC,
  depois de abrir as três telas (0,204 GB antes de abri-las); limite 1,000 GB.
- **O envio do DFC segue:** a tarefa `financeiro-enviar-dfc`, lida às 09:54 (Brasília), está `Ready`, **habilitada**,
  última execução 01/10/2026 09:00:01 com resultado 0, próxima 10:00, nenhuma perdida. `GET /api/dfc` (com o segredo)
  registra o último envio em `2026-10-01T12:00:01Z`, 13 planilhas — o volume guardou o envio através do deploy.

## Medição posterior à publicação de 01/10/2026 (deploy `1952a59e`) — lida às 13:29 UTC (10:29 em Brasília)

Só leitura: nada de serviço, variável, tarefa ou código foi mexido.

- **Memória:** janela de **12:50:00 a 13:29:00 UTC** (79 amostras de 30 s, ~39 min, cobrindo a releitura completa do
  Omie, que leva ~11 min depois de subir, e a sequência de leituras de depois dela). **Pico máximo: 0,654 GB**, às 13:10:00
  UTC; limite 1,000 GB. Máximo por faixa de 5 min: 12:50 → 0,522; 13:00 → 0,457; 13:10 → 0,654; 13:20 → 0,480 GB.
  Última amostra (13:29:00): 0,444 GB. O pico é do mesmo tipo do de 30/09 (0,594 GB, base nova montada ao lado da velha).
- **Tarefa `financeiro-enviar-dfc`, passagem das 10:00 (Brasília):** `Get-ScheduledTaskInfo` às 10:29 dá última execução
  `01/10/2026 10:00:01`, **resultado 0**, próxima 11:00:00, nenhuma passagem perdida; tarefa `Ready` e habilitada.
  `GET /api/dfc` (com o segredo) registra o **último envio em `2026-10-01T13:00:01Z`** (10:00:01 em Brasília), 13 planilhas.
- **Deploy:** `1952a59e-d1db-4152-8bed-e9847f7bcd47` segue **`SUCCESS`** (é o último; os anteriores, `REMOVED`). O log do
  contêiner tem **1 "Starting Container"** (12:51:13 UTC), nenhuma linha de `heap out of memory`, `OOM`, `killed` ou
  `SIGKILL`: **nenhum reinício por falta de memória**. `/entrar` → 200.

## O que foi feito no Railway

- Domínio criado, porta 8080 (variável `PORT=8080` acrescentada ao serviço).
- Comando de início e de build gravados **no serviço** (`npm run servidor`, `npm run build`, saúde em `/entrar`, 120 s,
  reinício `ON_FAILURE` até 5): o Railway não aplicou o `railway.json` num envio por `railway up` — a API responde que
  "Config as Code (railway.json) is deprecated". O primeiro deploy subiu com `npm start` (preso em `127.0.0.1`, só 502,
  nada exposto); o segundo, `4bda1d8a`, com `npm run servidor`; o terceiro, `4df298c4` (30/09, 23:13 UTC), com o
  leitor de planilha que não estoura a memória (abaixo).
- `MEUBESS_ADMIN_EMAIL` e `MEUBESS_ADMIN_SENHA` **tiradas** das variáveis depois do login do administrador funcionar, e
  não voltaram: o administrador ficou no cadastro do volume e entra sem elas. Ficaram: `SESSAO_SEGREDO`,
  `DFC_ENVIO_SEGREDO`, as quatro chaves do Omie 1 e 2, `PORT`.
- Os tokens de projeto usados em cada deploy foram criados só para ele e apagados em seguida.

## A memória (30/09/2026)

O deploy `4bda1d8a` caía ao abrir as telas: `JavaScript heap out of memory` perto de 480 MB de heap, reinícios e 502,
até o Railway desistir (`CRASHED`). O serviço tem **1 GB** (`memoryBytes` 1.000.000.000, lido pela API às 23:07 UTC
de 30/09; o limite não foi mexido).

**A causa:** a aba ` 2026` de cada arquivo do DFC tem **1.048.504 linhas** — quase todas vazias, só formatadas — em
cerca de 60 MB de XML. `linhasCruas` (`lib/regras/xlsx.mjs`) montava a lista de todas elas, com as células, antes de
`lerAba` jogar fora as vazias: cada mês aberto levava o heap a ~460–490 MB. A Tela 2 abre os doze meses.

**A correção:** `linhasCruas` virou gerador — entrega uma linha por vez, na mesma ordem e com as mesmas células. Nenhuma
regra nem número mudou: `npm run conferir-telas` 45/0/0 e `npm run testar-detalhe-dre` 275/0, iguais a antes.

| medida (camada de dados, as três telas de agosto, neste PC) | antes | depois |
|---|---|---|
| pico do heap por mês de planilha aberto | ~460–490 MB | ~30–60 MB |
| pico do heap, as três telas | 495 MB | 84 MB |
| pico do processo (RSS), as três telas | 842 MB | 413 MB |

**No ar** (métrica de memória do Railway, amostras de 30 s): desde o deploy `4df298c4`, **máximo de 0,594 GB** — no
fim da releitura do Omie, quando a base nova é montada ao lado da velha —, e 0,29–0,33 GB com as telas abertas. Um só
início de contêiner, nenhum `heap out of memory` nos logs.

## Conferido no ar

- **https:** `/entrar` 200 sem login; `http://` → 301 para `https://`.
- **Tela sem login recusada:** `/`, `/dre`, `/fluxo-de-caixa`, `/receber` e `/admin` → 307 para `/entrar?volta=…`;
  `GET` e `POST /api/atualizar` → 401; `GET /api/dfc` sem segredo → 401.
- **E-mail sem cadastro barrado:** `POST /api/entrar` → 303 para `/entrar?erro=1`, sem cookie.
- **Administrador entra:** 303 para `/` com cookie de sessão; `/admin` → 200.
- **As três telas abrem logado** (30/09, 23:14 UTC em diante): `/?ano=2026&mes=8`, `/dre?ano=2026&mes=8` e
  `/fluxo-de-caixa?ano=2026&mes=8` → 200, várias vezes, sem o serviço cair.
- **Releitura do Omie no servidor:** terminou em 30/09, 23:25 UTC — 292 páginas nas 22 leituras. Antes dela o cache
  do servidor estava pela metade (a releitura das 22:48 morreu na queda), e as contagens do Omie saíam erradas (sem o
  cadastro de categorias, todo lançamento caía em "(=) sem conta"); a conferência abaixo é a de depois dela.
- **O DFC do servidor é o mesmo da conferência:** o sha256 de `08 - DFC AGOSTO 2026.xlsx` que o servidor guardou é igual
  ao da cópia local com que `docs/telas-conferidas.md` foi gerado (e o dos meses de janeiro a julho, novembro e
  dezembro; setembro e outubro mudaram, são os meses em curso).

## O envio do DFC deste PC

- Tarefa `financeiro-enviar-dfc` no Agendador de Tarefas, de hora em hora.
- **20:00 (Brasília) de 30/09: resultado 4** — "o servidor recusou": o serviço estava fora do ar (`CRASHED`, a queda
  por memória acima).
- **Rodada à mão às 20:16:49 (Brasília): resultado 0.** O servidor registra o envio em `2026-09-30T23:16:49Z`, 13
  planilhas (`GET /api/dfc`). Próxima passagem agendada: 21:00.
- **Às 20:42 (Brasília):** o Agendador mostra a tarefa `Pronto`, habilitada, último resultado 0, próxima execução
  21:00; `GET /api/dfc` no ar segue com o último envio em `2026-09-30T23:16:49Z`. Deploy ativo `4df298c4` (`SUCCESS`);
  variáveis do serviço (só nomes): `SESSAO_SEGREDO`, `DFC_ENVIO_SEGREDO`, as quatro do Omie 1 e 2 e `PORT` — sem as do
  administrador, que entrou no ar de novo às 20:42.
- **22:00 (Brasília) de 30/09: resultado 0.** Lido às 22:58 (Brasília): `Get-ScheduledTaskInfo` dá última execução
  `30/09/2026 22:00:01`, resultado 0, próxima 23:00, nenhuma passagem perdida; `GET /api/dfc` no ar registra o envio em
  `2026-10-01T01:00:02Z` (22:00:02 em Brasília), 13 planilhas.
- **21:00 (Brasília): resultado não recuperável.** O Agendador só guarda a última passagem (a de 22:00 apagou a de
  21:00) e o log de eventos dele (`Microsoft-Windows-TaskScheduler/Operational`) está desligado; o servidor também
  guarda só o último envio. O que se observou é a passagem de 20:16 (0) e a de 22:00 (0, mesmas 13 planilhas); o
  resultado de 21:00 em si **não foi observado**. Ligar o histórico do Agendador resolveria para as próximas
  (decisão do dono; não mexi).

## Números de agosto/2026 no ar contra `docs/telas-conferidas.md` (45 linhas)

Lido nas telas publicadas, logado, depois da releitura do Omie das 23:25 UTC: a tabela "Os números exatos" da Tela 1,
o pé de cada cartão, o que cada linha do DRE abre (a composição que a página recebe) e os cartões do Fluxo de Caixa.
"Esperado" é o "Na tela" de `docs/telas-conferidas.md` refeito às 20:40 (Brasília) de 30/09 — `npm run conferencia`
(trava de agosto conferida, 45/0/0) e `npm run conferir-telas` (45/0/0) —, depois de reler no Omie, só consulta, a
janela de vencimento 01/10–31/10 da faixa "em aberto", que no cache deste PC era de 26/09. Das 45 linhas, só a do
"Valor pendente" mudou (10 → 14); as outras 44 são as mesmas da versão de 17:15.

**Resultado: 39 conferidos (um deles por outra tela) e 6 listadas como achado de tela removida, nenhum divergente**,
de 45 linhas. As seis estão na seção "Achado: seis indicadores da antiga Tela 3" abaixo, fora da lista (resolvido em 01/10/2026: retiradas por decisão do dono).

Reconferido às 22:58 (Brasília) de 30/09: `npm run conferencia` (trava de agosto conferida, agosto 45/0/0) e
`npm run conferir-telas` (45/0/0) de novo; os 14 do "Valor pendente" seguem iguais no PC e no ar.

- conferido: **Tela 1 — Saldo.** **No ar:** DFC 388 e Omie 419. **Esperado:** DFC 388 e Omie 419. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Receitas.** **No ar:** DFC 101 e Omie 120. **Esperado:** DFC 101 e Omie 120. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Despesas.** **No ar:** DFC 281 e Omie 299. **Esperado:** DFC 281 e Omie 299. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Despesas pagas.** **No ar:** DFC 281 e Omie 299. **Esperado:** DFC 281 e Omie 299. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Despesas pendentes.** **No ar:** Omie 161. **Esperado:** Omie 161. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Despesas com funcionários.** **No ar:** DFC 109 e Omie 92. **Esperado:** DFC 109 e Omie 92. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — % desp. funcionários / receita líquida.** **No ar:** DFC 109 e Omie 120. **Esperado:** DFC 109 e Omie 120. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Top 10 despesas.** **No ar:** DFC 281 e Omie 299. **Esperado:** DFC 281 e Omie 299. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Top 10 receitas.** **No ar:** Omie 120. **Esperado:** Omie 120. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Receita × despesa por dia.** **No ar:** DFC 31 e Omie 419. **Esperado:** DFC 31 e Omie 419. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 1 — Receita × despesa por mês.** **No ar:** DFC 12 e Omie 419. **Esperado:** DFC 12 e Omie 419. **Lido em:** tabela "Os números exatos" da Tela 1.
- conferido: **Tela 2 — Receita total.** **No ar:** DFC 101 e Omie 120. **Esperado:** DFC 101 e Omie 120. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Custos e despesas.** **No ar:** DFC 281 e Omie 299. **Esperado:** DFC 281 e Omie 299. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — EBITDA.** **No ar:** Omie 419. **Esperado:** Omie 419. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Lucro líquido.** **No ar:** Omie 419. **Esperado:** Omie 419. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Margem de lucro.** **No ar:** Omie 419. **Esperado:** Omie 419. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — (+) Receitas: outras receitas, vendas de produtos.** **No ar:** Omie 120. **Esperado:** Omie 120. **Lido em:** lançamentos que a linha do DRE abre (agosto).
- conferido: **Tela 2 — (=) Receita bruta.** **Esperado:** Omie 120. **No ar:** linha-conta sem contagem própria na tela ((+) Receitas); todas as linhas que a compõem conferiram.
- conferido: **Tela 2 — (−) Deduções: devoluções, taxas de serviço.** **No ar:** DFC 2 e Omie 0. **Esperado:** DFC 2 e Omie 0. **Lido em:** lançamentos que a linha do DRE abre (agosto).
- conferido: **Tela 2 — (=) Receita líquida.** **Esperado:** Omie 120. **No ar:** linha-conta sem contagem própria na tela ((=) Receita bruta, (−) Deduções); todas as linhas que a compõem conferiram.
- conferido: **Tela 2 — (−) Custos de vendas: custo do produto, outros custos.** **No ar:** DFC 68 (o que a linha mostra e abre). **Esperado:** DFC 68 e Omie 82. **Lido em:** lançamentos que a linha do DRE abre (agosto). A contagem do Omie (82) é a de confronto: a linha não a abre nem a escreve na tela — o detalhamento dela é "0 do Omie + 68 do DFC" também neste PC (`npm run testar-detalhe-dre`).
- conferido: **Tela 2 — (=) Lucro bruto.** **Esperado:** Omie 120. **No ar:** linha-conta sem contagem própria na tela ((=) Receita líquida, (−) Custos de vendas); as linhas que a compõem conferiram (as de Custos de vendas e Impostos pelo lado que a tela mostra).
- conferido: **Tela 2 — (−) Despesas gerais: administrativas, financeiras, marketing, RH, relacionamento com cliente, TI.** **No ar:** Omie 198. **Esperado:** Omie 198. **Lido em:** lançamentos que a linha do DRE abre (agosto).
- conferido: **Tela 2 — (=) EBITDA.** **Esperado:** Omie 419. **No ar:** linha-conta sem contagem própria na tela ((=) Lucro bruto, (−) Despesas gerais); as linhas que a compõem conferiram (as de Custos de vendas e Impostos pelo lado que a tela mostra). O cartão do topo com o mesmo nome mostra Omie 419, igual.
- conferido: **Tela 2 — (+/−) Resultado financeiro: receitas e despesas financeiras.** **No ar:** Omie 28. **Esperado:** Omie 28. **Lido em:** lançamentos que a linha do DRE abre (agosto).
- conferido: **Tela 2 — (−) Impostos pagos (guias).** **No ar:** DFC 5 (o que a linha mostra e abre). **Esperado:** DFC 5 e Omie 4. **Lido em:** lançamentos que a linha do DRE abre (agosto). A contagem do Omie (4) é a de confronto: a linha não a abre nem a escreve na tela — o detalhamento dela é "0 do Omie + 5 do DFC" também neste PC (`npm run testar-detalhe-dre`).
- conferido: **Tela 2 — (=) Lucro líquido.** **Esperado:** Omie 419. **No ar:** linha-conta sem contagem própria na tela ((=) EBITDA, (+/−) Resultado financeiro, (−) Impostos pagos (guias)); as linhas que a compõem conferiram (as de Custos de vendas e Impostos pelo lado que a tela mostra). O cartão do topo com o mesmo nome mostra Omie 419, igual.
- conferido: **Tela 2 — (=) sem conta.** **No ar:** Omie 21. **Esperado:** Omie 21. **Lido em:** lançamentos que a linha do DRE abre (agosto).
- conferido: **Tela 2 — Capital de giro tomado.** **No ar:** DFC 2 e Omie 3. **Esperado:** DFC 2 e Omie 3. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Obrigações com clientes.** **No ar:** Omie 78. **Esperado:** Omie 78. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Dívida líquida.** **No ar:** DFC 5. **Esperado:** DFC 5. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Resultado sem dinheiro de terceiros.** **No ar:** Omie 419. **Esperado:** Omie 419. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 2 — Provisões por projeto.** **No ar:** DFC 4. **Esperado:** DFC 4. **Lido em:** pé do cartão da Tela 2.
- conferido: **Tela 3 — Valor pendente.** **No ar:** Omie 14. **Esperado:** Omie 14. **Lido em:** Fluxo de Caixa de outubro: cartão "Ainda a receber no mês" (o nome dele em mês ainda aberto), lido às 20:42 e de novo às 22:58 (Brasília), nas duas vezes 14 títulos do Omie no pé do cartão; no PC, `npm run conferir-telas` também dá 14 (0 na empresa 1, 14 na 2). A leitura do Omie dessa janela não foi refeita às 22:58: `node scripts/ler-omie-faltante.mjs` achou as 173 respostas já no cache (0 vieram do Omie), a de 20:40. A faixa "em aberto" é medida na janela de vencimento de outubro/2026, não em agosto, e anda com o Omie. A referência anterior (10) vinha da leitura exata dessa janela gravada neste PC em 26/09; relida no Omie em 30/09 às 20:40, dá 14 (0 na empresa 1, 14 na 2) — os 10 de 26/09 e quatro títulos da empresa 2 lançados depois, `5300690800`, `5302263925`, `5302423083` e `5302508435`, todos `A VENCER` com vencimento em 28/10 ou 30/10/2026. Mesma regra; nenhum dos 10 saiu.
- conferido: **Tela 3 — Valor vencido.** **No ar:** Omie 37. **Esperado:** Omie 37. **Lido em:** Fluxo de Caixa de agosto: "já venceu e ainda não foi recebido (N títulos)".
- conferido: **Tela 3 — Despesas fixas pagas.** **No ar:** DFC 119. **Esperado:** DFC 119. **Lido em:** pé do cartão do Fluxo de Caixa.
- conferido: **Tela 3 — Fixas / receita líquida.** **No ar:** DFC 119. **Esperado:** DFC 119. **Lido em:** pé do cartão do Fluxo de Caixa.
- conferido: **Tela 3 — Projeção do mês.** **No ar:** DFC 382. **Esperado:** DFC 382. **Lido em:** pé do cartão do Fluxo de Caixa.
- conferido (por outra tela): **Tela 3 — O mês dia a dia.** **Esperado:** DFC 388. **No ar:** o bloco desenha o caixa dia a dia e não escreve quantas linhas do DFC entraram; a contagem está no "Saldo" da Tela 1, lida no ar como DFC 388 (linha acima). **Caso (agosto/2026, mês fechado, cálculo do app sobre a cópia local do DFC):** 31 dias no gráfico, 21 com movimento; a variação da linha do caixa no mês (último ponto menos o ponto de partida) é igual, ao centavo, ao valor do "Saldo" da Tela 1, e as linhas do "Saldo" são as 388 de `docs/telas-conferidas.md`. O gráfico em si, desenhado no servidor, não foi lido pixel a pixel no ar.

## Achado: seis indicadores da antiga Tela 3 que nenhuma tela no ar mostra — RESOLVIDO

**Resolvido em 01/10/2026:** as seis linhas foram retiradas de `docs/fontes.md` por decisão do dono (são de tela removida). A regra do cálculo e o que o Fluxo de Caixa usa (Valor pendente, Valor vencido) ficam. O texto abaixo é o achado original, como estava.

Os seis abaixo são da antiga Tela 3 (Contas a Receber), fora da navegação desde 28/09/2026 — `/receber` só redireciona
para o Fluxo de Caixa, que escreve do mesmo cálculo apenas o "Valor vencido" (37, conferido acima) e, em mês aberto, o
"Ainda a receber" (14, conferido acima). Nenhum deles tem contagem equivalente numa tela viva:

- **Valor previsto** (Omie 128) e **Valor recebido** (Omie 91): o Fluxo de Caixa não escreve o total de títulos do mês nem a faixa paga.
- **Lançamentos por mês e status** (Omie 128), **Valor previsto por cliente e status** (Omie 128), **Lista de títulos** (Omie 128) e **Lançamentos por status** (Omie 128): blocos que existiam só na tela removida.

O que se sabe: em agosto, `docs/telas-conferidas.md` traz o recorte fechando — pago 91 + atrasado 37 + em aberto 0 = 128 —, e a faixa atrasado (37) é a que a tela viva mostra e está conferida. Isso é consistência interna do cálculo, não contagem lida numa tela; por isso **nenhuma das seis foi trocada por "conferido"**.

**Proposta (aplicada em 01/10/2026, por decisão do dono):** retirar essas seis linhas da lista de indicadores de `docs/fontes.md` por pertencerem a tela removida — ou marcá-las lá como "tela removida em 28/09/2026" —, sem apagar a regra do cálculo, que `lib/indicadores/tela-3.mjs` continua usando para o Fluxo de Caixa. Se o dono quiser mantê-las, o caminho é escrever a contagem em alguma tela viva. Nada foi mudado em `docs/fontes.md` nem em indicador.
