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
  variáveis, e cada filial tem o seu papel (dono, 24/09/2026):
  - `OMIE_MEUBESS_1_APP_KEY` / `OMIE_MEUBESS_1_APP_SECRET` — empresa 1, filial `/0001-42`: as **rotinas administrativas**
    (o escritório);
  - `OMIE_MEUBESS_2_APP_KEY` / `OMIE_MEUBESS_2_APP_SECRET` — empresa 2, filial `/0002-23`: **compra, venda e logística**,
    a principal. **É a chave das telas**: só ela tem os pedidos, clientes e produtos que a plataforma envia (ver
    [`docs/comparacao-chaves-omie.html`](docs/comparacao-chaves-omie.html));
  - `OMIE_MEUBESS_3_APP_KEY` / `OMIE_MEUBESS_3_APP_SECRET` — empresa 3, filial `/0003-04`: papel não informado.

  Em aberto: falta decidir se as telas somam a empresa 1 à empresa 2 (hoje só a 2 é lida). Detalhe em
  [`docs/fontes.md`](docs/fontes.md).
- **Todo número confere com a fonte.** Cada indicador diz de onde vem (ERP: módulo, tabela e filtro; planilha: arquivo,
  aba e coluna) e é conferido com um caso real antes de ser dado como pronto.
- **Número financeiro não sai da máquina para ser medido ou classificado** por serviço de terceiros.
