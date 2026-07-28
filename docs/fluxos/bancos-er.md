# Bancos de dados

## Visão geral

A solução usa persistência poliglota: RDS SQL Server para Cadastro, Estoque
e Ordens de Serviço, e DynamoDB para o estado das orders Pix do serviço de
Pagamento.

Não há foreign keys entre bancos de contextos diferentes. Referências entre
contextos são lógicas, por identificador, e Ordens preserva snapshots de
cliente e veículo para manter histórico mesmo que o Cadastro mude.

## Modelo de dados do Cadastro — `OficinaCadastroDb`

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

`Funcionarios` é consultado pela autenticação por CPF. `PecaId` e `InsumoId`
apontam logicamente para materiais do Estoque, sem FK física entre bancos.

## Modelo de dados do Estoque — `OficinaEstoqueDb`

```mermaid
erDiagram
    PECAS ||--o| ESTOQUE_PECAS : saldo
    INSUMOS ||--o| ESTOQUE_INSUMOS : saldo
    RESERVAS_ESTOQUE ||--o{ ITENS_RESERVA_ESTOQUE : contém

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
    RESERVAS_ESTOQUE {
        guid Id PK
        string ChaveOperacao UK
        int Status
        datetime DataCriacao
    }
    ITENS_RESERVA_ESTOQUE {
        guid Id PK
        guid ReservaEstoqueId FK
        int TipoMaterial
        guid MaterialId
        int Quantidade
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
```

`MovimentacoesEstoque` é append-only: o banco rejeita alteração ou remoção
de linhas existentes. `MaterialId` é polimórfico — representa peça ou
insumo conforme `TipoMaterial` — por isso não tem FK física.

## Modelo de dados de Ordens de Serviço — `OficinaOrdensServicoDb`

```mermaid
erDiagram
    ORDENS_SERVICO ||--o| DIAGNOSTICOS : possui
    ORDENS_SERVICO ||--o{ ITENS_SERVICO_OS : classifica
    ORDENS_SERVICO ||--o| ORCAMENTOS : possui
    ORCAMENTOS ||--o{ ORCAMENTO_ITENS_SERVICO : contém
    ORCAMENTOS ||--o{ ORCAMENTO_ITENS_MATERIAL : contém
    ORDENS_SERVICO ||--o{ PAGAMENTOS : controla
    ORDENS_SERVICO ||--o| SAGAS_ORDENS_SERVICO : possui
    SAGAS_ORDENS_SERVICO ||--o{ SAGA_SNAPSHOTS : registra

    ORDENS_SERVICO {
        guid Id PK
        guid ClienteId
        guid VeiculoId
        int TipoManutencao
        int Status
        guid OrcamentoId
        guid ClienteSnapshotId
        string Documento
        guid VeiculoSnapshotId
        string Placa
        datetime DataCriacao
        datetime DataInicioExecucao
        datetime DataFimExecucao
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
        guid OrdemServicoId FK
        int Status
        decimal ValorTotal
        string TokenAcaoExterna UK
        datetime TokenAcaoExternaExpiraEm
    }
    ORCAMENTO_ITENS_SERVICO {
        guid Id PK
        guid OrcamentoId FK
        guid ServicoId
        decimal ValorMaoDeObra
    }
    ORCAMENTO_ITENS_MATERIAL {
        guid Id PK
        guid OrcamentoId FK
        int Tipo
        guid MaterialId
        int Quantidade
        decimal ValorTotal
    }
    PAGAMENTOS {
        guid Id PK
        guid OrdemServicoId FK
        string ChaveIdempotencia UK
        string Provider
        int Status
        int AttemptCount
        rowversion RowVersion
    }
    SAGAS_ORDENS_SERVICO {
        guid Id PK
        guid OrdemServicoId FK
        int Status
        guid ReservaId
        rowversion RowVersion
    }
    SAGA_SNAPSHOTS {
        guid Id PK
        guid SagaId FK
        guid OrdemServicoId
        int PreviousState
        int NewState
        string EventType
        datetime OccurredAtUtc
    }
```

`ClienteId`, `VeiculoId`, `ServicoId` e `MaterialId` são referências lógicas
a outros contextos. Snapshots preservam o histórico da OS mesmo que Cadastro
ou Estoque mudem. `OrdensServico.OrcamentoId` aponta para o orçamento
vigente por identificador — não é FK física, para não criar dependência
circular com `Orcamentos.OrdemServicoId`. `SagasOrdensServico` guarda o
estado atual da saga; `SagaSnapshots` guarda a auditoria de cada transição.
Inbox e Outbox seguem o mesmo mecanismo de mensageria descrito em
[Comunicação e integração](../arquitetura/comunicacao-integracao.md), sem
relação de FK com as tabelas de domínio.

## Modelo de dados de Pagamento — DynamoDB `orders`

DynamoDB não é relacional, mas a tabela tem um agregado principal por
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
        map raw
    }
```

| Campo | Uso |
|---|---|
| `order_id` | Chave da order no Mercado Pago, ou o `external_reference` quando a order é recusada antes de ser criada |
| `external_reference` | Referência da OS, usada para idempotência |
| `status` | Status nativo do Mercado Pago, ou o status interno `recusado` |
| `status_detail` | Detalhe do provedor ou motivo local |
| `raw` | Payload bruto retornado pelo Mercado Pago |
| `updated_at_epoch` | Suporte a ordenação e auditoria |

O acesso a orders pendentes hoje usa varredura por atributo `status`. Caso o
volume cresça, a evolução natural é criar um índice secundário por `status`.
