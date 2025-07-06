@echo off
chcp 65001 >nul
title AUTO-mihoyo-all 自动运行

echo.
echo ============================================
echo   🚀 AUTO-mihoyo-all 自动运行模式
echo ============================================
echo.

REM 检查配置文件
if not exist "config.json" (
    echo ❌ 找不到配置文件！
    echo 💡 请先运行 start.bat 进行初始化配置
    pause
    exit /b 1
)

echo 🎮 正在执行所有启用的游戏...
echo.

REM 使用--auto-run参数启动应用
npm start -- --auto-run

if errorlevel 1 (
    echo.
    echo ❌ 自动运行失败！
    echo 📝 请检查日志文件获取详细信息
    pause
) else (
    echo.
    echo ✅ 所有游戏执行完成
)

echo.
echo ⏰ 自动运行完成，5秒后关闭窗口...
timeout /t 5 /nobreak >nul
