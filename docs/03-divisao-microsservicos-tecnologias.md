# Relatorio - Divisao dos microsservicos e tecnologias

## Criterio de divisao

A solucao foi dividida por **contextos de negocio**, nao por camadas
tecnicas. Cada microsservico possui modelo, persistencia, testes e pipeline
proprios. A comunicacao entre contextos acontece por HTTP ou eventos, sem acesso
direto ao banco de outro servico.

## Microsservicos

| Microsservico | Responsabilidade | Banco | Comunicacao |
|---|---|---|---|
| Cadastro | Clientes, veiculos, funcionarios e catalogo de servicos | `OficinaCadastroDb` | API publica protegida e rotas internas |
| Estoque | Pecas, insumos, saldos, movimentacoes e reservas | `OficinaEstoqueDb` | API publica protegida, rotas internas e SQS FIFO |
| Ordens de Servico | OS, diagnostico, orcamentos, aprovacao, saga e relatorios | `OficinaOrdensServicoDb` | API publica protegida, HTTP interno, SQS FIFO e SQS pagamento |
| Pagamento | Criacao e acompanhamento de Pix no Mercado Pago | DynamoDB `orders` | SQS, EventBridge e HTTPS externo |
| Auth Lambda | Login por CPF e authorizer JWT | Leitura controlada em `OficinaCadastroDb` | Lambda proxy e authorizer |

## Justificativa por contexto

### Cadastro

Cadastro concentra dados mestres e identidade operacional:

- cliente e documento;
- veiculo e vinculo com cliente;
- funcionario, perfil e hash de senha;
- servico e receita de materiais.

Ele e separado porque essas informacoes sao consultadas por outros fluxos, mas
a consistencia pertence ao cadastro. Ordens guarda snapshots para preservar
historico sem se tornar dono desses dados.

### Estoque

Estoque foi separado porque saldo e reserva possuem concorrencia, idempotencia
e auditoria proprias:

- ajuste de saldo;
- movimentacao append-only;
- reserva e liberacao de material;
- resposta assincrona aos comandos da saga.

Manter estoque fora de Ordens evita misturar ciclo de vida da OS com regra de
saldo.

### Ordens de Servico

Ordens e o processo central:

- abertura da OS;
- classificacao preventiva/corretiva;
- diagnostico;
- criacao e aprovacao de orcamento;
- transicao para execucao, finalizacao e entrega;
- coordenacao local da saga.

Ele consulta Cadastro e Estoque, mas persiste apenas seu proprio historico,
pagamento logico e snapshots.

### Pagamento

Pagamento ficou separado porque a carga e orientada a filas e provider externo:

- recebe solicitacao de criacao de Pix;
- envia `POST /v1/orders` ao Mercado Pago;
- persiste estado da order em DynamoDB;
- publica `efetuado`, `pago` ou `recusado`;
- consulta status pendente por EventBridge polling.

Essa divisao isola credenciais do Mercado Pago, simplifica escalabilidade e
evita expor webhook publico.

### Auth Lambda

Autenticacao fica fora dos pods para proteger a borda:

- `auth-cpf` emite token antes de qualquer acesso protegido;
- `authorizer` valida o JWT no API Gateway;
- os servicos recebem identidade por cabecalhos confiaveis.

## Tecnologias utilizadas

| Tecnologia | Uso | Justificativa |
|---|---|---|
| .NET 10 / ASP.NET Core | APIs de Cadastro, Estoque e Ordens | Plataforma unica para dominio, APIs e testes |
| Clean Architecture | Organizacao das APIs .NET | Separa dominio, aplicacao, infraestrutura e transporte |
| Entity Framework Core | Persistencia SQL e migrations | Mapeamento relacional e versionamento de schema |
| SQL Server em RDS | Banco transacional | ACID, constraints, indices e `rowversion` |
| Database por microsservico | Isolamento logico | Evita acoplamento por schema e credencial |
| Python 3.12 | Lambda de Pagamento | Runtime leve para integracao serverless |
| Arquitetura hexagonal | Pagamento | Isola dominio de AWS, HTTP e Mercado Pago |
| AWS Lambda | Auth, authorizer e Pagamento | Execucao sob demanda e sem servidor gerenciado |
| AWS SQS FIFO | Saga Ordens/Estoque | Ordem por OS, DLQ e retentativas |
| AWS SQS standard | Pagamento | Entrada/saida assincrona para solicitacao e resultado |
| AWS EventBridge | Polling de pagamento | Agenda consulta de orders pendentes |
| DynamoDB | Estado de orders Pix | Banco serverless simples para chave `order_id` |
| Mercado Pago Orders API | Provedor Pix | Criacao e consulta de pagamento Pix |
| API Gateway HTTP API | Borda publica | Autorizacao central e VPC Link |
| ALB interno | Roteamento privado | Path-based routing para servicos em K3s |
| K3s em EC2 privada | Runtime dos servicos .NET | Kubernetes simples e de baixo custo |
| Docker | Empacotamento | Imagens imutaveis por commit SHA |
| Terraform | Infraestrutura como codigo | Provisionamento reprodutivel e versionado |
| GitHub Actions | CI/CD | Testes, qualidade, pacote Lambda e deploy |
| pytest, pytest-bdd, moto | Testes do Pagamento | Unitarios, BDD e simulacao de AWS |
| OpenTelemetry | Traces | Padrao aberto de telemetria |
| New Relic | Observabilidade alvo | Centralizacao de traces e metricas |
| CloudWatch Logs | Logs AWS | Diagnostico de Lambda e API Gateway |

## Decisoes importantes

| Decisao | Motivo |
|---|---|
| Separar Cadastro, Estoque, Ordens e Pagamento | Contexts com regras e ritmos diferentes |
| RDS compartilhado com databases separados | Controle de custo sem abrir acesso cruzado |
| DynamoDB para Pagamento | Lambda nao precisa gerenciar conexoes SQL |
| HTTP para consultas internas | Cliente, veiculo, servico e disponibilidade exigem resposta imediata |
| SQS para efeitos distribuidos | Reserva e pagamento toleram consistencia eventual |
| Polling do Mercado Pago | Evita expor e autenticar webhook externo nesta versao |
| Idempotencia por `external_reference` | Reprocessamento SQS nao cria order duplicada |
| Outbox/Inbox na saga | Evita perda ou duplicidade de mensagens |
| New Relic fail-open | Telemetria nao deve derrubar a API |

## Consequencias

Beneficios:

- baixo acoplamento entre contextos;
- contratos claros de integracao;
- deploy independente por repositorio;
- pagamento real isolado do core da OS;
- auditoria da saga por snapshots;
- caminho claro para observabilidade fim a fim.

Custos assumidos:

- mais complexidade operacional que um monolito;
- consistencia eventual em pagamento e reserva;
- necessidade de DLQ, reprocessamento e reconciliacao;
- integracao final de Ordens com filas de Pagamento ainda precisa substituir o
  gateway mock existente no codigo base;
- alta disponibilidade limitada pelo K3s single-node.
