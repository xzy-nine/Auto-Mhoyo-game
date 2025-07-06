const path = require('path');
const fs = require('fs');

class DiagnosticTool {
  constructor() {
    this.log = [];
  }

  addLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.log.push(logMessage);
    console.log(logMessage);
  }

  async runDiagnostics() {
    this.addLog('=== 诊断开始 ===');
    
    // 环境信息
    this.addLog(`Node.js 版本: ${process.version}`);
    this.addLog(`平台: ${process.platform}`);
    this.addLog(`架构: ${process.arch}`);
    this.addLog(`当前工作目录: ${process.cwd()}`);
    this.addLog(`执行路径: ${process.execPath}`);
    this.addLog(`资源路径: ${process.resourcesPath || 'N/A'}`);
    
    // 检查环境变量
    this.addLog(`PORTABLE_EXECUTABLE_DIR: ${process.env.PORTABLE_EXECUTABLE_DIR || 'N/A'}`);
    
    // 检查应用目录
    const appDir = this.getAppDirectory();
    this.addLog(`应用目录: ${appDir}`);
    this.addLog(`应用目录存在: ${fs.existsSync(appDir)}`);
    
    // 检查配置文件
    const configPath = path.join(appDir, 'config.json');
    const templatePath = path.join(appDir, 'config.json.template');
    this.addLog(`配置文件路径: ${configPath}`);
    this.addLog(`配置文件存在: ${fs.existsSync(configPath)}`);
    this.addLog(`模板文件路径: ${templatePath}`);
    this.addLog(`模板文件存在: ${fs.existsSync(templatePath)}`);
    
    // 检查日志目录
    const logDir = path.join(appDir, 'log');
    this.addLog(`日志目录: ${logDir}`);
    this.addLog(`日志目录存在: ${fs.existsSync(logDir)}`);
    
    // 检查可能的模板文件位置
    const possibleTemplates = [
      path.join(appDir, 'config.json.template'),
      path.join(__dirname, '../config.json.template'),
      path.join(process.resourcesPath || __dirname, 'config.json.template'),
      path.join(path.dirname(process.execPath), 'config.json.template'),
      path.join(path.dirname(process.execPath), 'resources', 'config.json.template')
    ];
    
    this.addLog('=== 检查可能的模板文件位置 ===');
    possibleTemplates.forEach(templatePath => {
      this.addLog(`${templatePath}: ${fs.existsSync(templatePath) ? '存在' : '不存在'}`);
    });
    
    // 尝试创建基本目录结构
    try {
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
        this.addLog(`已创建应用目录: ${appDir}`);
      }
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        this.addLog(`已创建日志目录: ${logDir}`);
      }
    } catch (error) {
      this.addLog(`创建目录失败: ${error.message}`);
    }
    
    // 尝试创建配置文件
    if (!fs.existsSync(configPath)) {
      try {
        const defaultConfig = {
          "version": "1.0.0",
          "lastUpdated": new Date().toISOString(),
          "autoRun": false,
          "logLevel": "info",
          "games": {
            "march7thAssistant": {
              "enabled": false,
              "name": "三月七助手",
              "path": "",
              "workingDir": "",
              "arguments": [],
              "waitTime": 60000
            }
          }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        this.addLog(`已创建默认配置文件: ${configPath}`);
      } catch (error) {
        this.addLog(`创建配置文件失败: ${error.message}`);
      }
    }
    
    this.addLog('=== 诊断完成 ===');
    
    // 保存诊断日志
    const diagnosticLogPath = path.join(logDir, `diagnostic_${Date.now()}.log`);
    try {
      fs.writeFileSync(diagnosticLogPath, this.log.join('\n'));
      this.addLog(`诊断日志已保存: ${diagnosticLogPath}`);
    } catch (error) {
      this.addLog(`保存诊断日志失败: ${error.message}`);
    }
    
    return {
      success: true,
      appDir,
      configPath,
      logDir,
      log: this.log
    };
  }

  getAppDirectory() {
    // 判断是否为打包后的应用
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      // 便携版应用目录
      return process.env.PORTABLE_EXECUTABLE_DIR;
    } else if (process.resourcesPath && process.resourcesPath.includes('app.asar')) {
      // 安装版应用，使用exe所在目录
      return path.dirname(process.execPath);
    } else if (process.pkg) {
      // pkg打包的应用
      return path.dirname(process.execPath);
    } else {
      // 开发环境
      return process.cwd();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const diagnostic = new DiagnosticTool();
  diagnostic.runDiagnostics().then(result => {
    console.log('诊断完成，结果:', result);
  }).catch(error => {
    console.error('诊断失败:', error);
  });
}

module.exports = DiagnosticTool;
