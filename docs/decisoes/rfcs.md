# RFCs

| Proposta | Assunto | Status |
|---|---|---|
| [RFC-001](#rfc-001) | Entrada pública e roteamento | Aceita |
| [RFC-002](#rfc-002) | Identidade confiável entre borda e microsserviços | Aceita |
| [RFC-003](#rfc-003) | Criação da ordem de serviço | Aceita |
| [RFC-004](#rfc-004) | Mensageria da saga Ordens/Estoque | Aceita |
| [RFC-005](#rfc-005) | Integração com Pagamento Pix | Aceita |
| [RFC-006](#rfc-006) | Isolamento de dados e migrations | Aceita |
| [RFC-007](#rfc-007) | Observabilidade | Proposta aceita, para ativação por configuração |

## RFC-001 — Entrada pública e roteamento { #rfc-001 }

**Status:** Aceita

**Contexto.** A solução precisa expor uma API pública única, enquanto os
microsserviços .NET rodam em uma EC2 privada com K3s e não recebem tráfego
direto da internet.

**Proposta.** Usar API Gateway HTTP API como entrada pública, Lambda
authorizer para rotas protegidas, VPC Link para acessar um ALB interno e
roteamento por path para os serviços no K3s.

**Contrato**

| Rota | Destino | Autorização |
|---|---|---|
| `POST /api/auth/cpf` | Lambda `auth-cpf` | Anônima |
| `/api/clientes`, `/api/veiculos`, `/api/servicos`, `/api/admin/funcionarios` | Cadastro | JWT, Funcionário/Admin |
| `/api/pecas`, `/api/insumos`, `/api/estoque` | Estoque | JWT, Funcionário/Admin |
| `/api/ordens-servico`, `/api/orcamentos`, `/api/relatorios` | Ordens | JWT, conforme perfil |
| `/api/orcamentos/acoes-externas/*` | Ordens | Anônima, por token de ação |
| `/health/{servico}` | Serviço alvo | Anônima |

**Critérios de aceite**

- Não existe rota pública "catch-all".
- Rotas internas e de desenvolvimento não são publicadas.
- O ALB é interno.
- Rotas protegidas recebem identidade somente via authorizer.

## RFC-002 — Identidade confiável entre borda e microsserviços { #rfc-002 }

**Status:** Aceita

**Contexto.** Os microsserviços precisam autorizar por perfil sem validar
diretamente o JWT em cada API pública.

**Proposta.** Validar o JWT no Lambda authorizer e mapear as claims para
cabeçalhos confiáveis, injetados pelo API Gateway: identificador do usuário,
CPF, perfil, nome e identificador do token.

**Critérios de aceite**

- Cabeçalhos enviados pelo cliente são sobrescritos nas rotas protegidas.
- Rotas públicas removem cabeçalhos de identidade enviados pelo cliente.
- Os serviços materializam os cabeçalhos como claims internas.

## RFC-003 — Criação da ordem de serviço { #rfc-003 }

**Status:** Aceita

**Contexto.** A abertura da OS depende de dados do Cadastro e, quando há
orçamento inicial, de consulta de materiais e disponibilidade no Estoque.

**Proposta.** `POST /api/ordens-servico` é atendido por Ordens, que
consulta Cadastro e Estoque via rotas internas e persiste a OS em
`OficinaOrdensServicoDb`.

**Critérios de aceite**

- O cliente deve existir.
- O veículo deve existir e pertencer ao cliente.
- Os serviços informados devem existir no Cadastro.
- Os materiais devem ser consultados no Estoque.
- A criação da OS não inicia pagamento nem reserva.
- A saga inicia apenas na aprovação do orçamento.

## RFC-004 — Mensageria da saga Ordens/Estoque { #rfc-004 }

**Status:** Aceita

**Contexto.** A aprovação do orçamento depende da reserva de estoque, mas
não deve haver transação distribuída entre bancos.

**Proposta.** Usar duas filas SQS FIFO:

| Fila | Produtor | Consumidor | Mensagens |
|---|---|---|---|
| `oficina-estoque-comandos.fifo` | Ordens | Estoque | `ReservarEstoque`, `LiberarReservaEstoque` |
| `oficina-ordens-eventos.fifo` | Estoque | Ordens | `EstoqueReservado`, `ReservaEstoqueRecusada`, `ReservaEstoqueLiberada`, `LiberacaoReservaFalhou` |

Cada mensagem usa um envelope com `messageId`, `messageType`,
`schemaVersion`, `correlationId`, `causationId`, `ordemServicoId` e
`payload`.

**Critérios de aceite**

- `MessageGroupId` é o `ordemServicoId`.
- `MessageDeduplicationId` deriva do `messageId`.
- O Inbox tem índice único por `MessageId`.
- O Outbox publica somente depois do commit local.
- Toda fila principal tem uma DLQ.

## RFC-005 — Integração com Pagamento Pix { #rfc-005 }

**Status:** Aceita

**Contexto.** O serviço de Pagamento é acionado via fila SQS. Ele integra
a saga sem acoplar Ordens ao Mercado Pago.

**Proposta.** Usar um participante de Pagamento:

- Ordens publica a solicitação em `sqs-pagamento-solicitar`.
- A Lambda `oficina-pagamento` valida o payload e cria a order Pix no
  Mercado Pago.
- A order é persistida no DynamoDB `orders`.
- A Lambda publica o resultado em `sqs-pagamento-efetuado` ou
  `sqs-pagamento-recusado`.
- O EventBridge aciona o polling periódico para consultar orders
  pendentes.

**Contrato da solicitação**

Campos mínimos esperados pela Lambda: `external_reference`, `total_amount`,
`description`, `payer.email`, `transactions.payments[].amount` e
`transactions.payments[].payment_method` (`type` e `id`). O tipo da order e
o modo de processamento podem ser omitidos e assumem os valores padrão
usados pelo fluxo de Pix.

**Contrato de saída**

| Status | Fila | Significado |
|---|---|---|
| `efetuado` | `sqs-pagamento-efetuado` | Order Pix criada, QR Code disponível, pagamento ainda pendente |
| `pago` | `sqs-pagamento-efetuado` | Mercado Pago confirmou o processamento |
| `recusado` | `sqs-pagamento-recusado` | Gateway recusou, payload inválido ou Pix não confirmado no prazo |

**Critérios de aceite**

- A idempotência deriva de `external_reference`.
- Payload inválido vai para DLQ ou registro investigável.
- Falha transitória em SQS ou DynamoDB permite reprocessamento.
- O status `efetuado` não é tratado como pagamento aprovado.
- Apenas o status `pago` move a saga para `PagamentoAprovado`.

!!! info "Alcance do status Aceita"

    O status **Aceita** representa a aprovação da proposta arquitetural, dos
    contratos e do fluxo definido — não é comprovação de implantação ou de
    validação completa junto ao provedor externo.

## RFC-006 — Isolamento de dados e migrations { #rfc-006 }

**Status:** Aceita

**Contexto.** Cada microsserviço precisa ser dono de seus dados e publicar
schema sem expor credenciais privilegiadas ao runtime da API.

**Proposta.** Criar um banco por microsserviço no RDS SQL Server, com
credenciais separadas de runtime e de migration. Executar migrations em um
Job do Kubernetes antes do Deployment. Pagamento usa DynamoDB, gerenciado
por Terraform separado.

**Contrato**

| Dono | Persistência |
|---|---|
| Cadastro | `OficinaCadastroDb` |
| Estoque | `OficinaEstoqueDb` |
| Ordens | `OficinaOrdensServicoDb` |
| Pagamento | DynamoDB `orders` |

**Critérios de aceite**

- O runtime SQL não altera schema.
- A migration não fica no Deployment da API.
- O login de um serviço não acessa o banco de outro.
- A tabela DynamoDB de pagamento é criada pelo repositório de infraestrutura
  de pagamento.

## RFC-007 — Observabilidade { #rfc-007 }

**Status:** Proposta aceita, para ativação por configuração

**Contexto.** Falhas distribuídas precisam ser investigáveis por logs,
traces, eventos e estado persistido.

**Proposta.** Manter logs estruturados e traces OpenTelemetry nos serviços
.NET. Quando configurado, exportar telemetria para New Relic via OTLP.
Propagar `correlationId`, `external_reference` e `order_id` nas mensagens
de pagamento.

**Critérios de aceite**

- Falha do exportador não derruba a aplicação.
- A busca por `correlationId` reconstrói o fluxo OS → Pagamento → Estoque.
- DLQs são monitoradas como falha operacional.
- `SagaSnapshots`, DynamoDB `orders`, Inbox e Outbox complementam os logs.
