import {
  AUTH_ENDPOINT,
  CLIENT_ID,
  REDIRECT_URI,
  SCOPES,
  TOKEN_ENDPOINT,
} from '../config';
import type { TokenSet } from '../types';
import { randomString, sha256Challenge } from './pkce';
import { clearTokens, loadTokens, saveTokens } from './tokenStore';

// Transient PKCE values live in sessionStorage (cleared on tab close and as
// soon as the exchange completes), not localStorage.
const VERIFIER_KEY = 'soundcheck.pkce_verifier';
const STATE_KEY = 'soundcheck.pkce_state';

// Refresh slightly before actual expiry so in-flight requests don't 401.
const EXPIRY_SKEW_MS = 60_000;

function tokenSetFromResponse(
  data: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  },
  fallbackRefresh = '',
): TokenSet {
  return {
    access_token: data.access_token,
    // Spotify does not always return a new refresh_token on refresh; keep the
    // existing one when it's absent.
    refresh_token: data.refresh_token ?? fallbackRefresh,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? '',
    token_type: data.token_type ?? 'Bearer',
  };
}

/** Strip the ?code/?state (or ?error) params from the URL after the callback. */
function cleanUrl(): void {
  // Return to the app root, honoring the deploy base path (e.g. /soundcheck/).
  window.history.replaceState({}, document.title, import.meta.env.BASE_URL);
}

/** Kick off the Authorization Code + PKCE flow by redirecting to Spotify. */
export async function beginLogin(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error(
      'VITE_SPOTIFY_CLIENT_ID is not set. Copy .env.example to .env.local and add your Client ID.',
    );
  }

  const verifier = randomString(64);
  const challenge = await sha256Challenge(verifier);
  const state = randomString(24);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  });

  window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);
}

/**
 * If the current URL is a redirect back from Spotify, exchange the code for
 * tokens. Returns the token set on success, or null if this isn't a callback.
 * Throws on auth errors or a failed CSRF (state) check.
 */
export async function completeLoginFromRedirect(): Promise<TokenSet | null> {
  const url = new URL(window.location.href);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (error) {
    cleanUrl();
    throw new Error(`Spotify authorization was denied or failed: ${error}`);
  }
  if (!code) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  // Anti-CSRF: the state we get back must match the one we stored. Fail closed.
  if (!expectedState || returnedState !== expectedState) {
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    cleanUrl();
    throw new Error('Authorization state mismatch — possible CSRF. Please try logging in again.');
  }
  if (!verifier) {
    cleanUrl();
    throw new Error('Missing PKCE verifier. Please try logging in again.');
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } finally {
    // Verifier/state are single-use — drop them whether or not the call worked.
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  }

  if (!res.ok) {
    cleanUrl();
    throw new Error(`Token exchange failed (${res.status}). Please try logging in again.`);
  }

  const tokens = tokenSetFromResponse(await res.json());
  saveTokens(tokens);
  cleanUrl();
  return tokens;
}

/** Use the refresh token to get a new access token. */
export async function refreshTokens(): Promise<TokenSet> {
  const current = loadTokens();
  if (!current?.refresh_token) {
    throw new Error('No refresh token available — please log in again.');
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: current.refresh_token,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    // Refresh token is dead/revoked — clear everything and force re-auth.
    clearTokens();
    throw new Error(`Token refresh failed (${res.status}). Please log in again.`);
  }

  const tokens = tokenSetFromResponse(await res.json(), current.refresh_token);
  saveTokens(tokens);
  return tokens;
}

/** Return a non-expired access token, refreshing first if needed. */
export async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error('Not authenticated.');
  if (Date.now() >= tokens.expires_at - EXPIRY_SKEW_MS) {
    tokens = await refreshTokens();
  }
  return tokens.access_token;
}

export function logout(): void {
  clearTokens();
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

export { loadTokens } from './tokenStore';
