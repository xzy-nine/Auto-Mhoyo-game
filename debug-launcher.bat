@echo off
chcp 65001 >nul
echo ============================================
echo   AUTO-mihoyo-all 调试启动器
echo ============================================
echo.

REM 设置调试环境变量
set DEBUG=*
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_LOG_LEVEL=debug
set NODE_ENV=development

echo 当前目录: %CD%
echo 当前时间: %DATE% %TIME%
echo.
echo 环境变量:
echo   DEBUG=%DEBUG%
echo   ELECTRON_ENABLE_LOGGING=%ELECTRON_ENABLE_LOGGING%
echo   ELECTRON_LOG_LEVEL=%ELECTRON_LOG_LEVEL%
echo   NODE_ENV=%NODE_ENV%
echo.

REM 设置便携版目录环境变量
set PORTABLE_EXECUTABLE_DIR=%~dp0
echo   PORTABLE_EXECUTABLE_DIR=%PORTABLE_EXECUTABLE_DIR%
echo.

REM 检查并创建必要的目录
echo 检查目录结构...
if not exist "log" (
    mkdir log
    echo [✓] 已创建 log 目录
) else (
    echo [✓] log 目录已存在
)

if not exist "config.json" (
    if exist "config.json.template" (
        copy "config.json.template" "config.json" >nul 2>&1
        echo [✓] 已从模板创建配置文件
    ) else (
        echo [!] 警告: 找不到配置文件模板
    )
) else (
    echo [✓] 配置文件已存在
)

echo.
echo 检查可执行文件...
if not exist "%~dp0AUTO-mihoyo-all.exe" (
    echo [✗] 错误: 找不到可执行文件 AUTO-mihoyo-all.exe
    echo.
    echo 请确保在正确的目录中运行此脚本！
    pause
    exit /b 1
) else (
    echo [✓] 可执行文件存在
)

echo.
echo ============================================
echo 启动程序 (调试模式)
echo ============================================
echo.

REM 记录启动时间
echo [%DATE% %TIME%] 启动 AUTO-mihoyo-all >> log\debug.log

REM 启动程序
"%~dp0AUTO-mihoyo-all.exe" --dev %*
set EXIT_CODE=%ERRORLEVEL%

echo.
echo ============================================
echo 程序已退出 (退出码: %EXIT_CODE%)
echo ============================================
echo.

REM 记录退出时间
echo [%DATE% %TIME%] 程序退出，退出码: %EXIT_CODE% >> log\debug.log

REM 如果退出码不为0，显示错误信息
if %EXIT_CODE% neq 0 (
    echo [!] 程序运行出现错误
    echo.
    echo 可能的原因：
    echo   1. 缺少必要的依赖库 (Visual C++ Redistributable)
    echo   2. 权限不足 (尝试以管理员身份运行)
    echo   3. 防火墙或杀毒软件阻止
    echo   4. 配置文件损坏
    echo   5. 缺少必要的文件
    echo.
)

REM 显示最近的日志文件
echo 最新日志信息:
echo ----------------------------------------
if exist "log\*.log" (
    for /f "delims=" %%i in ('dir /b /od log\*.log 2^>nul') do set LATEST_LOG=%%i
    if defined LATEST_LOG (
        echo 日志文件: log\%LATEST_LOG%
        echo.
        powershell -command "Get-Content 'log\%LATEST_LOG%' | Select-Object -Last 20"
    ) else (
        echo 没有找到日志文件
    )
) else (
    echo 没有找到日志文件
)

echo ----------------------------------------
echo.
echo 如需技术支持，请保存上述信息
echo.
pause
