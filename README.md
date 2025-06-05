# AUTO-mihoyo-all 项目说明

## 项目简介
通过一个统一的自动化脚本，一键调用多个米哈游相关的自动化项目。

**支持的游戏项目:**
- [MihoyoBBSTools](https://github.com/Womsxd/MihoyoBBSTools) - 米游社签到
- [March7thAssistant](https://github.com/moesnow/March7thAssistant) - 崩坏:星穹铁道三月七助手
- [ZenlessZoneZero-OneDragon](https://github.com/DoctorReid/ZenlessZoneZero-OneDragon) - 绝区零一条龙
- [better-genshin-impact](https://github.com/babalae/better-genshin-impact) - 原神BetterGI

**主要特性:**
- 🎯 **统一配置管理** - 新的JSON配置格式，支持每个游戏的独立设置
- 🔄 **自动配置迁移** - 自动将旧格式配置升级到新格式
- 📊 **智能状态显示** - 显示每个游戏的启用状态和路径验证
- ⏱️ **执行时间统计** - 记录和显示各游戏的执行时长
- 🛡️ **进程监控** - 自动监控游戏进程，支持实时运行时间显示
- 📝 **完善的日志** - 自动日志轮转，详细记录执行过程
- 🎮 **灵活执行** - 支持单独执行或批量执行游戏
## 文件结构
- **config.json.template**: 配置文件的模板，包括批处理文件路径、助手程序路径和进程监控设置等。
- **requirements.txt**: 列出项目所需的 Python 依赖项，使用 pip 安装。
- **自动化一条龙.bat**:通过bat运行py脚本,检查并安装依赖
## 使用说明

### 🚀 快速开始
1. **环境准备**: 确保已安装 Python 3.7+ 和 pip
2. **配置文件**: 
   - 将 `config.json.template` 重命名为 `config.json`
   - 根据模板中的中文提示，将标注为【必须修改】的路径替换为您的实际路径
   - 模板中所有以"请替换为实际路径"开头的路径都必须修改
3. **安装依赖**: 运行 `自动化一条龙.bat` 或执行 `pip install -r requirements.txt`
4. **运行程序**: 以管理员身份运行 `python AutoGAME.py` 或直接运行 `自动化一条龙.bat`

### ⚙️ 配置文件设置要点
- 📝 **模板使用**: 配置模板已包含详细的中文说明和示例
- ⚠️ **必须修改**: 所有标注【必须修改】的路径都需要替换为实际路径
- 🔧 **路径格式**: 使用双斜线 `\\` 或正斜线 `/` 分隔目录
- ✅ **路径验证**: 确保所有可执行文件路径正确且文件存在
- 🎛️ **游戏控制**: 不需要的游戏可将 `enabled` 设置为 `false`

### ⚙️ 配置说明
程序支持新的层次化配置格式，会自动迁移旧格式配置。配置文件包含两个主要部分：

#### 📋 配置文件创建步骤:
1. **复制模板**: 将 `config.json.template` 重命名为 `config.json`
2. **查找标记**: 找到所有【必须修改】标记的配置项
3. **替换路径**: 将"请替换为实际路径"替换为您的真实文件路径
4. **保存文件**: 确保所有路径都正确设置

#### 📝 配置示例对比:

**模板中的示例（需要修改）:**
```json
// 【必须修改】请替换为您的 MihoyoBBSTools 项目中 main.py 文件的完整路径
"executable_path": "请替换为实际路径\\MihoyoBBSTools\\main.py"
```

**正确配置后的示例:**
```json
"executable_path": "E:\\gamedata\\AutoGAME\\MihoyoBBSTools\\main.py"
```

#### games 配置示例:
```json
{
    "games": {
        "mihoyo_sign": {
            "name": "米游社签到",
            "enabled": true,
            "executable_path": "E:\\path\\to\\MihoyoBBSTools\\main.py",
            "run_as_script": true,
            "args": [],
            "wait_timeout": 30,
            "post_execution_wait": 5
        },
        "star_rail": {
            "name": "崩坏:星穹铁道",
            "enabled": true,
            "executable_path": "E:\\path\\to\\March7thAssistant\\March7th Assistant.exe",
            "run_as_script": false,
            "args": [],
            "process_name": "StarRail.exe",
            "launch_timeout": 60,
            "post_execution_wait": 15
        }
    },
    "global_settings": {
        "user_choice_timeout": 10,
        "exit_countdown": 3,
        "max_log_files": 5
    }
}
```
### 配置文件字段说明:

**games 部分** - 每个游戏的配置:
- `name`: 游戏显示名称
- `enabled`: 是否启用该游戏 (true/false)
- `executable_path`: 可执行文件的完整路径 (**注意要使用双斜线**)
- `run_as_script`: 是否以Python脚本方式运行 (true/false)
- `args`: 启动参数列表
- `process_name`: 需要监控的游戏进程名称
- `launch_timeout`: 等待游戏启动的超时时间(秒)
- `post_execution_wait`: 游戏执行后的等待时间(秒)
- `wait_timeout`: 签到任务的等待时间(秒)

**global_settings 部分** - 全局设置:
- `user_choice_timeout`: 用户选择菜单的超时时间(秒)
- `exit_countdown`: 程序退出前的倒计时(秒)
- `max_log_files`: 保留的最大日志文件数量

## 📁 文件结构
```
AUTO-mihoyo-all/
├── AutoGAME.py              # 主程序文件
├── config.json              # 用户配置文件 (需要自行创建)
├── config.json.template     # 配置文件模板
├── check_config.py          # 配置检查工具
├── 检查配置.bat              # 配置检查启动脚本
├── requirements.txt         # Python依赖列表
├── 自动化一条龙.bat          # Windows启动脚本
├── README.md               # 项目说明文档
└── logs/                   # 自动生成的日志目录
    ├── 20240101_120000.log # 执行日志文件
    └── ...                 # 其他日志文件
```

## 🔧 配置检查工具

为了帮助用户验证配置是否正确，项目提供了专门的配置检查工具：

### 📋 使用方法
1. **图形界面**: 双击运行 `检查配置.bat`
2. **命令行**: 执行 `python check_config.py`

### ✅ 检查内容
- 验证 `config.json` 文件是否存在
- 检查JSON格式是否正确
- 确认是否还有未替换的模板路径
- 验证启用游戏的可执行文件是否存在
- 显示配置状态统计信息

### 📊 检查结果示例
```
=== AUTO-mihoyo-all 配置文件检查工具 ===
✅ config.json 文件格式正确
✅ 配置文件结构正确

🎮 米游社签到:
   状态: ✅ 启用
   路径: ✅ 文件存在
        E:\gamedata\AutoGAME\MihoyoBBSTools\main.py

📊 检查结果:
   总游戏数: 4
   已启用: 4
   已禁用: 0

🎉 配置检查通过！所有启用的游戏路径都正确设置
```

## 🔧 高级功能

### 自动配置迁移
- 程序会自动检测旧格式配置并迁移到新格式
- 迁移时会创建 `config.json.backup` 备份文件
- 支持配置文件自动修复和验证

### 进程监控
- 自动监控游戏进程，实时显示运行时间
- 支持按 Ctrl+C 强制中断监控
- 记录每个游戏的详细执行时长

### 日志管理
- 自动轮转日志文件，保留指定数量的历史日志
- 详细记录每个步骤的执行过程和时间
- 支持查看上次运行的统计信息

## ⚠️ 注意事项
- **管理员权限**: 请确保以管理员身份运行该脚本，程序会自动请求权限
- **路径格式**: 配置文件中的路径请使用双斜线 `\\` 或正斜线 `/`
- **文件路径**: 确保所有配置的可执行文件路径正确且文件存在
- **自动备份**: 程序会自动备份配置文件，迁移时创建 `.backup` 文件
- **日志查看**: 程序执行日志存储在 `logs/` 目录中，便于后续查看和调试