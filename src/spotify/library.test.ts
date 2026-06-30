import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawItem, RawTrack } from '../game/pool';

// Mock the network layer so we test pagination/assembly, not real HTTP.
vi.mock('./api', () => ({ spotifyGet: vi.fn() }));
import { spotifyGet } from './api';
import { fetchLikedTracks, fetchPlaylistTracks, fetchPlaylists } from './library';

const mockGet = vi.mocked(spotifyGet);

function rt(id: string, extra: Partial<RawTrack> = {}): RawTrack {
  return {
    id,
    name: `Song ${id}`,
    uri: `spotify:track:${id}`,
    is_local: false,
    is_playable: true,
    artists: [{ id: `a-${id}`, name: `Artist ${id}` }],
    album: { release_date: '2000-01-01' },
    ...extra,
  };
}
const row = (track: RawTrack | null): RawItem => ({ track });

beforeEach(() => mockGet.mockReset());

describe('fetchLikedTracks', () => {
  it('follows pages until next is null and returns a built pool', async () => {
    mockGet
      .mockResolvedValueOnce({ items: [row(rt('t1'))], next: 'more' })
      .mockResolvedValueOnce({ items: [row(rt('t2'))], next: null });

    const pool = await fetchLikedTracks();

    expect(pool.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/me/tracks?limit=50&offset=0&market=from_token');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/me/tracks?limit=50&offset=50&market=from_token');
  });

  it('filters unusable tracks and dedupes across pages (via buildPool)', async () => {
    mockGet
      .mockResolvedValueOnce({
        items: [row(rt('t1')), row(null), row(rt('t2', { is_local: true }))],
        next: 'more',
      })
      .mockResolvedValueOnce({ items: [row(rt('t1')), row(rt('t3'))], next: null });

    const pool = await fetchLikedTracks();
    expect(pool.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('reports progress (loaded / total) after each page', async () => {
    mockGet
      .mockResolvedValueOnce({ items: [row(rt('t1')), row(rt('t2'))], next: 'more', total: 3 })
      .mockResolvedValueOnce({ items: [row(rt('t3'))], next: null, total: 3 });

    const progress: Array<[number, number]> = [];
    await fetchLikedTracks((loaded, total) => progress.push([loaded, total]));

    expect(progress).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });
});

describe('fetchPlaylistTracks', () => {
  it('hits the playlist tracks endpoint with the id', async () => {
    mockGet.mockResolvedValueOnce({ items: [row(rt('t1'))], next: null });

    const pool = await fetchPlaylistTracks('abc123');
    expect(pool.map((t) => t.id)).toEqual(['t1']);
    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/playlists/abc123/tracks?limit=50&offset=0&market=from_token',
    );
  });
});

describe('fetchPlaylists', () => {
  it('maps playlist summaries with track counts', async () => {
    mockGet.mockResolvedValueOnce({
      items: [
        { id: 'p1', name: 'Road Trip', tracks: { total: 42 } },
        { id: 'p2', name: 'Chill', tracks: { total: 10 } },
      ],
      next: null,
    });

    const lists = await fetchPlaylists();
    expect(lists).toEqual([
      { id: 'p1', name: 'Road Trip', trackCount: 42 },
      { id: 'p2', name: 'Chill', trackCount: 10 },
    ]);
  });
});
