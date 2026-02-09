// useState -> store data that can change (state),
// useEffect -> run code on a condition/ runs side effects (data fetching, subscriptions, timers, logging, etc.)
// useMemo -> optimize calculations
// useRef -> store a mutable value that does not cause re-renders when it changes
import { useEffect, useMemo, useState } from 'react';
import './App.css' // imports css file and styles the App component
import { ToastContainer, toast} from 'react-toastify';  // toast -> function to show notifications and ToastContainer -> container for notifications
import 'react-toastify/dist/ReactToastify.css';  
import io from 'socket.io-client'; // socket.io-client -> library for real-time communication between client and server
// socket -> connects frontend to backend websocket server
const socket = io('http://localhost:4000', {
  autoConnect: false,
});

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
  const [screen, setScreen] = useState('home'); // state to store the current screen

  // Socket connect on mount, disconnect on unmount (must be inside component)
  useEffect(() => {
    socket.connect();
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      toast.error('Cannot connect to server');
    });
    return () => {
      socket.disconnect();
    };
  }, []);

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
  // leaderboard from server (updated on round-result / leaderboard-update)
  const [serverLeaderboard, setServerLeaderboard] = useState(null)
  // when non-host receives new-round we switch to game and pass this so Game can sync audio/timer
  const [lastNewRound, setLastNewRound] = useState(null)

  // state to store the leaderboard (derived state; fallback when no server data yet)
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

  // Use server leaderboard when in game and we have received at least one update
  const displayLeaderboard = screen === 'game' && serverLeaderboard && serverLeaderboard.length > 0
    ? serverLeaderboard
    : leaderboard

  // Socket: create room — emit when host creates, then sync state from ack/roomUpdated
  // Socket: join room — emit when player joins, then sync state from ack/playerJoined
  useEffect(() => {
    const onRoomUpdated = (data) => {
      if (data.players) setPlayers(data.players)
    }
    const onPlayerJoined = (data) => {
      setPlayers((prev) => [...prev, { id: data.id, name: data.name, isHost: false }])
      toast(`${data.name} joined the room`, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: 'light',
      })
    }
    socket.on('roomUpdated', onRoomUpdated)
    socket.on('playerJoined', onPlayerJoined)
    const onLeaderboardUpdate = (list) => {
      if (Array.isArray(list)) setServerLeaderboard(list)
    }
    const onNewRound = (payload) => {
      setScreen('game')
      // Use round + timer from server payload when available
      if (payload?.round != null) setRound(payload.round)
      if (typeof payload?.timer === 'number') {
        setSecondsLeft(payload.timer)
      } else {
        setSecondsLeft(15)
      }
      if (payload) setLastNewRound(payload)
    }
    socket.on('leaderboard-update', onLeaderboardUpdate)
    socket.on('new-round', onNewRound)
    return () => {
      socket.off('roomUpdated', onRoomUpdated)
      socket.off('playerJoined', onPlayerJoined)
      socket.off('leaderboard-update', onLeaderboardUpdate)
      socket.off('new-round', onNewRound)
    }
  }, [])
  // Server-driven game over: after 5 songs, backend emits 'game-over'
  useEffect(() => {
    const onGameOver = ({ leaderboard: finalLeaderboard }) => {
      if (Array.isArray(finalLeaderboard)) {
        setServerLeaderboard(finalLeaderboard)
      }
      setScreen('gameover')
    }
    socket.on('game-over', onGameOver)
    return () => {
      socket.off('game-over', onGameOver)
    }
  }, [])

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
    const code = (payload.roomCode || '').toUpperCase()
    const name = payload.nickname?.trim() || 'Host'
    setNickname(name)
    setRoomCode(code)
    setIsHost(true)
    setPlayers([{ id: makeId(), name, isHost: true }])
    setScreen('lobby')
    socket.emit('createRoom', code, name, {
      category: payload.category,
      rounds: payload.rounds,
      timePerSong: payload.timePerSong,
    }, (ack) => {
      if (ack?.ok && ack.roomCode) {
        setRoomCode(ack.roomCode)
      }
    })
  }

  // handleJoin -> function to handle the joining of a room
  function handleJoin(payload) {
    const code = (payload.roomCode || '').toUpperCase()
    const name = payload.nickname?.trim() || 'You'
    setNickname(name)
    setRoomCode(code)
    setIsHost(false)
    setPlayers([{ id: makeId(), name: 'Host', isHost: true }])
    setScreen('lobby')
    socket.emit('joinRoom', code, name, (ack) => {
      if (ack?.ok) {
        setRoomCode(ack.roomCode ?? code)
      } else {
        toast.error('Could not join room. Check the code and try again.')
        setScreen('join')
      }
    })
  }

  // startGame -> function to start the game
  function startGame() {
    socket.emit('start-game', roomCode);
    // round/secondsLeft will be driven by server 'new-round' events
    setServerLeaderboard(null)
  }

  // backToLobby -> function to go back to the lobby screen
  function backToLobby() {
    // set the screen to the lobby screen
    setScreen('lobby')
  }

  // submitAnswer -> function to submit the answer
  function submitAnswer(answer) {
    if(!answer?.trim()) return;
    socket.emit('submit-answer', {
      roomCode,
      answer: answer.trim()
    });
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
            leaderboard={displayLeaderboard}
            onBackToLobby={backToLobby}
            onSubmitAnswer={submitAnswer}
            roomCode={roomCode}
            socket={socket}
            initialRoundPayload={lastNewRound}
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
