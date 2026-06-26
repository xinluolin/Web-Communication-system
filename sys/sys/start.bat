@echo off
chcp 65001 >nul
title 加密聊天系统

echo ============================================
echo       端到端加密即时通讯系统 - 一键启动
echo ============================================
echo.

:: 检查 Java 环境
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Java，请先安装 JDK 21 或更高版本
    echo.
    echo 下载地址：https://adoptium.net/download/
    echo 选择 Temurin 21，安装后重新运行本脚本
    echo.
    pause
    exit /b 1
)

echo [1/3] Java 环境已就绪
echo.

:: 自动构建（首次运行或代码有变更时需要）
if not exist "target\sys-0.0.1-SNAPSHOT.jar" (
    echo [2/3] 正在构建项目，请稍候...
    call mvnw.cmd clean package -DskipTests -q
    if %errorlevel% neq 0 (
        echo [错误] 构建失败，请检查上方输出
        pause
        exit /b 1
    )
    echo       构建完成
) else (
    echo [2/3] 检测到已有构建，跳过编译
)
echo.

:: 启动服务
echo [3/3] 正在启动服务器...
echo.
echo ============================================
echo   服务启动后请打开浏览器访问：
echo   http://localhost:8080
echo ============================================
echo.
echo 按 Ctrl+C 可停止服务
echo.

start "" http://localhost:8080

java -jar target\sys-0.0.1-SNAPSHOT.jar

pause
