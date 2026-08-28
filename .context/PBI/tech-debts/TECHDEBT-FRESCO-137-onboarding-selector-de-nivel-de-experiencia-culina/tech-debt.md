# Tarea: Onboarding: selector de nivel de experiencia culinaria ("cocinillas")

**Jira Key:** [FRESCO-137](https://basiliomontescastano.atlassian.net/browse/FRESCO-137)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

Añadir al onboarding un selector de nivel de experiencia culinaria ("cocinillas") — Aprendiz, Novato, Chef y similares — para ajustar la complejidad/tiempo de las recetas recomendadas.

## Código de referencia (app antigua)

La app antigua solo tenía el campo definido en el estado (`cooking_experience: 'intermediate'` por defecto) y en el tipo `UserProfile`, pero ***no llegó a implementar la UI de selección*** — no hay componente de referencia que portar, solo el concepto del campo.

```tsx
const [profile, setProfile] = useState<Partial<UserProfile>>({
  // ...
  cooking_experience: 'intermediate',
  // ...
});
```

## Qué añadir

Selector (dropdown o chips, componente del design system, no nativo del navegador — mismo criterio que FRESCO-132) con niveles de experiencia culinaria. Propuesta de opciones a validar con el equipo:

- Aprendiz
- Novato
- Intermedio
- Chef
- Experto

## Criterios de aceptación

- Selector de nivel de experiencia integrado en el flujo de onboarding, usando componentes del design system.
- El valor se guarda y persiste vía `upsertUserProfile` junto al resto del perfil.
- El dato queda disponible para ajustar la complejidad de las recetas recomendadas.

## Notas

Validar la lista final de niveles con el equipo antes de implementar — la propuesta busca cubrir el rango de experiencia típico sin ser excesiva.

---

## Fields

### Clasificación

0|i000d3:000000i

### customfield_10000

{deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:26:52.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, repository={count=3, dataType=repository}, json={"cachedValue":{"errors":[],"summary":{"repository":{"overall":{"count":3,"lastUpdated":"2026-08-09T15:18:00.000+0200","dataType":"repository"},"byInstanceType":{"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"},"GitHub":{"count":3,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:26:52.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:26:52.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
