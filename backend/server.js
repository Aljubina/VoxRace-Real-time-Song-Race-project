const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');

const app = express();

const server = http.createServer(app);
app.use(cors());

const io = socketio(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
})

const music = [];

const rooms = new Map(); // roomCode -> { players: [{ id, name, isHost }], ... }

io.on("connection", (socket)=>{
    console.log('a user connected');

    socket.on('createRoom', (roomCode, nickname, options, ack)=>{
        const normalized = String(roomCode || '').toUpperCase();
        if (!normalized) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }
        socket.join(normalized);
        socket.roomCode = normalized;
        socket.nickname = nickname;
        socket.isHost = true;
        const players = [{ id: socket.id, name: nickname || 'Host', isHost: true }];
        rooms.set(normalized, { players, options: options || {} });
        if (typeof ack === 'function') ack({ ok: true, roomCode: normalized });
        io.to(normalized).emit('roomUpdated', { roomCode: normalized, players });
    });

    socket.on('joinRoom', (roomCode, nickname, ack)=>{
        const normalized = String(roomCode || '').toUpperCase();
        const room = rooms.get(normalized);
        if (!room) {
            if (typeof ack === 'function') ack({ ok: false });
            return;
        }
        socket.join(normalized);
        socket.roomCode = normalized;
        socket.nickname = nickname;
        socket.isHost = false;
        const player = { id: socket.id, name: nickname || 'Player', isHost: false };
        room.players.push(player);
        if (typeof ack === 'function') ack({ ok: true, roomCode: normalized });
        io.to(normalized).emit('playerJoined', player);
        io.to(normalized).emit('roomUpdated', { roomCode: normalized, players: room.players });
    });
})

const PORT = process.env.PORT || 5000;





server.listen(PORT, ()=>{
    console.log(`server running at port ${PORT}`)
})