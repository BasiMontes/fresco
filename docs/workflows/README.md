# Workflows

> **Idioma:** Español
> Flujos de trabajo de desarrollo.

---

## Contenido

| Documento                                        | Descripción                                                 |
| ------------------------------------------------ | ----------------------------------------------------------- |
| [boilerplate-sync.md](./boilerplate-sync.md)     | `bun sync` y el `adr:reconcile` que debe seguirle           |
| [environments.md](./environments.md)             | Ambientes de desarrollo (local, staging, producción)        |
| [git-flow.md](./git-flow.md)                     | Flujo de trabajo Git para desarrollo AI-driven              |
| [stripe-go-live.md](./stripe-go-live.md)         | El guard del modo de Stripe y el orden del paso a live      |
| [sync-openapi-guide.md](./sync-openapi-guide.md) | `bun run api:sync`: sincronizar el spec OpenAPI y sus tipos |

---

## Ruta de Aprendizaje

1. **Entender ambientes:** `environments.md`
2. **Aprender flujo Git:** `git-flow.md`
3. **Consumir una API externa con tipos:** `sync-openapi-guide.md`

El testing manual y la automatización de QA viven en el repo hermano [agentic-qa-boilerplate](https://github.com/upex-galaxy/agentic-qa-boilerplate).

---

**Ver También:**

- Skill `/git-flow-master`: el operador de branches, commits, PRs y conflictos (`.agents/skills/git-flow-master/SKILL.md`)
- Skill `/sprint-development`: el ciclo por historia, de plan a deploy (`.agents/skills/sprint-development/SKILL.md`)
