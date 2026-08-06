import antfu from '@antfu/eslint-config';

export default antfu({
  // TypeScript configuration
  typescript: {
    tsconfigPath: 'tsconfig.json',
  },

  // Less opinionated mode for easier adoption
  lessOpinionated: true,

  // Ignore patterns
  ignores: [
    'node_modules',
    'dist',
    'test-results',
    'playwright-report',
    'allure-results',
    'allure-report',
    'reports',
    'cli/legacy/**',
    '*.min.js',
    // Documentation files (contain code examples that shouldn't be linted)
    '**/*.md',
    // GitHub workflows (YAML files)
    '.github/**',
    // Generated files (auto-generated, not manually edited)
    'api/openapi-types.ts',
    // Supabase Database types written by `bun run db:types` (`supabase gen
    // types typescript`, per package.json). Large machine-generated
    // snake_case file — linting it produces noise and `eslint --fix` would
    // diverge it from the generator. Found live 2026-07-31: this entry
    // previously pointed at a stale `src/types/supabase.ts` path that
    // doesn't exist in this project — `db:types` had never been run before,
    // so the mismatch stayed latent until the first real regeneration.
    'lib/supabase/types.ts',
    // boneyard-js CLI output (`npx boneyard-js build`, per its own header
    // comment "do not edit"). Same reasoning as lib/supabase/types.ts above
    // — machine-generated, re-running the CLI would just diverge it again.
    'bones/**',
    // Git worktrees placed under .claude/worktrees/ are another branch's full
    // checkout — never lint another tree from this one.
    '.claude/worktrees/**',
    // Skill directories — never lint.
    // T1 skills (.claude/skills/) and community T3/T4 skills (.agents/skills/,
    // installed at scaffold-time by `bunx skills add`) ship their .md/.json/.ts
    // as-is. ESLint must not touch them: their schemas, frontmatter, fenced
    // code blocks, and example snippets rely on exact formatting we don't own.
    '.claude/skills/**',
    '.agents/skills/**',
    // MCP reference templates — syntax-sensitive opt-in configs. Linting them
    // (e.g. toml/array-bracket-newline) corrupts the layout users copy from.
    'docs/mcp/**',
    // Supabase Edge Functions run on Deno, a separate runtime from this
    // project's Bun/Node TypeScript project (tsconfig.json excludes this
    // directory for the same reason — `npm:`-specifier imports and Deno
    // globals like `Deno.serve`/`Deno.env` aren't resolvable by this
    // project's typescript-eslint project service). Lint these with `deno
    // lint` / `deno fmt` instead, not this project's ESLint config.
    'supabase/functions/**',
    // Impeccable design-hook cache — local-only (ignored via
    // .git/info/exclude, not the shared .gitignore), machine-written on
    // every post-edit hook run. ESLint's own ignore glob (like Prettier's
    // .prettierignore) doesn't fall back to .gitignore, so without this it
    // lints a local tool cache no one else's checkout even has.
    '.impeccable/**',
  ],

  // Custom rules
  rules: {
    // Allow console for test logging
    'no-console': 'off',

    // TypeScript specific - strict but practical
    'ts/explicit-function-return-type': 'off',
    'ts/explicit-module-boundary-types': 'off',
    'ts/no-explicit-any': 'warn',
    // Required for @atc decorator flexibility
    'ts/no-unsafe-assignment': 'off',
    'ts/no-unsafe-return': 'off',
    'ts/no-unsafe-member-access': 'off',
    'ts/no-unsafe-argument': 'off',
    'ts/no-unsafe-call': 'off',
    // Disabled: requires type info for all files including JSON
    'ts/switch-exhaustiveness-check': 'off',
    // Disabled: too strict for config files, requires explicit boolean checks
    'ts/strict-boolean-expressions': 'off',

    // Node.js globals - standard in Bun/Node environment
    'node/prefer-global/buffer': 'off',
    'node/prefer-global/process': 'off',

    // Style preferences
    'style/semi': ['error', 'always'],
    'style/quotes': ['error', 'single'],
    'style/comma-dangle': ['error', 'always-multiline'],
    'style/max-statements-per-line': 'off',
    // Disabled: conflicts with Prettier YAML formatting (Prettier owns YAML style)
    'yaml/flow-mapping-curly-spacing': 'off',
    // Disabled: conflicts with Prettier JSONC formatting (Prettier adds trailing commas
    // in opencode.jsonc which this rule rejects). Prettier owns JSONC style.
    'jsonc/comma-dangle': 'off',

    // Allow unused vars with underscore prefix
    'unused-imports/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
});
