#!/usr/bin/env bash
# FRESCO-1248: chaos experiments against the LOCAL Supabase stack only.
#
# usage: scripts/chaos/local.sh <baseline|flows|rest-pause|db-restart|edge-stop|edge-pause>
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
BODY=$(mktemp)

create_user() {
  USER_ID=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" | jq -r .id)
  TOKEN=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r .access_token)
  if [ -z "$USER_ID" ] || [ "$USER_ID" = null ] || [ "$TOKEN" = null ]; then echo "could not create the test user"; exit 1; fi
}

cleanup() {
  rm -f "$BODY"
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

# FRESCO-1251 phase 2: the four user flows end to end, each with the criterion written in docs/workflows/chaos-experiments.md.
# A 2xx says the request was well formed, not that the thing happened, so every flow reads its result back from the destination.
MAX_LOGIN=1 MAX_MENU=3 MAX_LISTA=2 MAX_MARCA=1
FLOWS_FAILED=0

# verdict <flow> <seconds> <max seconds> <result ok: 1|0> <detail>
verdict() {
  local name=$1 secs=$2 max=$3 ok=$4 detail=$5 v=OK
  if [ "$ok" != 1 ]; then v=FAIL; elif awk -v s="$secs" -v m="$max" 'BEGIN { exit !(s > m) }'; then v=SLOW; fi
  printf '%-16s %-9s max %-4s %-5s %s\n' "$name" "${secs}s" "${max}s" "$v" "$detail"
  [ "$v" = OK ] || FLOWS_FAILED=1
}

# timed_curl <body file> <curl args...>: prints "<http code> <seconds>" and leaves the body in the file.
timed_curl() { local out=$1; shift; curl -s -o "$out" --max-time 15 -w '%{http_code} %{time_total}' "$@"; }

flows() {
  local out code secs ok tok plan list slots items week monday
  read -r week monday <<<"$(python3 -c 'import datetime as d;t=d.date.today();m=t-d.timedelta(days=t.weekday());i=m.isocalendar();print(f"{i[0]}-W{i[1]:02d}",m)')"
  echo "== flows (week $week, throwaway user)"

  # login: what the access form does on the server side.
  out=$(timed_curl "$BODY" -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  code=${out% *}; secs=${out#* }; tok=$(jq -r '.access_token // empty' "$BODY")
  ok=0; [ "$code" = 200 ] && [ -n "$tok" ] && ok=1
  verdict login "$secs" "$MAX_LOGIN" "$ok" "http $code, token $([ -n "$tok" ] && echo yes || echo no)"
  [ "$ok" = 1 ] && TOKEN=$tok

  # setup, not a flow: the onboarding saves the profile before generating.
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/rest/v1/user_profiles?on_conflict=id" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -H 'Prefer: resolution=merge-duplicates,return=minimal' \
    -d "{\"id\":\"$USER_ID\",\"num_personas\":2,\"adultos\":2,\"ninos\":0,\"dieta_vegetariano\":false,\"dieta_vegano\":false,\"dieta_sin_gluten\":false,\"dieta_sin_lactosa\":false,\"dieta_sin_huevo\":false,\"dieta_keto\":false,\"dieta_halal\":false,\"alergenos\":[],\"ingredientes_odiados\":[],\"cocinas_favoritas\":[\"española\"]}")
  case "$code" in 200|201|204) ;; *) echo "setup: the profile upsert answered $code, the next flows cannot run"; FLOWS_FAILED=1; return ;; esac

  # generar-menu: the plan and its 21 slots must be in the database.
  out=$(timed_curl "$BODY" -X POST "$API/functions/v1/generate-meal-plan" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"semana_iso\":\"$week\",\"fecha_inicio\":\"$monday\"}")
  code=${out% *}; secs=${out#* }; plan=$(jq -r '.meal_plan_id // empty' "$BODY")
  slots=0; [ -n "$plan" ] && slots=$(curl -s "$API/rest/v1/meal_plan_recipes?meal_plan_id=eq.$plan&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" | jq 'length' 2>/dev/null || echo 0)
  ok=0; [ "$code" = 200 ] && [ -n "$plan" ] && [ "$slots" = 21 ] && ok=1
  verdict generar-menu "$secs" "$MAX_MENU" "$ok" "http $code, $slots slots in the database"
  [ "$ok" = 1 ] || return

  # abrir-lista: the list is generated and the page can read it back with at least one product.
  out=$(timed_curl "$BODY" -X POST "$API/functions/v1/generate-shopping-list" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"meal_plan_id\":\"$plan\"}")
  code=${out% *}; secs=${out#* }; list=$(jq -r '.shopping_list_id // empty' "$BODY")
  out=$(timed_curl "$BODY" "$API/rest/v1/shopping_lists?meal_plan_id=eq.$plan&select=id,items" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN")
  secs=$(awk -v a="$secs" -v b="${out#* }" 'BEGIN { printf "%.3f", a + b }')
  items=$(jq '[.[0].items[]?.items[]?] | length' "$BODY" 2>/dev/null || echo 0)
  ok=0; [ "$code" = 200 ] && [ -n "$list" ] && [ "${out% *}" = 200 ] && [ "${items:-0}" -gt 0 ] && ok=1
  verdict abrir-lista "$secs" "$MAX_LISTA" "$ok" "http $code, $items products read back"
  [ "$ok" = 1 ] || return

  # marcar-producto: ticks the first product and reads it back.
  out=$(timed_curl /dev/null -X POST "$API/rest/v1/rpc/jsonb_set_comprado" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"p_list_id\":\"$list\",\"p_pasillo_idx\":0,\"p_item_idx\":0,\"p_comprado\":true}")
  code=${out% *}; secs=${out#* }
  ticked=$(curl -s "$API/rest/v1/shopping_lists?id=eq.$list&select=items" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].items[0].items[0].comprado' 2>/dev/null)
  ok=0; [ "$code" = 204 ] && [ "$ticked" = true ] && ok=1
  verdict marcar-producto "$secs" "$MAX_MARCA" "$ok" "http $code, comprado=$ticked read back"
}

create_user
case "${1:-}" in
  baseline)
    for _ in 1 2 3 4 5; do echo "rest=$(probe_rest) auth=$(probe_auth) function=$(probe_function)"; sleep 1; done ;;
  flows)
    flows; exit "$FLOWS_FAILED" ;;
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
  *) echo "usage: $0 <baseline|flows|rest-pause|db-restart|edge-stop|edge-pause>"; exit 2 ;;
esac
