/**
 * FRESCO-1017 (audit 7b, A7-SUPPLY-05): the weekly refresh of `lib/grocery/mercadona-catalog.generated.ts`
 * reads a community dataset on Hugging Face. `resolve/main` is whatever its maintainer last pushed, and it
 * can change between the freshness check and the download. The refresh workflow resolves the dataset's
 * commit once (`check-mercadona-dataset-freshness.ts`) and hands that exact SHA to the generator, so the
 * check and the download read the same revision, and the PR body names it for the reviewer.
 *
 * With no revision set (a local run, `refresh-supermarket-prices.ts`) the generator keeps reading `main`.
 */

const COMMIT_SHA = /^[0-9a-f]{40}$/;

const DATASET_URL = 'https://huggingface.co/datasets/datania/mercadona-catalog';

export const REVISION_ENV = 'MERCADONA_DATASET_REVISION';

/** A full 40-character commit SHA. A branch name, a tag or a short SHA can move or collide. */
export function isCommitSha(value: unknown): boolean {
  return typeof value === 'string' && COMMIT_SHA.test(value);
}

/** The revision the generator reads: the env SHA when set (fail-closed if malformed), else `main`. */
export function datasetRevision(env: Record<string, string | undefined> = process.env): string {
  const raw = env[REVISION_ENV];
  if (raw === undefined || raw === '') { return 'main'; }
  if (!isCommitSha(raw)) {
    throw new Error(`${REVISION_ENV} must be a 40-character commit SHA, got "${raw.slice(0, 60)}"`);
  }
  return raw;
}

export function datasetBase(revision: string): string {
  return `${DATASET_URL}/resolve/${revision}`;
}

export function datasetTreeUrl(revision: string): string {
  return `${DATASET_URL}/tree/${revision}`;
}
