import os
import time
import subprocess
import ctypes
import sys
import json
import msvcrt
from datetime import datetime

def is_admin():
    """
    检查当前用户是否具有管理员权限
    """
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

if not is_admin():
    # 如果没有管理员权限，请求提升权限
    print("脚本需要管理员权限,正在请求提升权限...")
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, __file__, None, 1)
    sys.exit()

def start_process(command, run_as_script=False, args=None):
    """
    尝试启动指定的进程
    :param command: 要执行的命令或脚本路径
    :param run_as_script: 是否以脚本方式运行
    :param args: 传递给命令的参数列表
    """
    print(f"尝试启动进程: {command} {' '.join(args) if args else ''}")
    if run_as_script:
        # 以脚本方式运行
        subprocess.run([sys.executable, command] + (args if args else []))
    else:
        if args:
            # 运行带有参数的命令
            subprocess.run([command] + args)
        else:
            # 直接启动文件
            os.startfile(command)

def is_process_running(process_name):
    """
    检查指定名称的进程是否正在运行
    :param process_name: 进程名称
    :return: 进程是否正在运行
    """
    try:
        output = subprocess.check_output(f'tasklist | find /i "{process_name}"', shell=True)
        return process_name.lower() in output.decode('utf-8').lower()
    except subprocess.CalledProcessError:
        return False

def load_config():
    """
    从配置文件中加载配置
    :return: 配置字典
    """
    try:
        with open('./config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
            # 检查配置文件是否包含必要的字段
            required_keys = ['batch_file_path', 'march7th_assistant_path', 'processes_to_monitor', 'zenless_zone_zero_scheduler_path', 'better_gi_path']
            for key in required_keys:
                if key not in config:
                    log(f"配置文件缺少必要字段: {key}")
                    config[key] = None
            return config
    except (json.JSONDecodeError, FileNotFoundError) as e:
        log(f"加载配置文件失败: {e}")
        return {}

def create_log_file():
    """
    创建日志文件，文件名为脚本运行开始的时间
    :return: 日志文件对象
    """
    log_dir = './logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    log_files = sorted(os.listdir(log_dir))
    if len(log_files) >= 5:
        os.remove(os.path.join(log_dir, log_files[0]))
    log_filename = datetime.now().strftime('%Y%m%d_%H%M%S') + '.log'
    log_filepath = os.path.join(log_dir, log_filename)
    return open(log_filepath, 'w', encoding='utf-8')

log_file = create_log_file()

def log(message, end='\n'):
    """
    添加时间戳到日志
    :param message: 日志消息
    :param end: 结束符
    """
    timestamp = datetime.now().strftime('[%Y-%m-%d %H:%M:%S]')
    formatted_message = f"{timestamp} {message}"
    
    # 向控制台打印
    print(formatted_message, end=end)
    
    # 写入日志文件
    log_file.write(formatted_message + '\n')
    log_file.flush()

def monitor_process(process_name, start_command, args=None):
    """
    监控指定进程，如果进程未运行则启动它
    :param process_name: 进程名称
    :param start_command: 启动命令
    :param args: 启动命令的参数
    """
    start_time = None
    process_started = False
    while True:
        time.sleep(5)
        if is_process_running(process_name):
            if not process_started:
                process_started = True
                start_time = time.time()
            elapsed_time = time.time() - start_time
            log(f"\r{process_name} 已经运行了 {int(elapsed_time)} 秒", end='')
        else:
            if process_started:
                log(f"\n{process_name} 不在运行")
                start_process(start_command, args=args)
                break

def wait_for_user_choice(timeout):
    """
    等待用户选择要执行的步骤
    :param timeout: 超时时间（秒）
    :return: 用户选择的步骤编号
    """
    log(f"请在 {timeout} 秒内选择要执行的步骤（1-4），超时将按顺序执行：")
    log("1. 执行 签到指令")
    log("2. 执行 三月七助手的一条龙")
    log("3. 执行 绝区零 和 better的一条龙")
    log("4. 按顺序执行所有步骤")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if msvcrt.kbhit():
            choice = msvcrt.getch().decode('utf-8')
            if choice in ['1', '2', '3', '4']:
                return int(choice)
    return None

def execute_steps(config, choice):
    """
    根据用户选择执行相应的步骤
    :param config: 配置字典
    :param choice: 用户选择的步骤编号
    """
    if choice is None or choice == 1:
        if config.get('batch_file_path'):
            start_process(config['batch_file_path'], run_as_script=True)
        else:
            log("batch_file_path 为空，跳过执行")

    if choice is None or choice == 2:
        if config.get('march7th_assistant_path'):
            start_process(config['march7th_assistant_path'])
        else:
            log("march7th_assistant_path 为空，跳过执行")

    if choice is None or choice == 3:
        if config.get('processes_to_monitor', {}).get('star_rail') and config.get('zenless_zone_zero_scheduler_path'):
            monitor_process(config['processes_to_monitor']['star_rail'], config['zenless_zone_zero_scheduler_path'])
        else:
            log("star_rail 或 zenless_zone_zero_scheduler_path 为空，跳过执行")

        if config.get('processes_to_monitor', {}).get('zenless_zone_zero') and config.get('better_gi_path'):
            monitor_process(config['processes_to_monitor']['zenless_zone_zero'], config['better_gi_path'], args=config.get('better_gi_args', []))
        else:
            log("zenless_zone_zero 或 better_gi_path 为空，跳过执行")

    if choice == 4:
        log("按顺序执行所有步骤")
        execute_steps(config, 1)
        execute_steps(config, 2)
        execute_steps(config, 3)

def main():
    """
    主函数，执行脚本的主要逻辑
    """
    os.system('chcp 65001 >nul')  # 设置编码为UTF-8
    config = load_config()  # 加载配置文件

    choice = wait_for_user_choice(10)  # 等待用户选择

    execute_steps(config, choice)  # 执行用户选择的步骤

    sys.exit()  # 退出程序

if __name__ == "__main__":
    main()  # 调用 main 函数
    log_file.close()  # 关闭日志文件