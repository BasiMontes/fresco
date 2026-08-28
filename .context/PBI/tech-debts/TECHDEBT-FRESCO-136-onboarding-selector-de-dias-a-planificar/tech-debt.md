# Tarea: Onboarding: selector de días a planificar

**Jira Key:** [FRESCO-136](https://basiliomontescastano.atlassian.net/browse/FRESCO-136)
**Status:** Finalizada
**Type:** Tarea

---

## Description

## Descripción

Añadir al onboarding la selección de qué días de la semana se quieren planificar, para que la generación del menú sea flexible (ej. si el usuario come fuera los domingos, los desmarca).

## Código de referencia (app antigua)

La app antigua (React Router + Supabase directo) ya tenía esta lógica implementada en su paso 3. Portar el concepto, no el código literal — este proyecto usa Next.js + `@/lib/api/user-profile`, no Supabase client directo desde el componente.

```tsx
const ALL_DAYS = [
  { id: 'monday', label: 'Lun' },
  { id: 'tuesday', label: 'Mar' },
  { id: 'wednesday', label: 'Mié' },
  { id: 'thursday', label: 'Jue' },
  { id: 'friday', label: 'Vie' },
  { id: 'saturday', label: 'Sáb' },
  { id: 'sunday', label: 'Dom' },
];

const toggleDay = (dayId: string) => {
  const current = [...(profile.planning_days || [])];
  if (current.includes(dayId)) {
    setProfile((p) => ({ ...p, planning_days: current.filter(d => d !== dayId) }));
  } else {
    setProfile((p) => ({ ...p, planning_days: [...current, dayId] }));
  }
};

const selectAllDays = () => setProfile(p => ({ ...p, planning*days: ALL*DAYS.map(d => d.id) }));
const selectNoDays = () => setProfile(p => ({ ...p, planning_days: [] }));
```

```tsx
<div className="grid grid-cols-7 gap-1">
  {ALL_DAYS.map((day) => {
    const isSelected = profile.planning_days?.includes(day.id);
    return (
      <button key={day.id} onClick={() => toggleDay(day.id)}>
        <span>{day.label}</span>
      </button>
    );
  })}
</div>
<div className="flex gap-2.5">
  <button onClick={selectAllDays}>Todos</button>
  <button onClick={selectNoDays}>Ninguno</button>
</div>
```

Por defecto todos los días marcados (`planning*days: ALL*DAYS.map(d => d.id)`), el usuario desmarca los que no necesita. Incluye atajos "Todos" / "Ninguno".

## Criterios de aceptación

- Selector de días (Lun-Dom) integrado en el flujo de onboarding, usando los componentes del design system del proyecto.
- Por defecto los 7 días están seleccionados.
- Atajos "Todos" / "Ninguno" para marcar/desmarcar de golpe.
- El valor se guarda y persiste vía `upsertUserProfile` junto al resto del perfil.
- El dato queda disponible para la generación del menú (limita qué días se planifican).

---

## Fields

### Clasificación

0|i000d3:000001

### customfield_10000

{pullrequest={dataType=pullrequest, state=MERGED, stateCount=2}, deployment-environment={dataType=deployment-environment, successfulCount=1, topEnvironments=[{lastUpdated=2026-08-09T13:16:57.000+0000, id=0, position=0, title=Production, projectId=0, status=DEPLOYED}]}, json={"cachedValue":{"errors":[],"summary":{"pullrequest":{"overall":{"count":2,"lastUpdated":"2026-08-09T15:00:41.000+0200","stateCount":2,"state":"MERGED","dataType":"pullrequest","open":false},"byInstanceType":{"oAuth-com.github.integration.production":{"count":1,"name":"GitHub"},"GitHub":{"count":1,"name":"GitHub"}}},"deployment-environment":{"overall":{"count":1,"lastUpdated":"2026-08-09T15:16:57.000+0200","topEnvironments":[{"lastUpdated":"2026-08-09T13:16:57.000+0000","id":0,"position":0,"title":"Production","projectId":0,"status":"DEPLOYED"}],"showProjects":false,"successfulCount":1,"dataType":"deployment-environment"},"byInstanceType":{"cloud-providers":{"count":1,"name":"Other providers"}}}}},"isStale":true}}

---

## Metadata

- **Created:** 8/9/2026
- **Updated:** 8/16/2026
- **Reporter:** Basi Montes
- **Assignee:** Unassigned

---

_Synced from Jira by sync-jira-issues_
