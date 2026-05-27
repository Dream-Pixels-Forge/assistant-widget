# Assistant Widget

<img width="404" height="466" alt="Screenshot from 2026-05-26 16-34-16" src="https://github.com/user-attachments/assets/36a8b1de-94bf-4b6f-98d1-e7761790f897" />


A local-first, privacy-focused desktop AI assistant powered by **Ollama** and built with **Electron**. Features real-time streaming responses, voice input/output, an analogue clock, live weather, and full user customization.

## Features

### 💬 AI Chat (Local LLM)
- Runs entirely offline via **Ollama** (`llama3.2:3b` for chat, `deepseek-coder:6.7b` for code)
- **Streaming responses** — text appears character-by-character as the model generates
- Real-time conversation with context history
- Smart model routing: general chat vs code tasks

### 🎤 Speech-to-Text
- **Browser STT** — uses Web Speech API (built-in, no setup)
- **Local Whisper STT** — offline transcription via `Xenova/whisper-tiny.en` (optional, ~151MB)
- Interim speech display — see your words appear live as you speak
- Continuous listening with auto-restart

### 🔊 Text-to-Speech
- **Kokoro TTS** — high-quality local speech synthesis via `kokoro-js` (optional, ~80MB)
- 9 voices available (US/UK, Male/Female)
- Automatic audio playback of AI responses
- Browser speechSynthesis fallback

### 🎛️ Settings Panel
- **Model selector** — pick any Ollama model on-the-fly
- **TTS controls** — download model, select voice
- **STT mode** — switch between Browser STT and Local Whisper
- **Profile tab** — customize:
  - Your name
  - Your role/occupation
  - Assistant persona (custom system prompt)
  - Extra context for the AI

### 🕐 Widget UI
- **Big digital clock** with time-based greeting ("Good morning", "Good evening")
- **Live weather** from wttr.in (temperature + conditions)
- **Glassmorphism design** — frosted glass with blur effect
- **Draggable** window (drag from the top bar)
- **Waveform visualizer** — green for user speaking, yellow for assistant responding
- **Compact 400×460** size — sits unobtrusively on your desktop

### 🛠️ System Features
- **System tray** icon with context menu
- **Global hotkeys** (`Ctrl+Space` toggle listening, `Ctrl+Shift+A` show/hide)
- **Command execution** with safety allowlist
- **Task management** with goal decomposition

## Technology Stack

| Component | Technology |
|-----------|-----------|
| **Desktop Framework** | Electron 30 |
| **LLM Backend** | Ollama (local) |
| **Default Model** | llama3.2:3b (~2s response on CPU) |
| **TTS** | Kokoro-js (ONNX, local, ~80MB) |
| **STT (Local)** | Whisper tiny.en via @huggingface/transformers |
| **Weather** | wttr.in API |
| **UI** | Vanilla HTML/CSS/JS with glassmorphism |
| **IPC** | Electron contextBridge + ipcRenderer |

## Getting Started

### Prerequisites
- [Ollama](https://ollama.com) installed and running
- Node.js 18+ and npm

### Setup

```bash
# Clone or navigate to the project
cd ~/developments/apps/assistant

# Install dependencies
npm install

# Download the default AI model (if not already)
ollama pull llama3.2:3b

# Launch the widget
npx electron .
```

### Download Additional Models (Optional)
Use the **Settings** panel (gear icon ⚙) to download:
- **TTS Model** (~80MB) — Kokoro voice synthesis
- **Whisper Model** (~151MB) — Local offline speech recognition

## Controls

| Control | Action |
|---------|--------|
| **Mic button** | Toggle voice input |
| **Text input + Send** | Type a message |
| **Gear icon ⚙** | Open settings panel |
| **― / ✕** | Minimize / Close |
| **Top bar** | Drag to move window |
| **Ctrl+Space** | Toggle listening (global) |
| **Ctrl+Shift+A** | Show/Hide widget (global) |

## Project Structure

```
assistant/
├── src/
│   ├── main/
│   │   ├── index.js            # Electron main process, window, IPC
│   │   ├── preload.js          # Context bridge (secure IPC)
│   │   ├── aiService.js        # Ollama LLM integration (streaming)
│   │   ├── ttsService.js       # Kokoro TTS engine
│   │   ├── localSttService.js  # Whisper speech recognition
│   │   ├── commandService.js   # Safe system command execution
│   │   ├── platformService.js  # System tray, global hotkeys
│   │   ├── settingsService.js  # User preferences persistence
│   │   └── taskService.js      # Goal decomposition & task tracking
│   └── renderer/
│       ├── index.html          # Widget UI structure
│       ├── style.css           # Glassmorphism styling
│       └── script.js           # UI logic, clock, weather, TTS playback
├── package.json
├── ROADMAP.md                  # Development milestones
└── README.md
```

## Development

```bash
# Run with DevTools open (for debugging)
HERMES_DEVTOOLS=1 npx electron .

# Check for dependency updates
npm outdated
```

## License

MIT
