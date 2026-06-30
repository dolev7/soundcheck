// Central config. The Client ID is a *public* identifier in a PKCE flow — it is
// safe in the browser bundle. There is deliberately no client secret anywhere.

export const CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

// Defaults to "<current origin><base path>callback" so it works both locally
// (http://127.0.0.1:5173/callback) and on GitHub Pages
// (https://<user>.github.io/<repo>/callback) with no per-env config. Override
// via VITE_SPOTIFY_REDIRECT_URI if needed.
export const REDIRECT_URI: string =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ??
  `${window.location.origin}${import.meta.env.BASE_URL}callback`;

// Scopes required across the whole game (declared up front so the user grants
// once). Phase 1 only needs streaming + the profile/playback scopes, but
// requesting the full set now avoids a second consent screen later.
export const SCOPES: string = [
  'streaming',
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ');

export const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const API_BASE = 'https://api.spotify.com/v1';

// A well-known public track used only for the Phase 1 playback smoke test.
// (Rick Astley — Never Gonna Give You Up. A fitting first track for a music game.)
export const TEST_TRACK_URI = 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';
