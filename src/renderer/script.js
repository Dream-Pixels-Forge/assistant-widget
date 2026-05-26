// Renderer process — Assistant Widget UI logic

(function () {
  'use strict';

  // ── DOM ──────────────────────────────────────────────────────
  const micBtn = document.getElementById('micBtn');
  const status = document.getElementById('status');
  const conversation = document.getElementById('conversation');
  const textInput = document.getElementById('textInput');
  const sendBtn = document.getElementById('sendBtn');
  const minimizeBtn = document.getElementById('minimizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('date-display');
  const bigTime = document.getElementById('big-time');
  const weatherTemp = document.getElementById('weather-temp');
  const weatherIcon = document.getElementById('weather-icon');

  // ── Waveform Canvas ──────────────────────────────────────────
  const waveformCanvas = document.getElementById('waveform-canvas');
  const wfCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;
  let waveformMode = 'idle'; // 'idle' | 'user' | 'assistant'
  const wfBars = 24;
  const wfHeights = new Float32Array(wfBars);
  let wfAnimId = null;

  function drawWaveform() {
    if (!wfCtx) return;
    const w = waveformCanvas.width;
    const h = waveformCanvas.height;
    wfCtx.clearRect(0, 0, w, h);

    // Smooth heights toward target
    const target = waveformMode === 'idle' ? 0 : 1;
    for (let i = 0; i < wfBars; i++) {
      // Random target each frame when active
      if (waveformMode !== 'idle') {
        const amp = 0.3 + Math.random() * 0.7;
        wfHeights[i] += (amp - wfHeights[i]) * 0.15;
      } else {
        wfHeights[i] *= 0.92; // Decay to zero
      }
    }

    // Pick color
    let color;
    if (waveformMode === 'user') color = { r: 50, g: 220, b: 100 };      // Green
    else if (waveformMode === 'assistant') color = { r: 255, g: 200, b: 50 }; // Yellow
    else color = { r: 255, g: 255, b: 255, a: 0.1 };                     // Dim white

    const barW = (w - 4) / wfBars;
    const mid = h / 2;

    for (let i = 0; i < wfBars; i++) {
      const val = wfHeights[i];
      const barH = Math.max(1, val * (h - 6));
      const x = 2 + i * barW;
      const y = mid - barH / 2;

      if (waveformMode !== 'idle') {
        const alpha = 0.4 + val * 0.6;
        wfCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        wfCtx.fillRect(x, y, Math.max(2, barW - 1), Math.max(2, barH));
      } else {
        // Idle: thin flat line
        wfCtx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        wfCtx.fillRect(x, mid - 0.5, Math.max(1, barW - 1), 1);
      }
    }

    wfAnimId = requestAnimationFrame(drawWaveform);
  }

  // Start animating
  if (wfCtx) drawWaveform();

  // ── Speech Recognition ───────────────────────────────────────
  let recognition = null;
  let isListening = false;
  let shouldRestart = false;
  let interimDisplay = null;
  let restartTimer = null;

  function createInterimDisplay() {
    if (interimDisplay) return;
    interimDisplay = document.createElement('div');
    interimDisplay.className = 'msg interim';
    const body = document.createElement('div');
    body.id = 'interim-text';
    body.textContent = '';
    interimDisplay.appendChild(body);
  }

  function showInterim(text) {
    createInterimDisplay();
    document.getElementById('interim-text').textContent = text || '\u200B';
    if (!interimDisplay.parentNode) {
      conversation.appendChild(interimDisplay);
    }
    conversation.scrollTop = conversation.scrollHeight;
  }

  function hideInterim() {
    if (interimDisplay && interimDisplay.parentNode) {
      interimDisplay.parentNode.removeChild(interimDisplay);
    }
  }

  // Safe start that handles the "already started" error
  function safeStart() {
    try {
      recognition.start();
    } catch (e) {
      // Already started or starting — normal, ignore
    }
  }

  // Schedule a restart after a delay (Web Speech API needs cooldown)
  function scheduleRestart() {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (shouldRestart && !isListening) {
        safeStart();
      }
    }, 150);
  }

  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognitionAPI) {
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('recording');
      status.textContent = 'Listening...';
      status.className = 'active';
      waveformMode = 'user';
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('recording');
      waveformMode = 'idle';
      // Keep listening if user wants
      if (shouldRestart) {
        scheduleRestart();
      } else {
        status.textContent = 'Click to speak';
        status.className = '';
        hideInterim();
      }
    };

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Show what the user is saying in real-time
      if (interim) {
        showInterim(interim);
      }
      if (final) {
        hideInterim();
        addMessage(final, 'user');
        status.textContent = 'Thinking...';
        status.className = 'active';
        waveformMode = 'idle'; // waveform shows thinking via assistant mode
        window.electronAPI.sendUserInput(final);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      // 'no-speech' and 'aborted' are normal — auto-restart handles them
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (shouldRestart) scheduleRestart();
        return;
      }
      status.textContent = event.error === 'not-allowed' ? 'Mic blocked' : 'Try again';
      status.className = '';
      isListening = false;
      shouldRestart = false;
      micBtn.classList.remove('recording');
      hideInterim();
    };
  } else {
    status.textContent = 'Speech not supported';
    micBtn.disabled = true;
  }

  micBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (isListening || shouldRestart) {
      // Stop listening
      shouldRestart = false;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      recognition.stop();
    } else {
      // Start listening
      shouldRestart = true;
      safeStart();
    }
  });

  // ── Text Input ───────────────────────────────────────────────
  function handleSend() {
    const text = textInput.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    textInput.value = '';
    status.textContent = 'Thinking...';
    status.className = 'active';
    window.electronAPI.sendUserInput(text);
  }

  sendBtn.addEventListener('click', handleSend);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ── Conversation Display ─────────────────────────────────────
  function addMessage(text, role) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    const sender = document.createElement('div');
    sender.className = 'sender';
    sender.textContent = role === 'user' ? 'You' : role === 'error' ? 'Error' : 'Assistant';
    el.appendChild(sender);
    const body = document.createElement('div');
    body.textContent = text;
    el.appendChild(body);
    conversation.appendChild(el);
    conversation.scrollTop = conversation.scrollHeight;
  }

  // ── Streaming Response Handling ──────────────────────────────
  let streamingBubble = null;
  let streamingBody = null;
  let fullStreamText = '';

  function startStreamingBubble() {
    waveformMode = 'assistant';
    const el = document.createElement('div');
    el.className = 'msg assistant';
    const sender = document.createElement('div');
    sender.className = 'sender';
    sender.textContent = 'Assistant';
    el.appendChild(sender);
    streamingBody = document.createElement('div');
    streamingBody.textContent = '';
    el.appendChild(streamingBody);
    conversation.appendChild(el);
    streamingBubble = el;
    fullStreamText = '';
  }

  function appendChunk(chunk) {
    if (chunk === '\x00clear_stream') {
      if (streamingBubble && streamingBody) {
        streamingBody.textContent = '';
        fullStreamText = '';
      }
      return;
    }
    if (!streamingBubble) startStreamingBubble();
    fullStreamText += chunk;
    streamingBody.textContent = fullStreamText;
    conversation.scrollTop = conversation.scrollHeight;
  }

  function finishStream() {
    waveformMode = 'idle';
    streamingBubble = null;
    streamingBody = null;
    status.textContent = 'Click to speak';
    status.className = '';
    fullStreamText = '';
  }

  if (window.electronAPI) {
    if (window.electronAPI.onResponseChunk) {
      window.electronAPI.onResponseChunk(appendChunk);
    }
    if (window.electronAPI.onResponseDone) {
      window.electronAPI.onResponseDone(finishStream);
    }
  }

  // ── Kokoro TTS Audio Playback ────────────────────────────────
  let audioContext = null;
  let activeTtsSources = [];

  function stopAllTts() {
    for (const src of activeTtsSources) {
      try { src.stop(); } catch (e) { /* already stopped */ }
    }
    activeTtsSources = [];
  }

  function playTtsAudio(base64Wav) {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const binary = atob(base64Wav);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const audioBuf = bytes.buffer.slice(0);
      audioContext.decodeAudioData(audioBuf, (buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        activeTtsSources.push(source);
        source.onended = () => {
          const idx = activeTtsSources.indexOf(source);
          if (idx !== -1) activeTtsSources.splice(idx, 1);
        };
      }, (err) => {
        console.error('TTS decode error:', err);
      });
    } catch (e) { console.error('TTS playback error:', e); }
  }

  if (window.electronAPI) {
    if (window.electronAPI.onTtsAudio) {
      window.electronAPI.onTtsAudio(playTtsAudio);
    }
    if (window.electronAPI.onTtsStreamAudio) {
      window.electronAPI.onTtsStreamAudio(playTtsAudio);
    }
    if (window.electronAPI.onTtsCancel) {
      window.electronAPI.onTtsCancel(stopAllTts);
    }
  }

  // ── Window Controls ──────────────────────────────────────────
  if (minimizeBtn) minimizeBtn.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.minimizeWindow();
  });
  if (closeBtn) closeBtn.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.closeWindow();
  });

  // ── Big Digital Clock ─────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    bigTime.textContent = h + ':' + m;
  }

  // ── Greeting ─────────────────────────────────────────────────
  function updateGreeting() {
    const now = new Date();
    const h = now.getHours();
    let greeting = 'Hello';
    if (h < 5) greeting = 'Up late';
    else if (h < 12) greeting = 'Good morning';
    else if (h < 17) greeting = 'Good afternoon';
    else if (h < 21) greeting = 'Good evening';
    else greeting = 'Good night';
    greetingEl.textContent = greeting;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }

  // ── Weather ──────────────────────────────────────────────────
  let weatherAttempted = false;

  function fetchWeather() {
    if (weatherAttempted) return;
    weatherAttempted = true;

    fetch('https://wttr.in/?format=j1')
      .then(r => r.json())
      .then(data => {
        const cc = data.current_condition[0];
        weatherTemp.textContent = cc.temp_C + '°';
        weatherIcon.textContent = getWeatherEmoji(cc.weatherCode);
      })
      .catch(() => {
        weatherTemp.textContent = '--°';
      });
  }

  function getWeatherEmoji(code) {
    const c = parseInt(code);
    if (c === 113) return '☀️';
    if (c === 116) return '⛅';
    if (c >= 119 && c <= 122) return '☁️';
    if (c >= 143 && c <= 260) return '🌫️';
    if (c >= 263 && c <= 389) return '🌧️';
    if (c >= 392 && c <= 395) return '⛈️';
    if (c >= 416 && c <= 455) return '❄️';
    if (c >= 500 && c <= 527) return '🌨️';
    return '🌤️';
  }

  // ── Init ─────────────────────────────────────────────────────
  updateClock();
  updateGreeting();
  fetchWeather();

  // Tick clock every second
  setInterval(updateClock, 1000);
  // Refresh greeting every minute
  setInterval(updateGreeting, 60000);

  console.log('Assistant renderer initialized');
  textInput.focus();

  // ── Settings Panel ────────────────────────────────────────────
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsClose = document.getElementById('settings-close');
  const modelSelect = document.getElementById('model-select');
  const codemodelSelect = document.getElementById('codemodel-select');
  const ttsStatus = document.getElementById('tts-status');
  const ttsDownloadBtn = document.getElementById('tts-download-btn');
  const voiceSelect = document.getElementById('voice-select');
  const workspacePath = document.getElementById('workspace-path');
  const workspaceBrowseBtn = document.getElementById('workspace-browse-btn');
  const workspaceSubfolders = document.getElementById('workspace-subfolders');

  let settingsOpen = false;

  function openSettings() {
    settingsOverlay.classList.remove('hidden');
    settingsOpen = true;
    refreshSettings();
    loadProfile();
  }

  function closeSettings() {
    settingsOverlay.classList.add('hidden');
    settingsOpen = false;
  }

  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);

  // Close on overlay click
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  // ── Refresh Settings Data ─────────────────────────────────────
  async function refreshSettings() {
    // List Ollama models
    if (window.electronAPI && window.electronAPI.listModels) {
      try {
        const result = await window.electronAPI.listModels();
        if (result.models && result.models.length) {
          const savedDefault = modelSelect ? modelSelect.value : '';
          const savedCode = codemodelSelect ? codemodelSelect.value : '';
          populateSelect(modelSelect, result.models);
          populateSelect(codemodelSelect, result.models);
          if (result.models.includes(savedDefault)) modelSelect.value = savedDefault;
          if (result.models.includes(savedCode)) codemodelSelect.value = savedCode;
        }
      } catch (e) { /* ignore */ }
    }

    // Get current model (fallback if saved values weren't available)
    if (window.electronAPI && window.electronAPI.getCurrentModel) {
      try {
        const cur = await window.electronAPI.getCurrentModel();
        if (modelSelect && !modelSelect.value) modelSelect.value = cur.defaultModel || '';
        if (codemodelSelect && !codemodelSelect.value) codemodelSelect.value = cur.codeModel || '';
      } catch (e) { /* ignore */ }
    }

    // TTS status
    if (window.electronAPI && window.electronAPI.ttsGetStatus) {
      try {
        const st = await window.electronAPI.ttsGetStatus();
        ttsStatus.textContent = st.modelDownloaded
          ? '✅ Model downloaded'
          : '⬇️ Model not downloaded yet';
        ttsDownloadBtn.disabled = st.modelDownloaded;
        ttsDownloadBtn.textContent = st.modelDownloaded
          ? 'Model Ready ✓'
          : 'Download TTS Model (~80MB)';
      } catch (e) { /* ignore */ }
    }

    // TTS voices
    if (window.electronAPI && window.electronAPI.ttsGetVoices) {
      try {
        const v = await window.electronAPI.ttsGetVoices();
        if (v.voices && v.voices.length) {
          const currentVoice = voiceSelect.value;
          voiceSelect.innerHTML = v.voices.map(vv =>
            `<option value="${vv.id}">${vv.name}</option>`
          ).join('');
          if (currentVoice) voiceSelect.value = currentVoice;
        }
      } catch (e) { /* ignore */ }
    }

    // Restore all saved settings from backend
    if (window.electronAPI && window.electronAPI.getAllSettings) {
      try {
        const all = await window.electronAPI.getAllSettings();
        if (all.textToSpeech && all.textToSpeech.voice && voiceSelect) {
          if (voiceSelect.querySelector(`option[value="${all.textToSpeech.voice}"]`)) {
            voiceSelect.value = all.textToSpeech.voice;
          }
        }
      } catch (e) { /* ignore */ }
    }

    await refreshSttStatus();
    await refreshWorkspaceInfo();
  }

  function populateSelect(sel, items) {
    sel.innerHTML = items.map(m =>
      `<option value="${m}">${m}</option>`
    ).join('');
  }

  // Model selection change
  if (modelSelect) modelSelect.addEventListener('change', async () => {
    if (window.electronAPI.setModel) {
      await window.electronAPI.setModel({ defaultModel: modelSelect.value });
    }
  });

  if (codemodelSelect) codemodelSelect.addEventListener('change', async () => {
    if (window.electronAPI.setModel) {
      await window.electronAPI.setModel({ codeModel: codemodelSelect.value });
    }
  });

  // TTS download
  if (ttsDownloadBtn) ttsDownloadBtn.addEventListener('click', async () => {
    ttsDownloadBtn.disabled = true;
    ttsDownloadBtn.textContent = 'Downloading...';
    ttsStatus.textContent = '⏳ Downloading TTS model (~80MB)...';
    try {
      if (window.electronAPI.ttsDownload) {
        const ok = await window.electronAPI.ttsDownload();
        if (ok) {
          ttsStatus.textContent = '✅ Model ready!';
          ttsDownloadBtn.textContent = 'Ready ✓';
        } else {
          ttsStatus.textContent = '❌ Download failed';
          ttsDownloadBtn.disabled = false;
          ttsDownloadBtn.textContent = 'Retry Download';
        }
      }
    } catch (e) {
      ttsStatus.textContent = '❌ Error: ' + e.message;
      ttsDownloadBtn.disabled = false;
      ttsDownloadBtn.textContent = 'Retry Download';
    }
  });

  // Voice selection change
  if (voiceSelect) voiceSelect.addEventListener('change', async () => {
    if (window.electronAPI.ttsSetVoice) {
      await window.electronAPI.ttsSetVoice(voiceSelect.value);
    }
  });

  // ── Settings Tab Switching ───────────────────────────────────
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // ── Profile ──────────────────────────────────────────────────
  const profileName = document.getElementById('profile-name');
  const profileRole = document.getElementById('profile-role');
  const profilePersona = document.getElementById('profile-persona');
  const profileContext = document.getElementById('profile-context');
  const profileSaveBtn = document.getElementById('profile-save-btn');
  const profileStatus = document.getElementById('profile-status');

  async function loadProfile() {
    if (!window.electronAPI.profileGet) return;
    try {
      const p = await window.electronAPI.profileGet();
      if (profileName) profileName.value = p.userName || '';
      if (profileRole) profileRole.value = p.userRole || '';
      if (profilePersona) profilePersona.value = p.persona || 'You are a helpful AI assistant. Be concise, warm, and practical.';
      if (profileContext) profileContext.value = p.context || '';
    } catch (e) { /* ignore */ }
  }

  // Save profile
  if (profileSaveBtn) profileSaveBtn.addEventListener('click', async () => {
    const profile = {
      userName: profileName ? profileName.value.trim() : '',
      userRole: profileRole ? profileRole.value.trim() : '',
      persona: profilePersona ? profilePersona.value.trim() : '',
      context: profileContext ? profileContext.value.trim() : '',
    };
    try {
      await window.electronAPI.profileSave(profile);
      if (profileStatus) {
        profileStatus.style.display = 'block';
        setTimeout(() => { profileStatus.style.display = 'none'; }, 2000);
      }
    } catch (e) { /* ignore */ }
  });

  // ── STT Settings ──────────────────────────────────────────────
  const sttMode = document.getElementById('stt-mode');
  const sttStatus = document.getElementById('stt-status');
  const sttDownloadBtn = document.getElementById('stt-download-btn');
  let localSttEnabled = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  // Init local STT mode from saved preference
  const savedSttMode = localStorage.getItem('stt-mode') || 'browser';
  if (sttMode) sttMode.value = savedSttMode;
  localSttEnabled = savedSttMode === 'local';

  // STT mode toggle
  if (sttMode) sttMode.addEventListener('change', async () => {
    localSttEnabled = sttMode.value === 'local';
    localStorage.setItem('stt-mode', sttMode.value);
    if (sttMode.value === 'local') {
      const st = await window.electronAPI.sttStatus();
      sttStatus.textContent = st.modelDownloaded
        ? '✅ Whisper ready'
        : '⬇️ Download Whisper model first';
      sttDownloadBtn.disabled = st.modelDownloaded;
    } else {
      sttStatus.textContent = 'Using browser Web Speech API';
    }
  });

  // Refresh STT status
  async function refreshSttStatus() {
    if (!sttStatus) return;
    if (localSttEnabled) {
      try {
        const st = await window.electronAPI.sttStatus();
        sttStatus.textContent = st.modelDownloaded
          ? '✅ Whisper ready'
          : '⬇️ Download Whisper model';
        sttDownloadBtn.disabled = st.modelDownloaded;
      } catch (e) {
        sttStatus.textContent = 'Local STT unavailable';
      }
    } else {
      sttStatus.textContent = 'Using browser Web Speech API';
    }
  }

  // STT download button
  if (sttDownloadBtn) sttDownloadBtn.addEventListener('click', async () => {
    sttDownloadBtn.disabled = true;
    sttDownloadBtn.textContent = 'Downloading...';
    sttStatus.textContent = '⏳ Downloading Whisper (~151MB)...';
    try {
      const ok = await window.electronAPI.sttDownload();
      if (ok) {
        sttStatus.textContent = '✅ Whisper ready!';
        sttDownloadBtn.textContent = 'Ready ✓';
      } else {
        sttStatus.textContent = '❌ Download failed';
        sttDownloadBtn.disabled = false;
        sttDownloadBtn.textContent = 'Retry';
      }
    } catch (e) {
      sttStatus.textContent = '❌ Error: ' + e.message;
      sttDownloadBtn.disabled = false;
      sttDownloadBtn.textContent = 'Retry';
    }
  });

  // ── Workspace ────────────────────────────────────────────────

  const SUBFOLDER_NAMES = ['goal', 'wiki', 'projects', 'memory', 'skills', 'prompt'];

  function renderSubfolderTags(subfolders) {
    if (!workspaceSubfolders) return;
    workspaceSubfolders.innerHTML = subfolders.map(name =>
      `<span class="sf-tag${name === 'prompt' ? ' optional' : ''}">${name}</span>`
    ).join('');
  }

  async function refreshWorkspaceInfo() {
    if (!window.electronAPI.workspaceGetPath) return;
    try {
      const info = await window.electronAPI.workspaceGetPath();
      if (workspacePath) workspacePath.value = info.path;
      renderSubfolderTags(info.subfolders || SUBFOLDER_NAMES);
    } catch (e) { /* ignore */ }
  }

  if (workspaceBrowseBtn) workspaceBrowseBtn.addEventListener('click', async () => {
    if (!window.electronAPI.workspaceSelectAndSet) return;
    workspaceBrowseBtn.disabled = true;
    workspaceBrowseBtn.textContent = 'Selecting...';
    try {
      const result = await window.electronAPI.workspaceSelectAndSet();
      if (result.success && workspacePath) {
        workspacePath.value = result.path;
        renderSubfolderTags(result.subfolders || SUBFOLDER_NAMES);
      }
    } catch (e) { /* ignore */ }
    workspaceBrowseBtn.disabled = false;
    workspaceBrowseBtn.textContent = 'Browse';
  });

  // ── Local STT Recording (MediaRecorder) ──────────────────────
  function startLocalRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm' : 'audio/webm;codecs=opus'
        });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach(t => t.stop());
          isRecording = false;
          micBtn.classList.remove('recording');

          if (audioChunks.length === 0) return;

          status.textContent = 'Transcribing...';
          status.className = 'active';

          // Convert recorded audio to WAV and send to main process
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();

          try {
            const result = await window.electronAPI.sttTranscribe(arrayBuffer);
            if (result.success && result.text.trim()) {
              hideInterim();
              addMessage(result.text, 'user');
              status.textContent = 'Thinking...';
              window.electronAPI.sendUserInput(result.text);
            } else if (!result.success) {
              status.textContent = 'STT error: ' + (result.error || 'unknown');
            }
          } catch (e) {
            status.textContent = 'STT error';
          }
        };
        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('recording');
        status.textContent = 'Recording...';
        status.className = 'active';
        waveformMode = 'user';
      })
      .catch((err) => {
        status.textContent = 'Mic blocked';
        console.error('Mic error:', err);
      });
  }

  function stopLocalRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  // Override mic click to support local STT
  const originalMicHandler = micBtn._listeners ? true : false;
  // We'll just add logic to the existing click handler
  // The micBtn click event is already bound above
  // Let's wrap it: if localSttEnabled, use MediaRecorder instead

  micBtn.addEventListener('click', function micHandler(e) {
    if (localSttEnabled && window.electronAPI && window.electronAPI.sttTranscribe) {
      e.stopImmediatePropagation();
      if (isRecording) {
        stopLocalRecording();
      } else {
        startLocalRecording();
      }
    }
    // else: original Web Speech handler takes over
  }, true); // Use capture phase to intercept before the original handler

})();