import { useState } from 'react'

export default function JoinRoom({ initial, onBack, onJoin }) {
  const [roomCode, setRoomCode] = useState(initial?.roomCode ?? '')
  const [nickname, setNickname] = useState(initial?.nickname ?? '')

  function submit(e) {
    e.preventDefault()
    onJoin?.({
      roomCode: roomCode.trim().toUpperCase(),
      nickname: nickname.trim(),
    })
  }

  return (
    <section className="panel">
      <header className="panelHeader">
        <h2 className="panelTitle">Join room</h2>
        <p className="panelSub">Enter the room code and pick a nickname.</p>
      </header>

      <div className="panelBody">
        <form className="formGrid" onSubmit={submit}>
          <div className="field">
            <div className="labelRow">
              <div className="label">Room code</div>
              <div className="hint">6 characters</div>
            </div>
            <input
              className="input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="e.g. K9P3QX"
              autoComplete="off"
              spellCheck="false"
              required
            />
          </div>

          <div className="field">
            <div className="labelRow">
              <div className="label">Nickname</div>
              <div className="hint">What friends will see</div>
            </div>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. BeatRunner"
              autoComplete="nickname"
              required
            />
          </div>

          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn btnGhost" onClick={onBack} type="button">
              Back
            </button>
            <button className="btn btnPrimary" type="submit">
              Join
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

