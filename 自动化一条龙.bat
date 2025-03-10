@echo off
chcp 65001 >nul
:: Unicode编码，解决中文乱码问题

:: 检查并安装依赖项
pip install -r requirements.txt

:: 配置 sparse-checkout 以排除 json 文件
git sparse-checkout init --cone
git sparse-checkout set ':(exclude)*.json'

:: 拉取更新
git pull

:: 运行主脚本
python "./AutoGAME.py"

pause