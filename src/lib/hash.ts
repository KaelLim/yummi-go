/**
 * SHA-256 password hash with username-as-salt.
 * Uses Web Crypto SubtleCrypto. Returns 64-char lowercase hex.
 */
export async function sha256Salted(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + ':' + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
