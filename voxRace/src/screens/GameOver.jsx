export default function GameOver({ winnerName, leaderboard, onPlayAgain, onHome }) {
  return (
    <section className="panel">
      <header className="panelHeader">
        <h2 className="panelTitle">Game over</h2>
        <p className="panelSub">Final standings and bragging rights.</p>
      </header>

      <div className="panelBody">
        <div
          className="panel"
          style={{
            padding: 18,
            background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(96,165,250,0.10))',
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <div className="label" style={{ marginBottom: 6 }}>
            Winner
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>
            {winnerName}
          </div>
          <div className="panelSub" style={{ marginTop: 6 }}>
            Clean guesses. Faster submits. Big W.
          </div>
        </div>

        <div className="spacer" />

        <div className="leaderboard" aria-label="Final leaderboard">
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

        <div className="spacer" />

        <div className="row">
          <button className="btn btnPrimary" onClick={onPlayAgain} type="button">
            Play Again
          </button>
          <button className="btn btnGhost" onClick={onHome} type="button">
            Home
          </button>
        </div>
      </div>
    </section>
  )
}

