const express = require('express');
const app = express();
const server = require('http').Server(app);

// Configuração do Socket.io com suporte total a CORS para evitar bloqueios no Render
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve os arquivos da pasta 'public' (index.html, script.js, etc.)
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Gerenciador de Salas e Conexões
io.on('connection', (socket) => {
  
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    
    // Avisa os outros usuários da sala que você entrou
    socket.to(roomId).emit('user-connected', userId);

    // Atualiza a contagem de pessoas na sala atual
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;
    io.in(roomId).emit('update-peer-count', numClients);

    // Evento disparado quando o usuário sai ou fecha a aba
    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
      
      // Atualiza a contagem após a saída
      const remainingClients = io.sockets.adapter.rooms.get(roomId);
      const currentCount = remainingClients ? remainingClients.size : 0;
      io.in(roomId).emit('update-peer-count', currentCount);
    });
  });
});

server.listen(PORT, () => {
  console.log(`> Servidor Unifesp 3.0 rodando na porta ${PORT}`);
});