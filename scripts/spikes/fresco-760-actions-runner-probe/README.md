# FRESCO-760 spike: can a GitHub Actions runner reach the supermarkets?

Phase 2 of FRESCO-747. The plan is a weekly price refresh run from GitHub
Actions, for at most 6 chains. The open risk: runner IPs belong to a
datacenter and many antibot systems block those even at low volume. This
spike measures it before any scraper is built.

**Scope guard.** ADR-0028 (Proposed) keeps production use of these endpoints
gated on a founder decision about the chains' terms of use. This spike makes
one request per chain per run, stores no data, and is manual only
(`workflow_dispatch`).

## Chains

| Chain | Target | Kind |
|---|---|---|
| Mercadona | `tienda.mercadona.es/api/categories/` | known public JSON endpoint (FRESCO-531) |
| Carrefour | `carrefour.es/supermercado` | public landing page |
| Dia | `dia.es/compra-online` | public landing page |
| Alcampo | `compraonline.alcampo.es/` | public landing page |
| Lidl | `lidl.es/` | public landing page |
| Bonpreu | `compraonline.bonpreuesclat.cat/` | public landing page |

Discarded: Aldi (`aldi.es` states it has no online store), Family Cash and
Cash Fresh (online presence is flyers only, no product catalog with prices).
Aldi can be reopened if its app exposes a catalog endpoint.

Only Mercadona has a known catalog endpoint. For the others the probe tests
that the runner can load the public page at all, which is the question this
spike answers. Finding each chain's real catalog endpoint needs a headed
browser devtools trace and belongs to the build phase.

## Method (stop at the first step that works for every chain)

1. `--mode=http`: plain `fetch` from a GitHub-hosted runner.
2. `--mode=browser`: Playwright Chromium, same targets.
3. Self-hosted runner on an owned machine (residential IP). Only the
   `runs-on` label changes; the workflow is the same.

Rejected up front: paid residential proxies (monthly cost, worse legal
posture).

## Running it

```bash
# local baseline
bun scripts/spikes/fresco-760-actions-runner-probe/probe.ts --mode=http

# from a runner: Actions tab > spike-supermarket-probe > Run workflow
```

A response counts as blocked on `403`, `429`, or a small body carrying a
challenge marker (`captcha`, `access denied`, `just a moment`, ...). Large
2xx pages are clean: the markers also appear in the chains' own scripts.

## Results

### Local baseline (home IP, 2026-10-01)

| Chain | Status | Signal |
|---|---|---|
| Mercadona | 200 | none |
| Carrefour | 200 | none |
| Dia | 200 | none |
| Alcampo | 200 | none |
| Lidl | 200 | none |
| Bonpreu | 200 | none |

### GitHub-hosted runner, `http`

_Pending: run the workflow once the branch is on the default branch._

### GitHub-hosted runner, `browser`

_Pending, only if `http` shows blocks._

## Outcome

_Table of chain, method that worked and step where it was resolved, filled
after the runs._
