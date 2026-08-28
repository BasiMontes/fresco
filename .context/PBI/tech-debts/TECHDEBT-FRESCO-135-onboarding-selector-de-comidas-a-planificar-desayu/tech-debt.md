# Tarea: Onboarding: selector de comidas a planificar (Desayuno/Almuerzo/Cena)

**Jira Key:** [FRESCO-135](https://basiliomontescastano.atlassian.net/browse/FRESCO-135)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

Añadir al onboarding la selección de qué comidas se quieren planificar (Desayuno, Almuerzo, Cena), para que la generación del menú sea flexible en vez de asumir siempre las 3.

## Código de referencia (app antigua)

La app antigua (React Router + Supabase directo) ya tenía esta lógica implementada en su paso 3. Portar el concepto, no el código literal — este proyecto usa Next.js + `@/lib/api/user-profile`, no Supabase client directo desde el componente.

```tsx
const ALL_MEALS = [
  { id: 'breakfast', label: 'Desayuno', icon: '☀️' },
  { id: 'lunch', label: 'Almuerzo', icon: '🍽️' },
  { id: 'dinner', label: 'Cena', icon: '🌙' },
];

const toggleMeal = (mealId: string) => {
  const current = [...(profile.planning_meals || [])];
  if (current.includes(mealId)) {
    setProfile((p) => ({ ...p, planning_meals: current.filter(m => m !== mealId) }));
  } else {
    setProfile((p) => ({ ...p, planning_meals: [...current, mealId] }));
  }
};
```

```tsx
<div className="grid grid-cols-3 gap-2">
  {ALL_MEALS.map((meal) => {
    const isSelected = profile.planning_meals?.includes(meal.id);
    return (
      <button
        key={meal.id}
        onClick={() => toggleMeal(meal.id)}
        className={/** ...seleccionado vs no seleccionado... **/}
      >
        <span>{meal.icon}</span>
        <span>{meal.label}</span>
      </button>
    );
  })}
</div>
```

Por defecto todas las comidas marcadas (`planning*meals: ALL*MEALS.map(m => m.id)`), el usuario desmarca las que no necesita.

## Criterios de aceptación

- Selector de comidas (Desayuno, Almuerzo, Cena) integrado en el flujo de onboarding, usando los componentes del design system del proyecto (chips ya usados en dieta/cocinas, no los botones custom de la app antigua).
- Por defecto las 3 comidas están seleccionadas.
- El valor se guarda y persiste vía `upsertUserProfile` junto al resto del perfil.
- El dato queda disponible para la generación del menú (limita qué comidas se planifican).

---

## Fields

### Clasificación

0|i000d3:000003

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=6}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T19:28:33.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":6,"lastUpdated":"2026-08-09T21:26:04.000+0200","stateCount":6,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":3,"name":"GitHub"},"GitHub":{"count":3,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T21:28:33.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T19:28:33.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
