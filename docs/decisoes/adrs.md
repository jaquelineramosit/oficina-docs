# ADRs

## ADR-001 — Dividir a solução por bounded context

**Status:** Aceita

**Contexto.** A solução da Oficina possui domínios com regras diferentes:
cadastro de dados mestres, controle de estoque, ciclo de vida de ordens de
serviço e pagamento externo.

**Decisão.** Dividir em microsserviços por contexto: Cadastro, Estoque,
Ordens de Serviço e Pagamento. A autenticação fica em Lambdas separadas, por
ser responsabilidade da borda.

**Consequências.** Cada contexto evolui modelo e banco de forma
independente. Integrações passam por contratos HTTP ou eventos. A solução
exige mais automação, observabilidade e tratamento de falhas distribuídas.

## ADR-002 — Usar banco exclusivo por microsserviço no mesmo RDS

**Status:** Aceita

**Contexto.** O requisito pede separação de dados por microsserviço, mas a
entrega também precisa controlar custo e complexidade operacional.

**Decisão.** Usar um RDS SQL Server compartilhado como servidor e três
bancos lógicos: `OficinaCadastroDb`, `OficinaEstoqueDb` e
`OficinaOrdensServicoDb`. Cada serviço recebe logins próprios de runtime e
de migration.

**Consequências.** Isolamento de schema e de credencial sem multiplicar
instâncias de RDS. Uma falha no servidor RDS afeta os três serviços .NET.
Não há foreign key física entre contextos; referências externas são
lógicas.

## ADR-003 — Usar DynamoDB para Pagamento

**Status:** Aceita

**Contexto.** O serviço de Pagamento roda em Lambda e precisa salvar o
estado das orders Pix para o polling e para rastreabilidade.

**Decisão.** Usar a tabela DynamoDB `orders`, com chave primária
`order_id`.

**Consequências.** A Lambda não precisa gerenciar pool de conexões SQL. A
persistência escala conforme a demanda e simplifica a operação. Consultas
por status hoje usam varredura; volume maior exigirá um índice secundário
por `status`.

## ADR-004 — Executar os microsserviços .NET em K3s single-node

**Status:** Aceita

**Contexto.** A entrega precisa demonstrar deploy em Kubernetes na AWS, com
custo e operação controlados.

**Decisão.** Executar K3s single-node em uma EC2 privada, atrás de ALB
interno e API Gateway com VPC Link.

**Consequências.** Atende ao modelo Kubernetes, com manifests, Services e
Jobs de migration. Reduz custo e complexidade em relação a um cluster
gerenciado completo. Não entrega alta disponibilidade.

## ADR-005 — Executar Pagamento como Lambda serverless

**Status:** Aceita

**Contexto.** Pagamento é uma carga orientada a filas e a polling, com
chamadas externas ao Mercado Pago e sem necessidade de API HTTP pública
própria.

**Decisão.** Executar `oficina-pagamento` como AWS Lambda em Python 3.12,
acionada por SQS e por EventBridge.

**Consequências.** Escala por volume de mensagens. Reduz custo ocioso.
Separa credenciais e dependências do Mercado Pago do núcleo da OS. Não
segue o mesmo modelo K3s dos serviços .NET, por decisão arquitetural.

## ADR-006 — Usar Saga orquestrada, com o orquestrador embarcado em Ordens de Serviço

**Status:** Aceita

**Contexto.** A aprovação do orçamento envolve pagamento e reserva de
estoque, cada um com seu próprio dado e falhas possíveis. Um dos
participantes precisa manter o estado do processo e decidir os próximos
passos.

**Decisão.** Usar Saga orquestrada. Ordens de Serviço mantém o estado local
em `SagasOrdensServico`, publica comandos explícitos para os demais
participantes e audita cada transição em `SagaSnapshots`.

**Consequências.** Evita transação distribuída. Dá à OS uma fonte única e
auditável do estado do processo, necessária para suporte e relatórios.
Concentra a lógica de coordenação em Ordens, que se torna uma dependência
para o avanço da saga — mitigado por Outbox, Inbox e DLQ.

## ADR-007 — Aplicar Outbox e Inbox na saga Ordens/Estoque

**Status:** Aceita

**Contexto.** Publicar uma mensagem e gravar um dado de negócio são
operações diferentes. Falhas entre essas etapas poderiam perder um evento
ou duplicar um efeito.

**Decisão.** Aplicar Outbox para publicação confiável e Inbox com índice
único por `MessageId` para idempotência.

**Consequências.** Mensagens só saem depois do commit local. Reentrega do
SQS não duplica reserva nem transição de saga. Existem tabelas operacionais
adicionais em Ordens e em Estoque.

## ADR-008 — Usar SQS para integrar Ordens e Pagamento

**Status:** Aceita

**Contexto.** Ordens precisa acionar a criação de um Pix e receber o
resultado, sem se acoplar diretamente ao Mercado Pago.

**Decisão.** Ordens publica solicitações em `sqs-pagamento-solicitar` e
consome resultados de `sqs-pagamento-efetuado` e `sqs-pagamento-recusado`.

**Consequências.** Ordens não conhece os detalhes da Orders API do Mercado
Pago. Pagamento pode reprocessar mensagens com idempotência por
`external_reference`. A integração depende do provisionamento e da
operação contínua do participante de Pagamento.

## ADR-009 — Usar polling do Mercado Pago em vez de webhook

**Status:** Aceita

**Contexto.** Expor um webhook público exige rota, autenticação de
assinatura, proteção contra payload malicioso e tratamento de reentrância.

**Decisão.** Usar EventBridge para acionar o polling periódico da Lambda,
que consulta o status das orders pendentes no Mercado Pago.

**Consequências.** Não há endpoint HTTP público para o provedor externo. A
confirmação do pagamento tem latência até a próxima execução do polling. O
intervalo é controlado por Terraform.

## ADR-010 — Usar Lambda authorizer e login por CPF

**Status:** Aceita

**Contexto.** A API pública precisa autenticar usuários antes de atingir os
microsserviços. O login por CPF depende da tabela de funcionários mantida
pelo Cadastro.

**Decisão.** Usar duas Lambdas: `auth-cpf`, para validar CPF/senha e emitir
o JWT, e `authorizer`, para validar o JWT nas rotas protegidas.

**Consequências.** A autenticação fica na borda. Os serviços recebem
identidade confiável por cabeçalhos. `auth-cpf` acessa `OficinaCadastroDb`
com um login somente leitura dedicado.

## ADR-011 — Provisionar infraestrutura com Terraform e CI/CD independente

**Status:** Aceita

**Contexto.** A solução está distribuída em repositórios independentes e
precisa de provisionamento reprodutível.

**Decisão.** Usar Terraform para infraestrutura e GitHub Actions para
CI/CD por repositório. Imagens e pacotes são gerados por execução de
pipeline.

**Consequências.** Mudanças ficam versionadas e auditáveis. O deploy de
cada serviço executa suas próprias validações. A ordem de provisionamento
precisa respeitar as dependências entre infraestrutura, banco, filas e
aplicações.

## ADR-012 — Preparar observabilidade com OpenTelemetry e New Relic fail-open

**Status:** Aceita

**Contexto.** Falhas distribuídas precisam ser investigáveis por logs,
traces e correlação, mas a telemetria não pode indisponibilizar a
aplicação.

**Decisão.** Instrumentar as APIs com OpenTelemetry, propagar um
`correlationId` e exportar para o New Relic quando configurado. O
exportador deve ser fail-open.

**Consequências.** O New Relic pode ser ativado sem mudar código de
negócio. Falha do endpoint de exportação não derruba requisições. A equipe
ainda precisa configurar licença, painéis e alertas.
