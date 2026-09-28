# As três telas neste computador

Decisão do dono, 27/09/2026: **as telas rodam neste computador, só para ele, sem publicar.** Nada de Vercel, nada de
endereço na internet, nada de login — quem abre o navegador aqui já é o dono da máquina.

---

## Subir

```
npm run local
```

Constrói e sobe. Abra **<http://127.0.0.1:4781>**. Para parar, `Ctrl+C` na mesma janela.

As três telas:

| Tela | Endereço |
| --- | --- |
| Gestão de Contas | <http://127.0.0.1:4781/> |
| DRE | <http://127.0.0.1:4781/dre> |
| Contas a Receber | <http://127.0.0.1:4781/receber> |

O mês e o ano entram pela barra de pílulas, ou direto no endereço: `?ano=2026&mes=8`.

**Por que `127.0.0.1` e não `localhost` ou o IP da máquina.** `127.0.0.1` é a placa de rede que só existe dentro
deste computador. O servidor atende **ali e em mais lugar nenhum**: quem estiver no mesmo wi-fi, no mesmo escritório
ou na mesma VPN não abre esta tela nem sabendo o IP daqui, porque não há nada escutando do lado de fora. Se o app
subisse do jeito de fábrica (`0.0.0.0`), abriria. É `scripts/subir-local.mjs` que prende o endereço, e é por isso que
o comando de subir passa por ele em vez de chamar o `next` direto.

Os outros dois comandos, quando forem úteis:

```
npm run start     # só sobe, usando o build que já existe (mais rápido, não reconstrói)
npm run build     # só constrói
npm run dev       # modo de desenvolvimento, também preso em 127.0.0.1:4781
```

---

## A última leitura

No rodapé de cada tela, a linha **"Última leitura"** diz de quando são os números, em cada uma das duas fontes:

* **Omie** — a hora em que a última releitura trouxe dado da API, e o que aconteceu nela (quantas páginas, ou que
  está em curso, ou que falhou).
* **DFC** — a hora em que as planilhas do mês foram lidas da pasta, e de qual fonte. Na tela de **Contas a Receber**
  essa parte diz que a tela não lê o DFC: aquela tela sai só do Omie, e não teria sentido cobrar dela uma planilha.

**As duas fontes são relidas de hora em hora**, e cada uma do seu jeito:

* O **Omie** é relido **pela API**, com as mesmas chaves que os scripts de leitura usam e **só por método de
  consulta** — `ListarMovimentos`, `PesquisarLancamentos`, `ListarCategorias`, `ListarDepartamentos`,
  `ListarPedidos`, `ListarClientesResumido`, `ListarCadastroDRE`. Nada neste repositório inclui, altera ou exclui no
  Omie, e `lib/regras/omie-api.mjs` barra qualquer método que não seja de leitura antes mesmo de chamar. O que a
  releitura traz é gravado no cache local `.cache/omie/`, fora do git.
* O **DFC** é lido da pasta sincronizada **uma vez por hora**, e não a cada cálculo: as planilhas do ano vão para uma
  base local na memória do servidor, e é de lá que as telas tiram as linhas. Passada a hora, a próxima visita manda
  ler de novo.

**A releitura do Omie não segura a tela.** São perto de 280 páginas em duas empresas, e o Omie pede uma pausa entre
chamadas: uma volta inteira leva **alguns minutos**. Então ela roda ao lado, e **a tela não espera nada por ela**: ela
desenha o último guardado e avisa, no alto, que a releitura está em curso. **Recarregue daqui a pouco e os números
novos aparecem**: quando a releitura termina, a base local é refeita sozinha em cima do cache já renovado, e a visita
seguinte mostra os números novos. Só uma releitura roda por vez, mesmo com as três telas abertas.

**E o clique num filtro responde na hora.** As fontes preparadas uma vez são o que faz isso: o clique não reabre
planilha, não reabre cache e não espera releitura — ele só calcula em cima do que já está pronto. Quem paga a leitura é
a **primeira abertura** depois de subir o app (uns 7 segundos, o tempo de abrir as doze planilhas do ano) e, uma vez por
hora, uma preparação que roda **ao lado** sem segurar visita nenhuma. A medição, fase por fase e antes e depois, está em
[`desempenho.md`](desempenho.md).

---

## Forçar a releitura

O botão **"atualizar agora"**, no rodapé de qualquer uma das três telas. Ele joga fora o guardado da hora **e a base
local** e manda a releitura ir ao Omie na hora, sem esperar a hora virar.

O botão volta na hora — a releitura é que demora. Acompanhe pela linha "Última leitura" e pelo aviso do alto:
`releitura em curso` → `N páginas nas 22 leituras`. Enquanto isso, os números na tela são os da leitura anterior.

**A visita logo depois do botão é uma abertura**: como a base foi jogada fora, ela relê as planilhas e espera por elas
(uns 7 segundos). É de propósito — quem aperta "atualizar agora" pediu número novo. Os cliques de filtro depois dela
voltam a responder na hora.

Pela linha de comando, quando quiser refazer o cache sem abrir o navegador:

```
node scripts/ler-omie-faltante.mjs     # completa no cache o que estiver faltando
```

`OMIE_ESPERA_MS` (em milissegundos) diz quanto quem **pede** a releitura espera por ela. As telas pedem com `0` desde
27/09/2026 — elas não esperam nada —, então esta variável só muda o comportamento de quem chamar
`pedirReleituraDoOmie` com outra espera; ela existe para os scripts e para depurar.

---

## Quando alguma fonte não responde

### O Omie não responde

A tela **não quebra e não zera**. Aparece um aviso no alto e os números continuam sendo os da **última leitura
guardada** — a linha "Última leitura" diz de quando ela é, e o aviso diz o motivo da falha.

Isso funciona porque **uma leitura só entra no cache inteira**: as páginas ficam na memória e só são gravadas quando
a última chegou. Se o Omie cair no meio, o cache continua com a leitura anterior completa, e não com meia leitura.
Uma leitura que falha também não derruba as outras — o aviso pode dizer, por exemplo, que 20 das 22 leituras vieram
e duas ficaram com o guardado anterior.

O que fazer, em ordem:

1. **Esperar e apertar "atualizar agora" de novo.** Instabilidade e limite de consumo do Omie passam sozinhos; a
   chamada já tenta quatro vezes, com pausa crescente, antes de desistir.
2. **Ver o motivo no aviso.** Se falar em *consumo*, *aguarde* ou *REDUNDANT*, é o limite de chamadas do Omie:
   espere uns minutos. Se falar em *sem resposta do Omie*, é rede ou o Omie fora do ar.
3. **Se disser que falta credencial** (`OMIE_MEUBESS_… precisa estar preenchida no .env`): o arquivo `.env` da raiz
   sumiu ou foi esvaziado. Ele fica **fora do git** de propósito — refaça-o a partir de `.env.example`, com as chaves
   da empresa 1 e da empresa 2.
4. Enquanto o Omie não voltar, os números da tela seguem valendo: são os da última leitura, e a tela diz qual é.

### A pasta do DFC não responde

Aparece o aviso **"O DFC não foi lido nesta rodada"**, com o motivo, e as telas 1 e 2 mostram zerados só os cartões
e as linhas cuja fonte principal é o DFC — **o lado do Omie continua valendo**. A tela de Contas a Receber não usa o
DFC e não muda em nada.

O que fazer:

1. **Abrir a pasta do DFC no Explorer** e esperar o OneDrive terminar de sincronizar. O app lê os `.xlsx` do ano da
   MeuBESS; arquivo que ainda está só na nuvem não é lido.
2. **Se o app não achar a pasta** (o aviso diz `não achei a pasta DFC/2026 da MeuBESS sincronizada`), aponte o
   caminho com a variável `DFC_DIR` antes de subir. O caminho **não entra em arquivo do repositório** — ele tem nome
   de pessoa, e nome de pessoa não vai para o git.

   ```
   DFC_DIR=<o caminho da pasta do ano>  npm run local
   ```

3. **Se o arquivo do mês não existir ainda** (o mês ainda não fechou), é o esperado: aquele mês não tem coluna no DRE
   nem blocos por dia na Tela 1.

---

## O que este app não faz

* **Não publica nada.** Sem Vercel, sem deploy, sem endereço na internet, sem login.
* **Não escreve no Omie nem nas planilhas.** Só consulta. O único lugar em que ele escreve é o cache local `.cache/`,
  que o `.gitignore` mantém fora de todo commit.
* **Não grava número em arquivo do repositório.** Valor em dinheiro e nome de cliente existem na memória do servidor
  e na tela, e só ali. Quem confere os números é `npm run conferir-telas`, que compara **contagens** com
  `docs/conferencia.md` e grava `docs/telas-conferidas.md`.

---

## Onde está cada coisa

| O quê | Arquivo |
| --- | --- |
| Sobe o app preso em 127.0.0.1:4781 | `scripts/subir-local.mjs` |
| Decide quando reler, e junta as duas fontes | `lib/dados.mjs` |
| As fontes preparadas uma vez, de onde o clique de filtro calcula | `lib/regras/base-local.mjs` |
| A releitura do Omie (quais leituras, uma volta por vez) | `lib/regras/omie-releitura.mjs` |
| A chamada ao Omie (credencial, tentativas, só consulta) | `lib/regras/omie-api.mjs` |
| Onde cada leitura mora no cache | `lib/regras/cache-omie.mjs` |
| De onde vêm as planilhas do DFC | `lib/regras/dfc-fonte.mjs` |
| A linha "Última leitura" e os avisos | `app/ultima-leitura.js` |
| A regra de cada indicador | `docs/fontes.md` |
