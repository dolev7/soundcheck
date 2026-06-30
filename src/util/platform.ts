/** Heuristic mobile-browser check from a user-agent string (pure, testable). */
export function isMobileUserAgent(ua: string): boolean {
  return /android|iphone|ipad|ipod|mobile|blackberry|windows phone/i.test(ua);
}

/**
 * True on mobile browsers, where Spotify's Web Playback SDK can't create a
 * playback device (it's desktop-web only). Used to warn before the user wastes
 * a login on a player that can't play.
 */
export function isMobileBrowser(): boolean {
  return typeof navigator !== 'undefined' && isMobileUserAgent(navigator.userAgent);
}
