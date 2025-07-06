@echo off
chcp 65001 >nul
title AUTO-mihoyo-all 构建脚本

echo.
echo ============================================
echo   📦 AUTO-mihoyo-all 构建脚本
echo ============================================
echo.

REM 检查是否存在 node_modules
if not exist "node_modules" (
    echo ⚠️  检测到缺少依赖，正在使用淘宝镜像安装...
    npm config set registry https://registry.npmmirror.com
    set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
    set ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/
    npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败！
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

echo � 开始构建便携版...
echo.

echo 🔨 正在构建便携版exe文件...
set BUILD_TYPE=portable
set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/
npm run dist -- --win portable

if errorlevel 1 (
    echo.
    echo ❌ 构建失败！
    echo 📝 请检查错误信息
    pause
    exit /b 1
) else (
    echo.
    echo ✅ 构建成功！
    echo 📁 输出目录: dist\
    echo.
    
    if exist "dist" (
        echo 📦 构建文件:
        dir /b "dist\*.exe" 2>nul
        echo.
    )
    
    echo 💡 提示: 
    echo   - 便携版可以直接运行，无需安装
    echo   - 首次运行时会自动创建配置文件
    echo   - 配置文件和日志与exe在同一目录
)

pause
