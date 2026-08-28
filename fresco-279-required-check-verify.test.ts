import { expect, test } from 'bun:test';

// THROWAWAY — FRESCO-279 verification only. This test fails on purpose so the
// `test:unit` required status check goes red on its PR, proving that branch
// protection on `dev` blocks the merge. Delete this file (and its PR) once the
// blocked-merge state is confirmed; it must never reach `dev`.
test('FRESCO-279: intentionally failing check to verify branch protection blocks merge', () => {
  expect(true).toBe(false);
});
