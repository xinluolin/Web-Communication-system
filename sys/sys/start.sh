#!/bin/bash

echo "============================================"
echo "    端到端加密即时通讯系统 - 一键启动"
echo "============================================"
echo ""

# 检查 Java 环境
if ! command -v java &> /dev/null; then
    echo "[错误] 未检测到 Java，请先安装 JDK 21 或更高版本"
    echo ""
    echo "下载地址：https://adoptium.net/download/"
    echo "选择 Temurin 21，安装后重新运行本脚本"
    echo ""
    exit 1
fi

echo "[1/3] Java 环境已就绪"
echo ""

# 自动构建
if [ ! -f "target/sys-0.0.1-SNAPSHOT.jar" ]; then
    echo "[2/3] 正在构建项目，请稍候..."
    ./mvnw clean package -DskipTests -q
    if [ $? -ne 0 ]; then
        echo "[错误] 构建失败"
        exit 1
    fi
    echo "      构建完成"
else
    echo "[2/3] 检测到已有构建，跳过编译"
fi
echo ""

# 启动服务
echo "[3/3] 正在启动服务器..."
echo ""
echo "============================================"
echo "  服务启动后请打开浏览器访问："
echo "  http://localhost:8080"
echo "============================================"
echo ""
echo "按 Ctrl+C 可停止服务"
echo ""

# 尝试自动打开浏览器
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080" &> /dev/null &
elif command -v open &> /dev/null; then
    open "http://localhost:8080" &> /dev/null &
fi

java -jar target/sys-0.0.1-SNAPSHOT.jar
