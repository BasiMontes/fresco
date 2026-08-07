# Comments for FRESCO-90

[View in Jira](https://basiliomontescastano.atlassian.net/browse/FRESCO-90)

---

### Basi Montes - 8/7/2026, 11:43:23 AM

## Spec Implementation Plan (Dev)

Root cause: sidebar-account.tsx's handleLogout llamaba signOut() directo sin distinguir sesión anónima de cuenta real — para invitada, logout invalida la sesión anónima y todo dato real ligado a ella (meal_plans) queda inalcanzable, sin ninguna advertencia distinta al logout normal (100% seguro para cuenta real).

Fix: nuevo `isAnonymous` en AccountUser (threaded desde `user.is_anonymous` en app/(app)/layout.tsx -> Sidebar -> SidebarAccount). Nuevo components/layout/guest-logout-dialog.tsx (mismo patrón que delete-account-dialog.tsx) — solo se monta/gatea cuando isAnonymous. Click en logout: invitada abre el diálogo primero, cuenta real sale directo (sin cambio de comportamiento).

Verificado en vivo: invitada con menú generado → click logout → diálogo, no redirige; confirmar → redirige a /login. Cuenta real → logout directo, sin diálogo (comportamiento preexistente intacto).

---


_Synced from Jira by sync-jira-issues_
