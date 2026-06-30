import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpotifyUser } from '../types';
import { getMe } from '../spotify/profile';
import { beginLogin, completeLoginFromRedirect, loadTokens, logout } from './auth';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

export interface AuthState {
  status: AuthStatus;
  user: SpotifyUser | null;
  error: string | null;
  login: () => void;
  signOut: () => void;
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard against React 18/19 StrictMode running the effect twice in dev,
  // which would attempt the (single-use) code exchange a second time.
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    (async () => {
      try {
        // 1) If we just came back from Spotify, finish the exchange.
        await completeLoginFromRedirect();

        // 2) If we have tokens (fresh or stored), load the profile.
        if (loadTokens()) {
          const me = await getMe();
          setUser(me);
          setStatus('authenticated');
        } else {
          setStatus('anonymous');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();
  }, []);

  const login = useCallback(() => {
    beginLogin().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    });
  }, []);

  const signOut = useCallback(() => {
    logout();
    setUser(null);
    setError(null);
    setStatus('anonymous');
  }, []);

  return { status, user, error, login, signOut };
}
