/**
 * FRESCO-1169 (integral review F2): which Edge Functions require a session (`verify_jwt`) is declared in
 * `supabase/config.toml`, one `[functions.<slug>]` block per function, and read from there.
 *
 * It used to live only in a flag of `scripts/deploy-changed-functions.ts` (`NO_VERIFY_JWT`), so a manual
 * deploy or a change in the dashboard could flip it without the repo noticing. The block is now the source of
 * truth: the deploy script reads it, the weekly hosted check compares the live value of every function with
 * it, and a test cross-checks it against what each function's code actually does.
 *
 * Pure: no network, no file access (callers pass the text), so each piece is testable.
 */

export type VerifyJwtDeclarations = Record<string, boolean>;

/**
 * The `verify_jwt` of every `[functions.<slug>]` block. Throws on a block without a boolean `verify_jwt`:
 * "declared but unreadable" is the failure this exists to end, so it can never count as a pass.
 */
export function readDeclaredVerifyJwt(configToml: string): VerifyJwtDeclarations {
  const parsed = Bun.TOML.parse(configToml) as { functions?: Record<string, { verify_jwt?: unknown }> };
  const declared: VerifyJwtDeclarations = {};
  for (const [slug, block] of Object.entries(parsed.functions ?? {})) {
    if (typeof block?.verify_jwt !== 'boolean') {
      throw new TypeError(`supabase/config.toml: [functions.${slug}] has no boolean verify_jwt (got ${JSON.stringify(block?.verify_jwt) ?? 'undefined'})`);
    }
    declared[slug] = block.verify_jwt;
  }
  return declared;
}

/** The arguments of `supabase functions deploy` for one function. `--no-verify-jwt` exactly when it is declared false. */
export function deployArgs({ slug, projectRef, importMap, verifyJwt }: { slug: string, projectRef: string, importMap: string, verifyJwt: boolean }): string[] {
  const args = ['functions', 'deploy', slug, '--project-ref', projectRef, '--use-api', '--import-map', importMap];
  if (!verifyJwt) {
    args.push('--no-verify-jwt');
  }
  return args;
}

/**
 * Compares the live functions (the Management API list, `GET /v1/projects/{ref}/functions`) with the
 * declarations. One human line per finding; empty means clean. Fails closed: a live function whose
 * `verify_jwt` is not a boolean cannot be verified, and that is a finding.
 */
export function evaluateFunctionSettings(live: unknown, declared: VerifyJwtDeclarations): string[] {
  if (!Array.isArray(live)) {
    return [`functions: the Management API did not return a list (got ${typeof live}), cannot be verified`];
  }
  const findings: string[] = [];
  const liveBySlug = new Map<string, unknown>();
  for (const entry of live as Array<{ slug?: unknown, verify_jwt?: unknown }>) {
    if (typeof entry?.slug === 'string') {
      liveBySlug.set(entry.slug, entry.verify_jwt);
    }
  }

  for (const [slug, expected] of Object.entries(declared).sort(([a], [b]) => a.localeCompare(b))) {
    if (!liveBySlug.has(slug)) {
      findings.push(`function ${slug}: declared in supabase/config.toml (verify_jwt = ${expected}) but not deployed to the hosted project`);
      continue;
    }
    const value = liveBySlug.get(slug);
    if (typeof value !== 'boolean') {
      findings.push(`function ${slug}: verify_jwt not returned as a boolean (got ${JSON.stringify(value) ?? 'undefined'}), cannot be verified. Declared ${expected}`);
    }
    else if (value !== expected) {
      findings.push(`function ${slug}: verify_jwt is ${value} on the hosted project, declared ${expected} in supabase/config.toml. Redeploy it (bun scripts/deploy-changed-functions.ts) or, if the change is intended, edit the declaration with its reason`);
    }
  }

  for (const slug of [...liveBySlug.keys()].sort()) {
    if (!(slug in declared)) {
      findings.push(`function ${slug}: deployed to the hosted project with no [functions.${slug}] block in supabase/config.toml, so nothing says whether it must require a session`);
    }
  }
  return findings;
}
