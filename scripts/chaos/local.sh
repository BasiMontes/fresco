#!/usr/bin/env bash
# FRESCO-1248: chaos experiments against the LOCAL Supabase stack only.
#
# usage: scripts/chaos/local.sh <baseline|rest-pause|db-restart|edge-stop|edge-pause>
#
# It creates a throwaway user, probes three flows once a second (a PostgREST read, a password login and an Edge
# Function that goes through the database) and injects ONE fault in the middle, printing "<http code>/<seconds>"
# per probe. 000 means no answer before the probe's own timeout. The user is deleted on exit and the fault is
# undone on exit, whatever happens.
#
# Why local only: local, staging and production share one Supabase project (ADR-0020), so a fault injected there
# would be a real incident. The script refuses any API URL that is not 127.0.0.1.
#
# Needs: docker, the supabase CLI, jq, curl, and the stack up (`supabase start`, see docs/workflows/chaos-experiments.md).
set -u

API=http://127.0.0.1:54321
case "$API" in http://127.0.0.1:*) ;; *) echo "refusing: this is not the local stack"; exit 9 ;; esac

STATUS=$(supabase status -o json 2>/dev/null) || { echo "the local stack is not running (supabase start)"; exit 1; }
ANON=$(echo "$STATUS" | jq -r .ANON_KEY)
SERVICE=$(echo "$STATUS" | jq -r .SERVICE_ROLE_KEY)
EMAIL="chaos-$$@example.test"
PASSWORD="Chaos-$(date +%s)-Aa1!x"
USER_ID=""
TOKEN=""
UNDO=""

create_user() {
  USER_ID=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" | jq -r .id)
  TOKEN=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r .access_token)
  if [ -z "$USER_ID" ] || [ "$USER_ID" = null ] || [ "$TOKEN" = null ]; then echo "could not create the test user"; exit 1; fi
}

cleanup() {
  [ -n "$UNDO" ] && eval "$UNDO" >/dev/null 2>&1
  [ -n "$USER_ID" ] && curl -s -o /dev/null -X DELETE "$API/auth/v1/admin/users/$USER_ID" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"
}
trap cleanup EXIT

probe_rest() { curl -s -o /dev/null --max-time 5 -w '%{http_code}/%{time_total}' "$API/rest/v1/recipes?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"; }
probe_auth() { curl -s -o /dev/null --max-time 5 -w '%{http_code}/%{time_total}' -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"; }
# An unknown list id: a healthy function answers 404 after reading the database, so any other code is the fault.
probe_function() { curl -s -o /dev/null --max-time 8 -w '%{http_code}/%{time_total}' -X POST "$API/functions/v1/get-shopping-list-suggestions" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"shopping_list_id":"00000000-0000-0000-0000-000000000000"}'; }

# timeline <label> <total seconds> <fault on at> <fault off at> <fault on command> <fault off command>
timeline() {
  local label=$1 total=$2 on_at=$3 off_at=$4 on_cmd=$5 off_cmd=$6 start t on=0 off=0
  start=$(date +%s)
  UNDO=$off_cmd
  echo "== $label"
  echo "t   rest          auth          function"
  while :; do
    t=$(( $(date +%s) - start ))
    [ "$t" -ge "$total" ] && break
    if [ "$on" = 0 ] && [ "$t" -ge "$on_at" ]; then on=1; echo "--- t=$t fault on: $on_cmd"; eval "$on_cmd" >/dev/null 2>&1; fi
    if [ "$off" = 0 ] && [ "$t" -ge "$off_at" ]; then off=1; echo "--- t=$t fault off: $off_cmd"; eval "$off_cmd" >/dev/null 2>&1; fi
    printf '%-3s %-13s %-13s %s\n' "$t" "$(probe_rest)" "$(probe_auth)" "$(probe_function)"
    sleep 1
  done
}

create_user
case "${1:-}" in
  baseline)
    for _ in 1 2 3 4 5; do echo "rest=$(probe_rest) auth=$(probe_auth) function=$(probe_function)"; sleep 1; done ;;
  rest-pause)
    timeline "PostgREST frozen" 32 4 14 "docker pause supabase_rest_fresco" "docker unpause supabase_rest_fresco" ;;
  db-restart)
    timeline "database container restarted" 55 4 999 "docker restart supabase_db_fresco" "true" ;;
  edge-stop)
    timeline "edge runtime stopped" 34 4 14 "docker stop supabase_edge_runtime_fresco" "docker start supabase_edge_runtime_fresco" ;;
  # FRESCO-1251: a stopped container is not a silent one (the gateway answers 502 by itself after ~25 s, longer than the function
  # probe waits), a frozen process is. Each probe waits its full 8 s here, so the timeline is longer than the others.
  edge-pause)
    timeline "edge runtime frozen" 46 4 22 "docker pause supabase_edge_runtime_fresco" "docker unpause supabase_edge_runtime_fresco" ;;
  *) echo "usage: $0 <baseline|rest-pause|db-restart|edge-stop|edge-pause>"; exit 2 ;;
esac
