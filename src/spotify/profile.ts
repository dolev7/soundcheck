import type { SpotifyUser } from '../types';
import { spotifyFetch } from './api';

export async function getMe(): Promise<SpotifyUser> {
  const res = await spotifyFetch('/me');
  // A 403 here almost always means the app is in Spotify Development mode and
  // this account isn't on the allowlist — give a message that explains the fix.
  if (res.status === 403) {
    throw new Error(
      "This Spotify account isn't allowed yet. SoundCheck is in Spotify Development mode, " +
        'so the owner has to add your account to the app, or switch it to public access. ' +
        'Ask whoever shared the link to add you.',
    );
  }
  if (!res.ok) {
    throw new Error(`Spotify API GET /me failed: ${res.status}`);
  }
  return (await res.json()) as SpotifyUser;
}

/** The Web Playback SDK requires a Premium subscription. */
export function isPremium(user: SpotifyUser): boolean {
  return user.product === 'premium';
}
