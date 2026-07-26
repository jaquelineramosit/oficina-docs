# Relatorio - Diagramas ER dos bancos de dados

## Visao geral

A solucao usa persistencia poliglota:

- RDS SQL Server para Cadastro, Estoque e Ordens.
- DynamoDB para o estado das orders Pix do servico de Pagamento.

Nao ha foreign keys entre databases de contextos diferentes. Referencias entre
contextos sao logicas, por identificadores e snapshots.

## Cadastro - `OficinaCadastroDb`

```mermaid
erDiagram
    CLIENTES ||--o{ VEICULOS : possui
    SERVICOS ||--o{ SERVICO_PECAS_REQUERIDAS : requer
    SERVICOS ||--o{ SERVICO_INSUMOS_REQUERIDOS : requer

    CLIENTES {
        guid Id PK
        string Nome
        string Documento UK
        string ContatoEmail
        string ContatoTelefone
    }

    VEICULOS {
        guid Id PK
        guid ClienteId FK
        string Placa UK
        string Renavam UK
        string ModeloDescricao
        string ModeloMarca
        int ModeloAno
    }

    FUNCIONARIOS {
        guid Id PK
        string Nome
        string Cpf UK
        string SenhaHash
        int Perfil
        bool Ativo
        datetime DataCriacao
    }

    SERVICOS {
        guid Id PK
        decimal MaoDeObra
    }

    SERVICO_PECAS_REQUERIDAS {
        guid Id PK
        guid ServicoId FK
        guid PecaId
        int Quantidade
    }

    SERVICO_INSUMOS_REQUERIDOS {
        guid Id PK
        guid ServicoId FK
        guid InsumoId
        int Quantidade
    }
```

Observacoes:

- `Funcionario` e usado pela autenticacao por CPF.
- `PecaId` e `InsumoId` apontam logicamente para materiais do Estoque, sem FK
  fisica entre databases.

## Estoque - `OficinaEstoqueDb`

```mermaid
erDiagram
    PECAS ||--o| ESTOQUE_PECAS : saldo_logico
    INSUMOS ||--o| ESTOQUE_INSUMOS : saldo_logico
    RESERVAS_ESTOQUE ||--o{ ITENS_RESERVA_ESTOQUE : contem

    PECAS {
        guid Id PK
        string Descricao
        decimal PrecoUnitario
    }

    INSUMOS {
        guid Id PK
        string Descricao
        decimal PrecoUnitario
    }

    ESTOQUE_PECAS {
        guid Id PK
        guid PecaId UK
        int Quantidade
        rowversion RowVersion
    }

    ESTOQUE_INSUMOS {
        guid Id PK
        guid InsumoId UK
        int Quantidade
        rowversion RowVersion
    }

    MOVIMENTACOES_ESTOQUE {
        guid Id PK
        int TipoMaterial
        guid MaterialId
        int Tipo
        int Quantidade
        int SaldoResultante
        datetime Data
        string ReferenciaOperacao
    }

    RESERVAS_ESTOQUE {
        guid Id PK
        string ChaveOperacao UK
        int Status
        datetime DataCriacao
        datetime DataLiberacao
    }

    ITENS_RESERVA_ESTOQUE {
        guid Id PK
        int TipoMaterial
        guid MaterialId
        int Quantidade
        guid ReservaEstoqueId FK
    }

    INBOX_MESSAGES {
        long Id PK
        guid MessageId UK
        string MessageType
        guid OrdemServicoId
        string CorrelationId
        string Body
        int Status
        int Attempts
    }

    OUTBOX_MESSAGES {
        long Id PK
        guid MessageId UK
        string MessageType
        guid OrdemServicoId
        string CorrelationId
        string CausationId
        string Body
        int Attempts
    }
```

Observacoes:

- `MovimentacoesEstoque` e append-only.
- `MaterialId` e polimorfico: representa peca ou insumo conforme
  `TipoMaterial`.
- Inbox e Outbox pertencem ao mecanismo de mensageria da saga.

## Ordens - `OficinaOrdensServicoDb`

```mermaid
erDiagram
    ORDENS_SERVICO ||--o| DIAGNOSTICOS : possui
    ORDENS_SERVICO ||--o{ ITENS_SERVICO_OS : classifica
    ORDENS_SERVICO ||--o| ORCAMENTOS : gera
    ORCAMENTOS ||--o{ ORCAMENTO_ITENS_SERVICO : contem
    ORCAMENTOS ||--o{ ORCAMENTO_ITENS_MATERIAL : contem
    ORDENS_SERVICO ||--o{ PAGAMENTOS : possui
    ORDENS_SERVICO ||--o| SAGAS_ORDENS_SERVICO : controla
    SAGAS_ORDENS_SERVICO ||--o{ SAGA_SNAPSHOTS : registra

    ORDENS_SERVICO {
        guid Id PK
        guid ClienteId
        guid VeiculoId
        int TipoManutencao
        int Status
        int OrigemUltimaAtualizacaoStatus
        datetime DataUltimaAtualizacaoStatus
        datetime DataCriacao
        datetime DataInicioExecucao
        datetime DataFimExecucao
        guid OrcamentoId
        guid ClienteSnapshotId
        string Nome
        string Documento
        string Email
        string Telefone
        guid VeiculoSnapshotId
        string Placa
        string Renavam
        string ModeloDescricao
        string Marca
        int Ano
    }

    DIAGNOSTICOS {
        guid OrdemServicoId PK
        string Descricao
        datetime DataRegistro
    }

    ITENS_SERVICO_OS {
        guid Id PK
        guid ServicoId
        guid OrdemServicoId FK
    }

    ORCAMENTOS {
        guid Id PK
        guid OrdemServicoId UK
        int Status
        decimal ValorTotal
        datetime DataCriacao
        string TokenAcaoExterna UK
        datetime TokenAcaoExternaExpiraEm
    }

    ORCAMENTO_ITENS_SERVICO {
        guid Id PK
        guid ServicoId
        decimal ValorMaoDeObra
        string DescricaoSnapshot
        guid OrcamentoId FK
    }

    ORCAMENTO_ITENS_MATERIAL {
        guid Id PK
        int Tipo
        guid MaterialId
        int Quantidade
        decimal ValorUnitario
        decimal ValorTotal
        string DescricaoSnapshot
        guid OrcamentoId FK
    }

    PAGAMENTOS {
        guid Id PK
        guid OrdemServicoId
        string PagamentoExternoId
        string CompensacaoExternaId
        string ChaveIdempotencia UK
        string Provider
        string OperationType
        int Status
        int AttemptCount
        datetime NextAttemptAtUtc
        datetime LockedUntilUtc
        datetime CompensatedAtUtc
        string LastError
        rowversion RowVersion
    }

    SAGAS_ORDENS_SERVICO {
        guid Id PK
        guid OrdemServicoId UK
        int Status
        guid ReservaId
        string LastError
        datetime CreatedAtUtc
        datetime UpdatedAtUtc
        rowversion RowVersion
    }

    SAGA_SNAPSHOTS {
        guid Id PK
        guid SagaId
        guid OrdemServicoId
        int PreviousState
        int NewState
        string EventType
        string TriggerMessageId
        string PayloadSummary
        datetime OccurredAtUtc
    }

    INBOX_MESSAGES {
        long Id PK
        guid MessageId UK
        string MessageType
        guid OrdemServicoId
        string CorrelationId
        string Body
        int Status
        int Attempts
    }

    OUTBOX_MESSAGES {
        long Id PK
        guid MessageId UK
        string MessageType
        guid OrdemServicoId
        string CorrelationId
        string CausationId
        string Body
        int Attempts
    }
```

Observacoes:

- `ClienteId`, `VeiculoId`, `ServicoId` e `MaterialId` sao referencias logicas
  a outros contextos.
- Snapshots preservam historico da OS mesmo que cadastro ou estoque mudem.
- `SagasOrdensServico` guarda o estado atual; `SagaSnapshots` guarda auditoria.

## Pagamento - DynamoDB `orders`

DynamoDB nao e relacional, mas a tabela possui um agregado principal por
`order_id`.

```mermaid
erDiagram
    ORDERS {
        string order_id PK
        string external_reference
        string status
        string status_detail
        string total_amount
        string currency
        string created_date
        string last_updated_date
        number updated_at_epoch
        object raw
    }
```

Campos principais:

| Campo | Uso |
|---|---|
| `order_id` | Chave da order no Mercado Pago ou `external_reference` em recusa antes de criar order |
| `external_reference` | Referencia da OS/pedido usada para idempotencia |
| `status` | Status nativo do Mercado Pago ou status interno `recusado` |
| `status_detail` | Detalhe do provider ou motivo local |
| `raw` | Payload bruto retornado pelo Mercado Pago |
| `updated_at_epoch` | Suporte a ordenacao, auditoria e possivel TTL/consulta operacional |

O repositorio atual faz `scan` para localizar orders nao terminais no polling.
Caso o volume cresca, a evolucao natural e criar um GSI por `status`.
