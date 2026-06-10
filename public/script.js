const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const participantCount = document.getElementById('participant-count');

// Servidores STUN públicos do Google para garantir o funcionamento fora da rede local (no Render)
const myPeer = new Peer(undefined, {
  config: {
    'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'stun:stun1.l.google.com:19302' }
    ]
  }
});

let myVideoStream;
const myVideo = document.createElement('video');
myVideo.muted = true; // Muta a própria voz para evitar eco local

const peers = {}; // Armazena as chamadas ativas

// Captura de mídia (Câmera e Microfone)
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  
  // Adiciona sua própria câmera na tela com a tag "Você"
  addVideoStream(myVideo, stream, "Você");

  // Atende chamadas recebidas de outros usuários
  myPeer.on('call', call => {
    call.answer(stream); // Responde enviando nossa câmera
    const video = document.createElement('video');
    
    // Quando o vídeo do outro usuário chegar, renderiza na tela
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream, "Participante");
    });

    // Se o outro usuário fechar a chamada
    call.on('close', () => {
      video.parentElement.remove();
    });
  });

  // Escuta quando um novo usuário entra na sala para ligar para ele
  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream);
  });

}).catch(err => {
  console.error("Falha ao acessar dispositivos de mídia:", err);
  alert("Por favor, permita o acesso à câmera e ao microfone para entrar na reunião.");
});

// Remove o bloco do participante que se desconectou
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
  }
});

// Atualiza o contador de participantes na barra superior
socket.on('update-peer-count', count => {
  if (participantCount) {
    participantCount.innerText = count;
  }
});

// Assim que o PeerJS gera seu ID único, você entra na sala padrão
myPeer.on('open', id => {
  socket.emit('join-room', 'unifesp-sala-principal', id);
});

// Função para ligar para os novos usuários da sala
function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, "Participante");
  });
  
  call.on('close', () => {
    video.parentElement.remove();
  });

  peers[userId] = call;
}

// Injeta o elemento de vídeo seguindo a risca a estrutura do CSS Premium
function addVideoStream(video, stream, userName) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });

  // Cria o container do vídeo (.video-wrapper)
  const videoWrapper = document.createElement('div');
  videoWrapper.classList.add('video-wrapper');

  // Cria a etiqueta de texto com o nome do usuário (.user-name)
  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  // Monta a estrutura e adiciona na grade principal
  videoWrapper.append(video);
  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);
}

/* ==========================================================================
   Lógica dos Botões de Controle (Mute / Unmute e Câmera ON/OFF)
   ========================================================================== */

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');

if (micBtn) {
  micBtn.addEventListener('click', () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
      myVideoStream.getAudioTracks()[0].enabled = false;
      micBtn.classList.add('muted');
      micBtn.innerHTML = `<i class="fa-solid fa-microphone-slash"></i>`;
    } else {
      myVideoStream.getAudioTracks()[0].enabled = true;
      micBtn.classList.remove('muted');
      micBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
    }
  });
}

if (camBtn) {
  camBtn.addEventListener('click', () => {
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
      myVideoStream.getVideoTracks()[0].enabled = false;
      camBtn.classList.add('muted');
      camBtn.innerHTML = `<i class="fa-solid fa-video-slash"></i>`;
    } else {
      myVideoStream.getVideoTracks()[0].enabled = true;
      camBtn.classList.remove('muted');
      camBtn.innerHTML = `<i class="fa-solid fa-video"></i>`;
    }
  });
}
