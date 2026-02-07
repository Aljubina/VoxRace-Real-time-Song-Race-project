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

const music = [

];

io.on("connection", (socket)=>{
    console.log('a user connected');

    socket.on('joinRoom', (room, name)=>{
        socket.join(room);
    } )
})

const PORT = process.env.PORT || 5000;





server.listen(PORT, ()=>{
    console.log(`server running at port ${PORT}`)
})