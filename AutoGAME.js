#!/usr/bin/env node

const AutoGAME = require('./src/AutoGAME');
const path = require('path');

class NodeJSRunner {
  constructor() {
    this.autoGame = new AutoGAME();
    this.args = process.argv.slice(2);
  }

  async run() {
    try {
      console.log('================================');
      
      if (this.args.includes('--help') || this.args.includes('-h')) {
        this.showHelp();
        return;
      }

      if (this.args.includes('--validate')) {
        await this.validateConfig();
        return;
      }

      if (this.args.includes('--auto-detect')) {
        await this.autoDetectGames();
        return;
      }

      const gameKey = this.args.find(arg => arg.startsWith('--game='));
      if (gameKey) {
        const key = gameKey.split('=')[1];
        await this.runSingleGame(key);
        return;
      }

      if (this.args.includes('--all')) {
        await this.runAllGames();
        return;
      }

      // 默认显示状态
      await this.showStatus();
      
      // 确保程序退出
      this.autoGame.stopProcessMonitoring();
      
    } catch (error) {
      console.error('❌ 执行失败:', error.message);
      this.autoGame.stopProcessMonitoring();
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
使用方法:
  node AutoGAME.js [选项]

选项:
  --help, -h              显示此帮助信息
  --validate              验证配置文件
  --auto-detect           自动检测游戏路径
  --game=<gameKey>        运行指定游戏
  --all                   运行所有启用的游戏
  
游戏键值:
  mihoyoBBSTools         米游社签到工具
  march7thAssistant      三月七助手
  zenlessZoneZero        绝区零一条龙
  betterGenshinImpact    原神BetterGI

示例:
  node AutoGAME.js --validate
  node AutoGAME.js --game=mihoyoBBSTools
  node AutoGAME.js --all
`);
  }

  async showStatus() {
    try {
      const config = await this.autoGame.getConfig();
      const validation = await this.autoGame.validateConfig();
      
      console.log('📊 当前状态:');
      console.log(`   配置状态: ${validation.valid ? '✅ 有效' : '❌ 无效'}`);
      console.log(`   启用游戏: ${validation.enabledGames}/${validation.totalGames}`);
      console.log(`   最后更新: ${config.lastUpdated || '未知'}`);
      
      if (validation.errors.length > 0) {
        console.log('\n❌ 配置错误:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️  警告:');
        validation.warnings.forEach(warning => console.log(`   - ${warning}`));
      }

      console.log('\n🎮 游戏状态:');
      Object.entries(config.games).forEach(([key, game]) => {
        const status = game.enabled ? '✅ 启用' : '⭕ 禁用';
        const pathStatus = game.path ? '✅' : '❌';
        console.log(`   ${game.name}: ${status} (路径: ${pathStatus})`);
      });
      
      this.autoGame.stopProcessMonitoring();
      
    } catch (error) {
      console.error('获取状态失败:', error.message);
      this.autoGame.stopProcessMonitoring();
    }
  }

  async validateConfig() {
    console.log('🔍 验证配置中...');
    
    try {
      const validation = await this.autoGame.validateConfig();
      
      if (validation.valid) {
        console.log('✅ 配置验证通过');
      } else {
        console.log('❌ 配置验证失败');
        validation.errors.forEach(error => console.log(`   - ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('⚠️  警告:');
        validation.warnings.forEach(warning => console.log(`   - ${warning}`));
      }
      
      // 确保程序退出
      this.autoGame.stopProcessMonitoring();
      
    } catch (error) {
      console.error('验证失败:', error.message);
      this.autoGame.stopProcessMonitoring();
    }
  }

  async autoDetectGames() {
    console.log('🔍 自动检测游戏路径中...');
    
    try {
      const detected = await this.autoGame.autoDetectGames();
      let detectedCount = 0;
      
      console.log('检测结果:');
      Object.entries(detected).forEach(([gameKey, path]) => {
        if (path) {
          console.log(`   ✅ ${gameKey}: ${path}`);
          detectedCount++;
        }
      });
      
      if (detectedCount === 0) {
        console.log('   ⭕ 未检测到任何游戏路径');
        this.autoGame.stopProcessMonitoring();
      } else {
        console.log(`\n总共检测到 ${detectedCount} 个游戏路径`);
        console.log('✅ 自动检测完成');
        this.autoGame.stopProcessMonitoring();
      }
      
    } catch (error) {
      console.error('自动检测失败:', error.message);
      this.autoGame.stopProcessMonitoring();
    }
  }

  async runSingleGame(gameKey) {
    console.log(`🎮 运行游戏: ${gameKey}`);
    
    try {
      const result = await this.autoGame.runSingleGame(gameKey);
      console.log(`✅ ${result.gameName} 执行完成`);
      console.log(`   执行时长: ${result.duration}ms`);
      console.log(`   日志文件: ${result.logFile}`);
      
      this.autoGame.stopProcessMonitoring();
      
    } catch (error) {
      console.error(`❌ 执行失败: ${error.message}`);
      this.autoGame.stopProcessMonitoring();
    }
  }

  async runAllGames() {
    console.log('🚀 运行所有启用的游戏');
    
    try {
      const result = await this.autoGame.runAllGames();
      
      console.log('\n📊 执行结果:');
      console.log(`   总计: ${result.summary.total}`);
      console.log(`   成功: ${result.summary.successful}`);
      console.log(`   失败: ${result.summary.failed}`);
      
      if (result.results.length > 0) {
        console.log('\n✅ 成功执行:');
        result.results.forEach(game => {
          console.log(`   - ${game.gameName} (${game.duration}ms)`);
        });
      }
      
      if (result.errors.length > 0) {
        console.log('\n❌ 执行失败:');
        result.errors.forEach(error => {
          console.log(`   - ${error.gameName}: ${error.error}`);
        });
      }
      
      this.autoGame.stopProcessMonitoring();
      
    } catch (error) {
      console.error(`❌ 批量执行失败: ${error.message}`);
      this.autoGame.stopProcessMonitoring();
    }
  }
}

// 直接执行时运行
if (require.main === module) {
  const runner = new NodeJSRunner();
  runner.run();
}

module.exports = NodeJSRunner;
