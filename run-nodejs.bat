@echo off
chcp 65001 >nul
title AUTO-mihoyo-all Node.js版本

echo.
echo ============================================
echo   🔧 AUTO-mihoyo-all Node.js版本
echo ============================================
echo.

REM 检查参数
if "%1"=="" (
    echo 📋 使用方法:
    echo   run-nodejs.bat [选项]
    echo.
    echo 📚 可用选项:
    echo   --help              显示帮助信息
    echo   --validate          验证配置文件
    echo   --auto-detect       自动检测游戏路径
    echo   --game=游戏名       运行指定游戏
    echo   --all               运行所有启用的游戏
    echo.
    echo 🎮 可用游戏:
    echo   mihoyoBBSTools      米游社签到工具
    echo   march7thAssistant   三月七助手
    echo   zenlessZoneZero     绝区零一条龙
    echo   betterGenshinImpact 原神BetterGI
    echo.
    pause
    exit /b 0
)

REM 检查配置文件
if not exist "config.json" (
    if exist "config.json.template" (
        echo 📋 检测到首次运行，正在创建配置文件...
        copy "config.json.template" "config.json" >nul
        echo ✅ 配置文件已创建
        echo.
    ) else (
        echo ❌ 找不到配置文件模板！
        pause
        exit /b 1
    )
)

REM 创建日志目录
if not exist "log" (
    mkdir "log"
)

echo 🚀 执行 Node.js 版本...
echo.

REM 运行Node.js版本
node AutoGAME.js %*

echo.
echo ✅ 执行完成
pause
