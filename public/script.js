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
myVideo.muted = true; 

const myPeer = new Peer(undefined, {
  config: {
    'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'stun:stun1.l.google.com:19302' }
    ]
  }
});

const peers = {};

// Escuta o clique para entrar na reunião
enterBtn.addEventListener('click', () => {
  const nameValue = nicknameInput.value.trim();
  if (nameValue === "") {
    alert("Por favor, insira um apelido para entrar.");
    return;
  }
  myNickname = nameValue;

  // Esconde o lobby e mostra a reunião
  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  // Inicializa o WebRTC após o clique (Evita bloqueios automáticos do navegador)
  startWebRTC();
});

function startWebRTC() {
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);

    // Atende chamadas e escuta os dados extras (como o nome do outro participante)
    myPeer.on('call', call => {
      // Respondemos enviando nossa câmera
      call.answer(stream);
      const video = document.createElement('video');
      
      // O PeerJS puro não envia strings nativamente no 'call', então usamos um truque simples:
      // Quando o stream remoto chegar, o socket atualizará os metadados do nome.
      call.on('stream', userVideoStream => {
        // Busca se existe algum nome atrelado a esse peer que veio do socket
        const senderName = call.options.metadata?.senderName || "Participante";
        addVideoStream(video, userVideoStream, senderName, call.peer);
      });

      call.on('close', () => {
        video.parentElement.remove();
      });
    });

    // Avisa o servidor que estamos prontos e envia o nosso Nickname
    socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

    socket.on('user-connected', (userId, userNickname) => {
      // Conecta ao novo usuário passando o nosso nome nos metadados da ligação
      connectToNewUser(userId, stream, userNickname);
    });

  }).catch(err => {
    console.error("Erro de mídia:", err);
    alert("Não foi possível acessar sua câmera/microfone. Verifique se deu permissão no seu navegador ou se outro app (como Teams/Zoom) já não está usando ela.");
  });
}

// Quando alguém sai, fecha o vídeo correspondente
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
  }
  // Remove pelo ID do container do peer
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) containerToRemove.remove();
});

socket.on('update-peer-count', count => {
  if (participantCount) participantCount.innerText = count;
});

function connectToNewUser(userId, stream, userNickname) {
  // Passa nosso nome no metadata para que a outra ponta saiba quem está ligando
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

function addVideoStream(video, stream, userName, userId = null) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });

  const videoWrapper = document.createElement('div');
  videoWrapper.classList.add('video-wrapper');
  if(userId) {
    videoWrapper.id = `wrapper-${userId}`; // Atribui ID para remoção limpa
  }

  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  videoWrapper.append(video);
  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);
}

// Controles de Mudo e Câmera
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
