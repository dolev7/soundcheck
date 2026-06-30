import { usePlayer } from '../spotify/usePlayer';
import type { LoadedPool } from './PlaylistPicker';
import { GameSession } from './GameSession';

interface RoundFlowProps {
  pool: LoadedPool;
  onChangeSource: () => void;
}

/**
 * Ensures the playback device is ready, then runs the round. Sits between the
 * loaded pool and the Round so device-boot status has somewhere to live.
 */
export function RoundFlow({ pool, onChangeSource }: RoundFlowProps) {
  const { status, player, deviceId, error, retry } = usePlayer();
  const sourceName = pool.source.kind === 'liked' ? 'Liked Songs' : pool.source.name;

  return (
    <div className="card">
      <div className="row spread">
        <span className="subtitle nomargin">
          {pool.tracks.length} tracks · {pool.artists.length} artists · {sourceName}
        </span>
        <button className="ghost small" onClick={onChangeSource}>
          Change source
        </button>
      </div>

      {status === 'connecting' && (
        <p>
          Booting Web Playback device… <span className="fine">(usually a few seconds)</span>
        </p>
      )}

      {status === 'error' && (
        <div className="warn">
          <strong>Player couldn’t start.</strong> {error}
          <div className="row">
            <button className="ghost small" onClick={retry}>
              Retry
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && player && deviceId && (
        <GameSession pool={pool} player={player} deviceId={deviceId} />
      )}
    </div>
  );
}
