# oficina-docs

Documentação de arquitetura da solução Oficina — Pós-graduação em Arquitetura de
Software (FIAP), Fase 4.

**Documentação publicada:** <https://jaquelineramosit.github.io/oficina-docs/>

## Conteúdo

Os documentos estão em [`docs/`](docs/) e são publicados automaticamente no
GitHub Pages a cada push na branch `main`, pelo workflow
[`.github/workflows/docs.yml`](.github/workflows/docs.yml).

| Documento | Conteúdo |
|---|---|
| [01-arquitetura-final.md](docs/01-arquitetura-final.md) | Arquitetura final, microsserviços, bancos e comunicação |
| [02-saga-pattern.md](docs/02-saga-pattern.md) | Estratégia de Saga Pattern |
| [03-divisao-microsservicos-tecnologias.md](docs/03-divisao-microsservicos-tecnologias.md) | Divisão dos microsserviços e tecnologias |
| [04-sequencia-criacao-os.md](docs/04-sequencia-criacao-os.md) | Diagrama de sequência da criação da OS |
| [05-diagrama-er-bancos.md](docs/05-diagrama-er-bancos.md) | Diagramas ER dos bancos |
| [06-rfcs.md](docs/06-rfcs.md) | RFCs arquiteturais |
| [07-adrs.md](docs/07-adrs.md) | ADRs |

## Rodar a documentação localmente

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

O site fica disponível em <http://localhost:8000>.
