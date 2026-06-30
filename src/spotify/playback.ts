import { getValidAccessToken } from '../auth/auth';
import { spotifyFetch } from './api';
import type { TierClip } from '../game/round';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

let sdkPromise: Promise<void> | null = null;

/** Inject the Web Playback SDK <script> once and resolve when it's ready. */
export function loadPlaybackSDK(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    // The SDK calls this global hook once it has finished loading.
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export interface PlayerHandle {
  player: Spotify.Player;
  deviceId: string;
}

/**
 * Create + connect a Web Playback SDK player and resolve once it reports a
 * device id via the "ready" event. The getOAuthToken callback hands the SDK a
 * fresh token whenever it needs one (including on its own internal refreshes).
 */
// If the SDK reports neither "ready" nor an error within this window, the boot
// has silently stalled (almost always an EME/Widevine/DRM issue in the
// browser). We reject with guidance rather than hang forever.
const READY_TIMEOUT_MS = 15_000;

export async function createPlayer(name = 'SoundCheck'): Promise<PlayerHandle> {
  await loadPlaybackSDK();

  const player = new Spotify.Player({
    name,
    getOAuthToken: (cb) => {
      getValidAccessToken()
        .then(cb)
        .catch((err) => console.error('[SoundCheck] Failed to provide OAuth token to SDK', err));
    },
    volume: 0.7,
  });

  // Non-fatal diagnostics — surfaced in the console to explain a stuck boot.
  player.addListener('not_ready', ({ device_id }) =>
    console.warn('[SoundCheck] device went offline:', device_id),
  );
  player.addListener('autoplay_failed', () =>
    console.warn('[SoundCheck] autoplay blocked by the browser — a click is required first'),
  );

  const deviceId = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          'Timed out after 15s waiting for the Spotify player to become ready. ' +
            'The browser likely could not initialize protected playback (EME/Widevine/DRM). ' +
            'Chrome and Edge are the most reliable; Firefox, Brave, Arc, and DRM-blocking ' +
            'extensions (or "block third-party content") commonly prevent it.',
        ),
      );
    }, READY_TIMEOUT_MS);
    const settle = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };

    player.addListener('ready', ({ device_id }) => settle(() => resolve(device_id)));
    player.addListener('initialization_error', ({ message }) =>
      settle(() => reject(new Error(`SDK initialization error: ${message}`))),
    );
    player.addListener('authentication_error', ({ message }) =>
      settle(() => reject(new Error(`SDK authentication error: ${message}`))),
    );
    player.addListener('account_error', ({ message }) =>
      settle(() => reject(new Error(`SDK account error (Premium required): ${message}`))),
    );

    player.connect().then((ok) => {
      if (!ok) settle(() => reject(new Error('player.connect() returned false')));
    });
  });

  // Make our freshly-connected device the ACTIVE playback target. Without this,
  // the very first `play?device_id=…` can hit a device Spotify doesn't consider
  // active yet and nothing plays on the first click; transferring (silently,
  // play=false) activates it so the first play lands.
  await transferPlayback(deviceId, false).catch((err) =>
    console.warn('[SoundCheck] initial device transfer failed', err),
  );

  return { player, deviceId };
}

/**
 * Move active playback onto our SDK device. Without this the play call can
 * target whatever device the user last used. NOTE: this commandeers the user's
 * active Spotify playback — expected mid-game, surprising if they had music
 * playing elsewhere.
 */
export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  const res = await spotifyFetch('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
  // 202/204 are the success codes here; 404 ("no active device") is tolerable
  // because we immediately follow with a device-targeted play call.
  if (!res.ok && res.status !== 404) {
    throw new Error(`transferPlayback failed: ${res.status}`);
  }
}

/** Start a single track on our device at an optional offset. */
export async function playTrack(
  deviceId: string,
  uri: string,
  positionMs = 0,
): Promise<void> {
  const res = await spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`playTrack failed: ${res.status}`);
  }
}

export interface ClipCallbacks {
  /** Fired when audio actually begins (first non-paused state) — start the clock. */
  onStart?: () => void;
  /** Fired when the clip reaches its end and is paused naturally. */
  onEnd?: () => void;
}

/**
 * Play a clip: start at clip.positionMs, then pause after clip.durationMs.
 * Crucially, the pause is timed from the FIRST non-paused player_state_changed
 * event, not from the play() call — play() has ~200–500ms startup latency, so
 * timing from the call makes the short early tiers (2s) feel inconsistent.
 * `onStart`/`onEnd` mark that same real window so the UI countdown lines up.
 * Returns a cancel function that stops the clip and detaches its listener/timer.
 */
export function startClip(
  player: Spotify.Player,
  deviceId: string,
  uri: string,
  clip: TierClip,
  callbacks?: ClipCallbacks,
): () => void {
  // Mobile browsers block audio until it's activated inside a user gesture.
  // startClip runs synchronously inside the Play-button click, so unlock it here
  // (no-op on SDK builds without the method / on desktop where it isn't needed).
  void (player as unknown as { activateElement?: () => Promise<unknown> })
    .activateElement?.()
    ?.catch(() => {});

  let cancelled = false;
  let armed = false;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const onState = (state: Spotify.PlaybackState | null) => {
    if (cancelled || armed || !state || state.paused) return;
    armed = true; // first confirmed playback — start the clock now
    callbacks?.onStart?.();
    pauseTimer = setTimeout(() => {
      player.pause().catch(() => {});
      player.removeListener('player_state_changed', onState);
      callbacks?.onEnd?.();
    }, clip.durationMs);
  };

  player.addListener('player_state_changed', onState);
  playTrack(deviceId, uri, clip.positionMs).catch((err) =>
    console.error('[SoundCheck] clip playback failed', err),
  );

  return () => {
    cancelled = true;
    if (pauseTimer) clearTimeout(pauseTimer);
    player.removeListener('player_state_changed', onState);
    player.pause().catch(() => {});
  };
}
