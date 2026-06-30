import { useEffect, useRef, useState } from 'react';
import type { Artist, PoolTrack } from '../game/pool';
import {
  startRound,
  submitGuess,
  advanceTier,
  endRound,
  tierClip,
  TIER_LABELS,
  ARTIST_TIER_POINTS,
  type RoundState,
} from '../game/round';
import { startClip } from '../spotify/playback';
import { ArtistTypeahead } from './ArtistTypeahead';
import { SongTypeahead } from './SongTypeahead';

const LAST_TIER = ARTIST_TIER_POINTS.length - 1;

interface RoundProps {
  track: PoolTrack;
  /** Full pool, for the song typeahead. */
  tracks?: PoolTrack[];
  artists: Artist[];
  player: Spotify.Player;
  deviceId: string;
  /** Called with the round's banked score when the player moves on. */
  onComplete: (score: number) => void;
  /** Swap in a different track for this same round (e.g. a silent/dud song). */
  onReroll?: () => void;
  /** Whether a re-roll is still allowed this round (limited per round). */
  canReroll?: boolean;
}

/**
 * One round. Artist, song, and year are independent objectives: a correct guess
 * banks its (tiered) points but doesn't end the round — the player escalates
 * clips with "More audio" and keeps guessing the rest until all three are in or
 * they Give up. The reveal then reports the banked total via onComplete.
 */
export function Round({
  track,
  tracks = [],
  artists,
  player,
  deviceId,
  onComplete,
  onReroll,
  canReroll = true,
}: RoundProps) {
  const [round, setRound] = useState<RoundState>(() => startRound(track));
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedSong, setSelectedSong] = useState<PoolTrack | null>(null);
  const [yearEnabled, setYearEnabled] = useState(false);
  const [year, setYear] = useState(2000);
  const [remaining, setRemaining] = useState<number | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function stopAudio() {
    cancelRef.current?.();
    cancelRef.current = null;
    clearTick();
    setRemaining(null);
  }

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      clearTick();
    };
  }, []);

  function playClip() {
    stopAudio();
    const clip = tierClip(round.tier, round.track.durationMs);
    const seconds = Math.round(clip.durationMs / 1000);
    cancelRef.current = startClip(player, deviceId, round.track.uri, clip, {
      onStart: () => {
        setRemaining(seconds);
        clearTick();
        tickRef.current = setInterval(() => {
          setRemaining((r) => (r != null && r > 1 ? r - 1 : 0));
        }, 1000);
      },
      onEnd: () => {
        clearTick();
        setRemaining(null);
      },
    });
  }

  function handleSubmit() {
    setRound((r) =>
      submitGuess(r, {
        artistId: selectedArtist?.id,
        trackId: selectedSong?.id,
        year: yearEnabled ? year : null,
      }),
    );
  }

  function handleMoreAudio() {
    stopAudio();
    setRound(advanceTier);
  }

  function handleGiveUp() {
    stopAudio();
    setRound(endRound);
  }

  const { artistSolved, songSolved, yearSolved } = round;
  const credits = round.track.artists.map((a) => a.name).join(', ');

  if (round.status === 'done') {
    return (
      <div className="reveal">
        <h2>{artistSolved && songSolved && yearSolved ? 'Full round! 🎉' : 'Round over'}</h2>
        <div className="score">{round.score} pts</div>
        <ul className="breakdown">
          <li dir="auto">
            {artistSolved ? '✅' : '❌'} Artist — {credits}
            <span className="pts"> +{round.artistPoints ?? 0}</span>
          </li>
          <li dir="auto">
            {songSolved ? '✅' : '❌'} Song — {round.track.name}
            <span className="pts"> +{round.songPoints ?? 0}</span>
          </li>
          <li>
            {yearSolved ? `✅ Year — you guessed ${round.yearGuess}` : '❌ Year — no guess'}
            {round.track.year != null ? ` (actual ${round.track.year})` : ''}
            <span className="pts"> +{round.yearPoints ?? 0}</span>
          </li>
        </ul>
        <div className="row">
          <button className="primary" onClick={() => onComplete(round.score)}>
            Next
          </button>
        </div>
      </div>
    );
  }

  const canSubmit =
    (!artistSolved && !!selectedArtist) ||
    (!songSolved && !!selectedSong) ||
    (!yearSolved && yearEnabled);

  return (
    <div className="round">
      <div className="tier">
        Clip {round.tier + 1}/{ARTIST_TIER_POINTS.length} · {TIER_LABELS[round.tier]} ·{' '}
        {round.score} pts so far
      </div>

      <div className="row play-row">
        <button className="play-btn" onClick={playClip} aria-label="Play clip">
          ▶
        </button>
        {remaining != null && (
          <span className="countdown" data-testid="countdown">
            {remaining}s
          </span>
        )}
      </div>

      <div className="objectives">
        {artistSolved ? (
          <div className="solved" dir="auto">
            ✅ Artist — {credits} <span className="pts">+{round.artistPoints ?? 0}</span>
          </div>
        ) : (
          <ArtistTypeahead artists={artists} onSelect={setSelectedArtist} />
        )}

        {songSolved ? (
          <div className="solved" dir="auto">
            ✅ Song — {round.track.name} <span className="pts">+{round.songPoints ?? 0}</span>
          </div>
        ) : (
          <SongTypeahead tracks={tracks} onSelect={setSelectedSong} />
        )}

        {yearSolved ? (
          <div className="solved">
            ✅ Year — {round.yearGuess} <span className="pts">+{round.yearPoints ?? 0}</span>
          </div>
        ) : (
          <div className="year-block">
            <label className="year-toggle">
              <input
                type="checkbox"
                checked={yearEnabled}
                onChange={(e) => setYearEnabled(e.target.checked)}
              />
              Guess the year
            </label>
            {yearEnabled && (
              <div className="year-row">
                <input
                  type="range"
                  min="1950"
                  max="2026"
                  value={year}
                  aria-label="Year"
                  onChange={(e) => setYear(Number(e.target.value))}
                />
                <span className="year-value">{year}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row">
        <button className="primary" disabled={!canSubmit} onClick={handleSubmit}>
          Lock in
        </button>
        {round.tier < LAST_TIER && (
          <button className="ghost" onClick={handleMoreAudio}>
            More audio
          </button>
        )}
        <button className="ghost" onClick={handleGiveUp}>
          Give up
        </button>
      </div>

      {onReroll && canReroll && (
        <button className="reroll" onClick={onReroll}>
          ↻ Different song (silent/dud — doesn't count, once per round)
        </button>
      )}
    </div>
  );
}
