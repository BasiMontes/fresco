# DEFECT: FAQ de Ayuda sigue diciendo que Gemini redacta la explicación Pro

**Jira Key:** [FRESCO-121](https://basiliomontescastano.atlassian.net/browse/FRESCO-121)
**Priority:** Medium
**Status:** Listo
**Components:** None

---

## Description

Qué se observa

Dónde: components/profile/ayuda-section.tsx:31

Pasos para reproducir:
1. Login (cualquier cuenta).
2. Ir a /profile → Ayuda → "Preguntas frecuentes".
3. Leer "¿Cómo genera Fresco mi menú semanal?".

Esperado: el copy debe reflejar la arquitectura real de generación.

Observado: el texto dice literalmente "Gemini solo entra en juego en Plan Pro, para redactar la explicación de qué ha aprendido de ti." Esto es falso desde el 2026-08-01 (ADR-0005 + commit ae3b560 "kill remaining Gemini calls") — la explicación de aprendizaje es 100% determinista (buildLearningExplanation en supabase/functions/generate-meal-plan/prompt.ts), sin llamada a Gemini ni a ningún LLM. Confirmado en vivo con Playwright: cero requests a endpoints Gemini/Google en 3 generaciones reales distintas (una por cada cuenta de test del sweep).

Evidencia: components/profile/ayuda-section.tsx:31; ADR-0005; commit ae3b560.

Por qué importa

Miente sobre la arquitectura del producto a usuarios reales — mismo problema que el hallazgo de FRESCO-89/QA sweep anterior, pero en un sitio distinto del código (no se corrigió como parte de esa sesión porque no se tocó ese archivo). Riesgo de percepción/confianza más que funcional.

Alcance

Reescribir el párrafo del FAQ para describir el mecanismo real (determinista, basado en el historial de calendario del usuario — ver también el ticket "Pro learning loop no coincide con su copy" para el detalle exacto del mecanismo, que puede afectar cómo se redacta este texto también).

Cómo reproducir

Ver Pasos para reproducir arriba.


---

## Metadata

- **Created:** 8/8/2026
- **Updated:** 8/8/2026
- **Reporter:** Basi Montes
- **Assignee:** Basi Montes
- **Labels:** major, qa-sweep-2026-08-08

---

_Synced from Jira by sync-jira-issues_
