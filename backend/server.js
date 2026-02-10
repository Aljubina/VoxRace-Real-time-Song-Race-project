const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use('/audio', express.static('public/audio'));

const SONGS_PER_ROUND = 5;

// All available songs (add more as needed)
const songs = [
  { id: 2, title: 'Oggy Ending', artist: 'Oggy', audioUrl: 'http://localhost:4000/audio/oggy_ending.mp3', correctAnswer: 'oggy and cockroaches' },
  { id: 3, title: 'Pokemon Theme', artist: 'Pokemon', audioUrl: 'http://localhost:4000/audio/pokemon_theme_song.mp3', correctAnswer: 'pokemon' },
  { id: 4, title: 'Power Rangers Theme', artist: 'Power Rangers', audioUrl: 'http://localhost:4000/audio/power_rangers_theme.mp3', correctAnswer: 'power rangers' },
  { id: 5, title: 'Shinchan Theme', artist: 'Shinchan', audioUrl: 'http://localhost:4000/audio/shinchan_theme_song.mp3', correctAnswer: 'shinchan' },
  { id: 6, title: 'Doremon', artist: 'Doremon', audioUrl: 'http://localhost:4000/audio/doremon.mp3', correctAnswer: 'doremon' },
  // Add more songs here — aim for 10–20 total
];

// In-memory storage
const rooms = new Map(); // roomCode → room data

// Shuffle helper
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
      scores: {}, // playerId → score
      currentRound: 0,
      songIndex: 0,
      roundSongs: [], // will be filled when round starts
      currentSong: null,
      timerId: null,
      countdownTimerId: null,
      answers: {},
      settings: {
        category: options?.category || 'Mixed',
        totalRounds: options?.rounds || 1,
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
    room.scores[socket.id] = 0; // Ensure score starts at 0

    socket.join(code);
    socket.roomCode = code;

    ack?.({ ok: true, roomCode: code });
    io.to(code).emit('playerJoined', player);
    io.to(code).emit('roomUpdated', { roomCode: code, players: room.players });

    // Send current leaderboard to new joiner
    io.to(code).emit('leaderboard-update', getLeaderboard(room));
  });

  // ── START GAME (host only) ───────────────────────────
  socket.on('start-game', (roomCode) => {
    const code = String(roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || room.host !== socket.id || room.state === 'playing') return;

    room.state = 'playing';
    room.currentRound = 1;
    room.songIndex = 0;

    // Prepare shuffled list of 5 unique songs for this round
    const available = [...songs];
    room.roundSongs = shuffleArray(available).slice(0, Math.min(SONGS_PER_ROUND, available.length));

    if (room.roundSongs.length === 0) {
      console.warn('No songs available');
      return endGame(code);
    }

    startNewSong(code);
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

      // End song early
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

    io.to(code).emit('leaderboard-update', getLeaderboard(room));
  });

  // ── DISCONNECT CLEANUP ────────────────────────────────
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (!socket.roomCode) return;

    const room = rooms.get(socket.roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    delete room.scores[socket.id]; // optional: clean score

    if (room.players.length === 0) {
      rooms.delete(socket.roomCode);
      return;
    }

    if (room.host === socket.id && room.players.length > 0) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
    }

    io.to(socket.roomCode).emit('roomUpdated', { players: room.players });
    io.to(socket.roomCode).emit('leaderboard-update', getLeaderboard(room));
  });
});

// ── HELPER: Get formatted leaderboard ────────────────────────
function getLeaderboard(room) {
  return room.players.map(p => ({
    id: p.id,
    name: p.name,
    score: room.scores[p.id] || 0
  })).sort((a, b) => b.score - a.score);
}

// ── Start next song in the round ─────────────────────────────
function startNewSong(code) {
  const room = rooms.get(code);
  if (!room) return;

  // If all 5 songs played → end round/game
  if (room.songIndex >= room.roundSongs.length) {
    return endGame(code);
  }

  const song = room.roundSongs[room.songIndex];
  room.currentSong = song;
  room.answers = {};
  room.roundStartTime = Date.now();

  if (room.timerId) clearTimeout(room.timerId);
  const timeMs = room.settings.timePerSong * 1000;
  room.timerId = setTimeout(() => endSong(code, 'timeout'), timeMs);

  io.to(code).emit('new-round', {
    round: room.currentRound,
    songNumber: room.songIndex + 1,
    songsPerRound: room.roundSongs.length,
    audioUrl: song.audioUrl,
    startTime: Date.now() + 500,
    timer: room.settings.timePerSong
  });

  room.songIndex += 1;
}

// ── End current song (timeout or correct answer) ─────────────
function endSong(code, reason) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.timerId) {
    clearTimeout(room.timerId);
    room.timerId = null;
  }

  io.to(code).emit('round-end', {
    correctAnswer: room.currentSong?.correctAnswer || 'Unknown',
    reason
  });

  io.to(code).emit('leaderboard-update', getLeaderboard(room));

  // Start 3-second countdown before next song
  startBetweenSongCountdown(code);
}

// ── 3-second countdown between songs ─────────────────────────
function startBetweenSongCountdown(code) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.countdownTimerId) {
    clearInterval(room.countdownTimerId);
  }

  let remaining = 3;
  room.countdownTimerId = setInterval(() => {
    io.to(code).emit('countdown', {
      secondsLeft: remaining,
      phase: 'between-songs'
    });

    remaining -= 1;

    if (remaining < 0) {
      clearInterval(room.countdownTimerId);
      room.countdownTimerId = null;
      startNewSong(code); // Next song
    }
  }, 1000);
}

// ── End the full round/game ──────────────────────────────────
function endGame(code) {
  const room = rooms.get(code);
  if (!room) return;

  const leaderboard = getLeaderboard(room);

  io.to(code).emit('game-over', { leaderboard });
  room.state = 'finished';

  // Optional: clean up after delay
  setTimeout(() => rooms.delete(code), 60000);
}

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});