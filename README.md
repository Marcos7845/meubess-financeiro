# MeuBESS · Financeiro — dashboards

Dashboards do departamento financeiro da MeuBESS, usados pela equipe **fora da Central de Comando** (app próprio, com
acesso próprio). Não se mistura com o Painel Logístico (`meubess_dashboard`), com a plataforma da MeuBESS nem com o
Lovable.

**Estado:** em definição. Nada de código ainda: primeiro as fontes de cada número, depois a pilha e a hospedagem.

## As três telas

As referências visuais ficam em [`docs/referencias/`](docs/referencias/). O que cada tela mostra e de onde vem cada
número fica em [`docs/fontes.md`](docs/fontes.md) — é o contrato do projeto: indicador sem fonte escrita não entra na tela.

## Regras

- **Só leitura nas fontes.** Nada aqui escreve no ERP, nas planilhas de origem ou em qualquer sistema financeiro.
- **Credencial só no `.env`** (fora do git; o modelo é o `.env.example`). Nunca em código, commit, log ou mensagem.
  O Omie tem três chaves, uma por filial, só para leitura, gravadas pelo dono no `.env` local, cada uma em um par de
  variáveis: `OMIE_MEUBESS_1_APP_KEY` / `OMIE_MEUBESS_1_APP_SECRET` (filial `/0001-42`), `OMIE_MEUBESS_2_APP_KEY` /
  `OMIE_MEUBESS_2_APP_SECRET` (filial `/0002-23`) e `OMIE_MEUBESS_3_APP_KEY` / `OMIE_MEUBESS_3_APP_SECRET` (filial
  `/0003-04`). **A das telas é a `OMIE_MEUBESS_2`**: só a filial `/0002-23` tem os pedidos, clientes e produtos que a
  plataforma envia (ver [`docs/comparacao-chaves-omie.html`](docs/comparacao-chaves-omie.html)).
- **Todo número confere com a fonte.** Cada indicador diz de onde vem (ERP: módulo, tabela e filtro; planilha: arquivo,
  aba e coluna) e é conferido com um caso real antes de ser dado como pronto.
- **Número financeiro não sai da máquina para ser medido ou classificado** por serviço de terceiros.
