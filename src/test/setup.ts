// Test environment setup
// Mocks the supabase client so tests never need real credentials.
// Also provides helpers for mocking AuthContext and QueryClient.

/// <reference types="vitest/globals" />
import { vi } from 'vitest';

// ---------- Supabase mock ----------
// A chainable stub that returns { data: null, error: null } by default.
function chainable(): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    data: null,
    error: null,
    count: null,
  };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      // Any unknown method returns the proxy itself (chainable).
      return (..._args: unknown[]) => new Proxy({ ...obj }, handler);
    },
  };
  return new Proxy(obj, handler);
}

const channelStub = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue('ok'),
  untrack: vi.fn().mockResolvedValue('ok'),
  track: vi.fn().mockResolvedValue('ok'),
  presenceState: vi.fn().mockReturnValue({}),
};

export const mockSupabase = {
  from: vi.fn(() => chainable()),
  channel: vi.fn(() => channelStub),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Reset all mocks between tests
afterEach(() => {
  vi.clearAllMocks();
});
