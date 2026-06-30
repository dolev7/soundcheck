import type { TokenSet } from '../types';

// SECURITY: In a backend-less SPA there is no server-side session to hold the
// refresh token, so tokens are persisted in the browser. localStorage is
// readable by any script on this origin, so an XSS vulnerability would expose
// these tokens — this is the well-known trade-off of the pure-client PKCE
// model. We mitigate by (a) shipping no third-party script tags except the
// Spotify SDK, (b) keeping the token lifetime short via refresh, and (c)
// scoping the OAuth grant to only what the game needs. To eliminate the risk
// entirely, move the token exchange/refresh behind a thin backend that keeps
// the refresh token in an HttpOnly cookie — see DESIGN.md "Hardening path".
const TOKENS_KEY = 'soundcheck.tokens';

export function loadTokens(): TokenSet | null {
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenSet;
  } catch {
    localStorage.removeItem(TOKENS_KEY);
    return null;
  }
}

export function saveTokens(tokens: TokenSet): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}
