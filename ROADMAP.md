# Assistant Widget — Production Roadmap

## Phase 1: Core AI Integration
**Goal:** Replace placeholder AI with real Ollama-powered LLM

- [ ] Pull a general-purpose local model (llama3.2:3b or qwen2.5:3b) for faster CPU inference
- [ ] Rewrite aiService.js to use Ollama API (local HTTP) instead of OpenAI SDK
- [ ] Wire up IPC so the renderer talks to real AI end-to-end
- [ ] Test conversational flow in Electron window

## Phase 2: Speech Hardening
**Goal:** Reliable speech input/output

- [ ] Fix Web Speech API integration (STT + TTS) in renderer
- [ ] Add Whisper.cpp offline STT as fallback
- [ ] Add audio level visualization to UI
- [ ] Test voice input → AI → voice response loop

## Phase 3: UI/UX Polish
**Goal:** Smooth, professional user experience

- [ ] Markdown rendering for AI responses
- [ ] Conversation history scrolling
- [ ] Settings window (model selection, hotkeys, theme)
- [ ] Loading states, error handling, animations
- [ ] System tray icon (app icon)

## Phase 4: Platform & Distribution
**Goal:** Shippable desktop app

- [ ] Test and fix system tray + global hotkeys
- [ ] Build configuration (electron-builder)
- [ ] App icon + assets
- [ ] Auto-start option
- [ ] Package as AppImage/DEB
