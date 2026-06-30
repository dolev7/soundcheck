import { describe, it, expect, beforeEach } from 'vitest';
import { loadBestScore, recordScore } from './bestScore';

beforeEach(() => localStorage.clear());

describe('bestScore', () => {
  it('defaults to 0 when nothing is stored', () => {
    expect(loadBestScore()).toBe(0);
  });

  it('records and persists a new best', () => {
    expect(recordScore(120)).toEqual({ best: 120, isNewBest: true });
    expect(loadBestScore()).toBe(120);
  });

  it('does not lower the best score', () => {
    recordScore(120);
    expect(recordScore(80)).toEqual({ best: 120, isNewBest: false });
    expect(loadBestScore()).toBe(120);
  });

  it('treats an equal score as not a new best', () => {
    recordScore(100);
    expect(recordScore(100)).toEqual({ best: 100, isNewBest: false });
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem('soundcheck.best', 'not-a-number');
    expect(loadBestScore()).toBe(0);
  });
});
