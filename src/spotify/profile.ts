import type { SpotifyUser } from '../types';
import { spotifyGet } from './api';

export function getMe(): Promise<SpotifyUser> {
  return spotifyGet<SpotifyUser>('/me');
}

/** The Web Playback SDK requires a Premium subscription. */
export function isPremium(user: SpotifyUser): boolean {
  return user.product === 'premium';
}
