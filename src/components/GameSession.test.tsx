import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoundResult } from '../game/game';

// Replace the real Round with a stub that exposes the track + controls.
vi.mock('./Round', () => ({
  Round: ({
    track,
    onComplete,
    onReroll,
    canReroll,
  }: {
    track: { id: string };
    onComplete: (result: RoundResult) => void;
    onReroll?: () => void;
    canReroll?: boolean;
  }) => (
    <div>
      <span data-testid="track">{track.id}</span>
      <button
        onClick={() =>
          onComplete({
            score: 10,
            trackName: track.id,
            artistNames: 'Artist',
            artistSolved: true,
            songSolved: false,
            yearSolved: false,
          })
        }
      >
        finish round
      </button>
      {canReroll && <button onClick={() => onReroll?.()}>reroll</button>}
    </div>
  ),
}));
import { GameSession } from './GameSession';
import { ROUNDS_PER_GAME } from '../game/game';
import type { LoadedPool } from './PlaylistPicker';
import type { PoolTrack } from '../game/pool';

const mk = (i: number): PoolTrack => ({
  id: `t${i}`,
  name: `Song ${i}`,
  uri: `spotify:track:t${i}`,
  artists: [{ id: `a${i}`, name: `Artist ${i}` }],
  year: 1990,
  durationMs: 200000,
});

const pool: LoadedPool = {
  source: { kind: 'liked' },
  tracks: Array.from({ length: 30 }, (_, i) => mk(i)),
  artists: [{ id: 'a0', name: 'Artist 0' }],
};
const player = {} as Spotify.Player;

beforeEach(() => localStorage.clear()); // personal best persists otherwise

describe('GameSession', () => {
  it('runs exactly ROUNDS_PER_GAME rounds, then shows results with the total', async () => {
    render(<GameSession pool={pool} player={player} deviceId="dev" />);

    expect(screen.getByText(new RegExp(`Round 1 / ${ROUNDS_PER_GAME}`))).toBeInTheDocument();

    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      await userEvent.click(screen.getByRole('button', { name: /finish round/i }));
    }

    expect(screen.getByText(/game over/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${10 * ROUNDS_PER_GAME}`))).toBeInTheDocument();
    // No more rounds to play once finished.
    expect(screen.queryByRole('button', { name: /finish round/i })).toBeNull();
  });

  it('re-rolls to a different track once per round, then disallows it', async () => {
    render(<GameSession pool={pool} player={player} deviceId="dev" />);

    const first = screen.getByTestId('track').textContent;
    await userEvent.click(screen.getByRole('button', { name: /reroll/i }));

    expect(screen.getByTestId('track').textContent).not.toBe(first);
    expect(screen.getByText(new RegExp(`Round 1 / ${ROUNDS_PER_GAME}`))).toBeInTheDocument();
    // Only one re-roll allowed per round.
    expect(screen.queryByRole('button', { name: /reroll/i })).toBeNull();
  });

  it('plays a different track each round (pool is deduped + walked in order)', async () => {
    render(<GameSession pool={pool} player={player} deviceId="dev" />);

    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      seen.add(screen.getByTestId('track').textContent ?? '');
      await userEvent.click(screen.getByRole('button', { name: /finish round/i }));
    }
    expect(seen.size).toBe(3); // three rounds, three distinct tracks
  });

  it('can start a new game from the results screen', async () => {
    render(<GameSession pool={pool} player={player} deviceId="dev" />);
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      await userEvent.click(screen.getByRole('button', { name: /finish round/i }));
    }
    await userEvent.click(screen.getByRole('button', { name: /play again/i }));
    expect(screen.getByText(new RegExp(`Round 1 / ${ROUNDS_PER_GAME}`))).toBeInTheDocument();
  });
});
