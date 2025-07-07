/**
 * 奖励解析器类
 * 用于解析游戏签到奖励和米游币信息
 */
class RewardParser {
    constructor() {
        this.gameIcons = {
            'mihoyoBBSTools': '🎮',
            'march7thAssistant': '🚂',
            'zenlessZoneZero': '🏙️',
            'betterGenshinImpact': '⚔️'
        };
    }

    /**
     * 获取游戏图标
     * @param {string} gameKey - 游戏键名
     * @returns {string} 游戏图标
     */
    getGameIcon(gameKey) {
        return this.gameIcons[gameKey] || '🎮';
    }

    /**
     * 解析签到奖励信息
     * @param {string} output - 日志输出内容
     * @param {string} gameName - 游戏名称
     * @param {Object} config - 游戏配置对象
     * @returns {Object} 解析结果
     */
    parseSignInRewards(output, gameName, config) {
        try {
            if (!output || typeof output !== 'string') {
                console.log('解析签到奖励: 输出为空或格式错误');
                return null;
            }
            
            // 防重复解析 - 基于输出内容和游戏名称确定游戏key
            const gameKey = Object.keys(config.games).find(key => 
                config.games[key].name === gameName
            ) || 'mihoyoBBSTools'; // 默认为米游社工具
            
            console.log('检测到游戏:', gameName, '对应Key:', gameKey);
            
            const lines = output.split('\n');
            let signinSuccess = false;
            let signinReward = '';
            let mihoyoCoins = '';
            let rewardCount = 0; // 统计找到的奖励数量
            
            console.log('开始解析签到奖励，总行数:', lines.length);
            
            // 解析每一行日志
            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // 检查签到成功状态
                signinSuccess = this._checkSignInSuccess(trimmedLine) || signinSuccess;
                
                // 解析奖励信息
                const rewardResult = this._parseRewardFromLine(trimmedLine);
                if (rewardResult) {
                    if (rewardCount === 0) {
                        signinReward = rewardResult;
                    } else {
                        signinReward += `, ${rewardResult}`;
                    }
                    rewardCount++;
                    console.log('解析到奖励:', rewardResult, '总计:', signinReward, '原文:', trimmedLine);
                }
                
                // 解析米游币数量
                const coinResult = this._parseMihoyoCoinsFromLine(trimmedLine);
                if (coinResult) {
                    mihoyoCoins = coinResult;
                    console.log('解析到米游币:', mihoyoCoins, '原文:', trimmedLine);
                }
            }
            
            console.log('签到解析完成:', {
                success: signinSuccess,
                reward: signinReward,
                coins: mihoyoCoins,
                gameName: gameName,
                gameKey: gameKey
            });
            
            return {
                gameKey,
                name: gameName,
                icon: this.getGameIcon(gameKey),
                status: signinSuccess ? 'success' : 'failed',
                statusText: signinSuccess ? '已签到' : '签到失败',
                reward: signinReward || undefined,
                coins: mihoyoCoins || undefined,
                lastOutput: output.substring(0, 1000) // 保存输出的前1000字符用于去重
            };
            
        } catch (error) {
            console.error('解析签到奖励失败:', error);
            throw error;
        }
    }

    /**
     * 从实时日志解析签到奖励
     * @param {string} gameKey - 游戏键名
     * @param {string} logEntry - 日志条目
     * @param {Object} config - 游戏配置
     * @param {Object} existingDetails - 现有的签到详情
     * @returns {Object} 更新后的签到详情
     */
    parseSignInRewardsFromRealTimeLog(gameKey, logEntry, config, existingDetails = null) {
        let signInDetails = existingDetails || {
            name: config.games[gameKey]?.name || '米游社签到工具',
            icon: this.getGameIcon(gameKey),
            status: 'running',
            statusText: '签到中...',
            reward: '',
            coins: ''
        };
        
        // 解析奖励信息
        const rewardResult = this._parseRewardFromLine(logEntry);
        if (rewardResult) {
            if (signInDetails.reward) {
                signInDetails.reward += `, ${rewardResult}`;
            } else {
                signInDetails.reward = rewardResult;
            }
            
            signInDetails.status = 'success';
            signInDetails.statusText = '签到成功';
            
            console.log('实时解析到奖励:', rewardResult, '总奖励:', signInDetails.reward);
        }
        
        // 解析米游币信息
        const coinResult = this._parseMihoyoCoinsFromLine(logEntry);
        if (coinResult) {
            // 处理米游币信息的累积显示
            if (coinResult.includes('总计')) {
                signInDetails.coins = coinResult;
            } else if (coinResult.includes('今日')) {
                const currentCoins = signInDetails.coins;
                signInDetails.coins = currentCoins ? 
                    `${currentCoins} (${coinResult})` : coinResult;
            } else {
                signInDetails.coins = coinResult;
            }
            
            console.log('实时解析到米游币:', coinResult, '当前显示:', signInDetails.coins);
        }
        
        return signInDetails;
    }

    /**
     * 从签到详情和活动记录中解析米游币数量
     * @param {Object} signInDetails - 签到详情对象
     * @param {Array} recentActivity - 最近活动记录
     * @param {Object} realtimeLogs - 实时日志
     * @returns {string} 米游币数量字符串
     */
    parseMihoyoCoins(signInDetails, recentActivity, realtimeLogs) {
        // 从签到详情中获取米游币数量
        for (const [gameKey, details] of Object.entries(signInDetails)) {
            if (details.coins) {
                return details.coins;
            }
        }
        
        // 从最近的活动记录中解析米游币数量
        const coinActivity = recentActivity.find(activity => 
            activity.message.includes('米游币') && 
            (activity.message.includes('已经获得') || activity.message.includes('目前有'))
        );
        
        if (coinActivity) {
            const match = coinActivity.message.match(/(?:已经获得|目前有)\s*(\d+)\s*个米游币/);
            return match ? match[1] : '-';
        }
        
        // 从实时日志中解析
        if (realtimeLogs) {
            for (const logs of Object.values(realtimeLogs)) {
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

    /**
     * 检查签到是否成功
     * @private
     * @param {string} line - 日志行
     * @returns {boolean} 是否成功
     */
    _checkSignInSuccess(line) {
        const successPatterns = [
            '执行完成，退出码: 0',
            '推送结果：ok',
            '推送完毕',
            '今天已经签到过了~',
            '签到任务执行完成',
            '签到执行完成',
            'dingrobot - 推送完毕'
        ];
        
        // 检查是否包含成功标志
        if (successPatterns.some(pattern => line.includes(pattern))) {
            console.log('检测到签到成功标志:', line);
            return true;
        }
        
        // 检查INFO级别的签到工具执行完成日志
        if (line.includes('INFO') && line.includes('签到工具') && line.includes('执行完成')) {
            console.log('检测到签到成功标志:', line);
            return true;
        }
        
        return false;
    }

    /**
     * 从日志行解析奖励信息
     * @private
     * @param {string} line - 日志行
     * @returns {string|null} 奖励信息或null
     */
    _parseRewardFromLine(line) {
        // 优先匹配纯奖励行（不包含INFO等前缀）
        if (line.startsWith('今天获得的奖励是') && !line.includes('INFO')) {
            console.log('找到纯奖励行:', line);
            return this._extractRewardFromText(line, '今天获得的奖励是');
        }
        
        // 匹配包含INFO的行
        if (line.includes('今天获得的奖励是')) {
            console.log('找到今天奖励行:', line);
            return this._extractRewardFromText(line, '今天获得的奖励是');
        }
        
        // 处理没有"今天"前缀的情况
        if (line.includes('获得的奖励是')) {
            console.log('找到获得奖励行:', line);
            return this._extractRewardFromText(line, '获得的奖励是');
        }
        
        return null;
    }

    /**
     * 从文本中提取奖励信息
     * @private
     * @param {string} text - 文本内容
     * @param {string} prefix - 前缀字符串
     * @returns {string|null} 奖励信息或null
     */
    _extractRewardFromText(text, prefix) {
        // 匹配：获得的奖励是「冒险家的经验」x2
        const rewardMatch = text.match(new RegExp(`${prefix}[「『]?([^」』\\n]+)[」』]?\\s*x?(\\d+)?`));
        if (rewardMatch) {
            const reward = rewardMatch[2] ? `${rewardMatch[1]} x${rewardMatch[2]}` : rewardMatch[1];
            return reward;
        }
        
        // 如果正则失败，尝试简单的字符串提取
        const simpleMatch = text.match(new RegExp(`${prefix}(.+)`));
        if (simpleMatch) {
            const reward = simpleMatch[1].trim();
            console.log('简单解析到奖励:', reward);
            return reward;
        }
        
        console.log('正则匹配失败');
        return null;
    }

    /**
     * 从日志行解析米游币信息
     * @private
     * @param {string} line - 日志行
     * @returns {string|null} 米游币信息或null
     */
    _parseMihoyoCoinsFromLine(line) {
        if (!line.includes('米游币')) {
            return null;
        }
        
        console.log('找到米游币行:', line);
        
        // 优先匹配当前总余额
        const totalCoinMatch = line.match(/目前有\s*(\d+)\s*个?米游币/);
        if (totalCoinMatch) {
            const result = `总计 ${totalCoinMatch[1]}`;
            console.log('解析到总米游币:', result);
            return result;
        }
        
        // 匹配今日获得数量
        const coinMatch = line.match(/(?:已经获得|今天已经签到过了|获得|今天获得)\s*(\d+)\s*个?米游币/);
        if (coinMatch) {
            const result = `今日 ${coinMatch[1]}`;
            console.log('解析到今日米游币:', result);
            return result;
        }
        
        // 尝试更宽松的匹配
        const looseMatch = line.match(/(\d+)\s*个?米游币/);
        if (looseMatch) {
            const result = looseMatch[1];
            console.log('宽松解析到米游币:', result);
            return result;
        }
        
        return null;
    }
}

// 导出类，用于在其他模块中使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RewardParser;
} else if (typeof window !== 'undefined') {
    window.RewardParser = RewardParser;
}
