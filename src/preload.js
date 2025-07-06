const { contextBridge, ipcRenderer } = require('electron');

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  validateConfig: () => ipcRenderer.invoke('validate-config'),
  
  // 游戏执行
  runGame: (gameKey) => ipcRenderer.invoke('run-game', gameKey),
  runAllGames: () => ipcRenderer.invoke('run-all-games'),
  
  // 进程监控
  getProcessStatus: () => ipcRenderer.invoke('get-process-status'),
  startProcessMonitoring: () => ipcRenderer.invoke('start-process-monitoring'),
  stopProcessMonitoring: () => ipcRenderer.invoke('stop-process-monitoring'),
  
  // 文件系统操作
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  directoryExists: (dirPath) => ipcRenderer.invoke('directory-exists', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 外部操作
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 日志
  getLogs: () => ipcRenderer.invoke('get-logs'),
  
  // 自动检测
  autoDetectGames: () => ipcRenderer.invoke('auto-detect-games'),
  
  // 诊断工具
  runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
  
  // 仪表盘功能
  stopAllProcesses: () => ipcRenderer.invoke('stop-all-processes'),
  stopProcess: (processKey) => ipcRenderer.invoke('stop-process', processKey),
  getRealtimeLogs: () => ipcRenderer.invoke('get-realtime-logs'),
  getSignInDetails: () => ipcRenderer.invoke('get-signin-details'),

  // 事件监听
  onProcessUpdate: (callback) => {
    ipcRenderer.on('process-update', callback);
    return () => ipcRenderer.removeListener('process-update', callback);
  },
  
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', callback);
    return () => ipcRenderer.removeListener('log-update', callback);
  },

  onConfigUpdate: (callback) => {
    ipcRenderer.on('config-update', callback);
    return () => ipcRenderer.removeListener('config-update', callback);
  },

  // 实时日志监听
  onRealtimeLog: (callback) => {
    ipcRenderer.on('realtime-log', (event, data) => callback(data));
    return () => ipcRenderer.removeListener('realtime-log', callback);
  }
});
