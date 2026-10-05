# Ponte das pendências do financeiro

A Central chama o portal por HTTPS com `Authorization: Bearer <PENDENCIAS_PONTE_SEGREDO>`. O segredo fica somente no ambiente dos dois processos. As rotas da ponte independem do login de pessoa e recusam `401` sem o segredo. O portal não envia requisições à Central; ela consulta quando puder. O texto, inclusive datas e valores, fica exclusivamente no volume privado.

| Chamada | Corpo / resposta | Uso pela Central |
|---|---|---|
| `PUT /api/pendencias/ponte` | JSON `{ "id": "id-estavel", "titulo": "...", "pedido": "...", "motivo": "...", "status": "aberta" }`; status `aberta` ou `encerrada`. Resposta `{ok, pendencia}`. | Criar ou atualizar pelo mesmo `id`. Não apaga respostas anteriores. Escrever para a equipe em português simples, sem nome interno de sistema. |
| `GET /api/pendencias/ponte/listar` | `{ok, pendencias:[{id,titulo,status,pedido,motivo}]}`. | Ler o estado atual de todas as pendências, inclusive encerradas, sem respostas ou anexos. |
| `GET /api/pendencias/ponte?desde=0` | `{ok, marcador, respostas:[{id,pendenciaId,texto,por,em,marcador,recebidoEm,anexos:[{id,nome,tamanho}]}]}`. | Buscar respostas com marcador maior que `desde`, entregar diretamente ao Gestor e guardar o novo marcador só após processar. `por` é o e-mail do login; `em` é ISO 8601. Repetir a consulta é seguro. |
| `GET /api/pendencias/ponte/anexos/{id}` | Bytes do arquivo, com `Content-Disposition: attachment`. | Baixar cada anexo usando o `id` devolvido na resposta. |
| `POST /api/pendencias/ponte/recebidas` | JSON `{ "id": "id-da-resposta" }`; retorna `{ok,resposta:{id,recebidoEm}}`. | Marcar depois que a resposta e os anexos estiverem salvos pelo Gestor. Repetir não muda a hora do recebimento. |
| `GET /api/pendencias/ponte/telas?ano=&mes=&unidade=` | `{ok, ano, mes, unidade, mesPadrao, telas:[{tela, rota, ano, mes, dfc:{ok,arquivo,unidadesFaltantes}, leituras, cartoes:[{id,nome,tipo,negativo,valor,fonte,fontes,contagem:{dfc,omie}}]}]}`; sem `ano`/`mes`, o mês que as telas abrem sozinhas. Valores em centavos. | Provar, sem navegador, o mês e os cartões das três telas, calculados pelas mesmas funções das páginas (`lib/indicadores/telas-no-ar.mjs`). Só leitura. Do lado do PC: `npm run conferir-no-ar -- <ano> <mes>`, que imprime no terminal e não grava arquivo. |

O portal recebe a resposta da pessoa em `POST /api/pendencias/responder` com formulário multipart: `id` da pendência, `resposta` e até cinco campos `anexos`. Cada arquivo tem até 15 MB. Extensões aceitas: `.xlsx`, `.xls`, `.ods`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.txt`, `.md`, `.zip`. A rota exige sessão de pessoa e origem do próprio portal. Uma pendência encerrada não aceita novas respostas. A Central pode encerrá-la após receber a resposta; enquanto estiver aberta, a equipe pode complementar.

## Do lado do PC

`scripts/pendencias-ponte.mjs` chama a ponte deste PC, nos moldes de `scripts/financeiro-enviar-dfc.mjs`: o endereço vem de `MEUBESS_SERVIDOR_URL` e o segredo de `PENDENCIAS_PONTE_SEGREDO`, do ambiente ou do `.env`. O segredo vai só no cabeçalho e nunca é impresso. O endereço tem de ser https (http só para `127.0.0.1` e `localhost`). Não está agendado.

```
node scripts/pendencias-ponte.mjs estado
node scripts/pendencias-ponte.mjs publicar docs/pendencias/stone-agosto-2026.json
node scripts/pendencias-ponte.mjs publicar --id um-id --titulo "..." --pedido "..." --motivo "..." [--status encerrada]
node scripts/pendencias-ponte.mjs buscar
```

- `estado` sonda `GET /api/pendencias/ponte` e diz se a ponte responde. `404` quer dizer que o portal publicado ainda não tem a ponte. `401` quer dizer que o segredo está ausente ou é diferente: sem o segredo deste lado, a sonda vai sem cabeçalho e só prova que a rota existe. Código de saída: 0 responde, 5 para 404, 6 para 401, 3 sem rede, 4 outra recusa.
- `publicar` cria ou atualiza pelo `id` estável, a partir de um JSON em `docs/pendencias/` ou dos argumentos, que valem por cima do JSON. O texto vai em português simples, sem nome interno de sistema e sem valores em reais (o JSON é versionado).
- `buscar` lê o marcador guardado, traz as respostas novas e, uma por vez na ordem do marcador, grava `resposta.txt` e os anexos, marca a resposta como recebida e só então avança o marcador. A pasta é `PENDENCIAS_PASTA` ou, sem ela, `.cache/pendencias-recebidas` (fora do git), com uma subpasta por pendência e por resposta. Se algo falhar no meio, a próxima busca recomeça da primeira resposta que não foi guardada. O terminal mostra só contagens e o caminho, porque a resposta pode trazer valores.
- Teste sem rede, com servidor falso em memória: `scripts/pendencias-ponte.test.mjs`, que roda no `npm test`.
- Se faltar o segredo, `estado` sai com 401. O dono gera um segredo longo e põe o mesmo valor em `PENDENCIAS_PONTE_SEGREDO` nos dois lados: no `.env` deste PC e nas variáveis do serviço no Railway. Depois de mudar a variável no Railway, o serviço precisa reiniciar para ler o novo valor.
