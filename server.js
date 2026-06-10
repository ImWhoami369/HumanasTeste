const express = require('express');
const app = express();
const server = require('http').Server(app);

// Configuração do Socket.io com suporte total a CORS para o Render
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Configura a pasta pública de arquivos estáticos
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Gerenciador de conexões do Socket.io
io.on('connection', (socket) => {
  
  // Recebe o ID do Peer e o Apelido do usuário
  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    
    // Avisa os outros usuários da sala quem entrou e qual o seu apelido
    socket.to(roomId).emit('user-connected', userId, userNickname);

    // Atualiza o contador de participantes
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;
    io.in(roomId).emit('update-peer-count', numClients);

    // Trata a desconexão do usuário
    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
      
      const remainingClients = io.sockets.adapter.rooms.get(roomId);
      const currentCount = remainingClients ? remainingClients.size : 0;
      io.in(roomId).emit('update-peer-count', currentCount);
    });
  });
});

server.listen(PORT, () => {
  console.log(`> Servidor Unifesp 3.0 rodando na porta ${PORT}`);
});
