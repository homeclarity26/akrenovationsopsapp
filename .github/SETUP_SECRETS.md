# GitHub Actions — Required Secret

The edge function auto-deploy workflow requires one secret added to this repo:

## SUPABASE_ACCESS_TOKEN

1. Go to https://supabase.com/dashboard/account/tokens
2. Click **Generate new token**
3. Name it: `GitHub Actions Deploy`
4. Copy the token

Then add it to GitHub:
1. Go to https://github.com/homeclarity26/akrenovationsopsapp/settings/secrets/actions
2. Click **New repository secret**
3. Name: `SUPABASE_ACCESS_TOKEN`
4. Value: paste the token
5. Click **Add secret**

Once added, every push to `main` that touches `supabase/functions/` will auto-deploy all functions.
You can also trigger a manual deploy anytime from the Actions tab → "Deploy Supabase Edge Functions" → "Run workflow".
