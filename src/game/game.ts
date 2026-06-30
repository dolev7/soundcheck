// Pure game-session state: a fixed number of rounds with a running total.
// No I/O — unit-tested in game.test.ts.

/** How many songs make up one game. */
export const ROUNDS_PER_GAME = 10;

export type GameStatus = 'playing' | 'finished';

export interface GameState {
  /** 1-based current round, 1..ROUNDS_PER_GAME. */
  round: number;
  totalScore: number;
  status: GameStatus;
}

export function startGame(): GameState {
  return { round: 1, totalScore: 0, status: 'playing' };
}

/**
 * Bank a finished round's score and move on. After the last round the game is
 * marked finished (round stays at ROUNDS_PER_GAME). A no-op once finished.
 */
export function advanceGame(game: GameState, roundScore: number): GameState {
  if (game.status !== 'playing') return game;
  const totalScore = game.totalScore + roundScore;
  if (game.round >= ROUNDS_PER_GAME) {
    return { ...game, totalScore, status: 'finished' };
  }
  return { round: game.round + 1, totalScore, status: 'playing' };
}

/** Per-round outcome, accumulated for the end-of-game recap + share card. */
export interface RoundResult {
  trackName: string;
  artistNames: string;
  score: number;
  artistSolved: boolean;
  songSolved: boolean;
  yearSolved: boolean;
}

/**
 * A Wordle-style shareable summary: a score header, one 🟩/⬛ row per round
 * (artist / song / year), and the game URL.
 */
export function buildShareText(results: RoundResult[], total: number, url: string): string {
  const grid = results
    .map((r) =>
      [r.artistSolved, r.songSolved, r.yearSolved].map((solved) => (solved ? '🟩' : '⬛')).join(''),
    )
    .join('\n');
  return `SoundCheck 🎵 ${total} pts\n${grid}\n${url}`;
}
