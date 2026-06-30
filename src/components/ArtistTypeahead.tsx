import { useState } from 'react';
import { filterArtists, type Artist } from '../game/pool';

interface ArtistTypeaheadProps {
  artists: Artist[];
  onSelect: (artist: Artist | null) => void;
  disabled?: boolean;
}

/**
 * Autocomplete over the playlist's distinct artists. Typing filters the list
 * and clears any current selection; clicking an option selects it (and fires
 * onSelect with the Artist). onSelect(null) means "no valid selection yet".
 */
export function ArtistTypeahead({ artists, onSelect, disabled }: ArtistTypeaheadProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = filterArtists(artists, query);

  function choose(artist: Artist) {
    setQuery(artist.name);
    setOpen(false);
    onSelect(artist);
  }

  return (
    <div className="typeahead">
      <input
        type="text"
        dir="auto"
        className="typeahead-input"
        aria-label="Guess the artist"
        placeholder="Type an artist…"
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          setOpen(true);
          // Track the top match as you type, so "Lock in" works without an
          // explicit click; clicking an option still overrides the pick.
          onSelect(filterArtists(artists, q)[0] ?? null);
        }}
      />

      {open && matches.length > 0 && (
        <ul className="typeahead-list">
          {matches.map((artist) => (
            <li key={artist.id}>
              <button
                type="button"
                className="typeahead-option"
                dir="auto"
                onClick={() => choose(artist)}
              >
                {artist.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
