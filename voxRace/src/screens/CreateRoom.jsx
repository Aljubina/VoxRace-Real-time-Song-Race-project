import { useMemo, useState } from 'react'

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export default function CreateRoom({ initial, onBack, onCreate }) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'Mixed')
  const [rounds, setRounds] = useState(String(initial?.rounds ?? 5))
  const [timePerSong, setTimePerSong] = useState(String(initial?.timePerSong ?? 15))
  const [roomCode, setRoomCode] = useState(initial?.roomCode ?? makeRoomCode())
  const [copied, setCopied] = useState(false)

  const roundsInt = useMemo(
    () => clampInt(rounds, { min: 1, max: 20, fallback: 5 }),
    [rounds],
  )
  const timeInt = useMemo(
    () => clampInt(timePerSong, { min: 5, max: 60, fallback: 15 }),
    [timePerSong],
  )

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore clipboard failures
    }
  }

  function submit(e) {
    e.preventDefault()
    onCreate?.({
      nickname: nickname.trim(),
      category,
      rounds: roundsInt,
      timePerSong: timeInt,
      roomCode,
    })
  }

  return (
    <section className="panel">
      <header className="panelHeader">
        <h2 className="panelTitle">Create room</h2>
        <p className="panelSub">Set up the vibe, invite your friends, and start the race.</p>
      </header>

      <div className="panelBody">
        <form className="formGrid formGrid2" onSubmit={submit}>
          <div className="field">
            <div className="labelRow">
              <div className="label">Nickname</div>
              <div className="hint">Shown to other players</div>
            </div>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. NightOwl"
              autoComplete="nickname"
              required
            />
          </div>

          <div className="field">
            <div className="labelRow">
              <div className="label">Category</div>
              <div className="hint">Pick a playlist style</div>
            </div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Mixed</option>
              <option>Pop</option>
              <option>Hip-Hop</option>
              <option>Rock</option>
              <option>EDM</option>
              <option>Anime</option>
            </select>
          </div>

          <div className="field">
            <div className="labelRow">
              <div className="label">Rounds</div>
              <div className="hint">1–20</div>
            </div>
            <input
              className="input"
              inputMode="numeric"
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
              placeholder="5"
            />
          </div>

          <div className="field">
            <div className="labelRow">
              <div className="label">Time per song</div>
              <div className="hint">5–60 seconds</div>
            </div>
            <input
              className="input"
              inputMode="numeric"
              value={timePerSong}
              onChange={(e) => setTimePerSong(e.target.value)}
              placeholder="15"
            />
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <div className="labelRow">
              <div className="label">Room code</div>
              <div className="hint">Share it with friends</div>
            </div>

            <div className="row">
              <div className="codePill">
                <span className="roomCode">{roomCode}</span>
              </div>
              <button className="btn btnSmall btnGhost" onClick={copyCode} type="button">
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="btn btnSmall btnSecondary"
                onClick={() => setRoomCode(makeRoomCode())}
                type="button"
              >
                New code
              </button>
            </div>
          </div>

          <div className="row" style={{ gridColumn: '1 / -1', marginTop: 6 }}>
            <button className="btn btnGhost" onClick={onBack} type="button">
              Back
            </button>
            <button className="btn btnPrimary" type="submit">
              Create &amp; Continue
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

