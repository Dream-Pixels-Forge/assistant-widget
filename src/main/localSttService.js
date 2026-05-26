// Local STT Service — Whisper via @huggingface/transformers
// Runs entirely offline in the main process
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const STT_CACHE_DIR = path.join(os.homedir(), '.config', 'assistant-widget', 'stt-cache');
const MODEL_ID = 'Xenova/whisper-tiny.en';

class LocalSttService {
  constructor() {
    this.pipeline = null;
    this.ready = false;
    this.modelDownloaded = false;
    this.modelPath = path.join(STT_CACHE_DIR, 'models');
    console.log('Local STT Service initialized');
  }

  isModelDownloaded() {
    const marker = path.join(STT_CACHE_DIR, '.model-downloaded');
    return fs.existsSync(marker);
  }

  getStatus() {
    return {
      ready: this.ready,
      modelDownloaded: this.isModelDownloaded(),
      modelId: MODEL_ID,
    };
  }

  // Initialize the Whisper pipeline
  async initialize() {
    if (this.ready) return true;
    try {
      // Dynamic import of ESM module
      const { pipeline } = await import('@huggingface/transformers');
      this.pipeline = await pipeline(
        'automatic-speech-recognition',
        MODEL_ID,
        {
          cache_dir: this.modelPath,
        }
      );
      this.ready = true;
      this.modelDownloaded = true;

      // Mark downloaded
      if (!fs.existsSync(STT_CACHE_DIR)) {
        fs.mkdirSync(STT_CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(path.join(STT_CACHE_DIR, '.model-downloaded'), '1');

      console.log('Whisper STT ready');
      return true;
    } catch (error) {
      console.error('STT init error:', error.message);
      this.ready = false;
      return false;
    }
  }

  // Download the model (same as init — auto-downloads from HF)
  async downloadModel() {
    if (this.isModelDownloaded()) return true;
    return await this.initialize();
  }

  // Transcribe audio buffer (WAV format ArrayBuffer → text)
  async transcribe(audioBuffer) {
    if (!this.ready) {
      const ok = await this.initialize();
      if (!ok) throw new Error('STT not ready');
    }

    try {
      // audioBuffer is a Buffer from IPC (WAV format)
      // Convert to Float32Array for the pipeline
      const audioData = this._wavToFloat32(audioBuffer);
      const result = await this.pipeline(audioData);
      return result.text || '';
    } catch (error) {
      console.error('STT transcribe error:', error.message);
      throw error;
    }
  }

  // Convert WAV buffer to Float32Array (16-bit PCM → float)
  _wavToFloat32(wavBuffer) {
    // WAV header is 44 bytes, PCM data starts at offset 44
    const headerSize = 44;
    const dataSize = wavBuffer.length - headerSize;
    const samples = new Float32Array(dataSize / 2);

    for (let i = 0; i < samples.length; i++) {
      const sample = wavBuffer.readInt16LE(headerSize + i * 2);
      samples[i] = sample / 32768.0;
    }

    return samples;
  }
}

module.exports = new LocalSttService();