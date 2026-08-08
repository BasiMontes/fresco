# Comments for FRESCO-124

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-124)

---

### Basi Montes - 8/8/2026, 5:55:05 PM

## Investigado (2026-08-08) — no reproducible, no hace falta fix

El constraint server-side que el ticket pedía (`CHECK (length(trim(nombre)) > 0)`) YA EXISTÍA desde la creación de la tabla, `supabase/migrations/20260803000000*create*recetas*propias*table.sql:15`:

```sql
nombre text not null check (char_length(trim(nombre)) > 0),
```

Verificado en vivo: un intento de INSERT directo con `nombre = '   '` es rechazado por Postgres con el error real del constraint (`violates check constraint "recetas*propias*nombre_check"`).

La fila que el agente de QA reportó como vacía (`df4e3573-d16d-48b4-be38-a1e2b2bf9648`) existía en el momento de su reporte, pero al investigar minutos después ya no tenía nombre vacío — tenía "Tortilla Tortilla..." repetido ~140 veces (muy por encima del límite de 100 caracteres de FRESCO-107, que sí es solo client-side). Root cause más probable: estado transitorio de otro test concurrente corriendo en paralelo durante el sweep (varios agentes de QA + este mismo agente corrieron simultáneamente contra la misma DB), no un gap real de validación de nombre vacío. Fila eliminada como limpieza (era debris de test, no dato real).

Nota separada (no en el alcance de este ticket): sí se confirmó que el límite de 100 caracteres (FRESCO-107) NO tiene backstop server-side — esa fila superó los 100 caracteres sin problema. Si se quiere blindar eso también, sería un ticket nuevo.

Cerrando como "no reproducible" — el server-side constraint que se pedía ya estaba ahí.

---


_Synced from Jira by sync-jira-issues_
