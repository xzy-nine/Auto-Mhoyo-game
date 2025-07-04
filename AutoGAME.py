import os
import time
import subprocess
import ctypes
import sys
import json
import msvcrt
import re
import signal
import atexit
from datetime import datetime

# 全局变量，记录日志文件路径，以便在请求管理员权限时可以传递
log_filepath = None
log_file = None
current_monitoring_process = None
current_monitoring_start_time = None

def create_log_file():
    """
    创建日志文件，文件名为脚本运行开始的时间
    :return: 日志文件对象和文件路径
    """
    log_dir = './logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    log_files = sorted(os.listdir(log_dir))
    
    # 从配置中获取最大日志文件数量，默认为5
    try:
        with open('./config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
            max_log_files = config.get('global_settings', {}).get('max_log_files', 5)
    except:
        max_log_files = 5
    
    if len(log_files) >= max_log_files:
        os.remove(os.path.join(log_dir, log_files[0]))
    
    log_filename = datetime.now().strftime('%Y%m%d_%H%M%S') + '.log'
    log_filepath = os.path.join(log_dir, log_filename)
    return open(log_filepath, 'w', encoding='utf-8'), log_filepath

def log(message, end='\n', console_only=False):
    """
    添加时间戳到日志
    :param message: 日志消息
    :param end: 结束符
    :param console_only: 是否只输出到控制台
    """
    global log_file
    
    timestamp = datetime.now().strftime('[%Y-%m-%d %H:%M:%S]')
    formatted_message = f"{timestamp} {message}"
    print(formatted_message, end=end)
    
    # 如果console_only为True，则不写入日志文件
    if not console_only and log_file is not None:
        log_file.write(formatted_message + '\n')
        log_file.flush()

def console_print(message, end='\n'):
    """
    只输出到控制台，不记录到日志文件
    :param message: 控制台消息
    :param end: 结束符
    """
    print(message, end=end)

def log_only(message):
    """
    只记录到日志文件，不输出到控制台
    :param message: 日志消息
    """
    global log_file
    if log_file is not None:
        timestamp = datetime.now().strftime('[%Y-%m-%d %H:%M:%S]')
        formatted_message = f"{timestamp} {message}"
        log_file.write(formatted_message + '\n')
        log_file.flush()

def cleanup_on_exit():
    """
    程序退出时的清理函数
    """
    global log_file, current_monitoring_process, current_monitoring_start_time
    
    if current_monitoring_process and current_monitoring_start_time:
        # 计算运行时间
        total_elapsed_time = time.time() - current_monitoring_start_time
        hours, remainder = divmod(int(total_elapsed_time), 3600)
        minutes, seconds = divmod(remainder, 60)
        
        if hours > 0:
            time_str = f"{hours}小时{minutes}分钟{seconds}秒"
        elif minutes > 0:
            time_str = f"{minutes}分钟{seconds}秒"
        else:
            time_str = f"{seconds}秒"
        
        log_only(f"程序被强制终止，{current_monitoring_process} 运行时间: {time_str}")
        log_only("程序异常退出")
    
    if log_file:
        log_file.close()

def is_process_running(process_name):
    """
    检查指定名称的进程是否正在运行
    :param process_name: 进程名称
    :return: 进程是否正在运行
    """
    try:
        # 使用更可靠的tasklist命令
        output = subprocess.check_output(['tasklist', '/fi', f'imagename eq {process_name}'], 
                                       creationflags=subprocess.CREATE_NO_WINDOW)
        output_str = output.decode('utf-8', errors='ignore')
        return process_name.lower() in output_str.lower()
    except subprocess.CalledProcessError:
        return False
    except Exception as e:
        log(f"检查进程时出错: {e}")
        return False

def check_config_exists():
    """
    检查配置文件是否存在，如果不存在则打开说明文档并退出程序
    :return: 配置文件是否存在
    """
    if not os.path.exists('./config.json'):
        log("配置文件 config.json 不存在！")
        
        # 检查是否有模板文件
        template_path = './config.json.template'
        if os.path.exists(template_path):
            log("找到配置模板文件，正在打开...")
            os.startfile(template_path)
        
        readme_path = './README.md'
        if os.path.exists(readme_path):
            log("正在打开说明文档...")
            os.startfile(readme_path)
        else:
            log("说明文档不存在，请先创建配置文件！")
            log("新的配置文件结构如下：")
            log('''{
  "games": {
    "mihoyo_sign": {
      "name": "米游社签到",
      "enabled": true,
      "executable_path": "路径/到/main.py",
      "run_as_script": true,
      "args": [],
      "wait_timeout": 30,
      "post_execution_wait": 5
    },
    "star_rail": {
      "name": "崩坏:星穹铁道",
      "enabled": true,
      "executable_path": "路径/到/March7th Assistant.exe",
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
}''')
        return False
    return True

def load_config():
    """
    从配置文件中加载配置
    :return: 配置字典
    """
    try:
        with open('./config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
            
            # 检查配置文件格式
            if 'games' not in config:
                log("配置文件格式错误，请参考 config.json.template 创建正确的配置文件")
                return None
                
            # 检查每个游戏的配置
            games = config.get('games', {})
            for game_key, game_config in games.items():
                required_fields = ['name', 'enabled', 'executable_path']
                for field in required_fields:
                    if field not in game_config:
                        log(f"游戏 {game_key} 配置缺少必要字段: {field}")
                        game_config[field] = None if field != 'enabled' else False
                        
                # 设置默认值
                game_config.setdefault('run_as_script', False)
                game_config.setdefault('args', [])
                game_config.setdefault('launch_timeout', 60)
                game_config.setdefault('post_execution_wait', 15)
                game_config.setdefault('wait_timeout', 30)
                
            # 设置全局设置默认值
            global_settings = config.setdefault('global_settings', {})
            global_settings.setdefault('user_choice_timeout', 10)
            global_settings.setdefault('exit_countdown', 3)
            global_settings.setdefault('max_log_files', 5)
            
            return config
            
    except (json.JSONDecodeError, FileNotFoundError) as e:
        log(f"加载配置文件失败: {e}")
        return None

def execute_game_automation(game_key, game_config):
    """
    执行单个游戏的自动化流程
    :param game_key: 游戏标识符
    :param game_config: 游戏配置
    :return: 是否成功执行, 是否已等待过
    """
    if not game_config.get('enabled', False):
        log(f"{game_config.get('name', game_key)} 已禁用，跳过执行")
        return True, False
        
    if not game_config.get('executable_path'):
        log(f"{game_config.get('name', game_key)} 可执行文件路径为空，跳过执行")
        return True, False
    
    # 检查文件是否存在
    exe_path = game_config.get('executable_path')
    if not os.path.exists(exe_path):
        log(f"{game_config.get('name', game_key)} 可执行文件不存在: {exe_path}")
        return False, False
    
    game_name = game_config.get('name', game_key)
    log(f"执行 {game_name}")
    
    try:
        # 启动程序
        log(f"正在启动 {game_name}...")
        start_process(
            game_config['executable_path'],
            run_as_script=game_config.get('run_as_script', False),
            args=game_config.get('args', [])
        )
        
        # 如果是签到类任务（没有进程监控需求），等待一段时间后完成
        if game_key == 'mihoyo_sign':
            wait_time = game_config.get('wait_timeout', 30)
            log(f"{game_name} 执行中，等待 {wait_time} 秒...")
            
            # 显示倒计时
            for i in range(wait_time, 0, -1):
                console_print(f"\r{game_name} 执行中... 剩余: {i} 秒", end='')
                time.sleep(1)
            console_print("")
            
            log_only(f"{game_name} 执行完成")
            return True, True  # 已等待
        
        # 对于有游戏进程的任务，监控游戏进程
        process_name = game_config.get('process_name')
        if process_name:
            launch_timeout = game_config.get('launch_timeout', 60)
            start_time = time.time()
            
            log(f"等待 {game_name} 游戏进程启动 (超时: {launch_timeout}秒)...")
            log(f"监控进程名: {process_name}")
            
            # 等待进程启动
            process_found = False
            while time.time() - start_time < launch_timeout:
                if is_process_running(process_name):
                    console_print("")  # 换行
                    log(f"{game_name} 游戏进程已启动，开始监控")
                    process_found = True
                    has_waited = monitor_process(process_name, None, None)
                    break
                
                # 显示等待进度
                elapsed = int(time.time() - start_time)
                remaining = launch_timeout - elapsed
                console_print(f"\r等待 {game_name} 启动... 剩余: {remaining} 秒", end='')
                time.sleep(1)
            
            if not process_found:
                console_print("")
                log(f"{game_name} 游戏进程未在 {launch_timeout} 秒内启动")
                log("这可能是正常的，如果游戏已经启动并完成了自动化任务")
                
                # 即使没有检测到游戏进程，也等待一段时间以防任务正在执行
                wait_time = game_config.get('post_execution_wait', 15)
                log(f"等待 {wait_time} 秒以确保任务完成...")
                
                for i in range(wait_time, 0, -1):
                    console_print(f"\r等待 {i} 秒...", end='')
                    time.sleep(1)
                console_print("")
                
                return False, True  # 已等待
            else:
                return True, has_waited
        else:
            # 没有配置进程名，等待默认时间
            wait_time = game_config.get('post_execution_wait', 15)
            log(f"{game_name} 未配置进程监控，等待 {wait_time} 秒...")
            
            for i in range(wait_time, 0, -1):
                console_print(f"\r等待 {i} 秒...", end='')
                time.sleep(1)
            console_print("")
        
        log_only(f"{game_name} 执行完成")
        return True, True  # 已等待
        
    except Exception as e:
        log(f"执行 {game_name} 时出错: {e}")
        return False, False

def monitor_process(process_name, start_command, args=None):
    """
    监控指定进程，如果进程未运行则启动它，当进程关闭后结束监控
    :param process_name: 进程名称
    :param start_command: 启动命令
    :param args: 启动命令的参数
    :return: 是否已等待过（True/False）
    """
    global current_monitoring_process, current_monitoring_start_time
    
    log(f"开始监控进程: {process_name}")
    start_time = None
    process_started = False
    current_monitoring_process = process_name

    if is_process_running(process_name):
        process_started = True
        start_time = time.time()
        current_monitoring_start_time = start_time
        log(f"{process_name} 已经在运行")
    else:
        log(f"{process_name} 未运行，正在启动...")
        start_process(start_command, args=args)
        time.sleep(10)

        if is_process_running(process_name):
            process_started = True
            start_time = time.time()
            current_monitoring_start_time = start_time
            log(f"{process_name} 已成功启动")
        else:
            log(f"启动 {process_name} 失败，请检查路径或权限")
            current_monitoring_process = None
            return False

    # 静默监控，控制台实时显示运行时间
    console_print(f"正在监控 {process_name}，按 Ctrl+C 可强制结束...")
    
    try:
        while is_process_running(process_name):
            current_time = time.time()
            elapsed_time = current_time - start_time
            
            # 格式化运行时间
            hours, remainder = divmod(int(elapsed_time), 3600)
            minutes, seconds = divmod(remainder, 60)
            
            if hours > 0:
                time_display = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            else:
                time_display = f"{minutes:02d}:{seconds:02d}"
            
            # 实时更新控制台显示（覆盖上一行）
            console_print(f"\r{process_name} 运行中... 已运行: {time_display}", end='')
            time.sleep(1)
        
        # 进程结束后换行
        console_print("")
        
        # 计算总运行时间并只记录到日志
        if start_time:
            total_elapsed_time = time.time() - start_time
            hours, remainder = divmod(int(total_elapsed_time), 3600)
            minutes, seconds = divmod(remainder, 60)
            
            if hours > 0:
                time_str = f"{hours}小时{minutes}分钟{seconds}秒"
            elif minutes > 0:
                time_str = f"{minutes}分钟{seconds}秒"
            else:
                time_str = f"{seconds}秒"
            
            log_only(f"{process_name} 运行完成，总耗时: {time_str}")
        
        log(f"监控程序检测到{process_name}已关闭，任务已完成")
        log(f"等待15秒后继续...")
        
        # 倒计时显示
        for i in range(15, 0, -1):
            console_print(f"\r等待 {i} 秒后继续...", end='')
            time.sleep(1)
        console_print("")
        
        log(f"结束监控进程: {process_name}")
        return True  # 已等待
        
    except KeyboardInterrupt:
        console_print("\n检测到 Ctrl+C，正在停止监控...")
        if start_time:
            total_elapsed_time = time.time() - start_time
            hours, remainder = divmod(int(total_elapsed_time), 3600)
            minutes, seconds = divmod(remainder, 60)
            
            if hours > 0:
                time_str = f"{hours}小时{minutes}分钟{seconds}秒"
            elif minutes > 0:
                time_str = f"{minutes}分钟{seconds}秒"
            else:
                time_str = f"{seconds}秒"
            
            log_only(f"{process_name} 被用户中断，运行时间: {time_str}")
        
        log("监控被用户中断")
        raise
    finally:
        current_monitoring_process = None
        current_monitoring_start_time = None

def parse_previous_logs():
    """
    解析上一次的日志文件，提取运行时间和各步骤的执行时长
    :return: 上次运行时间和各步骤的执行时长信息
    """
    log_dir = './logs'
    if not os.path.exists(log_dir):
        return None, {}
    
    # 获取所有日志文件并按照名称排序
    log_files = sorted([f for f in os.listdir(log_dir) if f.endswith('.log')])
    if len(log_files) <= 1:  # 如果只有当前日志或者没有日志
        return None, {}

    # 获取倒数第二个日志文件（上一次的日志），而不是最新的（当前正在写入的）
    previous_log_file = log_files[-2]
    last_run_time = previous_log_file.split('.')[0]  # 从文件名获取运行时间
    
    # 解析各步骤的执行时长
    step_durations = {
        "签到指令": None,
        "三月七助手": None,
        "绝区零": None,
        "BetterGI": None,
        "米游社签到": None,
        "崩坏:星穹铁道": None,
        "原神": None
    }
    
    try:
        with open(os.path.join(log_dir, previous_log_file), 'r', encoding='utf-8') as f:
            content = f.read()
            
            def parse_datetime_silent(dt_str):
                """解析日期时间字符串，静默处理错误"""
                try:
                    # 使用正则表达式提取时间戳
                    date_match = re.search(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]', dt_str)
                    if date_match:
                        return datetime.strptime(date_match.group(1), '%Y-%m-%d %H:%M:%S')
                    return None
                except:
                    return None
            
            # 使用更精确的正则表达式匹配模式
            patterns = {
                "签到指令": (r'\[([^\]]+)\] 执行签到指令', r'\[([^\]]+)\] 签到指令执行完成'),
                "三月七助手": (r'\[([^\]]+)\] 执行三月七助手的一条龙', r'\[([^\]]+)\] 三月七助手执行完成'),
                "绝区零": (r'\[([^\]]+)\] 执行绝区零的一条龙', r'\[([^\]]+)\] 绝区零执行完成'),
                "BetterGI": (r'\[([^\]]+)\] 执行BetterGI的一条龙', r'\[([^\]]+)\] BetterGI执行完成'),
                "米游社签到": (r'\[([^\]]+)\] 执行 米游社签到', r'\[([^\]]+)\] 米游社签到执行完成'),
                "崩坏:星穹铁道": (r'\[([^\]]+)\] 执行 崩坏:星穹铁道', r'\[([^\]]+)\] 崩坏:星穹铁道执行完成'),
                "原神": (r'\[([^\]]+)\] 执行 原神', r'\[([^\]]+)\] 原神执行完成')
            }
            
            for step, (start_pattern, end_pattern) in patterns.items():
                start_match = re.search(start_pattern, content)
                end_match = re.search(end_pattern, content)
                
                # 如果没有找到结束标记，尝试其他可能的结束模式
                if not end_match and step == "BetterGI":
                    end_match = re.search(r'\[([^\]]+)\] BetterGI已启动', content)
                
                if start_match and end_match:
                    start_time = parse_datetime_silent(start_match.group(0))
                    end_time = parse_datetime_silent(end_match.group(0))
                    if start_time and end_time:
                        step_durations[step] = (end_time - start_time).total_seconds()
                    
    except Exception:
        # 静默处理异常
        pass
        
    return last_run_time, step_durations

def format_duration(seconds):
    """
    将秒数格式化为时分秒的形式
    :param seconds: 秒数
    :return: 格式化后的时间字符串
    """
    if seconds is None:
        return "未执行"
    
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    
    if hours > 0:
        return f"{hours}小时{minutes}分钟{seconds}秒"
    elif minutes > 0:
        return f"{minutes}分钟{seconds}秒"
    else:
        return f"{seconds}秒"

def wait_for_user_choice(config):
    """
    等待用户选择要执行的步骤
    :param config: 配置字典
    :return: 用户选择的步骤编号
    """
    timeout = config.get('global_settings', {}).get('user_choice_timeout', 10)
    
    # 解析上次的日志信息
    last_run_time, step_durations = parse_previous_logs()
    
    # 显示上次运行信息
    log("=" * 50)
    if last_run_time:
        formatted_time = f"{last_run_time[:4]}-{last_run_time[4:6]}-{last_run_time[6:8]} {last_run_time[9:11]}:{last_run_time[11:13]}:{last_run_time[13:15]}"
        log(f"上次运行时间: {formatted_time}")
        log("各步骤执行时长:")
        
        # 根据新配置显示游戏信息
        games = config.get('games', {})
        game_mapping = {
            'mihoyo_sign': '签到指令',
            'star_rail': '三月七助手',
            'zenless_zone_zero': '绝区零',
            'genshin': 'BetterGI'
        }
        
        for i, (game_key, game_config) in enumerate(games.items(), 1):
            old_key = game_mapping.get(game_key, game_config.get('name', game_key))
            duration = step_durations.get(old_key)
            log(f"  {i}. {game_config.get('name', game_key)}: {format_duration(duration)}")
    else:
        log("没有找到上次运行的记录")
    log("=" * 50)
    
    # 显示选择菜单
    log(f"请在 {timeout} 秒内选择要执行的步骤，超时将按顺序执行：")
    
    games = config.get('games', {})
    for i, (game_key, game_config) in enumerate(games.items(), 1):
        status = "已启用" if game_config.get('enabled', False) else "已禁用"
        log(f"{i}. 执行 {game_config.get('name', game_key)} ({status})")
    
    log(f"{len(games) + 1}. 按顺序执行所有已启用的步骤")
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        if msvcrt.kbhit():
            choice = msvcrt.getch().decode('utf-8')
            max_choice = len(games) + 1
            if choice.isdigit() and 1 <= int(choice) <= max_choice:
                log(f"选择了选项 {choice}")
                return int(choice)
    
    log("超时，将按顺序执行所有已启用的步骤")
    return None

def execute_steps(config, choice):
    """
    根据用户选择执行相应的步骤
    :param config: 配置字典
    :param choice: 用户选择的步骤编号
    """
    if not config or 'games' not in config:
        log("配置文件格式错误或为空")
        return
        
    games = config['games']
    game_list = list(games.items())
    
    try:
        if choice is None or choice == len(game_list) + 1:
            # 执行所有已启用的游戏
            log("开始按顺序执行所有已启用的游戏")
            for idx, (game_key, game_config) in enumerate(game_list):
                if game_config.get('enabled', False):
                    success, has_waited = execute_game_automation(game_key, game_config)
                    if not success:
                        log(f"{game_config.get('name', game_key)} 执行失败，但继续执行下一个游戏")
                    
                    # 游戏间等待时间（如果本游戏已等待过，则不再等待）
                    post_wait = game_config.get('post_execution_wait', 15)
                    is_last = (game_key == list(games.keys())[-1])
                    if post_wait > 0 and not is_last and not has_waited:
                        log(f"等待 {post_wait} 秒后继续下一个游戏...")
                        for i in range(post_wait, 0, -1):
                            console_print(f"\r等待 {i} 秒后继续...", end='')
                            time.sleep(1)
                        console_print("")
        else:
            # 执行指定的单个游戏
            if 1 <= choice <= len(game_list):
                game_key, game_config = game_list[choice - 1]
                execute_game_automation(game_key, game_config)
            else:
                log(f"无效的选择: {choice}")

    except KeyboardInterrupt:
        log("用户中断程序执行")
        raise

def display_config_status(config):
    """
    显示当前配置状态
    :param config: 配置字典
    """
    if not config or 'games' not in config:
        log("配置文件无效或格式错误")
        return
    
    log("=" * 60)
    log("当前配置状态:")
    log("=" * 60)
    
    games = config.get('games', {})
    enabled_count = 0
    
    for i, (game_key, game_config) in enumerate(games.items(), 1):
        name = game_config.get('name', game_key)
        enabled = game_config.get('enabled', False)
        path = game_config.get('executable_path', '')
        
        if enabled:
            enabled_count += 1
        
        status = "✓ 启用" if enabled else "✗ 禁用"
        path_status = "✓ 路径存在" if path and os.path.exists(path) else "✗ 路径问题"
        
        log(f"{i}. {name}: {status} | {path_status}")
        if path:
            log(f"   路径: {path}")
        
        # 显示特殊配置
        if game_config.get('run_as_script'):
            log(f"   运行方式: Python脚本")
        if game_config.get('args'):
            log(f"   参数: {game_config['args']}")
        if game_config.get('process_name'):
            log(f"   监控进程: {game_config['process_name']}")
        log("")
    
    log(f"总计: {len(games)} 个游戏配置，{enabled_count} 个已启用")
    
    # 显示全局设置
    global_settings = config.get('global_settings', {})
    log("全局设置:")
    log(f"  用户选择超时: {global_settings.get('user_choice_timeout', 10)} 秒")
    log(f"  退出倒计时: {global_settings.get('exit_countdown', 3)} 秒")
    log(f"  最大日志文件数: {global_settings.get('max_log_files', 5)} 个")
    log("=" * 60)

def start_process(command, run_as_script=False, args=None):
    """
    尝试启动指定的进程
    :param command: 要执行的命令或脚本路径
    :param run_as_script: 是否以脚本方式运行
    :param args: 传递给命令的参数列表
    """
    log(f"启动进程: {os.path.basename(command)}")
    if run_as_script:
        # 以脚本方式运行 - 使用阻塞调用，因为脚本通常执行完就结束
        subprocess.run([sys.executable, command] + (args if args else []))
    else:
        if args:
            # 运行带有参数的命令 - 使用非阻塞调用
            subprocess.Popen([command] + args)
            log(f"已启动进程: {os.path.basename(command)} (非阻塞)")
        else:
            # 直接启动文件
            os.startfile(command)

def main():
    """
    主函数，执行脚本的主要逻辑
    """
    global log_file, log_filepath
    
    os.system('chcp 65001 >nul')  # 设置编码为UTF-8
    
    # 注册清理函数
    atexit.register(cleanup_on_exit)
    
    # 设置信号处理器
    def signal_handler(signum, frame):
        console_print("\n检测到中断信号，正在清理...")
        cleanup_on_exit()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 直接创建日志文件，无需管理员权限判断
    log_file, log_filepath = create_log_file()
    log_only("程序启动")

    try:
        # 检查配置文件是否存在
        if not check_config_exists():
            log("程序即将退出...")
            time.sleep(5)
            return

        # 加载配置
        config = load_config()
        
        if not config:
            log("配置文件加载失败，程序即将退出...")
            time.sleep(5)
            return

        # 显示当前配置状态
        display_config_status(config)

        choice = wait_for_user_choice(config)

        execute_steps(config, choice)

        log("程序执行完成，即将退出...")
        log_only("程序正常结束")
        
        # 从配置获取倒计时时间
        countdown = config.get('global_settings', {}).get('exit_countdown', 3)
        for i in range(countdown, 0, -1):
            console_print(f"\r{i} 秒后退出...", end='')
            time.sleep(1)
        console_print("")
        
    except KeyboardInterrupt:
        console_print("\n程序被用户中断")
        log_only("程序被用户中断")
    except Exception as e:
        log(f"程序执行出错: {e}")
        log_only(f"程序异常退出: {e}")
    finally:
        cleanup_on_exit()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console_print("\n程序被强制中断")
    except Exception as e:
        if log_file:
            log_only(f"程序发生未捕获异常: {e}")
        console_print(f"程序发生错误: {e}")
    finally:
        if log_file:
            log_file.close()