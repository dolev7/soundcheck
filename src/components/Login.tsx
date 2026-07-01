import { CLIENT_ID } from '../config';
import {
  ARTIST_TIER_POINTS,
  SONG_TIER_POINTS,
  TIER_LABELS,
  YEAR_EXACT,
  YEAR_WINDOW,
} from '../game/round';
import { ROUND_OPTIONS } from '../game/game';
import { isMobileBrowser } from '../util/platform';

interface LoginProps {
  onLogin: () => void;
}

const PERFECT_ROUND = ARTIST_TIER_POINTS[0] + SONG_TIER_POINTS[0] + YEAR_EXACT;

export function Login({ onLogin }: LoginProps) {
  const configured = CLIENT_ID.length > 0;

  return (
    <div className="card center">
      <h1>SoundCheck</h1>
      <p className="subtitle">
        Guess the artist from a few seconds of a song — the sooner you guess, the
        more you score.
      </p>

      {isMobileBrowser() && (
        <div className="warn">
          <strong>On a phone?</strong> Tap ▶ to start each clip — mobile browsers
          block audio until you do. Works best in <strong>Chrome</strong>; iOS
          Safari can be finicky, and a desktop browser is the most reliable.
        </div>
      )}

      {configured ? (
        <button className="primary" onClick={onLogin}>
          Connect Spotify
        </button>
      ) : (
        <div className="warn">
          <strong>Setup needed.</strong> No Client ID found. Copy{' '}
          <code>.env.example</code> to <code>.env.local</code>, add your Spotify
          app's Client ID, and restart the dev server. See <code>README.md</code>.
        </div>
      )}

      <p className="fine">
        Requires a Spotify <strong>Premium</strong> account (Web Playback SDK
        limitation). Desktop browser recommended.
      </p>

      <div className="rules">
        <h2>How to play</h2>
        <ul>
          <li>
            A game is <strong>{ROUND_OPTIONS.join(', ')} rounds</strong> (you choose
            at the start). Each round a clip plays — guess the{' '}
            <strong>artist</strong>, and (optionally) the exact <strong>song</strong>{' '}
            and the <strong>year</strong>.
          </li>
          <li>
            <strong>Lock in</strong> banks points for whatever you got right and
            the round keeps going. <strong>More audio</strong> plays a longer clip
            but is worth fewer points.
          </li>
          <li>
            A <strong>wrong</strong> artist or song guess ends the round. Or{' '}
            <strong>Give up</strong> to stop and keep what you've banked.
          </li>
          <li>
            Each objective is scored independently — nail the artist early, then
            keep hunting the song and year.
          </li>
        </ul>

        <h3>Points per round</h3>
        <table className="score-table">
          <thead>
            <tr>
              <th>Guessed at…</th>
              {TIER_LABELS.map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Artist</td>
              {ARTIST_TIER_POINTS.map((pts, i) => (
                <td key={i}>{pts}</td>
              ))}
            </tr>
            <tr>
              <td>Song</td>
              {SONG_TIER_POINTS.map((pts, i) => (
                <td key={i}>{pts}</td>
              ))}
            </tr>
          </tbody>
        </table>

        <p className="fine">
          <strong>Year</strong> (not tiered): exact is {YEAR_EXACT} points, sliding
          down to 0 once you're {YEAR_WINDOW}+ years off. A perfect round is{' '}
          <strong>{PERFECT_ROUND}</strong> points.
        </p>
      </div>
    </div>
  );
}
