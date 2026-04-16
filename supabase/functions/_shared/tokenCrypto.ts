// tokenCrypto — AES-256-GCM encrypt/decrypt for OAuth tokens at rest
//
// Requires env var TOKEN_ENCRYPTION_KEY (base64-encoded 32-byte key).
// Generate with: openssl rand -base64 32

const ALG = 'AES-GCM'
const IV_LEN = 12

async function getKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!b64) throw new Error('TOKEN_ENCRYPTION_KEY not set')
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  return crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypt a plaintext string. Returns a base64 string of iv + ciphertext.
 */
export async function encryptToken(plain: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const encoded = new TextEncoder().encode(plain)
  const cipherBuf = await crypto.subtle.encrypt({ name: ALG, iv }, key, encoded)
  const combined = new Uint8Array(IV_LEN + cipherBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuf), IV_LEN)
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64 string produced by encryptToken. Returns plaintext.
 */
export async function decryptToken(cipher: string): Promise<string> {
  const key = await getKey()
  const combined = Uint8Array.from(atob(cipher), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, IV_LEN)
  const data = combined.slice(IV_LEN)
  const plainBuf = await crypto.subtle.decrypt({ name: ALG, iv }, key, data)
  return new TextDecoder().decode(plainBuf)
}
