@echo off
chcp 65001 >nul
:: Unicode编码，解决中文乱码问题

:: 检查并安装依赖项
pip install -r requirements.txt

:: 运行主脚本
python "./AutoGAME.py"

pause