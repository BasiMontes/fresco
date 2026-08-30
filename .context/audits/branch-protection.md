# Branch protection snapshot

> Captured 2026-08-30 via `gh api repos/BasiMontes/fresco/branches/<branch>/protection`.
> Purpose: give auditors (and any clone-only reader) visibility into GitHub required checks — FRESCO-319 blind spot #3.
> Regenerate: `gh api repos/BasiMontes/fresco/branches/main/protection`.

## `main`

```json
{
  "url": "https://api.github.com/repos/BasiMontes/fresco/branches/main/protection",
  "required_status_checks": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/main/protection/required_status_checks",
    "strict": false,
    "contexts": [
      "repo:check",
      "test:unit",
      "test:e2e"
    ],
    "contexts_url": "https://api.github.com/repos/BasiMontes/fresco/branches/main/protection/required_status_checks/contexts",
    "checks": [
      {
        "context": "repo:check",
        "app_id": 15368
      },
      {
        "context": "test:unit",
        "app_id": 15368
      },
      {
        "context": "test:e2e",
        "app_id": 15368
      }
    ]
  },
  "required_signatures": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/main/protection/required_signatures",
    "enabled": false
  },
  "enforce_admins": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/main/protection/enforce_admins",
    "enabled": false
  },
  "required_linear_history": {
    "enabled": false
  },
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  },
  "block_creations": {
    "enabled": false
  },
  "required_conversation_resolution": {
    "enabled": false
  },
  "lock_branch": {
    "enabled": false
  },
  "allow_fork_syncing": {
    "enabled": false
  }
}
```

## `staging`

```json
{
  "url": "https://api.github.com/repos/BasiMontes/fresco/branches/staging/protection",
  "required_status_checks": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/staging/protection/required_status_checks",
    "strict": false,
    "contexts": [
      "repo:check",
      "test:unit",
      "test:e2e"
    ],
    "contexts_url": "https://api.github.com/repos/BasiMontes/fresco/branches/staging/protection/required_status_checks/contexts",
    "checks": [
      {
        "context": "repo:check",
        "app_id": 15368
      },
      {
        "context": "test:unit",
        "app_id": 15368
      },
      {
        "context": "test:e2e",
        "app_id": 15368
      }
    ]
  },
  "required_signatures": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/staging/protection/required_signatures",
    "enabled": false
  },
  "enforce_admins": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/staging/protection/enforce_admins",
    "enabled": false
  },
  "required_linear_history": {
    "enabled": false
  },
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  },
  "block_creations": {
    "enabled": false
  },
  "required_conversation_resolution": {
    "enabled": false
  },
  "lock_branch": {
    "enabled": false
  },
  "allow_fork_syncing": {
    "enabled": false
  }
}
```

## `dev`

```json
{
  "url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection",
  "required_status_checks": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection/required_status_checks",
    "strict": false,
    "contexts": [
      "repo:check",
      "test:unit",
      "test:e2e"
    ],
    "contexts_url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection/required_status_checks/contexts",
    "checks": [
      {
        "context": "repo:check",
        "app_id": 15368
      },
      {
        "context": "test:unit",
        "app_id": 15368
      },
      {
        "context": "test:e2e",
        "app_id": 15368
      }
    ]
  },
  "required_pull_request_reviews": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection/required_pull_request_reviews",
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "required_signatures": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection/required_signatures",
    "enabled": false
  },
  "enforce_admins": {
    "url": "https://api.github.com/repos/BasiMontes/fresco/branches/dev/protection/enforce_admins",
    "enabled": false
  },
  "required_linear_history": {
    "enabled": false
  },
  "allow_force_pushes": {
    "enabled": false
  },
  "allow_deletions": {
    "enabled": false
  },
  "block_creations": {
    "enabled": false
  },
  "required_conversation_resolution": {
    "enabled": false
  },
  "lock_branch": {
    "enabled": false
  },
  "allow_fork_syncing": {
    "enabled": false
  }
}
```

