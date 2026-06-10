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

// Servidores STUN públicos e estáveis do Google
const myPeer = new Peer(undefined, {
  config: {
    'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'stun:stun1.l.google.com:19302' },
      { url: 'stun:stun2.l.google.com:19302' }
    ]
  }
});

const peers = {};

enterBtn.addEventListener('click', () => {
  const nameValue = nicknameInput.value.trim();
  if (nameValue === "") {
    alert("Digite seu nome!");
    return;
  }
  myNickname = nameValue;

  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  startWebRTC();
});

function startWebRTC() {
  navigator.mediaDevices.getUserMedia({
    video: { width: { max: 640 }, height: { max: 480 }, frameRate: { max: 24 } }, // Resolução otimizada para conexões externas não caírem
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

      call.on('close', () => { video.parentElement.remove(); });
    });

    // 🚨 O PULO DO GATO PARA CONEXÕES EXTERNAS:
    // Damos um pequeno delay de 600ms antes de avisar o servidor.
    // Isso garante que o hardware de câmera do celular terminou de ligar antes de receber chamadas externas.
    setTimeout(() => {
      socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);
    }, 600);

    socket.on('user-connected', (userId, userNickname) => {
      // Pequeno atraso estratégico para dar tempo do outro dispositivo aceitar a oferta ICE
      setTimeout(() => {
        connectToNewUser(userId, stream, userNickname);
      }, 400);
    });

  }).catch(err => {
    console.error(err);
    alert("Erro ao abrir câmera. Verifique as permissões de privacidade do seu celular.");
  });
}

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) containerToRemove.remove();
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
    if (containerToRemove) containerToRemove.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream, userName, userId = null) {
  video.srcObject = stream;
  video.classList.add('user-video');
  
  // 🚨 CRUCIAL PARA CELULAR: Esses 3 atributos impedem que o iOS e Android abram o vídeo em pop-up/tela cheia
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('autoplay', 'true');

  video.addEventListener('loadedmetadata', () => {
    video.play().catch(e => console.log("Play automático evitado, aguardando clique", e));
  });

  const videoWrapper = document.createElement('div');
  videoWrapper.classList.add('video-wrapper');
  if(userId) videoWrapper.id = `wrapper-${userId}`;

  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  videoWrapper.append(video);
  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);
}

// Botões de controle
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
