const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Lista para monitorar conexões ativas na sala
let activeUsers = new Set();

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId, userNickname) => {
    socket.join(roomId);
    socket.userId = userId;
    activeUsers.add(userId);

    // Envia sinal para todos os outros aparelhos conectarem ao novo usuário
    socket.to(roomId).emit('user-connected', userId, userNickname);
    io.to(roomId).emit('update-peer-count', activeUsers.size);

    socket.on('disconnect', () => {
      activeUsers.delete(socket.userId);
      socket.to(roomId).emit('user-disconnected', socket.userId);
      io.to(roomId).emit('update-peer-count', activeUsers.size);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}`);
});
