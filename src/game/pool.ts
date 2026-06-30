// Pure track-pool logic. No I/O here — everything is a deterministic function
// of its inputs so it can be unit-tested directly (see pool.test.ts).

export interface RawArtist {
  id: string | null;
  name: string;
}

export interface RawTrack {
  id: string | null;
  name: string;
  uri: string;
  is_local?: boolean;
  is_playable?: boolean;
  duration_ms?: number;
  artists: RawArtist[];
  album?: {
    release_date?: string;
    release_date_precision?: string;
  };
}

/** A `GET /me/tracks` or `GET /playlists/{id}/tracks` row. */
export interface RawItem {
  track: RawTrack | null;
}

export interface Artist {
  id: string;
  name: string;
}

/** A cleaned, game-ready track. */
export interface PoolTrack {
  id: string;
  name: string;
  uri: string;
  artists: Artist[];
  year: number | null;
  /** Track length in ms (0 if unknown) — needed for the highlight-tier seek. */
  durationMs: number;
}

/** Parse the leading 4-digit year from a Spotify release_date, or null. */
export function extractYear(releaseDate?: string): number | null {
  if (!releaseDate) return null;
  const match = /^(\d{4})/.exec(releaseDate);
  return match ? Number(match[1]) : null;
}

/**
 * Convert a raw Spotify track into a PoolTrack, or null if it can't be used:
 * no id, local file, explicitly unplayable, or no credited artist with an id
 * (we match the answer by artist id, so an artist-less track is unanswerable).
 */
export function normalizeTrack(track: RawTrack): PoolTrack | null {
  if (!track.id) return null;
  if (track.is_local) return null;
  if (track.is_playable === false) return null;

  const artists: Artist[] = track.artists
    .filter((a): a is RawArtist & { id: string } => typeof a.id === 'string' && a.id.length > 0)
    .map((a) => ({ id: a.id, name: a.name }));

  if (artists.length === 0) return null;

  return {
    id: track.id,
    name: track.name,
    uri: track.uri,
    artists,
    year: extractYear(track.album?.release_date),
    durationMs: track.duration_ms ?? 0,
  };
}

/** Normalize, filter unusable, and dedupe by track id (first occurrence wins). */
export function buildPool(items: RawItem[]): PoolTrack[] {
  const pool: PoolTrack[] = [];
  const seen = new Set<string>();
  for (const { track } of items) {
    if (!track) continue;
    const normalized = normalizeTrack(track);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    pool.push(normalized);
  }
  return pool;
}

/** Unique artists across the pool, by id, sorted by name. Powers the typeahead. */
export function distinctArtists(pool: PoolTrack[]): Artist[] {
  const byId = new Map<string, Artist>();
  for (const track of pool) {
    for (const artist of track.artists) {
      if (!byId.has(artist.id)) byId.set(artist.id, artist);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fold a string for searching: decompose, strip combining marks (Latin accents
 * AND Hebrew niqqud / Arabic harakat), lower-case, trim. This makes the
 * typeahead match "Beyonce"→"Beyoncé" and bare Hebrew→pointed Hebrew.
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Typeahead match: diacritic-insensitive substring on a name field, with prefix
 * matches ranked ahead of mid-string ones, then alphabetical. Empty query → [].
 */
function searchByName<T>(
  items: T[],
  getName: (item: T) => string,
  query: string,
  limit: number,
): T[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  return items
    .map((item) => ({ item, norm: normalizeForSearch(getName(item)) }))
    .filter(({ norm }) => norm.includes(q))
    .sort((a, b) => {
      const aPrefix = a.norm.startsWith(q) ? 0 : 1;
      const bPrefix = b.norm.startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix || getName(a.item).localeCompare(getName(b.item));
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

/** Artist typeahead candidates. */
export function filterArtists(artists: Artist[], query: string, limit = 8): Artist[] {
  return searchByName(artists, (a) => a.name, query, limit);
}

/** Song (track) typeahead candidates, matched on track title. */
export function filterTracks(tracks: PoolTrack[], query: string, limit = 8): PoolTrack[] {
  return searchByName(tracks, (t) => t.name, query, limit);
}

// mulberry32 — tiny, fast, seedable PRNG. Deterministic given a seed, which
// keeps shuffles reproducible in tests while still being well-distributed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure Fisher–Yates shuffle with an injectable seed. Returns a new array. */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
