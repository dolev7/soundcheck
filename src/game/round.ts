// Pure scoring + tier state machine for one round. No I/O, no audio — just the
// rules, unit-tested in round.test.ts.
//
// Model: artist, song, and year are three independent objectives. A correct
// guess banks its points (at the tier it was guessed) but does NOT end the
// round — the player keeps escalating clips until all three are solved or they
// give up. Whatever was banked is kept.
import type { PoolTrack } from './pool';

/** Artist points by the tier it's guessed at: 2s / 5s / 10s / highlight. */
export const ARTIST_TIER_POINTS = [50, 40, 30, 20] as const;
/** Song points by the tier it's guessed at (earlier = more). */
export const SONG_TIER_POINTS = [25, 20, 15, 10] as const;
/** Human labels for each tier, index-aligned with the ladders. */
export const TIER_LABELS = ['2s', '5s', '10s', 'highlight'] as const;

const LAST_TIER = ARTIST_TIER_POINTS.length - 1;
const HIGHLIGHT_FRACTION = 0.4;
const HIGHLIGHT_MS = 20_000;
const INTRO_MS = [2_000, 5_000, 10_000];

// Year scoring (not tiered): exact is the top bonus; otherwise points slide
// linearly from YEAR_NEAR (1 year off) down to 0 at a YEAR_WINDOW-year gap.
export const YEAR_EXACT = 25;
const YEAR_NEAR = 15;
export const YEAR_WINDOW = 10;

export type RoundStatus = 'guessing' | 'done';

export interface RoundState {
  track: PoolTrack;
  /** Current clip tier, 0..LAST_TIER. */
  tier: number;
  artistSolved: boolean;
  songSolved: boolean;
  yearSolved: boolean;
  /** The year the player locked in (for the reveal), or null. */
  yearGuess: number | null;
  /** Points banked for each objective (0 until solved) — for the breakdown. */
  artistPoints: number;
  songPoints: number;
  yearPoints: number;
  /** Banked points so far (sum of the three). */
  score: number;
  status: RoundStatus;
}

export interface Guess {
  artistId?: string | null;
  trackId?: string | null;
  year?: number | null;
}

export interface TierClip {
  positionMs: number;
  durationMs: number;
}

/**
 * Year bonus: an exact match is the top score and a clear jump above merely
 * close. Otherwise points decay linearly from YEAR_NEAR (1 year off) to 0 at a
 * YEAR_WINDOW-year gap; beyond the window, 0.
 */
export function yearBonus(guessYear: number | null | undefined, actualYear: number | null): number {
  if (guessYear == null || actualYear == null) return 0;
  const gap = Math.abs(guessYear - actualYear);
  if (gap === 0) return YEAR_EXACT;
  if (gap >= YEAR_WINDOW) return 0;
  return Math.round((YEAR_NEAR * (YEAR_WINDOW - gap)) / (YEAR_WINDOW - 1));
}

export function startRound(track: PoolTrack): RoundState {
  return {
    track,
    tier: 0,
    artistSolved: false,
    songSolved: false,
    yearSolved: false,
    yearGuess: null,
    artistPoints: 0,
    songPoints: 0,
    yearPoints: 0,
    score: 0,
    status: 'guessing',
  };
}

function artistIsCorrect(track: PoolTrack, artistId?: string | null): boolean {
  return artistId != null && track.artists.some((a) => a.id === artistId);
}

/**
 * Lock in the current guesses. A correct artist/song banks its points at the
 * CURRENT tier; a WRONG artist/song ends the round (you committed and missed).
 * Year is tolerance-scored, so it's never "wrong" — it just locks in. The round
 * also ends once all three are solved. Empty fields aren't guesses.
 */
export function submitGuess(state: RoundState, guess: Guess): RoundState {
  if (state.status !== 'guessing') return state;

  // Defaults guard against older/partial state shapes (e.g. preserved across a
  // hot-reload) so the score can never become NaN.
  let {
    artistSolved,
    songSolved,
    yearSolved,
    yearGuess,
    artistPoints = 0,
    songPoints = 0,
    yearPoints = 0,
  } = state;

  // A guessed artist/song that's correct banks its points; one that's wrong
  // ends the round. Year is tolerance-scored, so it just locks in.
  let wrong = false;

  if (!artistSolved && guess.artistId != null) {
    if (artistIsCorrect(state.track, guess.artistId)) {
      artistSolved = true;
      artistPoints = ARTIST_TIER_POINTS[state.tier];
    } else {
      wrong = true;
    }
  }
  if (!songSolved && guess.trackId != null) {
    if (guess.trackId === state.track.id) {
      songSolved = true;
      songPoints = SONG_TIER_POINTS[state.tier];
    } else {
      wrong = true;
    }
  }
  if (!yearSolved && guess.year != null) {
    yearSolved = true;
    yearGuess = guess.year;
    yearPoints = yearBonus(guess.year, state.track.year);
  }

  const allSolved = artistSolved && songSolved && yearSolved;
  const status: RoundStatus = wrong || allSolved ? 'done' : 'guessing';
  return {
    ...state,
    artistSolved,
    songSolved,
    yearSolved,
    yearGuess,
    artistPoints,
    songPoints,
    yearPoints,
    score: artistPoints + songPoints + yearPoints,
    status,
  };
}

/** Advance to the next (longer) clip tier; on the last tier this ends the round. */
export function advanceTier(state: RoundState): RoundState {
  if (state.status !== 'guessing') return state;
  if (state.tier < LAST_TIER) return { ...state, tier: state.tier + 1 };
  return { ...state, status: 'done' };
}

/** End the round now, keeping whatever's been banked. */
export function endRound(state: RoundState): RoundState {
  if (state.status !== 'guessing') return state;
  return { ...state, status: 'done' };
}

/** Audio segment to play for a tier, given the track length. */
export function tierClip(tier: number, trackDurationMs: number): TierClip {
  if (tier < LAST_TIER) {
    return { positionMs: 0, durationMs: INTRO_MS[tier] };
  }
  return {
    positionMs: Math.floor(trackDurationMs * HIGHLIGHT_FRACTION),
    durationMs: HIGHLIGHT_MS,
  };
}
