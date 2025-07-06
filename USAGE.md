# AUTO-mihoyo-all 使用说明

## 🚀 快速开始

### 1. 直接使用便携版（推荐）
- 下载最新的便携版exe文件
- 双击运行即可，首次运行会自动创建配置文件
- 所有配置和日志都保存在exe同目录下

### 2. 开发版本运行
```bash
# 1. 安装依赖
npm install

# 2. 启动图形界面版本
npm start

# 3. 使用Node.js命令行版本
node AutoGAME.js --validate
node AutoGAME.js --auto-detect
node AutoGAME.js --all
```

### 3. 使用批处理脚本
- `start.bat` - 启动图形界面版本
- `auto-run.bat` - 自动运行所有启用的游戏
- `run-nodejs.bat` - 使用Node.js命令行版本
- `build.bat` - 构建便携版exe文件

## 📋 配置游戏

### 支持的游戏
1. **米游社签到工具** (MihoyoBBSTools)
   - 可执行文件: `main.py` 或 `run.py`
   - 建议参数: 无

2. **三月七助手** (March7thAssistant)
   - 可执行文件: `March7thAssistant.exe`
   - 建议参数: 无

3. **绝区零一条龙** (ZenlessZoneZero-OneDragon)
   - 可执行文件: `OneDragon.exe`
   - 建议参数: 无

4. **原神BetterGI** (better-genshin-impact)
   - 可执行文件: `BetterGI.exe`
   - 建议参数: `--background`

### 配置步骤
1. 启动应用程序
2. 在游戏配置页面启用需要的游戏
3. 设置每个游戏的可执行文件路径
4. 可选：设置工作目录和启动参数
5. 配置进程监控（可选）
6. 点击"验证配置"确保设置正确

## 🔧 高级功能

### 进程监控
- 实时监控游戏进程运行状态
- 显示进程运行时间
- 支持自定义进程名监控

### 自动运行
- 启用"自动运行模式"后，程序启动时会自动执行所有启用的游戏
- 使用 `auto-run.bat` 或命令行参数 `--auto-run`

### 日志管理
- 自动记录所有操作的详细日志
- 支持日志文件轮转
- 可在界面中查看最近的日志

## 📁 文件结构

### 开发版本
```
AUTO-mihoyo-all/
├── src/                     # 源码目录
│   ├── main.js             # Electron主进程
│   ├── preload.js          # 预加载脚本
│   ├── AutoGAME.js         # 核心逻辑
│   └── renderer/           # 前端文件
├── assets/                 # 资源文件
├── config.json.template    # 配置模板
├── AutoGAME.js            # Node.js入口
└── *.bat                  # 启动脚本
```

### 便携版
```
应用目录/
├── AUTO-mihoyo-all.exe    # 主程序
├── config.json           # 用户配置
└── log/                  # 日志目录
```

## 🛠️ 构建说明

### 构建便携版
```bash
# 安装构建依赖
npm install electron-builder --save-dev

# 构建便携版
npm run dist -- --win portable

# 或使用脚本
build.bat
```

### 自定义构建
编辑 `electron-builder.config.js` 文件来自定义构建选项。

## ❓ 常见问题

### Q: 程序启动失败
A: 
1. 检查是否安装了Node.js
2. 运行 `npm install` 重新安装依赖
3. 查看控制台错误信息

### Q: 游戏执行失败
A:
1. 验证游戏路径是否正确
2. 检查游戏是否需要管理员权限
3. 查看日志文件了解详细错误

### Q: 进程监控不工作
A:
1. 确保进程名设置正确
2. 检查游戏是否真的在运行
3. 尝试使用自定义进程名

## 📞 技术支持

如遇到问题，请：
1. 查看日志文件
2. 使用 `node AutoGAME.js --validate` 验证配置
3. 检查游戏程序是否能独立运行

## 📄 许可证

MIT License - 自由使用和修改
