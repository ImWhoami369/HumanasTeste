// 🚨 TRAVA DO WEBSOCKET: Configuração mandatória para que o Render junte as salas
const socket = io('/', {
  transports: ['websocket']
});

const videoGrid = document.getElementById('video-grid');
const participantCount = document.getElementById('participant-count');
const lobbyContainer = document.getElementById('lobby-container');
const meetingContainer = document.getElementById('meeting-container');
const nicknameInput = document.getElementById('nickname-input');
const enterBtn = document.getElementById('enter-btn');

let myNickname = "Usuário";
let myVideoStream = null;
const myVideo = document.createElement('video');
myVideo.muted = true; 

// Conexão via servidor em nuvem redundante do PeerJS
const myPeer = new Peer(undefined, {
  host: 'peerjs-server.herokuapp.com',
  secure: true,
  port: 443,
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
    alert("Digite seu nome!");
    return;
  }
  myNickname = nameValue;

  lobbyContainer.style.style.setProperty('display', 'none', 'important');
  lobbyContainer.style.display = 'none';
  meetingContainer.style.display = 'flex';

  startWebRTC();
});

function startWebRTC() {
  // Tenta capturar câmera e áudio
  navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 360 },
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);
    inicializarEventosPeerESocket();
  }).catch(err => {
    console.log("Dispositivo sem hardware de mídia (Webcam/Mic). Entrando apenas em modo de texto/escuta.");
    
    // 💡 SUPORTE PARA PC SEM WEBCAM: Cria uma janela preta elegante com as suas iniciais
    addVideoStream(null, null, `${myNickname} (Você)`);
    inicializarEventosPeerESocket();
  });
}

function inicializarEventosPeerESocket() {
  // Atende ligações de terceiros se você tiver câmera ativa
  myPeer.on('call', call => {
    call.answer(myVideoStream); // Se myVideoStream for null, ele responde sem stream de volta (normal)
    const video = document.createElement('video');
    
    call.on('stream', userVideoStream => {
      const senderName = call.options.metadata?.senderName || "Participante";
      addVideoStream(video, userVideoStream, senderName, call.peer);
    });
    call.on('close', () => { removerVideoDaTela(call.peer); });
    peers[call.peer] = call;
  });

  // Notifica o servidor imediatamente
  socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

  // Conecta ao novo integrante assim que ele entra
  socket.on('user-connected', (userId, userNickname) => {
    setTimeout(() => {
      connectToNewUser(userId, userNickname);
    }, 1000);
  });
}

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close();
  removerVideoDaTela(userId);
});

socket.on('update-peer-count', count => {
  if (participantCount) participantCount.innerText = count;
});

function connectToNewUser(userId, userNickname) {
  // Origina a chamada passando a nossa mídia (pode ser null se o PC não tiver câmera)
  const call = myPeer.call(userId, myVideoStream, {
    metadata: { senderName: myNickname }
  });
  
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, userNickname, userId);
  });
  call.on('close', () => { removerVideoDaTela(userId); });

  peers[userId] = call;
}

function addVideoStream(video, stream, userName, userId = null) {
  if (userId && document.getElementById(`wrapper-${userId}`)) return;

  const videoWrapper = document.createElement('div');
  videoWrapper.classList.add('video-wrapper');
  if(userId) videoWrapper.id = `wrapper-${userId}`;

  // Se houver sinal de vídeo/stream (Aparelho possui câmera)
  if (video && stream) {
    video.srcObject = stream;
    video.classList.add('user-video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.addEventListener('loadedmetadata', () => { video.play(); });
    videoWrapper.append(video);
  } else {
    // Se não houver câmera (Caso do seu PC de testes), gera caixa de texto com iniciais
    const placeholder = document.createElement('div');
    placeholder.classList.add('no-cam-placeholder');
    placeholder.innerText = userName.substring(0, 2).toUpperCase();
    videoWrapper.append(placeholder);
  }

  const nameLabel = document.createElement('div');
  nameLabel.classList.add('user-name');
  nameLabel.innerText = userName;

  videoWrapper.append(nameLabel);
  videoGrid.append(videoWrapper);
}

function removerVideoDaTela(userId) {
  const containerToRemove = document.getElementById(`wrapper-${userId}`);
  if (containerToRemove) containerToRemove.remove();
}

// 💬 ENGENHARIA DO CHAT DE TEXTO (SOCKET.IO)
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const chatBoxBtn = document.getElementById('chat-box-btn');
const chatContainer = document.getElementById('chat-container');

function dispararMensagem() {
  const mensagem = chatInput.value.trim();
  if (mensagem !== "") {
    socket.emit('send-chat-message', mensagem);
    chatInput.value = "";
  }
}

sendBtn.addEventListener('click', dispararMensagem);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dispararMensagem();
});

// Printa a mensagem na tela de todo mundo de forma instantânea
socket.on('chat-message', dados => {
  const msgBox = document.createElement('div');
  msgBox.classList.add('message-box');
  
  const autor = document.createElement('div');
  autor.classList.add('author');
  autor.innerText = dados.name;

  const texto = document.createElement('div');
  texto.classList.add('text');
  texto.innerText = dados.msg;

  msgBox.append(autor);
  msgBox.append(texto);
  chatMessages.append(msgBox);

  // Faz o scroll descer automaticamente para a última mensagem enviada
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Abre e fecha o chat lateral no celular
chatBoxBtn.addEventListener('click', () => {
  chatContainer.classList.toggle('open');
});

// Controles mutar áudio e vídeo
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if(!myVideoStream) return;
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    myVideoStream.getAudioTracks()[0].enabled = !enabled;
    micBtn.classList.toggle('muted', enabled);
    micBtn.innerHTML = enabled ? `<i class="fa-solid fa-microphone-slash"></i>` : `<i class="fa-solid fa-microphone"></i>`;
  });
}

if (camBtn) {
  camBtn.addEventListener('click', () => {
    if(!myVideoStream) return;
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    myVideoStream.getVideoTracks()[0].enabled = !enabled;
    camBtn.classList.toggle('muted', enabled);
    camBtn.innerHTML = enabled ? `<i class="fa-solid fa-video-slash"></i>` : `<i class="fa-solid fa-video"></i>`;
  });
}
