// Preload scripts for Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Core
  ping: () => ipcRenderer.invoke('ping'),
  sendUserInput: (input) => ipcRenderer.invoke('sendUserInput', input),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  minimizeWindow: () => ipcRenderer.send('minimizeWindow'),
  closeWindow: () => ipcRenderer.send('closeWindow'),

  // Streaming response
  onResponseChunk: (callback) => ipcRenderer.on('response-chunk', (_e, chunk) => callback(chunk)),
  onResponseDone: (callback) => ipcRenderer.on('response-done', () => callback()),

  // Commands
  executeCommand: (command) => ipcRenderer.invoke('executeCommand', command),
  launchApplication: (appName) => ipcRenderer.invoke('launchApplication', appName),
  openItem: (target) => ipcRenderer.invoke('openItem', target),

  // Conversation
  resetConversation: () => ipcRenderer.invoke('resetConversation'),

  // TTS
  ttsDownload: () => ipcRenderer.invoke('tts:download'),
  ttsStatus: () => ipcRenderer.invoke('tts:status'),
  ttsSpeak: (text) => ipcRenderer.invoke('tts:speak', text),
  ttsSetVoice: (voice) => ipcRenderer.invoke('tts:setVoice', voice),
  ttsGetVoices: () => ipcRenderer.invoke('tts:voices'),
  ttsGetStatus: () => ipcRenderer.invoke('tts:getStatus'),
  onTtsAudio: (callback) => ipcRenderer.on('tts:audio', (_e, base64) => callback(base64)),
  onTtsStreamAudio: (callback) => ipcRenderer.on('tts:stream-audio', (_e, base64) => callback(base64)),
  onTtsCancel: (callback) => ipcRenderer.on('tts:cancel', () => callback()),

  // Models
  listModels: () => ipcRenderer.invoke('models:list'),
  getCurrentModel: () => ipcRenderer.invoke('models:current'),
  setModel: (opts) => ipcRenderer.invoke('models:set', opts),

  // Local STT
  sttStatus: () => ipcRenderer.invoke('stt:status'),
  sttDownload: () => ipcRenderer.invoke('stt:download'),
  sttTranscribe: (audioBuffer) => ipcRenderer.invoke('stt:transcribe', audioBuffer),

  // Profile
  profileGet: () => ipcRenderer.invoke('profile:get'),
  profileSave: (profile) => ipcRenderer.invoke('profile:save', profile),

  // Workspace
  workspaceGetPath: () => ipcRenderer.invoke('workspace:getPath'),
  workspaceSelectAndSet: () => ipcRenderer.invoke('workspace:selectAndSet'),
  workspaceResetPath: () => ipcRenderer.invoke('workspace:resetPath'),

  // History
  historyList: () => ipcRenderer.invoke('history:list'),
  historyLoad: (sessionId) => ipcRenderer.invoke('history:load', sessionId),
});