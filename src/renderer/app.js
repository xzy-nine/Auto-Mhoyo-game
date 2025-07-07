class AutoMihoyoApp {
    constructor() {
        this.config = null;
        this.currentTab = 'dashboard'; // 改为默认显示仪表盘
        this.processStatusInterval = null;
        this.dashboardUpdateInterval = null;
        this.recentActivity = [];
        this.signInDetails = {}; // 签到详情
        this.realtimeLogs = {}; // 实时日志
        this.logUpdateTimeout = null; // 日志更新节流器
        this.runtimeStartTime = Date.now();
        this.totalScriptRuntime = 0; // 总脚本运行时长（毫秒）
        this.scriptStartTimes = {}; // 脚本开始时间记录
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            await this.loadConfig();
            await this.loadAppInfo();
            this.setupEventListeners();
            this.setupNavigation();
            this.setupRealtimeLogListener(); // 设置实时日志监听
            this.renderGameCards();
            this.updateStatusPanel();
            // 自动验证配置状态
            await this.autoValidateConfig();
            this.startProcessMonitoring();
            this.runningProcesses = {}; // 初始化运行进程
            this.updateDashboard(); // 初始化仪表盘
            // 初始化侧边栏状态
            this.updateSidebarProcesses();
            this.updateSidebarSignInDetails();
            this.showNotification('应用初始化完成', 'success');
            
            // 初始化完成后移除加载遮罩
            this.removeLoadingOverlay();
        } catch (error) {
            this.showNotification(`初始化失败: ${error.message}`, 'error');
            // 即使出错也要移除加载遮罩
            this.removeLoadingOverlay();
        }
    }

    // 移除加载遮罩
    removeLoadingOverlay() {
        // 确保所有内容都已完全加载和渲染
        requestAnimationFrame(() => {
            setTimeout(() => {
                document.body.classList.add('ready');
                // 通知主进程渲染器已准备就绪
                if (window.electronAPI && window.electronAPI.notifyReady) {
                    window.electronAPI.notifyReady();
                }
                // 更长延迟确保平滑过渡，完全避免闪烁
                setTimeout(() => {
                    const loadingOverlay = document.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.remove();
                    }
                }, 800);
            }, 300);
        });
    }

    async loadConfig() {
        this.showLoading(true);
        try {
            const result = await window.electronAPI.getConfig();
            if (result.error) {
                throw new Error(result.error);
            }
            this.config = result;
            this.updateLastUpdated();
        } finally {
            this.showLoading(false);
        }
    }

    async saveConfig() {
        this.showLoading(true);
        try {
            const result = await window.electronAPI.saveConfig(this.config);
            if (result.error) {
                throw new Error(result.error);
            }
            this.showNotification('配置保存成功', 'success');
            this.updateLastUpdated();
            this.updateStatusPanel();
        } catch (error) {
            this.showNotification(`保存配置失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadAppInfo() {
        try {
            const appInfo = await window.electronAPI.getAppInfo();
            if (appInfo.error) {
                throw new Error(appInfo.error);
            }
            this.appInfo = appInfo;
            console.log('应用信息:', appInfo);
        } catch (error) {
            console.error('获取应用信息失败:', error);
        }
    }

    setupEventListeners() {
        // 全局按钮事件
        document.getElementById('runAllBtn').addEventListener('click', () => this.runAllGames());
        
        // 设置页面事件
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        
        // 日志页面事件
        document.getElementById('refreshLogsBtn').addEventListener('click', () => this.refreshLogs());
        document.getElementById('clearLogsBtn').addEventListener('click', () => this.clearLogs());
        
        // 仪表盘快捷启动按钮 - 修复配置键名映射
        document.getElementById('quickStartMihoyo').addEventListener('click', () => this.quickStartGame('mihoyoBBSTools'));
        document.getElementById('quickStartGenshin').addEventListener('click', () => this.quickStartGame('betterGenshinImpact'));
        document.getElementById('quickStartStarRail').addEventListener('click', () => this.quickStartGame('march7thAssistant'));
        document.getElementById('quickStartZenless').addEventListener('click', () => this.quickStartGame('zenlessZoneZero'));
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // 隐藏所有标签页内容
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 移除所有导航项的激活状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 显示指定的标签页
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // 激活对应的导航项
        const navItem = document.querySelector(`[data-tab="${tabName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // 如果切换到仪表盘，更新仪表盘数据
        if (tabName === 'dashboard') {
            this.updateDashboard();
        }
        
        // 如果切换到设置页面，加载设置
        if (tabName === 'settings') {
            this.loadSettings();
        }
    }

    renderGameCards() {
        const container = document.getElementById('gamesContainer');
        container.innerHTML = '';

        Object.entries(this.config.games).forEach(([key, game]) => {
            const card = this.createGameCard(key, game);
            container.appendChild(card);
        });
    }

    createGameCard(gameKey, game) {
        const card = document.createElement('div');
        card.className = `game-card ${game.enabled ? 'enabled' : 'disabled'}`;
        
        // 基础标题和开关部分
        const headerHTML = `
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
                <label class="game-toggle">
                    <input type="checkbox" ${game.enabled ? 'checked' : ''} 
                           onchange="app.toggleGame('${gameKey}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
        
        // 禁用状态的提示信息
        const disabledHintHTML = !game.enabled ? `
            <div class="game-disabled-hint">
                <p>🔧 启用此游戏配置开关以显示详细设置选项</p>
            </div>
        ` : '';
        
        // 详细配置部分（仅在启用时显示）
        const configHTML = game.enabled ? `
            <div class="game-config">
                <div class="config-group">
                    <label>可执行文件路径:</label>
                    <div class="config-row">
                        <div class="config-group">
                            <input type="text" value="${game.path}" 
                                   onchange="app.updateGameConfig('${gameKey}', 'path', this.value)">
                        </div>
                        <button class="btn btn-secondary" onclick="app.selectGamePath('${gameKey}')">📁</button>
                    </div>
                </div>
                
                <div class="config-group">
                    <label>工作目录:</label>
                    <div class="config-row">
                        <div class="config-group">
                            <input type="text" value="${game.workingDir}" 
                                   onchange="app.updateGameConfig('${gameKey}', 'workingDir', this.value)">
                        </div>
                        <button class="btn btn-secondary" onclick="app.selectWorkingDir('${gameKey}')">📁</button>
                    </div>
                </div>
                
                <div class="config-group">
                    <label>启动参数:</label>
                    <input type="text" value="${game.arguments.join(' ')}" 
                           onchange="app.updateGameArguments('${gameKey}', this.value)">
                </div>
                
                <div class="config-group">
                    <label>等待时间(毫秒):</label>
                    <input type="number" value="${game.waitTime}" min="0" 
                           onchange="app.updateGameConfig('${gameKey}', 'waitTime', parseInt(this.value))">
                </div>
                
                <div class="monitoring-section">
                    <h4>🔍 进程监控设置</h4>
                    <div class="setting-item">
                        <div class="setting-label">
                            <span>启用进程监控</span>
                        </div>
                        <label class="modern-toggle">
                            <input type="checkbox" ${game.monitoring.enabled ? 'checked' : ''} 
                                   onchange="app.updateMonitoring('${gameKey}', 'enabled', this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    
                    <div class="config-group">
                        <label>监控进程名:</label>
                        <input type="text" value="${game.monitoring.processName}" 
                               onchange="app.updateMonitoring('${gameKey}', 'processName', this.value)">
                    </div>
                    
                    <div class="config-group">
                        <label>自定义进程名:</label>
                        <input type="text" value="${game.monitoring.customProcessName}" 
                               placeholder="留空使用默认进程名"
                               onchange="app.updateMonitoring('${gameKey}', 'customProcessName', this.value)">
                    </div>
                </div>
                
                <div class="game-actions">
                    <button class="btn btn-primary" onclick="app.runGameFromConfig('${gameKey}')" 
                            ${!game.enabled ? 'disabled' : ''}>▶️ 启动 (跳转到仪表盘)</button>
                    <button class="btn btn-secondary" onclick="app.testGamePath('${gameKey}')" 
                            ${!game.path ? 'disabled' : ''}>🔍 测试</button>
                </div>
            </div>
        ` : '';
        
        card.innerHTML = headerHTML + disabledHintHTML + configHTML;
        
        return card;
    }

    async toggleGame(gameKey, enabled) {
        this.config.games[gameKey].enabled = enabled;
        await this.saveConfig();
        this.renderGameCards();
    }

    updateGameConfig(gameKey, field, value) {
        this.config.games[gameKey][field] = value;
        this.saveConfig();
    }

    updateGameArguments(gameKey, argumentsString) {
        this.config.games[gameKey].arguments = argumentsString.trim() 
            ? argumentsString.split(' ').filter(arg => arg.length > 0) 
            : [];
        this.saveConfig();
    }

    updateMonitoring(gameKey, field, value) {
        this.config.games[gameKey].monitoring[field] = value;
        this.saveConfig();
    }

    async selectGamePath(gameKey) {
        try {
            const filePath = await window.electronAPI.selectFile({
                title: '选择游戏可执行文件',
                buttonLabel: '选择',
                defaultPath: this.config.games[gameKey].path
            });
            
            if (filePath) {
                this.updateGameConfig(gameKey, 'path', filePath);
                this.renderGameCards();
            }
        } catch (error) {
            this.showNotification(`选择文件失败: ${error.message}`, 'error');
        }
    }

    async selectWorkingDir(gameKey) {
        try {
            const dirPath = await window.electronAPI.selectDirectory();
            if (dirPath) {
                this.updateGameConfig(gameKey, 'workingDir', dirPath);
                this.renderGameCards();
            }
        } catch (error) {
            this.showNotification(`选择目录失败: ${error.message}`, 'error');
        }
    }

    async testGamePath(gameKey) {
        const game = this.config.games[gameKey];
        if (!game.path) {
            this.showNotification('请先设置可执行文件路径', 'warning');
            return;
        }

        this.showNotification(`正在测试 ${game.name} 的路径...`, 'info');
        // 这里可以添加更多的路径测试逻辑
    }

    async runSingleGame(gameKey) {
        try {
            const game = this.config.games[gameKey];
            
            // 清除之前的签到结果，避免重复解析
            if (this.signInDetails[gameKey]) {
                delete this.signInDetails[gameKey];
                this.updateSignInDetails();
            }
            
            // 只在仪表盘界面显示执行状态，其他界面跳转到仪表盘
            if (this.currentTab !== 'dashboard') {
                this.switchTab('dashboard');
                this.showNotification(`正在切换到仪表盘显示 ${game.name} 的执行状态`, 'info');
            }
            
            // 添加运行中进程到仪表盘状态
            this.runningProcesses[gameKey] = {
                name: game.name,
                startTime: Date.now(),
                status: '正在启动...'
            };
            this.updateDashboard();
            
            this.addActivity(`启动 ${game.name}`, 'info', gameKey);
            this.showNotification(`正在启动 ${game.name}...`, 'info');
            
            // 启动进程并监听实时状态
            const result = await this.runGameWithRealTimeStatus(gameKey);
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // 同步并累加到总运行时长
            this.totalScriptRuntime += result.duration;

            // 对于签到类任务，不立即移除进程状态，而是等待真正完成
            if (gameKey === 'mihoyoBBSTools') {
                // 签到类任务保持进程状态，等待实时日志确认完成
                console.log('签到任务主进程完成，但保持状态直到确认真正完成');
            } else {
                // 非签到类任务立即移除进程状态
                delete this.runningProcesses[gameKey];
                this.updateDashboard();
            }
            
            this.addActivity(`${game.name} 执行完成，耗时: ${result.duration}ms`, 'success');
            this.showNotification(`${result.gameName || game.name} 执行完成，耗时: ${result.duration}ms`, 'success');
            
            // 解析并显示签到奖励信息（只在最后执行一次）
            // 检查输出是否包含签到相关信息，不限制特定游戏
            if (result.output && (
                gameKey === 'mihoyoBBSTools' || 
                gameKey.includes('sign') ||
                result.output.includes('今天获得的奖励是') ||
                result.output.includes('获得的奖励是') ||
                result.output.includes('米游币') ||
                result.output.includes('签到')
            )) {
                console.log('准备解析签到奖励，输出长度:', result.output.length);
                console.log('输出前500字符:', result.output.substring(0, 500));
                this.parseSignInRewards(result.output, game.name);
            }
            
        } catch (error) {
            // 移除运行中进程状态
            delete this.runningProcesses[gameKey];
            this.updateDashboard();
            
            this.addActivity(`执行失败: ${error.message}`, 'error');
            this.showNotification(`执行失败: ${error.message}`, 'error');
        }
    }

    async runGameWithRealTimeStatus(gameKey) {
        const game = this.config.games[gameKey];
        
        return new Promise((resolve, reject) => {
            // 记录脚本开始时间用于累计总运行时长
            if (!this.scriptStartTimes[gameKey]) {
                this.scriptStartTimes[gameKey] = Date.now();
            }
            // 设置状态更新间隔
            const statusUpdateInterval = setInterval(() => {
                // 对于签到类任务，特殊处理
                if (gameKey === 'mihoyoBBSTools') {
                    // 如果进程状态不存在但有活跃日志，重新创建状态
                    if (!this.runningProcesses[gameKey] && this.isSignInStillRunning(gameKey)) {
                        // 尝试从日志中获取更准确的开始时间
                        const originalStartTime = this.getSignInOriginalStartTime(gameKey);
                        this.runningProcesses[gameKey] = {
                            name: this.config.games[gameKey]?.name || '米游社签到工具',
                            startTime: originalStartTime || (Date.now() - 60000), // 使用原始开始时间或默认1分钟前
                            status: '签到进行中...',
                            lastActivityTime: Date.now()
                        };
                        console.log('状态更新间隔中重新创建签到进程状态');
                    }
                    
                    if (this.runningProcesses[gameKey]) {
                        if (this.isSignInStillRunning(gameKey)) {
                            this.runningProcesses[gameKey].status = '签到进行中...';
                        } else if (this.runningProcesses[gameKey].status !== '等待签到完成...' && 
                                  this.runningProcesses[gameKey].status !== '签到完成') {
                            this.runningProcesses[gameKey].status = '等待签到完成...';
                        }
                        this.updateRealTimeProcesses();
                    }
                } else {
                    // 普通任务的状态更新
                    if (this.runningProcesses[gameKey]) {
                        this.runningProcesses[gameKey].status = '正在执行...';
                        this.updateRealTimeProcesses();
                    }
                }
            }, 1000);
            
            // 启动实时日志收集
            this.collectRealTimeLog(gameKey, `开始执行: ${game.name}`);
            
            // 调用实际的游戏运行方法
            window.electronAPI.runGame(gameKey)
                .then(result => {
                    // 对于签到类任务，不立即清除状态，等待签到完全结束
                    if (gameKey === 'mihoyoBBSTools') {
                        this.handleSignInCompletion(gameKey, result, statusUpdateInterval, resolve, reject);
                    } else {
                        clearInterval(statusUpdateInterval);
                        this.handleNormalGameCompletion(gameKey, result, resolve);
                    }
                })
                .catch(error => {
                    clearInterval(statusUpdateInterval);
                    
                    // 收集错误日志
                    this.collectRealTimeLog(gameKey, `执行失败: ${error.message}`);
                    
                    // 更新错误状态
                    if (this.runningProcesses[gameKey]) {
                        this.runningProcesses[gameKey].status = '执行失败';
                        this.updateRealTimeProcesses();
                    }
                    
                    reject(error);
                });
        });
    }
    
    // 处理签到任务完成
    handleSignInCompletion(gameKey, result, statusUpdateInterval, resolve, reject) {
        console.log('处理签到任务完成:', {
            success: !result.error,
            outputLength: result.output ? result.output.length : 0,
            duration: result.duration
        });
        
        // 收集执行结果日志到实时日志显示
        if (result.output) {
            const lines = result.output.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    this.collectRealTimeLog(gameKey, line.trim());
                }
            });
        }
        
        this.collectRealTimeLog(gameKey, `主进程执行完成，等待签到子任务完成...`);
        
        // 确保进程状态存在且更新为等待签到完成，保留原始开始时间
        if (!this.runningProcesses[gameKey]) {
            // 如果进程状态已被删除，重新创建
            this.runningProcesses[gameKey] = {
                name: this.config.games[gameKey]?.name || gameKey,
                status: '等待签到完成...',
                startTime: Date.now() - result.duration, // 回溯开始时间
                pid: null
            };
        } else {
            // 保留原始开始时间，只更新状态
            this.runningProcesses[gameKey].status = '等待签到完成...';
        }
        this.updateRealTimeProcesses();
        
        // 等待签到真正完成（通过检测日志输出判断）
        let waitCount = 0;
        const maxWaitTime = 120; // 最多等待2分钟
        
        const waitForSignInComplete = () => {
            waitCount++;
            
            // 确保进程状态还存在，如果被意外删除则重新创建，但保留原始时间戳
            if (!this.runningProcesses[gameKey]) {
                // 尝试获取原始开始时间
                const originalStartTime = this.getSignInOriginalStartTime(gameKey);
                this.runningProcesses[gameKey] = {
                    name: this.config.games[gameKey]?.name || gameKey,
                    status: '签到进行中...',
                    startTime: originalStartTime || (Date.now() - result.duration - waitCount * 1000),
                    pid: null
                };
            }
            
            // 检查是否真正完成
            if (this.isSignInReallyComplete(gameKey) || waitCount >= maxWaitTime) {
                clearInterval(statusUpdateInterval);
                
                this.collectRealTimeLog(gameKey, `签到流程完全结束，总耗时: ${result.duration + waitCount * 1000}ms`);
                
                // 更新最终状态
                if (this.runningProcesses[gameKey]) {
                    this.runningProcesses[gameKey].status = '签到完成';
                    this.runningProcesses[gameKey].endTime = Date.now();
                    this.updateRealTimeProcesses();
                    
                    // 5秒后移除进程状态
                    setTimeout(() => {
                        delete this.runningProcesses[gameKey];
                        this.updateRealTimeProcesses();
                    }, 5000);
                }
                
                resolve(result);
            } else {
                // 继续等待，更新状态显示
                if (this.runningProcesses[gameKey]) {
                    if (this.isSignInStillRunning(gameKey)) {
                        this.runningProcesses[gameKey].status = '签到进行中...';
                    } else {
                        this.runningProcesses[gameKey].status = '等待签到完成...';
                    }
                    this.updateRealTimeProcesses();
                }
                setTimeout(waitForSignInComplete, 1000);
            }
        };
        
        // 开始等待
        setTimeout(waitForSignInComplete, 1000);
    }
    
    // 处理普通游戏完成
    handleNormalGameCompletion(gameKey, result, resolve) {
        console.log('游戏执行结果:', {
            success: !result.error,
            outputLength: result.output ? result.output.length : 0,
            duration: result.duration
        });
        
        // 收集执行结果日志到实时日志显示
        if (result.output) {
            const lines = result.output.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    this.collectRealTimeLog(gameKey, line.trim());
                }
            });
        }
        
        this.collectRealTimeLog(gameKey, `执行完成，耗时: ${result.duration}ms`);
        
        // 更新最终状态
        if (this.runningProcesses[gameKey]) {
            this.runningProcesses[gameKey].status = '执行完成';
            this.runningProcesses[gameKey].endTime = Date.now();
            this.updateRealTimeProcesses();
        }
        
        resolve(result);
    }
    
    // 检查签到是否还在运行（通过最近的日志输出判断）
    isSignInStillRunning(gameKey) {
        if (!this.realtimeLogs || !this.realtimeLogs[gameKey]) {
            return false;
        }
        
        const logs = this.realtimeLogs[gameKey];
        if (logs.length === 0) return false;
        
        // 检查最近10秒内是否有新的日志输出
        const recentLogs = logs.slice(-5);
        const now = Date.now();
        
        // 如果最近的日志包含这些关键词，说明还在执行
        const stillRunningKeywords = [
            '正在进行', '正在获取', '正在签到', '正在执行',
            'INFO', '获得的奖励是', '今天已经签到过了'
        ];
        
        return recentLogs.some(log => 
            stillRunningKeywords.some(keyword => log.includes(keyword))
        );
    }
    
    // 检查签到是否真正完成
    isSignInReallyComplete(gameKey) {
        if (!this.realtimeLogs || !this.realtimeLogs[gameKey]) {
            return false;
        }
        
        const logs = this.realtimeLogs[gameKey];
        if (logs.length === 0) return false;
        
        // 检查最近的日志是否包含完成标志
        const recentLogs = logs.slice(-10);
        const completionKeywords = [
            '推送完毕', '推送结果：ok', 'dingrobot - 推送完毕'
        ];
        
        const hasCompletionSignal = recentLogs.some(log => 
            completionKeywords.some(keyword => log.includes(keyword))
        );
        
        // 并且最近3秒内没有新的执行日志
        const executionKeywords = [
            '正在进行', '正在获取', '正在签到', '正在执行'
        ];
        
        const hasRecentExecution = recentLogs.slice(-3).some(log => 
            executionKeywords.some(keyword => log.includes(keyword))
        );
        
        return hasCompletionSignal && !hasRecentExecution;
    }
    
    async runAllGames() {
        this.showLoading(true);
        try {
            const result = await window.electronAPI.runAllGames();
            if (result.error) {
                throw new Error(result.error);
            }
            
            const { summary } = result;
            this.showNotification(
                `批量执行完成: 成功 ${summary.successful}/${summary.total}`, 
                summary.failed > 0 ? 'warning' : 'success'
            );
            
            if (result.errors.length > 0) {
                result.errors.forEach(error => {
                    this.showNotification(`${error.gameName}: ${error.error}`, 'error');
                });
            }
        } catch (error) {
            this.showNotification(`批量执行失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async autoDetectGames() {
        this.showLoading(true);
        try {
            const detected = await window.electronAPI.autoDetectGames();
            let detectedCount = 0;
            
            Object.entries(detected).forEach(([gameKey, path]) => {
                if (path && this.config.games[gameKey]) {
                    this.config.games[gameKey].path = path;
                    detectedCount++;
                }
            });
            
            if (detectedCount > 0) {
                await this.saveConfig();
                this.renderGameCards();
                this.showNotification(`自动检测到 ${detectedCount} 个游戏路径`, 'success');
            } else {
                this.showNotification('未检测到任何游戏路径', 'warning');
            }
        } catch (error) {
            this.showNotification(`自动检测失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async validateConfig() {
        this.showLoading(true);
        try {
            const validation = await window.electronAPI.validateConfig();
            if (validation.error) {
                throw new Error(validation.error);
            }
            
            this.updateConfigStatus(validation.valid ? 'valid' : 'invalid');
            
            if (validation.valid) {
                this.showNotification('配置验证通过', 'success');
            } else {
                this.showNotification('配置验证失败', 'error');
                validation.errors.forEach(error => {
                    this.showNotification(error, 'error');
                });
            }
            
            validation.warnings.forEach(warning => {
                this.showNotification(warning, 'warning');
            });
            
        } catch (error) {
            this.showNotification(`验证配置失败: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async autoValidateConfig() {
        try {
            const validation = await window.electronAPI.validateConfig();
            if (validation.error) {
                this.updateConfigStatus('invalid');
                return;
            }
            
            this.updateConfigStatus(validation.valid ? 'valid' : 'invalid');
            
        } catch (error) {
            console.error('自动验证配置失败:', error);
            this.updateConfigStatus('unknown');
        }
    }

    startProcessMonitoring() {
        if (this.processStatusInterval) {
            clearInterval(this.processStatusInterval);
        }
        
        this.processStatusInterval = setInterval(async () => {
            if (this.currentTab === 'monitor') {
                await this.updateProcessMonitor();
            }
        }, 5000);
    }

    // ===== 仪表盘相关方法 =====
    
    startDashboardUpdates() {
        // 启动仪表盘定时更新
        if (this.dashboardUpdateInterval) {
            clearInterval(this.dashboardUpdateInterval);
        }
        
        this.dashboardUpdateInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }
        }, 2000); // 每2秒更新一次
    }
    
    updateDashboard() {
        this.updateStatusCards();
        this.updateRealTimeProcesses();
        this.updateRecentActivity();
        this.updateSignInDetails();
        this.updateRealTimeLogs(); // 新增：更新实时日志显示
    }
    
    updateStatusCards() {
        // 更新活跃进程数（计算所有正在执行的进程，包括签到进行中的）
        const runningProcesses = Object.values(this.runningProcesses || {}).filter(
            process => process.status && (
                process.status.includes('正在') || 
                process.status.includes('签到进行中') ||
                process.status.includes('等待') ||
                process.status === 'running'
            )
        );
        const activeProcessCount = runningProcesses.length;
        document.getElementById('activeProcessCount').textContent = activeProcessCount;
        
        // 更新总运行时长（所有脚本执行时长的累计）
        const totalRuntime = this.updateTotalScriptRuntime();
        const hours = Math.floor(totalRuntime / (1000 * 60 * 60));
        const minutes = Math.floor((totalRuntime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((totalRuntime % (1000 * 60)) / 1000);
        document.getElementById('totalRuntime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 更新今日签到状态
        const todaySignIn = this.getTodaySignInStatus();
        document.getElementById('todaySignIn').textContent = todaySignIn;
        
        // 更新米游币（从日志中解析）
        const mihoyoCoins = this.parseMihoyoCoins();
        document.getElementById('mihoyoCoins').textContent = mihoyoCoins;
    }
    
    updateRealTimeProcesses() {
        // 更新仪表盘中的实时进程状态（现在为空，因为已移除）
        const container = document.getElementById('realTimeProcesses');
        if (container) {
            // 仪表盘中的实时进程状态已移除，保留空函数避免错误
        }
        
        // 更新侧边栏中的实时进程状态
        this.updateSidebarProcesses();
    }
    
    updateSidebarProcesses() {
        const container = document.getElementById('sidebarRealTimeProcesses');
        const section = document.getElementById('sidebarProcessSection');
        const processes = this.runningProcesses || {};
        
        if (Object.keys(processes).length === 0) {
            section.classList.remove('show');
            return;
        }
        
        section.classList.add('show');
        container.innerHTML = Object.entries(processes).map(([key, process]) => {
            // 根据不同状态显示不同信息
            let runTimeDisplay = '未知';
            let statusClass = 'stopped';
            let statusText = '已停止';
            let actionButton = '<span class="status-text">已结束</span>';
            
            const isActive = process.status && (
                process.status.includes('正在') || 
                process.status.includes('签到进行中') ||
                process.status.includes('等待') ||
                process.status === 'running'
            );
            
            if (isActive && process.startTime) {
                const runTime = Math.max(0, Date.now() - process.startTime); // 确保时间不为负数
                runTimeDisplay = this.formatDuration(runTime);
                statusClass = 'running';
                statusText = process.status || '运行中';
                actionButton = `<button class="btn btn-sm btn-danger" onclick="app.stopProcess('${key}')">停止</button>`;
                
                // 调试信息：定期检查时间是否有异常跳变
                if (key === 'mihoyoBBSTools' && runTime > 0) {
                    const lastRunTime = process._lastRunTime || 0;
                    if (lastRunTime > 0 && runTime < lastRunTime - 5000) { // 如果时间倒退超过5秒
                        console.warn(`检测到时间跳变: ${key}, 上次: ${lastRunTime}ms, 当前: ${runTime}ms, startTime: ${process.startTime}`);
                    }
                    process._lastRunTime = runTime;
                }
            } else if (process.status === 'stopped' && process.startTime && process.endTime) {
                const totalRunTime = process.endTime - process.startTime;
                runTimeDisplay = `总共运行了 ${this.formatDuration(totalRunTime)}`;
                statusClass = 'stopped';
                statusText = '已停止';
            } else if (process.status === '签到完成' || process.status === '执行完成') {
                if (process.startTime) {
                    const totalRunTime = (process.endTime || Date.now()) - process.startTime;
                    runTimeDisplay = `运行了 ${this.formatDuration(totalRunTime)}`;
                }
                statusClass = 'completed';
                statusText = process.status;
                actionButton = '<span class="status-text">✅ 已完成</span>';
            }
            
            return `
                <div class="process-item-sidebar">
                    <div class="process-info-sidebar">
                        <div class="process-name-sidebar">${process.name || this.config.games[key]?.name || key}</div>
                        <div class="process-details-sidebar">
                            ${statusText}
                            ${isActive ? ` | ${runTimeDisplay}` : ''}
                        </div>
                    </div>
                    <div class="process-status-sidebar">
                        <div class="status-indicator ${statusClass}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    updateRecentActivity() {
        const container = document.getElementById('recentActivity');
        
        if (this.recentActivity.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无活动记录</div>';
            return;
        }
        
        // 显示最近10条活动
        const recent = this.recentActivity.slice(-10).reverse();
        container.innerHTML = recent.map(activity => `
            <div class="activity-item">
                <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                <div class="activity-content">${activity.message}</div>
                <div class="activity-type ${activity.type}">${activity.type}</div>
            </div>
        `).join('');
    }
    
    updateRealTimeLogs() {
        const container = document.getElementById('realTimeLogOutput');
        if (!container) return;
        
        if (!this.realtimeLogs || Object.keys(this.realtimeLogs).length === 0) {
            container.innerHTML = '<div class="empty-state">等待日志输出...</div>';
            return;
        }
        
        // 获取所有游戏的最新日志，按时间排序
        const allLogs = [];
        Object.entries(this.realtimeLogs).forEach(([gameKey, logs]) => {
            logs.slice(-10).forEach(log => {
                allLogs.push({
                    gameKey,
                    content: log,
                    timestamp: Date.now() // 可以从日志中解析实际时间戳
                });
            });
        });
        
        // 按时间排序并显示最近的20条
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        const recentLogs = allLogs.slice(0, 20);
        
        container.innerHTML = recentLogs.map(log => 
            `<div class="log-entry">
                <span class="log-game">[${this.config.games[log.gameKey]?.name || log.gameKey}]</span> 
                ${this.escapeHtml(log.content)}
            </div>`
        ).join('');
        
        // 自动滚动到顶部（最新日志）
        container.scrollTop = 0;
    }
    
    async quickStartGame(gameKey) {
        try {
            const game = this.config.games[gameKey];
            if (!game) {
                throw new Error(`游戏配置 ${gameKey} 不存在`);
            }
            
            if (!game.enabled) {
                throw new Error(`游戏 ${game.name} 未启用，请先在游戏配置中启用`);
            }
            
            if (!game.path) {
                throw new Error(`游戏 ${game.name} 未配置可执行文件路径`);
            }
            
            this.addActivity(`快捷启动 ${game.name}`, 'info');
            await this.runSingleGame(gameKey);
        } catch (error) {
            this.addActivity(`快捷启动失败: ${error.message}`, 'error');
            this.showNotification(`快捷启动失败: ${error.message}`, 'error');
        }
    }
    
    async stopAllProcesses() {
        try {
            const result = await window.electronAPI.stopAllProcesses();
            if (result.success) {
                this.addActivity('停止所有进程', 'warning');
                this.runningProcesses = {};
                this.updateDashboard();
            }
        } catch (error) {
            this.addActivity(`停止进程失败: ${error.message}`, 'error');
        }
    }
    
    async stopProcess(processKey) {
        try {
            const result = await window.electronAPI.stopProcess(processKey);
            if (result.success) {
                this.addActivity(`停止进程 ${processKey}`, 'warning');
                delete this.runningProcesses[processKey];
                this.updateDashboard();
            }
        } catch (error) {
            this.addActivity(`停止进程失败: ${error.message}`, 'error');
        }
    }
    
    addActivity(message, type = 'info', gameKey = null) {
        const activity = {
            timestamp: Date.now(),
            message,
            type
        };
        
        // 为启动活动添加额外信息以便追踪开始时间
        if (gameKey && (message.includes('启动') || message.includes('开始执行'))) {
            activity.game = gameKey;
            activity.type = 'start';
        }
        
        this.recentActivity.push(activity);
        
        // 限制活动记录数量
        if (this.recentActivity.length > 100) {
            this.recentActivity = this.recentActivity.slice(-50);
        }
    }
    
    getTodaySignInStatus() {
        // 优先从签到详情中获取状态
        const hasSuccessfulSignIn = Object.values(this.signInDetails).some(
            details => details.status === 'success'
        );
        
        if (hasSuccessfulSignIn) {
            return '已完成';
        }
        
        // 从活动记录中查找今日签到状态
        const today = new Date().toDateString();
        const todaySignInActivities = this.recentActivity.filter(activity => 
            new Date(activity.timestamp).toDateString() === today &&
            (activity.message.includes('签到') || activity.message.includes('米游社'))
        );
        
        if (todaySignInActivities.length > 0) {
            // 查找最近的签到完成活动
            const successActivities = todaySignInActivities.filter(activity => 
                activity.type === 'success' && 
                (activity.message.includes('签到完成') || 
                 activity.message.includes('签到成功') ||
                 activity.message.includes('推送完毕'))
            );
            
            if (successActivities.length > 0) {
                return '已完成';
            }
            
            // 检查是否有失败记录
            const failureActivities = todaySignInActivities.filter(activity => 
                activity.type === 'error' && activity.message.includes('签到失败')
            );
            
            if (failureActivities.length > 0) {
                return '失败';
            }
            
            // 如果有签到相关活动但没有明确的成功/失败，可能还在进行中
            return '进行中';
        }
        
        return '未执行';
    }
    
    parseMihoyoCoins() {
        // 从签到详情中获取米游币数量
        for (const [gameKey, details] of Object.entries(this.signInDetails)) {
            if (details.coins) {
                return details.coins;
            }
        }
        
        // 从最近的活动记录中解析米游币数量
        const coinActivity = this.recentActivity.find(activity => 
            activity.message.includes('米游币') && 
            (activity.message.includes('已经获得') || activity.message.includes('目前有'))
        );
        
        if (coinActivity) {
            const match = coinActivity.message.match(/(?:已经获得|目前有)\s*(\d+)\s*个米游币/);
            return match ? match[1] : '-';
        }
        
        // 从实时日志中解析
        if (this.realtimeLogs) {
            for (const logs of Object.values(this.realtimeLogs)) {
                for (const log of logs.slice(-20)) { // 检查最近20条日志
                    const match = log.match(/(?:已经获得|目前有)\s*(\d+)\s*个米游币/);
                    if (match) {
                        return match[1];
                    }
                }
            }
        }
        
        return '-';
    }
    
    // 获取签到任务的原始开始时间，防止时间跳变
    getSignInOriginalStartTime(gameKey) {
        // 从最近活动中查找该任务的开始时间
        if (this.recentActivity && this.recentActivity.length > 0) {
            // 倒序查找最近的开始记录
            for (let i = this.recentActivity.length - 1; i >= 0; i--) {
                const activity = this.recentActivity[i];
                if (activity.game === gameKey && 
                    activity.type === 'start' && 
                    activity.timestamp) {
                    return activity.timestamp;
                }
            }
        }
        
        // 如果找不到记录，返回null，让调用者使用默认值
        return null;
    }

    formatDuration(ms) {
        // 确保输入是整数毫秒
        const milliseconds = Math.max(0, Math.floor(ms));
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // 调试日志（生产环境可移除）
        if (totalSeconds > 0 && totalSeconds % 10 === 0) { // 每10秒打印一次调试信息
            console.log(`formatDuration: ${ms}ms -> ${totalSeconds}s -> ${hours}h ${minutes}m ${seconds}s`);
        }
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // 监听进程状态更新
    async startProcessMonitoring() {
        if (this.processStatusInterval) {
            clearInterval(this.processStatusInterval);
        }
        
        this.startDashboardUpdates();
        
        this.processStatusInterval = setInterval(async () => {
            try {
                const result = await window.electronAPI.getProcessStatus();
                if (result && !result.error) {
                    const newProcesses = result.processes || {};
                    
                    // 检查进程状态变化，更新运行时长统计
                    this.updateScriptRuntimeTracking(newProcesses);
                    
                    this.runningProcesses = newProcesses;
                    this.updateStatusPanel();
                }
            } catch (error) {
                console.error('获取进程状态失败:', error);
            }
        }, 3000); // 每3秒检查一次
    }
    
    async loadLogs() {
        try {
            const logs = await window.electronAPI.getLogs();
            const container = document.getElementById('logsContent');
            
            if (logs.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>暂无日志记录</p></div>';
                return;
            }
            
            container.innerHTML = '';
            logs.forEach(log => {
                const logElement = this.createLogElement(log);
                container.appendChild(logElement);
            });
            
        } catch (error) {
            this.showNotification(`加载日志失败: ${error.message}`, 'error');
        }
    }

    createLogElement(log) {
        const element = document.createElement('div');
        element.className = 'log-entry';
        
        const lines = log.content.split('\n').map(line => {
            if (line.includes('[ERROR]')) {
                return `<span class="log-error">${line}</span>`;
            } else if (line.includes('[WARN]')) {
                return `<span class="log-warning">${line}</span>`;
            } else if (line.includes('[INFO]')) {
                return `<span class="log-info">${line}</span>`;
            } else {
                return line;
            }
        }).join('\n');
        
        element.innerHTML = `
            <h4>${log.filename}</h4>
            <pre>${lines}</pre>
        `;
        
        return element;
    }

    async refreshLogs() {
        await this.loadLogs();
        this.showNotification('日志已刷新', 'success');
    }

    async clearLogs() {
        if (confirm('确定要清空所有日志吗？此操作不可撤销。')) {
            // 这里可以添加清空日志的API调用
            this.showNotification('日志清空功能待实现', 'warning');
        }
    }

    loadSettings() {
        if (!this.config) return;
        
        document.getElementById('autoRunCheckbox').checked = this.config.autoRun;
        document.getElementById('logLevel').value = this.config.logLevel;
        document.getElementById('maxLogFiles').value = this.config.maxLogFiles;
        
        // 加载主题设置 - 但不在这里应用，让ThemeManager自己处理
        // 这里只是为了在设置页面显示当前状态
        if (window.themeManager) {
            document.getElementById('followSystemTheme').checked = window.themeManager.isFollowingSystem();
            document.getElementById('themeMode').value = window.themeManager.getThemePreference();
        }
    }

    async saveSettings() {
        this.config.autoRun = document.getElementById('autoRunCheckbox').checked;
        this.config.logLevel = document.getElementById('logLevel').value;
        this.config.maxLogFiles = parseInt(document.getElementById('maxLogFiles').value);
        
        // 主题设置由ThemeManager自己管理，这里不需要保存到config中
        // ThemeManager会自动保存到localStorage
        
        await this.saveConfig();
    }

    async resetSettings() {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            // 重置为默认值的逻辑
            this.config.autoRun = false;
            this.config.logLevel = 'info';
            this.config.maxLogFiles = 10;
            
            // 重置主题设置
            if (window.themeManager) {
                window.themeManager.setSystemPreference(false);
                window.themeManager.setThemePreference('light');
            }
            
            this.loadSettings();
            await this.saveConfig();
            this.showNotification('设置已重置为默认值', 'success');
        }
    }

    updateStatusPanel() {
        if (!this.config) return;
        
        const enabledGames = Object.values(this.config.games).filter(game => game.enabled).length;
        document.getElementById('enabledGames').textContent = enabledGames;
    }

    updateConfigStatus(status) {
        const statusElement = document.getElementById('configStatus');
        statusElement.textContent = status === 'valid' ? '有效' : status === 'invalid' ? '无效' : '未知';
        statusElement.className = `status-badge ${status}`;
    }

    updateLastUpdated() {
        const lastUpdated = this.config?.lastUpdated;
        if (lastUpdated) {
            const date = new Date(lastUpdated);
            document.getElementById('lastUpdated').textContent = `最后更新: ${date.toLocaleString()}`;
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // 处理多行消息
        if (message.includes('\n')) {
            const lines = message.split('\n');
            notification.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
        } else {
            notification.textContent = message;
        }
        
        container.appendChild(notification);
        
        // 根据消息类型调整显示时间
        const displayTime = type === 'error' ? 8000 : 5000;
        
        // 自动移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, displayTime);
    }

    updateStatusText(text) {
        document.getElementById('statusText').textContent = text;
    }

    async runGameFromConfig(gameKey) {
        const game = this.config.games[gameKey];
        this.showNotification(`正在跳转到仪表盘启动 ${game.name}`, 'info');
        this.switchTab('dashboard');
        
        // 短暂延迟后启动游戏，确保界面切换完成
        setTimeout(() => {
            this.runSingleGame(gameKey);
        }, 500);
    }

    parseSignInRewards(output, gameName) {
        try {
            if (!output || typeof output !== 'string') {
                console.log('解析签到奖励: 输出为空或格式错误');
                return;
            }
            
            // 防重复解析 - 基于输出内容和游戏名称确定游戏key
            const gameKey = Object.keys(this.config.games).find(key => 
                this.config.games[key].name === gameName
            ) || 'mihoyoBBSTools'; // 默认为米游社工具
            
            console.log('检测到游戏:', gameName, '对应Key:', gameKey);
            
            // 如果已经解析过这个游戏的签到结果且输出内容没有变化，跳过
            if (gameKey && this.signInDetails[gameKey] && this.signInDetails[gameKey].lastOutput === output.substring(0, 1000)) {
                console.log('已解析过相同输出的签到结果，跳过重复解析:', gameKey);
                return;
            }
            
            const lines = output.split('\n');
            let signinSuccess = false;
            let signinReward = '';
            let mihoyoCoins = '';
            let rewardCount = 0; // 统计找到的奖励数量
            
            console.log('开始解析签到奖励，总行数:', lines.length);
            
            // 解析每一行日志
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // 检查签到成功状态 - 根据实际日志优化匹配
                if (trimmedLine.includes('执行完成，退出码: 0') ||
                    trimmedLine.includes('推送结果：ok') ||
                    trimmedLine.includes('推送完毕') ||
                    trimmedLine.includes('今天已经签到过了~') ||
                    trimmedLine.includes('签到任务执行完成') ||
                    trimmedLine.includes('签到执行完成') ||
                    trimmedLine.includes('dingrobot - 推送完毕') ||
                    (trimmedLine.includes('INFO') && trimmedLine.includes('签到工具') && trimmedLine.includes('执行完成'))) {
                    signinSuccess = true;
                    console.log('检测到签到成功标志:', trimmedLine);
                }
                
                // 解析奖励信息 - 优先匹配单独奖励行
                if (trimmedLine.startsWith('今天获得的奖励是') && !trimmedLine.includes('INFO')) {
                    console.log('找到纯奖励行:', trimmedLine);
                    // 匹配：今天获得的奖励是「冒险家的经验」x2
                    const rewardMatch = trimmedLine.match(/今天获得的奖励是[「『]?([^」』\n]+)[」』]?\s*x?(\d+)?/);
                    if (rewardMatch) {
                        const newReward = rewardMatch[2] ? `${rewardMatch[1]} x${rewardMatch[2]}` : rewardMatch[1];
                        if (rewardCount === 0) {
                            signinReward = newReward;
                        } else {
                            signinReward += `, ${newReward}`;
                        }
                        rewardCount++;
                        console.log('解析到奖励:', newReward, '总计:', signinReward, '原文:', trimmedLine);
                    } else {
                        console.log('正则匹配失败，尝试简单解析');
                        // 如果正则失败，尝试简单的字符串提取
                        const simpleMatch = trimmedLine.match(/今天获得的奖励是(.+)/);
                        if (simpleMatch) {
                            const newReward = simpleMatch[1].trim();
                            if (rewardCount === 0) {
                                signinReward = newReward;
                            } else {
                                signinReward += `, ${newReward}`;
                            }
                            rewardCount++;
                            console.log('简单解析到奖励:', newReward, '总计:', signinReward);
                        }
                    }
                } else if (trimmedLine.includes('今天获得的奖励是')) {
                    console.log('找到今天奖励行:', trimmedLine);
                    // 匹配：今天获得的奖励是「冒险家的经验」x2
                    const rewardMatch = trimmedLine.match(/今天获得的奖励是[「『]?([^」』\n]+)[」』]?\s*x?(\d+)?/);
                    if (rewardMatch) {
                        const newReward = rewardMatch[2] ? `${rewardMatch[1]} x${rewardMatch[2]}` : rewardMatch[1];
                        if (rewardCount === 0) {
                            signinReward = newReward;
                        } else {
                            signinReward += `, ${newReward}`;
                        }
                        rewardCount++;
                        console.log('解析到奖励:', newReward, '总计:', signinReward, '原文:', trimmedLine);
                    } else {
                        console.log('正则匹配失败，尝试简单解析');
                        // 如果正则失败，尝试简单的字符串提取
                        const simpleMatch = trimmedLine.match(/今天获得的奖励是(.+)/);
                        if (simpleMatch) {
                            const newReward = simpleMatch[1].trim();
                            if (rewardCount === 0) {
                                signinReward = newReward;
                            } else {
                                signinReward += `, ${newReward}`;
                            }
                            rewardCount++;
                            console.log('简单解析到奖励:', newReward, '总计:', signinReward);
                        }
                    }
                } else if (trimmedLine.includes('获得的奖励是')) {
                    console.log('找到获得奖励行:', trimmedLine);
                    // 处理没有"今天"前缀的情况
                    const rewardMatch = trimmedLine.match(/获得的奖励是[「『]?([^」』\n]+)[」』]?\s*x?(\d+)?/);
                    if (rewardMatch) {
                        const newReward = rewardMatch[2] ? `${rewardMatch[1]} x${rewardMatch[2]}` : rewardMatch[1];
                        if (rewardCount === 0) {
                            signinReward = newReward;
                        } else {
                            signinReward += `, ${newReward}`;
                        }
                        rewardCount++;
                        console.log('解析到奖励(无今天前缀):', newReward, '总计:', signinReward, '原文:', trimmedLine);
                    } else {
                        console.log('正则匹配失败，尝试简单解析');
                        // 如果正则失败，尝试简单的字符串提取
                        const simpleMatch = trimmedLine.match(/获得的奖励是(.+)/);
                        if (simpleMatch) {
                            const newReward = simpleMatch[1].trim();
                            if (rewardCount === 0) {
                                signinReward = newReward;
                            } else {
                                signinReward += `, ${newReward}`;
                            }
                            rewardCount++;
                            console.log('简单解析到奖励:', newReward, '总计:', signinReward);
                        }
                    }
                }
                
                // 解析米游币数量 - 增强匹配，包括当前余额
                if (trimmedLine.includes('米游币')) {
                    console.log('找到米游币行:', trimmedLine);
                    // 优先匹配当前总余额
                    const totalCoinMatch = trimmedLine.match(/目前有\s*(\d+)\s*个?米游币/);
                    if (totalCoinMatch) {
                        mihoyoCoins = `总计 ${totalCoinMatch[1]}`;
                        console.log('解析到总米游币:', mihoyoCoins, '原文:', trimmedLine);
                    } else {
                        // 匹配今日获得数量
                        const coinMatch = trimmedLine.match(/(?:已经获得|今天已经签到过了|获得|今天获得)\s*(\d+)\s*个?米游币/);
                        if (coinMatch) {
                            const todayCoins = coinMatch[1];
                            mihoyoCoins = mihoyoCoins ? `${mihoyoCoins} (今日+${todayCoins})` : `今日 ${todayCoins}`;
                            console.log('解析到今日米游币:', todayCoins, '当前显示:', mihoyoCoins, '原文:', trimmedLine);
                        } else {
                            // 尝试更宽松的匹配
                            const looseMatch = trimmedLine.match(/(\d+)\s*个?米游币/);
                            if (looseMatch && !mihoyoCoins) {
                                mihoyoCoins = looseMatch[1];
                                console.log('宽松解析到米游币:', mihoyoCoins, '原文:', trimmedLine);
                            }
                        }
                    }
                }
            }
            
            console.log('签到解析完成:');
            console.log('- 签到成功:', signinSuccess);
            console.log('- 奖励:', signinReward);
            console.log('- 米游币:', mihoyoCoins);
            console.log('- 游戏名:', gameName);
            console.log('- 游戏Key:', gameKey);
            
            // 更新签到详情，显示在实时区域
            if (gameKey) {
                this.signInDetails[gameKey] = {
                    name: gameName,
                    icon: this.getGameIcon(gameKey),
                    status: signinSuccess ? 'success' : 'failed',
                    statusText: signinSuccess ? '已签到' : '签到失败',
                    reward: signinReward || undefined,
                    coins: mihoyoCoins || undefined,
                    lastOutput: output.substring(0, 1000) // 保存输出的前1000字符用于去重
                };
                
                // 立即更新显示
                this.updateSignInDetails();
                
                // 更新今日签到状态
                const activityMessage = `${gameName} 签到${signinSuccess ? '成功' : '失败'}${signinReward ? `: ${signinReward}` : ''}${mihoyoCoins ? ` (米游币: ${mihoyoCoins})` : ''}`;
                this.addActivity(activityMessage, signinSuccess ? 'success' : 'error');
                
                // 显示通知（只显示一次）
                this.showNotification(activityMessage, signinSuccess ? 'success' : 'error');
                
                console.log('签到状态解析完成:', {
                    game: gameName,
                    success: signinSuccess,
                    reward: signinReward,
                    coins: mihoyoCoins
                });
            }
            
        } catch (error) {
            console.error('解析签到奖励失败:', error);
            this.showNotification(`解析签到奖励失败: ${error.message}`, 'error');
        }
    }
    
    getGameIcon(gameKey) {
        const icons = {
            'mihoyoBBSTools': '🎮',
            'march7thAssistant': '🚂',
            'zenlessZoneZero': '🏙️',
            'betterGenshinImpact': '⚔️'
        };
        return icons[gameKey] || '🎮';
    }

    // 添加实时日志收集和显示功能
    collectRealTimeLog(gameKey, logEntry) {
        if (!this.realtimeLogs) {
            this.realtimeLogs = {};
        }
        
        if (!this.realtimeLogs[gameKey]) {
            this.realtimeLogs[gameKey] = [];
        }
        
        // 添加时间戳
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const logWithTime = `[${timestamp}] ${logEntry}`;
        
        this.realtimeLogs[gameKey].push(logWithTime);
        
        // 限制日志条数，避免内存占用过大
        if (this.realtimeLogs[gameKey].length > 1000) {
            this.realtimeLogs[gameKey] = this.realtimeLogs[gameKey].slice(-500);
        }
        
        // 智能更新进程状态：如果检测到签到相关活动，保持运行状态
        if (gameKey === 'mihoyoBBSTools') {
            const keySignInPhrases = [
                '正在进行', '正在获取', '正在签到', '正在执行',
                '今天获得的奖励是', '今天已经签到过了', 'INFO',
                '获得的奖励', '签到成功', '签到进行'
            ];
            
            if (keySignInPhrases.some(phrase => logEntry.includes(phrase))) {
                // 如果没有进程状态但检测到活动，重新创建，尝试获取原始开始时间
                if (!this.runningProcesses[gameKey]) {
                    const originalStartTime = this.getSignInOriginalStartTime(gameKey);
                    this.runningProcesses[gameKey] = {
                        name: this.config.games[gameKey]?.name || '米游社签到工具',
                        startTime: originalStartTime || (Date.now() - 30000), // 使用原始时间或假设已经运行了30秒
                        status: '签到进行中...',
                        lastActivityTime: Date.now()
                    };
                    console.log('从实时日志重新创建进程状态');
                    this.updateRealTimeProcesses();
                } else {
                    // 保留原始开始时间，只更新状态和活动时间
                    this.runningProcesses[gameKey].status = '签到进行中...';
                    this.runningProcesses[gameKey].lastActivityTime = Date.now();
                }
            }
            
            // 检测签到完成信号
            const completionPhrases = [
                '推送完毕', '推送结果：ok', 'dingrobot - 推送完毕'
            ];
            
            if (completionPhrases.some(phrase => logEntry.includes(phrase))) {
                if (this.runningProcesses[gameKey]) {
                    this.runningProcesses[gameKey].status = '签到完成';
                    this.runningProcesses[gameKey].endTime = Date.now();
                    this.updateRealTimeProcesses();
                    
                    // 5秒后移除进程状态
                    setTimeout(() => {
                        if (this.runningProcesses[gameKey] && this.runningProcesses[gameKey].status === '签到完成') {
                            delete this.runningProcesses[gameKey];
                            this.updateRealTimeProcesses();
                        }
                    }, 5000);
                }
            }
        }
        
        // 只在特定条件下更新UI，避免过于频繁的更新
        if (this.currentTab === 'dashboard') {
            // 节流更新，避免频繁刷新
            if (!this.logUpdateTimeout) {
                this.logUpdateTimeout = setTimeout(() => {
                    this.updateRealTimeLogs();
                    this.logUpdateTimeout = null;
                }, 500); // 500ms更新一次
            }
        }
        
        // 只有重要的日志事件才添加到活动记录
        if (logEntry.includes('执行完成') || 
            logEntry.includes('签到成功') || 
            logEntry.includes('签到失败') ||
            logEntry.includes('开始执行') ||
            logEntry.includes('推送完毕') ||
            logEntry.includes('今天获得的奖励是')) {
            this.addActivity(logEntry, 'info');
        }
    }
    
    updateRealTimeLogs() {
        const container = document.getElementById('realTimeLogOutput');
        if (!container) return;
        
        if (!this.realtimeLogs || Object.keys(this.realtimeLogs).length === 0) {
            container.innerHTML = '<div class="empty-state">等待日志输出...</div>';
            return;
        }
        
        // 收集所有游戏的最新日志
        const allLogs = [];
        Object.entries(this.realtimeLogs).forEach(([gameKey, logs]) => {
            // 只显示最近的日志条目
            logs.slice(-15).forEach((log, index) => {
                allLogs.push({
                    gameKey,
                    gameName: this.config.games[gameKey]?.name || gameKey,
                    content: log,
                    timestamp: Date.now() - (logs.length - index) * 1000 // 模拟时间戳
                });
            });
        });
        
        // 按时间排序，最新的在前
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        const recentLogs = allLogs.slice(0, 30); // 只显示最近30条
        
        container.innerHTML = recentLogs.map(log => 
            `<div class="log-entry">
                <span class="log-game">[${log.gameName}]</span> 
                <span class="log-content">${this.escapeHtml(log.content)}</span>
            </div>`
        ).join('');
        
        // 自动滚动到顶部（最新日志）
        container.scrollTop = 0;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 监听实时日志
    setupRealtimeLogListener() {
        window.electronAPI.onRealtimeLog((data) => {
            const { gameKey, logEntry, timestamp } = data;
            
            // 收集日志
            this.collectRealTimeLog(gameKey, logEntry);
            
            // 特殊处理签到任务的进程状态更新
            if (gameKey === 'mihoyoBBSTools' && this.runningProcesses[gameKey]) {
                this.updateSignInProcessStatus(gameKey, logEntry);
            }
            
            // 实时解析签到奖励（如果检测到奖励信息）
            if (gameKey === 'mihoyoBBSTools' && logEntry.includes('今天获得的奖励是')) {
                this.parseSignInRewardsFromRealTimeLog(gameKey, logEntry);
            }
            
            // 检测签到完成信号
            if (gameKey === 'mihoyoBBSTools' && 
                (logEntry.includes('推送完毕') || logEntry.includes('推送结果：ok'))) {
                this.handleSignInCompletionFromLog(gameKey);
            }
        });
    }
    
    // 更新签到进程状态
    updateSignInProcessStatus(gameKey, logEntry) {
        if (!this.runningProcesses[gameKey]) {
            // 如果进程状态被清除了，但还有活动日志，重新创建进程状态，使用原始开始时间
            if (gameKey === 'mihoyoBBSTools') {
                const originalStartTime = this.getSignInOriginalStartTime(gameKey);
                this.runningProcesses[gameKey] = {
                    name: this.config.games[gameKey]?.name || '米游社签到工具',
                    startTime: originalStartTime || (Date.now() - 60000), // 使用原始时间或假设已经运行了1分钟前
                    status: '签到进行中...',
                    lastActivityTime: Date.now()
                };
                console.log('重新创建签到进程状态');
            } else {
                return;
            }
        }
        
        const executingPhrases = [
            '正在进行', '正在获取', '正在签到', '正在执行',
            '已获取', '今天已经签到过了', '今天获得的奖励是'
        ];
        
        const completionPhrases = [
            '推送完毕', '推送结果：ok', 'dingrobot - 推送完毕'
        ];
        
        if (executingPhrases.some(phrase => logEntry.includes(phrase))) {
            this.runningProcesses[gameKey].status = '签到进行中...';
            this.runningProcesses[gameKey].lastActivityTime = Date.now();
            this.updateRealTimeProcesses();
            console.log('检测到签到活动，更新状态为进行中');
        } else if (completionPhrases.some(phrase => logEntry.includes(phrase))) {
            this.runningProcesses[gameKey].status = '签到完成';
            this.runningProcesses[gameKey].endTime = Date.now();
            this.updateRealTimeProcesses();
            console.log('检测到签到完成');
            
            // 5秒后移除进程状态
            setTimeout(() => {
                if (this.runningProcesses[gameKey]) {
                    delete this.runningProcesses[gameKey];
                    this.updateRealTimeProcesses();
                    console.log('签到进程状态已清理');
                }
            }, 5000);
        }
    }
    
    // 从实时日志解析签到奖励
    parseSignInRewardsFromRealTimeLog(gameKey, logEntry) {
        if (!this.signInDetails[gameKey]) {
            this.signInDetails[gameKey] = {
                name: this.config.games[gameKey]?.name || '米游社签到工具',
                icon: '🎮',
                status: 'running',
                statusText: '签到中...',
                reward: '',
                coins: ''
            };
        }
        
        // 解析奖励信息
        if (logEntry.includes('今天获得的奖励是')) {
            const rewardMatch = logEntry.match(/今天获得的奖励是[「『]?([^」』\n]+)[」』]?\s*x?(\d+)?/);
            if (rewardMatch) {
                const newReward = rewardMatch[2] ? `${rewardMatch[1]} x${rewardMatch[2]}` : rewardMatch[1];
                
                if (this.signInDetails[gameKey].reward) {
                    this.signInDetails[gameKey].reward += `, ${newReward}`;
                } else {
                    this.signInDetails[gameKey].reward = newReward;
                }
                
                this.signInDetails[gameKey].status = 'success';
                this.signInDetails[gameKey].statusText = '签到成功';
                this.updateSignInDetails();
                
                console.log('实时解析到奖励:', newReward, '总奖励:', this.signInDetails[gameKey].reward);
            }
        }
        
        // 解析米游币信息
        if (logEntry.includes('米游币')) {
            const totalCoinMatch = logEntry.match(/目前有\s*(\d+)\s*个?米游币/);
            if (totalCoinMatch) {
                this.signInDetails[gameKey].coins = `总计 ${totalCoinMatch[1]}`;
                this.updateSignInDetails();
                console.log('实时解析到总米游币:', this.signInDetails[gameKey].coins);
            } else {
                const coinMatch = logEntry.match(/(?:已经获得|今天已经签到过了|获得|今天获得)\s*(\d+)\s*个?米游币/);
                if (coinMatch) {
                    const todayCoins = coinMatch[1];
                    const currentCoins = this.signInDetails[gameKey].coins;
                    this.signInDetails[gameKey].coins = currentCoins ? 
                        `${currentCoins} (今日+${todayCoins})` : `今日 ${todayCoins}`;
                    this.updateSignInDetails();
                    console.log('实时解析到今日米游币:', todayCoins);
                }
            }
        }
    }
    
    // 处理签到完成
    handleSignInCompletionFromLog(gameKey) {
        if (this.signInDetails[gameKey]) {
            this.signInDetails[gameKey].status = 'success';
            this.signInDetails[gameKey].statusText = '已签到';
            this.updateSignInDetails();
            
            const activityMessage = `米游社签到完成${this.signInDetails[gameKey].reward ? `: ${this.signInDetails[gameKey].reward}` : ''}${this.signInDetails[gameKey].coins ? ` (${this.signInDetails[gameKey].coins})` : ''}`;
            this.addActivity(activityMessage, 'success');
            this.showNotification(activityMessage, 'success');
        }
    }

    updateSignInDetails() {
        // 更新仪表盘中的签到详情（现在为空，因为已移除）
        const container = document.getElementById('signInDetails');
        if (container) {
            // 仪表盘中的签到详情已移除，保留空函数避免错误
        }
        
        // 更新侧边栏中的签到详情
        this.updateSidebarSignInDetails();
    }
    
    updateSidebarSignInDetails() {
        const container = document.getElementById('sidebarSignInDetails');
        const section = document.getElementById('sidebarSignInSection');
        
        if (Object.keys(this.signInDetails).length === 0) {
            section.classList.remove('show');
            return;
        }
        
        section.classList.add('show');
        container.innerHTML = Object.entries(this.signInDetails).map(([gameKey, details]) => `
            <div class="signin-item-sidebar ${details.status}">
                <div class="signin-game-sidebar">
                    <div class="signin-game-icon-sidebar">${details.icon || '🎮'}</div>
                    <span class="signin-game-name-sidebar">${details.name || gameKey}</span>
                </div>
                <div class="signin-result-sidebar">
                    <div class="signin-status-sidebar ${details.status}">${details.statusText}</div>
                    ${details.reward ? details.reward.split(',').map(item => `<div class="signin-reward-sidebar">🎁 ${item.trim()}</div>`).join('') : ''}
                    ${details.coins ? `<div class="signin-reward-sidebar">🪙 总计 ${details.coins}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    updateTotalScriptRuntime() {
        // 计算当前正在运行的脚本的实时运行时长
        let currentRuntime = 0;
        Object.entries(this.runningProcesses || {}).forEach(([key, process]) => {
            if (process.status && (
                process.status.includes('正在') || 
                process.status.includes('签到进行中') ||
                process.status.includes('等待') ||
                process.status === 'running'
            )) {
                if (this.scriptStartTimes[key]) {
                    const currentDuration = Date.now() - this.scriptStartTimes[key];
                    if (currentDuration > 0) {
                        currentRuntime += currentDuration;
                    }
                }
            }
        });
        
        // 总时长 = 已完成的脚本时长 + 当前正在运行的脚本时长
        return this.totalScriptRuntime + currentRuntime;
    }

    updateScriptRuntimeTracking(newProcesses) {
        // 检查每个进程的状态变化
        Object.entries(newProcesses).forEach(([key, newProcess]) => {
            const oldProcess = this.runningProcesses ? this.runningProcesses[key] : null;
            
            const isNewProcessRunning = newProcess.status && (
                newProcess.status.includes('正在') || 
                newProcess.status.includes('签到进行中') ||
                newProcess.status.includes('等待') ||
                newProcess.status === 'running'
            );
            
            const wasOldProcessRunning = oldProcess && oldProcess.status && (
                oldProcess.status.includes('正在') || 
                oldProcess.status.includes('签到进行中') ||
                oldProcess.status.includes('等待') ||
                oldProcess.status === 'running'
            );
            
            // 进程开始运行
            if (isNewProcessRunning && !wasOldProcessRunning) {
                if (newProcess.startTime && !this.scriptStartTimes[key]) {
                    this.scriptStartTimes[key] = newProcess.startTime;
                    console.log(`脚本 ${key} 开始运行，开始时间: ${new Date(newProcess.startTime).toLocaleTimeString()}`);
                }
            }
            
            // 进程停止运行
            if (!isNewProcessRunning && wasOldProcessRunning) {
                if (this.scriptStartTimes[key]) {
                    const endTime = newProcess.endTime || Date.now();
                    const duration = endTime - this.scriptStartTimes[key];
                    if (duration > 0) {
                        this.totalScriptRuntime += duration;
                        console.log(`脚本 ${key} 结束运行，本次运行时长: ${this.formatDuration(duration)}, 总累计时长: ${this.formatDuration(this.totalScriptRuntime)}`);
                    }
                    delete this.scriptStartTimes[key];
                }
            }
        });
        
        this.runningProcesses = newProcesses;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分${seconds % 60}秒`;
        } else if (minutes > 0) {
            return `${minutes}分${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AutoMihoyoApp();
});
