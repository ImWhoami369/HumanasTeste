const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const participantCount = document.getElementById('participant-count');

const lobbyContainer = document.getElementById('lobby-container');
const meetingContainer = document.getElementById('meeting-container');
const nicknameInput = document.getElementById('nickname-input');
const enterBtn = document.getElementById('enter-btn');

let myNickname = "Usuário";
let myVideoStream;
const myVideo = document.createElement('video');
myVideo.muted = true; // Evita que você ouça o eco da sua própria voz

// Inicializa o PeerJS configurando os servidores STUN do Google para a internet externa
const myPeer = new Peer(undefined, {
  config: {
    'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'stun:stun1.l.google.com:19302' }
    ]
  }
});

const peers = {};

// Evento ao clicar em Entrar no Lobby
enterBtn.addEventListener('click', () => {
  const nameValue = nicknameInput.value.trim();
  if (nameValue === "") {
    alert("Por favor, insira um apelido para entrar.");
    return;
  }
  myNickname = nameValue;

  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  // Inicia a câmera só após o clique do usuário (Exigência dos navegadores modernos)
  startWebRTC();
});

function startWebRTC() {
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);

    // Responde chamadas recebidas enviando o seu fluxo de vídeo
    myPeer.on('call', call => {
      call.answer(stream);
      const video = document.createElement('video');
      
      call.on('stream', userVideoStream => {
        // Puxa o nome de quem está ligando através dos metadados da chamada
        const senderName = call.options.metadata?.senderName || "Participante";
        addVideoStream(video, userVideoStream, senderName, call.peer);
      });

      call.on('close', () => {
        video.parentElement.remove();
      });
    });

    // Entra na sala informando seu ID único e o seu Apelido
    socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

    // Quando outro usuário se conectar na sala, você liga para ele
    socket.on('user-connected', (userId, userNickname) => {
      connectToNewUser(userId, stream, userNickname);
    });

  }).catch(err => {
    console.error("Erro de mídia:", err);
    alert("Não foi possível acessar a câmera e microfone. Certifique-se de dar permissões no navegador.");
  });
}

// Remove o bloco do usuário que sair
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
  }
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) containerToRemove.remove();
});

// Atualiza o contador de cabeçalho
socket.on('update-peer-count', count => {
  if (participantCount) participantCount.innerText = count;
});

// Função para originar ligações para novos integrantes
function connectToNewUser(userId, stream, userNickname) {
  // Anexa o seu apelido nos metadados antes de fazer a ligação WebRTC
  const call = myPeer.call(userId, stream, {
    metadata: { senderName: myNickname }
  });
  
  const video = document.createElement('video');
  
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userNickname, userId);
  });
  
  call.on('close', () => {
    const containerToRemove = document.getElementById(`wrapper-${userId}`);
    if (containerToRemove) containerToRemove.remove();
  });

  peers[userId] = call;
}

// Renderiza a janela de vídeo conforme as classes CSS
function addVideoStream(video, stream, userName, userId = null) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });

  const videoWrapper = document.createElement('div');
  videoWrapper.classList.add('video-wrapper');
  if(userId) {
    videoWrapper.id = `wrapper-${userId}`;
  }

  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  videoWrapper.append(video);
  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);
}

// Controles dos botões de Mudo e Câmera
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
