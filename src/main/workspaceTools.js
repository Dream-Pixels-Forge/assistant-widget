// Workspace tools — file operations + safe command execution inside Workspace
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { exec } = require('node:child_process');

const DEFAULT_ROOT = path.join(os.homedir(), 'Workspace');
const SUBFOLDERS = ['goal', 'wiki', 'projects', 'memory', 'skills', 'prompt', 'history'];

class WorkspaceTools {
  constructor() {
    this.workspaceRoot = DEFAULT_ROOT;
    console.log('Workspace Tools initialized, root:', this.workspaceRoot);
  }

  getRootPath() {
    return this.workspaceRoot;
  }

  setRootPath(newRoot) {
    this.workspaceRoot = newRoot;
    console.log('Workspace root set to:', newRoot);
  }

  ensureSubfolders() {
    const created = [];
    for (const name of SUBFOLDERS) {
      const dir = path.join(this.workspaceRoot, name);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        created.push(name);
      }
    }
    return { root: this.workspaceRoot, subfolders: SUBFOLDERS, created };
  }

  getSubfolderNames() {
    return SUBFOLDERS;
  }

  // Resolve path safely inside Workspace
  _resolve(subpath) {
    let safe = (subpath || '').replace(/^\/+/, '').replace(/^(\.\.(\/|\\|$))+/, '');
    safe = path.normalize(safe);
    const full = path.join(this.workspaceRoot, safe);
    if (!full.startsWith(this.workspaceRoot)) {
      throw new Error('Path escapes workspace');
    }
    return full;
  }

  // List files in a directory
  listDir(subpath = '') {
    const dir = this._resolve(subpath);
    if (!fs.existsSync(dir)) return { error: 'Directory not found', files: [] };
    const items = fs.readdirSync(dir, { withFileTypes: true });
    return {
      path: path.relative(this.workspaceRoot, dir) || '.',
      files: items.map(d => ({
        name: d.name,
        type: d.isDirectory() ? 'dir' : 'file',
        size: d.isFile() ? fs.statSync(path.join(dir, d.name)).size : 0,
      })),
    };
  }

  // Read a file
  readFile(subpath) {
    const full = this._resolve(subpath);
    if (!fs.existsSync(full)) return { error: 'File not found' };
    if (fs.statSync(full).isDirectory()) return { error: 'Is a directory' };
    const content = fs.readFileSync(full, 'utf8');
    return {
      path: path.relative(this.workspaceRoot, full),
      content,
      lines: content.split('\n').length,
    };
  }

  // Write/create a file
  writeFile(subpath, content) {
    const full = this._resolve(subpath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
    return { success: true, path: path.relative(this.workspaceRoot, full) };
  }

  // Search inside files
  searchFiles(pattern, subpath = '') {
    const dir = this._resolve(subpath);
    if (!fs.existsSync(dir)) return { error: 'Directory not found', matches: [] };
    const results = [];
    function walk(d) {
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(d, item.name);
        if (item.isDirectory()) { walk(full); continue; }
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.toLowerCase().includes(pattern.toLowerCase())) {
            results.push({
              file: path.relative(this.workspaceRoot, full),
              snippet: content.slice(0, 200),
            });
          }
        } catch (e) { /* skip unreadable */ }
      }
    }
    walk(dir);
    return { pattern, matches: results.slice(0, 20) };
  }

  // Execute a safe shell command (restricted allowlist)
  runCommand(command) {
    const safePrefixes = [
      'ls ', 'cat ', 'head ', 'tail ', 'wc ', 'grep ', 'find ',
      'pwd', 'echo ', 'date', 'which ', 'whoami',
      'mkdir -p ', 'touch ', 'cp ', 'mv ',
    ];
    const lower = command.toLowerCase().trim();

    const isSafe = safePrefixes.some(p => lower.startsWith(p));
    if (!isSafe) return { error: 'Command not in allowlist', output: '' };

    if (lower.includes('..') || lower.startsWith('/') || lower.includes('/root') || lower.includes('/etc') || lower.includes('~')) {
      return { error: 'Path outside workspace blocked', output: '' };
    }

    return new Promise((resolve) => {
      exec(command, { cwd: this.workspaceRoot, timeout: 10000 }, (err, stdout, stderr) => {
        resolve({
          exitCode: err ? err.code || 1 : 0,
          stdout: (stdout || '').slice(0, 2000),
          stderr: (stderr || '').slice(0, 500),
        });
      });
    });
  }

  // Get tools definition for the AI system prompt
  getToolDescriptions() {
    return [
      {
        name: 'list_dir',
        description: 'List files and folders in the workspace directory',
        usage: 'list_dir(path="")  — path relative to workspace (e.g. "projects", "wiki")',
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file inside workspace',
        usage: 'read_file(path="wiki/index.md")',
      },
      {
        name: 'write_file',
        description: 'Create or overwrite a file inside workspace',
        usage: 'write_file(path="goals/todo.md", content="...")',
      },
      {
        name: 'search_files',
        description: 'Search for text inside workspace files',
        usage: 'search_files(pattern="Ollama", path="")',
      },
      {
        name: 'run_command',
        description: 'Run a safe shell command inside workspace',
        usage: 'run_command(command="ls -la projects/")',
      },
    ].map(t => `  - ${t.name}(${t.usage}): ${t.description}`).join('\n');
  }
}

module.exports = new WorkspaceTools();
