const express = require('express');
const app = express();
const server = require('http').Server(app);
const { ExpressPeerServer } = require('peer');

// 🚨 COMPATIBILIDADE MÁXIMA RENDER: Força a estabilização do túnel WebSocket
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'] // Permite fallback seguro se a rede do celular oscilar
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
  console.log('Novo dispositivo tentando conectar...');

  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;

    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(userId);

    console.log(`> ${userNickname} entrou na sala. Total: ${roomUsers[roomId].size}`);

    // Sincroniza imediatamente com quem acabou de entrar e com os antigos
    socket.to(roomId).emit('user-connected', userId, userNickname);
    io.to(roomId).emit('update-peer-count', roomUsers[roomId].size);

    // Ouvinte do Chat (Global para a Sala)
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
        console.log(`< Alguém saiu. Total restante: ${roomUsers[roomId].size}`);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`> Servidor Unifesp 3.0 rodando na porta ${PORT}`);
});
