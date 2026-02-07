// useState -> store data that can change (state),
// useEffect -> run code on a condition/ runs side effects (data fetching, subscriptions, timers, logging, etc.)
// useMemo -> optimize calculations
import { useEffect, useMemo, useState } from 'react';
import './App.css' // imports css file and styles the App component
import { ToastContainer, toast} from 'react-toastify';  // toast -> function to show notifications and ToastContainer -> container for notifications
import 'react-toastify/dist/ReactToastify.css';  
import io from 'socket.io-client'; // socket.io-client -> library for real-time communication between client and server

// socket -> connects frontend to backend websocket server
const socket = io('ws://localhost:5000'); 

// import screens -> components for each screen of the app
import Home from './screens/Home.jsx'
import CreateRoom from './screens/CreateRoom.jsx'
import JoinRoom from './screens/JoinRoom.jsx'
import Lobby from './screens/Lobby.jsx'
import Game from './screens/Game.jsx'
import GameOver from './screens/GameOver.jsx'

// makeId -> generate a random ID for a player
function makeId() {
  return Math.random().toString(16).slice(2)
}

// makeRoomCode -> generate a random room code for a room (avoids confusing ones like 0,O,I,1)
function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  // loop to generate a random room code
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

// App -> main component that renders the app
function App() {
  const [screen, setScreen] = useState('home') // state to store the current screen

  // UI-only mock data so you can preview screens without backend/sockets.
  const [roomCode, setRoomCode] = useState(makeRoomCode()) // state to store the room code
  const [nickname, setNickname] = useState('') // state to store the nickname
  // state to store if the current user is the host (true if the user is the host, false if the user is a player)
  const [isHost, setIsHost] = useState(false) 

  // state to store the list of players in the room
  const [players, setPlayers] = useState(() => [
    { id: makeId(), name: 'NeonNova', isHost: true },
    { id: makeId(), name: 'BeatRunner', isHost: false },
  ])

  // state to store the current round
  const [round, setRound] = useState(1)
  // state to store the total number of rounds (default is 5)
  const totalRounds = 5
  // state to store the number of seconds left in the current round
  const [secondsLeft, setSecondsLeft] = useState(15)

  // state to store the leaderboard (derived state)
  const leaderboard = useMemo(() => {
    // Keep this derived (UI-only) so we don't create extra state or change any game logic.
    // seed -> initial data for the leaderboard
    // players[0]?.name ?? 'Player 1' -> if the first player is not found, use 'Player 1'
    // players[1]?.name ?? 'Player 2' -> if the second player is not found, use 'Player 2'
    // nickname ? nickname : 'You' -> if the nickname is not set, use 'You' (?? is the nullish coalescing operator)
    const seed = [
      { id: 'p1', name: players[0]?.name ?? 'Player 1', score: 120 },
      { id: 'p2', name: players[1]?.name ?? 'Player 2', score: 95 },
      { id: 'p3', name: nickname ? nickname : 'You', score: 80 },
    ]
    // sort the leaderboard by score in descending order
    // a.score - b.score -> if a.score is greater than b.score, return 1, otherwise return -1
    // b.score - a.score -> if b.score is greater than a.score, return 1, otherwise return -1
    return seed.sort((a, b) => b.score - a.score)
  }, [nickname, players]) // dependencies -> re-run the function when the nickname or players change

  // useEffect -> run code on a condition/ runs side effects (data fetching, subscriptions, timers, logging, etc.)
  useEffect(() => {
    // if the screen is not the game, return
    if (screen !== 'game') return

    // setInterval -> set a timer that runs every 1 second
    // s -> current number of seconds left
    // Math.max(0, s - 1) -> if the current number of seconds left is greater than 0, subtract 1, otherwise set it to 0
    const t = window.setInterval(() => {
      // set the number of seconds left to the maximum of 0 and the current number of seconds left minus 1
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)
    // clearInterval -> clear the timer when the component unmounts
    return () => window.clearInterval(t) // return a function to clear the timer
  }, [screen]) // dependencies -> re-run the function when the screen changes

  useEffect(() => {
    // if the screen is not the game, return
    if (screen !== 'game') return
    if (secondsLeft > 0) return
    // End the current round quickly in the UI preview.
    const t = window.setTimeout(() => setScreen('gameover'), 450)
    return () => window.clearTimeout(t) // return a function to clear the timer
  }, [screen, secondsLeft]) // dependencies -> re-run the function when the screen or seconds left changes

  // goHome -> function to go to the home screen
  function goHome() {
    setScreen('home')
  }

  // startCreate -> function to start the create room screen
  function startCreate() {
    setScreen('create')
  }

  // startJoin -> function to start the join room screen
  function startJoin() {
    setScreen('join')
  }

  // backFromForm -> function to go back to the home screen from the create or join room screen
  function backFromForm() {
    setScreen('home')
  }

  // handleCreate -> function to handle the creation of a new room
  function handleCreate(payload) {
    // set the nickname, room code, and is host to the payload
    setNickname(payload.nickname) // set the nickname to the payload
    setRoomCode(payload.roomCode) // set the room code to the payload
    setIsHost(true) // set the is host to true
    // set the players to the payload
    setPlayers([{ id: makeId(), name: payload.nickname || 'Host', isHost: true }])
    setScreen('lobby') // set the screen to the lobby screen
  }

  // handleJoin -> function to handle the joining of a room
  function handleJoin(payload) {
    // set the nickname, room code, and is host to the payload
    setNickname(payload.nickname)
    setRoomCode(payload.roomCode)
    setIsHost(false) // set the is host to false
    // set the players to the payload
    setPlayers((prev) => {
      // if the previous players are not empty, use the previous players, otherwise use the host
      const base = prev.length ? prev : [{ id: makeId(), name: 'Host', isHost: true }]
      // return the previous players with the new player added
      return [...base, { id: makeId(), name: payload.nickname || 'You', isHost: false }]
    })
    setScreen('lobby') // set the screen to the lobby screen
  }

  // startGame -> function to start the game
  function startGame() {
    // set the round to 1 and the seconds left to 15
    setRound(1)
    setSecondsLeft(15)
    // set the screen to the game screen
    setScreen('game')
  }

  // backToLobby -> function to go back to the lobby screen
  function backToLobby() {
    // set the screen to the lobby screen
    setScreen('lobby')
  }

  // submitAnswer -> function to submit the answer
  function submitAnswer() {
    // UI-only: no-op. Wire this to your actual socket/game state later.
  }

  function playAgain() {
    // set the seconds left to 15 and the round to 1
    setSecondsLeft(15)
    setRound(1)
    // set the screen to the lobby screen if the current user is the host, otherwise set it to the home screen
    setScreen(isHost ? 'lobby' : 'home')
  }

  // pills -> array of objects to store the labels and ids of the pills
  const pills = [
    { id: 'home', label: 'Home' },
    { id: 'create', label: 'Create' },
    { id: 'join', label: 'Join' },
    { id: 'lobby', label: 'Lobby' },
    { id: 'game', label: 'Game' },
    { id: 'gameover', label: 'Game Over' },
  ]

  // return the app component
  return (
    // div -> container for the app
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
