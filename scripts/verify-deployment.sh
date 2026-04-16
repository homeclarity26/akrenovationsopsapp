#!/usr/bin/env bash
# verify-deployment.sh
# ---------------------------------------------------------------------------
# Generates DEPLOYMENT_CHECKLIST.md at the repo root.
# Checks: migrations, edge functions, cron schedules, rate limits.
# Does NOT require live DB access — produces a human-verifiable checklist.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/DEPLOYMENT_CHECKLIST.md"
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
RATE_LIMIT_FILE="$FUNCTIONS_DIR/_shared/rate-limit.ts"
WORKFLOW_FILE="$REPO_ROOT/.github/workflows/deploy-edge-functions.yml"

# ─── Counts ──────────────────────────────────────────────────────────────────
migration_count=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
fn_count=$(find "$FUNCTIONS_DIR" -maxdepth 2 -name 'index.ts' | sed 's|/index.ts||' | xargs -I{} basename {} | grep -v '^_' | wc -l | tr -d ' ')

# ─── Start output ────────────────────────────────────────────────────────────
cat > "$OUT" <<HEADER
# Deployment Checklist

Generated: $(date -u '+%Y-%m-%d %H:%M UTC')
Project: \`mebzqfeeiciayxdetteb\`

---

## 1. Migrations ($migration_count files)

Verify each migration has been applied in the Supabase dashboard under
**Database > Migrations**. Check the box once confirmed.

| # | Migration file | Applied? |
|---|---------------|----------|
HEADER

i=1
for f in "$MIGRATIONS_DIR"/*.sql; do
  name=$(basename "$f")
  echo "| $i | \`$name\` | [ ] |" >> "$OUT"
  i=$((i + 1))
done

# ─── Edge Functions ──────────────────────────────────────────────────────────
cat >> "$OUT" <<SECTION

---

## 2. Edge Functions ($fn_count deployable)

The GitHub Actions workflow (\`.github/workflows/deploy-edge-functions.yml\`)
dynamically deploys all function directories (skipping \`_shared\`).
Verify each function is deployed in **Supabase Dashboard > Edge Functions**.

| # | Function | In workflow? | Deployed? |
|---|----------|-------------|-----------|
SECTION

i=1
for fn_dir in "$FUNCTIONS_DIR"/*/; do
  fn=$(basename "$fn_dir")
  [[ "$fn" == _* ]] && continue
  [[ ! -f "$fn_dir/index.ts" ]] && continue

  # Workflow uses dynamic loop, so all are included
  in_workflow="Yes (dynamic)"
  echo "| $i | \`$fn\` | $in_workflow | [ ] |" >> "$OUT"
  i=$((i + 1))
done

# ─── Cron Schedules ──────────────────────────────────────────────────────────
cat >> "$OUT" <<SECTION

---

## 3. Cron Schedules

Extracted from migration files. Verify each is active in **Supabase Dashboard >
Database > Extensions > pg_cron** (or via \`SELECT * FROM cron.job;\`).

| # | Job name | Schedule | Target function | Migration file | Active? |
|---|----------|----------|----------------|----------------|---------|
SECTION

i=1
grep -rn "cron\.schedule(" "$MIGRATIONS_DIR"/*.sql | while IFS= read -r line; do
  file=$(echo "$line" | sed "s|$MIGRATIONS_DIR/||" | cut -d: -f1)
  # Extract job name (first string arg to cron.schedule)
  job_name=$(echo "$line" | grep -o "'[^']*'" | head -1 | tr -d "'" 2>/dev/null || true)
  # Skip lines where the args are on the next line (e.g. PERFORM cron.schedule(\n  'name', ...)
  [[ -z "$job_name" ]] && continue
  # Extract schedule (second string arg)
  schedule=$(echo "$line" | grep -o "'[^']*'" | sed -n '2p' | tr -d "'" 2>/dev/null || true)
  # If schedule is empty, look at the next few lines of the file for the schedule
  if [[ -z "$schedule" ]]; then
    schedule=$(grep -A3 "$job_name" "$MIGRATIONS_DIR/$file" 2>/dev/null | grep -o "'[^']*'" | sed -n '2p' | tr -d "'" 2>/dev/null || true)
  fi
  # Extract target function from the URL pattern
  target_fn=$(grep -A8 "$job_name" "$MIGRATIONS_DIR/$file" 2>/dev/null | grep -o "functions/v1/[a-z0-9_-]*" | head -1 | sed 's|functions/v1/||' 2>/dev/null || true)
  # If no function URL found (e.g. plain SQL cron), note it
  if [[ -z "$target_fn" ]]; then
    target_fn="(SQL function)"
  fi
  echo "| $i | \`$job_name\` | \`$schedule\` | \`$target_fn\` | \`$file\` | [ ] |" >> "$OUT"
  i=$((i + 1))
done

# ─── Rate Limits ─────────────────────────────────────────────────────────────
cat >> "$OUT" <<SECTION

---

## 4. Rate Limit Coverage

Functions with an explicit entry in \`_shared/rate-limit.ts\` RATE_LIMITS.
Functions without an entry fall back to the default (60 req / 3600s).

| # | Function | Has rate limit? | Config |
|---|----------|----------------|--------|
SECTION

i=1
missing_count=0
for fn_dir in "$FUNCTIONS_DIR"/*/; do
  fn=$(basename "$fn_dir")
  [[ "$fn" == _* ]] && continue
  [[ ! -f "$fn_dir/index.ts" ]] && continue

  if grep -q "'$fn'" "$RATE_LIMIT_FILE" 2>/dev/null; then
    config=$(grep "'$fn'" "$RATE_LIMIT_FILE" | head -1 | sed 's/.*{//;s/}.*//' | tr -s ' ')
    echo "| $i | \`$fn\` | Yes | $config |" >> "$OUT"
  else
    echo "| $i | \`$fn\` | **NO** (default) | 60 req / 3600s |" >> "$OUT"
    missing_count=$((missing_count + 1))
  fi
  i=$((i + 1))
done

cat >> "$OUT" <<FOOTER

---

## Summary

- **Migrations**: $migration_count files to verify
- **Edge functions**: $fn_count deployable directories
- **Cron jobs**: $(grep -rc "cron\.schedule(" "$MIGRATIONS_DIR"/*.sql 2>/dev/null | awk -F: '{s+=$2}END{print s}') scheduled jobs
- **Rate limits**: $missing_count functions using default rate limit

> Run \`bash scripts/verify-deployment.sh\` to regenerate this file.
FOOTER

echo "Checklist written to $OUT"
echo "  Migrations: $migration_count"
echo "  Edge functions: $fn_count"
echo "  Rate limit gaps: $missing_count"
