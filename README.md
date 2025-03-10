# AUTO-mihoyo-all 项目说明
,
## 项目简介
通过一个自动化脚本,一键调用多个米哈游相关的自动化项目。
分别为:.
- [MihoyoBBSTools](https://github.com/Womsxd/MihoyoBBSTools) 米游社签到
- [ZenlessZoneZero-OneDragon](https://github.com/DoctorReid/ZenlessZoneZero-OneDragon) 绝区零一条龙
- [March7thAssistant](https://github.com/moesnow/March7thAssistant) 三月七助手
- [better-genshin-impact](https:./github.com/babalae/better-genshin-impact) BetterGI · 更好的原神
## 文件结构
- **config.json.template**: 配置文件的模板，包括批处理文件路径、助手程序路径和进程监控设置等。
- **requirements.txt**: 列出项目所需的 Python 依赖项，使用 pip 安装。
- **自动化一条龙.bat**:通过bat运行py脚本,检查并安装依赖
## 使用说明
1. **环境准备**: 确保已安装 Python 和 pip。
2. **配置文件**: 根据 `config.json.template` 创建自己的 `config.json` 文件并放在根目录，填写必要的路径(**注意要双斜线**)和参数。
### 配置文件字段说明:
- `batch_file_path`: 米游社签到的 `main.py` 的路径用于执行签到指令。
- `march7th_assistant_path`: 三月七助手的`March7th Assistant.exe`的路径。
- `zenless_zone_zero_scheduler_path`: 绝区零一条龙的`OneDragon Scheduler.exe`的路径。
- `better_gi_path`: BetterGI 程序的路径。
- `better_gi_args`: 启动 BetterGI 程序时的参数列表(已填写,为运行一条龙)。
- `processes_to_monitor`: 需要监控的进程名称和对应的启动命令。
  - `star_rail`: 星穹铁道进程名称(已填写)
  - `zenless_zone_zero`: 绝区零进程名称(已填写)。

3. **安装依赖和运行项目**: 运行 `自动化一条龙.bat` 文件，该文件会自动安装所需的 Python 依赖项,并自动运行


## 注意事项
- 请确保以管理员身份运行该脚本，以便能够启动所需的进程。
- 日志文件将自动生成并存储在 `logs/` 目录中，便于后续查看和调试。