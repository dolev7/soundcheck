import { describe, it, expect } from 'vitest';
import {
  startGame,
  advanceGame,
  buildShareText,
  roundMarks,
  ROUNDS_PER_GAME,
  type RoundResult,
} from './game';

describe('game session', () => {
  it('defaults to a 10-round game', () => {
    expect(ROUNDS_PER_GAME).toBe(10);
  });

  it('starts at round 1 with score 0, playing', () => {
    expect(startGame()).toEqual({ round: 1, totalScore: 0, status: 'playing' });
  });

  it('accumulates score and advances the round', () => {
    expect(advanceGame(startGame(), 100)).toEqual({
      round: 2,
      totalScore: 100,
      status: 'playing',
    });
  });

  it('finishes after the last round and keeps the final total', () => {
    let g = startGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) g = advanceGame(g, 10);
    expect(g.status).toBe('finished');
    expect(g.round).toBe(ROUNDS_PER_GAME);
    expect(g.totalScore).toBe(10 * ROUNDS_PER_GAME);
  });

  it('is a no-op once finished', () => {
    let g = startGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) g = advanceGame(g, 10);
    expect(advanceGame(g, 999)).toEqual(g);
  });
});

const baseResult: RoundResult = {
  trackName: 'x',
  artistNames: 'y',
  score: 0,
  artistSolved: false,
  songSolved: false,
  yearSolved: false,
  yearPoints: 0,
};

describe('roundMarks', () => {
  it('marks solved artist/song green, unsolved black', () => {
    expect(roundMarks({ ...baseResult, artistSolved: true })[0]).toBe('🟩');
    expect(roundMarks(baseResult)[0]).toBe('⬛');
    expect(roundMarks({ ...baseResult, songSolved: true })[1]).toBe('🟩');
  });

  it('marks the year green=exact, yellow=close, black=wide-miss/none', () => {
    expect(roundMarks({ ...baseResult, yearSolved: true, yearPoints: 25 })[2]).toBe('🟩');
    expect(roundMarks({ ...baseResult, yearSolved: true, yearPoints: 15 })[2]).toBe('🟨');
    expect(roundMarks({ ...baseResult, yearSolved: true, yearPoints: 0 })[2]).toBe('⬛');
    expect(roundMarks({ ...baseResult, yearSolved: false })[2]).toBe('⬛');
  });
});

describe('buildShareText', () => {
  it('renders a score header, an emoji grid (with year accuracy), and the url', () => {
    const results: RoundResult[] = [
      { ...baseResult, score: 100, artistSolved: true, songSolved: true, yearSolved: true, yearPoints: 25 },
      { ...baseResult, score: 55, artistSolved: true, yearSolved: true, yearPoints: 15 },
    ];
    const text = buildShareText(results, 155, 'https://example.test/');
    expect(text).toContain('155 pts');
    expect(text).toContain('🟩🟩🟩');
    expect(text).toContain('🟩⬛🟨'); // artist hit, song missed, year close
    expect(text).toContain('https://example.test/');
  });
});
