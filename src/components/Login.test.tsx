import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Login } from './Login';
import { ARTIST_TIER_POINTS } from '../game/round';
import { ROUNDS_PER_GAME } from '../game/game';

describe('Login', () => {
  it('explains the rules and shows the scoring values from the game constants', () => {
    render(<Login onLogin={vi.fn()} />);

    expect(screen.getByText(/how to play/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${ROUNDS_PER_GAME} rounds`))).toBeInTheDocument();
    // Top-tier artist points come straight from the constant (kept in sync).
    expect(screen.getAllByText(String(ARTIST_TIER_POINTS[0])).length).toBeGreaterThan(0);
  });
});
