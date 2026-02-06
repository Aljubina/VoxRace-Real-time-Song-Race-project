import { useEffect, useMemo, useState } from 'react'
import './App.css'

import Home from './screens/Home.jsx'
import CreateRoom from './screens/CreateRoom.jsx'
import JoinRoom from './screens/JoinRoom.jsx'
import Lobby from './screens/Lobby.jsx'
import Game from './screens/Game.jsx'
import GameOver from './screens/GameOver.jsx'

function makeId() {
  return Math.random().toString(16).slice(2)
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

function App() {
  const [screen, setScreen] = useState('home')

  // UI-only mock data so you can preview screens without backend/sockets.
  const [roomCode, setRoomCode] = useState(makeRoomCode())
  const [nickname, setNickname] = useState('')
  const [isHost, setIsHost] = useState(false)

  const [players, setPlayers] = useState(() => [
    { id: makeId(), name: 'NeonNova', isHost: true },
    { id: makeId(), name: 'BeatRunner', isHost: false },
  ])

  const [round, setRound] = useState(1)
  const totalRounds = 5
  const [secondsLeft, setSecondsLeft] = useState(15)

  const leaderboard = useMemo(() => {
    // Keep this derived (UI-only) so we don't create extra state or change any game logic.
    const seed = [
      { id: 'p1', name: players[0]?.name ?? 'Player 1', score: 120 },
      { id: 'p2', name: players[1]?.name ?? 'Player 2', score: 95 },
      { id: 'p3', name: nickname ? nickname : 'You', score: 80 },
    ]
    return seed.sort((a, b) => b.score - a.score)
  }, [nickname, players])

  useEffect(() => {
    if (screen !== 'game') return

    const t = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [screen])

  useEffect(() => {
    if (screen !== 'game') return
    if (secondsLeft > 0) return
    // End the round quickly in the UI preview.
    const t = window.setTimeout(() => setScreen('gameover'), 450)
    return () => window.clearTimeout(t)
  }, [screen, secondsLeft])

  function goHome() {
    setScreen('home')
  }

  function startCreate() {
    setScreen('create')
  }

  function startJoin() {
    setScreen('join')
  }

  function backFromForm() {
    setScreen('home')
  }

  function handleCreate(payload) {
    setNickname(payload.nickname)
    setRoomCode(payload.roomCode)
    setIsHost(true)
    setPlayers([{ id: makeId(), name: payload.nickname || 'Host', isHost: true }])
    setScreen('lobby')
  }

  function handleJoin(payload) {
    setNickname(payload.nickname)
    setRoomCode(payload.roomCode)
    setIsHost(false)
    setPlayers((prev) => {
      const base = prev.length ? prev : [{ id: makeId(), name: 'Host', isHost: true }]
      return [...base, { id: makeId(), name: payload.nickname || 'You', isHost: false }]
    })
    setScreen('lobby')
  }

  function startGame() {
    setRound(1)
    setSecondsLeft(15)
    setScreen('game')
  }

  function backToLobby() {
    setScreen('lobby')
  }

  function submitAnswer() {
    // UI-only: no-op. Wire this to your actual socket/game state later.
  }

  function playAgain() {
    setSecondsLeft(15)
    setRound(1)
    setScreen(isHost ? 'lobby' : 'home')
  }

  const pills = [
    { id: 'home', label: 'Home' },
    { id: 'create', label: 'Create' },
    { id: 'join', label: 'Join' },
    { id: 'lobby', label: 'Lobby' },
    { id: 'game', label: 'Game' },
    { id: 'gameover', label: 'Game Over' },
  ]

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbarInner">
          <button className="brand brandBtn" onClick={goHome} type="button">
            <div className="brandMark" aria-hidden="true" />
            <div className="brandText">
              VoxRace <span>UI</span>
            </div>
          </button>

          <div className="navPills" aria-label="Screen navigation (preview)">
            {pills.map((p) => (
              <button
                key={p.id}
                className={['pill', screen === p.id ? 'pillActive' : ''].join(' ')}
                onClick={() => {
                  if (p.id === 'game') setSecondsLeft(15)
                  setScreen(p.id)
                }}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="content">
        {screen === 'home' && <Home onCreateRoom={startCreate} onJoinRoom={startJoin} />}

        {screen === 'create' && (
          <CreateRoom
            initial={{ nickname, roomCode, category: 'Mixed', rounds: 5, timePerSong: 15 }}
            onBack={backFromForm}
            onCreate={handleCreate}
          />
        )}

        {screen === 'join' && (
          <JoinRoom initial={{ nickname, roomCode: '' }} onBack={backFromForm} onJoin={handleJoin} />
        )}

        {screen === 'lobby' && (
          <Lobby
            roomCode={roomCode}
            players={players}
            isHost={isHost}
            onBack={goHome}
            onStart={startGame}
          />
        )}

        {screen === 'game' && (
          <Game
            round={round}
            totalRounds={totalRounds}
            secondsLeft={secondsLeft}
            leaderboard={leaderboard}
            onBackToLobby={backToLobby}
            onSubmitAnswer={submitAnswer}
          />
        )}

        {screen === 'gameover' && (
          <GameOver
            winnerName={leaderboard[0]?.name ?? 'Winner'}
            leaderboard={leaderboard}
            onPlayAgain={playAgain}
            onHome={goHome}
          />
        )}
      </main>
    </div>
  )
}


export default App
