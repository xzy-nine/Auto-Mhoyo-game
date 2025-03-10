import os
import time
import subprocess
import ctypes
import sys
import json
import msvcrt
from datetime import datetime

def request_admin_privileges():
    """
    请求管理员权限，如果没有管理员权限则重新启动脚本并请求权限
    """
    try:
        if not ctypes.windll.shell32.IsUserAnAdmin():
            log("请求管理员权限...")
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, __file__, None, 1)
            sys.exit(0)
    except Exception as e:
        log(f"请求管理员权限失败: {e}")
        sys.exit(1)

def is_admin():
    """
    检查当前用户是否具有管理员权限
    :return: 是否具有管理员权限
    """
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

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
    """,
    try:
        output = subprocess.check_output(f'tasklist | find /i "{process_name}"', shell=True)
        return process_name.lower() in output.decode('utf-8').lower()
    except subprocess.CalledProcessError:
        return False

def check_config_exists():
    """
    检查配置文件是否存在，如果不存在则打开说明文档并退出程序
    :return: 配置文件是否存在
    """
    if not os.path.exists('./config.json'):
        log("配置文件 config.json 不存在！")
        readme_path = './README.md'
        if os.path.exists(readme_path):
            log("正在打开说明文档...")
            os.startfile(readme_path)
        else:
            log("说明文档不存在，请先创建配置文件！配置文件模板如下：")
            log('''{
  "batch_file_path": "脚本路径.py",
  "march7th_assistant_path": "三月七助手路径.exe",
  "processes_to_monitor": {
    "star_rail": "StarRail.exe",
    "zenless_zone_zero": "ZZZ.exe"
  },
  "zenless_zone_zero_scheduler_path": "绝区零调度器路径.exe",
  "better_gi_path": "better路径.exe",
  "better_gi_args": ["参数1", "参数2"]
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
            required_keys = ['batch_file_path', 'march7th_assistant_path', 'processes_to_monitor', 'zenless_zone_zero_scheduler_path', 'better_gi_path']
            for key in required_keys:
                if key not in config:
                    log(f"配置文件缺少必要字段: {key}")
                    config[key] = None
                elif config[key] == "empty":
                    log(f"字段 {key} 设置为empty，将跳过对应步骤")
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
    print(formatted_message, end=end)
    log_file.write(formatted_message + '\n')
    log_file.flush()

def monitor_process(process_name, start_command, args=None):
    """
    监控指定进程，如果进程未运行则启动它，当进程关闭后结束监控
    :param process_name: 进程名称
    :param start_command: 启动命令
    :param args: 启动命令的参数
    """
    log(f"开始监控进程: {process_name}")
    start_time = None
    process_started = False

    if is_process_running(process_name):
        process_started = True
        start_time = time.time()
        log(f"{process_name} 已经在运行")
    else:
        log(f"{process_name} 未运行，正在启动...")
        start_process(start_command, args=args)
        time.sleep(10)

        if is_process_running(process_name):
            process_started = True
            start_time = time.time()
            log(f"{process_name} 已成功启动")
        else:
            log(f"启动 {process_name} 失败，请检查路径或权限")
            return

    while is_process_running(process_name):
        elapsed_time = time.time() - start_time
        log(f"\r{process_name} 已经运行了 {int(elapsed_time)} 秒                ", end='')
        time.sleep(5)

    log(f"\n{process_name} 不在运行")
    log(f"监控程序检测到{process_name}已关闭，任务已完成")
    log(f"等待15秒后继续...")
    time.sleep(15)
    log(f"结束监控进程: {process_name}")

def wait_for_user_choice(timeout):
    """
    等待用户选择要执行的步骤
    :param timeout: 超时时间（秒）
    :return: 用户选择的步骤编号
    """
    print(f"请在 {timeout} 秒内选择要执行的步骤（1-5），超时将按顺序执行：")
    print("1. 执行 签到指令")
    print("2. 执行 三月七助手的一条龙")
    print("3. 执行 绝区零的一条龙")
    print("4. 执行 BetterGI的一条龙")
    print("5. 按顺序执行所有步骤")
    start_time = time.time()
    while time.time() - start_time < timeout:
        if msvcrt.kbhit():
            choice = msvcrt.getch().decode('utf-8')
            if choice in ['1', '2', '3', '4', '5']:
                log(f"\n选择了选项 {choice}")
                return int(choice)
    log("\n超时，将按顺序执行所有步骤")
    return None

def execute_steps(config, choice):
    """
    根据用户选择执行相应的步骤
    :param config: 配置字典
    :param choice: 用户选择的步骤编号
    """
    if choice is None or choice == 1:
        if config.get('batch_file_path'):
            log("执行签到指令")
            try:
                process = start_process(config['batch_file_path'], run_as_script=True)
                process.wait()
            except Exception as e:
                log("签到指令执行完成")
        else:
            log("batch_file_path 为空，跳过执行")

    if choice is None or choice == 2:
        if config.get('march7th_assistant_path'):
            log("执行三月七助手的一条龙")
            try:
                start_process(config['march7th_assistant_path'])
                if config.get('processes_to_monitor', {}).get('star_rail'):
                    start_time = time.time()
                    while time.time() - start_time < 60:
                        if is_process_running(config['processes_to_monitor']['star_rail']):
                            monitor_process(config['processes_to_monitor']['star_rail'], None, None)
                            break
                        time.sleep(5)
                    else:
                        log("星穹铁道进程未在1分钟内启动，结束程序", end='\n\n')
                        sys.exit("星穹铁道进程未在1分钟内启动，程序终止")
                else:
                    log("未配置star_rail进程名，无法监控游戏进程")
                    time.sleep(10)
                log("三月七助手执行完成")
            except Exception as e:
                log(f"执行三月七助手时出错: {e}")
        else:
            log("march7th_assistant_path 为空，跳过执行")

    if choice is None or choice == 3:
        log("执行绝区零的一条龙")
        if config.get('zenless_zone_zero_scheduler_path'):
            log("启动绝区零 OneDragon Scheduler")
            try:
                start_process(config['zenless_zone_zero_scheduler_path'])
                if config.get('processes_to_monitor', {}).get('zenless_zone_zero'):
                    start_time = time.time()
                    while time.time() - start_time < 60:
                        if is_process_running(config['processes_to_monitor']['zenless_zone_zero']):
                            monitor_process(config['processes_to_monitor']['zenless_zone_zero'], None, None)
                            break
                        time.sleep(5)
                    else:
                        log("绝区零进程未在1分钟内启动，结束程序", end='\n\n')
                        sys.exit("绝区零进程未在1分钟内启动，程序终止")
                else:
                    log("未配置zenless_zone_zero进程名，无法监控游戏进程")
                    time.sleep(10)
                log("绝区零执行完成")
            except Exception as e:
                log(f"执行绝区零时出错: {e}")
        else:
            log("zenless_zone_zero_scheduler_path 为空，跳过执行")

    if choice is None or choice == 4:
        log("执行BetterGI的一条龙")
        if config.get('better_gi_path'):
            log("启动BetterGI")
            try:
                start_process(config['better_gi_path'], args=config.get('better_gi_args', []))
                log("BetterGI已启动")
            except Exception as e:
                log(f"启动BetterGI时出错: {e}")
        else:
            log("better_gi_path 为空，跳过执行")

    if choice == 5:
        log("按顺序执行所有步骤")
        execute_steps(config, 1)
        execute_steps(config, 2)
        execute_steps(config, 3)
        execute_steps(config, 4)
def main():
    """
    主函数，执行脚本的主要逻辑
    """
    os.system('chcp 65001 >nul')  # 设置编码为UTF-8

    if not is_admin():
        request_admin_privileges()

    if not check_config_exists():
        log("程序即将退出...")
        time.sleep(5)
        return

    config = load_config()

    choice = wait_for_user_choice(10)

    execute_steps(config, choice)

    log("程序执行完成，即将退出...")
    time.sleep(3)
    sys.exit()

if __name__ == "__main__":
    try:
        main()
    finally:
        log_file.close()