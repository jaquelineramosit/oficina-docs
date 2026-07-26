# Relatorio - ADRs

## ADR-001 - Dividir a solucao por bounded context

Status: Aceita

### Contexto

A solucao da oficina possui dominios com regras diferentes: cadastro de dados
mestres, controle de estoque, ciclo de vida de ordens de servico e pagamento
externo.

### Decisao

Dividir em microsservicos/contextos:

- Cadastro
- Estoque
- Ordens de Servico
- Pagamento

Autenticacao fica em Lambdas separadas por ser responsabilidade da borda.

### Consequencias

- Cada contexto evolui modelo e banco.
- Integracoes passam por contratos HTTP ou eventos.
- A solucao exige mais automacao, observabilidade e tratamento de falhas
  distribuidas.

## ADR-002 - Usar database exclusivo por microsservico no mesmo RDS

Status: Aceita

### Contexto

O requisito pede separacao de dados por microsservico, mas a entrega tambem
precisa controlar custo e complexidade operacional.

### Decisao

Usar um RDS SQL Server compartilhado como servidor e tres databases logicos:

- `OficinaCadastroDb`
- `OficinaEstoqueDb`
- `OficinaOrdensServicoDb`

Cada servico recebe logins proprios de runtime e migration.

### Consequencias

- Isolamento de schema e credencial sem multiplicar instancias RDS.
- Falha do servidor RDS afeta os tres servicos .NET.
- Nao ha foreign key fisica entre contextos; referencias externas sao logicas.

## ADR-003 - Usar DynamoDB para Pagamento

Status: Aceita

### Contexto

O servico de Pagamento roda em Lambda, e precisa salvar estado de orders Pix
para polling e rastreabilidade.

### Decisao

Usar DynamoDB `orders`, com chave primaria `order_id`.

### Consequencias

- A Lambda nao precisa gerenciar pool de conexoes SQL.
- A persistencia escala conforme demanda e simplifica operacao.
- Consultas por status hoje usam `scan`; volume maior exigira GSI por `status`.

## ADR-004 - Executar microsservicos .NET em K3s single-node

Status: Aceita

### Contexto

A entrega precisa demonstrar deploy em Kubernetes na AWS, com custo e operacao
controlados.

### Decisao

Executar K3s single-node em uma EC2 privada, atras de ALB interno e API Gateway
VPC Link.

### Consequencias

- Atende o modelo Kubernetes com manifests, Services e Migration Jobs.
- Reduz custo e complexidade em relacao a cluster gerenciado completo.
- Nao entrega alta disponibilidade.

## ADR-005 - Executar Pagamento como Lambda serverless

Status: Aceita

### Contexto

Pagamento e uma carga orientada a filas e polling, com chamadas externas ao
Mercado Pago e sem necessidade de API HTTP publica propria.

### Decisao

Executar `oficina-pagamento` como AWS Lambda Python 3.12, acionada por SQS e
EventBridge.

### Consequencias

- Escala por volume de mensagens.
- Reduz custo ocioso.
- Separa credenciais e dependencias do Mercado Pago do core da OS.
- Nao atende ao mesmo modelo K3s dos servicos .NET, por decisao arquitetural.

## ADR-006 - Usar Saga coreografada com estado local em Ordens

Status: Aceita

### Contexto

A aprovacao de orcamento envolve pagamento e reserva de estoque, cada um com
seu proprio dado e falhas possiveis.

### Decisao

Usar Saga coreografada por eventos. Ordens mantem o estado local em
`SagasOrdensServico` e audita transicoes em `SagaSnapshots`.

### Consequencias

- Evita transacao distribuida.
- Tolera reentrega, atraso e indisponibilidade temporaria.
- Introduz consistencia eventual e necessidade de tratar DLQs.

## ADR-007 - Aplicar Outbox e Inbox na saga Ordens/Estoque

Status: Aceita

### Contexto

Publicar mensagem e gravar dado de negocio sao operacoes diferentes. Falhas
entre essas etapas poderiam perder evento ou duplicar efeito.

### Decisao

Aplicar Outbox para publicacao confiavel e Inbox com indice unico por
`MessageId` para idempotencia.

### Consequencias

- Mensagens so saem apos commit local.
- Reentrega de SQS nao duplica reserva nem transicao de saga.
- Existem tabelas operacionais adicionais em Ordens e Estoque.

## ADR-008 - Usar SQS para integrar Ordens e Pagamento

Status: Aceita como arquitetura alvo

### Contexto

O projeto base possui pagamento mock em Ordens, mas a implementacao real de
pagamento esta em repositorio separado e nao deve acoplar Ordens ao Mercado
Pago.

### Decisao

Ordens publica solicitacoes em `sqs-pagamento-solicitar` e consome resultados
de `sqs-pagamento-efetuado` e `sqs-pagamento-recusado`.

### Consequencias

- Ordens nao conhece detalhes da Orders API.
- Pagamento pode reprocessar mensagens com idempotencia por
  `external_reference`.
- A integracao final requer substituir o gateway mock de Ordens por um adapter
  SQS de pagamento.

## ADR-009 - Usar polling do Mercado Pago em vez de webhook

Status: Aceita

### Contexto

Expor webhook publico exige rota, autenticacao de assinatura, protecao contra
payload malicioso e tratamento de reentrancia.

### Decisao

Usar EventBridge para acionar polling periodico da Lambda, que consulta
`GET /v1/orders/{id}` para orders pendentes.

### Consequencias

- Nao ha endpoint HTTP publico para o provider externo.
- A confirmacao de pagamento tem latencia ate a proxima execucao do polling.
- O intervalo e controlado por Terraform (`poll_schedule_expression`).

## ADR-010 - Usar Lambda authorizer e login por CPF

Status: Aceita

### Contexto

A API publica precisa autenticar usuarios antes de atingir os microsservicos.
O login por CPF depende da tabela de funcionarios mantida pelo Cadastro.

### Decisao

Usar duas Lambdas:

- `auth-cpf`, para validar CPF/senha e emitir JWT;
- `authorizer`, para validar JWT nas rotas protegidas.

### Consequencias

- Autenticacao fica na borda.
- Os servicos recebem identidade confiavel por cabecalhos.
- `auth-cpf` acessa `OficinaCadastroDb` com login somente leitura dedicado.

## ADR-011 - Provisionar infraestrutura com Terraform e CI/CD independente

Status: Aceita

### Contexto

A solucao esta distribuida em repositorios independentes e precisa de
provisionamento reprodutivel.

### Decisao

Usar Terraform para infraestrutura e GitHub Actions para CI/CD por repositorio.
Imagens e pacotes devem ser gerados por commit/execucao de pipeline.

### Consequencias

- Mudancas ficam versionadas e auditaveis.
- Deploy de cada servico executa validacoes proprias.
- A ordem de provisionamento precisa respeitar dependencias entre infra,
  banco, filas e aplicacoes.

## ADR-012 - Preparar observabilidade com OpenTelemetry e New Relic fail-open

Status: Aceita

### Contexto

Falhas distribuidas precisam ser investigaveis por logs, traces e correlacao,
mas telemetria nao pode indisponibilizar a aplicacao.

### Decisao

Instrumentar APIs com OpenTelemetry, propagar `correlationId` e exportar para
New Relic quando configurado. O exporter deve ser fail-open. Lambda de
Pagamento deve registrar logs no CloudWatch com `external_reference` e
`order_id`.

### Consequencias

- New Relic pode ser ativado sem mudar codigo de negocio.
- Falha de endpoint OTLP nao derruba requests.
- A equipe ainda precisa configurar licenca, endpoint, paineis e alertas.
