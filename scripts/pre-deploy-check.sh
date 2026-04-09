#!/bin/bash
# AK Ops — Pre-deploy verification script
# Run this before pushing to main or deploying to production
# Usage: bash scripts/pre-deploy-check.sh

set -e
ERRORS=0
WARNINGS=0

echo "=== AK Ops Pre-Deploy Check ==="
echo ""

# Check 1: TypeScript build
echo "Checking TypeScript build..."
if npm run build 2>&1 | grep -q "error TS"; then
  echo "FAIL: TypeScript errors found"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: TypeScript build clean"
fi

# Check 2: No hardcoded credentials
echo "Checking for hardcoded credentials..."
if grep -r "sbp_" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test."; then
  echo "FAIL: Possible Supabase token found in source"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: No hardcoded Supabase tokens"
fi

if grep -r "sk-ant-" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "FAIL: Possible Anthropic API key found in source"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: No hardcoded API keys"
fi

# Check 3: No console.log in production code (warn only)
CONSOLE_COUNT=$(grep -r "console.log" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test." | wc -l)
if [ "$CONSOLE_COUNT" -gt "10" ]; then
  echo "WARN: $CONSOLE_COUNT console.log statements found in src/ (consider removing before prod)"
  WARNINGS=$((WARNINGS + 1))
else
  echo "PASS: console.log count acceptable ($CONSOLE_COUNT)"
fi

# Check 4: All new edge functions have rate limiting
echo "Checking edge function rate limiting..."
FUNCTIONS_WITHOUT_RATE_LIMIT=0
for dir in supabase/functions/*/; do
  func=$(basename "$dir")
  if [ "$func" = "_shared" ]; then continue; fi
  if [ -f "$dir/index.ts" ]; then
    if ! grep -q "checkRateLimit" "$dir/index.ts"; then
      echo "  WARN: $func missing rate limiting"
      FUNCTIONS_WITHOUT_RATE_LIMIT=$((FUNCTIONS_WITHOUT_RATE_LIMIT + 1))
    fi
  fi
done
if [ "$FUNCTIONS_WITHOUT_RATE_LIMIT" -gt "0" ]; then
  echo "WARN: $FUNCTIONS_WITHOUT_RATE_LIMIT edge functions missing rate limiting"
  WARNINGS=$((WARNINGS + 1))
else
  echo "PASS: All edge functions have rate limiting"
fi

# Check 5: Git status
echo "Checking git status..."
if git diff --staged --name-only | grep -q "SESSION_STATE.md"; then
  echo "PASS: SESSION_STATE.md is being updated in this commit"
else
  echo "WARN: SESSION_STATE.md not updated — did you forget to document what changed?"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 6: No migration files that DROP without a comment
echo "Checking for dangerous migrations..."
for f in supabase/migrations/*.sql; do
  if grep -q "DROP TABLE\|DROP COLUMN" "$f" 2>/dev/null; then
    if ! grep -q "-- APPROVED" "$f"; then
      echo "WARN: $f contains DROP without -- APPROVED comment"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done

echo ""
echo "=== Results ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -gt "0" ]; then
  echo "DEPLOY BLOCKED: Fix errors before deploying"
  exit 1
else
  echo "DEPLOY OK: $WARNINGS warning(s) noted but not blocking"
  exit 0
fi
