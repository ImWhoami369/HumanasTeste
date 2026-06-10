const express = require('express');
const app = express();
const server = require('http').Server(app);
const { ExpressPeerServer } = require('peer');

// Configuração com CORS ultra-aberto e liberação de Polling para o Render
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket'] // Deixamos ambos para o proxy do Render negociar a melhor rota
});

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
  // Assim que qualquer dispositivo conecta, ele já recebe o evento de confirmação
  socket.emit('session-ready');

  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(userId);

    // Transmite para todos os outros dispositivos na sala
    socket.to(roomId).emit('user-connected', userId, userNickname);
    io.to(roomId).emit('update-peer-count', roomUsers[roomId].size);

    // Canal unificado do chat de texto
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
  console.log(`> Servidor Unifesp unificado na porta ${PORT}`);
});
