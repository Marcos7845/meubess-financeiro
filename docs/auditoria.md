# Auditoria independente

O comando roda em um processo separado, sem iniciar Next:

```powershell
npm run auditar -- --mes 2026-08 --janela 1
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

### Referência fechada: agosto de 2026

Agosto é o mês de referência decidido pelo dono em 30/09. Setembro só será auditado após o fechamento; a ausência de extratos, fiscal e comprovantes de setembro é esperada. O comando agora abre agosto por padrão.

Na execução desta frente, a instrução mais recente proibiu buscar ou ler em pastas sincronizadas. Por isso o auditor usou `.cache/auditoria-dfc-2026`, uma cópia local que a passagem anterior já havia comparado por SHA-256 com o DFC B3W da master. A identidade dessa cópia com a master **não foi reconferida nesta execução**. Também não foram lidos os PDFs bancários, fiscal, contábil, comprovantes CPA/C.R. ou o DFC separado de N3 da master. Não se deve interpretar a falta deles no HTML como falta dos documentos na master.

O HTML de agosto foi gerado com consulta direta ao Omie, sem gravar no cache do app. São 45 indicadores: 7 conferidos, 1 divergente (`Valor recebido`) e 37 não auditáveis. Os sete conferidos são da carteira de títulos a receber: três cartões (`Valor previsto`, `Valor pendente`, `Valor vencido`), a lista e três agrupamentos; o confronto usa resposta atual e recálculo independente, sem confundir as possíveis duplicidades da leitura de movimentos com os títulos. Os indicadores de caixa continuam sem prova bancária porque faltam extratos locais para as três contas que o DFC aponta (`ITAU--1`, `STONE--2`, `ITAU--4`); a leitura de movimentos tem identificadores repetidos e nove indicadores ainda não possuem recálculo independente. Quatro das treze séries pendentes agora são refeitas a partir das linhas cruas: Top 10 despesas (por classe), lançamentos por status, lançamentos por mês e status (coluna de agosto) e valor previsto por cliente e status (por empresa e código). O próprio HTML dá o motivo por linha.

As diferenças entre resposta atual e cache ficam em dois grupos comprovados pela repetição **dos mesmos parâmetros**: cache envelhecido — título `2|5287286827`, cujos campos `pago` e `aberto` mudaram na resposta atual, além do título `6057242415` já provado na passagem anterior; e diferença de janela mensal × anual — movimento `2|5281467897`, cujos campos comparados coincidem quando a consulta anual é repetida. Há 25 identificadores repetidos na resposta mensal de **movimentos** e nenhum na de **títulos**. Os movimentos repetidos continuam suspeitos de duplicidade e pedem exame por grupo antes de serem usados como prova de valor; o auditor não os atribuiu automaticamente ao cache.

O DFC B3W local de agosto já contém 11 linhas baixadas com `EMP.=N3`, e a tela soma essas linhas sem filtrar `EMP.`. O caso documentado em `docs/fontes.md` é a linha 169 de 17/08/2026, ligada ao título `6039461776` da empresa 1. Sem ler o DFC separado de N3 da master e comparar os lançamentos, não é possível afirmar se ele já está integralmente incorporado ou se traz lançamentos adicionais. A soma da tela não foi alterada.

O cache do Omie já era acionado na abertura ou renovação da base. A correção desta frente separa a idade de uma volta **completa** da hora da última tentativa: uma volta parcial ou falha não renova a idade do cache inteiro, e uma nova tentativa é permitida após 15 minutos. Uma volta completa vale por uma hora; a próxima leitura dispara a atualização. A releitura segue em segundo plano, pelos mesmos métodos de consulta e com a pausa existente entre chamadas, sem cron ou serviço. `npm run testar-cache-omie` cobre cache recente, vencido, parcial e atualização forçada.

### Passagem exploratória anterior: setembro ainda aberto

A master é a fonte documental definida pelo dono; as pastas soltas com sufixo numérico são cópias e não entram na auditoria. A cópia local de agosto do app confere por SHA-256 com a master; a de setembro diverge em 723 células, além do hash. A auditoria usa cópias isoladas de agosto e setembro em `.cache/auditoria-dfc-2026`. Nos ramos de extratos B3W e B3N, agosto e setembro não têm OFX/CSV; há PDFs em agosto e PDFs de B3N em setembro. Os PDFs ainda não foram conciliados por conta, movimento e saldo, portanto os indicadores de caixa não têm prova bancária completa. O fiscal e o fechamento contábil de B3W chegam a agosto, sem setembro. O relatório fiscal de agosto foi lido: 105 registros, sendo 89 faturados e 15 cancelados. A pasta contábil de agosto contém dois PDFs; o relatório de faturamento termina em agosto. As pastas de CPA e C.R. de setembro também não constam dos ramos anuais examinados. B3W, B3N, N3 e 3N pertencem ao mesmo CNPJ e a conciliação precisa cobrir os movimentos misturados. A pasta intitulada “08 - OUTUBRO” ao lado de “08 - AGOSTO” é erro de nome: foi registrada e não usada.

Na leitura direta de 30/09, a resposta do Omie trouxe registros de setembro ausentes do cache do app, cuja última gravação foi em 29/09. O título `6057242415` da empresa 1 é um caso verificável: a repetição da **mesma consulta** do cache para 26/09 a 31/12 o retornou, enquanto a página cacheada não o contém. Isso demonstra desatualização do cache para esse caso, sem depender da diferença entre filtro mensal e anual. O HTML mostra as contagens atuais, antigas e os campos alterados sem publicar valores nem nomes.

## O que é verificado

O auditor inventaria arquivos e abas da janela, assinala arquivos faltantes, verifica possíveis duplicidades e usa datas de pagamento ou vencimento conforme a coluna preenchida. O DRE atual é gerencial em regime de caixa: a página distingue esse resultado da posição bancária e só fecha a ponte quando os componentes podem ser refeitos. Cada linha recalculada mostra o primeiro número de linha do DFC ou o código de título do Omie para retorno ao documento bruto. Indicadores cujo cálculo independente ainda não foi implementado são declarados “não auditáveis” com motivo, nunca aprovados pelo fato de aparecerem no dashboard.
