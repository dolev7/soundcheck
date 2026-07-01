import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../spotify/library', () => ({
  fetchPlaylists: vi.fn(),
  fetchLikedTracks: vi.fn(),
  fetchPlaylistTracks: vi.fn(),
}));
import { fetchPlaylists, fetchLikedTracks, fetchPlaylistTracks } from '../spotify/library';
import { PlaylistPicker } from './PlaylistPicker';
import type { PoolTrack } from '../game/pool';

const mockPlaylists = vi.mocked(fetchPlaylists);
const mockLiked = vi.mocked(fetchLikedTracks);
const mockPlaylistTracks = vi.mocked(fetchPlaylistTracks);

const track = (id: string, artistId: string, artistName: string): PoolTrack => ({
  id,
  name: `Song ${id}`,
  uri: `spotify:track:${id}`,
  artists: [{ id: artistId, name: artistName }],
  year: 1990,
  durationMs: 180000,
});

// A full game needs at least 10 songs, so most tests load 10.
const tenTracks = Array.from({ length: 10 }, (_, i) => track(`t${i}`, `a${i}`, `Artist ${i}`));

beforeEach(() => {
  vi.resetAllMocks();
  mockPlaylists.mockResolvedValue([{ id: 'p1', name: 'Road Trip', trackCount: 12 }]);
});

describe('PlaylistPicker', () => {
  it('defaults to Liked Songs and reports the built pool', async () => {
    mockLiked.mockResolvedValue(tenTracks);
    const onPoolLoaded = vi.fn();

    render(<PlaylistPicker onPoolLoaded={onPoolLoaded} />);

    // the user's playlists populate the dropdown alongside Liked Songs
    await screen.findByRole('option', { name: /Road Trip/ });

    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    await waitFor(() => expect(onPoolLoaded).toHaveBeenCalledTimes(1));
    const loaded = onPoolLoaded.mock.calls[0][0];
    expect(mockLiked).toHaveBeenCalled();
    expect(loaded.source).toEqual({ kind: 'liked' });
    expect(loaded.tracks).toHaveLength(10);
    expect(loaded.artists).toHaveLength(10);
  });

  it('loads a chosen playlist by id', async () => {
    mockPlaylistTracks.mockResolvedValue(tenTracks);
    const onPoolLoaded = vi.fn();

    render(<PlaylistPicker onPoolLoaded={onPoolLoaded} />);
    await screen.findByRole('option', { name: /Road Trip/ });

    await userEvent.selectOptions(screen.getByLabelText('Source'), 'p1');
    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    await waitFor(() => expect(mockPlaylistTracks).toHaveBeenCalledWith('p1', expect.any(Function)));
    const loaded = onPoolLoaded.mock.calls[0][0];
    expect(loaded.source).toEqual({ kind: 'playlist', id: 'p1', name: 'Road Trip' });
    expect(loaded.tracks).toHaveLength(10);
  });

  it('allows a smaller source when fewer rounds are chosen', async () => {
    const fiveTracks = Array.from({ length: 5 }, (_, i) => track(`t${i}`, `a${i}`, `Artist ${i}`));
    mockLiked.mockResolvedValue(fiveTracks);
    const onPoolLoaded = vi.fn();

    render(<PlaylistPicker onPoolLoaded={onPoolLoaded} />);
    await screen.findByRole('option', { name: /Road Trip/ });

    await userEvent.selectOptions(screen.getByLabelText('Rounds'), '3');
    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    await waitFor(() => expect(onPoolLoaded).toHaveBeenCalled());
    const loaded = onPoolLoaded.mock.calls[0][0];
    expect(loaded.rounds).toBe(3);
    expect(loaded.tracks).toHaveLength(5);
  });

  it('shows an error if the pool is empty', async () => {
    mockLiked.mockResolvedValue([]);
    const onPoolLoaded = vi.fn();

    render(<PlaylistPicker onPoolLoaded={onPoolLoaded} />);
    await screen.findByRole('option', { name: /Road Trip/ });
    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    await screen.findByText(/no playable tracks/i);
    expect(onPoolLoaded).not.toHaveBeenCalled();
  });

  it('rejects a source with fewer than 10 playable songs', async () => {
    mockLiked.mockResolvedValue([track('t1', 'a1', 'A'), track('t2', 'a2', 'B')]);
    const onPoolLoaded = vi.fn();

    render(<PlaylistPicker onPoolLoaded={onPoolLoaded} />);
    await screen.findByRole('option', { name: /Road Trip/ });
    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    await screen.findByText(/at least 10/i);
    expect(onPoolLoaded).not.toHaveBeenCalled();
  });

  it('shows load progress as "loaded / total" while loading', async () => {
    let resolveFetch!: (tracks: PoolTrack[]) => void;
    const pending = new Promise<PoolTrack[]>((resolve) => {
      resolveFetch = resolve;
    });
    mockLiked.mockImplementation((onProgress?: (loaded: number, total: number) => void) => {
      onProgress?.(2, 5);
      return pending;
    });

    render(<PlaylistPicker onPoolLoaded={vi.fn()} />);
    await screen.findByRole('option', { name: /Road Trip/ });
    await userEvent.click(screen.getByRole('button', { name: /load/i }));

    expect(await screen.findByText(/2\s*\/\s*5/)).toBeInTheDocument();
    resolveFetch(tenTracks);
  });
});
