# MeuBESS · Financeiro — dashboards

Dashboards do departamento financeiro da MeuBESS, usados pela equipe **fora da Central de Comando** (app próprio, com
acesso próprio). Não se mistura com o Painel Logístico (`meubess_dashboard`), com a plataforma da MeuBESS nem com o
Lovable.

**Estado:** as **três telas** — Gestão de Contas, DRE e Contas a Receber — estão construídas e rodando localmente.
As fontes de cada número estão fechadas em [`docs/fontes.md`](docs/fontes.md), conferidas em
[`docs/conferencia.md`](docs/conferencia.md) e comparadas com o que a tela mostra em
[`docs/telas-conferidas.md`](docs/telas-conferidas.md). Os **filtros** de cada tela — onde valem e onde não valem, com um
caso real conferido para cada um — estão em [`docs/filtros.md`](docs/filtros.md).

## As três telas

As referências visuais ficam em [`docs/referencias/`](docs/referencias/). O que cada tela mostra e de onde vem cada
número fica em [`docs/fontes.md`](docs/fontes.md) — é o contrato do projeto: indicador sem fonte escrita não entra na tela.

## Regras

- **Só leitura nas fontes.** Nada aqui escreve no ERP, nas planilhas de origem ou em qualquer sistema financeiro.
- **Credencial só no `.env`** (fora do git; o modelo é o `.env.example`). Nunca em código, commit, log ou mensagem.
  O Omie tem três chaves, uma por filial, só para leitura, gravadas pelo dono no `.env` local, cada uma em um par de
  variáveis, e cada filial tem o seu papel (dono, 24/09/2026):
  - `OMIE_MEUBESS_1_APP_KEY` / `OMIE_MEUBESS_1_APP_SECRET` — empresa 1, filial `/0001-42`: as **rotinas administrativas**
    (o escritório);
  - `OMIE_MEUBESS_2_APP_KEY` / `OMIE_MEUBESS_2_APP_SECRET` — empresa 2, filial `/0002-23`: **compra, venda e logística**,
    a principal. **É a chave das telas**: só ela tem os pedidos, clientes e produtos que a plataforma envia (ver
    [`docs/comparacao-chaves-omie.html`](docs/comparacao-chaves-omie.html));
  - `OMIE_MEUBESS_3_APP_KEY` / `OMIE_MEUBESS_3_APP_SECRET` — empresa 3, filial `/0003-04`: papel não informado.

  **As telas somam as empresas 1 e 2** (decisão do dono, 24/09/2026): cada consulta roda nas duas chaves e os
  resultados se somam. A empresa 3 fica fora. O que a soma exige dos dois cadastros — planos de categorias que divergem,
  lançamentos entre as filiais e departamentos com código próprio de cada empresa — está medido em
  [`docs/fontes.md`](docs/fontes.md) e em
  [`docs/plano-de-categorias-omie.html`](docs/plano-de-categorias-omie.html).
- **As telas são da MeuBESS, e o Omie tem outros negócios no mesmo CNPJ.** Toda leitura de `financas/mf` das Telas 1 e 2
  filtra a conta corrente pela lista de [`dados/contas-correntes-por-negocio.json`](dados/contas-correntes-por-negocio.json)
  — de que negócio é cada conta, dito pelo dono em 24/09/2026 —, guardando só as de `negocio: "MeuBESS"`. Conta que o dono
  não citou fica fora, e o código não adivinha pelo nome do banco. O confronto que mede o recorte está em
  `docs/confronto-dfc-omie.html`, uma página **gerada localmente** por `scripts/confronto-dfc-omie.mjs` (`node scripts/confronto-dfc-omie.mjs`)
  que traz valores em reais e por isso **não vai para o git** (`.gitignore`): quem precisa dela roda o script.
- **Todo número confere com a fonte.** Cada indicador diz de onde vem (ERP: módulo, tabela e filtro; planilha: arquivo,
  aba e coluna) e é conferido com um caso real antes de ser dado como pronto.
  A conferência de um mês fechado, indicador por indicador, está em [`docs/conferencia.md`](docs/conferencia.md)
  (a mesma coisa como página: [`docs/conferencia.html`](docs/conferencia.html)), gerada por
  `scripts/numeros-das-telas.mjs`: quantos lançamentos entram, a fonte e o filtro, e um caso real achado de volta na
  fonte pelo código — dos dois lados, o do Omie e o da planilha do DFC. Ela não traz valor em dinheiro — só contagem,
  código, data e campo de cadastro. As leituras do Omie que ela usa saem do cache local `.cache/omie/` (fora do git),
  gravado por `scripts/confronto-dfc-omie.mjs` e por `scripts/ler-omie-faltante.mjs`, os dois só com métodos de
  consulta.
- **Número financeiro não sai da máquina para ser medido ou classificado** por serviço de terceiros.

## O app

**Pilha: Next.js (App Router) em JavaScript, para a Vercel** (decisão do dono, 25/09/2026: vai ficar na Vercel).
É o framework nativo da Vercel — sobe sem configuração — e os *server components* deixam o cálculo no servidor: o
navegador recebe o número pronto, nunca uma chave do Omie nem um caminho de pasta. O que ainda falta (login com a
conta Microsoft da empresa e lista de e-mails liberados) é primeira classe nessa pilha e fica para a tarefa de pôr
no ar. Não há TypeScript nem biblioteca de gráfico: os gráficos são CSS e o resto do repositório já é JavaScript.

### Subir o app neste computador

```
npm install
npm run local
```

O app sobe em **modo de produção e só em <http://127.0.0.1:4781>** (decisão do dono, 27/09/2026: usar as telas neste
computador, só ele, sem publicar). `127.0.0.1` é a placa de rede que só existe dentro desta máquina: ninguém da rede
abre estes números, nem sabendo o IP daqui. A porta é 4781 porque 4747 já é da Central de Comando neste computador.
O passo a passo inteiro — subir, a "última leitura", forçar a releitura e o que fazer quando uma fonte não responde —
está em [`docs/uso-local.md`](docs/uso-local.md).

Cada tela abre no **mês corrente**, e as três têm seletor de mês e o botão **atualizar agora**. Para agosto de 2026:

| tela | rota |
|---|---|
| **Tela 1 — Gestão de Contas** | <http://127.0.0.1:4781/?ano=2026&mes=8> |
| **Tela 2 — DRE** | <http://127.0.0.1:4781/dre?ano=2026&mes=8> |
| **Tela 3 — Contas a Receber** | <http://127.0.0.1:4781/receber?ano=2026&mes=8> |

As **empresas 1 e 2 entram sempre somadas** e o recorte é o da MeuBESS.

**Os filtros de cada tela moram na URL**, como as pílulas de ano e mês: a Tela 1 filtra por **centro de custo**
(`?cc=FISCAL,TI`, seleção múltipla, juntando as duas empresas pelo nome do departamento), a Tela 2 por **vários meses de
uma vez** (`?meses=7,8`) e a Tela 3 por **vencimento de–até, status, cliente e categoria**
(`?de=2026-07-01&ate=2026-08-31&status=atrasado&cliente=2-…&categoria=1.01.03`). Onde o número vem de uma fonte que não
aceita o filtro escolhido — um cartão do DFC diante do centro de custo, por exemplo —, o cartão **diz isso junto do
número** em vez de mostrar valor sem filtro como se estivesse filtrado. Cada um desses lugares está listado em
[`docs/filtros.md`](docs/filtros.md), com o caso real que o conferiu.

A **Tela 2 tem uma coluna por mês**, como a tela de referência, e ao lado de cada uma cabem a **análise horizontal**
(quanto a coluna variou contra o mês anterior) e a **análise vertical** (quanto a linha pesa na receita líquida do
próprio mês). As duas ligam e desligam pelos botões do topo, que são links — o estado mora na URL (`?ah=1&av=1`), e
não no navegador, então a captura e um link colado mostram exatamente a mesma coisa. **AH e AV não são regra de
`docs/fontes.md`**: vêm do layout de referência e saem dos valores que as regras já calcularam.

A última linha da tabela diz **de quanta leitura cada coluna saiu**, dos dois lados. Não é enfeite: em 2026, janeiro
e fevereiro têm o DFC cheio e quase nenhum lançamento do Omie no recorte da MeuBESS, então os totalizadores desses
dois meses misturam um lado cheio com outro vazio e a coluna não se lê como DRE. A leitura do Omie que está no cache
vai de **01/01 a 30/09**; mês fora dessa janela não vira coluna.

A **Tela 3 é a carteira de títulos a receber** e fica **no Omie inteira**: o DFC é caixa e não registra carteira em
aberto nem tem cadastro de cliente. O seletor de mês é a **janela de vencimento** da consulta, e as três faixas
(pago, atrasado, em aberto) são o de-para dos oito `cStatus` do Omie que o dono decidiu em 25/09/2026. Num mês já
fechado o cartão **Valor Pendente** é sempre zero — todo título que venceu está pago ou atrasado —, e a própria tela
diz isso; escolha um mês à frente (por exemplo <http://127.0.0.1:4781/receber?ano=2026&mes=10>) para ver a carteira a
vencer. O **nome do cliente** aparece na tela, vindo de `geral/clientes`, e **nunca** em arquivo versionado: a
captura troca cada nome pelo código antes de gravar.

**As fontes são relidas de hora em hora** (decisão do dono, 25/09/2026), e "atualizar agora" força a releitura na
hora. Desde 27/09/2026 reler o Omie quer dizer **ir à API do Omie**, não só reabrir o cache: a releitura busca as 22
leituras que as três telas abrem — **só por método de consulta**, com as chaves que os scripts já usam — e grava no
mesmo cache local `.cache/omie/`. As planilhas do DFC continuam lidas da pasta a cada cálculo.

A volta inteira leva alguns minutos (perto de 280 páginas, com a pausa que o limite de consumo do Omie pede), então
ela **roda ao lado**: a tela espera um tanto e, se não der, desenha o último guardado e diz que a releitura está em
curso. **Se o Omie falhar, a tela mostra o último guardado e avisa** — uma leitura só entra no cache inteira, e por
isso o cache nunca fica com meia leitura. O rodapé de cada tela traz a **"Última leitura"** das duas fontes, com a
hora de cada uma.

### Conferir as telas contra a conferência

```
npm run conferir-telas
```

Grava [`docs/telas-conferidas.md`](docs/telas-conferidas.md): uma linha por indicador das 3 telas dizendo, para
agosto de 2026, se o número que **a tela mostra** é o mesmo que **`docs/conferencia.md`** publica. O que se compara é
a **contagem de lançamentos** de cada lado (DFC e Omie) — é ela que prende o filtro, e é a única coisa que pode entrar
num arquivo versionado. Onde a conferência publica a linha **repartida** (quanto veio de venda de produtos e quanto
de outras receitas, quantos títulos e quantos avulsos, quanto em cada empresa), cada pedaço também é comparado: um
total pode bater por acaso com a repartição errada. Os números esperados são lidos do **texto** de
`docs/conferencia.md`, não recalculados, para o teste não comparar o código com ele mesmo. O comando sai com erro se
alguma linha ficar **divergente**.

**Um indicador dos 36 não é de agosto, e a regra dele explica por quê.** A faixa "em aberto" do cartão
"Valor pendente" da Tela 3 é vazia em qualquer mês fechado, porque os quatro `cStatus` dela são os de um título que
ainda não venceu. `docs/conferencia.md` mede essa faixa noutra janela de vencimento e diz na própria linha qual foi;
o teste **lê a janela do arquivo** e pede à camada de dados a mesma Tela 3 nela — a regra não muda, muda a janela.

### Conferir os filtros contra a fonte

```
npm run conferir-filtros
```

Grava [`docs/filtros.md`](docs/filtros.md) (o bloco de casos) e [`docs/filtros.html`](docs/filtros.html). Enquanto
`conferir-telas` confere os **números** das telas com o filtro vazio, este confere o que os **filtros** fazem: para cada
um, aplica um caso real pela mesma camada de dados que o navegador recebe e reencontra o mesmo recorte na **fonte** — os
arquivos crus do cache do Omie, abertos com `fs` e `JSON.parse`, sem passar pela montagem de `lib/regras/cache-omie.mjs`,
para o lado da fonte não sair da mesma função que o lado do cálculo. **Só contagem e código**, nunca dinheiro e nunca
nome de cliente. O comando sai com erro se algum filtro pegar um lançamento a mais ou a menos do que a fonte manda.

### O que trava, e o que só é publicado

O app relê o Omie de hora em hora e grava no mesmo cache, e o Omie recebe lançamento com **data retroativa**: um mês já
passado muda de contagem sozinho — de 24/09 a 27/09/2026, jan–set passou de 1.322 para 1.343 entradas. Por isso as duas
coisas são tratadas de formas diferentes.

**As contagens de jan–set são publicadas, não conferidas.** `npm run conferencia` as refaz e as **escreve** num bloco
gerado de [`docs/fontes.md`](docs/fontes.md), na mesma passagem em que grava `docs/conferencia.md` — o número do
documento e o da página são sempre da mesma leitura porque quem grava os dois é a mesma rodada, e ninguém edita o
documento à mão quando a releitura mexe em algo. Cada contagem publicada diz **de que leitura é**: o bloco gerado traz o
carimbo da leitura desta rodada, e as contagens escritas em prosa no documento dizem que são da leitura de referência de
27/09/2026, 09h11–09h17.

**O que trava é agosto de 2026**, o mês conferido, em
[`docs/trava-agosto-2026.json`](docs/trava-agosto-2026.json): os três baldes do mês por empresa e natureza, as faixas do
mês da Tela 3, a identidade de cada caso real que a conferência confere e a impressão digital dos campos de cadastro de
todos os lançamentos do mês. Se algum deles mudar, a conferência **para e não grava nada**; refixar é na mão, com
`node scripts/numeros-das-telas.mjs --refazer-trava`. A trava é necessária porque a conferência caso a caso relê o
**mesmo cache** que o cálculo leu: um lançamento que mudou no Omie e voltou mudado na releitura bate dos dois lados.

```
npm run testar-trava
```

Prova a separação, em três casos, cada um numa **cópia** do cache (nada vai ao Omie e nada fica em `docs/`): lançamento
novo num mês anterior → a conferência passa, e a saída mostra a contagem de jan–set que mudou; o caso real de agosto
mudando de `cStatus` → a conferência para, e a mensagem é da trava, mesmo sem nenhuma contagem mudar; lançamento novo
com data de agosto → a conferência para.

Uma **captura de cada tela sem dinheiro** (valores trocados por "—", contagens e percentuais mantidos) fica em
[`docs/tela-1-captura.html`](docs/tela-1-captura.html),
[`docs/tela-2-captura.html`](docs/tela-2-captura.html) e
[`docs/tela-3-captura.html`](docs/tela-3-captura.html). Com o app no ar, `npm run capturar-tela-1`,
`npm run capturar-tela-2` e `npm run capturar-tela-3` as regeram — e nenhuma é gravada se sobrar valor em dinheiro
ou nome de cliente no HTML.

Uma captura **com filtro aplicado** de cada tela fica ao lado delas:
[`docs/tela-1-captura-filtro.html`](docs/tela-1-captura-filtro.html) (centro de custo = FISCAL),
[`docs/tela-2-captura-filtro.html`](docs/tela-2-captura-filtro.html) (meses = julho e agosto) e
[`docs/tela-3-captura-filtro.html`](docs/tela-3-captura-filtro.html) (status = atrasado). O `--q` do
`scripts/capturar-tela.mjs` acrescenta os filtros à URL e o `--nome` muda o fim do nome do arquivo:
`node scripts/capturar-tela.mjs --tela 1 --q "cc=FISCAL" --nome filtro`.

### Onde mora o quê

| pasta | o que é |
|---|---|
| `lib/regras/` | **as regras, num lugar só.** O recorte da MeuBESS, os três baldes, as listas que o dono decidiu, o vocabulário do DFC e a leitura das planilhas. `scripts/numeros-das-telas.mjs` (a conferência) e o app importam **estes mesmos** arquivos — nenhuma regra é copiada de um lado para o outro. |
| `lib/indicadores/` | cada tela: o valor que ela mostra e a contagem que a conferência confere, montados com as regras acima. |
| `lib/dados.mjs` | a camada de dados do servidor: releitura de hora em hora e o "atualizar agora". |
| `lib/regras/omie-releitura.mjs` | a releitura do Omie pelas telas: quais leituras, uma volta por vez, a hora da última. |
| `lib/regras/omie-api.mjs` | a chamada ao Omie — endereço, credencial, tentativas, e o guarda do "só consulta". |
| `lib/regras/filtros.mjs` | **os filtros das três telas, num lugar só:** como cada um é lido da URL e normalizado, e a junção dos dois cadastros de departamento pelo nome. Só os filtros que `docs/fontes.md` registra. |
| `app/filtrado.js` | a frase que a tela escreve **junto do número** quando o filtro escolhido não alcança aquela fonte. |
| `scripts/subir-local.mjs` | sobe o app em modo de produção, preso em 127.0.0.1:4781. |
| `app/` | as telas. As **cores da marca ficam só em `app/globals.css`**, em variáveis. |
| `scripts/` | as leituras do Omie, a conferência e os testes. |

**A leitura do DFC está atrás de uma interface** (`lib/regras/dfc-fonte.mjs`): hoje, neste computador, os arquivos
vêm da pasta que o OneDrive espelha; na Vercel virão pelo **Microsoft Graph**, que é escrever a outra implementação
nesse arquivo e não tocar em mais nada. O caminho da pasta **não** está escrito em lugar nenhum do repositório — é
achado pelo formato do nome ou vem de `DFC_DIR`, porque o caminho real tem nome de pessoa.

### O que ainda não existe

Login com a conta Microsoft e a lista de e-mails liberados pelo dono; o deploy na Vercel. Enquanto o login não
existe, **o app roda só local**. Dos filtros, existem os que `docs/fontes.md` registra e nada além: **empresa,
fornecedor, conta corrente** e outros esperam decisão do dono. Também não existe o seletor **"ver por centro de custo
(Omie)"** que `docs/fontes.md` descreve na linha do "Top 10 despesas" — ele trocaria as barras do DFC por barras do Omie
agrupadas por departamento, e é uma forma de ver, não um filtro.
