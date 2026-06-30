import { useState } from 'react';
import type { SpotifyUser } from '../types';
import { PlaylistPicker, type LoadedPool } from './PlaylistPicker';
import { RoundFlow } from './RoundFlow';

interface GameProps {
  user: SpotifyUser;
  onSignOut: () => void;
}

/** Authenticated + Premium shell: header + the pick-source → ready flow. */
export function Game({ user, onSignOut }: GameProps) {
  const [pool, setPool] = useState<LoadedPool | null>(null);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">SoundCheck</span>
        <span className="who">
          {user.display_name ?? user.id} · {user.product}
          <button className="ghost small" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </header>

      {pool ? (
        <RoundFlow pool={pool} onChangeSource={() => setPool(null)} />
      ) : (
        <PlaylistPicker onPoolLoaded={setPool} />
      )}
    </div>
  );
}
