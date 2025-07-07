class AutoMihoyoApp {
    constructor() {
        this.config = null;
        this.currentTab = 'dashboard'; // 改为默认显示仪表盘
        this.processStatusInterval = null;
        this.batchTaskMonitorInterval = null; // 批量任务监控间隔
        this.dashboardUpdateInterval = null;
        this.queueUpdateInterval = null; // 新增：队列状态快速更新间隔
        this.dashboardUpdateTimeout = null; // 仪表盘更新防抖
        this.signInDetails = {}; // 签到详情
        this.realtimeLogs = {}; // 实时日志
        this.logUpdateTimeout = null; // 日志更新节流器
        this.lastQueueStatusHash = null; // 队列状态缓存，避免重复渲染
        
        // 初始化奖励解析器
        this.rewardParser = new RewardParser();
        
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
            this.startQueueStatusUpdater(); // 启动队列状态快速更新器
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
        
        // 页面关闭时清理定时器
        window.addEventListener('beforeunload', () => {
            this.stopAllTimers();
        });
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
            // 清除缓存以确保切换到仪表盘时重新渲染队列状态
            this.lastQueueStatusHash = null;
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
                    <div class="monitoring-description">
                        <p class="description-text">
                            <strong>进程监控模式：</strong>启用后将监控指定进程的生命周期，而非启动程序本身的执行时间。<br>
                            <strong>阻塞运行模式：</strong>关闭时使用阻塞运行，以启动的脚本或应用结束作为计时标准。
                        </p>
                    </div>
                    <div class="setting-item">
                        <div class="setting-label">
                            <span>启用进程监控</span>
                            <small>切换监控模式：开启=监控指定进程，关闭=阻塞运行</small>
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
            
            this.showNotification(`正在启动 ${game.name}...`, 'info');
            
            // 启动进程并监听实时状态
            const result = await this.runGameWithRealTimeStatus(gameKey);
            
            if (result.error) {
                throw new Error(result.error);
            }
            
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
                this.handleSignInRewardParsing(result.output, game.name, gameKey);
            }
            
        } catch (error) {
            // 移除运行中进程状态
            delete this.runningProcesses[gameKey];
            this.updateDashboard();
            
            this.showNotification(`执行失败: ${error.message}`, 'error');
        }
    }

    async runGameWithRealTimeStatus(gameKey) {
        const game = this.config.games[gameKey];
        
        return new Promise((resolve, reject) => {
            // 移除前端时长统计和状态管理，后端会管理
            // 前端只负责日志收集和结果处理
            
            // 启动实时日志收集
            this.collectRealTimeLog(gameKey, `开始执行: ${game.name}`);
            
            // 调用实际的游戏运行方法
            window.electronAPI.runGame(gameKey)
                .then(result => {
                    // 对于签到类任务，处理特殊逻辑
                    if (gameKey === 'mihoyoBBSTools') {
                        this.handleSignInCompletion(gameKey, result, null, resolve, reject);
                    } else {
                        this.handleNormalGameCompletion(gameKey, result, resolve);
                    }
                })
                .catch(error => {
                    // 收集错误日志
                    this.collectRealTimeLog(gameKey, `执行失败: ${error.message}`);
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
        let waitCount = 0;
        const maxWaitTime = 120; // 最多等待2分钟
        
        const waitForSignInComplete = () => {
            waitCount++;
            // 检查是否真正完成
            if (this.isSignInReallyComplete(gameKey) || waitCount >= maxWaitTime) {
                this.collectRealTimeLog(gameKey, `签到流程完全结束，总耗时: ${result.duration + waitCount * 1000}ms`);
                
                resolve(result);
            } else {
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
    
    // 更新运行按钮状态的专用方法
    updateRunAllButtonState(state, forceUpdate = false) {
        const runAllBtn = document.getElementById('runAllBtn');
        if (!runAllBtn) return;
        
        const states = {
            idle: { text: '▶️ 运行全部', disabled: false, dataState: 'idle' },
            starting: { text: '🚀 正在启动...', disabled: true, dataState: 'starting' },
            executing: { text: '📋 执行中...', disabled: true, dataState: 'executing' },
            completed: { text: '✅ 执行完成', disabled: true, dataState: 'completed' }
        };
        
        const stateConfig = states[state];
        if (!stateConfig) return;
        
        // 只有在状态真正改变时才更新，或者强制更新
        if (forceUpdate || runAllBtn.textContent !== stateConfig.text) {
            runAllBtn.textContent = stateConfig.text;
            runAllBtn.disabled = stateConfig.disabled;
            runAllBtn.setAttribute('data-state', stateConfig.dataState);
            
            // 强制刷新DOM并添加状态变化日志
            requestAnimationFrame(() => {
                runAllBtn.offsetHeight; // 触发重排
                console.log(`运行按钮状态已更新: ${state} -> "${stateConfig.text}"`);
            });
        }
    }

    async runAllGames() {
        console.log('🎯 runAllGames 开始执行');
        const runAllBtn = document.getElementById('runAllBtn');
        const originalText = runAllBtn?.textContent || '▶️ 运行全部';
        
        this.showLoading(true);
        
        // 第一阶段：显示正在启动
        console.log('🚀 第一阶段：切换到启动状态');
        this.updateRunAllButtonState('starting', true);
        
        // 强制刷新 UI，确保第一阶段立即显示
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    console.log('✅ UI 刷新完成，准备进入下一阶段');
                    resolve();
                }, 100); // 短暂延迟确保UI更新
            });
        });
        
        try {
            // 显示启动提示
            this.showNotification('开始批量执行所有启用的游戏任务', 'info');
            
            // 在短暂延迟后立即进入第二阶段，不等待后端完全响应
            const statusTimer = setTimeout(() => {
                console.log('📋 第二阶段：切换到执行中状态（定时器触发）');
                this.updateRunAllButtonState('executing');
            }, 800); // 800ms 后进入执行中状态
            
            console.log('⏳ 开始调用后端 API');
            const result = await window.electronAPI.runAllGames();
            console.log('✅ 后端 API 调用完成');
            
            if (result.error) {
                clearTimeout(statusTimer);
                throw new Error(result.error);
            }
            
            const { summary } = result;
            
            // 确保按钮已经进入执行中状态
            clearTimeout(statusTimer);
            console.log('📋 第二阶段：确保执行中状态（API 完成后）');
            this.updateRunAllButtonState('executing');
            
            this.showNotification(
                `✅ 批量任务已启动: ${summary.total} 个任务加入队列`, 
                'success'
            );
            
            this.showNotification(
                `📋 请查看右侧任务队列了解执行进度`, 
                'info'
            );
            
            if (result.errors.length > 0) {
                result.errors.forEach(error => {
                    this.showNotification(`❌ ${error.gameName}: ${error.error}`, 'error');
                });
            }
            
            // 立即更新一次状态
            this.updateSidebarProcesses();
            
            // 开始监控任务完成状态
            console.log('🔍 开始监控任务完成状态');
            this.startBatchTaskMonitoring(runAllBtn, originalText);
            
        } catch (error) {
            console.error('❌ runAllGames 执行失败:', error);
            this.showNotification(`❌ 批量执行失败: ${error.message}`, 'error');
            // 发生错误时立即恢复按钮
            this.updateRunAllButtonState('idle');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 监控批量任务完成状态
    startBatchTaskMonitoring(runAllBtn, originalText) {
        if (this.batchTaskMonitorInterval) {
            clearInterval(this.batchTaskMonitorInterval);
        }
        
        let allTasksCompleted = false;
        let consecutiveEmptyChecks = 0; // 连续空队列检查次数
        
        console.log('🔍 开始批量任务监控，检查间隔：1秒');
        
        this.batchTaskMonitorInterval = setInterval(async () => {
            try {
                const status = await this.getQueueStatusFromBackend();
                console.log(`🔍 监控检查 - 队列长度: ${status?.queueLength}, 正在执行: ${status?.isExecutingTask}, 连续空检查: ${consecutiveEmptyChecks}`);
                
                if (status && status.queueLength === 0 && !status.isExecutingTask) {
                    consecutiveEmptyChecks++;
                    console.log(`✅ 队列为空，连续检查次数: ${consecutiveEmptyChecks}/2`);
                    
                    if (consecutiveEmptyChecks >= 2 && !allTasksCompleted) {
                        allTasksCompleted = true;
                        console.log('🎉 第三阶段：所有任务完成，切换到完成状态');
                        
                        // 第三阶段：显示执行完成
                        this.updateRunAllButtonState('completed');
                        
                        this.showNotification('🎉 所有批量任务已完成！', 'success');
                        
                        // 2秒后恢复按钮状态
                        setTimeout(() => {
                            console.log('🔄 最终阶段：恢复按钮到初始状态');
                            this.updateRunAllButtonState('idle');
                        }, 2000);
                        
                        // 清除监控
                        clearInterval(this.batchTaskMonitorInterval);
                        this.batchTaskMonitorInterval = null;
                        console.log('🛑 批量任务监控已停止');
                    }
                } else {
                    // 如果队列不为空或正在执行任务，重置连续检查计数
                    if (consecutiveEmptyChecks > 0) {
                        console.log(`🔄 队列非空，重置连续检查计数`);
                    }
                    consecutiveEmptyChecks = 0;
                    
                    // 确保按钮显示为执行中状态
                    if (!allTasksCompleted) {
                        this.updateRunAllButtonState('executing');
                    }
                }
            } catch (error) {
                console.error('❌ 监控批量任务状态失败:', error);
                consecutiveEmptyChecks = 0; // 出错时重置计数
            }
        }, 1000); // 改为每1秒检查一次，提高响应速度
        
        // 设置最大监控时间（10分钟），避免无限监控
        setTimeout(() => {
            if (this.batchTaskMonitorInterval) {
                console.log('⏰ 监控超时，自动停止');
                clearInterval(this.batchTaskMonitorInterval);
                this.batchTaskMonitorInterval = null;
                
                if (!allTasksCompleted) {
                    this.updateRunAllButtonState('idle');
                    this.showNotification('⚠️ 监控超时，按钮状态已重置', 'warning');
                }
            }
        }, 600000); // 10分钟超时
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
            // 减少队列状态更新频率，避免闪烁
            // 只有当前标签是仪表盘时才更新队列状态
            if (this.currentTab === 'dashboard') {
                this.updateQueueStatus();
            }
        }, 5000); // 增加更新间隔到5秒，减少频繁更新
    }

    // 启动队列状态快速更新器（已禁用以避免闪烁）
    startQueueStatusUpdater() {
    }

    // 更新队列等待时间显示（已禁用）
    updateQueueWaitTimes() {
        // 移除此方法以避免闪烁
    }

    // 停止所有定时器
    stopAllTimers() {
        if (this.processStatusInterval) {
            clearInterval(this.processStatusInterval);
            this.processStatusInterval = null;
        }
        if (this.queueUpdateInterval) {
            clearInterval(this.queueUpdateInterval);
            this.queueUpdateInterval = null;
        }
        if (this.dashboardUpdateInterval) {
            clearInterval(this.dashboardUpdateInterval);
            this.dashboardUpdateInterval = null;
        }
        if (this.batchTaskMonitorInterval) {
            clearInterval(this.batchTaskMonitorInterval);
            this.batchTaskMonitorInterval = null;
        }
        if (this.dashboardUpdateTimeout) {
            clearTimeout(this.dashboardUpdateTimeout);
            this.dashboardUpdateTimeout = null;
        }
    }

    // 从后端获取并更新总运行时长
    async updateTotalRuntimeFromBackend() {
        try {
            const result = await window.electronAPI.getProcessStatus();
            if (result && !result.error) {
                const totalRuntime = result.totalRuntime || 0; // 毫秒
                const hours = Math.floor(totalRuntime / (1000 * 60 * 60));
                const minutes = Math.floor((totalRuntime % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((totalRuntime % (1000 * 60)) / 1000);
                
                document.getElementById('totalRuntime').textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                // 调试信息（可选）
                if (totalRuntime > 0 && totalRuntime % 30000 === 0) { // 每30秒打印一次
                    console.log(`后端总运行时长: ${this.formatDuration(totalRuntime)}`);
                }
            }
        } catch (error) {
            console.error('获取后端运行时长失败:', error);
            // 如果获取失败，显示默认值
            document.getElementById('totalRuntime').textContent = '00:00:00';
        }
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
        // 防抖机制：如果频繁调用，延迟执行
        if (this.dashboardUpdateTimeout) {
            clearTimeout(this.dashboardUpdateTimeout);
        }
        
        this.dashboardUpdateTimeout = setTimeout(() => {
            this.updateStatusCards();
            this.updateRealTimeProcesses();
            this.updateSignInDetails();
            this.updateRealTimeLogs(); // 新增：更新实时日志显示
            this.updateQueueStatus(); // 新增：更新队列状态
        }, 200); // 200ms 防抖延迟
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
        
        // 使用后端提供的总运行时长数据
        this.updateTotalRuntimeFromBackend();
        
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
        // 只更新队列状态显示，移除重复的进程状态显示
        this.updateQueueStatus();
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
    
    // 更新队列状态显示
    updateQueueStatus() {
        const queueContainer = document.getElementById('queueStatus');
        if (!queueContainer) return;
        
        // 从全局状态获取队列信息（这里需要定期从后端获取）
        this.getQueueStatusFromBackend().then(status => {
            if (!status || status.error) return;
            
            const { currentTask, queueTasks, isExecutingTask, queueLength, completedTasks, totalTasks } = status;
            
            // 生成状态摘要用于比较，避免不必要的重新渲染
            const statusHash = JSON.stringify({
                currentTaskName: currentTask?.gameName,
                currentTaskRunTime: currentTask?.runTime ? Math.floor(currentTask.runTime / 10) : null, // 10秒精度
                isExecutingTask,
                queueLength,
                totalTasks,
                completedCount: completedTasks ? completedTasks.length : 0
            });
            
            // 如果状态没有显著变化，跳过重新渲染
            if (this.lastQueueStatusHash === statusHash) {
                return;
            }
            this.lastQueueStatusHash = statusHash;
            
            let queueHtml = '';
            
            // 显示任务进度总览
            if (totalTasks > 0) {
                const completedCount = completedTasks ? completedTasks.length : 0;
                const progressPercent = Math.round((completedCount / totalTasks) * 100);
                
                queueHtml += `
                    <div class="queue-progress-overview">
                        <div class="progress-header">
                            <span class="progress-text">📊 批量执行进度</span>
                            <span class="progress-stats">${completedCount}/${totalTasks}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="progress-percentage">${progressPercent}%</div>
                    </div>
                `;
            }
            
            if (isExecutingTask && currentTask) {
                // 显示当前执行任务
                const gameName = currentTask.gameName || currentTask.gameKey;
                const runTime = currentTask.runTime ? this.formatDuration(currentTask.runTime * 1000) : '启动中';
                
                // 根据任务类型确定显示的任务类型和CSS类
                let taskType = '游戏任务';
                let statusIcon = '🚀';
                let statusText = '正在执行';
                let taskClass = '';
                
                if (currentTask.isSignInTask) {
                    taskType = '签到任务';
                    taskClass = 'signin-task';
                } else if (currentTask.isBlockingTask) {
                    taskType = '阻塞任务';
                    statusIcon = '⏳';
                    statusText = '阻塞运行中';
                    taskClass = 'blocking-task';
                } else if (currentTask.isMonitoredTask) {
                    taskType = '监控任务';
                    statusIcon = '👁️';
                    statusText = '进程监控中';
                    taskClass = 'monitored-task';
                }
                
                queueHtml += `
                    <div class="queue-current-task ${taskClass}">
                        <div class="task-header">
                            <span class="task-status running">${statusIcon} ${statusText}</span>
                            <span class="task-type">${taskType}</span>
                        </div>
                        <div class="task-name">${gameName}</div>
                        <div class="task-timing">
                            <div class="task-runtime">已运行: ${runTime}</div>
                        </div>
                        ${currentTask.processName && currentTask.processName !== '阻塞运行' ? 
                            `<div class="task-process">监控进程: ${currentTask.processName}</div>` : 
                            ''}
                    </div>
                `;
            }
            
            if (queueLength > 0) {
                // 计算总等待时间
                const currentTaskRemaining = currentTask ? 
                    Math.max(0, (currentTask.estimatedDuration || 300) - (currentTask.runTime || 0)) : 0;
                
                // 显示等待队列
                queueHtml += `
                    <div class="queue-waiting-tasks">
                        <div class="queue-header">
                            <span class="queue-count">⏰ 等待执行: ${queueLength} 个任务</span>
                        </div>
                        <div class="queue-list">
                `;
                
                let cumulativeWaitTime = currentTaskRemaining;
                
                queueTasks.slice(0, 4).forEach((task, index) => {
                    const position = index + 1;
                    
                    // 计算任务类型
                    let taskTypeIcon = '🎮';
                    let taskTypeClass = '';
                    if (task.isSignInTask) {
                        taskTypeIcon = '✅';
                        taskTypeClass = 'signin-queue-item';
                    } else if (task.isBlockingTask) {
                        taskTypeIcon = '⏳';
                        taskTypeClass = 'blocking-queue-item';
                    }
                    
                    queueHtml += `
                        <div class="queue-item ${taskTypeClass}" data-position="${position}">
                            <span class="queue-position">${position}.</span>
                            <div class="queue-task-info">
                                <div class="queue-task-header">
                                    <span class="queue-task-name">${taskTypeIcon} ${task.gameName}</span>
                                    ${task.isSignInTask ? '<span class="task-badge signin">签到</span>' : ''}
                                    ${task.isBlockingTask ? '<span class="task-badge blocking">阻塞</span>' : ''}
                                </div>
                                <div class="queue-timing">
                                    <span class="queue-status">⏳ 等待中</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                if (queueLength > 4) {
                    queueHtml += `<div class="queue-more">...还有${queueLength - 4}个任务</div>`;
                }
                
                queueHtml += '</div></div>';
            }
            
            // 显示已完成任务（最近3个）
            if (completedTasks && completedTasks.length > 0) {
                queueHtml += `
                    <div class="queue-completed-tasks">
                        <div class="completed-header">
                            <span class="completed-count">✅ 最近完成: ${completedTasks.length > 3 ? '3+' : completedTasks.length} 个任务</span>
                        </div>
                        <div class="completed-list">
                `;
                
                completedTasks.slice(-3).reverse().forEach((task, index) => {
                    const completedAgo = task.completedAt ? 
                        this.getTimeAgo(new Date(task.completedAt)) : '刚刚';
                    const duration = task.actualDuration ? 
                        this.formatDuration(task.actualDuration * 1000) : '未知';
                    const success = task.success !== false;
                    
                    // 计算任务类型
                    let taskTypeIcon = '🎮';
                    let taskTypeText = '';
                    if (task.isSignInTask) {
                        taskTypeIcon = '✅';
                        taskTypeText = '签到';
                    } else if (task.isBlockingTask) {
                        taskTypeIcon = '⏳';
                        taskTypeText = '阻塞';
                    }
                    
                    queueHtml += `
                        <div class="completed-item ${success ? 'success' : 'failed'}" data-index="${index}">
                            <span class="completed-status">${success ? '✅' : '❌'}</span>
                            <div class="completed-task-info">
                                <div class="completed-task-header">
                                    <span class="completed-task-name">${taskTypeIcon} ${task.gameName}</span>
                                    ${taskTypeText ? `<span class="completed-task-type">${taskTypeText}</span>` : ''}
                                </div>
                                <div class="completed-timing">
                                    <span class="completed-time">${completedAgo}</span>
                                    <span class="completed-duration">耗时 ${duration}</span>
                                </div>
                                ${!success && task.error ? 
                                    `<div class="completed-error">错误: ${task.error}</div>` : 
                                    ''}
                            </div>
                        </div>
                    `;
                });
                
                queueHtml += '</div></div>';
            }
            
            if (!isExecutingTask && queueLength === 0) {
                queueHtml += `
                    <div class="queue-idle">
                        <div class="idle-status">✅ 所有任务已完成</div>
                        <div class="idle-message">点击"全部运行"开始批量执行任务</div>
                    </div>
                `;
            }
            
            queueContainer.innerHTML = queueHtml;
        }).catch(err => {
            console.error('获取队列状态失败:', err);
        });
    }
    
    // 从后端获取队列状态
    async getQueueStatusFromBackend() {
        try {
            const result = await window.electronAPI.getProcessStatus();
            if (result && !result.error) {
                return {
                    currentTask: result.currentTask,
                    queueTasks: result.taskQueue || [],
                    isExecutingTask: result.isExecutingTask,
                    queueLength: result.queueLength || 0,
                    completedTasks: result.completedTasks || [],
                    totalTasks: result.totalTasks || 0
                };
            }
            return null;
        } catch (error) {
            console.error('获取后端队列状态失败:', error);
            return null;
        }
    }

    // 获取相对时间描述
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffMins < 1440) {
            const hours = Math.floor(diffMins / 60);
            return `${hours}小时前`;
        } else {
            const days = Math.floor(diffMins / 1440);
            return `${days}天前`;
        }
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
            
            await this.runSingleGame(gameKey);
        } catch (error) {
            this.showNotification(`快捷启动失败: ${error.message}`, 'error');
        }
    }
    
    async stopAllProcesses() {
        try {
            const result = await window.electronAPI.stopAllProcesses();
            if (result.success) {
                this.runningProcesses = {};
                this.updateDashboard();
            }
        } catch (error) {
            console.error('停止进程失败:', error.message);
        }
    }
    
    async stopProcess(processKey) {
        try {
            const result = await window.electronAPI.stopProcess(processKey);
            if (result.success) {
            }
        } catch (error) {
            console.error('停止进程失败:', error.message);
        }
    }
    
    getTodaySignInStatus() {
        // 从签到详情中获取状态
        const hasSuccessfulSignIn = Object.values(this.signInDetails).some(
            details => details.status === 'success'
        );
        
        if (hasSuccessfulSignIn) {
            return '已完成';
        }
        
        // 检查是否有失败记录
        const hasFailedSignIn = Object.values(this.signInDetails).some(
            details => details.status === 'error' || details.status === 'failure'
        );
        
        if (hasFailedSignIn) {
            return '失败';
        }
        
        // 检查是否有进行中的签到
        const hasOngoingSignIn = Object.values(this.signInDetails).some(
            details => details.status === 'running' || details.status === 'pending'
        );
        
        if (hasOngoingSignIn) {
            return '进行中';
        }
        
        return '未执行';
    }
    
    parseMihoyoCoins() {
        // 使用 RewardParser 解析米游币
        return this.rewardParser.parseMihoyoCoins(
            this.signInDetails, 
            null, // 移除 recentActivity 参数
            this.realtimeLogs
        );
    }
    
    // 获取签到任务的原始开始时间，防止时间跳变
    getSignInOriginalStartTime(gameKey) {
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
                    
                    // 移除前端时长统计，使用后端管理
                    // this.updateScriptRuntimeTracking(newProcesses);
                    
                    this.runningProcesses = newProcesses;
                    this.updateStatusPanel();
                    
                    // 更新侧边栏进程状态（包含队列状态）
                    this.updateSidebarProcesses();
                }
            } catch (error) {
                console.error('获取进程状态失败:', error);
            }
        }, 2000); // 改为每2秒检查一次，更及时显示状态变化
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

    handleSignInRewardParsing(output, gameName, gameKey) {
        try {
            // 如果已经解析过这个游戏的签到结果且输出内容没有变化，跳过
            if (gameKey && this.signInDetails[gameKey] && 
                this.signInDetails[gameKey].lastOutput === output.substring(0, 1000)) {
                console.log('已解析过相同输出的签到结果，跳过重复解析:', gameKey);
                return;
            }

            // 使用 RewardParser 解析奖励
            const parsedResult = this.rewardParser.parseSignInRewards(output, gameName, this.config);
            
            if (parsedResult && parsedResult.gameKey) {
                // 更新签到详情
                this.signInDetails[parsedResult.gameKey] = parsedResult;
                
                // 立即更新显示
                this.updateSignInDetails();
                
                // 更新今日签到状态
                const activityMessage = `${gameName} 签到${parsedResult.status === 'success' ? '成功' : '失败'}${parsedResult.reward ? `: ${parsedResult.reward}` : ''}${parsedResult.coins ? ` (米游币: ${parsedResult.coins})` : ''}`;
                
                // 显示通知（只显示一次）
                this.showNotification(activityMessage, parsedResult.status === 'success' ? 'success' : 'error');
                
                console.log('签到状态解析完成:', {
                    game: gameName,
                    success: parsedResult.status === 'success',
                    reward: parsedResult.reward,
                    coins: parsedResult.coins
                });
            }
            
        } catch (error) {
            console.error('解析签到奖励失败:', error);
            this.showNotification(`解析签到奖励失败: ${error.message}`, 'error');
        }
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
        
        // 移除前端的进程状态管理，改为依赖后端数据
        // 前端只负责日志收集和显示，进程状态由后端 ProcessMonitor 管理
        // 如果需要特殊的日志处理，可以在这里添加，但不修改进程状态
        
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
        
        // 移除活动记录功能，只保留日志记录
        console.log('重要日志事件:', logEntry);
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
            
            // 移除前端进程状态更新，依赖后端数据
            // 特殊处理签到任务的进程状态更新
            // if (gameKey === 'mihoyoBBSTools' && this.runningProcesses[gameKey]) {
            //     this.updateSignInProcessStatus(gameKey, logEntry);
            // }
            
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
    
    // 更新签到进程状态 - 已简化，依赖后端状态管理
    updateSignInProcessStatus(gameKey, logEntry) {
        
        console.log(`签到日志: ${logEntry}`);
    }
    
    // 从实时日志解析签到奖励
    parseSignInRewardsFromRealTimeLog(gameKey, logEntry) {
        try {
            // 使用 RewardParser 从实时日志解析奖励
            const updatedDetails = this.rewardParser.parseSignInRewardsFromRealTimeLog(
                gameKey, 
                logEntry, 
                this.config, 
                this.signInDetails[gameKey]
            );
            
            if (updatedDetails) {
                this.signInDetails[gameKey] = updatedDetails;
                this.updateSignInDetails();
            }
        } catch (error) {
            console.error('实时解析签到奖励失败:', error);
        }
    }
    
    // 处理签到完成
    handleSignInCompletionFromLog(gameKey) {
        if (this.signInDetails[gameKey]) {
            this.signInDetails[gameKey].status = 'success';
            this.signInDetails[gameKey].statusText = '已签到';
            this.updateSignInDetails();
            
            const activityMessage = `米游社签到完成${this.signInDetails[gameKey].reward ? `: ${this.signInDetails[gameKey].reward}` : ''}${this.signInDetails[gameKey].coins ? ` (${this.signInDetails[gameKey].coins})` : ''}`;
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
                    <div class="signin-game-icon-sidebar">${details.icon || this.rewardParser.getGameIcon(gameKey)}</div>
                    <span class="signin-game-name-sidebar">${details.name || gameKey}</span>
                </div>
                <div class="signin-result-sidebar">
                    <div class="signin-status-sidebar ${details.status}">${details.statusText}</div>
                    ${details.reward ? details.reward.split(',').map(item => `<div class="signin-reward-sidebar">🎁 ${item.trim()}</div>`).join('') : ''}
                    ${details.coins ? `<div class="signin-reward-sidebar">🪙 ${details.coins}</div>` : ''}
                </div>
            </div>
        `).join('');
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
