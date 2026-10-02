#!/bin/sh
# FRESCO-804 — Vercel "Ignored Build Step" (wired in vercel.json `ignoreCommand`).
# Exit 0 = skip this build, exit 1 = build. A deploy is skipped only when
# NOTHING the app is built from changed since the last successful deploy of
# this branch (VERCEL_GIT_PREVIOUS_SHA). Docs, tests, CI, agent tooling and
# `.context` commits never change the product, yet each one used to cost three
# deploys (dev + staging + main) against the Free plan's 100/day cap.
#
# Fails OPEN on purpose: no previous SHA (first deploy of a branch), a SHA
# missing from the clone, or any git error all mean "build". The worst case is
# one extra deploy, never a skipped one that carried code.
#
# It lists what to IGNORE, not what to build: a new top-level directory builds
# by default instead of being silently skipped.

[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] || exit 1
git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude).agents' \
  ':(exclude).claude' \
  ':(exclude).codex' \
  ':(exclude).context' \
  ':(exclude).github' \
  ':(exclude).husky' \
  ':(exclude).impeccable' \
  ':(exclude).opencode' \
  ':(exclude).template' \
  ':(exclude).vscode' \
  ':(exclude)docs' \
  ':(exclude)design' \
  ':(exclude)tasks' \
  ':(exclude)tests' \
  ':(exclude,glob)*.md' \
  ':(exclude,glob)**/*.test.ts' \
  ':(exclude,glob)**/*.test.tsx' \
  ':(exclude)bun-test-setup.ts' \
  ':(exclude)playwright.config.ts'
