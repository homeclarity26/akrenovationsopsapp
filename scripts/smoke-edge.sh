#!/bin/bash
# Smoke-test every deployed edge function with a minimal POST.
# Records status + first 100 chars of body for each. 500s = bugs.
set -u

PAT=$(grep -oE "sbp_[a-zA-Z0-9]{40,}" /Users/adamkilgore/.claude/projects/-Users-adamkilgore-Desktop-AKR---BUSINESS-APP/memory/infrastructure_state.md | head -1)
SR=$(curl -sS -H "Authorization: Bearer $PAT" "https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/api-keys?reveal=true" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(k['api_key'] for k in d if k.get('name')=='service_role' and k['type']=='legacy'))")
URL="https://mebzqfeeiciayxdetteb.supabase.co"

FUNCS=$(curl -sS -H "Authorization: Bearer $PAT" "https://api.supabase.com/v1/projects/mebzqfeeiciayxdetteb/functions" | python3 -c "import sys,json;[print(r['slug']) for r in json.load(sys.stdin) if r['status']=='ACTIVE']")

LOG=/tmp/edge_smoke.log
> "$LOG"

for slug in $FUNCS; do
  resp=$(curl -sS -o /tmp/_body -w "%{http_code}" -X POST \
    -H "apikey: $SR" \
    -H "Authorization: Bearer $SR" \
    -H "Content-Type: application/json" \
    -d '{}' \
    --max-time 10 \
    "$URL/functions/v1/$slug" 2>&1)
  body=$(head -c 200 /tmp/_body | tr '\n' ' ')
  echo "$resp | $slug | $body" | tee -a "$LOG"
done
