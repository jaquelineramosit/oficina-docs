# Documentacao da arquitetura de pagamento integrada

Este site consolida os relatorios da solucao Oficina considerando:

- o projeto base `FIAPFase4`;
- o repositorio `oficina-app-pagamento`, com a Lambda Python de pagamento Pix via Mercado Pago;
- o repositorio `oficina-infra-pagamento`, com SQS e DynamoDB do dominio de pagamento.

## Relatorios

| Documento | Conteudo |
|---|---|
| [Arquitetura final](01-arquitetura-final.md) | Diagrama geral da arquitetura final, microsservicos, bancos e comunicacao |
| [Saga Pattern](02-saga-pattern.md) | Estrategia escolhida para Saga Pattern |
| [Microsservicos e tecnologias](03-divisao-microsservicos-tecnologias.md) | Justificativa da divisao dos microsservicos e tecnologias |
| [Sequencia da criacao da OS](04-sequencia-criacao-os.md) | Diagrama de sequencia da criacao da OS |
| [Diagramas ER dos bancos](05-diagrama-er-bancos.md) | Diagramas ER dos bancos SQL Server e tabela DynamoDB de pagamento |
| [RFCs](06-rfcs.md) | RFCs arquiteturais e contratos principais |
| [ADRs](07-adrs.md) | ADRs com decisoes arquiteturais |

## Observacao de integracao

No codigo atual do `FIAPFase4`, o servico `oficina-ordens-servico` ainda possui
um gateway de pagamento mock e classes de contrato externo marcadas como
pendentes. A arquitetura final documentada aqui considera a API de Pagamento
separada como participante real da solucao, integrada por filas SQS:

- `sqs-pagamento-solicitar`
- `sqs-pagamento-efetuado`
- `sqs-pagamento-recusado`

Essa separacao preserva o desenho existente da saga em Ordens e substitui o
mock por um participante serverless assincrono.
