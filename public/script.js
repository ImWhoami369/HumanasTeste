// Conecta usando o endpoint relativo padrão, permitindo que o Render gerencie os cabeçalhos HTTP
const socket = io();

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

// Inicializa o Peer mapeando a URL exata em que o app está rodando (seja PC ou celular)
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: location.hostname,
  port: location.port || (location.protocol === 'https:' ? 443 : 80),
  secure: location.protocol === 'https:'
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
    video: { width: 480, height: 270, frameRate: 15 }, // Resolução leve para rodar liso em redes móveis/4G
    audio: true
  }).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream, `${myNickname} (Você)`);
    inicializarConexoes();
  }).catch(err => {
    console.log("Sem hardware de mídia detectado. Modo texto ativo.");
    addVideoStream(null, null, `${myNickname} (Você)`);
    inicializarConexoes();
  });
}

function inicializarConexoes() {
  myPeer.on('call', call => {
    call.answer(myVideoStream);
    const video = document.createElement('video');
    
    call.on('stream', userVideoStream => {
      const senderName = call.options.metadata?.senderName || "Participante";
      addVideoStream(video, userVideoStream, senderName, call.peer);
    });
    call.on('close', () => { removerVideoDaTela(call.peer); });
    peers[call.peer] = call;
  });

  // Avisa o servidor da nossa entrada
  socket.emit('join-room', 'unifesp-sala-principal', myPeer.id, myNickname);

  socket.on('user-connected', (userId, userNickname) => {
    setTimeout(() => {
      connectToNewUser(userId, userNickname);
    }, 1200); // Delay sutil para celulares processarem o handshake WebRTC externo
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

  if (video && stream) {
    video.srcObject = stream;
    video.classList.add('user-video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.addEventListener('loadedmetadata', () => { video.play().catch(e => console.log(e)); });
    videoWrapper.append(video);
  } else {
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

// INTERAÇÃO DO CHAT DE TEXTO
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const chatBoxBtn = document.getElementById('chat-box-btn');
const chatContainer = document.getElementById('chat-container');
const closeChatBtn = document.getElementById('close-chat-btn');

function dispararMensagem() {
  const mensagem = chatInput.value.trim();
  if (mensagem !== "") {
    socket.emit('send-chat-message', mensagem);
    chatInput.value = "";
  }
}

if (sendBtn) sendBtn.addEventListener('click', dispararMensagem);
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dispararMensagem();
  });
}

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
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

if (chatBoxBtn) {
  chatBoxBtn.addEventListener('click', () => {
    chatContainer.classList.toggle('open');
    if(window.innerWidth <= 768) {
      chatContainer.style.display = chatContainer.classList.contains('open') ? 'flex' : 'none';
    }
  });
}

if (closeChatBtn) {
  closeChatBtn.addEventListener('click', () => {
    chatContainer.classList.remove('open');
    chatContainer.style.display = 'none';
  });
}

// Botões de mudo
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
