@echo off
chcp 65001 >nul
echo 正在启动 AUTO-mihoyo-all...
echo.
echo 当前目录: %CD%
echo 可执行文件: %~dp0AUTO-mihoyo-all.exe
echo.

REM 检查可执行文件是否存在
if not exist "%~dp0AUTO-mihoyo-all.exe" (
    echo 错误: 找不到可执行文件 AUTO-mihoyo-all.exe
    pause
    exit /b 1
)

REM 启动程序并捕获退出码
"%~dp0AUTO-mihoyo-all.exe" %*
set EXIT_CODE=%ERRORLEVEL%

echo.
echo 程序已退出，退出码: %EXIT_CODE%

REM 如果退出码不为0，显示错误信息
if %EXIT_CODE% neq 0 (
    echo.
    echo 程序运行出现错误，可能的原因：
    echo 1. 缺少必要的依赖库
    echo 2. 配置文件路径错误
    echo 3. 权限不足
    echo 4. 防火墙或杀毒软件阻止
    echo.
    echo 请检查 log 目录下的日志文件获取详细信息
)

echo.
pause
