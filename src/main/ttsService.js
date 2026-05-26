// TTS Service — Kokoro TTS for local, high-quality speech synthesis
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const TTS_CACHE_DIR = path.join(os.homedir(), '.config', 'assistant-widget', 'tts-cache');

class TTSService {
  constructor() {
    this.tts = null;
    this.ready = false;
    this.modelLoaded = false;
    this.modelPath = path.join(TTS_CACHE_DIR, 'kokoro-model');
    this.voice = 'af_heart';  // Default voice
    console.log('TTS Service initialized');
  }

  // Check if the model is downloaded
  isModelDownloaded() {
    const marker = path.join(TTS_CACHE_DIR, '.model-downloaded');
    return fs.existsSync(marker);
  }

  // Get model download status
  getStatus() {
    return {
      ready: this.ready,
      modelLoaded: this.modelLoaded,
      modelDownloaded: this.isModelDownloaded(),
      voice: this.voice,
    };
  }

  // Initialize the TTS engine (loads model from cache)
  async initialize() {
    if (this.ready) return true;
    try {
      const { KokoroTTS } = await import('kokoro-js');
      this.tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', {
        cache_dir: this.modelPath,
      });
      this.ready = true;
      this.modelLoaded = true;

      // Mark model as downloaded
      if (!fs.existsSync(TTS_CACHE_DIR)) {
        fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(TTS_CACHE_DIR, '.model-downloaded'), '1');

      console.log('TTS engine ready');
      return true;
    } catch (error) {
      console.error('TTS init error:', error.message);
      this.ready = false;
      return false;
    }
  }

  // Download the model (separate from init for progress tracking)
  async downloadModel(onProgress) {
    if (this.isModelDownloaded()) {
      if (onProgress) onProgress(100);
      return true;
    }

    try {
      // The model is auto-downloaded on first from_pretrained
      await this.initialize();
      return this.ready;
    } catch (error) {
      console.error('TTS download error:', error.message);
      return false;
    }
  }

  // Synthesize text to speech, returns audio data as ArrayBuffer
  async speak(text) {
    if (!this.ready) {
      const ok = await this.initialize();
      if (!ok) throw new Error('TTS not ready');
    }

    // Split long text into shorter sentences for better quality
    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    let audioChunks = [];

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      try {
        const audio = await this.tts.generate(sentence.trim(), {
          voice: this.voice,
        });
        // audio is an AudioBuffer-like object
        // Convert to WAV or base64 for sending to renderer
        const wav = await this._audioToWav(audio);
        audioChunks.push(wav);
      } catch (e) {
        console.error('TTS sentence error:', e.message);
      }
    }

    return audioChunks;
  }

  // Convert Kokoro's output (Float32Array + sampleRate) to WAV ArrayBuffer
  async _audioToWav(kokoroOutput) {
    // kokoro-js returns { audio: Float32Array, sampleRate: number }
    const samples = kokoroOutput.audio || kokoroOutput;
    const sampleRate = kokoroOutput.sampleRate || 24000;
    const length = samples.length || 0;

    if (!length) throw new Error('No audio data');

    // Mono WAV header + data
    const bytesPerSample = 2; // 16-bit
    const blockAlign = 1 * bytesPerSample;
    const dataSize = length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  // Set voice
  setVoice(voice) {
    this.voice = voice;
  }

  // Get available voices
  getVoices() {
    return [
      { id: 'af_heart', name: 'Heart (US Female)' },
      { id: 'af_bella', name: 'Bella (US Female)' },
      { id: 'af_nicole', name: 'Nicole (US Female)' },
      { id: 'af_sarah', name: 'Sarah (US Female)' },
      { id: 'af_sky', name: 'Sky (US Female)' },
      { id: 'am_adam', name: 'Adam (US Male)' },
      { id: 'am_michael', name: 'Michael (US Male)' },
      { id: 'bf_emma', name: 'Emma (UK Female)' },
      { id: 'bm_george', name: 'George (UK Male)' },
    ];
  }
}

module.exports = new TTSService();