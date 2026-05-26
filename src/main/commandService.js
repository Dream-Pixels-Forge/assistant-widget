// Command Service for executing system commands safely
const { exec } = require('node:child_process');
const { app } = require('electron');

class CommandService {
  constructor() {
    // Initialize command service
    console.log('Command Service initialized');
  }

  /**
   * Execute a system command safely
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Result with stdout, stderr, and error info
   */
  async execute(command, options = {}) {
    const { timeout = 5000, cwd } = options;
    
    return new Promise((resolve, reject) => {
      // Basic safety check - prevent obviously dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf\s+\//,
        /dd\s+if=/,
        /mkfs/,
        /:/, // Avoid fork bombs like :(){:|:&};:
        />\s*\/dev\/sda/,
        /chmod\s+-R\s+777\s+\//,
        />\s*\/etc\/passwd/
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          return reject(new Error(`Command rejected for safety reasons: ${command}`));
        }
      }
      
      const childProcess = exec(command, { timeout, cwd }, (error, stdout, stderr) => {
        if (error) {
          resolve({ 
            success: false, 
            error: error.message, 
            stdout: stdout || '', 
            stderr: stderr || '' 
          });
        } else {
          resolve({ 
            success: true, 
            error: null, 
            stdout: stdout || '', 
            stderr: stderr || '' 
          });
        }
      });
      
      // Handle process exit
      childProcess.on('exit', (code) => {
        // Already handled in the callback above
      });
    });
  }

  /**
   * Execute a command with additional safety checks for common operations
   * @param {string} command - The command to execute
   * @returns {Promise<Object>} - Result object
   */
  async safeExecute(command) {
    // Convert to lowercase for checking
    const lowerCmd = command.toLowerCase().trim();
    
    // Allowlist of safe command prefixes
    const safePrefixes = [
      'open ',      // For opening applications/files (platform-specific)
      'launch ',    // Alternative to open
      'start ',     // Windows start command
      'echo ',      // Safe output
      'ls ',        // List directory contents
      'dir ',       // Windows directory listing
      'pwd ',       // Print working directory
      'mkdir -p ',  // Create directories
      'touch ',     // Create empty files
      'cp ',        // Copy files
      'mv ',        // Move files
      'cat ',       // Display file contents
      'head ',      // Show first lines
      'tail ',      // Show last lines
      'grep ',      // Search in files
      'find ',      // Find files
      'ps ',        // Process status
      'kill ',      // Kill processes (with caution)
      'ping ',      // Network utility
      'curl ',      // HTTP client
      'wget ',      // Web download
      'git ',       // Git version control
      'npm ',       // Node package manager
      'pip ',       // Python package installer
      'python ',    // Python interpreter
      'node ',      // Node.js interpreter
      'code ',      // VS Code
      'open -a ',   // macOS specific: open application
    ];
    
    // Check if command starts with a safe prefix
    const isSafePrefix = safePrefixes.some(prefix => lowerCmd.startsWith(prefix));
    
    // Additional safety checks
    const hasDangerousChars = /[;&|`$(){}]/.test(command); // Shell metacharacters
    const hasRedirection = /[<>]/.test(command); // Redirection operators
    
    if (hasDangerousChars || hasRedirection) {
      return { success: false, error: 'Command contains shell metacharacters — blocked for safety', stdout: '', stderr: '' };
    }
    
    if (!isSafePrefix) {
      return { success: false, error: `Command not in allowlist: ${command}`, stdout: '', stderr: '' };
    }
    
    return this.execute(command);
  }

  /**
   * Platform-specific application launching
   * @param {string} appName - Name or path of application to launch
   * @returns {Promise<Object>} - Result object
   */
  async launchApplication(appName) {
    let command = '';
    
    switch (process.platform) {
      case 'win32':
        command = `start "" "${appName}"`;
        break;
      case 'darwin':
        command = `open -a "${appName}"`;
        break;
      default:
        // Linux and other Unix-like systems
        command = `${appName} &`;
        break;
    }
    
    return this.safeExecute(command);
  }

  /**
   * Open a file or URL with the default application
   * @param {string} target - File path or URL to open
   * @returns {Promise<Object>} - Result object
   */
  async openItem(target) {
    let command = '';
    
    switch (process.platform) {
      case 'win32':
        command = `start "" "${target}"`;
        break;
      case 'darwin':
        command = `open "${target}"`;
        break;
      default:
        // Linux and other Unix-like systems
        command = `xdg-open "${target}"`;
        break;
    }
    
    return this.safeExecute(command);
  }
}

// Export singleton instance
module.exports = new CommandService();