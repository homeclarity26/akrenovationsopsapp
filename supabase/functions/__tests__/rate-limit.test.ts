/**
 * Tests for the rate-limit config (RATE_LIMITS map and DEFAULT_LIMIT).
 *
 * We cannot import the actual Deno edge function file directly in vitest
 * (it uses Deno-specific imports), so we duplicate the exported constant
 * structure here and test the DATA, not the runtime function.
 *
 * This catches: missing function entries, zero/negative limits, typos.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read the rate-limit.ts source and extract RATE_LIMITS entries via regex
// since we can't import Deno modules in vitest.
const rateLimitSrc = fs.readFileSync(
  path.resolve(__dirname, '../../functions/_shared/rate-limit.ts'),
  'utf-8',
);

// Extract all keys from the RATE_LIMITS object
const keyMatches = rateLimitSrc.matchAll(/'([a-z0-9-]+)':\s*\{/g);
const rateLimitKeys = [...keyMatches].map((m) => m[1]);

// Extract maxRequests and windowSeconds values
const entryMatches = rateLimitSrc.matchAll(
  /'([a-z0-9-]+)':\s*\{\s*maxRequests:\s*(\d+),\s*windowSeconds:\s*(\d+)\s*\}/g,
);
const entries = [...entryMatches].map((m) => ({
  name: m[1],
  maxRequests: parseInt(m[2]),
  windowSeconds: parseInt(m[3]),
}));

// Check DEFAULT_LIMIT exists
const defaultMatch = rateLimitSrc.match(
  /DEFAULT_LIMIT\s*=\s*\{\s*maxRequests:\s*(\d+),\s*windowSeconds:\s*(\d+)\s*\}/,
);

describe('RATE_LIMITS config', () => {
  it('has entries extracted from source', () => {
    expect(rateLimitKeys.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
  });

  // Wave A functions
  const waveAFunctions = [
    'ai-suggest-project-action',
    'apply-project-suggestion',
    'reject-project-suggestion',
    'deduct-shopping-item-from-stock',
    'ai-inventory-query',
    'agent-inventory-alerts',
    'agent-photo-stocktake',
  ];

  for (const fn of waveAFunctions) {
    it(`Wave A function "${fn}" has a rate limit entry`, () => {
      expect(rateLimitKeys).toContain(fn);
    });
  }

  it('generate-progress-reel has a rate limit entry', () => {
    expect(rateLimitKeys).toContain('generate-progress-reel');
  });

  it('DEFAULT_LIMIT exists with sane values', () => {
    expect(defaultMatch).not.toBeNull();
    const maxReq = parseInt(defaultMatch![1]);
    const windowSec = parseInt(defaultMatch![2]);
    expect(maxReq).toBeGreaterThan(0);
    expect(windowSec).toBeGreaterThan(0);
  });

  it('all entries have maxRequests > 0', () => {
    for (const entry of entries) {
      expect(entry.maxRequests, `${entry.name} maxRequests`).toBeGreaterThan(0);
    }
  });

  it('all entries have windowSeconds > 0', () => {
    for (const entry of entries) {
      expect(entry.windowSeconds, `${entry.name} windowSeconds`).toBeGreaterThan(0);
    }
  });

  it('no duplicate keys in RATE_LIMITS', () => {
    const unique = new Set(rateLimitKeys);
    expect(unique.size).toBe(rateLimitKeys.length);
  });

  it('meta-agent-chat has a high limit (it is the main chat endpoint)', () => {
    const entry = entries.find((e) => e.name === 'meta-agent-chat');
    expect(entry).toBeDefined();
    expect(entry!.maxRequests).toBeGreaterThanOrEqual(50);
  });

  it('dangerous endpoints have conservative limits', () => {
    const conservative = ['meta-agent-orchestration', 'backup-daily', 'backup-database'];
    for (const fn of conservative) {
      const entry = entries.find((e) => e.name === fn);
      if (!entry) continue; // skip if not in this version
      expect(entry.maxRequests, `${fn} should have low limit`).toBeLessThanOrEqual(10);
    }
  });
});
