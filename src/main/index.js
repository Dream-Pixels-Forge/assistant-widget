const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const aiService = require('./aiService');
const workspaceTools = require('./workspaceTools');
const commandService = require('./commandService');
const platformService = require('./platformService');
const ttsService = require('./ttsService');
const streamingTts = require('./streamingTts');
const localStt = require('./localSttService');
const historyService = require('./historyService');
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 460,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools only when explicitly asked (HERMES_DEVTOOLS=1)
  if (process.env.HERMES_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }

  // Initialize platform services after window is created
  platformService.initialize(mainWindow);

  // Handle window close event (minimize instead of close on macOS)
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    } else {
      mainWindow = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Wire streaming TTS audio back to renderer
  streamingTts.setOnAudio((base64) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('tts:stream-audio', base64);
    }
  });

  // Initialize all persisted settings
  const settingsService = require('./settingsService');

  // Restore workspace path
  const savedPath = settingsService.get('workspace.path');
  if (savedPath) {
    workspaceTools.setRootPath(savedPath);
  }
  workspaceTools.ensureSubfolders();

  // Restore AI models
  const defaultModel = settingsService.get('ai.model');
  const codeModel = settingsService.get('ai.codeModel');
  if (defaultModel && defaultModel !== 'local') aiService.defaultModel = defaultModel;
  if (codeModel && codeModel !== 'local') aiService.codeModel = codeModel;

  // Restore TTS voice
  const ttsVoice = settingsService.get('textToSpeech.voice');
  if (ttsVoice) ttsService.setVoice(ttsVoice);

  // Restore profile persona
  const profile = loadProfile();
  if (profile.persona) aiService.setPersona(profile.persona);
  if (profile.userName || profile.userRole || profile.context) {
    aiService.setUserContext(profile.userName || '', profile.userRole || '', profile.context || '');
  }

  // Initialize history service with history directory
  const historyDir = path.join(workspaceTools.getRootPath(), 'history');
  historyService.setHistoryDir(historyDir);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── IPC Handlers ──────────────────────────────────────────────────────────

// Simple ping
ipcMain.handle('ping', () => 'pong');

// Get all persisted settings
ipcMain.handle('settings:getAll', async () => {
  const settingsService = require('./settingsService');
  return settingsService.settings;
});

// Send user input to AI service — streamed response + streaming TTS
ipcMain.handle('sendUserInput', async (event, input) => {
  if (!mainWindow || !mainWindow.webContents) return;
  try {
    streamingTts.start().catch(() => {});
    await aiService.getResponseStream(input, (chunk) => {
      mainWindow.webContents.send('response-chunk', chunk);
      streamingTts.feed(chunk);
    });
    await streamingTts.flush();
    mainWindow.webContents.send('response-done');
  } catch (error) {
    mainWindow.webContents.send('response-chunk', `Error: ${error.message}`);
    mainWindow.webContents.send('response-done');
  }
});

// Reset conversation
ipcMain.handle('resetConversation', async () => {
  aiService.resetConversation();
  return { success: true };
});

// Command execution
ipcMain.handle('executeCommand', async (event, command) => {
  try {
    const result = await commandService.safeExecute(command);
    return result;
  } catch (error) {
    return { success: false, error: error.message, stdout: '', stderr: '' };
  }
});

ipcMain.handle('launchApplication', async (event, appName) => {
  try {
    const result = await commandService.launchApplication(appName);
    return result;
  } catch (error) {
    return { success: false, error: error.message, stdout: '', stderr: '' };
  }
});

ipcMain.handle('openItem', async (event, target) => {
  try {
    const result = await commandService.openItem(target);
    return result;
  } catch (error) {
    return { success: false, error: error.message, stdout: '', stderr: '' };
  }
});

// Settings
ipcMain.handle('updateSettings', async (event, updates) => {
  try {
    const settingsService = require('./settingsService');
    for (const [keyPath, value] of Object.entries(updates)) {
      settingsService.set(keyPath, value);
    }
    if (mainWindow) {
      platformService.updateHotkeys();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Window controls
ipcMain.on('minimizeWindow', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('closeWindow', () => {
  if (mainWindow) {
    if (process.platform === 'darwin') {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  }
});

// Toggle listening
ipcMain.on('toggle-listening', () => {
  console.log('Toggle listening requested');
});

// ── TTS IPC ─────────────────────────────────────────────────────

// Get TTS status
ipcMain.handle('tts:status', async () => {
  return ttsService.getStatus();
});

// Download TTS model
ipcMain.handle('tts:download', async () => {
  return await ttsService.downloadModel();
});

// Speak text via TTS
ipcMain.handle('tts:speak', async (event, text) => {
  try {
    const chunks = await ttsService.speak(text);
    if (mainWindow && mainWindow.webContents) {
      for (const chunk of chunks) {
        const base64 = Buffer.from(chunk).toString('base64');
        mainWindow.webContents.send('tts:audio', base64);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set TTS voice
ipcMain.handle('tts:setVoice', async (event, voice) => {
  ttsService.setVoice(voice);
  const settingsService = require('./settingsService');
  settingsService.set('textToSpeech.voice', voice);
  return { success: true };
});

// Get available TTS voices
ipcMain.handle('tts:voices', async () => {
  return { voices: ttsService.getVoices() };
});

// Get TTS engine status
ipcMain.handle('tts:getStatus', async () => {
  return ttsService.getStatus();
});

// ── Model Management IPC ────────────────────────────────────────

// List available Ollama models
ipcMain.handle('models:list', async () => {
  try {
    const models = await aiService.getAvailableModels();
    return { models: models.map(m => m.name || m.model) };
  } catch (error) {
    return { models: [], error: error.message };
  }
});

// Get current AI model
ipcMain.handle('models:current', async () => {
  return { defaultModel: aiService.defaultModel, codeModel: aiService.codeModel };
});

// Set AI model
ipcMain.handle('models:set', async (event, { defaultModel, codeModel }) => {
  if (defaultModel) aiService.defaultModel = defaultModel;
  if (codeModel) aiService.codeModel = codeModel;
  const settingsService = require('./settingsService');
  if (defaultModel) settingsService.set('ai.model', defaultModel);
  if (codeModel) settingsService.set('ai.codeModel', codeModel);
  return { success: true };
});

// ── Local STT IPC ───────────────────────────────────────────────

// Get STT status
ipcMain.handle('stt:status', async () => {
  return localStt.getStatus();
});

// Download/initialize STT model
ipcMain.handle('stt:download', async () => {
  return await localStt.downloadModel();
});

// Transcribe audio data (Buffer → text)
ipcMain.handle('stt:transcribe', async (event, audioBuffer) => {
  try {
    const text = await localStt.transcribe(Buffer.from(audioBuffer));
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message, text: '' };
  }
});

// ── Workspace IPC ─────────────────────────────────────────────

// Get current workspace path
ipcMain.handle('workspace:getPath', async () => {
  return { path: workspaceTools.getRootPath(), subfolders: workspaceTools.getSubfolderNames() };
});

// Select and set workspace directory
ipcMain.handle('workspace:selectAndSet', async () => {
  if (!mainWindow) return { success: false, error: 'No window' };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Workspace Directory',
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false, cancelled: true };
    }
    const selectedPath = result.filePaths[0];
    workspaceTools.setRootPath(selectedPath);
    const folders = workspaceTools.ensureSubfolders();
    const settingsService = require('./settingsService');
    settingsService.set('workspace.path', selectedPath);
    historyService.setHistoryDir(path.join(selectedPath, 'history'));
    historyService.newSession();
    return { success: true, path: selectedPath, subfolders: folders.subfolders };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reset workspace to default
ipcMain.handle('workspace:resetPath', async () => {
  const defaultPath = path.join(os.homedir(), 'Workspace');
  workspaceTools.setRootPath(defaultPath);
  const folders = workspaceTools.ensureSubfolders();
  const settingsService = require('./settingsService');
  settingsService.set('workspace.path', '');
  historyService.setHistoryDir(path.join(defaultPath, 'history'));
  historyService.newSession();
  return { success: true, path: defaultPath, subfolders: folders.subfolders };
});

// ── History IPC ───────────────────────────────────────────────

// List saved chat sessions
ipcMain.handle('history:list', async () => {
  return { sessions: historyService.listSessions() };
});

// Load a specific session
ipcMain.handle('history:load', async (event, sessionId) => {
  const session = historyService.loadSession(sessionId);
  if (!session) return { success: false, error: 'Session not found' };
  return { success: true, session };
});

// ── Profile IPC ─────────────────────────────────────────────────

const PROFILE_PATH = path.join(os.homedir(), '.config', 'assistant-widget', 'profile.json');

function loadProfile() {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveProfile(data) {
  const dir = path.dirname(PROFILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(data, null, 2));
}

// Get saved profile
ipcMain.handle('profile:get', async () => {
  return loadProfile();
});

// Save profile and update AI persona
ipcMain.handle('profile:save', async (event, profile) => {
  saveProfile(profile);
  // Update AI service system prompt with persona
  if (profile.userName || profile.userRole || profile.persona || profile.context) {
    aiService.setPersona(profile.persona || '');
    aiService.setUserContext(profile.userName || '', profile.userRole || '', profile.context || '');
  }
  return { success: true };
});

// Clean up on quit
app.on('before-quit', () => {
  platformService.cleanup();
});