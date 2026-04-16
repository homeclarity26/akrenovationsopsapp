# Environment Variables

All environment variables required by the AK Renovations Ops App.

---

## Frontend (Vite / Vercel)

Set these in **Vercel > Project Settings > Environment Variables**.

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase Dashboard > Settings > API | `src/lib/supabase.ts`, `src/main.tsx`, multiple page components |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase Dashboard > Settings > API | `src/lib/supabase.ts`, AgentOverlay, AI command pages |
| `VITE_SENTRY_DSN` | Yes | Sentry > Project Settings > Client Keys | `src/lib/sentry.ts` |

> `import.meta.env.MODE` is also used by Sentry init (`development` / `production`) but is set automatically by Vite.

---

## Edge Functions (Supabase Secrets)

Set these in **Supabase Dashboard > Project Settings > Edge Functions > Secrets**
or via `supabase secrets set KEY=VALUE`.

### Core (required for all functions)

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `SUPABASE_URL` | Yes | Auto-injected by Supabase runtime | All edge functions via `_shared/auth.ts`, `_shared/rate-limit.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-injected by Supabase runtime | All edge functions (service-role client) |
| `SUPABASE_ANON_KEY` | Yes | Auto-injected by Supabase runtime | `_shared/auth.ts` (anon client for JWT verification) |

### AI Providers

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `ANTHROPIC_API_KEY` | Yes | [Anthropic Console](https://console.anthropic.com/) | 20+ agent functions (meta-agent-chat, agent-morning-brief, agent-cash-flow, agent-daily-log, etc.) |
| `GEMINI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com/) | agent-call-summarizer, agent-photo-stocktake, agent-voice-transcriber, generate-embedding |
| `OPENAI_API_KEY` | Optional | [OpenAI Platform](https://platform.openai.com/) | generate-embedding (fallback) |

### Email

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `RESEND_API_KEY` | Yes | [Resend Dashboard](https://resend.com/) | send-email, notify-inventory-alerts |

### Observability

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `SENTRY_DSN` | Recommended | Sentry > Project Settings > Client Keys | `_shared/sentry.ts` (captureException in catch blocks) |
| `ENVIRONMENT` | Optional | Manual (`production` / `staging`) | `_shared/sentry.ts` (defaults to `production`) |

### Integrations

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | Google Cloud Console > IAM > Service Accounts | sync-to-drive, sync-google-drive, backup-daily, backup-database, backup-storage-manifest |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Yes | Google Drive (folder ID from URL) | sync-to-drive, sync-google-drive |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | Yes | Google Drive (folder ID from URL) | backup-daily, backup-database, backup-storage-manifest |
| `STRIPE_SECRET_KEY` | Optional | [Stripe Dashboard](https://dashboard.stripe.com/) > Developers > API Keys | stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe Dashboard > Webhooks > Signing secret | stripe-webhook |
| `OPENWEATHERMAP_API_KEY` | Yes | [OpenWeatherMap](https://openweathermap.org/api) | agent-weather-schedule |
| `DEEPGRAM_API_KEY` | Optional | [Deepgram Console](https://console.deepgram.com/) | agent-conversation-transcriber |

### GitHub (CI/CD + meta-agent)

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `GITHUB_TOKEN` | Optional | GitHub > Settings > Personal Access Tokens | meta-agent-open-pr |
| `GITHUB_REPO` | Optional | Manual (e.g. `homeclarity26/akrenovationsopsapp`) | meta-agent-open-pr |
| `GITHUB_WEBHOOK_SECRET` | Optional | GitHub > Repo > Settings > Webhooks | github-webhook |

### Payroll / HR (Gusto)

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `GUSTO_API_KEY` | Optional | Gusto Developer Portal | sync-to-gusto |
| `GUSTO_COMPANY_ID` | Optional | Gusto API (company endpoint) | sync-to-gusto |

> Gusto integration is a placeholder for future work.

### Client Portal

| Variable | Required | Source | Used by |
|----------|----------|--------|---------|
| `PORTAL_REDIRECT_URL` | Optional | Manual (e.g. `https://app.akrenovations.com/welcome`) | invite-client-to-portal |

---

## GitHub Actions Secrets

Set these in **GitHub > Repo > Settings > Secrets and variables > Actions**.

| Secret | Required | Source | Used by |
|--------|----------|--------|---------|
| `SUPABASE_ACCESS_TOKEN` | Yes | Supabase Dashboard > Account > Access Tokens | `.github/workflows/deploy-edge-functions.yml` |

---

## Summary

- **Frontend**: 3 env vars (2 Supabase + 1 Sentry)
- **Edge functions**: 22 unique env vars across 79 functions
- **GitHub Actions**: 1 secret

> Regenerate by grepping: `grep -rn "Deno.env.get" supabase/functions/` and `grep -rn "import.meta.env" src/`
