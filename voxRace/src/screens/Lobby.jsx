import { useState } from 'react'

export default function Lobby({ roomCode, players, isHost, onBack, onStart }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <section className="grid2">
      <div className="panel">
        <header className="panelHeader">
          <h2 className="panelTitle">Lobby</h2>
          <p className="panelSub">Share the code and get ready to sprint.</p>
        </header>

        <div className="panelBody">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="codePill" aria-label="Room code">
              <span className="roomCode">{roomCode}</span>
            </div>
            <div className="row">
              <button className="btn btnSmall btnGhost" onClick={copyCode} type="button">
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="btn btnSmall btnGhost" onClick={onBack} type="button">
                Leave
              </button>
            </div>
          </div>

          <div className="spacer" />

          <div className="wait" aria-live="polite">
            Waiting for players
            <span className="dots" aria-hidden="true">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
          </div>

          <div className="spacer" />

          <div className="list">
            {players.map((p) => (
              <div className="playerCard" key={p.id}>
                <div className="playerName">
                  <div className="avatar" aria-hidden="true" />
                  <div>{p.name}</div>
                </div>
                {p.isHost ? <div className="badge badgeHost">Host</div> : <div className="badge">Ready</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <header className="panelHeader">
          <h3 className="panelTitle">Controls</h3>
          <p className="panelSub">
            {isHost ? 'You can start when everyone is in.' : 'Only the host can start the game.'}
          </p>
        </header>
        <div className="panelBody">
          <button className="btn btnPrimary" disabled={!isHost} onClick={onStart} type="button">
            Start Game
          </button>
          <div className="spacer" />
          <div className="hint">
            Tip: invite friends, then hit <span className="kbd">Start</span>.
          </div>
        </div>
      </div>
    </section>
  )
}

