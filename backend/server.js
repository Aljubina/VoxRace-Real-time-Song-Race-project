const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // your Vite frontend
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// Serve audio files
app.use('/audio', express.static('public/audio'));

// Single source of truth for songs
// Audio lives in backend/public/audio and is served at http://localhost:4000/audio/...
const SONGS_PER_ROUND = 5; // One logical "round" = 5 songs
const songs = [
  { id: 1, title: 'Song One', artist: 'Artist A', audioUrl: 'http://localhost:4000/audio/doremon.mp3', correctAnswer: 'doremon' },
  { id: 2, title: 'Song Two', artist: 'Artist B', audioUrl: 'http://localhost:4000/audio/oggy_ending.mp3', correctAnswer: 'oggy and cockroaches' },
  { id: 3, title: 'Song Three', artist: 'Artist C', audioUrl: 'http://localhost:4000/audio/pokemon_theme_song.mp3', correctAnswer: 'pokemon' },
  { id: 4, title: 'Song Four', artist: 'Artist D', audioUrl: 'http://localhost:4000/audio/power_rangers_theme.mp3', correctAnswer: 'power rangers' },
  { id: 5, title: 'Song Five', artist: 'Artist E', audioUrl: 'http://localhost:4000/audio/shinchan_theme_song.mp3', correctAnswer: 'shinchan' }
  // Add 10–20 real songs here (same pattern)
];

// In-memory rooms: roomCode → room data
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // ── CREATE ROOM ───────────────────────────────────────
  socket.on('createRoom', (roomCode, nickname, options, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    if (!code) return ack?.({ ok: false, message: 'Room code required' });

    if (rooms.has(code)) return ack?.({ ok: false, message: 'Room already exists' });

    const player = { id: socket.id, name: nickname || 'Host', isHost: true };
    rooms.set(code, {
      players: [player],
      host: socket.id,
      state: 'lobby',
      scores: {},              // playerId -> score (initialized empty)
      currentRound: 0,         // logical round (set of songs)
      currentSongIndex: 0,     // 1..SONGS_PER_ROUND within current round
      currentSong: null,       // current song metadata
      timerId: null,           // per-song timer
      countdownTimerId: null,  // between-song countdown
      isSongActive: false,     // guard to avoid double-ending a song
      answers: {},             // playerId -> has answered this song
      settings: {
        category: options?.category || 'Mixed',
        totalRounds: options?.rounds || 5,
        timePerSong: options?.timePerSong || 15
      }
    });

    socket.join(code);
    socket.roomCode = code;

    ack?.({ ok: true, roomCode: code });
    io.to(code).emit('roomUpdated', { roomCode: code, players: rooms.get(code).players });
  });

  // ── JOIN ROOM ─────────────────────────────────────────
  socket.on('joinRoom', (roomCode, nickname, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack?.({ ok: false, message: 'Room not found' });

    if (room.players.some(p => p.name === nickname)) {
      return ack?.({ ok: false, message: 'Name already taken' });
    }

    const player = { id: socket.id, name: nickname || 'Player', isHost: false };
    room.players.push(player);
    // Ensure scores object exists and initialize this player's score to 0
    if (!room.scores) room.scores = {};
    if (room.scores[player.id] == null) {
      room.scores[player.id] = 0;
    }
    socket.join(code);
    socket.roomCode = code;

    ack?.({ ok: true, roomCode: code });
    io.to(code).emit('playerJoined', player);
    io.to(code).emit('roomUpdated', { roomCode: code, players: room.players });
  });

  // ── START GAME (host only) ────────────────────────────
  socket.on('start-game', (roomCode) => {
    const code = String(roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || room.host !== socket.id || room.state === 'playing') return;

    // Reset per-game state
    room.state = 'playing';
    room.currentRound = 1;
    room.currentSongIndex = 0;
    room.scores = {};
    room.answers = {};
    room.currentSong = null;
    room.isSongActive = false;
    if (room.timerId) {
      clearTimeout(room.timerId);
      room.timerId = null;
    }
    if (room.countdownTimerId) {
      clearInterval(room.countdownTimerId);
      room.countdownTimerId = null;
    }

    // Send initial leaderboard with all players at 0
    io.to(code).emit('leaderboard-update', getLeaderboard(room));

    startNewRound(code);
  });

  // ── SUBMIT ANSWER ─────────────────────────────────────
  socket.on('submit-answer', ({ roomCode, answer }) => {
    const code = String(roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || room.state !== 'playing' || room.answers[socket.id]) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.answers[socket.id] = true;

    const elapsed = (Date.now() - room.roundStartTime) / 1000;
    const isCorrect = (answer || '').toLowerCase().trim().includes(room.currentSong.correctAnswer.toLowerCase());

    let points = 0;
    if (isCorrect) {
      points = Math.max(100, Math.floor(1000 - elapsed * 50));
      room.scores[socket.id] = (room.scores[socket.id] || 0) + points;

      // End this song early if someone is correct
      if (room.timerId) {
        clearTimeout(room.timerId);
        room.timerId = null;
      }
      endSong(code, 'correct');
    }

    io.to(code).emit('round-result', {
      playerId: socket.id,
      playerName: player.name,
      isCorrect,
      points
    });

    // Always send updated leaderboard after each submitted answer
    const leaderboard = getLeaderboard(room);
    io.to(code).emit('leaderboard-update', leaderboard);
  });

  // ── DISCONNECT CLEANUP ────────────────────────────────
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (!socket.roomCode) return;

    const room = rooms.get(socket.roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(socket.roomCode);
      return;
    }

    // If host left, transfer host
    if (room.host === socket.id && room.players.length > 0) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
    }

    io.to(socket.roomCode).emit('roomUpdated', { players: room.players });
  });
});

// ── ROUND & SONG LOGIC ──────────────────────────────────
function getLeaderboard(room) {
  return room.players.map(p => ({
    id: p.id,
    name: p.name,
    score: room.scores[p.id] || 0
  })).sort((a, b) => b.score - a.score);
}

// Start a full logical round (set of SONGS_PER_ROUND songs)
function startNewRound(code) {
  const room = rooms.get(code);
  if (!room) return;

  // Check if game is over
  if (room.currentRound > room.settings.totalRounds) {
    return endGame(code);
  }

  // New round: reset per-round song index and answers
  room.currentSongIndex = 1;
  room.answers = {};
  room.isSongActive = false;

  startSong(code);
}

// Start a single song within the current round
function startSong(code) {
  const room = rooms.get(code);
  if (!room) return;

  // Safety: ensure we don't overlap songs
  room.isSongActive = true;
  if (room.timerId) {
    clearTimeout(room.timerId);
    room.timerId = null;
  }
  if (room.countdownTimerId) {
    clearInterval(room.countdownTimerId);
    room.countdownTimerId = null;
  }

  // Pick random song
  const song = songs[Math.floor(Math.random() * songs.length)];
  room.currentSong = song;
  room.answers = {};

  // Use shared startTime for audio sync + scoring
  const startTime = Date.now() + 500; // small buffer for sync
  room.roundStartTime = startTime;

  const timeMs = (room.settings.timePerSong || 15) * 1000;
  room.timerId = setTimeout(() => {
    endSong(code, 'timeout');
  }, timeMs);

  io.to(code).emit('new-round', {
    round: room.currentRound,             // logical round number
    songNumber: room.currentSongIndex,    // 1..SONGS_PER_ROUND within round
    songsPerRound: SONGS_PER_ROUND,
    audioUrl: song.audioUrl,
    startTime,
    timer: room.settings.timePerSong || 15
  });
}

// End a single song (timeout or correct answer)
function endSong(code, reason) {
  const room = rooms.get(code);
  if (!room) return;

  // Guard against double-ending
  if (!room.isSongActive) return;
  room.isSongActive = false;

  if (room.timerId) {
    clearTimeout(room.timerId);
    room.timerId = null;
  }

  const leaderboard = getLeaderboard(room);

  // Reveal correct answer + send updated leaderboard
  io.to(code).emit('leaderboard-update', leaderboard);
  io.to(code).emit('round-end', {
    correctAnswer: room.currentSong?.correctAnswer || 'Unknown',
    songNumber: room.currentSongIndex,
    songsPerRound: SONGS_PER_ROUND,
    reason: reason || 'unknown'
  });

  // 3-second countdown before next song / round end
  startBetweenSongCountdown(code);
}

function startBetweenSongCountdown(code) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.countdownTimerId) {
    clearInterval(room.countdownTimerId);
    room.countdownTimerId = null;
  }

  let remaining = 3;
  room.countdownTimerId = setInterval(() => {
    const r = rooms.get(code);
    if (!r) {
      clearInterval(room.countdownTimerId);
      room.countdownTimerId = null;
      return;
    }

    io.to(code).emit('countdown', {
      secondsLeft: remaining,
      phase: 'between-songs'
    });

    remaining -= 1;

    if (remaining <= 0) {
      clearInterval(r.countdownTimerId);
      r.countdownTimerId = null;

      if (r.currentSongIndex < SONGS_PER_ROUND) {
        // Next song within this round
        r.currentSongIndex += 1;
        startSong(code);
      } else {
        // Completed SONGS_PER_ROUND songs → finish round/game
        // For now assume a single round; endGame will emit final leaderboard.
        endGame(code);
      }
    }
  }, 1000);
}

function endGame(code) {
  const room = rooms.get(code);
  if (!room) return;

  const leaderboard = room.players.map(p => ({
    id: p.id,
    name: p.name,
    score: room.scores[p.id] || 0
  })).sort((a, b) => b.score - a.score);

  io.to(code).emit('game-over', { leaderboard });
  room.state = 'finished';
  // Optional: clean up room after some time
  // setTimeout(() => rooms.delete(code), 60000);
}

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});