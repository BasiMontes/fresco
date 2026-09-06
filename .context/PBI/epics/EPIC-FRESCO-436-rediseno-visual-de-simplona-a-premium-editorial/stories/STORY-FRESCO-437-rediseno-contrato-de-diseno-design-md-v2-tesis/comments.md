# Comments for FRESCO-437

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-437)

---

### Basi Montes - 9/5/2026, 5:40:38 PM

## Acceptance Criteria

### Escenario: tesis escrita

- ***Dado*** el trabajo de dirección
- ***Cuando*** se cierra la tarjeta
- ***Entonces*** DESIGN.md abre con una tesis de una frase que un tercero puede leer y entender qué distingue a Fresco

### Escenario: sistema tipográfico completo

- ***Dado*** DESIGN.md v2
- ***Entonces*** define: familia display (free, self-hosted), familia body, y para cada rol (H1..H6, body, label, caption) el tamaño, peso, tracking y line-height
- ***Y*** la regla "display solo en H1/H2" está escrita

### Escenario: disciplina de color documentada

- ***Dado*** DESIGN.md v2
- ***Entonces*** existe una sección que dice explícitamente: verde = estructura, naranja = solo CTA primaria, foto = color extra
- ***Y*** lista qué usos del naranja actual quedan prohibidos (doodles, flourishes, tags)

### Escenario: tokens de superficie, elevación y motion

- ***Dado*** DESIGN.md v2
- ***Entonces*** hay tokens para: superficie clara de card, escala de sombras (mín. 2 niveles), radio, ritmo de espaciado, duraciones y easings de motion

---

### Basi Montes - 9/5/2026, 6:07:07 PM

## PR abierta

PR #282 (base `dev`): https://github.com/BasiMontes/fresco/pull/282

Contrato de disenio v2 (solo `DESIGN.md` + `master-design-plan.md`, sin codigo de app). Tesis, Fraunces en h1/h2, `surface-raised` + hairline en cards, disciplina de color, radios opcion A (pills se mantienen), ritmo de espaciado, tokens de motion. Las cards downstream (438-447) lo aplican a `app/**`.

---


_Synced from Jira by sync-jira-issues_
