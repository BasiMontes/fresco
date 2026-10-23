# ADR-0066 — Launch legal texts: AI-assisted review and accepted risk until revenue pays for a lawyer

- **Status:** Proposed (drafted by AI, 2026-10-23; the founder accepts or rejects it)
- **Date:** 2026-10-23
- **Deciders:** Founder (Basi Montes)
- **Tags:** legal-risk, launch-gate, consent, consumer-law
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The legal texts (Terms, Privacy Policy, Cookies, Legal Notice) and the consent mechanics shipped with FRESCO-794 are provisional (`LEGAL_TEXTS_VERSION` in `lib/legal/consent.ts`). The Definition of Done (`.context/backlog/definition-of-done.md`) closes FRESCO-794, FRESCO-911 and FRESCO-434 only with a lawyer's report attached, or a written decision by the founder to defer it.

The founder has decided (2026-10-23): no money for a lawyer until there is real revenue and profitability. Stripe is still in test mode and no real user is charged.

An AI-assisted analysis of ten concrete questions exists: `.context/legal/FRESCO-794-analisis-asistido-por-ia.md`. It is not a lawyer's opinion: the author is not a bar member, carries no professional liability and cites norms from memory.

## Decision

We will treat the AI-assisted analysis as the interim review and record the residual risk as accepted by the founder, instead of waiting for a paid opinion before anything else.

1. **No misleading label.** The analysis is never called a "lawyer's report" in Jira, the UI, a document or a commit. Tickets that need "informe de abogado" close through this ADR's written deferral, not through that wording.
2. **What this waives.** Only the gate "signed lawyer's report attached". It does not waive any other gate of FRESCO-911.
3. **Gates that stay in force before charging real users:**
   - Alta as autónomo, and the NIF and a full address published in `lib/legal/entity.ts` (analysis, answer 6).
   - A subscription confirmation that actually reaches the customer (FRESCO-1005, FRESCO-988).
   - Vercel Pro (Hobby forbids commercial use) and Supabase Pro.
4. **Apply the analysis' low-cost fixes** (liability cap for consumers, withdrawal wording, consent display) in small PRs, each with a version bump of `LEGAL_TEXTS_VERSION`.
5. **Review trigger.** Commission a targeted paid review, limited to provider identification and withdrawal, when the first of these happens: cumulative revenue covers its cost; a complaint or a contact from the AEPD or a consumer body; or the number of paying users reaches a threshold. The amount and the threshold are the founder's to set when accepting this ADR: `[owner to set]`.

## Consequences

- **Positive:** the launch path no longer waits on money that depends on the launch; the risk is written down with an owner instead of being implicit.
- **Negative / trade-offs:** if a text is wrong, Fresco has no professional opinion to point to, and a sanction or a nullity falls on the founder. The analysis can be mistaken on article numbers and on current doctrine.
- **Neutral / follow-ups:** FRESCO-794, FRESCO-856, FRESCO-1021, FRESCO-911 and FRESCO-434 reference this ADR as their deferral decision once it is Accepted. Revoke by superseding this ADR the day a lawyer's report exists.
