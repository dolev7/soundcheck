# SoundCheck

An artist-first Spotify music guessing game. A short clip plays; you name the
**artist** (primary target), and optionally the exact **song** and **year** for
bonus points. Solo / async, fully client-side, Spotify **Premium** required.

See [DESIGN.md](./DESIGN.md) for the full game design, scoring, and build phases.

## Live

**https://dolev7.github.io/soundcheck/** — auto-deployed from `main` via GitHub
Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

Two prerequisites for login to work on the deployed site:

1. Add this redirect URI to the Spotify app
   ([dashboard](https://developer.spotify.com/dashboard)):
   `https://dolev7.github.io/soundcheck/callback`
2. The Spotify app is in **Development mode**, so only the owner and up to ~25
   manually-added users can log in. Opening it to everyone requires a Spotify
   extended-quota request. (Anyone can load the page; only allowlisted Spotify
   accounts can actually play.)

## Prerequisites

- Node 18+ (developed on Node 22)
- A Spotify account with **Premium** (the Web Playback SDK won't stream otherwise)

## 1. Create a Spotify app

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and click **Create app**.
2. Give it any name/description.
3. Under **Redirect URIs**, add this **exact** value:

   ```
   http://127.0.0.1:5173/callback
   ```

   > Spotify no longer accepts `localhost` for loopback redirects — it must be
   > the `127.0.0.1` IP. The dev server is configured to bind to that address.

4. For **APIs used**, select **Web API** and **Web Playback SDK**.
5. Save, then copy the **Client ID** from the app's settings.

## 2. Configure the project

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your Client ID:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
```

`.env.local` is gitignored. The Client ID is **not** a secret in a PKCE flow —
there is intentionally no client secret in this project.

## 3. Install & run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (use `127.0.0.1`, not `localhost`, so the origin
matches the redirect URI). Click **Connect Spotify**, approve the scopes, and
you should land on the player screen. Click **Play test track** — if you hear
Rick Astley, Phase 1 works.

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the Vite dev server (port 5173) |
| `npm run build`     | Type-check and build for production   |
| `npm run preview`   | Preview the production build          |
| `npm run typecheck` | Type-check only                       |

## Troubleshooting

- **"INVALID_CLIENT: Invalid redirect URI"** — the URI in the dashboard must
  match `http://127.0.0.1:5173/callback` character-for-character.
- **Stuck on "Booting Web Playback device…" / account error** — confirm the
  account is Premium and you're on a desktop browser (mobile browser support
  for the SDK is unreliable).
- **No sound on "Play test track"** — the SDK takes over your active Spotify
  device. If music was playing elsewhere, it moves here. Check the volume and
  that no other app grabbed playback back.
