<div class="oficina-hero" markdown>

<p class="oficina-eyebrow">Documentação de arquitetura · FIAP — Fase 4</p>

# Arquitetura da solução Oficina

<p class="oficina-lead">
Documentação técnica da plataforma de gestão de oficina mecânica, cobrindo
microsserviços, bancos, integração assíncrona, pagamento Pix, segurança de
borda, observabilidade e decisões arquiteturais.
</p>

<div class="oficina-pill-row" aria-label="Tecnologias principais">
  <span>Microsserviços</span>
  <span>AWS</span>
  <span>K3s</span>
  <span>SQS</span>
  <span>RDS SQL Server</span>
  <span>DynamoDB</span>
  <span>Pagamento Pix</span>
</div>

</div>

<div class="oficina-summary" markdown>

<section class="oficina-panel" markdown>

## Resumo da arquitetura

A solução é dividida por contexto de negócio: Cadastro, Estoque, Ordens de
Serviço, Pagamento e Autenticação. A entrada pública passa pelo API Gateway, a
execução principal ocorre em serviços .NET no K3s, e o pagamento Pix roda em
Lambda integrada por SQS, EventBridge, DynamoDB e Mercado Pago.

Ordens de Serviço coordena a saga de aprovação do orçamento, confirmação do
pagamento e reserva de estoque, mantendo rastreabilidade por estado local,
snapshots, Inbox, Outbox e mensagens correlacionadas.

</section>

<aside class="oficina-panel" markdown>

## Leitura sugerida

1. [Visão geral](arquitetura/visao-geral.md)
2. [Componentes](arquitetura/componentes.md)
3. [Microsserviços e tecnologias](arquitetura/microsservicos-tecnologias.md)
4. [Comunicação e integração](arquitetura/comunicacao-integracao.md)
5. [Criação da Ordem de Serviço](fluxos/sequencia-criacao-os.md)
6. [Saga Pattern](fluxos/saga-pattern.md)
7. [Bancos de dados](fluxos/bancos-er.md)
8. [ADRs](decisoes/adrs.md)
9. [RFCs](decisoes/rfcs.md)
10. [Limitações do AWS Academy](decisoes/limitacoes-aws-academy.md)

</aside>

</div>

## Navegação

<div class="oficina-nav-grid">
  <a class="oficina-card" href="arquitetura/visao-geral/">
    <div>
      <h3>Arquitetura</h3>
      <p>
        Visão geral da solução, componentes internos, divisão dos microsserviços,
        tecnologias e comunicação entre serviços.
      </p>
    </div>
    <span class="oficina-card__action">Abrir arquitetura</span>
  </a>

  <a class="oficina-card" href="fluxos/sequencia-criacao-os/">
    <div>
      <h3>Fluxos</h3>
      <p>
        Criação da Ordem de Serviço, Saga Pattern, integração com pagamento e
        modelos de dados dos bancos.
      </p>
    </div>
    <span class="oficina-card__action">Abrir fluxos</span>
  </a>

  <a class="oficina-card" href="decisoes/adrs/">
    <div>
      <h3>Decisões</h3>
      <p>
        ADRs, RFCs e restrições do AWS Academy que influenciaram escolhas de
        implementação e operação.
      </p>
    </div>
    <span class="oficina-card__action">Abrir decisões</span>
  </a>
</div>

## Componentes principais

<div class="oficina-component-grid">
  <article class="oficina-component-card">
    <h3>API Gateway e Auth</h3>
    <p><strong>Borda pública.</strong> Login por CPF, authorizer JWT e VPC Link para o ALB interno.</p>
  </article>
  <article class="oficina-component-card">
    <h3>Cadastro</h3>
    <p><strong>Dados mestres.</strong> Clientes, veículos, funcionários e catálogo de serviços.</p>
  </article>
  <article class="oficina-component-card">
    <h3>Estoque</h3>
    <p><strong>Materiais.</strong> Peças, insumos, saldos, movimentações e reservas por SQS FIFO.</p>
  </article>
  <article class="oficina-component-card">
    <h3>Ordens de Serviço</h3>
    <p><strong>Processo central.</strong> OS, orçamento, pagamentos lógicos, relatórios e saga.</p>
  </article>
  <article class="oficina-component-card">
    <h3>Pagamento</h3>
    <p><strong>Pix serverless.</strong> Lambda Python, SQS, EventBridge, DynamoDB e Mercado Pago.</p>
  </article>
  <article class="oficina-component-card">
    <h3>Observabilidade</h3>
    <p><strong>Rastreabilidade.</strong> Correlation ID, OpenTelemetry, CloudWatch e New Relic.</p>
  </article>
</div>

## Entregáveis da arquitetura

| Entregável obrigatório | Localização |
|---|---|
| Diagrama geral da arquitetura | [Arquitetura → Visão geral](arquitetura/visao-geral.md) |
| Diagrama de componentes | [Arquitetura → Componentes](arquitetura/componentes.md) |
| Diagrama de sequência | [Fluxos → Criação da Ordem de Serviço](fluxos/sequencia-criacao-os.md) |
| Diagrama de bancos de dados (ER) | [Fluxos → Bancos de dados](fluxos/bancos-er.md) |
| Comunicação e integração | [Arquitetura → Comunicação e integração](arquitetura/comunicacao-integracao.md) |
| Divisão dos microsserviços | [Arquitetura → Microsserviços e tecnologias](arquitetura/microsservicos-tecnologias.md) |
| Tecnologias utilizadas | [Arquitetura → Microsserviços e tecnologias](arquitetura/microsservicos-tecnologias.md) |
| Saga Pattern e estratégia adotada | [Fluxos → Saga Pattern](fluxos/saga-pattern.md) |
| ADRs | [Decisões → ADRs](decisoes/adrs.md) |
| RFCs | [Decisões → RFCs](decisoes/rfcs.md) |

## Repositórios da solução

<div class="oficina-repos" markdown>

| Repositório | Responsabilidade |
|---|---|
| [`oficina-infra-db`](https://github.com/fabianorodrigues/oficina-infra-db-fiap-fase4) | Rede privada, banco de dados relacional, segredos e estado do Terraform compartilhado |
| [`oficina-infra`](https://github.com/fabianorodrigues/oficina-infra-fiap-fase4) | Plataforma Kubernetes, ALB interno, entrada pública da API e observabilidade |
| [`oficina-auth-lambda`](https://github.com/fabianorodrigues/oficina-auth-lambda-fiap-fase4) | Login por CPF e validação de token na borda |
| [`oficina-cadastro`](https://github.com/fabianorodrigues/oficina-cadastro-fiap-fase4) | Clientes, veículos, funcionários e catálogo de serviços |
| [`oficina-estoque`](https://github.com/fabianorodrigues/oficina-estoque-fiap-fase4) | Peças, insumos, saldos e reservas |
| [`oficina-ordens-servico`](https://github.com/fabianorodrigues/oficina-ordens-servico-fiap-fase4) | Ordens de serviço, orçamento e coordenação da saga |
| [`oficina-app-pagamento`](https://github.com/jaquelineramosit/oficina-app-pagamento) | Lambda de pagamento Pix, integrada ao Mercado Pago |
| [`oficina-infra-pagamento`](https://github.com/jaquelineramosit/oficina-infra-pagamento) | Filas SQS e tabela DynamoDB do domínio de pagamento |

</div>

O provisionamento segue uma ordem de dependência: infraestrutura de dados,
plataforma Kubernetes, autenticação, Cadastro, Estoque, Ordens de Serviço,
entrada pública da API e, por fim, observabilidade. Detalhes em
[Comunicação e integração](arquitetura/comunicacao-integracao.md).
