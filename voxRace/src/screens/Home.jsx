export default function Home({ onCreateRoom, onJoinRoom }) {
  return (
    <section className="hero">
      <div className="heroInner">
        <h1 className="title">VoxRace</h1>
        <p className="subtitle">Race your friends to guess songs the fastest</p>

        <div className="ctaRow">
          <button className="btn btnPrimary" onClick={onCreateRoom} type="button">
            Create Room
          </button>
          <button className="btn btnSecondary" onClick={onJoinRoom} type="button">
            Join Room
          </button>
        </div>
      </div>
    </section>
  )
}

