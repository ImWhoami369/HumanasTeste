const express = require('express');
const app = express();
const server = require('http').Server(app);

// 🚨 CORREÇÃO CRÍTICA PARA O RENDER: Libera CORS e força o protocolo WebSocket puro
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket'] 
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Monitora quem está realmente conectado na sala
let roomUsers = {};

io.on('connection', socket => {
  
  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;
    socket.nickname = userNickname;

    // Guarda o usuário na lista da sala
    if (!roomUsers[roomId]) roomUsers[roomId] = new Set();
    roomUsers[roomId].add(userId);

    // Avisa explicitamente TODOS os aparelhos na sala sobre o novo integrante
    socket.to(roomId).emit('user-connected', userId, userNickname);
    
    // Atualiza a contagem exata para todos na sala
    io.to(roomId).emit('update-peer-count', roomUsers[roomId].size);

    // Escuta mensagens enviadas no chat de texto e repassa para a sala
    socket.on('send-chat-message', (message) => {
      io.to(roomId).emit('chat-message', {
        name: userNickname,
        msg: message
      });
    });

    // Gerencia a saída ou fechamento de aba de qualquer aparelho
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
  console.log(`> Sala Unifesp unificada na porta ${PORT}`);
});
