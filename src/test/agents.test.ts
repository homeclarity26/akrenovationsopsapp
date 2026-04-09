// Agent edge function tests
// Edge function tests require an explicit TEST_STAGING_URL and TEST_SERVICE_ROLE_KEY.
// These must point to a staging project — never the production Supabase project.
// The service role key is needed because edge functions require authentication.

import { describe, it, expect } from 'vitest';

// We use fetch directly rather than testSupabase.functions.invoke() so we can
// supply the service role key as the Authorization header.
// Uses TEST_STAGING_URL (not VITE_SUPABASE_URL) to avoid running against production.
const SUPABASE_URL = process.env.TEST_STAGING_URL || '';
const SERVICE_ROLE_KEY = process.env.TEST_SERVICE_ROLE_KEY || '';
const HAS_LIVE_FUNCTIONS = !!(SUPABASE_URL && SERVICE_ROLE_KEY);

async function invokeFunction(
  name: string,
  body: Record<string, unknown> = {},
  timeoutMs = 10000
): Promise<{ status: number; data: unknown; error: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, error: null };
  } catch (err) {
    return { status: 0, data: null, error: err };
  } finally {
    clearTimeout(timeout);
  }
}

describe('Agent Edge Functions', () => {
  it.skipIf(!HAS_LIVE_FUNCTIONS)(
    'assemble-context returns a response within 10 seconds',
    async () => {
      const start = Date.now();
      const result = await invokeFunction('assemble-context', {
        user_id: 'system',
        user_role: 'admin',
        agent_name: 'test',
        query: 'hello',
      }, 10000);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
      expect(result.status).not.toBe(0); // no timeout/network error
    }
  );

  it.skipIf(!HAS_LIVE_FUNCTIONS)(
    'assemble-context response contains a system_prompt field',
    async () => {
      const result = await invokeFunction('assemble-context', {
        user_id: 'system',
        user_role: 'admin',
        agent_name: 'test',
        query: 'What projects are active?',
      });
      expect(result.status).toBe(200);
      const data = result.data as Record<string, unknown>;
      expect(data).toHaveProperty('system_prompt');
      expect(typeof data.system_prompt).toBe('string');
    }
  );

  it.skipIf(!HAS_LIVE_FUNCTIONS)(
    'agent-morning-brief can be invoked and returns a structured response',
    async () => {
      const result = await invokeFunction('agent-morning-brief', {});
      // Morning brief is a proactive agent — it may return 200 with output
      // or 400/422 if it needs specific context. Either way, it should not 500.
      expect(result.status).not.toBe(500);
      expect(result.error).toBeNull();
    }
  );

  it.skipIf(!HAS_LIVE_FUNCTIONS)(
    'a failed agent invocation does not throw an unhandled exception',
    async () => {
      // Call an agent with deliberately invalid input
      const result = await invokeFunction('agent-receipt-processor', {
        project_id: 'not-a-uuid',
        file_url: '',
      });
      // Should return 400 (Zod validation) not 500 (unhandled exception)
      expect([400, 422]).toContain(result.status);
      expect(result.status).not.toBe(500);
    }
  );

  it('agent invocation helper handles network timeout gracefully', async () => {
    // Pure unit test — verifies our invokeFunction helper doesn't throw on abort
    const result = await invokeFunction('nonexistent-function', {}, 1); // 1ms timeout
    // Should return error object, not throw
    expect(result).toHaveProperty('error');
    expect(result.status).toBe(0);
  });

  it('Supabase URL format is correct if configured', () => {
    if (!SUPABASE_URL) return; // skip if not configured
    expect(SUPABASE_URL).toMatch(/^https:\/\//);
    expect(SUPABASE_URL).not.toMatch(/\/$$/); // no trailing slash
  });
});
