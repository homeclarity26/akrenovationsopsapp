// Central AI configuration — change model versions here, not in individual files
// Import this in any frontend code that needs to reference model names or token limits.
// Edge functions use the parallel file at supabase/functions/_shared/aiConfig.ts
// (Deno cannot import from src/ directly).
export const AI_CONFIG = {
  // Primary model for all agents and chat
  // Update this when Anthropic releases new versions
  PRIMARY_MODEL: 'claude-sonnet-4-20250514',

  // Fast model for voice, demos, and latency-sensitive operations
  FAST_MODEL: 'claude-haiku-4-5',

  // Embedding model (Gemini)
  EMBEDDING_MODEL: 'gemini-embedding-001',

  // Vision/audio model (Gemini)
  VISION_MODEL: 'gemini-2.5-flash',

  // Token limits
  DEFAULT_MAX_TOKENS: 4096,
  FAST_MAX_TOKENS: 1000,
  VISION_MAX_TOKENS: 2048,
} as const;
