// Platform Service for handling system tray, menu bar, and global hotkeys
const { app, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

class PlatformService {
  constructor() {
    this.tray = null;
    this.window = null; // Will be set when we have access to the main window
    this.registeredShortcuts = new Set();
    this.isInitialized = false;
    console.log('Platform Service initialized');
  }

  /**
   * Initialize platform-specific features
   * @param {BrowserWindow} mainWindow - The main application window
   */
  initialize(mainWindow) {
    if (this.isInitialized) return;
    
    this.window = mainWindow;
    this.isInitialized = true;
    
    // Create system tray/menu bar icon
    this.createTray();
    
    // Register global hotkeys from settings
    this.registerGlobalHotkeys();
    
    console.log('Platform Service features initialized');
  }

  /**
   * Create system tray or menu bar icon
   */
  createTray() {
    try {
      // Try to load icon from assets
      const iconPath = path.join(__dirname, '../../assets/icon.png');
      let icon = null;
      
      if (fs.existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath);
      } else {
        // Create a simple default icon if none exists
        icon = nativeImage.createEmpty();
      }
      
      // Create the tray icon
      this.tray = new Tray(icon);
      
      // Set tooltip
      this.tray.setToolTip('Assistant');
      
      // Create context menu
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Assistant',
          click: () => {
            if (this.window) {
              this.window.show();
            }
          }
        },
        {
          label: 'Hide Assistant',
          click: () => {
            if (this.window) {
              this.window.hide();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.quit();
          }
        }
      ]);
      
      this.tray.setContextMenu(contextMenu);
      
      // Handle click events
      this.tray.on('click', () => {
        if (this.window) {
          if (this.window.isVisible()) {
            this.window.hide();
          } else {
            this.window.show();
          }
        }
      });
      
      console.log('Tray/icon created successfully');
    } catch (error) {
      console.error('Error creating tray/icon:', error);
    }
  }

  /**
   * Register global hotkeys from settings
   */
  registerGlobalHotkeys() {
    try {
      // Unregister any existing shortcuts
      this.unregisterAllHotkeys();
      
      // Get hotkey settings
      const settingsService = require('./settingsService');
      
      const toggleListeningHotkey = settingsService.get('hotkeys.toggleListening') || 'CommandOrControl+Space';
      const showHideHotkey = settingsService.get('hotkeys.showHide') || 'CommandOrControl+Shift+A';
      
      // Register toggle listening hotkey
      if (toggleListeningHotkey) {
        const success = globalShortcut.register(toggleListeningHotkey, () => {
          console.log('Toggle listening hotkey pressed');
          // Send event to renderer to toggle microphone
          if (this.window && this.window.webContents) {
            this.window.webContents.send('toggle-listening');
          }
        });
        
        if (success) {
          this.registeredShortcuts.add(toggleListeningHotkey);
          console.log(`Registered hotkey: ${toggleListeningHotkey}`);
        } else {
          console.error(`Failed to register hotkey: ${toggleListeningHotkey}`);
        }
      }
      
      // Register show/hide hotkey
      if (showHideHotkey) {
        const success = globalShortcut.register(showHideHotkey, () => {
          console.log('Show/hide hotkey pressed');
          if (this.window) {
            if (this.window.isVisible()) {
              this.window.hide();
            } else {
              this.window.show();
            }
          }
        });
        
        if (success) {
          this.registeredShortcuts.add(showHideHotkey);
          console.log(`Registered hotkey: ${showHideHotkey}`);
        } else {
          console.error(`Failed to register hotkey: ${showHideHotkey}`);
        }
      }
      
      console.log('Global hotkeys registered');
    } catch (error) {
      console.error('Error registering global hotkeys:', error);
    }
  }

  /**
   * Update hotkeys when settings change
   */
  updateHotkeys() {
    if (!this.isInitialized) return;
    this.registerGlobalHotkeys();
  }

  /**
   * Unregister all registered hotkeys
   */
  unregisterAllHotkeys() {
    for (const shortcut of this.registeredShortcuts) {
      globalShortcut.unregister(shortcut);
    }
    this.registeredShortcuts.clear();
  }

  /**
   * Clean up resources when application is closing
   */
  cleanup() {
    // Unregister all hotkeys
    this.unregisterAllHotkeys();
    
    // Destroy tray icon
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    
    console.log('Platform Service cleaned up');
  }
}

// Export singleton instance
module.exports = new PlatformService();