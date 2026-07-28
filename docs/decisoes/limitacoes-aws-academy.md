# Limitações do AWS Academy

## Contexto do ambiente

O ambiente AWS Academy apresentou períodos prolongados de indisponibilidade
do laboratório e restrições de IAM, cotas e criação de *service-linked
roles*. Essas condições impactaram o cronograma da entrega e exigiram
adaptações em relação à arquitetura inicialmente planejada.

## Adaptações adotadas

| Decisão planejada | Alternativa adotada | Motivo |
|---|---|---|
| Amazon EKS | Cluster K3s single-node em EC2 privada | O provisionamento de EKS depende de *service-linked roles* e permissões de IAM não disponíveis no laboratório |
| IRSA / EKS Pod Identity | Instance profile da EC2 para a identidade dos workloads | Mecanismos de identidade do EKS não se aplicam fora dele |
| AWS Load Balancer Controller | Services `NodePort`, integrados ao ALB interno por target group | Simplifica a integração sem depender de um controller adicional no cluster |
| Recursos de observabilidade do New Relic via Terraform | Provisionamento idempotente fora do Terraform | Reduz conflito com recursos preexistentes e limitações de gerenciamento do ambiente |
| Polling do Mercado Pago em intervalo curto | Regra do EventBridge agendada a cada 10 minutos | Reduz o volume de invocações da Lambda e de chamadas ao provedor externo dentro das cotas e da instabilidade do laboratório |

## Continuidade durante a indisponibilidade

Durante os períodos de indisponibilidade do laboratório, o desenvolvimento e
as validações continuaram localmente, com Docker Compose, SQL Server,
LocalStack e coleções Postman executadas por Newman. No ambiente AWS, foram
mantidos os componentes compatíveis com as permissões disponíveis: RDS SQL
Server, SQS, API Gateway, Lambda authorizer, ALB e VPC Link.

## Impacto no cronograma da integração de pagamento

A arquitetura de pagamento foi definida com comunicação assíncrona,
processamento desacoplado e um provedor externo — ver
[Comunicação e integração](../arquitetura/comunicacao-integracao.md) e a
RFC-005 em [RFCs](rfcs.md). A indisponibilidade do laboratório consumiu dias
do cronograma e afetou a conclusão dessa integração dentro do período da
entrega.

O domínio de Ordens de Serviço permanece desacoplado do mecanismo de
pagamento por contratos e interfaces, o que permite concluir a integração
posteriormente sem alterações significativas nas regras de negócio ou na
coordenação da saga.

## Intervalo do polling de pagamento

A [ADR-009](adrs.md#adr-009) definiu o polling do Mercado Pago em vez de
webhook. Por causa das restrições do ambiente, a regra do EventBridge foi
implementada com intervalo de 10 minutos, valor escolhido para manter as
invocações da Lambda e as chamadas ao provedor externo dentro das cotas
disponíveis no laboratório.

Em uma solução robusta, com fluxo de orders pendentes em volume alto, o
intervalo adequado seria da ordem de 1 segundo, para que a confirmação do
Pix fosse percebida quase em tempo real e a saga não permanecesse em
`PagamentoPendente` por vários minutos. O intervalo é parametrizado no
Terraform, portanto o ajuste não exige alteração no código da Lambda nem
na coordenação da saga.

## Requisitos preservados

Os requisitos principais da entrega foram atendidos, porém algumas decisões
utilizaram alternativas menos adequadas para um ambiente produtivo, devido
às limitações e indisponibilidades do AWS Academy. Foram preservados:

- separação em microsserviços;
- pipelines independentes por repositório;
- execução em Kubernetes;
- bancos segregados por contexto;
- comunicação assíncrona por mensageria;
- coordenação distribuída com Saga Pattern;
- observabilidade com rastreabilidade fim a fim.

## Aprendizado de processo

Como melhoria de processo, um *spike* técnico de viabilidade — permissões,
cotas, custos e disponibilidade de serviços no AWS Academy — deveria ter
sido executado no início do projeto. Essa validação antecipada teria
definido uma arquitetura compatível desde o começo e evitado o retrabalho
entre EKS, ECS e K3s.

## Nota de encerramento

As alternativas adotadas mantiveram a viabilidade da entrega dentro das
limitações do ambiente acadêmico. Em um ambiente corporativo, a preferência
seria por serviços gerenciados e por mecanismos de identidade próprios de
workload.
