# Componentes

Esta página detalha a organização interna dos serviços, complementando a
[visão geral](visao-geral.md), que mostra a topologia entre eles.

## Diagrama de componentes dos serviços .NET

Cadastro, Estoque e Ordens de Serviço seguem a mesma organização em camadas:
API expõe os endpoints, a aplicação orquestra casos de uso por trás de portas
(interfaces), o domínio concentra as regras de negócio e a infraestrutura
implementa as portas — persistência com EF Core, clientes HTTP tipados para
integração interna e mensageria com Inbox/Outbox sobre SQS.

Em **Ordens de Serviço**, a camada de aplicação inclui também o coordenador
da saga: ele decide quando publicar um comando, interpreta as respostas
recebidas por mensageria e atualiza o estado persistido da OS.

```mermaid
---
config:
  layout: elk
---
flowchart TB
    subgraph ENTRADA["Entrada HTTP"]
        direction LR
        Request(["Requisição autorizada"])
        Middleware["Middleware<br/>segurança e correlação"]
        Controllers["Controllers<br/>contratos REST"]
    end

    subgraph APLICACAO["Aplicação"]
        direction LR
        UseCases["Casos de uso"]
        Saga["Coordenador da saga<br/>em Ordens"]
        Ports["Portas<br/>interfaces"]
    end

    subgraph DOMINIO["Domínio"]
        direction LR
        Entidades["Entidades"]
        Regras["Regras de negócio"]
    end

    subgraph INFRA["Adaptadores de infraestrutura"]
        direction LR
        EF["EF Core<br/>banco do contexto"]
        HttpClients["HTTP interno<br/>Cadastro e Estoque"]
        Messaging["Inbox / Outbox<br/>SQS"]
    end

    Request --> Middleware
    Middleware -->|"requisição validada"| Controllers
    Controllers -->|"caso de uso"| UseCases
    UseCases -->|"quando aplicável"| Saga
    UseCases -->|"executa"| Entidades
    Entidades --> Regras
    UseCases -->|"depende de contrato"| Ports
    Ports -.->|"adaptador de banco"| EF
    Ports -.->|"adaptador HTTP"| HttpClients
    Ports -.->|"adaptador SQS"| Messaging

    classDef api fill:#E8F1F8,stroke:#3F6075,stroke-width:2px,color:#1F2933
    classDef app fill:#EEF4F2,stroke:#00897B,stroke-width:2px,color:#1F2933
    classDef dom fill:#F4F7FB,stroke:#627282,stroke-width:2px,color:#1F2933
    classDef infra fill:#FFF8E1,stroke:#A06A00,stroke-width:2px,color:#2F2500

    class Request,Middleware,Controllers api
    class UseCases,Saga,Ports app
    class Entidades,Regras dom
    class EF,HttpClients,Messaging infra

    style ENTRADA fill:#F6F8FB,stroke:#D9E1EA,stroke-width:2px
    style APLICACAO fill:#F3FAF8,stroke:#B7DCD6,stroke-width:2px
    style DOMINIO fill:#F6F8FB,stroke:#D9E1EA,stroke-width:2px
    style INFRA fill:#FFF9E8,stroke:#E6D4A3,stroke-width:2px
```

## Diagrama de componentes da Lambda de Pagamento

`oficina-pagamento` segue arquitetura hexagonal (portas e adaptadores) em
Python. Um único handler despacha para o caso de uso certo conforme a origem
do evento: mensagem SQS ou execução agendada do EventBridge.

```mermaid
---
config:
  layout: elk
---
flowchart TB
    subgraph ENTRADAS["Gatilhos"]
        direction LR
        SQSIn[/"SQS<br/>sqs-pagamento-solicitar"/]
        EventBridge["EventBridge<br/>polling agendado"]
    end

    subgraph HANDLER["Handler"]
        direction LR
        Handler["payment_handler"]
        Dispatcher["Despacho por tipo<br/>SQS ou EventBridge"]
    end

    subgraph APLICACAO["Casos de uso"]
        direction LR
        Create["CreatePaymentOrderUseCase"]
        Check["CheckPaymentStatusUseCase"]
        Ports["Portas<br/>gateway, repositório, notificador"]
    end

    subgraph ADAPTADORES["Adaptadores externos"]
        direction LR
        MP["Mercado Pago<br/>Orders API"]
        Dynamo[("DynamoDB<br/>orders")]
        SQSOut[/"SQS<br/>efetuado / recusado"/]
    end

    SQSIn -->|"mensagem de solicitação"| Handler
    EventBridge -->|"execução agendada"| Handler
    Handler --> Dispatcher
    Dispatcher -->|"criar Pix"| Create
    Dispatcher -->|"consultar pendências"| Check
    Create --> Ports
    Check --> Ports
    Ports -.->|"cria / consulta order"| MP
    Ports -.->|"persiste estado"| Dynamo
    Ports -.->|"publica resultado"| SQSOut

    classDef gatilho fill:#FFF8E1,stroke:#A06A00,stroke-width:2px,color:#2F2500
    classDef app fill:#EEF4F2,stroke:#00897B,stroke-width:2px,color:#1F2933
    classDef port fill:#E8F1F8,stroke:#3F6075,stroke-width:2px,color:#1F2933
    classDef adapt fill:#F4F7FB,stroke:#627282,stroke-width:2px,color:#1F2933
    classDef externo fill:#263238,stroke:#111922,stroke-width:2px,color:#ffffff

    class SQSIn,EventBridge,Handler,Dispatcher gatilho
    class Create,Check app
    class Ports port
    class Dynamo,SQSOut adapt
    class MP externo

    style ENTRADAS fill:#FFF9E8,stroke:#E6D4A3,stroke-width:2px
    style HANDLER fill:#F6F8FB,stroke:#D9E1EA,stroke-width:2px
    style APLICACAO fill:#F3FAF8,stroke:#B7DCD6,stroke-width:2px
    style ADAPTADORES fill:#F6F8FB,stroke:#D9E1EA,stroke-width:2px
```

O domínio (validação do payload, entidades `Order` e `OrderRequest`) não
depende de SDK de nuvem nem de bibliotecas HTTP — apenas as portas conhecem
essas interfaces, e apenas os adaptadores implementam a comunicação real com
Mercado Pago, DynamoDB e SQS.
