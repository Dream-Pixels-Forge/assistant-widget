// AI Service — Ollama backend (local, free, private)
// Uses llama3.2:3b for fast CPU inference. Falls back to deepseek-coder:6.7b for code tasks.
const http = require('node:http');
const TaskService = require('./taskService');
const WorkspaceTools = require('./workspaceTools');
const HistoryService = require('./historyService');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

class AIService {
  constructor() {
    this.conversationHistory = [];
    this.taskService = TaskService;
    this.defaultModel = 'llama3.2:3b';
    this.codeModel = 'deepseek-coder:6.7b';

    this._baseSystemPrompt = `You are Assistant, an AI helper with access to the user's ~/Workspace folder.
You can read and write files, list directories, search content, and run safe commands.
You are concise, warm, and goal-oriented.

Rules:
- Keep responses under 3 paragraphs unless the user asks for detail.
- Use plain text (no markdown formatting like **, *, #).
- When the user asks about their workspace, wiki, goals, or projects, USE your tools to look things up instead of guessing.

Available tools (respond with JSON to call one):
${WorkspaceTools.getToolDescriptions()}

To call a tool, end your response with a JSON block like this:
{"tool":"read_file","args":{"path":"wiki/index.md"}}
Then I will execute it and show you the result. Keep the JSON on its own line at the end.`;

    console.log('AI Service initialized (Ollama backend)');
    this.systemPrompt = this._baseSystemPrompt;
    // Preload model so first response is fast
    this._preloadModel();
  }

  // Preload model into memory so first user request is fast
  async _preloadModel() {
    try {
      const req = http.request(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.done) console.log(`Model warm: ${result.total_duration / 1e9}s`);
          } catch (e) { /* ignore parse errors */ }
        });
      });
      req.write(JSON.stringify({
        model: this.defaultModel,
        prompt: '.',
        keep_alive: '30m',
        stream: false,
        options: { num_predict: 1 }
      }));
      req.end();
      req.on('error', () => {});
      req.setTimeout(30000, () => req.destroy());
    } catch (e) { /* silent fail */ }
  }

  // Make a request to Ollama's chat API
  async _ollamaChat(messages, model = this.defaultModel) {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/chat', OLLAMA_HOST);
      const body = JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: '10m',  // Keep model loaded in memory
        options: {
          temperature: 0.7,
          num_predict: 1024,
        }
      });

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(parsed.error));
            } else if (parsed.message && parsed.message.content) {
              resolve(parsed.message.content);
            } else {
              reject(new Error(`Unexpected Ollama response: ${data.slice(0, 200)}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}\nRaw: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('Ollama request timed out after 120s'));
      });
      req.write(body);
      req.end();
    });
  }

  // Stream response from Ollama — with tool calling loop
  async getResponseStream(userInput, onChunk) {
    this.conversationHistory.push({ role: 'user', content: userInput });

    // Detect code tasks for model selection
    const isCodeTask = /code|function|class|debug|test|script|implement|refactor/i.test(userInput);

    try {
      await this._runToolLoop(onChunk, 0, isCodeTask);
    } catch (error) {
      console.error('Ollama stream error:', error.message);
      const fallback = error.code === 'ECONNREFUSED'
        ? `⚠️ Ollama is not running. Start it with:\n\n  ollama serve\n\nThen try again.`
        : `Sorry, I hit an error: ${error.message}`;
      onChunk(fallback);
      this.conversationHistory.push({ role: 'assistant', content: fallback });
    }

    HistoryService.saveConversation(this.conversationHistory);
  }

  // Internal tool-calling loop
  async _runToolLoop(onChunk, depth = 0, isCodeTask = false) {
    if (depth > 5) {
      onChunk('\n\n[Reached max tool call depth]');
      return;
    }

    const model = isCodeTask ? this.codeModel : this.defaultModel;

    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory.slice(-15),
    ];

    let fullResponse = '';
    let toolCallJson = '';

    await this._ollamaChatStream(messages, model, (chunk) => {
      fullResponse += chunk;
      toolCallJson += chunk;
      onChunk(chunk);
    });

    const normalized = fullResponse.replace(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g, '$1');

    const toolCall = this._extractToolCall(normalized);

    if (toolCall) {
      const textPart = normalized.replace(/\s*\{("tool":[\s\S]*)\}\s*$/, '').trim();

      if (textPart) {
        this.conversationHistory.push({ role: 'assistant', content: textPart });
      } else {
        onChunk('\x00clear_stream');
      }

      let toolResult;
      try {
        toolResult = this._executeTool(toolCall.tool, toolCall.args);
      } catch (e) {
        toolResult = { error: e.message };
      }

      const resultStr = typeof toolResult === 'string'
        ? toolResult
        : JSON.stringify(toolResult, null, 2);

      this.conversationHistory.push({
        role: 'system',
        content: `Tool "${toolCall.tool}" returned:\n${resultStr.slice(0, 3000)}`,
      });

      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-40);
      }

      await this._runToolLoop(onChunk, depth + 1, isCodeTask);
    } else {
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-40);
      }
    }
  }

  // Extract tool call JSON from the end of response text
  _extractToolCall(text) {
    const match = text.match(/\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]+\})\s*\}/);
    if (!match) return null;
    try {
      const args = JSON.parse(match[2]);
      return { tool: match[1], args };
    } catch (e) {
      return null;
    }
  }

  // Execute a tool call
  _executeTool(toolName, args) {
    switch (toolName) {
      case 'list_dir':
        return WorkspaceTools.listDir(args.path);
      case 'read_file':
        return WorkspaceTools.readFile(args.path);
      case 'write_file':
        return WorkspaceTools.writeFile(args.path, args.content);
      case 'search_files':
        return WorkspaceTools.searchFiles(args.pattern, args.path);
      case 'run_command':
        return WorkspaceTools.runCommand(args.command);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Streaming chat — parses NDJSON from Ollama
  _ollamaChatStream(messages, model, onChunk) {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/chat', OLLAMA_HOST);
      const body = JSON.stringify({
        model,
        messages,
        stream: true,
        keep_alive: '30m',
        options: { temperature: 0.7, num_predict: 1024 }
      });

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let buffer = '';
        res.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.error) {
                reject(new Error(parsed.error));
                return;
              }
              if (parsed.message && parsed.message.content) {
                onChunk(parsed.message.content);
              }
              if (parsed.done) {
                resolve();
              }
            } catch (e) { /* skip partial JSON */ }
          }
        });
        res.on('end', () => resolve());
        res.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(180000, () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });
      req.write(body);
      req.end();
    });
  }

  async getResponse(userInput, context = {}) {
    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: userInput });

    try {
      // Check if this is a code-heavy request — use deepseek-coder
      const isCodeTask = /code|function|class|debug|test|script|implement|refactor/i.test(userInput);
      const model = isCodeTask ? this.codeModel : this.defaultModel;

      // Build messages with system prompt + recent history
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.conversationHistory.slice(-10),
      ];

      const response = await this._ollamaChat(messages, model);

      // Add assistant response to history
      this.conversationHistory.push({ role: 'assistant', content: response });

      // Trim history to prevent unbounded growth
      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-40);
      }

      return response;
    } catch (error) {
      console.error('Ollama error:', error.message);

      // Check if Ollama is running at all
      if (error.code === 'ECONNREFUSED') {
        return `⚠️ Ollama is not running. Start it with:\n\n  ollama serve\n\nThen try again.`;
      }

      // Fallback: return a friendly error message
      const fallback = `Sorry, I hit an error talking to the AI model: ${error.message}\n\nYou can try:\n• Make sure Ollama is running\n• Check that the model is downloaded (ollama list)\n• Try again in a moment`;

      // Save fallback to history so conversation flow isn't broken
      this.conversationHistory.push({ role: 'assistant', content: fallback });
      return fallback;
    }
  }

  // Reset conversation
  resetConversation() {
    HistoryService.saveConversation(this.conversationHistory);
    this.conversationHistory = [];
    HistoryService.newSession();
    return { success: true };
  }

  // Update assistant persona
  setPersona(persona) {
    if (persona && persona.trim()) {
      this.systemPrompt = persona.trim();
      console.log('Persona updated');
    }
  }

  // Set user context (name, role, extra info)
  setUserContext(userName, userRole, extraContext) {
    const parts = [];
    if (userName) parts.push(`The user's name is ${userName}.`);
    if (userRole) parts.push(`The user is a ${userRole}.`);
    if (extraContext) parts.push(extraContext);

    if (parts.length > 0) {
      this.systemPrompt = (this._baseSystemPrompt || this.systemPrompt) +
        '\n\n--- Context ---\n' + parts.join('\n');
    }
  }

  // Get the models available
  async getAvailableModels() {
    return new Promise((resolve, reject) => {
      const req = http.request(`${OLLAMA_HOST}/api/tags`, { method: 'GET' }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.models || []);
          } catch (e) {
            resolve([]);
          }
        });
      });
      req.on('error', () => resolve([]));
      req.end();
    });
  }
}

// Export singleton
module.exports = new AIService();