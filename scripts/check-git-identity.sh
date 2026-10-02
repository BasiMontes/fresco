#!/bin/sh
# FRESCO-828 — reject a commit whose author or committer identity is a test
# placeholder (`*@example.com`). Between 9 Sep and 1 Oct 2026, 86 commits reached
# `main` as `test <test@example.com>` because a repo-local override in
# `.git/config` shadowed the real global identity, so GitHub attributed them to
# nobody and security fixes (FRESCO-736, FRESCO-738) lost their trail.
#
# Reads `git var` (what git will actually write, env overrides included), so it
# catches the local-config case and `GIT_AUTHOR_EMAIL=` alike.
# Exit 0 = ok, 1 = rejected.

for var in GIT_AUTHOR_IDENT GIT_COMMITTER_IDENT; do
  ident=$(git var "$var" 2>/dev/null) || continue
  case "$ident" in
    *@example.com\>*)
      echo ""
      echo "❌ $var is a placeholder identity: ${ident%% [0-9]*}"
      echo "   A repo-local [user] section in .git/config usually shadows the global one."
      echo "   Fix:  git config --local --unset user.name && git config --local --unset user.email"
      echo "   Check: git config --show-origin user.email"
      exit 1
      ;;
  esac
done
exit 0
