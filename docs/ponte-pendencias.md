# Ponte das pendências do financeiro

A Central chama o portal por HTTPS com `Authorization: Bearer <PENDENCIAS_PONTE_SEGREDO>`. O segredo fica somente no ambiente dos dois processos. As rotas da ponte independem do login de pessoa e recusam `401` sem o segredo. O portal não envia requisições à Central; ela consulta quando puder. O texto, inclusive datas e valores, fica exclusivamente no volume privado.

| Chamada | Corpo / resposta | Uso pela Central |
|---|---|---|
| `PUT /api/pendencias/ponte` | JSON `{ "id": "id-estavel", "titulo": "...", "pedido": "...", "motivo": "...", "status": "aberta" }`; status `aberta` ou `encerrada`. Resposta `{ok, pendencia}`. | Criar ou atualizar pelo mesmo `id`. Não apaga respostas anteriores. Escrever para a equipe em português simples, sem nome interno de sistema. |
| `GET /api/pendencias/ponte/listar` | `{ok, pendencias:[{id,titulo,status,pedido,motivo}]}`. | Ler o estado atual de todas as pendências, inclusive encerradas, sem respostas ou anexos. |
| `GET /api/pendencias/ponte?desde=0` | `{ok, marcador, respostas:[{id,pendenciaId,texto,por,em,marcador,recebidoEm,anexos:[{id,nome,tamanho}]}]}`. | Buscar respostas com marcador maior que `desde`, entregar diretamente ao Gestor e guardar o novo marcador só após processar. `por` é o e-mail do login; `em` é ISO 8601. Repetir a consulta é seguro. |
| `GET /api/pendencias/ponte/anexos/{id}` | Bytes do arquivo, com `Content-Disposition: attachment`. | Baixar cada anexo usando o `id` devolvido na resposta. |
| `POST /api/pendencias/ponte/recebidas` | JSON `{ "id": "id-da-resposta" }`; retorna `{ok,resposta:{id,recebidoEm}}`. | Marcar depois que a resposta e os anexos estiverem salvos pelo Gestor. Repetir não muda a hora do recebimento. |

O portal recebe a resposta da pessoa em `POST /api/pendencias/responder` com formulário multipart: `id` da pendência, `resposta` e até cinco campos `anexos`. Cada arquivo tem até 15 MB. Extensões aceitas: `.xlsx`, `.xls`, `.ods`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.txt`, `.md`, `.zip`. A rota exige sessão de pessoa e origem do próprio portal. Uma pendência encerrada não aceita novas respostas. A Central pode encerrá-la após receber a resposta; enquanto estiver aberta, a equipe pode complementar.
