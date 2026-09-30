# Auditoria independente

O comando roda em um processo separado, sem iniciar Next:

```powershell
npm run auditar -- --mes 2026-09 --janela 2
```

Por padrão, o DFC vem de `.cache/dfc-2026`, uma **cópia local** fora do git. `--dfc-dir <pasta local>` seleciona outra cópia. A exceção de leitura da master autorizada pelo dono em 30/09/2026 vale apenas para o auditor: `--master-dir <pasta master>` inventaria os documentos necessários e confronta por SHA-256 os DFCs da master, da cópia auditada e do cache do app. Passe o caminho só no terminal; ele nunca é escrito no repositório. A master é somente leitura e os DFCs usados no cálculo devem ser copiados para `.cache/`. O Omie é consultado diretamente pelas chaves 1 e 2, só com métodos de consulta através de `lib/regras/omie-api.mjs`, sem gravar no cache do dashboard. `--cache-omie` permite ensaiar sem rede; números dependentes dessa opção não recebem o estado “conferido”.

O HTML é `docs/auditoria-AAAA-MM.html`, ignorado pelo git porque contém valores. Ele mostra o valor esperado, o mostrado pela camada de indicadores do app carregada no mesmo processo CLI, a diferença e o estado de cada indicador. “Conferido” exige recálculo independente, fonte disponível, conciliação aplicável e diferença nula. Um indicador sem recálculo independente recebe “não auditável”; a concordância de contagens de uma conferência anterior não substitui a prova de valor. A auditoria não altera planilha, Omie, banco, `.env` ou dashboard.

## Extratos bancários

Crie arquivos em `extratos/`, com nome `AAAA-MM__BANCO--BLOCO.csv` ou `AAAA-MM__BANCO--BLOCO.ofx`. `BANCO` deve ser o texto da coluna `BANCO` da aba `FLUXO DE CAIXA`; `BLOCO` é a ordem do cabeçalho repetido dentro da aba, começando em 1. Assim duas contas com o mesmo rótulo bancário continuam separadas. O nome é comparado após normalização de acentos e maiúsculas. Pode haver subpastas. O mês no nome precisa corresponder ao das transações.

CSV em UTF-8, separador `;` ou `,`, cabeçalho `data;valor;saldo;id` (a coluna `id` é opcional). `data` é `AAAA-MM-DD`; `valor` é movimento assinado, negativo para saída e positivo para entrada, com até duas casas decimais e sem separador de milhar. `saldo` é o saldo da conta após a transação. As linhas devem estar em ordem cronológica. Cabeçalho do arquivo:

```csv
data;valor;saldo;id
```

OFX deve conter blocos `<STMTTRN>` com `<DTPOSTED>`, `<TRNAMT>` e, de preferência, `<FITID>`, além de `<LEDGERBAL><BALAMT>` para o saldo final. Se a conta não teve movimento no mês, um OFX com `<LEDGERBAL><BALAMT>` e `<DTASOF>` do mês ou um CSV com uma linha de `valor` zero e o saldo final documenta a conta parada. O identificador da conta é dado pelo nome do arquivo. Guarde **todas** as contas e meses desejados em `extratos/`; a pasta é ignorada pelo git. A conciliação conta multiplicidades por conta, data e valor e compara a abertura e o fechamento da conta com a posição reconstruída do DFC. Sem extrato de cada conta usada pelo DFC, o caixa sai “não auditável: faltam extratos”. Uma diferença de conciliação também impede o veredito “conferido”.

## Achados da execução de 30/09/2026

A master é a fonte documental definida pelo dono; as pastas soltas com sufixo numérico são cópias e não entram na auditoria. A cópia local de agosto do app confere por SHA-256 com a master; a de setembro diverge em 723 células, além do hash. A auditoria usa cópias isoladas de agosto e setembro em `.cache/auditoria-dfc-2026`. Nos ramos de extratos B3W e B3N, agosto e setembro não têm OFX/CSV; há PDFs em agosto e PDFs de B3N em setembro. Os PDFs ainda não foram conciliados por conta, movimento e saldo, portanto os indicadores de caixa não têm prova bancária completa. O fiscal e o fechamento contábil de B3W chegam a agosto, sem setembro. O relatório fiscal de agosto foi lido: 105 registros, sendo 89 faturados e 15 cancelados. A pasta contábil de agosto contém dois PDFs; o relatório de faturamento termina em agosto. As pastas de CPA e C.R. de setembro também não constam dos ramos anuais examinados. B3W, B3N, N3 e 3N pertencem ao mesmo CNPJ e a conciliação precisa cobrir os movimentos misturados. A pasta intitulada “08 - OUTUBRO” ao lado de “08 - AGOSTO” é erro de nome: foi registrada e não usada.

Na leitura direta de 30/09, a resposta do Omie trouxe registros de setembro ausentes do cache do app, cuja última gravação foi em 29/09. O título `6057242415` da empresa 1 é um caso verificável: a repetição da **mesma consulta** do cache para 26/09 a 31/12 o retornou, enquanto a página cacheada não o contém. Isso demonstra desatualização do cache para esse caso, sem depender da diferença entre filtro mensal e anual. O HTML mostra as contagens atuais, antigas e os campos alterados sem publicar valores nem nomes.

## O que é verificado

O auditor inventaria arquivos e abas da janela, assinala arquivos faltantes, verifica possíveis duplicidades e usa datas de pagamento ou vencimento conforme a coluna preenchida. O DRE atual é gerencial em regime de caixa: a página distingue esse resultado da posição bancária e só fecha a ponte quando os componentes podem ser refeitos. Cada linha recalculada mostra o primeiro número de linha do DFC ou o código de título do Omie para retorno ao documento bruto. Indicadores cujo cálculo independente ainda não foi implementado são declarados “não auditáveis” com motivo, nunca aprovados pelo fato de aparecerem no dashboard.
