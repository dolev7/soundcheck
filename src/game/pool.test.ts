import { describe, it, expect } from 'vitest';
import {
  extractYear,
  normalizeTrack,
  buildPool,
  distinctArtists,
  filterArtists,
  filterTracks,
  seededShuffle,
  type Artist,
  type PoolTrack,
  type RawTrack,
  type RawItem,
} from './pool';

function rawTrack(overrides: Partial<RawTrack> = {}): RawTrack {
  return {
    id: 't1',
    name: 'Song One',
    uri: 'spotify:track:t1',
    is_local: false,
    is_playable: true,
    duration_ms: 213000,
    artists: [{ id: 'a1', name: 'Artist One' }],
    album: { release_date: '1991-09-24', release_date_precision: 'day' },
    ...overrides,
  };
}

const item = (track: RawTrack | null): RawItem => ({ track });

describe('extractYear', () => {
  it('parses a full release date', () => {
    expect(extractYear('1991-09-24')).toBe(1991);
  });
  it('parses a year-only date', () => {
    expect(extractYear('1980')).toBe(1980);
  });
  it('parses a year-month date', () => {
    expect(extractYear('1975-06')).toBe(1975);
  });
  it('returns null for undefined/empty/garbage', () => {
    expect(extractYear(undefined)).toBeNull();
    expect(extractYear('')).toBeNull();
    expect(extractYear('not-a-date')).toBeNull();
  });
});

describe('normalizeTrack', () => {
  it('maps a valid track', () => {
    expect(normalizeTrack(rawTrack())).toEqual({
      id: 't1',
      name: 'Song One',
      uri: 'spotify:track:t1',
      artists: [{ id: 'a1', name: 'Artist One' }],
      year: 1991,
      durationMs: 213000,
    });
  });

  it('drops local tracks', () => {
    expect(normalizeTrack(rawTrack({ is_local: true }))).toBeNull();
  });

  it('drops explicitly unplayable tracks', () => {
    expect(normalizeTrack(rawTrack({ is_playable: false }))).toBeNull();
  });

  it('treats missing is_playable as playable (Liked Songs omit it)', () => {
    expect(normalizeTrack(rawTrack({ is_playable: undefined }))).not.toBeNull();
  });

  it('drops tracks with no id', () => {
    expect(normalizeTrack(rawTrack({ id: null }))).toBeNull();
  });

  it('filters out artists without an id but keeps the credited ones', () => {
    const t = normalizeTrack(
      rawTrack({
        artists: [
          { id: null, name: 'No-ID Guest' },
          { id: 'a2', name: 'Real Artist' },
        ],
      }),
    );
    expect(t?.artists).toEqual([{ id: 'a2', name: 'Real Artist' }]);
  });

  it('drops tracks where no artist has an id (unusable as an answer)', () => {
    expect(normalizeTrack(rawTrack({ artists: [{ id: null, name: 'Unknown' }] }))).toBeNull();
  });

  it('sets year to null when the release date is unusable', () => {
    const t = normalizeTrack(rawTrack({ album: { release_date: '' } }));
    expect(t?.year).toBeNull();
  });
});

describe('buildPool', () => {
  it('filters null/local tracks and dedupes by id, keeping first occurrence', () => {
    const items: RawItem[] = [
      item(rawTrack({ id: 't1', name: 'First' })),
      item(null), // missing track (can happen in playlists)
      item(rawTrack({ id: 't2', name: 'Local', is_local: true })), // dropped
      item(rawTrack({ id: 't1', name: 'Dup of t1' })), // duplicate id -> dropped
      item(rawTrack({ id: 't3', name: 'Third' })),
    ];
    const pool = buildPool(items);
    expect(pool.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(pool[0].name).toBe('First'); // first occurrence wins
  });

  it('returns an empty array for empty input', () => {
    expect(buildPool([])).toEqual([]);
  });
});

describe('distinctArtists', () => {
  it('returns unique artists by id, sorted by name', () => {
    const pool = buildPool([
      item(rawTrack({ id: 't1', artists: [{ id: 'a2', name: 'Zebra' }, { id: 'a1', name: 'Alpha' }] })),
      item(rawTrack({ id: 't2', artists: [{ id: 'a1', name: 'Alpha' }] })), // repeat a1
      item(rawTrack({ id: 't3', artists: [{ id: 'a3', name: 'Mango' }] })),
    ]);
    expect(distinctArtists(pool)).toEqual([
      { id: 'a1', name: 'Alpha' },
      { id: 'a3', name: 'Mango' },
      { id: 'a2', name: 'Zebra' },
    ]);
  });
});

describe('filterArtists', () => {
  const artists: Artist[] = [
    { id: '1', name: 'Radiohead' },
    { id: '2', name: 'Rage Against the Machine' },
    { id: '3', name: 'The Strokes' },
    { id: '4', name: 'Daft Punk' },
  ];

  it('returns [] for an empty or whitespace query', () => {
    expect(filterArtists(artists, '')).toEqual([]);
    expect(filterArtists(artists, '   ')).toEqual([]);
  });

  it('matches case-insensitive substrings', () => {
    expect(filterArtists(artists, 'RADIO').map((a) => a.name)).toEqual(['Radiohead']);
    expect(filterArtists(artists, 'punk').map((a) => a.name)).toEqual(['Daft Punk']);
  });

  it('ranks prefix matches before mid-string matches', () => {
    // "The Strokes" starts with "the"; "Rage Against the Machine" only contains it.
    expect(filterArtists(artists, 'the').map((a) => a.name)).toEqual([
      'The Strokes',
      'Rage Against the Machine',
    ]);
  });

  it('respects the result limit', () => {
    expect(filterArtists(artists, 'a', 2)).toHaveLength(2);
  });

  it('is accent-insensitive (combining marks ignored)', () => {
    const list: Artist[] = [
      { id: '1', name: 'Beyoncé' },
      { id: '2', name: 'Sigur Rós' },
    ];
    expect(filterArtists(list, 'beyonce').map((a) => a.name)).toEqual(['Beyoncé']);
    expect(filterArtists(list, 'sigur ros').map((a) => a.name)).toEqual(['Sigur Rós']);
  });

  it('matches Hebrew, ignoring niqqud, and plain Hebrew substrings', () => {
    // מָשִׁינָה ("Mashina") written with niqqud marks; bare query should still match.
    const withNiqqud = 'מָשִׁינָה';
    const list: Artist[] = [
      { id: '1', name: withNiqqud },
      { id: '2', name: 'אביב גפן' },
    ];
    expect(filterArtists(list, 'משינה').map((a) => a.id)).toEqual(['1']);
    expect(filterArtists(list, 'גפן').map((a) => a.id)).toEqual(['2']);
  });
});

describe('filterTracks', () => {
  const mkTrack = (id: string, name: string): PoolTrack => ({
    id,
    name,
    uri: `spotify:track:${id}`,
    artists: [{ id: `a-${id}`, name: `Artist ${id}` }],
    year: 2000,
    durationMs: 1000,
  });
  const tracks = [
    mkTrack('t1', 'Bohemian Rhapsody'),
    mkTrack('t2', 'Dancing Queen'),
    mkTrack('t3', 'Africa'),
  ];

  it('returns [] for an empty query', () => {
    expect(filterTracks(tracks, '   ')).toEqual([]);
  });

  it('matches track names, diacritic-insensitive', () => {
    expect(filterTracks(tracks, 'queen').map((t) => t.id)).toEqual(['t2']);
    expect(filterTracks(tracks, 'AFRICA').map((t) => t.id)).toEqual(['t3']);
  });

  it('ranks prefix matches first', () => {
    expect(filterTracks(tracks, 'a').map((t) => t.id)[0]).toBe('t3');
  });
});

describe('seededShuffle', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('is deterministic for a given seed', () => {
    expect(seededShuffle(input, 42)).toEqual(seededShuffle(input, 42));
  });

  it('returns a permutation of the input (same multiset)', () => {
    const out = seededShuffle(input, 7);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input array', () => {
    const copy = [...input];
    seededShuffle(input, 7);
    expect(input).toEqual(copy);
  });

  it('actually reorders (different seed yields a different order here)', () => {
    expect(seededShuffle(input, 1)).not.toEqual(seededShuffle(input, 2));
  });
});
