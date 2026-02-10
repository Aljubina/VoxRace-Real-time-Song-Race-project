import { useEffect, useMemo, useState, useRef } from 'react';
import { toast } from 'react-toastify'; // already imported in App.jsx, so reuse it

// Assume socket is passed as prop from App.jsx (or import it globally if you prefer)
export default function Game({
  round,
  totalRounds,
  secondsLeft: initialSecondsLeft,
  leaderboard,
  onBackToLobby,
  onSubmitAnswer,
  roomCode,
  socket,
  initialRoundPayload, // when switching to game from lobby on new-round (non-host)
}) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(initialSecondsLeft);
  const [songNumber, setSongNumber] = useState(1);
  const [songsPerRound, setSongsPerRound] = useState(5);
  const [betweenSongs, setBetweenSongs] = useState(false);
  const [betweenCountdown, setBetweenCountdown] = useState(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState(null);
  const audioRef = useRef(null);
  const audioPlayTimeoutRef = useRef(null);

  // Progress bar calculation (keep as-is, but use currentSeconds)
  const progress = useMemo(() => {
    const total = 15; // or pass timePerSong as prop later
    const clamped = Math.min(total, Math.max(0, total - currentSeconds));
    return Math.round((clamped / total) * 100);
  }, [currentSeconds]);

  // Sync audio + timer from new-round (same logic for socket or initial payload)
  const stopAndCleanupAudio = (why) => {
    // Cancel any scheduled (delayed) play from a previous round
    if (audioPlayTimeoutRef.current) {
      clearTimeout(audioPlayTimeoutRef.current);
      audioPlayTimeoutRef.current = null;
    }

    const prev = audioRef.current;
    if (!prev) return;

    try {
      prev.pause();
      prev.currentTime = 0;
      prev.src = '';
      // Ensure browser releases / resets the media element
      if (typeof prev.load === 'function') prev.load();
    } catch (e) {
      // Best-effort cleanup; don't crash the game UI
      console.warn('Audio cleanup failed:', e);
    } finally {
      audioRef.current = null;
      // Optional debugging
      console.log(`[audio] stopped (${why})`);
    }
  };

  const applyNewRound = ({ audioUrl, startTime, timer: initialTimer, songNumber: sNum, songsPerRound: sCount }) => {
    // Reset per-song visual state
    setBetweenSongs(false);
    setBetweenCountdown(null);
    setLastCorrectAnswer(null);
    setCurrentSeconds(initialTimer ?? 15);
    if (typeof sNum === 'number') setSongNumber(sNum);
    if (typeof sCount === 'number') setSongsPerRound(sCount);
    setAnswer('');
    setFeedback(null);

    // Stop/dispose any previous audio before starting a new one
    stopAndCleanupAudio('new-round');

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    const now = Date.now();
    const delay = (startTime != null ? startTime - now : 0);

    audioPlayTimeoutRef.current = setTimeout(() => {
      // If something stopped/changed since scheduling, don't start stale audio.
      if (audioRef.current !== audio) return;

      console.log('[audio] starting');
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(err => {
          console.error('Audio play failed:', err);
          toast.error('Failed to play audio. Check your connection.');
        });
      }
    }, delay > 0 ? delay : 0);
  };

  // When we mount with initialRoundPayload (e.g. non-host just switched to game on new-round)
  useEffect(() => {
    if (!initialRoundPayload) return;
    applyNewRound(initialRoundPayload);
  }, [initialRoundPayload]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('new-round', (payload) => {
      applyNewRound(payload);
    });

    // When someone submits an answer (including you)
    socket.on('round-result', ({ playerId, isCorrect, points, playerName }) => {
      if (isCorrect) {
        setFeedback('correct');
        toast.success(`${playerName || 'Someone'} got it! +${points} points`);
      } else if (playerId === socket.id) {
        setFeedback('wrong');
        toast.error('Wrong answer — keep trying!');
      }
      setFlashKey(k => k + 1);
    });

    // When a song ends (time up or correct answer)
    socket.on('round-end', ({ correctAnswer, reason }) => {
      setLastCorrectAnswer(correctAnswer || 'Unknown');
      setBetweenSongs(true);
      setCurrentSeconds(0);

      if (reason === 'correct') {
        toast.info(`Correct answer: ${correctAnswer}`);
      } else {
        toast.info(`Time's up! Correct answer: ${correctAnswer}`);
      }

      // Stop/dispose audio at end of song (prevents overlap into next round)
      stopAndCleanupAudio('round-end');
    });

    // 3-second countdown between songs
    socket.on('countdown', ({ secondsLeft, phase }) => {
      if (phase === 'between-songs') {
        setBetweenSongs(true);
        setBetweenCountdown(secondsLeft);
      }
    });

    // If your backend emits it, ensure audio is fully stopped on game end.
    socket.on('game-over', () => {
      stopAndCleanupAudio('game-over');
    });

    // Cleanup
    return () => {
      socket.off('new-round');
      socket.off('round-result');
      socket.off('round-end');
      socket.off('countdown');
      socket.off('game-over');
      stopAndCleanupAudio('unmount');
    };
  }, [socket]);

  // Client-side timer countdown (as fallback / visual sync)
  useEffect(() => {
    if (currentSeconds <= 0) return;

    const interval = setInterval(() => {
      setCurrentSeconds(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSeconds]);

  function submit(e) {
    e.preventDefault();
    const trimmed = answer.trim();

    if (!trimmed) {
      setFeedback('bad');
      setFlashKey(k => k + 1);
      return;
    }

    // Send real answer to server
    socket.emit('submit-answer', {
      roomCode,
      answer: trimmed,
    });

    // Local optimistic feedback (will be overridden by server response)
    setFeedback('good');
    setAnswer('');
    onSubmitAnswer?.(trimmed);
  }

  return (
    <section className="grid2">
      <div className="panel">
        <div className="panelBody">
          <div className="gameTop">
            <div className="roundTag">
              Round <strong style={{ color: 'rgba(255,255,255,0.92)' }}>{round}</strong> / {totalRounds}
              {' '}•{' '}
              Song <strong style={{ color: 'rgba(255,255,255,0.92)' }}>{songNumber}</strong> / {songsPerRound}
            </div>
            <button className="btn btnSmall btnGhost" onClick={onBackToLobby} type="button">
              Back to Lobby
            </button>
          </div>

          <div className="timer" aria-label="Countdown timer">
            <div className="timerNum">
              {betweenSongs && betweenCountdown != null ? betweenCountdown : currentSeconds}
            </div>
          </div>

          {betweenSongs && (
            <div className="betweenSongs" aria-live="polite">
              {lastCorrectAnswer && (
                <div className="betweenAnswer">
                  Correct answer:{' '}
                  <strong style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {lastCorrectAnswer}
                  </strong>
                </div>
              )}
              <div className="betweenNext">
                Next song in {betweenCountdown != null ? betweenCountdown : 0}…
              </div>
            </div>
          )}

          <div className="audioBox" aria-label="Audio player">
            <div className="audioMeta">
              <div>
                <div className="audioTitle">Now playing</div>
                <div className="audioHint">Guess the song title (and artist if you can)</div>
              </div>
              <div className="hint">Audio playing...</div>
            </div>
            <div className="progressTrack" aria-label="Audio progress">
              <div className="progressFill" style={{ '--p': `${progress}%` }} />
            </div>
          </div>

          <div className="spacer" />

          <form onSubmit={submit}>
            <div className="field">
              <div className="labelRow">
                <div className="label">Your answer</div>
                <div className="hint">Press Enter to submit</div>
              </div>
              <div className="row" style={{ alignItems: 'stretch' }}>
                <input
                  className="input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type the song name…"
                  aria-label="Answer"
                  disabled={currentSeconds <= 0 || betweenSongs}
                />
                <button className="btn btnPrimary" type="submit" disabled={currentSeconds <= 0 || betweenSongs}>
                  Submit
                </button>
              </div>
            </div>

            <div
              className={[
                'feedback',
                feedback ? 'feedbackShow' : '',
                feedback === 'good' || feedback === 'correct' ? 'feedbackGood' : '',
                feedback === 'bad' || feedback === 'wrong' ? 'feedbackBad' : '',
              ].join(' ')}
              role="status"
              aria-live="polite"
            >
              {feedback === 'correct' ? 'Correct! 🎉' :
               feedback === 'wrong' ? 'Wrong — try again' :
               feedback === 'good' ? 'Answer submitted' :
               feedback === 'bad' ? 'Please type something' : ' '}
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        <header className="panelHeader">
          <h3 className="panelTitle">Live leaderboard</h3>
          <p className="panelSub">Fastest fingers win.</p>
        </header>
        <div className="panelBody">
          <div className="leaderboard">
            {(!leaderboard || leaderboard.length === 0) && (
              <div className="lbEmpty">Waiting for answers...</div>
            )}
            {leaderboard && leaderboard.map((p, idx) => (
              <div className="lbRow" key={p.id}>
                <div className="lbLeft">
                  <div className="place">{idx + 1}</div>
                  <div className="lbName">{p.name}</div>
                </div>
                <div className="score">
                  {typeof p.score === 'number' ? p.score : 0} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}