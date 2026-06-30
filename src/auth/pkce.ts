// PKCE (Proof Key for Code Exchange) helpers. All randomness comes from the
// Web Crypto CSPRNG — never Math.random for security-relevant values.

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Cryptographically random URL-safe string. Used for the PKCE code_verifier
 * (43–128 chars per RFC 7636) and the anti-CSRF `state` value. The base64url
 * alphabet (A–Z a–z 0–9 - _) is a valid subset of the allowed verifier chars.
 */
export function randomString(length = 64): string {
  // base64url yields ~4 chars per 3 bytes; over-allocate then trim.
  const bytes = new Uint8Array(Math.ceil((length * 3) / 4));
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

/** S256 challenge = base64url(SHA-256(verifier)). */
export async function sha256Challenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}
