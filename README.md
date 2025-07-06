# AUTO-mihoyo-all 项目说明

## 项目简介
Electron设计的米哈游游戏自动化统一管理工具。

**� 便携版专享特性:**
- ✅ **即下即用** - 无需安装，双击即可运行
- ✅ **零依赖** - 所有必需组件已内置
- ✅ **配置同目录** - 配置文件与exe在同一文件夹
- ✅ **绿色软件** - 不写注册表，不留系统垃圾

**支持的游戏项目:**
- [MihoyoBBSTools](https://github.com/Womsxd/MihoyoBBSTools) - 米游社签到(py脚本)
- [March7thAssistant](https://github.com/moesnow/March7thAssistant) - 崩坏:星穹铁道三月七助手(单独程序)
- [ZenlessZoneZero-OneDragon](https://github.com/DoctorReid/ZenlessZoneZero-OneDragon) - 绝区零一条龙(单独程序)
- [better-genshin-impact](https://github.com/babalae/better-genshin-impact) - 原神BetterGI(单独程序加参数)

**主要特性:**
- 🎯 **统一配置管理** - JSON配置格式，支持每个游戏的独立设置
- ⚡ **便携版优化** - 专为便携使用场景优化，快速启动，零依赖运行
- 📊 **智能状态显示** - 实时显示每个游戏的启用状态和路径验证结果
- ⏱️ **执行时间统计** - 记录和显示各游戏的执行时长和运行历史
- 🛡️ **进程监控** - 自动监控游戏进程，支持实时运行时间显示和自定义进程名
- 📝 **完善的日志** - 自动日志轮转，详细记录执行过程，支持多级日志
- 🎮 **灵活执行** - 支持单独执行、批量执行、自动运行多种模式
- 🖥️ **双重界面** - 提供Electron图形界面和Node.js命令行两种使用方式
- 🔍 **自动检测** - 智能检测常见游戏安装路径，简化配置过程
- ⚙️ **高度可配置** - 支持启动参数、工作目录、等待时间等详细配置

## 🚀 使用方式

### 快速开始
1. **下载便携版**: 从Releases下载最新的便携版exe文件
2. **直接运行**: 双击exe文件即可启动，首次运行会自动创建配置文件  
3. **配置游戏**: 在界面中启用需要的游戏并设置路径
4. **开始使用**: 点击"运行全部"或单独运行游戏

### 开发版本
```bash
# 安装依赖
npm install

# 启动Electron图形界面
npm start

# 使用Node.js命令行版本
node AutoGAME.js --validate
node AutoGAME.js --auto-detect  
node AutoGAME.js --all

# 构建便携版
npm run dist
```

### 批处理脚本
- `start.bat` - 启动图形界面版本
- `auto-run.bat` - 自动运行所有启用的游戏  
- `run-nodejs.bat [参数]` - Node.js命令行版本
- `build.bat` - 构建便携版exe

## 开发文件结构
```
AUTO-mihoyo-all/
├── src/                     # 源码目录
│   ├── AutoGAME.js         # Node.js核心逻辑
│   ├── main.js             # Electron主进程
│   ├── preload.js          # 预加载脚本
│   └── renderer/           # 渲染进程文件
│       ├── index.html      # 主界面
│       ├── styles.css      # 样式文件
│       └── app.js          # 前端逻辑
├── assets/                  # 应用资源文件
│   └── icon.svg            # 应用图标
├── AutoGAME.js              # Node.js版本入口（新）
├── config.json.template     # 配置文件模板
└── dist/                   #开发过程中的打包目录和测试用应用根目录
    ├── 打包好的.exe
    ├── log/
    └── config.json            # exe生成和控制的用户配置文件

```
## 发行版文件结构
```
应用根目录/
├── 下载的打包好的.exe
├── log/
└── config.json            # exe生成和控制的用户配置文件
```

### ✅ 检查内容
- ✅ 验证 `config.json` 文件是否存在并格式正确
- ✅ 检查所有启用游戏的可执行文件路径有效性
- ✅ 确认工作目录和启动参数配置
- ✅ 验证进程监控设置和进程名配置
- ✅ 显示配置状态统计信息和警告提示

## 📸 功能截图

### 🎮 游戏配置界面
- 直观的卡片式游戏配置界面
- 一键启用/禁用游戏
- 文件选择器快速设置路径
- 实时配置验证和状态显示

### 📊 进程监控界面  
- 实时显示运行中的游戏进程
- 监控进程运行时间和状态
- 支持自定义进程名监控

### 📝 日志查看界面
- 彩色日志显示，便于问题定位
- 支持日志搜索和过滤
- 自动日志轮转管理

### ⚙️ 全局设置界面
- 自动运行模式配置
- 日志级别和文件数量设置  
- 进程监控间隔调整

## 🔧 配置示例

### 基础配置
```json
{
  "version": "1.0.0",
  "autoRun": false,
  "logLevel": "info",
  "games": {
    "mihoyoBBSTools": {
      "enabled": true,
      "name": "米游社签到工具",
      "path": "C:\\Tools\\MihoyoBBSTools\\main.py",
      "workingDir": "C:\\Tools\\MihoyoBBSTools",
      "arguments": [],
      "waitTime": 30000,
      "monitoring": {
        "enabled": true,
        "processName": "python.exe"
      }
    }
  }
}
```

### 高级配置选项
- **waitTime**: 游戏执行后的等待时间（毫秒）
- **monitoring.enabled**: 是否启用进程监控
- **monitoring.processName**: 要监控的进程名
- **monitoring.customProcessName**: 自定义进程名（可选）


## 🔧 高级功能

### 进程监控
- 自动监控游戏进程，实时显示运行时间
- 记录每个游戏的详细执行时长

### 日志管理
- 自动轮转日志文件，保留指定数量的历史日志
- 详细记录每个步骤的执行过程和时间
- 支持查看上次运行的统计信息

## 🛠️ 开发说明

### 技术架构
- **前端**: Electron + HTML5 + CSS3 + JavaScript
- **后端**: Node.js + fs-extra + node-schedule
- **进程管理**: 跨平台进程监控和执行
- **配置管理**: JSON格式配置文件
- **日志系统**: 自动轮转日志记录

### 开发环境搭建
```bash
# 克隆项目
git clone <repository-url>
cd AUTO-mihoyo-all

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建应用
npm run build
```

### 项目脚本
- `npm start` - 启动应用
- `npm run dev` - 开发模式(带调试)
- `npm run build` - 构建便携版
- `npm run dist` - 构建所有版本
- `npm run pack` - 仅打包不压缩

### 便携版特性
- ✅ **零安装**: 下载即用，无需安装过程
- ✅ **自包含**: 所有依赖和运行时已内置
- ✅ **绿色软件**: 不修改系统，不写注册表
- ✅ **配置便携**: 配置和日志与exe在同目录
- ✅ **自动配置**: 首次运行自动生成配置文件

### 自动化配置功能
- 🔍 **路径自动检测**: 智能扫描常见安装位置
- 📝 **配置模板**: 预设各游戏的默认参数
- ✅ **配置验证**: 自动验证路径和参数有效性
- 🔄 **配置同步**: 实时保存和同步配置更改

### 进程监控系统
- 📊 **实时监控**: 监控游戏进程运行状态
- ⏱️ **运行时长**: 记录和显示进程运行时间
- 🎯 **灵活配置**: 可选择监控的进程名称
- 🔍 **智能检测**: 跨平台进程状态检测

### 使用方式

#### 方式一: 便携版exe (推荐)
```bash
# 下载便携版exe文件
# 双击运行即可，首次运行会自动创建配置

# 自动运行模式
AUTO-mihoyo-all.exe --auto-run
```

#### 方式二: Node.js命令行
```bash
# 查看帮助
node AutoGAME.js --help

# 验证配置
node AutoGAME.js --validate

# 自动检测游戏
node AutoGAME.js --auto-detect

# 运行单个游戏
node AutoGAME.js --game=mihoyoBBSTools

# 运行所有游戏
node AutoGAME.js --all
```

#### 方式三: 使用批处理脚本
```bash
# Windows 启动脚本
start.bat              # 启动GUI应用
auto-run.bat           # 自动运行所有游戏
run-nodejs.bat --help  # Node.js命令行版本
build.bat              # 构建便携版
```

### 配置文件说明
配置文件采用JSON格式，支持以下选项：

```json
{
  "version": "1.0.0",
  "autoRun": false,                    // 启动时自动运行
  "logLevel": "info",                  // 日志级别
  "maxLogFiles": 10,                   // 最大日志文件数
  "processMonitoring": {
    "enabled": true,                   // 启用进程监控
    "checkInterval": 5000             // 检查间隔(毫秒)
  },
  "games": {
    "gameKey": {
      "enabled": false,                // 是否启用
      "name": "游戏名称",
      "path": "可执行文件路径",
      "workingDir": "工作目录",
      "arguments": ["启动参数"],
      "waitTime": 30000,              // 等待时间(毫秒)
      "monitoring": {
        "enabled": false,             // 是否监控此游戏
        "processName": "进程名",
        "customProcessName": ""       // 自定义进程名
      }
    }
  }
}
```

## 🔧 故障排除

### 常见问题

1. **应用无法启动**
   - 检查是否安装了Node.js运行时
   - 确认config.json文件格式正确
   - 查看log目录下的错误日志

2. **游戏路径检测失败**
   - 手动设置游戏可执行文件路径
   - 确认游戏已正确安装
   - 检查文件权限设置

3. **进程监控不工作**
   - 确认进程名称设置正确
   - 检查系统权限设置
   - 验证监控功能已启用

4. **配置文件损坏**
   - 删除config.json文件，重新启动应用
   - 应用会自动从模板重新创建配置

### 日志文件位置
- **便携版**: exe同目录下的`log/`文件夹
- **开发版**: 项目根目录下的`log/`文件夹

### 联系支持
如遇到问题，请：
1. 查看最新的日志文件
2. 确认配置文件格式正确
3. 提供详细的错误信息和系统环境