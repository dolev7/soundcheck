import { describe, it, expect } from 'vitest';
import type { PoolTrack } from './pool';
import {
  yearBonus,
  startRound,
  submitGuess,
  advanceTier,
  endRound,
  tierClip,
  ARTIST_TIER_POINTS,
  SONG_TIER_POINTS,
} from './round';

const TRACK: PoolTrack = {
  id: 'track-1',
  name: 'The Song',
  uri: 'spotify:track:track-1',
  artists: [
    { id: 'artist-1', name: 'Real Artist' },
    { id: 'artist-2', name: 'Featured Guest' },
  ],
  year: 1990,
  durationMs: 200000,
};

describe('yearBonus', () => {
  it('gives the most for an exact year — a clear jump above merely close', () => {
    expect(yearBonus(1990, 1990)).toBe(25);
    expect(yearBonus(1991, 1990)).toBe(15);
    expect(yearBonus(1989, 1990)).toBe(15);
  });
  it('decays linearly to 0 at a 10-year gap', () => {
    expect(yearBonus(1994, 1990)).toBe(10);
    expect(yearBonus(1985, 1990)).toBe(8);
    expect(yearBonus(1999, 1990)).toBe(2);
    expect(yearBonus(2000, 1990)).toBe(0);
  });
  it('scores 0 beyond 10 years or with missing data', () => {
    expect(yearBonus(2005, 1990)).toBe(0);
    expect(yearBonus(null, 1990)).toBe(0);
    expect(yearBonus(1990, null)).toBe(0);
  });
});

describe('startRound', () => {
  it('begins unsolved at tier 0 with score 0', () => {
    expect(startRound(TRACK)).toEqual({
      track: TRACK,
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
    });
  });
});

describe('submitGuess — bank points, keep going', () => {
  it('banks a correct artist at the current tier but keeps the round open', () => {
    const r = submitGuess(startRound(TRACK), { artistId: 'artist-2' });
    expect(r.artistSolved).toBe(true);
    expect(r.artistPoints).toBe(50); // tracked per objective
    expect(r.score).toBe(50); // tier 0
    expect(r.status).toBe('guessing'); // song + year still open
  });

  it('banks the song with tiered points (earlier = more)', () => {
    expect(submitGuess(startRound(TRACK), { trackId: 'track-1' }).songPoints).toBe(25); // tier 0
    const atTier2 = submitGuess(advanceTier(advanceTier(startRound(TRACK))), { trackId: 'track-1' });
    expect(atTier2.songPoints).toBe(15); // SONG_TIER_POINTS[2]
  });

  it('locks in a year guess and banks its tolerance points', () => {
    const r = submitGuess(startRound(TRACK), { year: 1990 });
    expect(r.yearSolved).toBe(true);
    expect(r.yearGuess).toBe(1990);
    expect(r.yearPoints).toBe(25);
    expect(r.score).toBe(25);
    expect(r.status).toBe('guessing');
  });

  it('advances to the next clip on a wrong guess (does not end the round)', () => {
    const r = submitGuess(startRound(TRACK), { artistId: 'nope' });
    expect(r.artistSolved).toBe(false);
    expect(r.status).toBe('guessing');
    expect(r.tier).toBe(1); // next, longer clip
    expect(r.score).toBe(0);
  });

  it('banks the correct parts and still advances on a wrong one', () => {
    const r = submitGuess(startRound(TRACK), { artistId: 'artist-1', trackId: 'wrong-id' });
    expect(r.artistSolved).toBe(true); // artist banked
    expect(r.songSolved).toBe(false);
    expect(r.score).toBe(50);
    expect(r.status).toBe('guessing');
    expect(r.tier).toBe(1); // wrong song → next clip
  });

  it('ends the round on a wrong guess only when out of clips (last tier)', () => {
    const atLastTier = advanceTier(advanceTier(advanceTier(startRound(TRACK)))); // tier 3
    const r = submitGuess(atLastTier, { artistId: 'nope' });
    expect(r.status).toBe('done');
    expect(r.tier).toBe(3);
  });

  it('stays on the same clip when a partial guess is all-correct (artist only)', () => {
    const r = submitGuess(startRound(TRACK), { artistId: 'artist-1' });
    expect(r.artistSolved).toBe(true);
    expect(r.status).toBe('guessing');
    expect(r.tier).toBe(0); // no wrong guess → same clip
  });

  it('does not double-count an already-solved component', () => {
    let r = submitGuess(startRound(TRACK), { artistId: 'artist-1' }); // +50
    r = submitGuess(r, { artistId: 'artist-1' });
    expect(r.score).toBe(50);
  });

  it('ends the round only once artist, song, and year are all solved', () => {
    const r = submitGuess(startRound(TRACK), {
      artistId: 'artist-1',
      trackId: 'track-1',
      year: 1990,
    });
    expect(r.status).toBe('done');
    expect(r.score).toBe(100); // 50 + 25 + 25 — a perfect round
  });

  it('is a no-op once done', () => {
    const done = endRound(startRound(TRACK));
    expect(submitGuess(done, { artistId: 'artist-1' })).toEqual(done);
  });
});

describe('advanceTier / endRound', () => {
  it('advanceTier moves to the next clip tier', () => {
    expect(advanceTier(startRound(TRACK)).tier).toBe(1);
  });

  it('advanceTier on the last tier ends the round', () => {
    let r = advanceTier(advanceTier(advanceTier(startRound(TRACK)))); // tier 3
    expect(r.tier).toBe(3);
    expect(advanceTier(r).status).toBe('done');
  });

  it('endRound finishes now, keeping whatever was banked', () => {
    let r = submitGuess(startRound(TRACK), { artistId: 'artist-1' }); // +50
    r = endRound(r);
    expect(r.status).toBe('done');
    expect(r.score).toBe(50);
  });
});

describe('tierClip', () => {
  it('intro tiers play from 0 for 2s / 5s / 10s', () => {
    expect(tierClip(0, 200000)).toEqual({ positionMs: 0, durationMs: 2000 });
    expect(tierClip(1, 200000)).toEqual({ positionMs: 0, durationMs: 5000 });
    expect(tierClip(2, 200000)).toEqual({ positionMs: 0, durationMs: 10000 });
  });
  it('the highlight tier seeks to 40% in and plays ~20s', () => {
    expect(tierClip(3, 200000)).toEqual({ positionMs: 80000, durationMs: 20000 });
  });
});

describe('constants', () => {
  it('expose the tunable tier ladders', () => {
    expect(ARTIST_TIER_POINTS).toEqual([50, 40, 30, 20]);
    expect(SONG_TIER_POINTS).toEqual([25, 20, 15, 10]);
  });
});
