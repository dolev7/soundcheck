import type { SpotifyUser } from '../types';

interface PremiumGateProps {
  user: SpotifyUser;
  onSignOut: () => void;
}

export function PremiumGate({ user, onSignOut }: PremiumGateProps) {
  return (
    <div className="card center">
      <h1>Premium required</h1>
      <p className="subtitle">
        Hi {user.display_name ?? user.id} — your account is{' '}
        <strong>{user.product}</strong>. The Spotify Web Playback SDK only works
        with a Premium subscription, so SoundCheck can't stream audio for you.
      </p>
      <a
        className="primary as-button"
        href="https://www.spotify.com/premium/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Upgrade to Premium
      </a>
      <button className="ghost" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
