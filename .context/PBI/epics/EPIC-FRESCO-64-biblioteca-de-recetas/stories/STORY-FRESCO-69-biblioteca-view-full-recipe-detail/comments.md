# Comments for FRESCO-69

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-69)

---

### Basi Montes - 8/3/2026, 4:00:22 PM

## Scope

- Laura can open any recipe card in the Biblioteca (catalog or personal) and see its full detail
- A catalog recipe's detail shows its ingredients, preparation steps, estimated time, difficulty, and diet/allergen tags
- A personal recipe's detail shows its name, ingredients, and preparation steps
- Laura can return to the Biblioteca from the detail view

---

### Basi Montes - 8/3/2026, 4:00:26 PM

## Out Of Scope

- Editing or deleting a recipe from the detail view
- Rating or reviewing a recipe
- Adding a recipe directly to the weekly menu from this view
- Sharing the recipe detail with others

---

### Basi Montes - 8/3/2026, 4:00:33 PM

## Acceptance Criteria

```gherkin
Scenario: View catalog recipe detail
Given Laura is browsing the Biblioteca
When she opens a catalog recipe
Then she sees its name, ingredients, preparation steps, estimated time, difficulty, and diet/allergen tags

Scenario: View personal recipe detail
Given Laura has a personal recipe in her Biblioteca
When she opens it
Then she sees its name, ingredients, and preparation steps, distinguishable as her own recipe

Scenario: Return to the Biblioteca
Given Laura is viewing a recipe's detail
When she chooses to go back
Then she returns to the Biblioteca where she was browsing
```


---

### Basi Montes - 8/3/2026, 4:00:38 PM

## Business Rules Specification

- A personal recipe's detail is visible only to the user who created it (same as its Biblioteca card, FRESCO-68).
- A catalog recipe's detail only shows a recipe within Laura's food-safety profile (same scoping as the Biblioteca grid, FRESCO-9/FRESCO-65).

---


_Synced from Jira by sync-jira-issues_
