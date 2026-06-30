import { useState } from 'react';
import { advanceGame, startGame, ROUNDS_PER_GAME } from '../game/game';
import type { LoadedPool } from './PlaylistPicker';
import { Round } from './Round';

interface GameSessionProps {
  pool: LoadedPool;
  player: Spotify.Player;
  deviceId: string;
}

/**
 * Runs a fixed-length game: ROUNDS_PER_GAME rounds over the (shuffled) pool,
 * accumulating a total, then a results screen. Each round is a remounted Round
 * (keyed by the track cursor) that hands its score back via onComplete.
 */
const MAX_REROLLS_PER_ROUND = 1;

export function GameSession({ pool, player, deviceId }: GameSessionProps) {
  const [game, setGame] = useState(startGame);
  const [cursor, setCursor] = useState(0);
  const [rerollsThisRound, setRerollsThisRound] = useState(0);

  function handleRoundComplete(score: number) {
    setGame((g) => advanceGame(g, score));
    setCursor((c) => c + 1);
    setRerollsThisRound(0); // fresh re-roll allowance for the next round
  }

  // Swap in the next track for the SAME round — no score, no round advance.
  // Capped at MAX_REROLLS_PER_ROUND.
  function handleReroll() {
    if (rerollsThisRound >= MAX_REROLLS_PER_ROUND) return;
    setRerollsThisRound((n) => n + 1);
    setCursor((c) => c + 1);
  }

  // Track couldn't be played (region-locked) — swap it out without counting it
  // against the voluntary re-roll allowance.
  function handleSkipUnavailable() {
    setCursor((c) => c + 1);
  }

  function playAgain() {
    setGame(startGame());
    // Keep advancing the cursor so a new game uses fresh tracks where possible.
  }

  if (game.status === 'finished') {
    return (
      <div className="reveal">
        <h2>Game over</h2>
        <div className="score">{game.totalScore} points</div>
        <p className="fine">over {ROUNDS_PER_GAME} songs</p>
        <div className="row">
          <button className="primary" onClick={playAgain}>
            Play again
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
          Round {game.round} / {ROUNDS_PER_GAME}
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
        onSkipUnavailable={handleSkipUnavailable}
      />
    </div>
  );
}
