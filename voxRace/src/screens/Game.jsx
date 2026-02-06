import { useEffect, useMemo, useState } from 'react'

export default function Game({
  round,
  totalRounds,
  secondsLeft,
  leaderboard,
  onBackToLobby,
  onSubmitAnswer,
}) {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // 'good' | 'bad'
  const [flashKey, setFlashKey] = useState(0)

  const progress = useMemo(() => {
    const total = Math.max(1, 30)
    const clamped = Math.min(total, Math.max(0, total - secondsLeft))
    return Math.round((clamped / total) * 100)
  }, [secondsLeft])

  useEffect(() => {
    if (!feedback) return
    const t = window.setTimeout(() => setFeedback(null), 900)
    return () => window.clearTimeout(t)
  }, [feedback, flashKey])

  function submit(e) {
    e.preventDefault()
    const ok = answer.trim().length > 0
    setFeedback(ok ? 'good' : 'bad')
    setFlashKey((k) => k + 1)
    onSubmitAnswer?.(answer)
    if (ok) setAnswer('')
  }

  return (
    <section className="grid2">
      <div className="panel">
        <div className="panelBody">
          <div className="gameTop">
            <div className="roundTag">
              Round <strong style={{ color: 'rgba(255,255,255,0.92)' }}>{round}</strong> / {totalRounds}
            </div>
            <button className="btn btnSmall btnGhost" onClick={onBackToLobby} type="button">
              Back to Lobby
            </button>
          </div>

          <div className="timer" aria-label="Countdown timer">
            <div className="timerNum">{secondsLeft}</div>
          </div>

          <div className="audioBox" aria-label="Audio player">
            <div className="audioMeta">
              <div>
                <div className="audioTitle">Now playing</div>
                <div className="audioHint">Guess the song title (and artist if you can)</div>
              </div>
              <div className="hint">Preview UI only</div>
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
                />
                <button className="btn btnPrimary" type="submit">
                  Submit
                </button>
              </div>
            </div>

            <div
              className={[
                'feedback',
                feedback ? 'feedbackShow' : '',
                feedback === 'good' ? 'feedbackGood' : '',
                feedback === 'bad' ? 'feedbackBad' : '',
              ].join(' ')}
              role="status"
              aria-live="polite"
            >
              {feedback === 'good' ? 'Nice! Answer submitted.' : feedback === 'bad' ? 'Type an answer first.' : ' '}
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
            {leaderboard.map((p, idx) => (
              <div className="lbRow" key={p.id}>
                <div className="lbLeft">
                  <div className="place">{idx + 1}</div>
                  <div className="lbName">{p.name}</div>
                </div>
                <div className="score">{p.score} pts</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

