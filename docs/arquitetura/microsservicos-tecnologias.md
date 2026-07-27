# Microsserviços e tecnologias

## Divisão dos microsserviços

A solução foi dividida por **contextos de negócio**, não por camadas
técnicas. Cada microsserviço possui modelo, persistência, testes e pipeline
próprios. A comunicação entre contextos acontece por HTTP ou por eventos,
sem acesso direto ao banco de outro serviço.

## Responsabilidades por serviço

| Microsserviço | Responsabilidade | Banco | Comunicação |
|---|---|---|---|
| Cadastro | Clientes, veículos, funcionários e catálogo de serviços | `OficinaCadastroDb` | API pública protegida e rotas internas |
| Estoque | Peças, insumos, saldos, movimentações e reservas | `OficinaEstoqueDb` | API pública protegida, rotas internas e SQS FIFO |
| Ordens de Serviço | OS, diagnóstico, orçamentos, aprovação, saga e relatórios | `OficinaOrdensServicoDb` | API pública protegida, HTTP interno, SQS FIFO e SQS de pagamento |
| Pagamento | Criação e acompanhamento de Pix no Mercado Pago | DynamoDB `orders` | SQS, EventBridge e HTTPS externo |
| Auth Lambda | Login por CPF e authorizer JWT | Leitura controlada em `OficinaCadastroDb` | Lambda proxy e authorizer |

## Justificativa da divisão

### Cadastro

Concentra dados mestres e identidade operacional: cliente e documento,
veículo e vínculo com cliente, funcionário com perfil e hash de senha, e o
catálogo de serviços com sua receita de materiais. É separado porque essas
informações são consultadas por outros fluxos, mas a consistência pertence
ao Cadastro — Ordens guarda apenas snapshots, para preservar histórico sem se
tornar dono desses dados.

### Estoque

Separado porque saldo e reserva têm concorrência, idempotência e auditoria
próprias: ajuste de saldo, movimentação append-only, reserva e liberação de
material, e resposta assíncrona aos comandos da saga. Mantê-lo fora de
Ordens evita misturar o ciclo de vida da OS com a regra de saldo.

### Ordens de Serviço

É o processo central: abertura da OS, classificação preventiva/corretiva,
diagnóstico, criação e aprovação de orçamento, transição para execução,
finalização e entrega, além da coordenação da saga. Consulta Cadastro e
Estoque, mas persiste apenas seu próprio histórico e o estado da saga.

### Pagamento

Separado porque sua carga é orientada a filas e a um provedor externo:
recebe a solicitação de criação do Pix, integra com o Mercado Pago, persiste
o estado da order e publica o resultado. Essa divisão isola as credenciais do
provedor, simplifica a escalabilidade e evita expor webhook público.

### Auth Lambda

A autenticação fica fora dos pods para proteger a borda: `auth-cpf` emite o
token antes de qualquer acesso protegido, e `authorizer` valida o JWT no API
Gateway. Os demais serviços recebem a identidade já validada, por cabeçalhos
confiáveis.

## Tecnologias utilizadas

| Tecnologia | Uso | Justificativa |
|---|---|---|
| .NET 10 / ASP.NET Core | APIs de Cadastro, Estoque e Ordens | Plataforma única para domínio, APIs e testes |
| Clean Architecture | Organização das APIs .NET | Separa domínio, aplicação, infraestrutura e transporte |
| Entity Framework Core | Persistência SQL e migrations | Mapeamento relacional e versionamento de schema |
| SQL Server em RDS | Banco transacional | ACID, constraints, índices e controle de concorrência |
| Banco por microsserviço | Isolamento lógico | Evita acoplamento por schema e credencial |
| Python 3.12 | Lambda de Pagamento | Runtime leve para integração serverless |
| Arquitetura hexagonal | Pagamento | Isola o domínio de AWS, HTTP e Mercado Pago |
| AWS Lambda | Auth, authorizer e Pagamento | Execução sob demanda, sem servidor gerenciado |
| AWS SQS FIFO | Saga Ordens/Estoque | Ordem por OS, DLQ e retentativas |
| AWS SQS padrão | Pagamento | Entrada/saída assíncrona para solicitação e resultado |
| AWS EventBridge | Polling de pagamento | Agenda a consulta de orders pendentes |
| DynamoDB | Estado de orders Pix | Banco serverless simples, por chave `order_id` |
| Mercado Pago Orders API | Provedor Pix | Criação e consulta de pagamento Pix |
| API Gateway HTTP API | Borda pública | Autorização central e VPC Link |
| ALB interno | Roteamento privado | Roteamento por path para os serviços em K3s |
| K3s em EC2 privada | Runtime dos serviços .NET | Kubernetes de baixo custo e operação simples |
| Docker | Empacotamento | Imagens imutáveis por commit |
| Terraform | Infraestrutura como código | Provisionamento reprodutível e versionado |
| GitHub Actions | CI/CD | Testes, qualidade, empacotamento e deploy |
| OpenTelemetry | Traces | Padrão aberto de telemetria |
| New Relic | Observabilidade | Centralização de traces e métricas |

## Decisões relacionadas

| Decisão | Motivo |
|---|---|
| Separar Cadastro, Estoque, Ordens e Pagamento | Contextos com regras e ritmos diferentes |
| RDS compartilhado, com bancos separados | Controle de custo sem abrir acesso cruzado |
| DynamoDB para Pagamento | A Lambda não precisa gerenciar conexões SQL |
| HTTP para consultas internas | Cliente, veículo, serviço e disponibilidade exigem resposta imediata |
| SQS para efeitos distribuídos | Reserva e pagamento toleram consistência eventual |
| Polling do Mercado Pago | Evita expor e autenticar um webhook externo |
| Idempotência por `external_reference` | Reprocessamento de mensagem não cria order duplicada |
| Outbox/Inbox na saga | Evita perda ou duplicidade de mensagem |
| New Relic fail-open | Telemetria não deve derrubar a API |

## Consequências

Benefícios: baixo acoplamento entre contextos, contratos claros de
integração, deploy independente por repositório, pagamento isolado do núcleo
da OS, auditoria da saga por snapshots e caminho claro para observabilidade
fim a fim.

Custos assumidos: mais complexidade operacional que um monolito,
consistência eventual em pagamento e reserva, necessidade de DLQ,
reprocessamento e reconciliação, e alta disponibilidade limitada pelo K3s
single-node.
