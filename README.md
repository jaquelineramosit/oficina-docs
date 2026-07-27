# oficina-docs

Documentação de arquitetura da solução Oficina — Pós-graduação em Arquitetura
de Software (FIAP), Fase 4.

**Documentação publicada:** <https://jaquelineramosit.github.io/oficina-docs/>

## Conteúdo

Os documentos estão em [`docs/`](docs/) e são publicados no GitHub Pages a
partir da configuração do [`mkdocs.yml`](mkdocs.yml).

| Grupo | Páginas |
|---|---|
| Arquitetura | [Visão geral](docs/arquitetura/visao-geral.md), [Componentes](docs/arquitetura/componentes.md), [Microsserviços e tecnologias](docs/arquitetura/microsservicos-tecnologias.md), [Comunicação e integração](docs/arquitetura/comunicacao-integracao.md) |
| Fluxos | [Criação da Ordem de Serviço](docs/fluxos/sequencia-criacao-os.md), [Saga Pattern](docs/fluxos/saga-pattern.md), [Bancos de dados](docs/fluxos/bancos-er.md) |
| Decisões | [ADRs](docs/decisoes/adrs.md), [RFCs](docs/decisoes/rfcs.md), [Limitações do AWS Academy](docs/decisoes/limitacoes-aws-academy.md) |

## Rodar localmente com Docker

```powershell
docker run --rm -p 127.0.0.1:8000:8000 -v "C:\Projetos\FIAPFase4\oficina-docs:/docs" squidfunk/mkdocs-material:9.7.6 serve -a 0.0.0.0:8000
```

O site fica disponível em <http://127.0.0.1:8000/oficina-docs/>.

## Validar build

```powershell
docker run --rm -v "C:\Projetos\FIAPFase4\oficina-docs:/docs" squidfunk/mkdocs-material:9.7.6 build --strict --site-dir /tmp/oficina-docs-site
```
