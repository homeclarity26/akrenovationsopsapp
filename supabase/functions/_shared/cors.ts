// Shared CORS helper for all edge functions.
// Replace wildcard '*' origins with an explicit allowlist.
// To add customer domains for multi-tenant, append to ALLOWED_ORIGINS.

const ALLOWED_ORIGINS = [
  'https://akrenovationsopsapp.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const isAllowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }
}
