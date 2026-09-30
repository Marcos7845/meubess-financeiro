<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MeuBESS · Financeiro — regras do projeto

Tudo abaixo é do projeto, não do Next. O `README.md` é o mapa completo; esta página só diz o que um agente novo
precisa saber **antes** de tocar em qualquer arquivo. Onde houver conflito, vale o `docs/fontes.md` (o contrato dos
números) e, sobre decisão do dono, o que está datado no `README.md`.

## O que é o app

Dashboards do financeiro da MeuBESS, para a equipe, **fora da Central de Comando** (app próprio, acesso próprio).
Next.js (App Router), **JavaScript, sem TypeScript**, Recharts 2 como única biblioteca de gráfico (`app/graficos.js`).
Três telas, todas com filtros na URL (`?ano=&mes=&empresa=`):

| tela | rota | fonte principal |
|---|---|---|
| 1 — Gestão de Contas | `/` | DFC (planilhas) + Omie |
| 2 — DRE, uma coluna por mês | `/dre` | DFC + Omie |
| 3 — Fluxo de Caixa | `/fluxo-de-caixa` (`/receber` só redireciona) | caixa do DFC; o que falta pagar/receber, do Omie |

- **Omie** (ERP): 3 chaves no `.env`, uma por filial. As telas **somam as empresas 1 e 2**; a 3 fica fora. A chave
  `OMIE_MEUBESS_2` (CNPJ `/0002-23`) é a única com os pedidos/clientes/produtos da plataforma. Só entram contas
  correntes de `negocio: "MeuBESS"` em `dados/contas-correntes-por-negocio.json` — não adivinhe negócio pelo nome do banco.
- **DFC** (planilhas `.xlsx` do ano, na pasta que o OneDrive espelha): `lib/regras/dfc-fonte.mjs` a acha ou lê `DFC_DIR`.
  A coluna `EMP.` (`B3W`/`N3`) **não** é filial do Omie: o DFC não se filtra por empresa (`docs/fontes.md`).
- Receita da MeuBESS nasce em **pedido de venda** criado pela plataforma; despesa é lançada à mão no Omie.
- Leitor de xlsx: um só, `lib/regras/xlsx.mjs` (`linhasCruas` + `lerAba`). Não crie outro. Doc ou medição anterior a
  29/09/2026 falando em "saldo em L" ou "data em TIPO" descreve o defeito já corrigido.
- Onde mora o quê: `lib/regras/` (regras, num lugar só), `lib/indicadores/` (o que cada tela mostra),
  `lib/dados.mjs` (releitura de hora em hora), `app/` (telas; as cores só em `app/globals.css`), `scripts/`
  (leituras, conferências, testes). Tabela completa em `README.md`, seção "Onde mora o quê".

## Regra 1 — o Omie é só consulta

Nada aqui inclui, altera ou exclui no Omie, nem escreve nas planilhas do DFC. `lib/regras/omie-api.mjs` tem o guarda
`eDeConsulta()`, que barra antes do `fetch` qualquer método que não seja de leitura (`Listar…`, `Pesquisar…`).

- Não enfraqueça nem contorne `eDeConsulta()`, não chame `Incluir…`/`Alterar…`/`Excluir…`, não abra o `.xlsx` para edição.
- Método novo de leitura: passa por `lib/regras/omie-api.mjs` e entra em `lib/regras/omie-releitura.mjs`, com a fonte escrita
  antes em `docs/fontes.md`.
- O único lugar onde o app escreve é o cache local `.cache/` (fora do git).

## Regra 2 — valor em reais e nome de cliente não vão para arquivo versionado

- Dinheiro e nome de pessoa/cliente existem só na memória do servidor e na tela. Docs, capturas, logs, testes e
  mensagens de commit trazem **contagem, código, data e campo de cadastro** — nunca valor em reais.
- Credencial só no `.env` (fora do git; o modelo é `.env.example`). Nunca em código, commit, log ou mensagem.
- O caminho da pasta do DFC **não** entra em arquivo do repositório (tem nome de pessoa): ele é achado pelo formato do
  nome ou vem de `DFC_DIR`.
- Já ignorados por `.gitignore`: `.env*`, `.cache/`, `mapa-omie*.log` (na raiz), `docs/confronto-dfc-omie.html` (traz
  reais, gerado por `scripts/confronto-dfc-omie.mjs`), `.next*`. Não os force com `git add -f`.
- As capturas `docs/tela-N-captura*.html` saem de `scripts/capturar-tela.mjs`, que troca todo valor por "—" e todo
  nome de cliente pelo código, e **se recusa a gravar** se sobrar um. Os conferidores têm a mesma trava.
- Número financeiro não sai da máquina para ser medido ou classificado por serviço de terceiros. **Exceção do dono em 30/09/2026, somente no auditor independente com `--jev`:** o Jev (`typesafe/jev-1.13` pelo OpenRouter) pode sugerir a categoria de lançamentos de agosto/2026. De cada lançamento, só o texto da descrição previamente limpo por código local pode ser enviado: sem valor, data, nome de pessoa ou cliente, CNPJ/CPF, conta, agência, banco ou documento. Nenhum contexto sensível acompanha a descrição. A chave `OPENROUTER_API_KEY` vem só do ambiente e não é impressa nem gravada. Sugestões não alteram fonte e exigem revisão humana abaixo do limiar documentado.
- O formato do dinheiro mora em `app/dinheiro.js`, num lugar só — é a forma que a trava da captura sabe apagar.

## Regra 3 — o número da tela tem que conferir com a fonte

Indicador sem fonte escrita em `docs/fontes.md` não entra na tela. Regra nova ou mudada: escreva primeiro em
`docs/fontes.md`, depois no código de `lib/regras/` e `lib/indicadores/`, e só então confira.

| comando | o que prova | rode quando |
|---|---|---|
| `npm run conferencia` | refaz `docs/conferencia.md` e o bloco gerado de `docs/fontes.md`; **para e não grava** se agosto/2026 mudou (`docs/trava-agosto-2026.json`) | mexeu em regra, recorte ou fonte de indicador |
| `npm run conferir-telas` | a contagem que cada tela usa = a de `docs/conferencia.md`; grava `docs/telas-conferidas.md`; sai com erro se divergir | mexeu em `lib/indicadores/` ou `lib/regras/`, e depois do `conferencia` |
| `npm run conferir-filtros` | cada filtro pega o mesmo recorte que os arquivos crus do cache; grava `docs/filtros.md` e `.html` | mexeu em filtro (`lib/regras/filtros.mjs`, `app/suspensa.js`, `app/empresa.js`) ou em tela com filtro |
| `npm run conferir-chave-omie` | a chave "incluir dados do Omie": ligada não muda nada, desligada dá `null` e nunca zero | mexeu na chave (`app/chave-omie.js`) ou em bloco que depende do Omie |
| `npm run testar-trava` | a trava de agosto para quando deve e passa a releitura retroativa (roda numa cópia do cache) | mexeu na trava ou em `scripts/numeros-das-telas.mjs` |
| `npm run testar-login` | as três telas e as APIs recusam quem não entrou; `/admin` só para administrador; `/api/dfc` com segredo | mexeu em `proxy.js`, `lib/acesso/`, `/api/*` ou `/admin` |

- Divergência é defeito do código ou da regra: **não edite o número esperado à mão** para o teste passar. A conferência
  lê o texto de `docs/conferencia.md` de propósito, para não comparar o código com ele mesmo.
- Mês conferido é **agosto de 2026**; o Omie recebe lançamento retroativo, então jan–set muda de contagem sozinho
  (é publicado, não travado). Refixar a trava é na mão, com `node scripts/numeros-das-telas.mjs --refazer-trava`, e só
  com o dono ciente.
- Sem ler o OneDrive: `--sem-dfc` (linhas do DFC saem "a conferir:") ou `DFC_DIR=.cache/dfc-2026`, a cópia local das
  planilhas. Não abra nem copie de pasta sincronizada com a nuvem: ler o arquivo o baixa e o Windows pede ao dono.
- Números com reais, só no terminal e nunca em arquivo: `scripts/diagnostico-dia-a-dia.mjs`,
  `scripts/confronto-dfc-omie.mjs`.

## Auditoria independente

`npm run auditar -- --mes 2026-09` roda fora do Next e gera `docs/auditoria-2026-09.html` (ignorado pelo git). Usa a cópia local `.cache/dfc-2026` por padrão ou `--dfc-dir <pasta local>`; nunca indique uma pasta sincronizada. Consulta o Omie diretamente, só leitura, por `lib/regras/omie-api.mjs`, sem escrever no cache do app. Para um ensaio sem rede, `--cache-omie` lê o cache, mas as linhas do Omie ficam **não auditáveis** pela falta de resposta atual. `--janela 2` inclui o mês anterior; veja `docs/auditoria.md` para o formato de `extratos/`. Sem extratos de todas as contas, o caixa fica **não auditável**.

**Exceção autorizada pelo dono em 30/09/2026, somente para o auditor independente:** ele pode ler diretamente, só o necessário e somente para consulta, a pasta master de FINANCEIRO & FISCAL dentro de `Meu Bess` do usuário, ciente de que a leitura baixa os arquivos sincronizados. Deve ignorar as pastas soltas de DFC com sufixo numérico, que são cópias. Arquivos necessários podem ser copiados para `.cache/` (ignorado pelo git); o caminho absoluto e o nome da pasta master não entram em arquivo versionado. A exceção não autoriza alteração, exclusão nem movimentação na master, e não se estende às conferências do app.

## Como subir local

```
npm install
npm run local      # constrói e sobe em produção, só em http://127.0.0.1:4781 (sem login)
```

- Porta 4781 porque a 4747 é da Central de Comando. `127.0.0.1` de propósito: nada escuta fora desta máquina.
  Suba pelo `scripts/subir-local.mjs`, não chame `next start` direto (ele abriria em `0.0.0.0`).
- Outros: `npm run start` (sem rebuild), `npm run build`, `npm run dev` (também preso em `127.0.0.1:4781`).
- Node `>=22.12`. Se o app do dono estiver no ar, **não rode `next build` na mesma pasta**: use
  `MEUBESS_DIST=.next-prova` e a porta 4782 (comandos no `README.md`, "Sem derrubar o app que está no ar").
- Sem `.env` o Omie não responde e as telas mostram o último cache com aviso; não crie chave: o `.env` se refaz a
  partir de `.env.example`, com o dono.
- Passo a passo (última leitura, atualizar agora, fonte que não responde): `docs/uso-local.md` — o texto é anterior
  ao login e à Tela 3 nova; na dúvida, vale o `README.md`.

## Onde está a verdade

| assunto | arquivo |
|---|---|
| o que é o projeto, decisões do dono com data, onde mora o quê | `README.md` |
| o contrato de cada número: fonte, filtro, lacunas | `docs/fontes.md` (grande: procure pela seção do indicador) |
| conferência de um mês fechado, e as telas contra ela | `docs/conferencia.md`, `docs/telas-conferidas.md` |
| cada filtro, onde vale e onde não vale, com caso real | `docs/filtros.md` |
| Tela 3 (Fluxo de Caixa): o que falta responder ao dono, registro vivo — **leia primeiro se for continuar nela** | `docs/passagem-fluxo-de-caixa.md` |
| desenho das telas, plano de gráficos, checklist | `docs/layout.md` e `.claude/skills/visualizacao-de-dados/SKILL.md` (as adaptações do topo mandam) |
| Railway: variáveis (só nomes), volume, primeiro administrador | `docs/deploy-railway.md`, `railway.json` |
| tempo de clique de filtro | `docs/desempenho.md` |

Ao mexer numa tela, o desenho segue a skill de visualização: **só o visual muda**, nenhuma cor no componente (as cores
ficam em `app/globals.css`), gráfico desenhado no servidor.

## O que não fazer

- **Não fazer deploy.** O app está pronto para o Railway e **nada foi publicado** (`docs/deploy-railway.md`). Não
  crie conta, projeto, variável, cron nem agende o envio do DFC. Vercel também não: a decisão de 27/09/2026 é usar local.
- **Não dar push**, nem `--force`, nem apagar branch. Commit só quando pedido, só com os arquivos do pedido.
- **Não mexer no `.env`**, nem imprimir valor de chave, segredo ou senha. `.env.example` só tem nomes.
- **Não chamar a API do Omie por conta própria** fora de `lib/regras/omie-api.mjs` e dos scripts que já existem,
  e nunca com método de escrita.
- Não desligar as travas para passar um teste.
- Não escrever regra de número fora de `lib/regras/` (o app e a conferência importam os mesmos arquivos), nem
  copiar regra de um lado para o outro.
- Não instalar biblioteca de gráfico além do Recharts, nem TypeScript, sem decisão do dono.
- Não editar à mão o `CLAUDE.md` (é só `@AGENTS.md`) nem os arquivos gerados (`docs/conferencia.*`,
  `docs/telas-conferidas.md`, `docs/filtros.html`, `docs/layout.html`, `docs/tela-*-captura*.html`): rode o script
  que os gera.
