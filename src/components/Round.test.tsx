import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// startClip is browser glue (real SDK); stub it so we test the round flow only.
vi.mock('../spotify/playback', () => ({ startClip: vi.fn(() => () => {}) }));
import { startClip } from '../spotify/playback';
import { Round } from './Round';
import type { Artist, PoolTrack } from '../game/pool';

const track: PoolTrack = {
  id: 't1',
  name: 'Dancing Queen',
  uri: 'spotify:track:t1',
  artists: [{ id: 'a1', name: 'ABBA' }],
  year: 1976,
  durationMs: 200000,
};
const artists: Artist[] = [
  { id: 'a1', name: 'ABBA' },
  { id: 'a2', name: 'Queen' },
];
const player = {} as Spotify.Player;

function renderRound(props: Partial<React.ComponentProps<typeof Round>> = {}) {
  return render(
    <Round
      track={track}
      tracks={[track]}
      artists={artists}
      player={player}
      deviceId="dev"
      onComplete={vi.fn()}
      {...props}
    />,
  );
}

async function guessArtist() {
  await userEvent.type(screen.getByLabelText('Guess the artist'), 'abba');
  await userEvent.click(await screen.findByRole('button', { name: 'ABBA' }));
}

describe('Round', () => {
  it('banks a correct artist without ending the round', async () => {
    renderRound();
    await guessArtist();
    await userEvent.click(screen.getByRole('button', { name: /lock in/i }));

    // Artist objective is solved (its input is gone), but the round continues.
    expect(screen.queryByLabelText('Guess the artist')).toBeNull();
    expect(screen.getByLabelText('Guess the song')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
  });

  it('completes with a perfect 100 once artist + song + exact year are all in', async () => {
    const onComplete = vi.fn();
    renderRound({ onComplete });

    await guessArtist();
    await userEvent.type(screen.getByLabelText('Guess the song'), 'dancing');
    await userEvent.click(await screen.findByRole('button', { name: /Dancing Queen/ }));
    await userEvent.click(screen.getByLabelText(/guess the year/i));
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: String(track.year) } });

    await userEvent.click(screen.getByRole('button', { name: /lock in/i }));
    expect(screen.getByText('+50')).toBeInTheDocument(); // per-objective points in the breakdown
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onComplete).toHaveBeenCalledWith(100); // 50 artist + 25 song + 25 year
  });

  it('banks fewer artist points at a later tier', async () => {
    const onComplete = vi.fn();
    renderRound({ onComplete });

    await userEvent.click(screen.getByRole('button', { name: /more audio/i })); // → tier 1
    await guessArtist();
    await userEvent.click(screen.getByRole('button', { name: /lock in/i }));
    await userEvent.click(screen.getByRole('button', { name: /give up/i }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onComplete).toHaveBeenCalledWith(40); // ARTIST_TIER_POINTS[1]
  });

  it('Give up ends the round and reports the banked score', async () => {
    const onComplete = vi.fn();
    renderRound({ onComplete });

    await userEvent.click(screen.getByRole('button', { name: /give up/i }));
    expect(screen.getByText(/Dancing Queen/)).toBeInTheDocument(); // reveal shows the answer
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onComplete).toHaveBeenCalledWith(0);
  });

  it('shows a live countdown once the clip starts playing', async () => {
    vi.mocked(startClip).mockImplementationOnce((_player, _device, _uri, _clip, cbs) => {
      cbs?.onStart?.();
      return () => {};
    });
    renderRound();

    await userEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(screen.getByTestId('countdown')).toHaveTextContent('2'); // tier 0 = 2s
  });

  it('lets the player re-roll a dud song via "Different song"', async () => {
    const onReroll = vi.fn();
    renderRound({ onReroll });

    await userEvent.click(screen.getByRole('button', { name: /different song/i }));
    expect(onReroll).toHaveBeenCalledTimes(1);
  });
});
