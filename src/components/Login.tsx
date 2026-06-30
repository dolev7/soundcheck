import { CLIENT_ID } from '../config';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const configured = CLIENT_ID.length > 0;

  return (
    <div className="card center">
      <h1>SoundCheck</h1>
      <p className="subtitle">
        Name the artist from a few seconds of audio. The exact song is the
        expert bonus.
      </p>

      {configured ? (
        <button className="primary" onClick={onLogin}>
          Connect Spotify
        </button>
      ) : (
        <div className="warn">
          <strong>Setup needed.</strong> No Client ID found. Copy{' '}
          <code>.env.example</code> to <code>.env.local</code>, add your Spotify
          app's Client ID, and restart the dev server. See{' '}
          <code>README.md</code>.
        </div>
      )}

      <p className="fine">
        Requires a Spotify <strong>Premium</strong> account (Web Playback SDK
        limitation). Desktop browser recommended.
      </p>
    </div>
  );
}
