# Documentacao da arquitetura de pagamento integrada

Este diretorio consolida os relatorios da solucao Oficina considerando:

- o projeto base em `C:\Projetos\FIAPFase4`;
- o repositorio `oficina-app-pagamento`, com a Lambda Python de pagamento Pix via Mercado Pago;
- o repositorio `oficina-infra-pagamento`, com SQS e DynamoDB do dominio de pagamento.

## Relatorios

| Arquivo | Conteudo |
|---|---|
| [01-arquitetura-final.md](01-arquitetura-final.md) | Diagrama geral da arquitetura final, microsservicos, bancos e comunicacao |
| [02-saga-pattern.md](02-saga-pattern.md) | Estrategia escolhida para Saga Pattern |
| [03-divisao-microsservicos-tecnologias.md](03-divisao-microsservicos-tecnologias.md) | Justificativa da divisao dos microsservicos e tecnologias |
| [04-sequencia-criacao-os.md](04-sequencia-criacao-os.md) | Diagrama de sequencia da criacao da OS |
| [05-diagrama-er-bancos.md](05-diagrama-er-bancos.md) | Diagramas ER dos bancos SQL Server e tabela DynamoDB de pagamento |
| [06-rfcs.md](06-rfcs.md) | RFCs arquiteturais e contratos principais |
| [07-adrs.md](07-adrs.md) | ADRs com decisoes arquiteturais |

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
