import { useEffect, useRef, useState } from 'react';
import { distinctArtists, seededShuffle, type Artist, type PoolTrack } from '../game/pool';
import {
  fetchLikedTracks,
  fetchPlaylistTracks,
  fetchPlaylists,
  type PlaylistSummary,
} from '../spotify/library';

export type PoolSource = { kind: 'liked' } | { kind: 'playlist'; id: string; name: string };

export interface LoadedPool {
  source: PoolSource;
  /** Shuffled, game-ready tracks. */
  tracks: PoolTrack[];
  /** Distinct artists across the pool — the artist typeahead list. */
  artists: Artist[];
}

interface PlaylistPickerProps {
  onPoolLoaded: (pool: LoadedPool) => void;
}

const LIKED_VALUE = 'liked';

export function PlaylistPicker({ onPoolLoaded }: PlaylistPickerProps) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selected, setSelected] = useState<string>(LIKED_VALUE);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPool, setLoadingPool] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return; // StrictMode double-mount guard
    didInit.current = true;
    (async () => {
      try {
        setPlaylists(await fetchPlaylists());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  async function handleLoad() {
    setLoadingPool(true);
    setProgress(null);
    setError(null);
    const onProgress = (loaded: number, total: number) => setProgress({ loaded, total });
    try {
      let source: PoolSource;
      let tracks: PoolTrack[];

      if (selected === LIKED_VALUE) {
        source = { kind: 'liked' };
        tracks = await fetchLikedTracks(onProgress);
      } else {
        const playlist = playlists.find((p) => p.id === selected);
        source = { kind: 'playlist', id: selected, name: playlist?.name ?? 'Playlist' };
        tracks = await fetchPlaylistTracks(selected, onProgress);
      }

      if (tracks.length === 0) {
        setError('That source has no playable tracks. Try another playlist.');
        return;
      }

      const shuffled = seededShuffle(tracks, Date.now());
      onPoolLoaded({ source, tracks: shuffled, artists: distinctArtists(shuffled) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPool(false);
    }
  }

  const busy = loadingList || loadingPool;

  return (
    <div className="card">
      <h1>Pick your music</h1>
      <p className="subtitle">
        Choose a source. Its artists become the guess list; its tracks are the
        round pool.
      </p>

      <label className="field">
        <span className="field-label">Source</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={busy}
        >
          <option value={LIKED_VALUE}>Liked Songs</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.trackCount})
            </option>
          ))}
        </select>
      </label>

      {error && <div className="warn">{error}</div>}

      <div className="row">
        <button className="primary" onClick={handleLoad} disabled={busy}>
          {loadingPool ? 'Loading…' : 'Load tracks'}
        </button>
      </div>

      {loadingPool && (
        <div className="progress" role="status" aria-live="polite">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width:
                  progress && progress.total > 0
                    ? `${Math.round((progress.loaded / progress.total) * 100)}%`
                    : '8%',
              }}
            />
          </div>
          <div className="fine">
            {progress
              ? `Loaded ${progress.loaded} / ${progress.total} songs…`
              : 'Starting…'}
          </div>
        </div>
      )}

      {loadingList && <p className="fine">Fetching your playlists…</p>}
    </div>
  );
}
