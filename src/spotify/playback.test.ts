import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({ spotifyFetch: vi.fn() }));
import { spotifyFetch } from './api';
import { playTrack } from './playback';

const mockFetch = vi.mocked(spotifyFetch);
const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

beforeEach(() => mockFetch.mockReset());

describe('playTrack', () => {
  it('plays directly when the device is active', async () => {
    mockFetch.mockResolvedValue(res(204));
    await playTrack('dev', 'spotify:track:x', 0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-activates the device and retries once on a 404', async () => {
    mockFetch
      .mockResolvedValueOnce(res(404)) // play → "device not found"
      .mockResolvedValueOnce(res(204)) // transferPlayback re-activates it
      .mockResolvedValueOnce(res(204)); // play retry succeeds
    await playTrack('dev', 'spotify:track:x', 0);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws if it still fails after the retry', async () => {
    mockFetch
      .mockResolvedValueOnce(res(404))
      .mockResolvedValueOnce(res(204))
      .mockResolvedValueOnce(res(404));
    await expect(playTrack('dev', 'spotify:track:x', 0)).rejects.toThrow(/404/);
  });
});
