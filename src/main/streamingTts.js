const ttsService = require('./ttsService');

class StreamingTTS {
  constructor() {
    this.buffer = '';
    this.speaking = false;
    this.queue = [];
    this.onAudio = null;
    this.flushing = false;
  }

  setOnAudio(callback) {
    this.onAudio = callback;
  }

  async start() {
    this.buffer = '';
    this.queue = [];
    this.speaking = false;
    this.flushing = false;
    if (!ttsService.ready) {
      await ttsService.initialize();
    }
  }

  feed(chunk) {
    if (!chunk || this.queue.length > 10) return;
    this.buffer += chunk;
    this._processBuffer();
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    const remaining = this.buffer.trim();
    this.buffer = '';
    if (remaining && remaining.length > 3) {
      this.queue.push(remaining);
    }
    while (this.queue.length > 0) {
      const sentence = this.queue.shift();
      await this._speak(sentence);
    }
    this.flushing = false;
  }

  _processBuffer() {
    const regex = /[^.!?\n]+[.!?\n]/g;
    let lastMatchEnd = 0;
    let match;
    while ((match = regex.exec(this.buffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence && sentence.length > 5) {
        this.queue.push(sentence);
      }
      lastMatchEnd = match.index + match[0].length;
    }
    if (lastMatchEnd > 0) {
      this.buffer = this.buffer.slice(lastMatchEnd);
    }
    if (this.buffer.length > 600) {
      const overflow = this.buffer.trim();
      if (overflow) this.queue.push(overflow);
      this.buffer = '';
    }
    if (this.queue.length > 0 && !this.speaking && !this.flushing) {
      this._drainQueue();
    }
  }

  async _drainQueue() {
    if (this.speaking || this.flushing) return;
    this.speaking = true;
    while (this.queue.length > 0 && !this.flushing) {
      const sentence = this.queue.shift();
      await this._speak(sentence);
    }
    this.speaking = false;
  }

  async _speak(text) {
    if (!text || text.length < 3) return;
    try {
      const audio = await ttsService.speak(text);
      if (this.onAudio) {
        for (const chunk of audio) {
          const base64 = Buffer.from(chunk).toString('base64');
          this.onAudio(base64);
        }
      }
    } catch (e) {
      console.error('Streaming TTS error:', e.message);
    }
  }
}

module.exports = new StreamingTTS();
