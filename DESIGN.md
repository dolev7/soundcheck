# SoundCheck — Design Doc

An **artist-first** Spotify music guessing game. Solo / async, Premium-gated,
fully client-side (no mandatory backend).

> **Status:** Spec locked. Phases 1–4 + a 10-round game loop done (auth +
> Premium gate + SDK boot; playlist picker + track pool; artist-first round +
> song/year bonuses; N-round game with running score + results). Built
> test-first with Vitest + React Testing Library — `npm test`.

---

## 1. Concept

A short audio clip plays from a playlist the player picks. The player's job is
to **name the artist** as fast as possible — recognizing an artist from 2
seconds is achievable; naming the exact track is the expert move. The exact
**song** and the **year** are optional bonuses set before submitting.

Artist-first (vs song-first) is a deliberate accessibility choice: more people
can play, and the hard guesses still pay off.

---

## 2. Game flow

```
Connect Spotify (PKCE) → Premium check → pick playlist (default: Liked Songs)
   → load + shuffle track pool → ROUND → ROUND → … → results / personal best
```

### One round

Audio plays the current **tier**. Tiers escalate the amount of audio revealed:

| Tier | What plays                                  | Window   |
| ---- | ------------------------------------------- | -------- |
| 1    | intro from 0:00                             | 2 s      |
| 2    | intro from 0:00                             | 5 s      |
| 3    | intro from 0:00                             | 10 s     |
| 4    | "highlight" — `position_ms = 40% of track` | ~20 s    |

**Three independent objectives**, each guessed on its own:
- **Artist** — typeahead over the playlist's distinct artists; matched by
  **artist ID** (any credited artist in `track.artists[]` counts).
- **Song** — typeahead over the full pool, exact **track ID** match;
  **title-only** suggestions that need **≥3 typed letters**.
- **Year** — slider 1950 → 2026 (opt-in checkbox).

**A correct guess banks its points but does NOT end the round.** The player
keeps escalating clips and guessing the remaining objectives:
- **Lock in** → bank any currently-correct objectives at the **current tier**
  (a year guess locks in its tolerance points). Wrong guesses bank nothing.
- **More audio** → advance to the next, longer tier (its points drop for
  whatever you solve from then on).
- **Give up** → end the round now, keeping everything banked.
- The round ends automatically once **all three** are solved.

So you might nail the artist at 2s (50), need the full clip for the song (10),
and lock a close-but-not-exact year (15). Whatever you bank is yours.

---

## 3. Scoring (defaults — all tunable)

| Item                                  | Points (by tier guessed)        |
| ------------------------------------- | ------------------------------- |
| Artist @ 2s / 5s / 10s / highlight    | 50 / 40 / 30 / 20               |
| Song @ 2s / 5s / 10s / highlight      | 25 / 20 / 15 / 10               |
| Year (not tiered)                     | exact 25; linear to 0 at a 10-yr gap (±1→15, ±5→8, ±9→2); 0 beyond |

**Perfect round = 100** (artist 50 + song 25 + year 25, all at 2s / exact).
Artist and song are **tiered** — guessing earlier (less audio) pays more. Song
suggestions are **title-only** and need **≥3 letters**, so knowing the artist
doesn't trivialize it. Year rewards an exact hit with a clear jump over "close"
and fades to nothing past a decade off. All values are tunable constants in
`round.ts` (`ARTIST_TIER_POINTS`, `SONG_TIER_POINTS`, `YEAR_EXACT`, `YEAR_NEAR`,
`YEAR_WINDOW`). Streak multiplier is a possible later addition.

### Candidate pools
- **Artist typeahead** = distinct artists across the loaded playlist (smaller,
  easier list; exact ID match).
- **Song typeahead** = all tracks in the playlist (the bonus pool; exact track
  ID match).

---

## 4. Playback mechanics (Web Playback SDK)

The SDK registers a browser "device". We transfer playback to it, then
`PUT /me/player/play` with `{ uris: ["spotify:track:…"], position_ms }`.

**Tier timing:** `play()` → `setTimeout(N)` → `pause()`.
- Intro tiers: `position_ms: 0`, `N = 2000 / 5000 / 10000`.
- Highlight tier: `position_ms = floor(duration_ms * 0.40)`, `N ≈ 20000`.

**Precision caveat (important for round feel):** `setTimeout` is not
sample-accurate, and the first `play()` has ~200–500 ms startup latency. Measure
the clip window from the **first non-paused `player_state_changed` callback**,
not from the `play()` call — otherwise the early (2s) tiers feel inconsistent.

**Highlight = heuristic only.** There's no chorus-detection API anymore. 40%-in
is a decent default; a 3rd-party audio-analysis API could be swapped in later
for real choruses.

---

## 5. Architecture

Solo/async means **no mandatory backend**. Fully client-side is viable.

- **Frontend:** React + Vite SPA, TypeScript.
- **Auth:** Authorization Code + **PKCE** (no client secret in the browser).
  - Scopes: `streaming`, `user-read-private`, `user-read-email`,
    `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`,
    `user-modify-playback-state`, `user-read-playback-state`.
- **Premium gate:** `GET /me` → require `product === "premium"`, else show an
  upgrade prompt.
- **Pool build:** paginate `GET /me/tracks` (Liked Songs) or
  `GET /playlists/{id}/tracks`; filter null/local/unplayable tracks; dedupe by
  ID; shuffle. Typeahead candidates = the full loaded pool.
- **Leaderboard:** start with a `localStorage` personal best; add a thin
  serverless DB (e.g. Supabase) only when a shared async board is wanted.

### Module map (current)

```
src/
  config.ts            scopes, endpoints, client id, redirect uri, test track
  types.ts             SpotifyUser, TokenSet, …
  auth/
    pkce.ts            CSPRNG verifier/state + S256 challenge
    tokenStore.ts      load/save/clear token set (localStorage)
    auth.ts            beginLogin / completeLoginFromRedirect / refresh / getValidAccessToken
    useAuth.ts         React hook: status + user + login/signOut
  spotify/
    api.ts             authed fetch wrapper (+ 401 refresh-and-retry)
    profile.ts         getMe / isPremium
    playback.ts        SDK loader, createPlayer, transferPlayback, playTrack, startClip
    library.ts         paginated fetchLikedTracks / fetchPlaylistTracks / fetchPlaylists  (+ .test)
    usePlayer.ts       boots one SDK device for the session (hook)
  game/
    pool.ts            pure: normalizeTrack, buildPool, distinctArtists, filterArtists/filterTracks, seededShuffle  (+ .test)
    round.ts           pure: per-objective tiered scoring, submitGuess/advanceTier/endRound, yearBonus, tierClip  (+ .test)
    game.ts            pure: ROUNDS_PER_GAME, startGame, advanceGame (session totals)  (+ .test)
  components/
    Login.tsx          connect button / setup warning
    PremiumGate.tsx    upgrade prompt for non-Premium accounts
    PlaylistPicker.tsx pick source → load + shuffle pool → distinct artists  (+ .test)
    ArtistTypeahead.tsx autocomplete over the pool's artists  (+ .test)
    SongTypeahead.tsx  autocomplete over the pool's tracks (song bonus)  (+ .test)
    Round.tsx          one track: tier reveal → artist guess (+ song/year bonus) → reveal + score  (+ .test)
    GameSession.tsx    10-round loop: running total + results screen  (+ .test)
    RoundFlow.tsx      ensures the device is ready, then runs the game
    Game.tsx           Premium shell: header + pick → play routing
  App.tsx              status-driven routing between the above
  test/setup.ts        jest-dom matchers for Vitest
```

---

## 6. Security notes

- **PKCE, no secret.** The Client ID is public; there is no client secret in the
  bundle. The flow uses an S256 code challenge and a CSPRNG `state` value that
  is verified on the callback (anti-CSRF). All security-relevant randomness
  comes from Web Crypto, never `Math.random`.
- **Transient values** (`code_verifier`, `state`) live in `sessionStorage` and
  are deleted as soon as the exchange completes; they are single-use.
- **Token storage trade-off.** With no backend, the access + refresh tokens are
  persisted in `localStorage`, which is readable by any same-origin script — so
  an XSS bug would expose them. This is the standard limitation of the
  pure-client PKCE model. Mitigations in place: no third-party `<script>` tags
  except the Spotify SDK, short token lifetimes via refresh, and a minimal OAuth
  scope set.
- **Fail closed.** State mismatch, missing verifier, and failed refresh all
  clear state and force a clean re-login rather than proceeding.

### Hardening path (optional, later)

If token exposure becomes a concern, add a thin backend that performs the token
exchange/refresh and stores the refresh token in an **HttpOnly, Secure,
SameSite** cookie. The SPA then never touches the refresh token. This also
enables a shared leaderboard without a separate DB auth story.

---

## 7. Build phases

1. **Auth + Premium + SDK boot** — connect, gate, get a device playing a
   hardcoded track. *(Riskiest piece — prove it first.)* ✅ **done**
2. **Playlist pick + pool** — Liked Songs default, dropdown of playlists,
   filtered/shuffled pool. ✅ **done**
3. **One round, artist-only** — tier reveals, artist typeahead match, base
   scoring. ✅ **done**
4. **Bonus layer** — song typeahead + year slider + tolerance scoring. ✅ **done**
5. **Game loop + results** — N rounds, totals, `localStorage` best. 🟡 10-round
   loop + running total + results screen **done**; `localStorage` best still TODO.
6. **Polish** — highlight tier, streaks, share card; later: leaderboard, party
   mode.

---

## 8. Known caveats

- **The SDK commandeers the active playback device.** Fine mid-game, surprising
  if the user had music going elsewhere. In practice, when the Spotify **desktop
  app** is open and active it can keep the audio output even though playback
  shows on "SoundCheck Player" — selecting the SoundCheck Player / "This computer"
  device once routes audio to the browser. Every in-game play call targets our
  device id explicitly, so it stays put for the rest of the session.
- **Desktop-web oriented.** Mobile browser support for the Web Playback SDK is
  unreliable — plan for desktop first.
- **Premium only.** Non-Premium users are gated out at `/me`.
- **Highlight is a heuristic**, not a real chorus detector (see §4).
- **Silent / long intros.** Clips start at 0:00 and some tracks open with silence
  or a long ambient intro. We can't detect this — the SDK stream is DRM-protected
  (no client-side waveform analysis) and Spotify's audio-analysis API is no longer
  available to dev/new apps. Mitigation: each round offers a **"Different song"**
  re-roll that swaps the track without scoring it or advancing the round counter.
- **Region-locked tracks.** The pool is fetched with `market=from_token`, so
  Spotify drops tracks unavailable in the user's country (and relinks where it
  can). Any that still fail at play time (SDK `playback_error` or no playback
  within ~6s) surface an error and **auto-skip** to another track — no score
  penalty, and it doesn't consume the per-round re-roll.

---

## 9. Sources / context

- Spotify Web API changes (Nov 27 2024) — preview_url deprecation, audio-analysis
  access changes.
- Web Playback SDK docs.
- Loopback redirect URI policy (must use `127.0.0.1`, not `localhost`).
