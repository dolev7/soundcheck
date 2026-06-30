import { buildPool, type PoolTrack, type RawItem } from '../game/pool';
import { spotifyGet } from './api';

/** Spotify cursor/offset paging envelope (the fields we use). */
interface Paging<T> {
  items: T[];
  next: string | null;
  total?: number;
}

interface RawPlaylist {
  id: string;
  name: string;
  tracks?: { total: number };
}

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
}

/** Reports how many raw tracks have been loaded out of the source's total. */
export type ProgressCallback = (loaded: number, total: number) => void;

const PAGE_SIZE = 50; // Spotify's max for these endpoints.

/**
 * Walk every page of an offset-paginated endpoint and concatenate the items.
 * `buildPath` produces the relative path for a given offset; we stop when the
 * API reports no `next` page (or returns an empty page, as a safety net).
 * After each page, `onProgress` is invoked with the running count and the total.
 */
async function fetchAllPages<T>(
  buildPath: (offset: number, limit: number) => string,
  onProgress?: ProgressCallback,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await spotifyGet<Paging<T>>(buildPath(offset, PAGE_SIZE));
    all.push(...page.items);
    const total = page.total ?? all.length;
    onProgress?.(Math.min(all.length, total), total);
    offset += PAGE_SIZE;
    if (!page.next || page.items.length === 0) break;
  }
  return all;
}

/** The "Liked Songs" pool. */
export async function fetchLikedTracks(onProgress?: ProgressCallback): Promise<PoolTrack[]> {
  const items = await fetchAllPages<RawItem>(
    (offset, limit) => `/me/tracks?limit=${limit}&offset=${offset}`,
    onProgress,
  );
  return buildPool(items);
}

/** A specific playlist's pool. */
export async function fetchPlaylistTracks(
  playlistId: string,
  onProgress?: ProgressCallback,
): Promise<PoolTrack[]> {
  const items = await fetchAllPages<RawItem>(
    (offset, limit) =>
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&offset=${offset}`,
    onProgress,
  );
  return buildPool(items);
}

/** The user's playlists, for the picker dropdown. */
export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const items = await fetchAllPages<RawPlaylist>(
    (offset, limit) => `/me/playlists?limit=${limit}&offset=${offset}`,
  );
  return items
    .filter((p): p is RawPlaylist => Boolean(p))
    .map((p) => ({ id: p.id, name: p.name, trackCount: p.tracks?.total ?? 0 }));
}
