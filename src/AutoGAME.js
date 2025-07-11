const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const ProcessMonitor = require('./AutoGAME/ProcessMonitor');

class AutoGAME {
  constructor() {
    // 获取应用程序的实际目录
    this.appDir = this.getAppDirectory();
    this.configPath = path.join(this.appDir, 'config.json');
    this.logDir = path.join(this.appDir, 'log');
    this.config = null;
    
    // 生成本次启动的统一日志文件名
    const startupTime = new Date();
    const timestamp = startupTime.toISOString().replace(/[:.]/g, '-').slice(0, -5); // 格式: 2024-01-01T12-30-45
    this.currentLogFile = path.join(this.logDir, `AutoGAME_${timestamp}.log`);
    
    // 初始化进程监控器
    this.processMonitor = new ProcessMonitor(this);
    
    this.initializeLogDirectory();
    // 延迟启动进程监控，等待配置加载完成
    this.processMonitor.initProcessMonitoring();
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

  async initializeLogDirectory() {
    try {
      if (!fsSync.existsSync(this.logDir)) {
        await fs.mkdir(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async getConfig() {
    try {
      if (fsSync.existsSync(this.configPath)) {
        const configData = await fs.readFile(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
        console.log(`配置文件已加载: ${this.configPath}`);
      } else {
        console.log(`配置文件不存在，创建新配置: ${this.configPath}`);
        // 创建默认配置
        const templatePath = path.join(this.appDir, 'config.json.template');
        const fallbackTemplatePath = path.join(__dirname, '../config.json.template');
        const resourceTemplatePath = path.join(process.resourcesPath || __dirname, 'config.json.template');
        
        let templateData;
        if (fsSync.existsSync(templatePath)) {
          templateData = await fs.readFile(templatePath, 'utf8');
          console.log(`使用模板文件: ${templatePath}`);
        } else if (fsSync.existsSync(fallbackTemplatePath)) {
          templateData = await fs.readFile(fallbackTemplatePath, 'utf8');
          console.log(`使用备用模板文件: ${fallbackTemplatePath}`);
        } else if (fsSync.existsSync(resourceTemplatePath)) {
          templateData = await fs.readFile(resourceTemplatePath, 'utf8');
          console.log(`使用资源模板文件: ${resourceTemplatePath}`);
        } else {
          // 如果模板文件都不存在，创建基本配置
          console.log('未找到模板文件，使用默认配置');
          templateData = JSON.stringify(this.getDefaultConfig(), null, 2);
        }
        
        this.config = JSON.parse(templateData);
        this.config.lastUpdated = new Date().toISOString();
        await this.saveConfig(this.config);
        console.log(`配置文件已创建: ${this.configPath}`);
      }
      return this.config;
    } catch (error) {
      console.error(`读取配置失败: ${error.message}`);
      throw new Error(`读取配置失败: ${error.message}`);
    }
  }

  getDefaultConfig() {
    return {
      "version": "1.0.0",
      "lastUpdated": new Date().toISOString(),
      "autoRun": false,
      "logLevel": "info",
      "maxLogFiles": 10,
      "processMonitoring": {
        "enabled": true,
        "checkInterval": 5000
      },
      "games": {
        "mihoyoBBSTools": {
          "enabled": false,
          "name": "米游社签到工具",
          "path": "",
          "workingDir": "",
          "arguments": [],
          "waitTime": 5000,
          "monitoring": {
            "enabled": false,
            "processName": "",
            "customProcessName": ""
          }
        },
        "march7thAssistant": {
          "enabled": false,
          "name": "三月七助手",
          "path": "",
          "workingDir": "",
          "arguments": [],
          "waitTime": 60000,
          "monitoring": {
            "enabled": true,
            "processName": "HonkaiStarRail.exe",
            "customProcessName": ""
          }
        },
        "zenlessZoneZero": {
          "enabled": false,
          "name": "绝区零一条龙",
          "path": "",
          "workingDir": "",
          "arguments": [],
          "waitTime": 60000,
          "monitoring": {
            "enabled": true,
            "processName": "ZenlessZoneZero.exe",
            "customProcessName": ""
          }
        },
        "betterGenshinImpact": {
          "enabled": false,
          "name": "原神BetterGI",
          "path": "",
          "workingDir": "",
          "arguments": [
            "--background"
          ],
          "waitTime": 60000,
          "monitoring": {
            "enabled": true,
            "processName": "YuanShen.exe",
            "customProcessName": ""
          }
        }
      }
    };
  }

  async saveConfig(config) {
    try {
      config.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.config = config;
      return true;
    } catch (error) {
      throw new Error(`保存配置失败: ${error.message}`);
    }
  }

  async validateConfig() {
    try {
      const config = await this.getConfig();
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        enabledGames: 0,
        totalGames: Object.keys(config.games).length
      };

      for (const [key, game] of Object.entries(config.games)) {
        if (game.enabled) {
          validation.enabledGames++;
          
          // 检查可执行文件路径
          if (!game.path) {
            validation.errors.push(`${game.name}: 未设置可执行文件路径`);
            validation.valid = false;
          } else if (!fsSync.existsSync(game.path)) {
            validation.errors.push(`${game.name}: 可执行文件不存在 - ${game.path}`);
            validation.valid = false;
          }

          // 检查工作目录
          if (game.workingDir && !fsSync.existsSync(game.workingDir)) {
            validation.warnings.push(`${game.name}: 工作目录不存在 - ${game.workingDir}`);
          }
        }
      }

      if (validation.enabledGames === 0) {
        validation.warnings.push('没有启用任何游戏');
      }

      return validation;
    } catch (error) {
      throw new Error(`验证配置失败: ${error.message}`);
    }
  }

  async runSingleGame(gameKey) {
    try {
      const config = await this.getConfig();
      const game = config.games[gameKey];
      
      if (!game) {
        throw new Error(`游戏 ${gameKey} 不存在`);
      }
      
      if (!game.enabled) {
        throw new Error(`游戏 ${gameKey} 未启用`);
      }
      
      if (!game.name) {
        throw new Error(`游戏 ${gameKey} 缺少名称配置`);
      }
      
      if (!game.path) {
        throw new Error(`游戏 ${game.name} 未设置可执行文件路径`);
      }

      const logFile = this.currentLogFile;
      const startTime = Date.now();

      await this.writeLog(logFile, `\n=== 开始执行游戏: ${game.name} (${gameKey}) ===`);
      await this.writeLog(logFile, `可执行文件: ${game.path}`);
      await this.writeLog(logFile, `工作目录: ${game.workingDir || path.dirname(game.path)}`);
      await this.writeLog(logFile, `参数: ${(game.arguments || []).join(' ')}`);
      await this.writeLog(logFile, `应用目录: ${this.appDir}`);
      await this.writeLog(logFile, `进程平台: ${process.platform}`);
      
      // 检查监控模式并记录
      const shouldMonitor = game.monitoring && game.monitoring.enabled &&
        (game.monitoring.processName || game.monitoring.customProcessName);
      if (shouldMonitor) {
        const processName = game.monitoring.customProcessName || game.monitoring.processName;
        await this.writeLog(logFile, `监控模式: 启用 - 将监控进程 "${processName}"`);
      } else {
        await this.writeLog(logFile, `监控模式: 关闭 - 使用阻塞运行，以程序退出为准`);
      }

      return new Promise((resolve, reject) => {
        const workingDir = game.workingDir || path.dirname(game.path);
        
        // 验证工作目录和可执行文件是否存在
        if (!fsSync.existsSync(game.path)) {
          const error = `可执行文件不存在: ${game.path}`;
          this.writeLog(logFile, `错误: ${error}`);
          reject(new Error(error));
          return;
        }
        
        if (!fsSync.existsSync(workingDir)) {
          const error = `工作目录不存在: ${workingDir}`;
          this.writeLog(logFile, `错误: ${error}`);
          reject(new Error(error));
          return;
        }

        // 根据文件扩展名和配置决定执行方式
        const ext = path.extname(game.path).toLowerCase();
        const runAsScript = game.run_as_script || false;
        let command, args, spawnOptions;
        
        // 确保arguments数组存在
        const gameArguments = game.arguments || [];
        
        if (runAsScript || ext === '.py') {
          // 脚本方式运行
          if (ext === '.py') {
            command = 'python';
            args = [game.path, ...gameArguments];
            this.writeLog(logFile, `Python脚本执行: ${command} ${args.join(' ')}`);
            
            spawnOptions = {
              cwd: workingDir,
              stdio: 'pipe',
              shell: true,
              windowsHide: true,
              env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
                PYTHONLEGACYWINDOWSSTDIO: '1',
                PYTHONUNBUFFERED: '1',
                LANG: 'zh_CN.UTF-8',
                LC_ALL: 'zh_CN.UTF-8'
              }
            };
          } else if (ext === '.js') {
            command = 'node';
            args = [game.path, ...gameArguments];
            this.writeLog(logFile, `Node.js脚本执行: ${command} ${args.join(' ')}`);
            
            spawnOptions = {
              cwd: workingDir,
              stdio: 'pipe',
              shell: true,
              windowsHide: true,
              env: {
                ...process.env
              }
            };
          } else {
            const error = `不支持的脚本类型: ${ext}，只支持 .py 和 .js 文件`;
            this.writeLog(logFile, `错误: ${error}`);
            reject(new Error(error));
            return;
          }
        } else {
          // 直接执行可执行文件
          if (gameArguments.length > 0) {
            // 有参数的情况，使用spawn
            // 处理包含空格的路径
            if (game.path.includes(' ')) {
              command = `"${game.path}"`;
            } else {
              command = game.path;
            }
            args = gameArguments;
            this.writeLog(logFile, `可执行文件执行: ${command} ${args.join(' ')}`);
            
            spawnOptions = {
              cwd: workingDir,
              stdio: 'pipe',
              shell: true,
              windowsHide: false,
              detached: false,
              env: { 
                ...process.env, 
                PYTHONIOENCODING: 'utf-8',
                PYTHONLEGACYWINDOWSSTDIO: '1',
                PYTHONUNBUFFERED: '1',
                LANG: 'zh_CN.UTF-8',
                LC_ALL: 'zh_CN.UTF-8'
              }
            };
          } else {
            // 无参数的情况，检查是否需要进程监控
            const shouldMonitor = game.monitoring && game.monitoring.enabled &&
              (game.monitoring.processName || game.monitoring.customProcessName);
              
            if (shouldMonitor) {
              // 如果配置了进程监控，使用spawn以便后续监控
              // 处理包含空格的路径
              if (game.path.includes(' ')) {
                command = `"${game.path}"`;
              } else {
                command = game.path;
              }
              args = [];
              this.writeLog(logFile, `可执行文件执行(监控模式): ${command}`);
              
              spawnOptions = {
                cwd: workingDir,
                stdio: 'pipe',
                shell: true,  // 使用shell执行，避免权限问题
                windowsHide: false,
                detached: false,
                env: { 
                  ...process.env, 
                  PYTHONIOENCODING: 'utf-8',
                  PYTHONLEGACYWINDOWSSTDIO: '1',
                  PYTHONUNBUFFERED: '1',
                  LANG: 'zh_CN.UTF-8',
                  LC_ALL: 'zh_CN.UTF-8'
                }
              };
            } else {
              // 没有配置监控，使用简单启动方式
              this.writeLog(logFile, `直接启动文件: ${game.path}`);
              
              const { exec } = require('child_process');
              exec(`start "" "${game.path}"`, { cwd: workingDir }, (error) => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                if (error) {
                  this.writeLog(logFile, `启动文件失败: ${error.message}`);
                  this.writeLog(logFile, `执行时长: ${duration}ms`);
                  reject(new Error(`启动 ${game.name} 失败: ${error.message}`));
                } else {
                  this.writeLog(logFile, `文件启动成功`);
                  this.writeLog(logFile, `执行时长: ${duration}ms`);
                  resolve({
                    success: true,
                    gameKey,
                    gameName: game.name,
                    duration,
                    output: 'file launched successfully',
                    logFile
                  });
                }
              });
              return;
            }
          }
        }

        // 启动进程
        const childProcess = spawn(command, args, spawnOptions);

        let output = '';
        let errorOutput = '';

        // 设置超时机制（5分钟）
        const timeout = setTimeout(() => {
          this.writeLog(logFile, `执行超时（5分钟），强制结束进程`);
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        }, 300000);

        childProcess.stdout.on('data', (data) => {
          // 使用智能编码解码
          let text = this.smartDecodeText(data);
          // 进一步修复混合编码问题
          text = this.fixMixedEncodingText(text);
          output += text;
          
          // 实时记录输出
          const lines = text.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              this.writeLog(logFile, `stdout: ${line.trim()}`);
              this.sendRealTimeLog(gameKey, `stdout: ${line.trim()}`); // 发送实时日志
            }
          }
        });

        childProcess.stderr.on('data', (data) => {
          // 使用智能编码解码
          let text = this.smartDecodeText(data);
          // 进一步修复混合编码问题
          text = this.fixMixedEncodingText(text);
          errorOutput += text;
          
          // 智能处理stderr输出
          const lines = text.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const trimmedLine = line.trim();
              // 检查是否是真正的错误信息
              const isActualError = trimmedLine.match(/error|exception|traceback|failed|failure/i) && 
                                   !trimmedLine.match(/info|正在|已获取|今天获得|签到/i);
              
              if (isActualError) {
                this.writeLog(logFile, `stderr(错误): ${trimmedLine}`);
                this.sendRealTimeLog(gameKey, `stderr(错误): ${trimmedLine}`); // 发送实时日志
              } else if (!trimmedLine.includes('WARNING') && !trimmedLine.includes('DEBUG')) {
                this.writeLog(logFile, `stderr(信息): ${trimmedLine}`);
                this.sendRealTimeLog(gameKey, `stderr(信息): ${trimmedLine}`); // 发送实时日志
              }
            }
          }
        });

        childProcess.on('close', async (code, signal) => {
          clearTimeout(timeout);
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          await this.writeLog(logFile, `执行完成，退出码: ${code}`);
          if (signal) {
            await this.writeLog(logFile, `退出信号: ${signal}`);
          }
          await this.writeLog(logFile, `执行时长: ${duration}ms`);

          // 改进内容：
          // 1. 统一使用退出码判断执行结果，不再依赖日志输出内容
          // 2. 改进签到脚本识别，支持更多签到工具
          // 3. 增强进程监控稳定性，使用连续失败检测机制
          // 4. 增加更详细的日志记录用于调试
          // 
          // 特殊处理签到类任务 - 统一使用退出码判断
          const isSignTask = gameKey === 'mihoyoBBSTools' || 
                           gameKey.includes('sign') || 
                           game.name.includes('签到') ||
                           (game.path && (game.path.includes('sign') || game.path.includes('签到')));
          
          if (isSignTask) {
            // 签到类任务：检查是否配置了进程监控
            const shouldMonitor = game.monitoring && game.monitoring.enabled &&
              (game.monitoring.processName || game.monitoring.customProcessName);
              
            if (shouldMonitor) {
              // 配置了进程监控的签到任务：监控指定进程
              const processName = game.monitoring.customProcessName || game.monitoring.processName;
              await this.writeLog(logFile, `签到任务配置了进程监控，忽略脚本退出码(${code})，开始监控进程: ${processName}`);
              
              try {
                await this.processMonitor.waitForProcessCompletion(processName, gameKey, logFile);
                await this.writeLog(logFile, `监控进程 ${processName} 已完成`);
                
                // 解析奖励信息
                const fullOutput = (output + '\n' + errorOutput).trim();
                if (fullOutput) {
                  this.parseAndDisplayRewards(fullOutput, game.name);
                }
                
                resolve({
                  success: true,
                  gameKey,
                  gameName: game.name,
                  duration: Date.now() - startTime,
                  output: fullOutput || '签到执行完成',
                  logFile,
                  exitCode: code
                });
              } catch (monitorError) {
                await this.writeLog(logFile, `监控进程失败: ${monitorError.message}`);
                reject(new Error(`监控进程失败: ${monitorError.message}`));
              }
            } else {
              // 没有配置进程监控的签到任务：阻塞运行，根据退出码判断
              const isSuccess = (code === 0);
              await this.writeLog(logFile, isSuccess ? '签到脚本阻塞运行完成' : `签到脚本阻塞运行失败，退出码: ${code}`);
              
              if (isSuccess) {
                // 合并stdout和stderr输出，因为有些签到工具将信息输出到stderr
                const fullOutput = (output + '\n' + errorOutput).trim();
                
                // 立即解析签到奖励信息并显示到实时区域
                if (fullOutput) {
                  this.parseAndDisplayRewards(fullOutput, game.name);
                }
                
                // 记录执行时长统计
                this.processMonitor.totalAccumulatedRuntime += duration;
                this.processMonitor.completedProcesses.set(gameKey, {
                  name: game.name,
                  runTime: duration,
                  endTime: endTime,
                  isBlockingTask: true,
                  isSignTask: true
                });
                
                // 更新进程状态为完成
                const processInfo = this.processMonitor.runningProcesses.get(gameKey);
                if (processInfo) {
                  processInfo.endTime = endTime;
                  processInfo.status = 'completed';
                  processInfo.runTime = duration;
                  
                  // 延迟清理进程状态，让前端有时间显示完成状态
                  setTimeout(() => {
                    this.processMonitor.runningProcesses.delete(gameKey);
                  }, 3000);
                }
                
                this.log(`签到脚本阻塞运行时长统计: +${this.processMonitor.formatDuration(duration / 1000)}, 累计总时长: ${this.processMonitor.formatDuration(this.processMonitor.totalAccumulatedRuntime / 1000)}`);
                
                resolve({
                  success: true,
                  gameKey,
                  gameName: game.name,
                  duration,
                  output: fullOutput || '签到执行完成',
                  logFile,
                  exitCode: code
                });
              } else {
                const errorMsg = `${game.name} 签到失败，退出码: ${code}${signal ? `, 信号: ${signal}` : ''}\n错误输出: ${errorOutput}`;
                await this.writeLog(logFile, `失败: ${errorMsg}`);
                
                // 更新失败任务的进程状态
                const processInfo = this.processMonitor.runningProcesses.get(gameKey);
                if (processInfo) {
                  processInfo.endTime = endTime;
                  processInfo.status = 'failed';
                  processInfo.runTime = duration;
                  
                  // 延迟清理进程状态，让前端有时间显示失败状态
                  setTimeout(() => {
                    this.processMonitor.runningProcesses.delete(gameKey);
                  }, 5000);
                }
                
                reject(new Error(errorMsg));
              }
            }
            return;
          }

          // 检查是否配置了进程监控
          const shouldMonitor = game.monitoring && game.monitoring.enabled &&
            (game.monitoring.processName || game.monitoring.customProcessName);
          
          // 判断任务是否完成的逻辑
          let isSuccess = false;
          
          if (shouldMonitor) {
            // 配置了进程监控：忽略启动程序的退出状态，直接监控目标进程
            const processName = game.monitoring.customProcessName || game.monitoring.processName;
            await this.writeLog(logFile, `配置了进程监控，忽略启动程序退出码(${code})，开始监控进程: ${processName}`);
            
            // 启动程序可能已经退出，但我们只关心监控的目标进程
            try {
              await this.processMonitor.waitForProcessCompletion(processName, gameKey, logFile);
              await this.writeLog(logFile, `监控进程 ${processName} 已完成`);
              isSuccess = true;
            } catch (monitorError) {
              await this.writeLog(logFile, `监控进程失败: ${monitorError.message}`);
              reject(new Error(`监控进程失败: ${monitorError.message}`));
              return;
            }
          } else {
            // 没有配置进程监控：阻塞运行，以启动的脚本或应用结束作为计时标准
            isSuccess = (code === 0);
            
            if (runAsScript || ext === '.py' || ext === '.js') {
              await this.writeLog(logFile, `脚本阻塞运行完成，退出码: ${code}`);
            } else {
              await this.writeLog(logFile, `应用阻塞运行完成，退出码: ${code}`);
            }
            
            if (!isSuccess && errorOutput.trim()) {
              await this.writeLog(logFile, `错误详情: ${errorOutput.trim()}`);
            }
          }

          if (isSuccess) {
            // 解析奖励信息（主要针对签到脚本）
            if (output && (gameKey === 'mihoyoBBSTools' || gameKey.includes('sign'))) {
              this.parseAndDisplayRewards(output, game.name);
            }
            
            // 对于没有配置进程监控的任务，记录执行时长统计
            if (!shouldMonitor) {
              this.processMonitor.totalAccumulatedRuntime += duration;
              this.processMonitor.completedProcesses.set(gameKey, {
                name: game.name,
                runTime: duration,
                endTime: endTime,
                isBlockingTask: true // 标记为阻塞运行的任务
              });
              
              const taskType = (runAsScript || ext === '.py' || ext === '.js') ? '脚本' : '应用';
              this.log(`${taskType}阻塞运行时长统计: +${this.processMonitor.formatDuration(duration / 1000)}, 累计总时长: ${this.processMonitor.formatDuration(this.processMonitor.totalAccumulatedRuntime / 1000)}`);
            }
            
            // 无论是否配置了进程监控，都需要清理进程状态
            const processInfo = this.processMonitor.runningProcesses.get(gameKey);
            if (processInfo) {
              processInfo.endTime = endTime;
              processInfo.status = 'completed';
              processInfo.runTime = duration;
              
              // 延迟清理进程状态，让前端有时间显示完成状态
              setTimeout(() => {
                this.processMonitor.runningProcesses.delete(gameKey);
              }, 3000);
            }
            
            await this.writeLog(logFile, `=== 游戏执行成功完成: ${game.name} ===\n`);
            
            resolve({
              success: true,
              gameKey,
              gameName: game.name,
              duration,
              output: output.trim() || '执行完成',
              logFile,
              exitCode: code
            });
          } else {
            const errorMsg = `${game.name} 执行失败，退出码: ${code}${signal ? `, 信号: ${signal}` : ''}\n错误输出: ${errorOutput}`;
            await this.writeLog(logFile, `失败: ${errorMsg}`);
            await this.writeLog(logFile, `=== 游戏执行失败完成: ${game.name} ===\n`);
            
            // 清理失败任务的进程状态
            const processInfo = this.processMonitor.runningProcesses.get(gameKey);
            if (processInfo) {
              processInfo.endTime = endTime;
              processInfo.status = 'failed';
              processInfo.runTime = duration;
              
              // 延迟清理进程状态，让前端有时间显示失败状态
              setTimeout(() => {
                this.processMonitor.runningProcesses.delete(gameKey);
              }, 5000);
            }
            
            reject(new Error(errorMsg));
          }
        });

        childProcess.on('error', async (error) => {
          clearTimeout(timeout);
          const formattedError = this.formatErrorMessage(error, game.name, game.path);
          
          await this.writeLog(logFile, `启动失败: ${formattedError}`);
          await this.writeLog(logFile, `错误代码: ${error.code || 'Unknown'}`);
          await this.writeLog(logFile, `错误堆栈: ${error.stack}`);
          await this.writeLog(logFile, `=== 游戏启动失败: ${game.name} ===\n`);
          
          // 清理启动失败任务的进程状态
          const processInfo = this.processMonitor.runningProcesses.get(gameKey);
          if (processInfo) {
            processInfo.endTime = Date.now();
            processInfo.status = 'error';
            processInfo.runTime = Date.now() - startTime;
            
            // 延迟清理进程状态，让前端有时间显示错误状态
            setTimeout(() => {
              this.processMonitor.runningProcesses.delete(gameKey);
            }, 5000);
          }
          
          reject(new Error(formattedError));
        });

        // 检查进程是否成功启动
        setTimeout(() => {
          if (!childProcess.killed && childProcess.pid) {
            this.writeLog(logFile, `进程已启动，PID: ${childProcess.pid}`);
          } else if (!childProcess.pid) {
            this.writeLog(logFile, `警告：进程可能启动失败`);
          }
        }, 2000);

        // 存储进程信息用于监控和状态显示
        const shouldMonitor = game.monitoring && game.monitoring.enabled &&
          (game.monitoring.processName || game.monitoring.customProcessName);
           
        if (shouldMonitor) {
          const processName = game.monitoring.customProcessName || game.monitoring.processName;
          if (processName) {
            // 对于非脚本类程序，进程监控将在close事件中处理
            // 这里只是记录基本信息用于状态显示
            if (runAsScript || ext === '.py' || ext === '.js') {
              // 脚本类程序仍然使用原有的监控方式
              this.processMonitor.runningProcesses.set(gameKey, {
                pid: childProcess.pid,
                name: game.name,
                processName: processName,
                startTime: startTime,
                childProcess: childProcess,
                runTime: 0
              });
              console.log(`已启动脚本进程监控: ${game.name} -> PID: ${childProcess.pid}`);
            } else {
              console.log(`将监控进程: ${game.name} -> ${processName} (启动后开始)`);
            }
          }
        } else {
          // 未开启进程监控的任务也需要在运行时显示状态
          this.processMonitor.runningProcesses.set(gameKey, {
            pid: childProcess.pid,
            name: game.name,
            processName: null, // 没有监控进程名
            startTime: startTime,
            childProcess: childProcess,
            runTime: 0,
            isBlockingTask: true, // 标记为阻塞运行任务
            isSignInTask: (gameKey === 'mihoyoBBSTools' || 
                          gameKey.includes('sign') || 
                          game.name.includes('签到') ||
                          (game.path && (game.path.includes('sign') || game.path.includes('签到')))),
            status: 'running'
          });
          console.log(`已启动阻塞运行任务: ${game.name} -> PID: ${childProcess.pid || 'Unknown'}`);
          this.log(`${game.name}: 阻塞运行模式启动，PID: ${childProcess.pid || 'Unknown'}`);
          this.sendRealTimeLog(gameKey, `阻塞运行模式启动，PID: ${childProcess.pid || 'Unknown'}`);
        }
      });
    } catch (error) {
      // 记录执行失败的分隔符
      await this.writeLog(this.currentLogFile, `=== 游戏执行失败: ${error.message} ===\n`);
      console.error(`执行游戏失败: ${error.message}`);
      throw new Error(`执行游戏失败: ${error.message}`);
    }
  }

  /**
   * 解析并显示签到奖励信息
   * @param {string} output 脚本执行的输出内容
   * @param {string} gameName 游戏名称
   */
  parseAndDisplayRewards(output, gameName) {
    try {
      // 查找奖励相关的输出行
      const lines = output.split('\n');
      const rewardLines = [];
      
      // 匹配包含奖励信息的行
      const rewardPatterns = [
        /今天获得的奖励是[「『]([^」』]+)[」』].*?x(\d+)/,
        /获得.*?[「『]([^」』]+)[」』].*?x(\d+)/,
        /签到奖励.*?[「『]([^」』]+)[」』].*?x(\d+)/,
        /今日奖励.*?[「『]([^」』]+)[」』].*?x(\d+)/
      ];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // 检查是否包含奖励信息
        for (const pattern of rewardPatterns) {
          if (pattern.test(trimmedLine)) {
            rewardLines.push(trimmedLine);
            console.log(`${gameName}奖励: ${trimmedLine}`);
            break;
          }
        }
        
        // 检查状态信息
        if (trimmedLine.includes('已签到') || trimmedLine.includes('已经签到')) {
          console.log(`${gameName}状态: ${trimmedLine}`);
        } else if (trimmedLine.includes('签到') && trimmedLine.includes('成功')) {
          console.log(`${gameName}状态: ${trimmedLine}`);
        }
      }
      
      if (rewardLines.length === 0) {
        console.log(`${gameName}: 未检测到具体奖励信息`);
      }
      
    } catch (error) {
      console.error(`解析奖励信息时出错: ${error.message}`);
    }
  }

  async runAllGames() {
    try {
      const config = await this.getConfig();
      const results = [];
      const errors = [];

      const enabledGames = Object.entries(config.games).filter(([key, game]) => game.enabled);
      
      if (enabledGames.length === 0) {
        throw new Error('没有启用任何游戏');
      }

      for (const [gameKey, game] of enabledGames) {
        try {
          const result = await this.runSingleGame(gameKey);
          results.push(result);
          
          // 签到类任务使用较短的等待时间
          let waitTime = game.waitTime || 0;
          if (gameKey === 'mihoyoBBSTools') {
            waitTime = Math.min(waitTime, 5000); // 签到任务最多等待5秒
          }
          
          if (waitTime > 0) {
            await this.sleep(waitTime);
          }
        } catch (error) {
          errors.push({
            gameKey,
            gameName: game.name || gameKey,
            error: error.message
          });
        }
      }

      return {
        success: results.length > 0,
        results,
        errors,
        summary: {
          total: enabledGames.length,
          successful: results.length,
          failed: errors.length
        }
      };
    } catch (error) {
      throw new Error(`批量执行失败: ${error.message}`);
    }
  }

  startProcessMonitoring() {
    if (this.processMonitor) {
      this.processMonitor.startProcessMonitoring();
    }
  }

  stopProcessMonitoring() {
    this.processMonitor.stopProcessMonitoring();
  }

  async updateProcessStatus() {
    return this.processMonitor.updateProcessStatus();
  }

  async isProcessRunning(processName) {
    return this.processMonitor.isProcessRunning(processName);
  }

  // ===== 仪表盘功能方法 =====
  
  async stopAllProcesses() {
    return this.processMonitor.stopAllProcesses();
  }
  
  async stopProcess(processKey) {
    return this.processMonitor.stopProcess(processKey);
  }
  
  async getRealtimeLogs() {
    try {
      // 直接读取当前启动的日志文件
      if (fsSync.existsSync(this.currentLogFile)) {
        const content = await fs.readFile(this.currentLogFile, 'utf8');
        return { content };
      }
      
      return { content: '' };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  getProcessStatus() {
    const monitoringStatus = this.processMonitor.getMonitoringStatus();
    
    // 将后端的进程数据转换为前端兼容的格式
    const processes = {};
    monitoringStatus.runningProcesses.forEach(process => {
      processes[process.gameKey] = {
        name: process.name,
        processName: process.processName,
        startTime: process.startTime,
        endTime: process.endTime,
        status: process.status,
        pid: process.pid
      };
    });
    
    return {
      ...monitoringStatus,
      processes: processes
    };
  }
  
  async getSignInDetails() {
    try {
      // 从当前启动的日志文件中解析签到详情
      const signInDetails = {};
      
      if (fsSync.existsSync(this.currentLogFile)) {
        const content = await fs.readFile(this.currentLogFile, 'utf8');
        
        // 解析米游社签到信息
        if (content.includes('米游社签到')) {
          signInDetails.mihoyo = {
            name: '米游社',
            icon: '🎮',
            status: content.includes('签到成功') ? 'success' : 'failed',
            statusText: content.includes('签到成功') ? '已签到' : '签到失败'
          };
          
          // 解析米游币数量
          const coinMatch = content.match(/(\d+)\s*个米游币/);
          if (coinMatch) {
            signInDetails.mihoyo.reward = `${coinMatch[1]} 米游币`;
          }
        }
        
        // 解析原神签到信息
        if (content.includes('原神') && content.includes('签到')) {
          signInDetails.genshin = {
            name: '原神',
            icon: '⚔️',
            status: content.includes('签到成功') ? 'success' : 'failed',
            statusText: content.includes('签到成功') ? '已签到' : '签到失败'
          };
        }
        
        // 解析星铁签到信息
        if (content.includes('星铁') && content.includes('签到')) {
          signInDetails.starrail = {
            name: '星穹铁道',
            icon: '🚂',
            status: content.includes('签到成功') ? 'success' : 'failed',
            statusText: content.includes('签到成功') ? '已签到' : '签到失败'
          };
        }
        
        // 解析绝区零签到信息
        if (content.includes('绝区零') && content.includes('签到')) {
          signInDetails.zenless = {
            name: '绝区零',
            icon: '🏙️',
            status: content.includes('签到成功') ? 'success' : 'failed',
            statusText: content.includes('签到成功') ? '已签到' : '签到失败'
          };
        }
      }
      
      return signInDetails;
    } catch (error) {
      return { error: error.message };
    }
  }

  async initializeApp() {
    try {
      // 确保应用目录存在
      if (!fsSync.existsSync(this.appDir)) {
        await fs.mkdir(this.appDir, { recursive: true });
      }
      
      // 确保日志目录存在
      await this.initializeLogDirectory();
      
      // 在统一日志文件中记录启动信息
      const startupTime = new Date().toISOString();
      await this.writeLog(this.currentLogFile, `\n${'='.repeat(80)}`);
      await this.writeLog(this.currentLogFile, `AutoGAME 启动时间: ${startupTime}`);
      await this.writeLog(this.currentLogFile, `应用目录: ${this.appDir}`);
      await this.writeLog(this.currentLogFile, `配置文件: ${this.configPath}`);
      await this.writeLog(this.currentLogFile, `日志文件: ${this.currentLogFile}`);
      await this.writeLog(this.currentLogFile, `${'='.repeat(80)}\n`);
      
      // 初始化配置文件
      await this.getConfig();
      
      console.log(`应用已初始化:`);
      console.log(`- 应用目录: ${this.appDir}`);
      console.log(`- 配置文件: ${this.configPath}`);
      console.log(`- 日志目录: ${this.logDir}`);
      
      return true;
    } catch (error) {
      console.error('应用初始化失败:', error);
      return false;
    }
  }

  async writeLog(logFile, message) {
    const timestamp = new Date().toISOString();
    // 修复消息中的编码问题
    const fixedMessage = this.fixMixedEncodingText(message);
    const logMessage = `[${timestamp}] ${fixedMessage}\n`;
    try {
      // 确保使用UTF-8编码写入日志文件
      await fs.appendFile(logFile, logMessage, 'utf8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  log(message) {
    console.log(`[AutoGAME] ${message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getLogs() {
    try {
      const logFiles = await fs.readdir(this.logDir);
      const logs = [];

      for (const file of logFiles.slice(-10)) { // 只返回最近10个日志文件
        const logPath = path.join(this.logDir, file);
        const content = await fs.readFile(logPath, 'utf8');
        const stats = await fs.stat(logPath);
        
        logs.push({
          filename: file,
          content: content.split('\n').slice(-100).join('\n'), // 只返回最后100行
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }

      return logs.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      throw new Error(`获取日志失败: ${error.message}`);
    }
  }

  async autoDetectGames() {
    const detectedPaths = {};
    const commonPaths = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'D:\\Program Files',
      'D:\\Games',
      process.env.USERPROFILE + '\\Desktop',
      process.env.USERPROFILE + '\\Downloads'
    ];

    // 常见游戏可执行文件名
    const gameExecutables = {
      mihoyoBBSTools: ['main.py', 'run.py'],
      march7thAssistant: ['March7thAssistant.exe', 'StarRailAssistant.exe'],
      zenlessZoneZero: ['OneDragon Launcher.exe', 'OneDragon.exe', 'ZenlessZoneZero.exe'],
      betterGenshinImpact: ['BetterGI.exe', 'BetterGenshinImpact.exe']
    };

    for (const [gameKey, executables] of Object.entries(gameExecutables)) {
      for (const basePath of commonPaths) {
        try {
          if (fsSync.existsSync(basePath)) {
            const found = await this.searchExecutable(basePath, executables);
            if (found) {
              detectedPaths[gameKey] = found;
              break;
            }
          }
        } catch (error) {
          // 忽略访问错误
        }
      }
    }

    return detectedPaths;
  }

  async searchExecutable(basePath, executables, maxDepth = 3) {
    if (maxDepth <= 0) return null;

    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(basePath, entry.name);
        
        if (entry.isFile() && executables.includes(entry.name)) {
          return fullPath;
        }
        
        if (entry.isDirectory() && maxDepth > 1) {
          const found = await this.searchExecutable(fullPath, executables, maxDepth - 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // 忽略权限错误
    }
    
    return null;
  }

  /**
   * 格式化持续时间
   * @param {number} seconds 秒数
   * @returns {string} 格式化的时间字符串
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟${secs}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  }

  /**
   * 只记录到日志文件，不在控制台显示
   * @param {string} message 消息
   */
  logOnly(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // 写入到当前启动的统一日志文件
    try {
      require('fs').appendFileSync(this.currentLogFile, logMessage);
    } catch (error) {
      // 忽略写入错误
    }
  }

  /**
   * 任务队列管理 - 委托给 ProcessMonitor
   */
  async addToQueue(gameKey, priority = 0) {
    return this.processMonitor.addToQueue(gameKey, priority);
  }

  /**
   * 队列处理 - 委托给 ProcessMonitor
   */
  async processQueue() {
    return this.processMonitor.processQueue();
  }

  /**
   * 智能等待时间计算 - 委托给 ProcessMonitor
   */
  calculateSmartWaitTime(gameKey) {
    return this.processMonitor.calculateSmartWaitTime(gameKey);
  }

  /**
   * 执行单个游戏任务
   */
  async executeGameTask(gameKey) {
    const game = this.config.games[gameKey];
    if (!game || !game.enabled) {
      throw new Error(`游戏 ${gameKey} 未启用或不存在`);
    }

    return this.runSingleGame(gameKey);
  }

  /**
   * 安全的单个游戏运行方法
   */
  async runSingleGameSafe(gameKey) {
    // 使用任务队列确保不冲突
    return this.addToQueue(gameKey, 1); // 单独运行有更高优先级
  }

  /**
   * 安全的批量游戏运行方法（智能等待）
   */
  async runAllGamesSafe(gameOrder = null) {
    try {
      const config = await this.getConfig();
      
      let enabledGames;
      if (gameOrder && Array.isArray(gameOrder)) {
        // 使用指定的游戏顺序
        enabledGames = gameOrder
          .filter(gameKey => config.games[gameKey] && config.games[gameKey].enabled)
          .map(gameKey => [gameKey, config.games[gameKey]]);
      } else {
        // 使用默认顺序（所有启用的游戏）
        enabledGames = Object.entries(config.games).filter(([key, game]) => game.enabled);
      }
      
      if (enabledGames.length === 0) {
        throw new Error('没有启用任何游戏');
      }

      this.log(`开始批量执行 ${enabledGames.length} 个游戏任务，顺序: ${enabledGames.map(([key, game]) => game.name).join(' -> ')}`);
      
      // 先将所有任务添加到队列中，不等待执行结果
      const taskPromises = [];
      for (const [gameKey, game] of enabledGames) {
        this.log(`添加任务到队列: ${game.name} (${gameKey})`);
        taskPromises.push(this.addToQueue(gameKey, 0));
      }
      
      // 等待所有任务完成
      const results = [];
      const errors = [];
      
      for (let i = 0; i < taskPromises.length; i++) {
        const [gameKey, game] = enabledGames[i];
        try {
          const result = await taskPromises[i];
          results.push(result);
          this.log(`任务完成: ${game.name} (${gameKey})`);
        } catch (error) {
          errors.push({
            gameKey,
            gameName: game.name || gameKey,
            error: error.message
          });
          this.log(`任务失败: ${game.name} (${gameKey}) - ${error.message}`);
        }
      }

      const summary = {
        total: enabledGames.length,
        successful: results.length,
        failed: errors.length
      };

      this.log(`批量执行完成: 成功 ${summary.successful}/${summary.total}`);
      
      return {
        success: results.length > 0,
        results,
        errors,
        summary
      };
    } catch (error) {
      throw new Error(`批量执行失败: ${error.message}`);
    }
  }

  /**
   * 获取当前任务队列状态 - 委托给 ProcessMonitor
   */
  getQueueStatus() {
    return {
      queueLength: this.processMonitor.taskQueue.length,
      isExecuting: this.processMonitor.isExecutingTask,
      currentTask: this.processMonitor.isExecutingTask ? this.processMonitor.taskQueue[0]?.gameKey : null,
      nextTasks: this.processMonitor.taskQueue.slice(1, 4).map(t => t.gameKey) // 显示接下来的3个任务
    };
  }

  /**
   * 监控指定进程 - 委托给 ProcessMonitor
   */
  async monitorProcess(processName, startCommand, args = null) {
    return this.processMonitor.monitorProcess(processName, startCommand, args);
  }

  /**
   * 启动进程 - 委托给 ProcessMonitor
   */
  async startProcess(command, waitForExit = true, args = null) {
    return this.processMonitor.startProcess(command, waitForExit, args);
  }

  /**
   * 停止当前监控 - 委托给 ProcessMonitor
   */
  stopMonitoring() {
    return this.processMonitor.stopMonitoring();
  }

  /**
   * 格式化错误消息，提供更友好的错误信息
   * @param {Error} error 错误对象
   * @param {string} gameName 游戏名称
   * @param {string} gamePath 游戏路径
   * @returns {string} 格式化后的错误消息
   */
  formatErrorMessage(error, gameName, gamePath) {
    let message = error.message;
    
    if (error.code === 'EACCES') {
      message = `权限错误：无法执行 ${gameName}\n` +
        `文件路径：${gamePath}\n` +
        `解决方案：\n` +
        `1. 确认文件存在且有执行权限\n` +
        `2. 尝试以管理员身份运行程序\n` +
        `3. 检查杀毒软件是否阻止了文件执行\n` +
        `4. 确认文件路径中没有特殊字符`;
    } else if (error.code === 'ENOENT') {
      message = `文件不存在：${gamePath}\n` +
        `请检查文件路径是否正确`;
    } else if (error.code === 'ENOTDIR') {
      message = `路径错误：${gamePath}\n` +
        `指定的路径不是有效的文件路径`;
    } else if (message.includes('spawn') && message.includes('EACCES')) {
      message = `启动 ${gameName} 失败：权限被拒绝\n` +
        `请尝试以管理员身份运行程序，或检查文件权限`;
    }
    
    return message;
  }

  /**
   * 设置主进程引用，用于发送实时日志
   */
  setMainProcess(mainProcess) {
    this.mainProcess = mainProcess;
  }

  /**
   * 发送实时日志到渲染进程
   */
  sendRealTimeLog(gameKey, logEntry) {
    if (this.mainProcess) {
      this.mainProcess.sendToRenderer('realtime-log', {
        gameKey,
        logEntry,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 智能解码文本，处理中文编码问题
   * @param {Buffer} data 原始数据
   * @returns {string} 解码后的文本
   */
  smartDecodeText(data) {
    let text;
    try {
      const iconv = require('iconv-lite');
      
      // 检查数据是否为空
      if (!data || data.length === 0) {
        return '';
      }
      
      // 尝试多种编码方式，并检测编码质量
      const encodings = ['gbk', 'utf8', 'gb2312', 'cp936', 'big5'];
      let bestText = '';
      let bestScore = -1;
      
      for (const encoding of encodings) {
        try {
          const decodedText = iconv.decode(data, encoding);
          const score = this.calculateTextQuality(decodedText);
          
          if (score > bestScore) {
            bestScore = score;
            bestText = decodedText;
          }
          
          // 如果获得了高质量的文本，直接使用
          if (score >= 0.9) {
            break;
          }
        } catch (e) {
          // 忽略编码错误，继续尝试下一种编码
          continue;
        }
      }
      
      // 如果所有编码都失败，使用默认方式
      if (bestScore < 0) {
        bestText = data.toString('utf8');
      }
      
      text = bestText;
      
    } catch (error) {
      console.warn('智能编码解码失败，使用默认 UTF-8:', error.message);
      text = data.toString('utf8');
    }
    
    return text;
  }

  /**
   * 处理混合编码的文本，逐行检测和修复编码
   * @param {string} text 可能包含混合编码的文本
   * @returns {string} 修复后的文本
   */
  fixMixedEncodingText(text) {
    try {
      const lines = text.split('\n');
      const fixedLines = [];
      
      for (const line of lines) {
        if (!line.trim()) {
          fixedLines.push(line);
          continue;
        }
        
        // 检查这一行是否包含乱码
        if (this.containsGarbledText(line)) {
          // 尝试修复这一行
          const fixedLine = this.fixGarbledLine(line);
          fixedLines.push(fixedLine);
        } else {
          fixedLines.push(line);
        }
      }
      
      return fixedLines.join('\n');
    } catch (error) {
      console.warn('修复混合编码文本时出错:', error.message);
      return text;
    }
  }

  /**
   * 检查文本是否包含乱码
   * @param {string} text 要检查的文本
   * @returns {boolean} 是否包含乱码
   */
  containsGarbledText(text) {
    // 检查是否包含明显的乱码字符
    return /[ï¿½�]/.test(text) || 
           /[\x00-\x08\x0e-\x1f\x7f-\x9f]/.test(text) ||
           // 检查典型的GBK到UTF-8错误转换模式
           /[姝｜涓｜绛｜鑾｜鍙峯]/.test(text);
  }

  /**
   * 修复乱码行
   * @param {string} line 包含乱码的行
   * @returns {string} 修复后的行
   */
  fixGarbledLine(line) {
    try {
      const iconv = require('iconv-lite');
      
      // 常见乱码字符映射
      const garbledMap = {
        '姝ｅ湪': '正在',
        '绛惧埌': '签到', 
        '鑾峰緱': '获得',
        '浠诲姟': '任务',
        '瀹屾垚': '完成',
        '鍒楄〃': '列表',
        '浼间箮': '似乎',
        '杩樻湁': '还有',
        '娌″畬鎴愶': '没完成',
        '浠婂ぉ': '今天',
        '杩樿兘': '还能',
        '涓背娓稿竵': '个米游币',
        '宸茶幏鍙�': '已获取',
        '涓笘瀛�': '个世界',
        '涓帖瀛�': '个帖子',
        '涓篃璇�': '个也说',
        '鑾峰彇': '获取',
        '甯栧瓙': '帖子',
        '鐩稿叧': '相关',
        '鎵ц': '执行',
        '鐪嬪笘': '看帖',
        '鐐硅禐': '点赞',
        '鍒嗕韩': '分享',
        '宸插叏閮�': '已全部',
        '紝': '，',
        '銆�': '。',
        '锛�': '：',
        '锛�': '；',
        '锛�': '（',
        '锛�': '）',
        '銆�': '【',
        '銆�': '】',
        '锛�': '、',
        '锛�': '！',
        '锛�': '？'
      };
      
      let fixedLine = line;
      
      // 首先尝试直接替换已知的乱码模式
      for (const [garbled, correct] of Object.entries(garbledMap)) {
        fixedLine = fixedLine.replace(new RegExp(garbled, 'g'), correct);
      }
      
      // 如果还有乱码，尝试重新编码
      if (this.containsGarbledText(fixedLine)) {
        try {
          // 尝试将UTF-8误读的GBK文本重新编码
          const buffer = Buffer.from(line, 'utf8');
          const reEncoded = iconv.decode(buffer, 'gbk');
          
          // 检查重新编码后的质量
          if (this.calculateTextQuality(reEncoded) > this.calculateTextQuality(fixedLine)) {
            fixedLine = reEncoded;
          }
        } catch (e) {
          // 忽略重新编码错误
        }
      }
      
      return fixedLine;
    } catch (error) {
      console.warn('修复乱码行时出错:', error.message);
      return line;
    }
  }

  /**
   * 获取详细的运行状态和建议
   */
  getDetailedStatus() {
    return this.processMonitor.getMonitoringStatus();
  }
}

module.exports = AutoGAME;
