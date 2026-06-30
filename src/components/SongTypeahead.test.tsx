import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SongTypeahead } from './SongTypeahead';
import type { PoolTrack } from '../game/pool';

const mk = (id: string, name: string, artist: string): PoolTrack => ({
  id,
  name,
  uri: `spotify:track:${id}`,
  artists: [{ id: `a${id}`, name: artist }],
  year: 1990,
  durationMs: 1000,
});
const tracks = [mk('t1', 'Bohemian Rhapsody', 'Queen'), mk('t2', 'Dancing Queen', 'ABBA')];

describe('SongTypeahead', () => {
  it('filters songs and fires onSelect with the track on click', async () => {
    const onSelect = vi.fn();
    render(<SongTypeahead tracks={tracks} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole('textbox'), 'bohemian');
    await userEvent.click(await screen.findByRole('button', { name: /Bohemian Rhapsody/ }));

    expect(onSelect).toHaveBeenCalledWith(tracks[0]);
  });

  it('shows no options for an empty query', () => {
    render(<SongTypeahead tracks={tracks} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('selects the top match as you type (≥3 chars) — no click needed', async () => {
    const onSelect = vi.fn();
    render(<SongTypeahead tracks={tracks} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('textbox'), 'bohemian');
    expect(onSelect).toHaveBeenLastCalledWith(tracks[0]); // Bohemian Rhapsody
  });

  it('waits for at least 3 characters before suggesting', async () => {
    render(<SongTypeahead tracks={tracks} onSelect={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox'), 'bo');
    expect(screen.queryByRole('button')).toBeNull();

    await userEvent.type(screen.getByRole('textbox'), 'h'); // 'boh'
    expect(await screen.findByRole('button', { name: /Bohemian Rhapsody/ })).toBeInTheDocument();
  });

  it('clears the selection when the query is edited again', async () => {
    const onSelect = vi.fn();
    render(<SongTypeahead tracks={tracks} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole('textbox'), 'dancing');
    await userEvent.click(await screen.findByRole('button', { name: /Dancing Queen/ }));
    onSelect.mockClear();

    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
