# MeuBESS · Financeiro — dashboards

Dashboards do departamento financeiro da MeuBESS, usados pela equipe **fora da Central de Comando** (app próprio, com
acesso próprio). Não se mistura com o Painel Logístico (`meubess_dashboard`), com a plataforma da MeuBESS nem com o
Lovable.

**Estado:** a **Tela 1 (Gestão de Contas)** e a **Tela 2 (DRE)** estão construídas e rodando localmente; a Tela 3,
não. As fontes de cada número estão fechadas em [`docs/fontes.md`](docs/fontes.md) e conferidas em
[`docs/conferencia.md`](docs/conferencia.md).

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
  [`docs/confronto-dfc-omie.html`](docs/confronto-dfc-omie.html).
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
npm run dev
```

O app sobe em **http://localhost:4781** (a porta está no `npm run dev` do `package.json`; 4747 já é da Central de
Comando neste computador). Cada tela abre no **mês corrente**, e as duas têm seletor de mês e o botão **atualizar
agora**. Para agosto de 2026:

| tela | rota |
|---|---|
| **Tela 1 — Gestão de Contas** | <http://localhost:4781/?ano=2026&mes=8> |
| **Tela 2 — DRE** | <http://localhost:4781/dre?ano=2026&mes=8> |

As **empresas 1 e 2 entram sempre somadas** e o recorte é o da MeuBESS.

A **Tela 2 tem uma coluna por mês**, como a tela de referência, e ao lado de cada uma cabem a **análise horizontal**
(quanto a coluna variou contra o mês anterior) e a **análise vertical** (quanto a linha pesa na receita líquida do
próprio mês). As duas ligam e desligam pelos botões do topo, que são links — o estado mora na URL (`?ah=1&av=1`), e
não no navegador, então a captura e um link colado mostram exatamente a mesma coisa. **AH e AV não são regra de
`docs/fontes.md`**: vêm do layout de referência e saem dos valores que as regras já calcularam.

A última linha da tabela diz **de quanta leitura cada coluna saiu**, dos dois lados. Não é enfeite: em 2026, janeiro
e fevereiro têm o DFC cheio e quase nenhum lançamento do Omie no recorte da MeuBESS, então os totalizadores desses
dois meses misturam um lado cheio com outro vazio e a coluna não se lê como DRE. A leitura do Omie que está no cache
vai de **01/01 a 30/09**; mês fora dessa janela não vira coluna.

**As fontes são relidas de hora em hora** (decisão do dono, 25/09/2026), e "atualizar agora" força a releitura na
hora. O que é relido são o cache local do Omie (`.cache/omie/`) e as planilhas do DFC; buscar página nova na API do
Omie continua sendo trabalho de `scripts/confronto-dfc-omie.mjs` e `scripts/ler-omie-faltante.mjs`.

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

Uma **captura de cada tela sem dinheiro** (valores trocados por "—", contagens e percentuais mantidos) fica em
[`docs/tela-1-captura.html`](docs/tela-1-captura.html) e
[`docs/tela-2-captura.html`](docs/tela-2-captura.html). Com o app no ar, `npm run capturar-tela-1` e
`npm run capturar-tela-2` as regeram — e nenhuma é gravada se sobrar qualquer valor em dinheiro no HTML.

### Onde mora o quê

| pasta | o que é |
|---|---|
| `lib/regras/` | **as regras, num lugar só.** O recorte da MeuBESS, os três baldes, as listas que o dono decidiu, o vocabulário do DFC e a leitura das planilhas. `scripts/numeros-das-telas.mjs` (a conferência) e o app importam **estes mesmos** arquivos — nenhuma regra é copiada de um lado para o outro. |
| `lib/indicadores/` | cada tela: o valor que ela mostra e a contagem que a conferência confere, montados com as regras acima. |
| `lib/dados.mjs` | a camada de dados do servidor: releitura de hora em hora e o "atualizar agora". |
| `app/` | as telas. As **cores da marca ficam só em `app/globals.css`**, em variáveis. |
| `scripts/` | as leituras do Omie, a conferência e os testes. |

**A leitura do DFC está atrás de uma interface** (`lib/regras/dfc-fonte.mjs`): hoje, neste computador, os arquivos
vêm da pasta que o OneDrive espelha; na Vercel virão pelo **Microsoft Graph**, que é escrever a outra implementação
nesse arquivo e não tocar em mais nada. O caminho da pasta **não** está escrito em lugar nenhum do repositório — é
achado pelo formato do nome ou vem de `DFC_DIR`, porque o caminho real tem nome de pessoa.

### O que ainda não existe

Tela 3; login com a conta Microsoft e a lista de e-mails liberados pelo dono; o deploy na Vercel. Enquanto o
login não existe, **o app roda só local**.
