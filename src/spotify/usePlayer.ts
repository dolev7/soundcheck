import { useCallback, useEffect, useRef, useState } from 'react';
import { createPlayer } from './playback';

export type PlayerStatus = 'connecting' | 'ready' | 'error';

export interface UsePlayer {
  status: PlayerStatus;
  player: Spotify.Player | null;
  deviceId: string | null;
  error: string | null;
  retry: () => void;
}

/**
 * Boots a single Web Playback SDK device for the session and exposes it. Browser
 * glue around the SDK (no jsdom presence), so it's verified by running, not unit
 * tests — the createPlayer timeout/error handling it relies on is in playback.ts.
 */
export function usePlayer(): UsePlayer {
  const [status, setStatus] = useState<PlayerStatus>('connecting');
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<Spotify.Player | null>(null);
  const didInit = useRef(false);

  const boot = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    playerRef.current?.disconnect();
    playerRef.current = null;
    setPlayer(null);
    setDeviceId(null);
    try {
      const { player: p, deviceId: id } = await createPlayer('SoundCheck Player');
      playerRef.current = p;
      setPlayer(p);
      setDeviceId(id);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (didInit.current) return; // StrictMode double-mount guard
    didInit.current = true;
    void boot();
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [boot]);

  return { status, player, deviceId, error, retry: () => void boot() };
}
