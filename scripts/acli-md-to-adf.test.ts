// `bun test` does not descend into dot-directories, so the md-to-adf suite that
// lives next to its script under `.agents/skills/acli/scripts/` never ran in
// the full suite or in CI. Importing it here registers its tests, so the
// converter that `plan-templates-adf-budget.test.ts` loads is exercised by its
// own tests and counts as covered in the coverage ratchet.
import '../.agents/skills/acli/scripts/md-to-adf.test.ts';
