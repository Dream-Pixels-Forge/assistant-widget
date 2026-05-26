const fs = require('node:fs');
const path = require('node:path');

class HistoryService {
  constructor() {
    this.historyDir = null;
    this.sessionId = this._generateId();
  }

  _generateId() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }

  setHistoryDir(dir) {
    this.historyDir = dir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _sessionFile() {
    return path.join(this.historyDir, `${this.sessionId}.json`);
  }

  saveConversation(messages) {
    if (!this.historyDir || !messages || !messages.length) return false;
    try {
      const data = JSON.stringify({
        sessionId: this.sessionId,
        savedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages,
      }, null, 2);
      fs.writeFileSync(this._sessionFile(), data, 'utf8');
      return true;
    } catch (e) {
      console.error('History save error:', e.message);
      return false;
    }
  }

  listSessions() {
    if (!this.historyDir || !fs.existsSync(this.historyDir)) return [];
    try {
      return fs.readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const fp = path.join(this.historyDir, f);
          const stat = fs.statSync(fp);
          let preview = '';
          try {
            const raw = fs.readFileSync(fp, 'utf8').slice(0, 500);
            const parsed = JSON.parse(raw);
            preview = parsed.messageCount ? `${parsed.messageCount} messages` : '';
          } catch (e) {}
          return {
            id: f.replace('.json', ''),
            file: f,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            preview,
          };
        })
        .sort((a, b) => b.mtime.localeCompare(a.mtime));
    } catch (e) {
      console.error('History list error:', e.message);
      return [];
    }
  }

  loadSession(id) {
    try {
      const fp = path.join(this.historyDir, `${id}.json`);
      if (!fs.existsSync(fp)) return null;
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (e) {
      console.error('History load error:', e.message);
      return null;
    }
  }

  newSession() {
    this.sessionId = this._generateId();
  }
}

module.exports = new HistoryService();
