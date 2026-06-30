import { API_BASE } from '../config';
import { getValidAccessToken, refreshTokens } from '../auth/auth';

/**
 * Authenticated fetch against the Spotify Web API. Adds the bearer token and,
 * on a 401, transparently refreshes once and retries. `path` is relative to
 * the API base, e.g. "/me" or "/me/player/play?device_id=...".
 */
export async function spotifyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  const doFetch = (accessToken: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshTokens();
    res = await doFetch(refreshed.access_token);
  }
  return res;
}

/** spotifyFetch + JSON parse + error-on-non-2xx. Use for GET/read endpoints. */
export async function spotifyGet<T>(path: string): Promise<T> {
  const res = await spotifyFetch(path);
  if (!res.ok) {
    throw new Error(`Spotify API GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
