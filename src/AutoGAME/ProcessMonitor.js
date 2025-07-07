const { spawn, exec } = require('child_process');
const path = require('path');

/**
 * 进程监控管理器
 * 负责监控游戏进程、OCR任务、防止冲突等功能
 */
class ProcessMonitor {
  constructor(autoGame) {
    this.autoGame = autoGame;
    this.runningProcesses = new Map();
    this.processMonitor = null;
    
    // 监控相关属性
    this.currentMonitoringProcess = null;
    this.currentMonitoringStartTime = null;
    this.isMonitoring = false;
    
    // 任务队列管理
    this.taskQueue = [];
    this.isExecutingTask = false;
    
    // 累计运行时长（毫秒）
    this.totalAccumulatedRuntime = 0;
    this.completedProcesses = new Map(); // 存储已完成进程的运行时长
  }

  /**
   * 初始化进程监控
   */
  async initProcessMonitoring() {
    try {
      // 初始化累计时长（本次启动周期）
      this.totalAccumulatedRuntime = 0;
      this.completedProcesses = new Map();
      
      // 等待一小段时间让其他初始化完成
      setTimeout(async () => {
        try {
          const config = await this.autoGame.getConfig();
          if (config.processMonitoring && config.processMonitoring.enabled) {
            console.log('启动进程监控...');
            this.startProcessMonitoring();
          }
        } catch (error) {
          console.error('初始化进程监控失败:', error.message);
        }
      }, 1000);
    } catch (error) {
      console.error('进程监控初始化错误:', error.message);
    }
  }

  /**
   * 启动进程监控
   */
  startProcessMonitoring() {
    if (this.processMonitor) {
      clearInterval(this.processMonitor);
    }
    
    this.processMonitor = setInterval(() => {
      this.updateProcessStatus();
    }, 30000); // 每30秒检查一次
    
    console.log('进程监控已启动');
  }

  /**
   * 停止进程监控
   */
  stopProcessMonitoring() {
    if (this.processMonitor) {
      clearInterval(this.processMonitor);
      this.processMonitor = null;
    }
  }

  /**
   * 更新进程状态
   */
  async updateProcessStatus() {
    if (this.runningProcesses.size === 0) {
      return; // 没有正在监控的进程
    }

    console.log(`检查 ${this.runningProcesses.size} 个监控进程...`);
    
    for (const [gameKey, processInfo] of this.runningProcesses.entries()) {
      try {
        const isRunning = await this.isProcessRunning(processInfo.processName);
        if (!isRunning) {
          console.log(`进程已停止: ${processInfo.name} (${processInfo.processName})`);
          this.runningProcesses.delete(gameKey);
        } else {
          processInfo.runTime = Date.now() - processInfo.startTime;
          const runTimeMinutes = Math.floor(processInfo.runTime / 60000);
          if (runTimeMinutes > 0 && runTimeMinutes % 5 === 0) { // 每5分钟打印一次状态
            console.log(`进程运行中: ${processInfo.name} (${processInfo.processName}) - 运行时间: ${runTimeMinutes}分钟`);
          }
        }
      } catch (error) {
        console.error(`检查进程失败 ${processInfo.processName}:`, error);
      }
    }
  }

  /**
   * 检查进程是否正在运行
   * @param {string} processName 进程名称
   * @returns {Promise<boolean>} 是否正在运行
   */
  async isProcessRunning(processName) {
    return new Promise((resolve) => {
      const command = process.platform === 'win32' 
        ? `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV /NH`
        : `pgrep -f "${processName}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          // 不记录为错误，因为进程不存在时tasklist也会有非0退出码
          resolve(false);
          return;
        }

        if (process.platform === 'win32') {
          // Windows: 检查输出是否包含进程名
          const isRunning = stdout.includes(processName);
          resolve(isRunning);
        } else {
          // Unix-like: 检查是否有PID输出
          const isRunning = stdout.trim().length > 0;
          resolve(isRunning);
        }
      });
    });
  }

  /**
   * 监控指定进程
   * @param {string} processName 进程名称
   * @param {string} startCommand 启动命令
   * @param {Array} args 启动命令的参数
   * @returns {Promise<boolean>} 是否已等待过
   */
  async monitorProcess(processName, startCommand, args = null) {
    this.autoGame.log(`开始监控进程: ${processName}`);
    let startTime = null;
    let processStarted = false;
    this.currentMonitoringProcess = processName;
    this.isMonitoring = true;

    if (await this.isProcessRunning(processName)) {
      processStarted = true;
      startTime = Date.now();
      this.currentMonitoringStartTime = startTime;
      this.autoGame.log(`${processName} 已经在运行`);
    } else {
      this.autoGame.log(`${processName} 未运行，正在启动...`);
      try {
        await this.startProcess(startCommand, false, args);
        await this.autoGame.sleep(10000); // 等待10秒

        if (await this.isProcessRunning(processName)) {
          processStarted = true;
          startTime = Date.now();
          this.currentMonitoringStartTime = startTime;
          this.autoGame.log(`${processName} 已成功启动`);
        } else {
          this.autoGame.log(`启动 ${processName} 失败，请检查路径或权限`);
          this.currentMonitoringProcess = null;
          this.isMonitoring = false;
          return false;
        }
      } catch (error) {
        this.autoGame.log(`启动 ${processName} 时出错: ${error.message}`);
        this.currentMonitoringProcess = null;
        this.isMonitoring = false;
        return false;
      }
    }

    // 静默监控，控制台实时显示运行时间
    this.autoGame.log(`开始监控 ${processName}，按 Ctrl+C 可强制结束...`);
    
    try {
      while (await this.isProcessRunning(processName) && this.isMonitoring) {
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000;
        
        // 格式化运行时间
        const hours = Math.floor(elapsedTime / 3600);
        const minutes = Math.floor((elapsedTime % 3600) / 60);
        const seconds = Math.floor(elapsedTime % 60);
        
        let timeDisplay;
        if (hours > 0) {
          timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // 每5秒输出一次状态到日志（用于前端显示）
        if (Math.floor(elapsedTime) % 5 === 0) {
          this.autoGame.logOnly(`${processName} 运行中... 已运行: ${timeDisplay}`);
        }
        
        await this.autoGame.sleep(1000);
      }
      
      // 计算总运行时间并只记录到日志
      if (startTime) {
        const totalElapsedTime = (Date.now() - startTime) / 1000;
        const timeStr = this.formatDuration(totalElapsedTime);
        this.autoGame.logOnly(`${processName} 运行完成，总耗时: ${timeStr}`);
      }
      
      this.autoGame.log(`监控程序检测到${processName}已关闭，任务已完成`);
      this.autoGame.log(`等待15秒后继续...`);
      
      // 倒计时显示
      for (let i = 15; i > 0 && this.isMonitoring; i--) {
        await this.autoGame.sleep(1000);
      }
      
      this.autoGame.log(`结束监控进程: ${processName}`);
      return true; // 已等待
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('\n检测到中断，正在停止监控...');
        if (startTime) {
          const totalElapsedTime = (Date.now() - startTime) / 1000;
          const timeStr = this.formatDuration(totalElapsedTime);
          this.autoGame.logOnly(`${processName} 被用户中断，运行时间: ${timeStr}`);
        }
        this.autoGame.log("监控被用户中断");
        throw error;
      }
    } finally {
      this.currentMonitoringProcess = null;
      this.currentMonitoringStartTime = null;
      this.isMonitoring = false;
    }
  }

  /**
   * 启动进程
   * @param {string} command 命令
   * @param {boolean} waitForExit 是否等待进程退出
   * @param {Array} args 参数
   */
  async startProcess(command, waitForExit = true, args = null) {
    return new Promise((resolve, reject) => {
      let childProcess;
      
      // 处理包含空格的命令路径
      let processedCommand = command;
      if (command.includes(' ') && !command.startsWith('"')) {
        processedCommand = `"${command}"`;
      }
      
      if (args && args.length > 0) {
        childProcess = spawn(processedCommand, args, {
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
        });
      } else {
        childProcess = spawn(processedCommand, [], {
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
        });
      }

      let output = '';

      childProcess.stdout.on('data', (data) => {
        // 使用智能编码解码
        let text = this.autoGame.smartDecodeText(data);
        // 进一步修复混合编码问题
        text = this.autoGame.fixMixedEncodingText(text);
        output += text;
      });

      childProcess.stderr.on('data', (data) => {
        // 使用智能编码解码
        let text = this.autoGame.smartDecodeText(data);
        // 进一步修复混合编码问题
        text = this.autoGame.fixMixedEncodingText(text);
        output += text;
      });

      if (waitForExit) {
        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`进程退出码: ${code}, 输出: ${output}`));
          }
        });
      } else {
        // 不等待进程退出，立即返回
        setTimeout(() => {
          resolve('进程已启动');
        }, 1000);
      }

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 停止当前监控
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.currentMonitoringProcess = null;
    this.currentMonitoringStartTime = null;
    this.autoGame.log('监控已停止');
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
   * 等待监控进程完成
   * @param {string} processName 要监控的进程名
   * @param {string} gameKey 游戏key
   * @param {string} logFile 日志文件路径
   * @returns {Promise<void>}
   */
  async waitForProcessCompletion(processName, gameKey, logFile) {
    return new Promise(async (resolve, reject) => {
      const maxWaitTime = 60 * 60 * 1000; // 最大等待1小时
      const checkInterval = 5000; // 每5秒检查一次
      const waitStartTime = Date.now(); // 等待启动的开始时间，不用于运行超时
       
      await this.autoGame.writeLog(logFile, `开始监控进程: ${processName}`);
       
       // 等待进程启动
       let processStarted = false;
       let processStartTime = null;
      
      // 等待最多30秒让进程启动
      await this.autoGame.writeLog(logFile, `等待进程 ${processName} 启动...`);
      for (let i = 0; i < 6; i++) {
        const isRunning = await this.isProcessRunning(processName);
        await this.autoGame.writeLog(logFile, `检查进程 ${processName} 状态: ${isRunning ? '运行中' : '未运行'} (尝试 ${i + 1}/6)`);
        
        if (isRunning) {
          processStarted = true;
          processStartTime = Date.now(); // 记录实际启动时间
           await this.autoGame.writeLog(logFile, `检测到进程 ${processName} 已启动`);
           break;
         }
        await this.autoGame.sleep(5000);
      }
      
      if (!processStarted) {
        const errorMsg = `等待进程 ${processName} 启动超时（30秒）`;
        await this.autoGame.writeLog(logFile, errorMsg);
        reject(new Error(errorMsg));
        return;
      }
      
      // 记录进程到运行列表用于状态监控
      this.runningProcesses.set(gameKey, {
        pid: null, // 外部进程，没有子进程PID
        name: gameKey,
        processName: processName,
        startTime: processStartTime, // 基于检测到的启动时间
        childProcess: null,
        runTime: 0
      });
      
      // 监控进程直到退出
      const monitorLoop = async () => {
        try {
          let lastStatusTime = Date.now();
          let consecutiveFailures = 0;
          const maxConsecutiveFailures = 3; // 连续3次检测失败才认为进程结束
          
          while (true) {
            const currentTime = Date.now();
            
            // 检查是否超时，基于实际启动时间
            if (currentTime - processStartTime > maxWaitTime) {
              this.runningProcesses.delete(gameKey);
              reject(new Error(`监控进程 ${processName} 超时（1小时）`));
              return;
            }
            
            // 检查进程是否还在运行
            const isRunning = await this.isProcessRunning(processName);
            
            if (!isRunning) {
              consecutiveFailures++;
              await this.autoGame.writeLog(logFile, `进程 ${processName} 检测失败 ${consecutiveFailures}/${maxConsecutiveFailures}`);
              
              if (consecutiveFailures >= maxConsecutiveFailures) {
                await this.autoGame.writeLog(logFile, `进程 ${processName} 确认已退出`);
                break;
              }
            } else {
              // 进程仍在运行，重置失败计数
              if (consecutiveFailures > 0) {
                consecutiveFailures = 0;
                await this.autoGame.writeLog(logFile, `进程 ${processName} 恢复运行状态`);
              }
            }
            
            // 更新运行时间
            const runTime = currentTime - processStartTime;
            const processInfo = this.runningProcesses.get(gameKey);
            if (processInfo) {
              processInfo.runTime = runTime;
            }
            
            // 每分钟记录一次状态
            if (currentTime - lastStatusTime >= 60000) {
              const minutes = Math.floor(runTime / 60000);
              await this.autoGame.writeLog(logFile, `进程 ${processName} 运行中，已运行 ${minutes} 分钟`);
              lastStatusTime = currentTime;
            }
            
            await this.autoGame.sleep(checkInterval);
          }
          
          // 进程已退出 - 设置结束时间
          const endTime = Date.now();
          const totalRunTime = endTime - processStartTime; // 仅计算启动后运行时长
          await this.autoGame.writeLog(logFile, `进程 ${processName} 已退出，总运行时间: ${this.formatDuration(totalRunTime / 1000)}`);
           
           // 更新进程信息，标记为已结束
           const processInfo = this.runningProcesses.get(gameKey);
           if (processInfo) {
             processInfo.endTime = endTime;
             processInfo.status = 'completed'; // 标记为正常完成，而不是简单的停止
             
             // 累加到总运行时长
             this.totalAccumulatedRuntime += totalRunTime;
             this.completedProcesses.set(gameKey, {
               name: processInfo.name,
               runTime: totalRunTime,
               endTime: endTime
             });
             
             this.autoGame.log(`累计运行时长更新: +${this.formatDuration(totalRunTime / 1000)}, 总计: ${this.formatDuration(this.totalAccumulatedRuntime / 1000)}`);
           }
           
           // 等待一小段时间后完成
           await this.autoGame.sleep(3000);
           resolve();
           
         } catch (error) {
           // 发生错误时也要清理进程信息
           const processInfo = this.runningProcesses.get(gameKey);
           if (processInfo) {
             processInfo.endTime = Date.now();
             processInfo.status = 'stopped';
           }
           reject(error);
         }
       };
       
       // 开始监控循环
       monitorLoop();
     });
  }

  /**
   * 检查OCR任务冲突
   */
  isOCRTaskRunning() {
    // 检查进程监控状态
    if (this.currentMonitoringProcess && this.isMonitoring) {
      return {
        isRunning: true,
        processName: this.currentMonitoringProcess,
        runTime: this.currentMonitoringStartTime ? 
          Math.floor((Date.now() - this.currentMonitoringStartTime) / 1000) : 0
      };
    }

    // 检查正在运行的OCR相关进程
    for (const [gameKey, processInfo] of this.runningProcesses.entries()) {
      const ocrProcessNames = [
        'OneDragon.exe',           // 绝区零一条龙
        'March7thAssistant.exe',   // 三月七助手
        'BetterGI.exe',           // 原神BetterGI
        'python.exe'               // 可能的签到脚本
      ];
      
      if (ocrProcessNames.some(name => processInfo.processName.includes(name))) {
        return {
          isRunning: true,
          gameKey,
          processName: processInfo.processName,
          runTime: Math.floor((Date.now() - processInfo.startTime) / 1000)
        };
      }
    }
    
    return { isRunning: false };
  }

  /**
   * 智能等待时间计算
   */
  calculateSmartWaitTime(gameKey) {
    const config = this.autoGame.config;
    if (!config || !config.games || !config.games[gameKey]) {
      return 60000; // 默认1分钟
    }
    
    const game = config.games[gameKey];
    const baseWaitTime = game.waitTime || 60000;
    
    // 根据游戏类型调整等待时间，匹配实际执行时间
    const gameTypeWaitTime = {
      'mihoyoBBSTools': 120000,      // 签到脚本：2分钟（1分钟签到+1分钟缓冲）
      'march7thAssistant': 660000,   // 三月七助手：11分钟（1分钟签到+10分钟自动化）
      'zenlessZoneZero': 660000,     // 绝区零一条龙：11分钟
      'betterGenshinImpact': 660000  // 原神BetterGI：11分钟
    };
    
    const smartWaitTime = gameTypeWaitTime[gameKey] || baseWaitTime;
    this.autoGame.log(`${game.name} 智能等待时间: ${Math.floor(smartWaitTime/60000)}分钟`);
    return smartWaitTime;
  }

  /**
   * 任务队列管理 - 确保OCR和键盘任务不冲突
   */
  async addToQueue(gameKey, priority = 0) {
    return new Promise((resolve, reject) => {
      const task = {
        gameKey,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      // 按优先级插入队列
      const insertIndex = this.taskQueue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }
      
      this.autoGame.log(`任务 ${gameKey} 已加入队列，当前队列长度: ${this.taskQueue.length}`);
      this.processQueue();
    });
  }

  /**
   * 改进的队列处理，增强冲突检测
   */
  async processQueue() {
    if (this.isExecutingTask || this.taskQueue.length === 0) {
      return;
    }

    // 检查OCR任务冲突，如果有冲突则延迟处理
    const ocrStatus = this.isOCRTaskRunning();
    if (ocrStatus.isRunning) {
      const estimatedWaitTime = Math.max(30000, this.calculateSmartWaitTime(ocrStatus.gameKey || 'unknown'));
      this.autoGame.log(`检测到OCR任务正在运行 (${ocrStatus.processName})，等待 ${Math.floor(estimatedWaitTime/60000)} 分钟后重试...`);
      
      // 延迟重试，避免冲突
      setTimeout(() => this.processQueue(), Math.min(estimatedWaitTime, 300000)); // 最多等待5分钟
      return;
    }

    this.isExecutingTask = true;
    const task = this.taskQueue.shift();
    
    try {
      this.autoGame.log(`开始执行任务: ${task.gameKey} (队列剩余: ${this.taskQueue.length})`);
      
      // 记录任务开始时间
      const taskStartTime = Date.now();
      const result = await this.autoGame.executeGameTask(task.gameKey);
      
      // 计算实际执行时间
      const actualExecutionTime = Date.now() - taskStartTime;
      this.autoGame.log(`任务 ${task.gameKey} 执行完成，实际耗时: ${Math.floor(actualExecutionTime/60000)}分钟`);
      
      task.resolve(result);
      
    } catch (error) {
      this.autoGame.log(`任务 ${task.gameKey} 执行失败: ${error.message}`);
      
      // 直接让任务失败，不再重试
      task.reject(error);
    } finally {
      this.isExecutingTask = false;
      // 只有当队列中还有任务时，才继续处理队列
      if (this.taskQueue.length > 0) {
        setTimeout(() => this.processQueue(), 3000);
      }
    }
  }

  /**
   * 停止所有进程
   */
  async stopAllProcesses() {
    try {
      let stoppedCount = 0;
      const endTime = Date.now();
      
      for (const [gameKey, processInfo] of this.runningProcesses.entries()) {
        try {
          if (processInfo.childProcess && !processInfo.childProcess.killed) {
            processInfo.childProcess.kill('SIGTERM');
            stoppedCount++;
            this.autoGame.log(`停止进程: ${gameKey} (PID: ${processInfo.childProcess.pid})`);
          }
          
          // 累加运行时长
          if (processInfo.startTime && !processInfo.endTime) {
            const runTime = endTime - processInfo.startTime;
            this.totalAccumulatedRuntime += runTime;
            this.completedProcesses.set(gameKey, {
              name: processInfo.name,
              runTime: runTime,
              endTime: endTime
            });
            
            this.autoGame.log(`进程 ${gameKey} 运行时长: ${this.formatDuration(runTime / 1000)}`);
          }
        } catch (error) {
          this.autoGame.log(`停止进程失败 ${gameKey}: ${error.message}`);
        }
      }
      
      if (stoppedCount > 0) {
        this.autoGame.log(`累计运行时长更新，总计: ${this.formatDuration(this.totalAccumulatedRuntime / 1000)}`);
      }
      
      this.runningProcesses.clear();
      return { success: true, stoppedCount };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 停止指定进程
   */
  async stopProcess(processKey) {
    try {
      const processInfo = this.runningProcesses.get(processKey);
      if (!processInfo) {
        return { error: '进程不存在' };
      }
      
      if (processInfo.childProcess && !processInfo.childProcess.killed) {
        processInfo.childProcess.kill();
        await this.autoGame.writeLog(
          path.join(this.autoGame.logDir, `${processKey}_${Date.now()}.log`),
          `手动停止进程: ${processKey}`
        );
      }
      
      // 标记进程为已停止，并累加运行时长
      const endTime = Date.now();
      processInfo.endTime = endTime;
      processInfo.status = 'stopped';
      
      // 计算运行时长并累加
      if (processInfo.startTime) {
        const runTime = endTime - processInfo.startTime;
        this.totalAccumulatedRuntime += runTime;
        this.completedProcesses.set(processKey, {
          name: processInfo.name,
          runTime: runTime,
          endTime: endTime
        });
        
        this.autoGame.log(`进程 ${processKey} 被手动停止，运行时长: ${this.formatDuration(runTime / 1000)}`);
        this.autoGame.log(`累计运行时长更新: 总计: ${this.formatDuration(this.totalAccumulatedRuntime / 1000)}`);
      }
      
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus() {
    // 计算当前运行中进程的实时运行时长
    let currentRuntime = 0;
    const processesArray = Array.from(this.runningProcesses.entries()).map(([key, info]) => {
      const runTime = Math.floor((Date.now() - info.startTime) / 1000);
      const runTimeMs = Date.now() - info.startTime;
      
      // 如果进程正在运行，累加到当前运行时长
      if (!info.endTime) {
        currentRuntime += runTimeMs;
      }
      
      return {
        gameKey: key,
        name: info.name,
        processName: info.processName,
        startTime: info.startTime,
        endTime: info.endTime,
        runTime: runTime,
        runTimeFormatted: this.formatDuration(runTime),
        status: info.status || 'running',
        pid: info.pid
      };
    });

    return {
      currentlyMonitoring: this.currentMonitoringProcess,
      isMonitoring: this.isMonitoring,
      monitoringStartTime: this.currentMonitoringStartTime,
      runningProcesses: processesArray,
      taskQueue: this.taskQueue.map(task => ({
        gameKey: task.gameKey,
        priority: task.priority,
        timestamp: task.timestamp
      })),
      isExecutingTask: this.isExecutingTask,
      // 添加累计运行时长信息
      totalAccumulatedRuntime: this.totalAccumulatedRuntime,
      currentRuntime: currentRuntime,
      totalRuntime: this.totalAccumulatedRuntime + currentRuntime
    };
  }

  /**
   * 获取智能建议
   */
  getSmartRecommendations() {
    const recommendations = [];
    const ocrStatus = this.isOCRTaskRunning();
    
    if (ocrStatus.isRunning && this.taskQueue.length > 0) {
      const estimatedWaitTime = this.calculateSmartWaitTime(ocrStatus.gameKey || 'unknown');
      recommendations.push({
        type: 'warning',
        message: `有OCR任务正在运行 (${ocrStatus.processName})，建议等待约 ${Math.floor(estimatedWaitTime/60000)} 分钟后再执行其他任务`
      });
    }
    
    if (this.taskQueue.length > 3) {
      const totalTime = this.calculateEstimatedTime();
      recommendations.push({
        type: 'info',
        message: `队列中有 ${this.taskQueue.length} 个任务，预计总执行时间约 ${Math.floor(totalTime/60000)} 分钟`
      });
    }

    if (this.isExecutingTask && this.taskQueue.length === 0) {
      recommendations.push({
        type: 'success',
        message: '正在执行最后一个任务，即将完成'
      });
    }
    
    return recommendations;
  }

  /**
   * 计算预估总执行时间
   */
  calculateEstimatedTime() {
    let totalTime = 0;
    
    for (const task of this.taskQueue) {
      totalTime += this.calculateSmartWaitTime(task.gameKey);
    }
    
    return totalTime;
  }
}

module.exports = ProcessMonitor;
