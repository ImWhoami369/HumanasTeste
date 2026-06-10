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

enterBtn.addEventListener('click', () => {
  const nameValue = nicknameInput.value.trim();
  if (nameValue === "") {
    alert("Por favor, insira um apelido para entrar.");
    return;
  }
  myNickname = nameValue;

  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  startWebRTC();
});

function startWebRTC() {
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);

    myPeer.on('call', call => {
      call.answer(stream);
      const video = document.createElement('video');
      
      call.on('stream', userVideoStream => {
        const senderName = call.options.metadata?.senderName || "Participante";
        addVideoStream(video, userVideoStream, senderName, call.peer);
      });

      call.on('close', () => {
        video.parentElement.remove();
        recalculateLayout(); // Recalcula quando alguém sai
      });
    });

    socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

    socket.on('user-connected', (userId, userNickname) => {
      connectToNewUser(userId, stream, userNickname);
    });

  }).catch(err => {
    console.error("Erro de mídia:", err);
    alert("Habilite a câmera/microfone nas configurações do navegador.");
  });
}

socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close();
  }
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) {
    containerToRemove.remove();
    recalculateLayout(); // Recalcula quando alguém sai por queda de conexão
  }
});

socket.on('update-peer-count', count => {
  if (participantCount) participantCount.innerText = count;
});

function connectToNewUser(userId, stream, userNickname) {
  const call = myPeer.call(userId, stream, {
    metadata: { senderName: myNickname }
  });
  
  const video = document.createElement('video');
  
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userNickname, userId);
  });
  
  call.on('close', () => {
    const containerToRemove = document.getElementById(`wrapper-${userId}`);
    if (containerToRemove) {
      containerToRemove.remove();
      recalculateLayout();
    }
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
    videoWrapper.id = `wrapper-${userId}`;
  }

  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  videoWrapper.append(video);
  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);

  // Executa o cálculo matemático de mosaico toda vez que entra um vídeo novo
  recalculateLayout();
}

// 📐 Algoritmo Dinâmico de Mosaico (Igual ao algoritmo do Google Meet)
function recalculateLayout() {
  const allVideos = videoGrid.querySelectorAll('.video-wrapper');
  const count = allVideos.length;
  if (!count) return;

  // Pega as dimensões da área disponível
  const containerWidth = videoGrid.offsetWidth;
  const containerHeight = videoGrid.offsetHeight;

  let bestWidth = 0;
  let bestHeight = 0;

  // Testa qual a melhor distribuição de colunas e linhas para ocupar o máximo de tela mantendo a proporção 16:9
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    
    // Calcula largura e altura máximas permitidas para esta combinação de colunas/linhas
    let maxWidth = Math.floor(containerWidth / cols) - 14; // Desconta o gap
    let maxHeight = Math.floor(containerHeight / rows) - 14;

    // Mantém a proporção de cinema (16 por 9)
    if (maxWidth * 9 / 16 < maxHeight) {
      maxHeight = maxWidth * 9 / 16;
    } else {
      maxWidth = maxHeight * 16 / 9;
    }

    if (maxWidth > bestWidth) {
      bestWidth = maxWidth;
      bestHeight = maxHeight;
    }
  }

  // Aplica o tamanho perfeito calculado em todos os vídeos simultaneamente
  allVideos.forEach(wrapper => {
    wrapper.style.width = `${bestWidth}px`;
    wrapper.style.height = `${bestHeight}px`;
  });
}

// Recalcula o mosaico caso o usuário mude o tamanho da janela do navegador ou vire o celular
window.addEventListener('resize', recalculateLayout);

// Controles dos botões Mute e Câmera
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
