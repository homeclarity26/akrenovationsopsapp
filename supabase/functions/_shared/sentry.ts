/**
 * Lightweight error reporting for edge functions.
 * Uses Sentry's HTTP API directly since @sentry/deno may not be available.
 * Falls back silently if SENTRY_DSN is not configured.
 */
export async function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;

  try {
    // Parse DSN: https://{key}@{host}/{project_id}
    const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!match) return;
    const [, key, host, projectId] = match;

    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      server_name: 'supabase-edge',
      environment: Deno.env.get('ENVIRONMENT') || 'production',
      exception: {
        values: [{
          type: error instanceof Error ? error.constructor.name : 'Error',
          value: error instanceof Error ? error.message : String(error),
          stacktrace: error instanceof Error && error.stack ? {
            frames: error.stack.split('\n').slice(1).map(line => ({
              filename: line.trim(),
            })),
          } : undefined,
        }],
      },
      extra: context || {},
    };

    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=edge-function/1.0`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Never let Sentry reporting break the main function
  }
}
