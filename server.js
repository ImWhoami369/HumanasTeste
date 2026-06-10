const express = require('express');
const app = express();
const server = require('http').Server(app);
const { ExpressPeerServer } = require('peer');

// Configuração do Socket.io otimizada para o Render
const io = require('socket.io')(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket'] 
});

// Configura o servidor PeerJS embutido rodando junto com o Express
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

let roomUsers = {};

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(userId);

    // Avisa os outros aparelhos
    socket.to(roomId).emit('user-connected', userId, userNickname);
    io.to(roomId).emit('update-peer-count', roomUsers[roomId].size);

    // Chat de texto
    socket.on('send-chat-message', (message) => {
      io.to(roomId).emit('chat-message', {
        name: userNickname,
        msg: message
      });
    });

    socket.on('disconnect', () => {
      if (roomUsers[roomId]) {
        roomUsers[roomId].delete(userId);
        socket.to(roomId).emit('user-disconnected', userId);
        io.to(roomId).emit('update-peer-count', roomUsers[roomId].size);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`> Servidor Unifesp 3.0 rodando na porta ${PORT}`);
});
