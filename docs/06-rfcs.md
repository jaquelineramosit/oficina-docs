# Relatorio - RFCs

## RFC-001 - Entrada publica e roteamento

Status: Aceita

### Contexto

A solucao precisa expor uma API publica unica, enquanto os microsservicos .NET
rodam em uma EC2 privada com K3s e nao recebem trafego direto da internet.

### Proposta

Usar API Gateway HTTP API como entrada publica, Lambda authorizer para rotas
protegidas, VPC Link para acessar um ALB interno e roteamento por path para os
servicos no K3s.

### Contrato

| Rota | Destino | Autorizacao |
|---|---|---|
| `POST /api/auth/cpf` | Lambda `auth-cpf` | Anonima |
| `/api/clientes`, `/api/veiculos`, `/api/servicos` | Cadastro | JWT, Funcionario/Admin |
| `/api/pecas`, `/api/insumos`, `/api/estoque` | Estoque | JWT, Funcionario/Admin |
| `/api/ordens-servico`, `/api/orcamentos`, `/api/relatorios` | Ordens | JWT, conforme perfil |
| `/api/orcamentos/acoes-externas/*` | Ordens | Anonima por token de acao |
| `/health/{servico}` | Servico alvo | Anonima |

### Criterios de aceite

- Nao existir rota publica catch-all.
- `/ready`, `/api/internal` e `/api/dev` nao serem publicados.
- ALB ser interno.
- Rotas protegidas receberem identidade somente via authorizer.

## RFC-002 - Identidade confiavel entre borda e microsservicos

Status: Aceita

### Contexto

Os microsservicos precisam autorizar por perfil sem validar diretamente o JWT em
cada API publica.

### Proposta

Validar JWT no Lambda authorizer e mapear claims para cabecalhos confiaveis
injetados pela API Gateway:

- `x-oficina-user-id`
- `x-oficina-user-cpf`
- `x-oficina-user-role`
- `x-oficina-user-name`
- `x-oficina-token-jti`

### Criterios de aceite

- Cabecalhos enviados pelo cliente devem ser sobrescritos nas rotas protegidas.
- Rotas publicas devem remover cabecalhos de identidade enviados pelo cliente.
- Servicos devem materializar os cabecalhos como claims internas.
- Em desenvolvimento, cabecalhos `X-Dev-*` so podem funcionar fora de Production.

## RFC-003 - Criacao da ordem de servico

Status: Aceita

### Contexto

A abertura da OS depende de dados de Cadastro e, quando houver orcamento
inicial, de consulta de materiais e disponibilidade no Estoque.

### Proposta

`POST /api/ordens-servico` deve ser atendido por Ordens, que consulta Cadastro
e Estoque via rotas internas e persiste a OS em `OficinaOrdensServicoDb`.

### Criterios de aceite

- Cliente deve existir.
- Veiculo deve existir e pertencer ao cliente.
- Servicos informados devem existir no Cadastro.
- Materiais devem ser consultados no Estoque.
- A criacao da OS nao inicia pagamento nem reserva.
- A saga inicia apenas na aprovacao do orcamento.

## RFC-004 - Mensageria da saga Ordens/Estoque

Status: Aceita

### Contexto

A aprovacao de orcamento depende de reserva de estoque, mas nao deve haver
transacao distribuida entre bancos.

### Proposta

Usar duas filas SQS FIFO:

| Fila | Produtor | Consumidor | Mensagens |
|---|---|---|---|
| `oficina-estoque-comandos.fifo` | Ordens | Estoque | `ReservarEstoque`, `LiberarReservaEstoque` |
| `oficina-ordens-eventos.fifo` | Estoque | Ordens | `EstoqueReservado`, `ReservaEstoqueRecusada`, `ReservaEstoqueLiberada`, `LiberacaoReservaFalhou` |

Cada mensagem usa envelope com `messageId`, `messageType`, `schemaVersion`,
`correlationId`, `causationId`, `ordemServicoId` e `payload`.

### Criterios de aceite

- `MessageGroupId` deve ser o `ordemServicoId`.
- `MessageDeduplicationId` deve derivar do `messageId`.
- Inbox deve ter indice unico por `MessageId`.
- Outbox deve publicar somente depois do commit local.
- Toda fila principal deve ter DLQ.

## RFC-005 - Integracao com Pagamento Pix

Status: Aceita como arquitetura alvo

### Contexto

O serviço de pagamentos será acionado via fila SQS. Ela integra a
saga sem acoplar Ordens ao Mercado Pago.

### Proposta

Usar um participante serverless de Pagamento:

- Ordens publica solicitacao em `sqs-pagamento-solicitar`.
- Lambda `oficina-pagamento` valida o payload e cria a order Pix no Mercado Pago.
- A order e persistida no DynamoDB `orders`.
- A Lambda publica resultado em `sqs-pagamento-efetuado` ou `sqs-pagamento-recusado`.
- EventBridge aciona polling periodico para consultar orders pendentes.

### Contrato da solicitacao

Campos minimos esperados pela Lambda:

- `external_reference`
- `total_amount`
- `description`
- `payer.email`
- `transactions.payments[].amount`
- `transactions.payments[].payment_method.type`
- `transactions.payments[].payment_method.id`

`type` e `processing_mode` podem ser omitidos e assumem `online` e
`automatic`.

### Contrato de saida

| Status | Fila | Significado |
|---|---|---|
| `efetuado` | `sqs-pagamento-efetuado` | Order Pix criada, QR Code disponivel, pagamento ainda pendente |
| `pago` | `sqs-pagamento-efetuado` | Mercado Pago retornou `processed` |
| `recusado` | `sqs-pagamento-recusado` | Gateway recusou, payload expirou ou Pix nao foi confirmado no prazo |

### Criterios de aceite

- Idempotencia deve derivar de `external_reference`.
- Payload invalido deve ir para DLQ ou registro investigavel.
- Falha transitoria no SQS ou DynamoDB deve permitir reprocessamento.
- `status: efetuado` nao deve ser tratado como pagamento aprovado.
- Apenas `status: pago` deve mover a saga para `PagamentoAprovado`.

## RFC-006 - Isolamento de dados e migrations

Status: Aceita

### Contexto

Cada microsservico precisa ser dono de seus dados e publicar schema sem expor
credenciais privilegiadas ao runtime da API.

### Proposta

Criar um database por microsservico no RDS SQL Server e separar credenciais de
runtime e migration. Executar migrations em Kubernetes Job antes do Deployment.
Pagamento usa DynamoDB gerenciado por Terraform separado.

### Contrato

| Dono | Persistencia | Runtime |
|---|---|---|
| Cadastro | `OficinaCadastroDb` | `cadastro_app` |
| Estoque | `OficinaEstoqueDb` | `estoque_app` |
| Ordens | `OficinaOrdensServicoDb` | `ordens_app` |
| Pagamento | DynamoDB `orders` | Lambda execution role |

### Criterios de aceite

- Runtime SQL nao altera schema.
- Migration nao fica no Deployment da API.
- Login de um servico nao acessa banco de outro.
- Tabela DynamoDB de pagamento e criada pelo repositorio de infra de pagamento.

## RFC-007 - Observabilidade

Status: Proposta aceita para ativacao por configuracao

### Contexto

Falhas distribuidas precisam ser investigaveis por logs, traces, eventos e
estado persistido.

### Proposta

Manter logs estruturados e traces OpenTelemetry nos servicos .NET. Quando
configurado, exportar telemetria para New Relic via OTLP. Para Pagamento, usar
CloudWatch Logs e propagar `external_reference`, `order_id` e correlation id
nas mensagens.

### Criterios de aceite

- Falha do exporter nao pode derrubar a aplicacao.
- Busca por `correlationId` deve reconstruir o fluxo OS -> Pagamento -> Estoque.
- DLQs devem ser monitoradas como falha operacional.
- `SagaSnapshots`, DynamoDB `orders`, Inbox e Outbox devem complementar logs.
