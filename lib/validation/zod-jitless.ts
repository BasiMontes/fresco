import { config } from 'zod';

// FRESCO-1042: Zod probes `Function("")` the first time it parses, to learn whether it may compile
// validators. Our enforced CSP has no `'unsafe-eval'`, so the browser blocks the probe (Zod catches
// it and carries on) but still reports it to Sentry's `report-uri`, with the visitor's IP, on every
// page that validates before they have chosen about cookies. `jitless` makes Zod skip the probe;
// validation behaves the same, only a little slower. Loaded for the browser from
// `instrumentation-client.ts`, before any schema runs.
config({ jitless: true });
