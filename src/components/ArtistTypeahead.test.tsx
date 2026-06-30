import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtistTypeahead } from './ArtistTypeahead';
import type { Artist } from '../game/pool';

const artists: Artist[] = [
  { id: '1', name: 'Radiohead' },
  { id: '2', name: 'Daft Punk' },
  { id: '3', name: 'The Strokes' },
];

describe('ArtistTypeahead', () => {
  it('filters options as you type and fires onSelect on click', async () => {
    const onSelect = vi.fn();
    render(<ArtistTypeahead artists={artists} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole('textbox'), 'rad');
    await userEvent.click(await screen.findByRole('button', { name: 'Radiohead' }));

    expect(onSelect).toHaveBeenCalledWith({ id: '1', name: 'Radiohead' });
  });

  it('shows no options for an empty query', () => {
    render(<ArtistTypeahead artists={artists} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('selects the top match as you type — no click needed', async () => {
    const onSelect = vi.fn();
    render(<ArtistTypeahead artists={artists} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('textbox'), 'rad');
    expect(onSelect).toHaveBeenLastCalledWith({ id: '1', name: 'Radiohead' });
  });

  it('fills the input with the choice and collapses the list', async () => {
    render(<ArtistTypeahead artists={artists} onSelect={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox'), 'daft');
    await userEvent.click(await screen.findByRole('button', { name: 'Daft Punk' }));

    expect(screen.getByRole('textbox')).toHaveValue('Daft Punk');
    expect(screen.queryByRole('button', { name: 'Daft Punk' })).toBeNull();
  });

  it('clears the selection when the query is edited again', async () => {
    const onSelect = vi.fn();
    render(<ArtistTypeahead artists={artists} onSelect={onSelect} />);

    await userEvent.type(screen.getByRole('textbox'), 'daft');
    await userEvent.click(await screen.findByRole('button', { name: 'Daft Punk' }));
    onSelect.mockClear();

    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
