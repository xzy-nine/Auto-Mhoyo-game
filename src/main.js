const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const AutoGAME = require('./AutoGAME');
const DiagnosticTool = require('./diagnostic');

class MainProcess {
  constructor() {
    this.mainWindow = null;
    this.autoGame = new AutoGAME();
    this.autoGame.setMainProcess(this); // 设置主进程引用
    this.isDev = process.argv.includes('--dev') || !app.isPackaged;
    this.isAutoRun = process.argv.includes('--auto-run');
    
    // 设置便携版应用目录环境变量
    if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) {
      process.env.PORTABLE_EXECUTABLE_DIR = path.dirname(process.execPath);
    }
    
    // 添加命令行开关来防止闪烁
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');
    app.commandLine.appendSwitch('disable-background-timer-throttling');
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    
    this.initializeApp();
  }

  initializeApp() {
    // 禁用硬件加速，防止GPU相关的闪烁
    app.disableHardwareAcceleration();
    
    app.whenReady().then(async () => {
      console.log('Electron 应用启动中...');
      console.log('当前工作目录:', process.cwd());
      console.log('应用路径:', app.getAppPath());
      console.log('用户数据目录:', app.getPath('userData'));
      console.log('是否打包:', app.isPackaged);
      
      // 初始化 AutoGAME
      const initialized = await this.autoGame.initializeApp();
      if (!initialized) {
        console.error('AutoGAME 初始化失败');
        if (!this.isDev) {
          app.quit();
          return;
        }
      }
      
      this.createWindow();
      this.setupIpcHandlers();
      this.setupGlobalShortcuts();
      this.startProgressMonitoring();
      
      if (this.isAutoRun) {
        this.handleAutoRun();
      }
    });

    app.on('window-all-closed', () => {
      // 清理全局快捷键
      globalShortcut.unregisterAll();
      
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('will-quit', () => {
      // 确保在应用退出前清理全局快捷键
      globalShortcut.unregisterAll();
    });
  }

  createWindow() {
    // 确保使用绝对路径和高质量图标
    const iconPath = path.resolve(__dirname, '../assets/icon.png');
    
    // 检查图标文件是否存在
    if (!fs.existsSync(iconPath)) {
      console.warn('图标文件不存在:', iconPath);
    } else {
      console.log('使用图标文件:', iconPath);
    }
    
    const windowOptions = {
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        // 禁用硬件加速可能导致的闪烁
        webgl: false,
        // 优化渲染
        backgroundThrottling: false
      },
      icon: iconPath, // 直接设置图标
      show: false,
      // 防止白屏闪烁的配置
      backgroundColor: '#1a1a1a', // 设置深色背景，匹配应用主题
      titleBarStyle: 'default',
      // 避免视觉闪烁
      webSecurity: true,
      // 优化渲染性能
      enableRemoteModule: false,
      // 禁用视觉效果
      paintWhenInitiallyHidden: false,
      // 窗口创建时的配置
      skipTaskbar: false,
      // 禁用动画
      useContentSize: true,
      // 强制深色模式
      darkTheme: true,
      // 隐藏菜单栏
      autoHideMenuBar: true
    };
    
    this.mainWindow = new BrowserWindow(windowOptions);

    // 完全移除应用菜单
    Menu.setApplicationMenu(null);

    // 监听窗口事件，确保只显示一次
    let hasShown = false;

    // 加载页面
    this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // 开发工具
    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    // 等待所有资源加载完成
    this.mainWindow.webContents.once('did-finish-load', () => {
      if (!hasShown) {
        // 额外延迟确保渲染完成
        setTimeout(() => {
          if (!hasShown) {
            hasShown = true;
            this.mainWindow.show();
            // 确保窗口聚焦
            this.mainWindow.focus();
          }
        }, 200);
      }
    });

    // 备用显示机制
    this.mainWindow.once('ready-to-show', () => {
      if (!hasShown) {
        setTimeout(() => {
          if (!hasShown) {
            hasShown = true;
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }, 100);
      }
    });
  }

  setupIpcHandlers() {
    // 渲染器准备就绪事件
    ipcMain.on('renderer-ready', () => {
      console.log('渲染器已准备就绪');
      // 可以在这里执行额外的初始化操作
    });

    // 获取配置
    ipcMain.handle('get-config', async () => {
      try {
        return await this.autoGame.getConfig();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 保存配置
    ipcMain.handle('save-config', async (event, config) => {
      try {
        await this.autoGame.saveConfig(config);
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 验证配置
    ipcMain.handle('validate-config', async () => {
      try {
        return await this.autoGame.validateConfig();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 修改原有的运行方法，使用安全版本
    ipcMain.handle('run-game', async (event, gameKey) => {
      try {
        const result = await this.autoGame.runSingleGameSafe(gameKey);
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });

    // 执行所有游戏 - 使用安全版本
    ipcMain.handle('run-all-games', async (event, gameOrder = null) => {
      try {
        const result = await this.autoGame.runAllGamesSafe(gameOrder);
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取监控状态
    ipcMain.handle('get-monitoring-status', async () => {
      try {
        return this.autoGame.getMonitoringStatus();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 停止监控
    ipcMain.handle('stop-monitoring', async () => {
      try {
        this.autoGame.stopMonitoring();
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取任务队列状态
    ipcMain.handle('get-queue-status', async () => {
      try {
        return this.autoGame.getQueueStatus();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 清空任务队列
    ipcMain.handle('clear-queue', async () => {
      try {
        this.autoGame.clearQueue();
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取进程状态
    ipcMain.handle('get-process-status', async () => {
      try {
        return this.autoGame.getProcessStatus();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 选择文件
    ipcMain.handle('select-file', async (event, options = {}) => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: '支持的类型', extensions: ['exe', 'py'] },
          { name: '所有文件', extensions: ['*'] }
        ],
        ...options
      });

      return result.canceled ? null : result.filePaths[0];
    });

    // 选择文件夹
    ipcMain.handle('select-directory', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory']
      });

      return result.canceled ? null : result.filePaths[0];
    });

    // 打开外部链接
    ipcMain.handle('open-external', async (event, url) => {
      await shell.openExternal(url);
    });

    // 获取日志文件
    ipcMain.handle('get-logs', async () => {
      try {
        return await this.autoGame.getLogs();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 自动检测游戏路径
    ipcMain.handle('auto-detect-games', async () => {
      try {
        return await this.autoGame.autoDetectGames();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取应用信息
    ipcMain.handle('get-app-info', async () => {
      try {
        return {
          appDir: this.autoGame.appDir,
          configPath: this.autoGame.configPath,
          logDir: this.autoGame.logDir,
          isPackaged: app.isPackaged,
          version: app.getVersion(),
          platform: process.platform
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 检查文件是否存在
    ipcMain.handle('file-exists', async (event, filePath) => {
      try {
        return await fs.pathExists(filePath);
      } catch (error) {
        return false;
      }
    });

    // 检查目录是否存在
    ipcMain.handle('directory-exists', async (event, dirPath) => {
      try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
      } catch (error) {
        return false;
      }
    });

    // 读取文件内容
    ipcMain.handle('read-file', async (event, filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return { content };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 写入文件内容
    ipcMain.handle('write-file', async (event, filePath, content) => {
      try {
        await fs.writeFile(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 创建目录
    ipcMain.handle('create-directory', async (event, dirPath) => {
      try {
        await fs.ensureDir(dirPath);
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取目录内容
    ipcMain.handle('read-directory', async (event, dirPath) => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const result = items.map(item => ({
          name: item.name,
          isDirectory: item.isDirectory(),
          isFile: item.isFile(),
          path: path.join(dirPath, item.name)
        }));
        return { items: result };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 启动/停止进程监控
    ipcMain.handle('start-process-monitoring', async () => {
      try {
        this.autoGame.startProcessMonitoring();
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    ipcMain.handle('stop-process-monitoring', async () => {
      try {
        this.autoGame.stopProcessMonitoring();
        return { success: true };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 运行诊断
    ipcMain.handle('run-diagnostics', async () => {
      try {
        const diagnostic = new DiagnosticTool();
        const result = await diagnostic.runDiagnostics();
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });

    // 停止所有进程
    ipcMain.handle('stop-all-processes', async () => {
      try {
        return await this.autoGame.stopAllProcesses();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 停止指定进程
    ipcMain.handle('stop-process', async (event, processKey) => {
      try {
        return await this.autoGame.stopProcess(processKey);
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取实时日志流
    ipcMain.handle('get-realtime-logs', async () => {
      try {
        return await this.autoGame.getRealtimeLogs();
      } catch (error) {
        return { error: error.message };
      }
    });

    // 获取签到详情
    ipcMain.handle('get-signin-details', async () => {
      try {
        return await this.autoGame.getSignInDetails();
      } catch (error) {
        return { error: error.message };
      }
    });
  }

  async handleAutoRun() {
    try {
      const config = await this.autoGame.getConfig();
      if (config.autoRun) {
        setTimeout(async () => {
          await this.autoGame.runAllGames();
          if (!this.isDev) {
            app.quit();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Auto run failed:', error);
    }
  }

  // 向渲染进程发送事件
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // 开始监控并发送更新
  startProgressMonitoring() {
    // 监控进程状态变化
    setInterval(async () => {
      try {
        const status = this.autoGame.getProcessStatus();
        this.sendToRenderer('process-update', status);
      } catch (error) {
        console.error('Failed to get process status:', error);
      }
    }, 5000);

    // 监控配置文件变化
    try {
      const chokidar = require('chokidar');
      const configWatcher = chokidar.watch(this.autoGame.configPath);
      configWatcher.on('change', async () => {
        try {
          const config = await this.autoGame.getConfig();
          this.sendToRenderer('config-update', config);
        } catch (error) {
          console.error('Failed to reload config:', error);
        }
      });
    } catch (error) {
      console.warn('File watching disabled (chokidar not available):', error.message);
    }
  }

  setupGlobalShortcuts() {
    // 注册F12快捷键来切换开发者工具
    globalShortcut.register('F12', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.toggleDevTools();
      }
    });

    // 也保留原有的窗口内键盘监听作为备用
    if (this.mainWindow) {
      this.mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
          this.mainWindow.webContents.toggleDevTools();
        }
      });
    }
  }
}

// 创建应用实例
new MainProcess();
