// Pure game-session state: a fixed number of rounds with a running total.
// No I/O — unit-tested in game.test.ts.

import { YEAR_EXACT } from './round';

/** Default game length. */
export const ROUNDS_PER_GAME = 10;
/** Selectable game lengths (rounds-per-game dropdown). */
export const ROUND_OPTIONS = [3, 5, 10] as const;

export type GameStatus = 'playing' | 'finished';

export interface GameState {
  /** 1-based current round, 1..totalRounds. */
  round: number;
  totalScore: number;
  status: GameStatus;
  /** How many rounds this game runs for. */
  totalRounds: number;
}

export function startGame(totalRounds: number = ROUNDS_PER_GAME): GameState {
  return { round: 1, totalScore: 0, status: 'playing', totalRounds };
}

/**
 * Bank a finished round's score and move on. After the last round the game is
 * marked finished (round stays at totalRounds). A no-op once finished.
 */
export function advanceGame(game: GameState, roundScore: number): GameState {
  if (game.status !== 'playing') return game;
  const totalScore = game.totalScore + roundScore;
  if (game.round >= game.totalRounds) {
    return { ...game, totalScore, status: 'finished' };
  }
  return { ...game, round: game.round + 1, totalScore };
}

/** Per-round outcome, accumulated for the end-of-game recap + share card. */
export interface RoundResult {
  trackName: string;
  artistNames: string;
  score: number;
  artistSolved: boolean;
  songSolved: boolean;
  yearSolved: boolean;
  /** Points the year guess earned (0..YEAR_EXACT) — drives the half-right mark. */
  yearPoints: number;
}

const MARK_FULL = '🟩';
const MARK_PARTIAL = '🟨';
const MARK_NONE = '⬛';

/**
 * The three result squares for a round (artist / song / year). Artist and song
 * are all-or-nothing; the year is green for an exact hit, **yellow** for
 * close-but-not-exact (partial points), and black for a wide miss or no guess.
 */
export function roundMarks(r: RoundResult): [string, string, string] {
  const artist = r.artistSolved ? MARK_FULL : MARK_NONE;
  const song = r.songSolved ? MARK_FULL : MARK_NONE;
  let year = MARK_NONE;
  if (r.yearSolved && r.yearPoints >= YEAR_EXACT) year = MARK_FULL;
  else if (r.yearSolved && r.yearPoints > 0) year = MARK_PARTIAL;
  return [artist, song, year];
}

/**
 * A Wordle-style shareable summary: a score header, one row of result squares
 * per round (see roundMarks), and the game URL.
 */
export function buildShareText(results: RoundResult[], total: number, url: string): string {
  const grid = results.map((r) => roundMarks(r).join('')).join('\n');
  return `SoundCheck 🎵 ${total} pts\n${grid}\n${url}`;
}
