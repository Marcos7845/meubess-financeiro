# MeuBESS · Financeiro — dashboards

Dashboards do departamento financeiro da MeuBESS, usados pela equipe **fora da Central de Comando** (app próprio, com
acesso próprio). Não se mistura com o Painel Logístico (`meubess_dashboard`), com a plataforma da MeuBESS nem com o
Lovable.

**Estado:** as **três telas** — Gestão de Contas, DRE e **Fluxo de Caixa** — estão construídas e rodando localmente.
A Tela 3 era Contas a Receber até 28/09/2026, quando o dono a redefiniu como Fluxo de Caixa (`docs/layout.md`), e a
classificação de despesa fixa da gestora chegou no mesmo dia (33 fixas, 21 variáveis, 3 contas de despesa em aberto).
O que essa tela ainda espera de resposta do dono ou da gestora, cada ponto com a pergunta e a recomendação, está em
[`docs/passagem-fluxo-de-caixa.md`](docs/passagem-fluxo-de-caixa.md) — o registro vivo dela, e o primeiro arquivo a ler
quem for continuar o trabalho.
As fontes de cada número estão fechadas em [`docs/fontes.md`](docs/fontes.md), conferidas em
[`docs/conferencia.md`](docs/conferencia.md) e comparadas com o que a tela mostra em
[`docs/telas-conferidas.md`](docs/telas-conferidas.md). Os **filtros** de cada tela — onde valem e onde não valem, com um
caso real conferido para cada um — estão em [`docs/filtros.md`](docs/filtros.md), e **quanto demora um clique num
filtro**, medido fase por fase e antes e depois da base local, está em [`docs/desempenho.md`](docs/desempenho.md).

## As três telas

As referências visuais ficam em [`docs/referencias/`](docs/referencias/) — elas dizem **quais blocos** cada tela tem.
O que cada tela mostra e de onde vem cada número fica em [`docs/fontes.md`](docs/fontes.md) — é o contrato do projeto:
indicador sem fonte escrita não entra na tela. **Como as telas são desenhadas** — a história de cada uma, o plano de
gráficos e o checklist — fica em [`docs/layout.md`](docs/layout.md), e a página para o dono ler, com a captura das três
telas dentro, em [`docs/layout.html`](docs/layout.html).

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
no ar. Não há TypeScript. A **única** biblioteca de gráfico é o **Recharts 2** (`app/graficos.js`, as três telas): ele
desenha no servidor, o que é obrigatório aqui porque `scripts/capturar-tela.mjs` joga fora todo `<script>` antes de
gravar a captura. Quatro desenhos continuam sendo CSS ou SVG escrito à mão, por serem simples demais para valer uma
biblioteca: a fita dos doze meses do cartão da Tela 2, a rosca por status da Tela 3 e as barras do "o que cada filtro
alcança".

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

**A primeira abertura lê as fontes; os cliques de filtro depois dela respondem na hora** (decisão do dono, 27/09/2026:
"cada clique num filtro das 3 telas demora uma eternidade"). O cache do Omie e as planilhas do DFC são lidos e
preparados **uma vez**, numa base local na memória do servidor (`lib/regras/base-local.mjs`), e cada clique só calcula
em cima dela — antes, cada combinação de filtro era um cálculo novo que reabria as treze planilhas do ano e ainda
esperava até 8 s pela releitura do Omie. Medido, com a releitura em curso: o pior clique caiu de **15,6 s para 34 ms** na
Tela 1, de **16,1 s para 573 ms** na Tela 2 e de **8,2 s para 3 ms** na Tela 3; a página inteira, sobre HTTP, caiu de
**8,5 s para 75 ms** na Tela 1. A medição fase por fase está em [`docs/desempenho.md`](docs/desempenho.md). A base é
renovada na abertura, na virada da hora (ao lado, sem segurar a tela) e no "atualizar agora", e a **releitura de hora em
hora do Omie não mudou** — o que saiu foi a espera por ela.

Cada tela abre no **mês corrente**, e as três têm seletor de mês e o botão **atualizar agora**. Para agosto de 2026:

| tela | rota |
|---|---|
| **Tela 1 — Gestão de Contas** | <http://127.0.0.1:4781/?ano=2026&mes=8> |
| **Tela 2 — DRE** | <http://127.0.0.1:4781/dre?ano=2026&mes=8> |
| **Tela 3 — Fluxo de Caixa** | <http://127.0.0.1:4781/fluxo-de-caixa?ano=2026&mes=8> |

As **empresas 1 e 2 entram somadas** — e, desde 27/09/2026, o **filtro de empresa** (`?empresa=1`, `?empresa=2` ou as
duas) escolhe quais das duas entram na soma, nas três telas. O recorte é o da MeuBESS.

**Os filtros de cada tela moram na URL**, como o ano e o mês: a Tela 1 filtra por **centro de custo**
(`?cc=FISCAL,TI`, seleção múltipla, juntando as duas empresas pelo nome do departamento), a Tela 2 por **vários meses de
uma vez** (`?meses=7,8`), a Tela 3 por **vencimento de–até, status, cliente e categoria**
(`?de=2026-07-01&ate=2026-08-31&status=atrasado&cliente=2-…&categoria=1.01.03`), e as **três** por **empresa**
(`?empresa=2`). Onde o número vem de uma fonte que não aceita o filtro escolhido — um cartão do DFC diante do centro de
custo, por exemplo —, o cartão **diz isso junto do número** em vez de mostrar valor sem filtro como se estivesse
filtrado. Cada um desses lugares está listado em [`docs/filtros.md`](docs/filtros.md), com o caso real que o conferiu.

**O DFC não é filtrável por empresa, e isso foi medido.** A planilha tem a coluna `EMP.` (`B3W` / `N3`), mas nenhum dos
dois rótulos é filial do Omie: o cruzamento de 27/09/2026 (`node scripts/de-para-empresa-dfc.mjs`, só leitura) casou 565
linhas `B3W` só com a empresa 1 e 481 só com a empresa 2 — por data, valor e nome do cliente/fornecedor, duas delas no
mesmo dia. A prova inteira está em [`docs/fontes.md`](docs/fontes.md), em "A coluna `EMP.` não é a filial do Omie".

A **Tela 2 tem uma coluna por mês**, como a tela de referência, e ao lado de cada uma cabem a **análise horizontal**
(quanto a coluna variou contra o mês anterior) e a **análise vertical** (quanto a linha pesa na receita líquida do
próprio mês). As duas ligam e desligam pelos botões do topo, que são links — o estado mora na URL (`?ah=1&av=1`), e
não no navegador, então a captura e um link colado mostram exatamente a mesma coisa. **AH e AV não são regra de
`docs/fontes.md`**: vêm do layout de referência e saem dos valores que as regras já calcularam.

A última linha da tabela diz **de quanta leitura cada coluna saiu**, dos dois lados. Não é enfeite: em 2026, janeiro
e fevereiro têm o DFC cheio e quase nenhum lançamento do Omie no recorte da MeuBESS, então os totalizadores desses
dois meses misturam um lado cheio com outro vazio e a coluna não se lê como DRE. A leitura do Omie que está no cache
vai de **01/01 a 30/09**; mês fora dessa janela não vira coluna.

A **Tela 3 é o Fluxo de Caixa** desde 28/09/2026, e mistura as duas fontes: o caixa do mês vem do DFC e o que falta
pagar e receber vem do Omie. Ela tem oito cartões — seis são cartões que já existiam, pelo mesmo cálculo — e quatro
números que nasceram nela: as **despesas fixas pagas** (pela lista que a gestora respondeu), o **peso delas na receita
líquida**, a **projeção do mês** e o **mês dia a dia** num gráfico só, consolidado e previsão, partindo da posição de
caixa real. Embaixo do gráfico diário a tela **confere a posição com o saldo dos bancos da planilha**, e a conta que
fecha os dois está em [`docs/fontes.md`](docs/fontes.md); em setembro e em agosto de 2026 ela fecha sem sobra.

A **carteira de títulos a receber** continua calculada em `lib/indicadores/tela-3.mjs` — é dela que sai o "ainda a
receber no mês" —, mas não é mais uma tela: `/receber` leva para `/fluxo-de-caixa`. Ela fica **no Omie inteira** (o DFC
é caixa e não registra carteira em aberto nem tem cadastro de cliente), e as três faixas (pago, atrasado, em aberto)
são o de-para dos oito `cStatus` do Omie que o dono decidiu em 25/09/2026. O **nome do cliente** nunca entra em
arquivo versionado: a captura troca cada nome pelo código antes de gravar.

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

**Um indicador não é de agosto, e a regra dele explica por quê.** A faixa "em aberto" do cartão
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

### Medir o clique de filtro

```
npm run medir-filtros
```

Grava [`docs/desempenho.md`](docs/desempenho.md) e [`docs/desempenho.html`](docs/desempenho.html), e guarda o que mediu
em `docs/desempenho-medicoes.json`. Mede **um clique de filtro em cada tela, fase por fase** — espera do Omie, planilhas
do DFC, cache do Omie, cálculo — e mede **os dois lados da mudança na mesma rodada**: `--modo antes` refaz o que a camada
de dados fazia até 27/09/2026 (um balde novo por combinação de filtro, reabrindo as fontes) e `--modo depois` passa pelo
caminho de verdade, com a base local. Por isso a tabela do documento não depende de ninguém ter anotado um número ontem.

Com o app no ar, `--url http://127.0.0.1:4781 --http depois` mede também **a página inteira**, sobre HTTP, que é o que o
dono sente quando clica — e é de lá que sai a quinta fase, o **desenho**. E `--omie forcar` mede o pior caso, com a
releitura do Omie em curso; para fazer isso sem mexer no cache de verdade, é só mandar a releitura gravar numa cópia
(`cp -rp .cache/omie .cache/omie-copia` e `OMIE_CACHE_DIR=.cache/omie-copia`, que é como a medição publicada foi feita).
Só leitura, e só tempo: o documento tem milissegundos e nomes de filtro, nunca dinheiro nem nome de cliente.

### Refazer o layout de uma tela

O layout segue a **skill de visualização de dados do dono**, guardada no repositório em
[`.claude/skills/visualizacao-de-dados/SKILL.md`](.claude/skills/visualizacao-de-dados/SKILL.md), com as adaptações da
MeuBESS no topo (Recharts no servidor, dinheiro num formato só, nenhuma cor no componente, e **só o visual muda**). O
plano de cada tela e o checklist de revisão ficam em [`docs/layout.md`](docs/layout.md).

Com o app no ar, a página que o dono lê sai em dois passos:

```
node scripts/capturar-tela.mjs --tela 1     # e --tela 2 e --tela 3
npm run pagina-de-layout
```

O primeiro grava `docs/tela-N-captura.html` — a página de verdade, com **todo valor em dinheiro trocado por "—"** e
todo nome de cliente trocado pelo código. O segundo grava `docs/layout.html`, com as três capturas dentro, cada uma
embaixo do título da sua tela (é o `<!-- captura N -->` de `docs/layout.md` que diz onde).

**Sem derrubar o app que está no ar.** `next build` reescreve o `.next` inteiro, e fazer isso com o app servindo da
mesma pasta quebra a tela de quem está com ela aberta. Para construir e subir o código novo ao lado, numa porta e numa
pasta só dele:

```
MEUBESS_DIST=.next-prova NODE_ENV=production node node_modules/next/dist/bin/next build
MEUBESS_DIST=.next-prova NODE_ENV=production node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4782
node scripts/capturar-tela.mjs --tela 1 --url http://127.0.0.1:4782
```

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
[`docs/tela-3-captura-filtro.html`](docs/tela-3-captura-filtro.html) (status = atrasado). E duas do **filtro de
empresa**: [`docs/tela-1-captura-empresa.html`](docs/tela-1-captura-empresa.html) (empresa 2 — as contagens do DFC ficam
como na captura sem filtro e as do Omie caem, com a frase do "não vale" ao lado de cada número do DFC) e
[`docs/tela-3-captura-empresa.html`](docs/tela-3-captura-empresa.html) (empresa 1, no ano). O `--q` do
`scripts/capturar-tela.mjs` acrescenta os filtros à URL e o `--nome` muda o fim do nome do arquivo:
`node scripts/capturar-tela.mjs --tela 1 --q "cc=FISCAL" --nome filtro`.

E as três telas **sem o Omie** — a chave "incluir dados do Omie" desligada (decisão do dono, 28/09/2026):
[`docs/tela-1-captura-sem-omie.html`](docs/tela-1-captura-sem-omie.html),
[`docs/tela-2-captura-sem-omie.html`](docs/tela-2-captura-sem-omie.html) e
[`docs/tela-3-captura-sem-omie.html`](docs/tela-3-captura-sem-omie.html). A chave é **uma forma de ver, e não um
filtro**: ligada por padrão, ela não muda número, regra nem a trava de agosto; desligada, todo número cuja fonte é o
Omie sai da conta e cada bloco que dependia dele diz isso ali mesmo, com um travessão no lugar — nunca um zero. O que
cada bloco de cada tela mostra sem o Omie está em [`docs/filtros.md`](docs/filtros.md), e
`npm run conferir-chave-omie` confere as 18 afirmações dela nas três telas.

### Onde mora o quê

| pasta | o que é |
|---|---|
| `lib/regras/` | **as regras, num lugar só.** O recorte da MeuBESS, os três baldes, as listas que o dono decidiu, o vocabulário do DFC e a leitura das planilhas. `scripts/numeros-das-telas.mjs` (a conferência) e o app importam **estes mesmos** arquivos — nenhuma regra é copiada de um lado para o outro. |
| `lib/indicadores/` | cada tela: o valor que ela mostra e a contagem que a conferência confere, montados com as regras acima. |
| `lib/dados.mjs` | a camada de dados do servidor: releitura de hora em hora e o "atualizar agora". |
| `lib/regras/omie-releitura.mjs` | a releitura do Omie pelas telas: quais leituras, uma volta por vez, a hora da última. |
| `lib/regras/omie-api.mjs` | a chamada ao Omie — endereço, credencial, tentativas, e o guarda do "só consulta". |
| `lib/regras/filtros.mjs` | **os filtros das três telas, num lugar só:** como cada um é lido da URL e normalizado, a junção dos dois cadastros de departamento pelo nome e o filtro de empresa, que as três telas dividem. Só os filtros que `docs/fontes.md` registra. |
| `app/filtrado.js` | a frase que a tela escreve **junto do número** quando o filtro escolhido não alcança aquela fonte. |
| `app/empresa.js` | o filtro de empresa, num lugar só para as três telas. |
| `app/chave-omie.js` | a **chave "incluir dados do Omie"**, num lugar só para as três telas: a caixa de marcar, o `omie=0` escondido e o aviso do que sobra de cada tela sem ele (decisão do dono, 28/09/2026). |
| `app/suspensa.js` | a **lista suspensa com caixas de marcar**: o desenho de todo filtro de escolha das três telas, sem uma linha de JavaScript (decisão do dono, 28/09/2026). |
| `scripts/conferir-chave-omie.mjs` | confere a chave "incluir dados do Omie": ligada não muda nada, desligada o lado do DFC não se move e o do Omie sai como ausência (`null`), nunca como zero. |
| `scripts/de-para-empresa-dfc.mjs` | o cruzamento que procurou o de-para da coluna `EMP.` do DFC com as filiais do Omie — e mostrou que ele não existe. |
| `scripts/subir-local.mjs` | sobe o app em modo de produção, preso em 127.0.0.1:4781. |
| `app/` | as telas. As **cores da marca ficam só em `app/globals.css`**, em variáveis — inclusive a cor de cada série de gráfico. |
| `app/graficos.js` | os gráficos da Tela 1 (Recharts), desenhados no servidor. Sem cor e sem regra: chega o número pronto e sai o desenho. |
| `app/dinheiro.js` | o formato do dinheiro e do percentual, num lugar só — é a forma que a trava da captura sabe apagar. |
| `scripts/pagina-de-layout.mjs` | escreve `docs/layout.html` a partir de `docs/layout.md` e das capturas das três telas. |
| `scripts/` | as leituras do Omie, a conferência e os testes. |

**A leitura do DFC está atrás de uma interface** (`lib/regras/dfc-fonte.mjs`): hoje, neste computador, os arquivos
vêm da pasta que o OneDrive espelha; na Vercel virão pelo **Microsoft Graph**, que é escrever a outra implementação
nesse arquivo e não tocar em mais nada. O caminho da pasta **não** está escrito em lugar nenhum do repositório — é
achado pelo formato do nome ou vem de `DFC_DIR`, porque o caminho real tem nome de pessoa.

### O que ainda não existe

Login com a conta Microsoft e a lista de e-mails liberados pelo dono; o deploy na Vercel. Enquanto o login não
existe, **o app roda só local**. Dos filtros, existem os que `docs/fontes.md` registra e nada além: **fornecedor, conta
corrente, categoria e situação nas Telas 1 e 2** e outros esperam decisão do dono (o de **empresa** existe desde
27/09/2026, nas três telas). Também não existe o seletor **"ver por centro de custo
(Omie)"** que `docs/fontes.md` descreve na linha do "Top 10 despesas" — ele trocaria as barras do DFC por barras do Omie
agrupadas por departamento, e é uma forma de ver, não um filtro.
