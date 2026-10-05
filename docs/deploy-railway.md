# As três telas no Railway

**Estado em 29/09/2026:** o app está **pronto** para rodar no Railway, e **nada foi publicado**. Não há conta, projeto,
deploy nem rotina agendada — tudo o que está aqui foi feito e testado neste computador. Este documento lista o que o
servidor precisa (só **nomes** de variável, nunca valores) e onde ele guarda o que tem de sobreviver a um redeploy.

## O que o Railway roda

O build é o [`Dockerfile`](../Dockerfile) da raiz, e só ele: o [`railway.json`](../railway.json) diz o mesmo
(`builder: DOCKERFILE`), mas o Railway pode ignorá-lo (Config as Code está obsoleto; ver `docs/no-ar.md`), então o
comando de início vale também pelo `CMD` do Dockerfile. No painel do serviço, *Custom Start Command* fica vazio ou
`npm run servidor` — **nunca** `npm run start`, que desliga o login.

| passo | comando | o que faz |
|---|---|---|
| build | `npm run build` (no Dockerfile) | `next build` em modo de produção (`scripts/subir-local.mjs --so-build`, o mesmo build de sempre) |
| start | `npm run servidor` | `scripts/subir-servidor.mjs`: sobe o `next start` em **`0.0.0.0`** e na porta **`$PORT`** que o Railway manda, **com login** |
| saúde | `GET /entrar` | a tela de entrar é a única página que responde 200 sem login |

Node: `>=22.12` (`engines` do `package.json`; este computador roda o 24).

`scripts/subir-servidor.mjs` **se recusa a subir** se o ambiente tiver `MEUBESS_LOGIN=desligado` (que é só do
`npm run local`, preso em 127.0.0.1) ou se `SESSAO_SEGREDO` faltar ou tiver menos de 32 caracteres. Ele imprime só o
nome do que falta, nunca um valor.

## O armazenamento persistente: um Volume do Railway

O disco de um serviço do Railway é apagado a cada deploy. O que precisa sobreviver vai para um **Volume**, criado no
painel do serviço (*New → Volume*, montado por exemplo em `/data`). O Railway anuncia o ponto de montagem em
`RAILWAY_VOLUME_MOUNT_PATH`, e o app usa esse caminho sozinho; `MEUBESS_DADOS_DIR` troca por outro, se precisar.

Dentro do volume:

| caminho | o que é | quem grava |
|---|---|---|
| `usuarios.json` | o cadastro de quem entra: e-mail, **senha só embaralhada** (scrypt com sal por pessoa), administrador ou não, ativo ou não | a tela `/admin`, o `npm run criar-admin` e o primeiro administrador do ambiente |
| `dfc/envio.json` | o DFC que vale: a **hora do último envio do PC** e nome, tamanho e sha256 de cada planilha | `POST /api/dfc` |
| `dfc/pedacos/` | as planilhas do DFC, cada uma pelo sha256 do conteúdo | `PUT /api/dfc` |
| `cache/` | o cache das leituras do Omie e a hora da última releitura — a pasta `.cache/` do app vira um atalho para cá (`scripts/subir-servidor.mjs`), para o Omie não ser relido do zero a cada deploy | a releitura do Omie (só consulta) |

## As variáveis de ambiente do servidor

Só os nomes. Os valores ficam no painel do Railway (*Variables*), nunca em arquivo versionado.

| variável | obrigatória? | para quê |
|---|---|---|
| `SESSAO_SEGREDO` | **sim** | assina o cookie da sessão; 32 caracteres ou mais, sorteados (trocá-la derruba todas as sessões) |
| `DFC_ENVIO_SEGREDO` | **sim** | o segredo que o PC manda para `/api/dfc`; sem ela a rota recusa todo envio |
| `PENDENCIAS_PONTE_SEGREDO` | **para a ponte** | segredo Bearer próprio da Central para publicar pendências e buscar respostas; sem ela as rotas da ponte recusam tudo |
| `OMIE_MEUBESS_1_APP_KEY` | **sim** | a chave do Omie da empresa 1 (só consulta) |
| `OMIE_MEUBESS_1_APP_SECRET` | **sim** | o segredo da mesma chave |
| `OMIE_MEUBESS_2_APP_KEY` | **sim** | a chave do Omie da empresa 2 |
| `OMIE_MEUBESS_2_APP_SECRET` | **sim** | o segredo da mesma chave |
| `MEUBESS_ADMIN_EMAIL` | só no primeiro deploy | o e-mail do primeiro administrador |
| `MEUBESS_ADMIN_SENHA` | só no primeiro deploy | a senha inicial dele — **apague as duas depois de entrar a primeira vez** |
| `MEUBESS_DADOS_DIR` | não | onde gravar o cadastro, o DFC e o cache; sem ela, o volume (`RAILWAY_VOLUME_MOUNT_PATH`) |
| `DFC_FONTE` | não | de onde o DFC vem; o servidor usa `servidor` (o que o PC mandou) quando ela falta |
| `OMIE_ESPERA_MS` | não | quanto a tela espera pela releitura do Omie antes de mostrar o guardado |
| `PORT` | o Railway põe | a porta em que o servidor escuta |
| `RAILWAY_VOLUME_MOUNT_PATH` | o Railway põe | o ponto de montagem do volume |

**Nunca** ponha `MEUBESS_LOGIN` no servidor (ele se recusa a subir) nem `OMIE_RELEITURA` (é do teste: desliga a
releitura do Omie).

No **PC do dono**, e não no servidor, o envio do DFC usa:

| variável | para quê |
|---|---|
| `MEUBESS_SERVIDOR_URL` | o endereço https do app no Railway |
| `DFC_ENVIO_SEGREDO` | o mesmo valor do servidor |

As duas podem ficar no `.env` da raiz (fora do git), junto das chaves do Omie que já estão lá.

## O primeiro administrador

Dois jeitos; o primeiro é o do Railway.

1. **Pelo ambiente.** Antes do primeiro deploy, ponha `MEUBESS_ADMIN_EMAIL` e `MEUBESS_ADMIN_SENHA` (10 caracteres ou
   mais) nas variáveis do serviço. Na primeira tentativa de entrar, com o cadastro ainda vazio, o app cria esse
   administrador. Entre em `/entrar`, confira que `/admin` abre, e então **apague as duas variáveis** — com alguém
   cadastrado elas não fazem mais nada, mas a senha não deve ficar no painel.
2. **Pelo script**, dentro do serviço (`railway ssh`, para gravar no volume dele) ou neste computador:

   ```
   npm run criar-admin -- dono@empresa.com.br
   ```

   A senha é pedida no terminal, sem eco, duas vezes.

Depois disso, o administrador cadastra as outras pessoas em **`/admin`** ("pessoas com acesso", no rodapé das telas):
cria com uma senha inicial, desativa e reativa, troca a senha. Desativar ou trocar a senha derruba na hora a sessão
aberta daquela pessoa. Todo mundo ativo vê as três telas; só administrador entra em `/admin`.

## O login

- **Senha**: nunca guardada; só o scrypt (N = 2^15, r = 8, p = 1, sal aleatório de 16 bytes por pessoa), comparado em
  tempo constante. Mínimo de 10 caracteres.
- **Sessão**: cookie `meubess_sessao` assinado com HMAC-SHA256, `HttpOnly`, `Secure`, `SameSite=Lax`, 12 horas. A cada
  pedido a pessoa é procurada no cadastro: desativada, ou com a senha trocada, a sessão cai.
- **Tudo exige login**: as três telas, `/admin` e toda rota de API, inclusive `POST /api/atualizar` — pelo
  [`proxy.js`](../proxy.js) (o antigo *middleware* do Next 16) e, de novo, dentro de cada rota e de cada tela. Livres
  só `/entrar` e `/api/entrar`. `/api/dfc` não usa login de pessoa: exige `DFC_ENVIO_SEGREDO`.
- **E-mail sem cadastro, pessoa desativada e senha errada** recebem a mesma resposta. 8 erros em 15 minutos do mesmo
  endereço para o mesmo e-mail, ou 20 para o mesmo e-mail de qualquer endereço, travam as tentativas até a janela passar.
- Um POST vindo de outro site (cabeçalho `Origin` de outro endereço) é recusado.

A prova: `npm run testar-login` sobe o app de verdade, com login, numa porta de teste, e confere 56 coisas —
entre elas, que as telas e o `POST /api/atualizar` sem login são recusados, que com login passam e que um e-mail sem
cadastro é barrado.

## O que mudou em 03/10/2026: três brechas fechadas antes de publicar

- **Limite de tentativas.** Antes, o endereço era o *primeiro* valor do `x-forwarded-for`, que o próprio cliente
  escreve: trocar o cabeçalho a cada tentativa zerava o limite. Agora vale o **último salto** (o que o proxy do Railway
  acrescenta), e há uma segunda contagem **só pelo e-mail**, 20 erros em 15 minutos, que nenhum cabeçalho zera. O preço:
  quem errar 20 vezes um e-mail alheio trava esse e-mail por 15 minutos. Código em `app/api/entrar/route.js`.
- **Teto do mapa de tentativas.** O mapa em memória (`lib/acesso/tentativas.mjs`) não passa de **5.000 entradas**:
  poda as vencidas e, se ainda estiver cheio, descarta as mais antigas (a chave atacada agora é a última a sair).
- **Zip descompactado.** Um `.xlsx` é um zip, e o limite de 60 MB do `PUT /api/dfc` é do comprimido. Agora o servidor
  lê só o diretório central do zip, sem descompactar, e recusa com 413 o que somar mais de **200 MB descompactados**
  (as planilhas do DFC de 2026 dão cerca de 61 MB cada), além de zip64 e do que não for zip. O leitor
  (`lib/regras/xlsx.mjs`) também para de descompactar em 200 MB, se um diretório central mentir o tamanho. Os anexos
  `.zip`, `.xlsx` e `.ods` das pendências passam pelo mesmo teto, porque a Central pode abri-los.

O `npm run testar-login` prova as três: casos "x-forwarded-for", "teto do mapa" e "zip descompactado".

## O DFC, fora do OneDrive

O servidor não enxerga a pasta que o OneDrive espelha. Quem a lê é o PC do dono:

```
npm run financeiro-enviar-dfc            # lê as planilhas como o app sempre leu e manda para o servidor
npm run financeiro-enviar-dfc -- --seco  # só diz quantas planilhas mandaria
```

O script pergunta ao servidor o que ele já tem (`GET /api/dfc`), manda só as planilhas que mudaram (`PUT`, pelo sha256)
e fecha o envio com a lista inteira da pasta (`POST`), que grava a hora. As telas do servidor mostram no rodapé
"DFC: enviado pelo PC em …". Termina com código 0 quando o servidor confirmou, e diferente de 0 em qualquer falha.

**Está pronto para ser agendado de hora em hora e não está agendado.** Quando o dono quiser, no Agendador de Tarefas do
Windows, uma tarefa de hora em hora com o programa `npm` e os argumentos `run financeiro-enviar-dfc`, iniciando na pasta
do repositório.

Os números não mudam por vir do servidor: são os mesmos bytes, lidos pelo mesmo `lib/regras/dfc.mjs`. Conferido em
29/09/2026: com as doze planilhas mandadas por este script a um servidor local e `DFC_FONTE=servidor`,
`npm run conferir-telas` deu **40 conferidos, 0 divergentes, 0 a conferir** — o mesmo resultado da pasta sincronizada.

## Neste computador, nada mudou

`npm run local` continua subindo as três telas em `http://127.0.0.1:4781`, lendo o DFC da pasta sincronizada, **sem
pedir login**: é o único lugar em que o login fica desligado (`MEUBESS_LOGIN=desligado`, que o próprio script põe só no
`next start`), porque ali o servidor só atende a própria máquina.

## O que não foi feito

`git push`, deploy, conta ou projeto no Railway, o volume, as variáveis no painel e o agendamento do envio do DFC.
