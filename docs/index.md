# Oficina

<section class="oficina-hero">
  <p class="oficina-eyebrow">Documentação de arquitetura · FIAP Fase 4</p>
  <h1>Arquitetura da solução Oficina</h1>
  <p class="oficina-lead">
    Documentação técnica da plataforma de gestão de oficina mecânica, cobrindo
    microsserviços, bancos, integração assíncrona, pagamento Pix, segurança de
    borda, observabilidade e decisões arquiteturais.
  </p>
  <div class="oficina-pill-row" aria-label="Características principais">
    <span>Microsserviços</span>
    <span>AWS</span>
    <span>K3s</span>
    <span>SQS</span>
    <span>RDS SQL Server</span>
    <span>DynamoDB</span>
    <span>Pagamento Pix</span>
  </div>
</section>

<div class="oficina-summary">
  <section class="oficina-panel">
    <h2>Resumo da arquitetura</h2>
    <p>
      A solução é dividida por contexto de negócio: Cadastro, Estoque, Ordens de
      Serviço, Pagamento e Autenticação. A entrada pública passa pelo API
      Gateway, a execução principal ocorre em serviços .NET no K3s, e o
      pagamento Pix roda em Lambda integrada por SQS, EventBridge, DynamoDB e
      Mercado Pago.
    </p>
    <p>
      Ordens de Serviço coordena a saga de aprovação do orçamento, confirmação
      do pagamento e reserva de estoque, mantendo rastreabilidade por estado
      local, snapshots, Inbox, Outbox e mensagens correlacionadas.
    </p>
  </section>

  <aside class="oficina-panel">
    <h2>Leitura sugerida</h2>
    <ol class="oficina-reading-list">
      <li>Arquitetura → Visão geral</li>
      <li>Arquitetura → Componentes</li>
      <li>Arquitetura → Microsserviços e tecnologias</li>
      <li>Arquitetura → Comunicação e integração</li>
      <li>Fluxos → Criação da Ordem de Serviço</li>
      <li>Fluxos → Saga Pattern</li>
      <li>Fluxos → Bancos de dados</li>
      <li>Decisões → ADRs</li>
      <li>Decisões → RFCs</li>
      <li>Decisões → Limitações do AWS Academy</li>
    </ol>
  </aside>
</div>

## Entregáveis da arquitetura

<div class="oficina-deliverables">
  <section>
    <h3>Arquitetura</h3>
    <a href="arquitetura/visao-geral/">Visão geral</a>
    <a href="arquitetura/componentes/">Componentes</a>
    <a href="arquitetura/microsservicos-tecnologias/">Microsserviços e tecnologias</a>
    <a href="arquitetura/comunicacao-integracao/">Comunicação e integração</a>
  </section>
  <section>
    <h3>Fluxos e dados</h3>
    <a href="fluxos/sequencia-criacao-os/">Criação da Ordem de Serviço</a>
    <a href="fluxos/saga-pattern/">Saga Pattern</a>
    <a href="fluxos/bancos-er/">Bancos de dados</a>
  </section>
  <section>
    <h3>Decisões</h3>
    <a href="decisoes/adrs/">ADRs</a>
    <a href="decisoes/rfcs/">RFCs</a>
  </section>
</div>

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

## Navegação principal

<div class="oficina-nav-grid">
  <a class="oficina-card" href="arquitetura/visao-geral/">
    <div>
      <h3>Arquitetura</h3>
      <p>
        Visão geral da solução, componentes internos, divisão dos microsserviços,
        tecnologias e comunicação entre serviços.
      </p>
    </div>
    <span>Abrir arquitetura</span>
  </a>

  <a class="oficina-card" href="fluxos/sequencia-criacao-os/">
    <div>
      <h3>Fluxos</h3>
      <p>
        Criação da Ordem de Serviço, Saga Pattern, integração com pagamento e
        modelos de dados dos bancos.
      </p>
    </div>
    <span>Abrir fluxos</span>
  </a>

  <a class="oficina-card" href="decisoes/adrs/">
    <div>
      <h3>Decisões</h3>
      <p>
        ADRs, RFCs e restrições do AWS Academy que influenciaram escolhas de
        implementação e operação.
      </p>
    </div>
    <span>Abrir decisões</span>
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

## Acesso rápido

<div class="oficina-quick-grid">
  <a href="arquitetura/visao-geral/">Visão geral</a>
  <a href="arquitetura/comunicacao-integracao/">Comunicação e integração</a>
  <a href="fluxos/saga-pattern/">Saga Pattern</a>
  <a href="fluxos/bancos-er/">Bancos de dados</a>
  <a href="decisoes/adrs/">ADRs</a>
  <a href="decisoes/limitacoes-aws-academy/">Limitações do AWS Academy</a>
</div>

## Repositórios da solução

| Repositório | Responsabilidade |
|---|---|
| `oficina-infra-db` | Rede privada, banco de dados relacional, segredos e estado do Terraform compartilhado |
| `oficina-infra` | Plataforma Kubernetes, ALB interno, entrada pública da API e observabilidade |
| `oficina-auth-lambda` | Login por CPF e validação de token na borda |
| `oficina-cadastro` | Clientes, veículos, funcionários e catálogo de serviços |
| `oficina-estoque` | Peças, insumos, saldos e reservas |
| `oficina-ordens-servico` | Ordens de serviço, orçamento e coordenação da saga |
| `oficina-app-pagamento` | Lambda de pagamento Pix, integrada ao Mercado Pago |
| `oficina-infra-pagamento` | Filas SQS e tabela DynamoDB do domínio de pagamento |

O provisionamento segue uma ordem de dependência: infraestrutura de dados,
plataforma Kubernetes, autenticação, Cadastro, Estoque, Ordens de Serviço,
entrada pública da API e, por fim, observabilidade. Detalhes em
[Comunicação e integração](arquitetura/comunicacao-integracao.md).
