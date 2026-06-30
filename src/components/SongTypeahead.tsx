import { useState } from 'react';
import { filterTracks, type PoolTrack } from '../game/pool';

// Require a few letters before suggesting — no one-letter browsing of the pool.
const MIN_CHARS = 3;

interface SongTypeaheadProps {
  tracks: PoolTrack[];
  onSelect: (track: PoolTrack | null) => void;
  disabled?: boolean;
}

/**
 * Optional bonus input: autocomplete over the full track pool, matched on title
 * and selected by exact track. onSelect(null) means "no song guess yet".
 */
export function SongTypeahead({ tracks, onSelect, disabled }: SongTypeaheadProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = query.trim().length >= MIN_CHARS ? filterTracks(tracks, query) : [];

  function choose(track: PoolTrack) {
    setQuery(track.name);
    setOpen(false);
    onSelect(track);
  }

  return (
    <div className="typeahead">
      <input
        type="text"
        dir="auto"
        className="typeahead-input"
        aria-label="Guess the song"
        placeholder="Bonus: name the exact song…"
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          setOpen(true);
          // Track the top match (once past the min length) so "Lock in" works
          // without an explicit click; clicking an option still overrides it.
          onSelect(q.trim().length >= MIN_CHARS ? (filterTracks(tracks, q)[0] ?? null) : null);
        }}
      />

      {open && matches.length > 0 && (
        <ul className="typeahead-list">
          {matches.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                className="typeahead-option"
                dir="auto"
                onClick={() => choose(track)}
              >
                {/* Title only — no artist label, so knowing the artist doesn't
                    hand you their catalogue to scan. */}
                {track.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
