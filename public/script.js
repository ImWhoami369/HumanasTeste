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

// 🚀 SOLUÇÃO DA CONEXÃO EXTERNA: Conectando à nuvem global pública do PeerJS
// Isso permite que dispositivos em redes totalmente diferentes (4G, Wi-Fi externos) se vejam.
const myPeer = new Peer(undefined, {
  host: 'peerjs-server.herokuapp.com',
  secure: true,
  port: 443,
  config: {
    'iceServers': [
      { url: 'stun:stun.l.google.com:19302' },
      { url: 'stun:stun1.l.google.com:19302' },
      { url: 'stun:stun2.l.google.com:19302' },
      { url: 'stun:stun3.l.google.com:19302' },
      { url: 'stun:stun4.l.google.com:19302' }
    ]
  }
});

const peers = {};

enterBtn.addEventListener('click', () => {
  const nameValue = nicknameInput.value.trim();
  if (nameValue === "") {
    alert("Por favor, digite seu nome!");
    return;
  }
  myNickname = nameValue;

  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  // Abre a câmera primeiro, depois conecta à rede
  startWebRTC();
});

function startWebRTC() {
  navigator.mediaDevices.getUserMedia({
    video: { 
      width: { ideal: 640 }, 
      height: { ideal: 360 }, 
      frameRate: { ideal: 20 } 
    },
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    
    // Adiciona o seu próprio vídeo na tela em formato de janela do Meet
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);

    // Escuta chamadas de outras pessoas que entrarem depois
    myPeer.on('call', call => {
      call.answer(stream); // Responde enviando o seu vídeo
      
      const video = document.createElement('video');
      call.on('stream', userVideoStream => {
        const senderName = call.options.metadata?.senderName || "Participante";
        addVideoStream(video, userVideoStream, senderName, call.peer);
      });

      call.on('close', () => {
        removerVideoDaTela(call.peer);
      });

      peers[call.peer] = call;
    });

    // Envia o aviso ao servidor de que você entrou na sala
    socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

    // Quando o servidor avisar que outro participante entrou, nós ligamos para ele
    socket.on('user-connected', (userId, userNickname) => {
      // Pequeno delay para garantir que a porta do outro dispositivo está aberta para receber chamadas
      setTimeout(() => {
        connectToNewUser(userId, stream, userNickname);
      }, 800);
    });

  }).catch(err => {
    console.error("Erro ao acessar mídia: ", err);
    alert("Atenção: Ative as permissões de Câmera e Microfone no seu navegador/celular para participar.");
  });
}

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
  removerVideoDaTela(userId);
});

socket.on('update-peer-count', count => {
  if (participantCount) participantCount.innerText = count;
});

// Realiza a ligação para os novos integrantes que aparecem na sala
function connectToNewUser(userId, stream, userNickname) {
  const call = myPeer.call(userId, stream, {
    metadata: { senderName: myNickname }
  });
  
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userNickname, userId);
  });
  
  call.on('close', () => {
    removerVideoDaTela(userId);
  });

  peers[userId] = call;
}

// Cria e renderiza as janelinhas dinâmicas
function addVideoStream(video, stream, userName, userId = null) {
  // Evita duplicar a janela se o evento disparar duas vezes por oscilação de rede
  if (userId && document.getElementById(`wrapper-${userId}`)) return;

  video.srcObject = stream;
  video.classList.add('user-video');
  
  // Trava os reprodutores nativos do Safari (iOS) e Chrome (Android) para rodar embutido
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('autoplay', 'true');

  video.addEventListener('loadedmetadata', () => {
    video.play().catch(err => console.log("Play automático aguardando interação", err));
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

function removerVideoDaTela(userId) {
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) containerToRemove.remove();
}

// Controles de áudio e vídeo
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
