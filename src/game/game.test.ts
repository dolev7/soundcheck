import { describe, it, expect } from 'vitest';
import { startGame, advanceGame, buildShareText, ROUNDS_PER_GAME, type RoundResult } from './game';

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

describe('buildShareText', () => {
  const r = (a: boolean, s: boolean, y: boolean, score: number): RoundResult => ({
    trackName: 'x',
    artistNames: 'y',
    score,
    artistSolved: a,
    songSolved: s,
    yearSolved: y,
  });

  it('renders a score header, an emoji grid, and the url', () => {
    const text = buildShareText(
      [r(true, true, true, 100), r(true, false, false, 50)],
      150,
      'https://example.test/',
    );
    expect(text).toContain('150 pts');
    expect(text).toContain('🟩🟩🟩');
    expect(text).toContain('🟩⬛⬛');
    expect(text).toContain('https://example.test/');
  });
});
