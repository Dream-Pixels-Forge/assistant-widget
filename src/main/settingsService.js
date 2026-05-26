// Settings service for managing user preferences
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

class SettingsService {
  constructor() {
    // Get user data path, with fallback for testing
    let userDataPath;
    try {
      userDataPath = app.getPath('userData');
    } catch (e) {
      // Fallback to a temporary directory for testing
      const os = require('node:os');
      userDataPath = path.join(os.tmpdir(), 'assistant-test');
    }
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.defaultSettings = {
      // Speech recognition
      speechRecognition: {
        enabled: true,
        language: 'en-US',
        autoPunctuation: true,
        removeFillerWords: true,
        personalDictionary: []
      },
      
      // Text-to-speech
      textToSpeech: {
        enabled: true,
        voice: 'default',
        rate: 1.0,
        volume: 0.8
      },
      
      // AI behavior
      ai: {
        model: 'local',
        codeModel: 'local',
        temperature: 0.7,
        maxTokens: 1500,
        systemPrompt: `You are Assistant, an AI helper that assists with writing, speaking, command execution, and task delegation. 
        You are concise, helpful, and goal-oriented. You understand user objectives and break them down into actionable steps.
        Current capabilities include:
        - Voice dictation with AI-powered editing
        - Writing assistance (drafting, editing, improving content)
        - Speaking/presentation help
        - Command execution
        - Task delegation and automation
        
        When users express goals or objectives, help them break these down into manageable tasks.
        When users ask for writing help, provide suggestions and improvements.
        When users want to execute commands, help them formulate the right approach.
        Keep responses helpful and action-oriented.`
      },
      
      // Appearance
      appearance: {
        theme: 'dark', // or 'light'
        width: 400,
        height: 600,
        alwaysOnTop: true,
        transparency: 0.9
      },
      
      // Hotkeys
      hotkeys: {
        toggleListening: 'CommandOrControl+Space',
        showHide: 'CommandOrControl+Shift+A'
      },
      
      // Privacy
      privacy: {
        saveHistory: true,
        saveDictionary: true,
        useLocalProcessing: true
      },

      // Workspace
      workspace: {
        path: ''
      }
    };
    
    this.settings = this.loadSettings();
  }
  
  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const parsed = JSON.parse(data);
        return this._deepMerge({ ...this.defaultSettings }, parsed);
      } else {
        return { ...this.defaultSettings };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      return { ...this.defaultSettings };
    }
  }

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
  
  saveSettings() {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }
  
  get(keyPath) {
    const keys = keyPath.split('.');
    let value = this.settings;
    for (const key of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[key];
    }
    return value;
  }
  
  set(keyPath, value) {
    const keys = keyPath.split('.');
    let target = this.settings;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (target[key] === undefined) {
        target[key] = {};
      }
      target = target[key];
    }
    target[keys[keys.length - 1]] = value;
    return this.saveSettings();
  }
  
  resetToDefaults() {
    this.settings = { ...this.defaultSettings };
    return this.saveSettings();
  }
  
  // Secure API key handling
  setAPIKey(service, key) {
    // Don't store API keys in settings file for security
    // Instead, we'll rely on environment variables or secure storage
    // This method is kept for interface consistency but logs a warning
    console.warn(`API keys should be set via environment variables, not settings. Service: ${service}`);
    return false;
  }
  
  getAPIKey(service) {
    // For OpenAI, check environment variable
    if (service === 'openai') {
      return process.env.OPENAI_API_KEY || null;
    }
    // Add other services as needed
    return null;
  }
}

// Export singleton instance
module.exports = new SettingsService();