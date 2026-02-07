export default function Home({ onCreateRoom, onJoinRoom }) {
  function handleCreateRoom(e) {
    e.preventDefault()
    if (onCreateRoom) onCreateRoom()
  }

  function handleJoinRoom(e) {
    e.preventDefault()
    if (onJoinRoom) onJoinRoom()
  }

  return (
    <section className="hero">
      <div className="heroInner">
        <h1 className="title">VoxRace</h1>
        <p className="subtitle">Race your friends to guess songs the fastest</p>

        <div className="ctaRow">
          <button className="btn btnPrimary" onClick={handleCreateRoom} type="button">
            Create Room
          </button>
          <button className="btn btnSecondary" onClick={handleJoinRoom} type="button">
            Join Room
          </button>
        </div>
      </div>
    </section>
  )
}

