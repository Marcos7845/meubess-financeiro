# As três telas no ar — conferência de 30/09/2026

**Estado:** publicado no Railway, com login, mas **as três telas ainda não abrem** para quem entrou: o servidor fica
sem memória ao montá-las (abaixo). Só contagens, códigos e horas aqui; nenhum valor em reais nem credencial.

## Endereço

`https://meubess-financeiro-production.up.railway.app` — domínio `*.up.railway.app` do serviço `meubess-financeiro`
(projeto `meubess-financeiro`, ambiente `production`, volume em `/data`). `http://` responde 301 para o `https://`.

## O que foi feito no Railway

- Domínio criado, porta 8080 (variável `PORT=8080` acrescentada ao serviço).
- Comando de início e de build gravados **no serviço** (`npm run servidor`, `npm run build`, saúde em `/entrar`, 120 s,
  reinício `ON_FAILURE` até 5): o Railway não aplicou o `railway.json` num envio por `railway up` — a API responde que
  "Config as Code (railway.json) is deprecated". O primeiro deploy subiu com `npm start` (preso em `127.0.0.1`, só 502,
  nada exposto); o segundo, `4bda1d8a`, com `npm run servidor`.
- `MEUBESS_ADMIN_EMAIL` e `MEUBESS_ADMIN_SENHA` **tiradas** das variáveis depois do login do administrador funcionar.
  Ficaram: `SESSAO_SEGREDO`, `DFC_ENVIO_SEGREDO`, as quatro chaves do Omie 1 e 2, `PORT`.
- Os tokens de projeto usados no deploy foram apagados.

## Conferido no ar (30/09/2026, entre 22:48 e 22:57 UTC)

- **https:** `/entrar` 200 sem login; `http://` → 301 para `https://`.
- **Tela sem login recusada:** `/`, `/dre`, `/fluxo-de-caixa`, `/receber` e `/admin` → 307 para `/entrar?volta=…`;
  `GET` e `POST /api/atualizar` → 401; `GET /api/dfc` sem segredo → 401.
- **E-mail sem cadastro barrado:** `POST /api/entrar` → 303 para `/entrar?erro=1`, sem cookie.
- **Administrador entra:** 303 para `/` com cookie de sessão; `/admin` → 200. O cadastro ficou no volume (entrou de
  novo depois de o processo reiniciar).
- **Último envio do DFC:** `2026-09-30T22:49:24Z` (19:49 em Brasília), 13 planilhas, pela tarefa agendada
  `financeiro-enviar-dfc` deste PC (código de saída 0), lido em `GET /api/dfc`.

## Números de agosto/2026 contra `docs/telas-conferidas.md` (commit f911de2: 45 conferidos)

- a conferir: Tela 1 (`/?ano=2026&mes=8`) — com login, a tela respondeu 500 enquanto o cache do Omie do servidor
  estava vazio ("cache não encontrado"), e depois 502: o processo do Next caiu por falta de memória (`JavaScript heap
  out of memory`, perto de 480 MB de heap) e reiniciou.
- a conferir: Tela 2 (`/dre?ano=2026&mes=8`) — mesmo motivo.
- a conferir: Tela 3 (`/fluxo-de-caixa?ano=2026&mes=8`) — mesmo motivo.

**Por quê:** o serviço está limitado a 1 GB de memória (plano Hobby); o app, neste PC, chega a cerca de 1,1 GB no
pico. Aumentar o limite do serviço no Railway não foi feito nesta passagem. Depois dele, repetir a conferência acima
das três telas contra as 45 linhas de `docs/telas-conferidas.md`.
