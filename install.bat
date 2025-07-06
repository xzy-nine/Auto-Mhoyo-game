@echo off
chcp 65001 >nul
title AUTO-mihoyo-all 依赖安装器

echo.
echo ============================================
echo   📦 AUTO-mihoyo-all 依赖安装器
echo ============================================
echo.

echo 🔧 配置npm镜像源...
npm config set registry https://registry.npmmirror.com
echo ✅ npm镜像源配置完成

echo.
echo 📥 安装项目依赖...
set ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://cdn.npmmirror.com/binaries/electron-builder-binaries/
npm install

if errorlevel 1 (
    echo.
    echo ❌ 依赖安装失败！
    echo 💡 可能的解决方案:
    echo   1. 检查网络连接
    echo   2. 清理npm缓存: npm cache clean --force
    echo   3. 删除node_modules文件夹后重试
    echo   4. 使用yarn代替npm
    pause
    exit /b 1
)

echo.
echo ✅ 所有依赖安装完成！
echo.
echo 🎯 现在可以使用以下命令:
echo   - start.bat          启动图形界面
echo   - run-nodejs.bat     使用命令行版本
echo   - build.bat          构建便携版exe
echo.

pause
