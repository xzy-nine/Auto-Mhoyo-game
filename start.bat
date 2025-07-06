@echo off
chcp 65001 >nul
title AUTO-mihoyo-all 启动器

echo.
echo ============================================
echo   🎮 AUTO-mihoyo-all 启动器
echo ============================================
echo.

REM 检查是否存在 node_modules
if not exist "node_modules" (
    echo ⚠️  检测到缺少依赖，正在使用淘宝镜像安装...
    npm config set registry https://registry.npmmirror.com
    set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败！
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
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
    echo 📁 日志目录已创建
)

echo 🚀 启动应用程序...
echo.

REM 检查是否安装了Electron
if not exist "node_modules\electron" (
    echo ⚠️  检测到缺少Electron依赖，正在使用淘宝镜像安装...
    npm config set registry https://registry.npmmirror.com
    set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
    npm install electron --save-dev
    if errorlevel 1 (
        echo ❌ Electron安装失败！
        echo 💡 将使用Node.js命令行版本作为备用方案
        echo.
        echo 🚀 启动Node.js版本...
        node AutoGAME.js
        goto end_script
    )
    echo ✅ Electron安装完成
    echo.
)

REM 启动Electron应用
echo 🖥️  启动Electron图形界面...
npm start

:end_script

if errorlevel 1 (
    echo.
    echo ❌ 应用启动失败！
    echo 📝 请检查日志文件获取详细信息
    pause
) else (
    echo.
    echo ✅ 应用已退出
)

pause
