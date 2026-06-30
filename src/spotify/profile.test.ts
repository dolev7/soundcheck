import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({ spotifyFetch: vi.fn() }));
import { spotifyFetch } from './api';
import { getMe, isPremium } from './profile';

const mockFetch = vi.mocked(spotifyFetch);

beforeEach(() => mockFetch.mockReset());

describe('getMe', () => {
  it('explains the Development-mode allowlist on a 403 instead of a raw error', async () => {
    mockFetch.mockResolvedValue({ status: 403, ok: false } as Response);
    await expect(getMe()).rejects.toThrow(/development mode/i);
  });

  it('still reports other failures with the status code', async () => {
    mockFetch.mockResolvedValue({ status: 500, ok: false } as Response);
    await expect(getMe()).rejects.toThrow(/500/);
  });

  it('returns the profile on success', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ id: 'u1', display_name: 'Me', product: 'premium' }),
    } as unknown as Response);
    const me = await getMe();
    expect(me.product).toBe('premium');
    expect(isPremium(me)).toBe(true);
  });
});
