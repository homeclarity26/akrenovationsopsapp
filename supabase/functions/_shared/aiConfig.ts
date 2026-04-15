// Central AI configuration for edge functions (Deno)
// Mirror of src/lib/aiConfig.ts — keep both in sync when updating model versions.
// Edge functions cannot import from src/ directly, so this file is the Deno-compatible copy.
//
// Single source of truth for model versions — every edge function should import
// from here rather than hardcoding a pinned string. When Anthropic ships a new
// version, update these constants and every function picks it up automatically.
export const AI_CONFIG = {
  // Primary model for all agents and chat
  // Update this when Anthropic releases new versions
  PRIMARY_MODEL: 'claude-sonnet-4-20250514',

  // Fast model for voice, demos, and latency-sensitive operations
  FAST_MODEL: 'claude-haiku-4-5-20251001',

  // Embedding model (Gemini)
  EMBEDDING_MODEL: 'gemini-embedding-001',

  // Vision/audio model (Gemini)
  VISION_MODEL: 'gemini-2.5-flash',

  // Token limits
  DEFAULT_MAX_TOKENS: 4096,
  FAST_MAX_TOKENS: 1000,
  VISION_MAX_TOKENS: 2048,
} as const;
