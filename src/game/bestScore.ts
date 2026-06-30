// Personal best, persisted in localStorage. (No backend — solo/async, per the
// design.) Survives reloads; cleared only if the user clears site data.
const KEY = 'soundcheck.best';

export function loadBestScore(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Save `score` if it beats the stored best. Returns the best + whether it's new. */
export function recordScore(score: number): { best: number; isNewBest: boolean } {
  const prev = loadBestScore();
  if (score > prev) {
    localStorage.setItem(KEY, String(score));
    return { best: score, isNewBest: true };
  }
  return { best: prev, isNewBest: false };
}
