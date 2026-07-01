import { useState } from 'react';
import {
  advanceGame,
  startGame,
  buildShareText,
  roundMarks,
  type RoundResult,
} from '../game/game';
import { recordScore } from '../game/bestScore';
import type { LoadedPool } from './PlaylistPicker';
import { Round } from './Round';

interface GameSessionProps {
  pool: LoadedPool;
  player: Spotify.Player;
  deviceId: string;
}

const MAX_REROLLS_PER_ROUND = 1;

/**
 * Runs a fixed-length game: ROUNDS_PER_GAME rounds over the (shuffled) pool,
 * accumulating a total + per-round results, then a results screen with a recap,
 * personal best, and a share card. Each round is a remounted Round (keyed by the
 * track cursor) that hands its result back via onComplete.
 */
export function GameSession({ pool, player, deviceId }: GameSessionProps) {
  const [game, setGame] = useState(() => startGame(pool.rounds));
  const [cursor, setCursor] = useState(0);
  const [rerollsThisRound, setRerollsThisRound] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [best, setBest] = useState<{ best: number; isNewBest: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleRoundComplete(result: RoundResult) {
    const next = advanceGame(game, result.score);
    setResults((rs) => [...rs, result]);
    setGame(next);
    setCursor((c) => c + 1);
    setRerollsThisRound(0); // fresh re-roll allowance for the next round
    if (next.status === 'finished') {
      setBest(recordScore(next.totalScore));
    }
  }

  // Swap in the next track for the SAME round — no score, no round advance.
  // Capped at MAX_REROLLS_PER_ROUND.
  function handleReroll() {
    if (rerollsThisRound >= MAX_REROLLS_PER_ROUND) return;
    setRerollsThisRound((n) => n + 1);
    setCursor((c) => c + 1);
  }

  function playAgain() {
    setGame(startGame(pool.rounds));
    setResults([]);
    setBest(null);
    setCopied(false);
    setRerollsThisRound(0);
    // Keep advancing the cursor so a new game uses fresh tracks where possible.
  }

  async function share() {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const text = buildShareText(results, game.totalScore, url);
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* user cancelled the share / clipboard blocked — nothing to do */
    }
  }

  if (game.status === 'finished') {
    return (
      <div className="reveal">
        <h2>Game over</h2>
        <div className="score">{game.totalScore} points</div>
        <p className="fine">
          over {game.totalRounds} songs
          {best &&
            (best.isNewBest ? ' · 🎉 new personal best!' : ` · personal best ${best.best}`)}
        </p>

        <ul className="recap">
          {results.map((r, i) => (
            <li key={i}>
              <span className="recap-marks">{roundMarks(r).join('')}</span>
              <span className="recap-track" dir="auto">
                {r.trackName}
              </span>
              <span className="pts">{r.score}</span>
            </li>
          ))}
        </ul>
        <p className="fine">🟩 exact · 🟨 close year · ⬛ missed</p>

        <div className="row">
          <button className="primary" onClick={playAgain}>
            Play again
          </button>
          <button className="ghost" onClick={share}>
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>
    );
  }

  const track = pool.tracks[cursor % pool.tracks.length];

  return (
    <div className="game">
      <div className="game-header">
        <span>
          Round {game.round} / {game.totalRounds}
        </span>
        <span className="game-score">{game.totalScore} pts</span>
      </div>

      <Round
        key={cursor}
        track={track}
        tracks={pool.tracks}
        artists={pool.artists}
        player={player}
        deviceId={deviceId}
        onComplete={handleRoundComplete}
        onReroll={handleReroll}
        canReroll={rerollsThisRound < MAX_REROLLS_PER_ROUND}
      />
    </div>
  );
}
