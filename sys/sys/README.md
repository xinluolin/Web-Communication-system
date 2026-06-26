# 端到端加密即时通讯系统

基于 Spring Boot WebSocket 的即时通讯系统，支持 DH 密钥协商 + AES 端到端加密通讯。

## 功能特性

- **端到端加密**：消息在发送端加密、接收端解密，服务端无法读取明文
- **Diffie-Hellman 密钥协商**：RFC 3526 Group 14（2048 位素数），客户端生成密钥对，共享密钥不经过服务端
- **双重加密模式**：AES-128-CBC（搭配 HMAC-SHA256 完整性校验）+ AES-128-GCM（内置认证标签）
- **会话管理**：发起方发起会话请求 → 接收方同意 → DH 密钥交换 → 加密通讯
- **文件传输**：支持加密传输图片（最大 10MB）和视频（最大 50MB）
- **实时通讯**：基于 WebSocket 原生协议的双向消息推送

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Spring Boot 3.4.4, Java 21 |
| 通信协议 | WebSocket（原生） |
| 前端 | 原生 HTML/CSS/JS（无框架） |
| 加密库 | CryptoJS 4.2.0, Web Crypto API |
| 图标 | Font Awesome 6 |

## 环境要求

- **JDK 21** 或更高版本
- **Maven 3.8+**（也可使用项目自带 Maven Wrapper）

## 快速开始

### 1. 构建项目

```bash
cd sys
./mvnw clean package -DskipTests
```

Windows 系统：
```cmd
mvnw.cmd clean package -DskipTests
```

### 2. 启动应用

```bash
./mvnw spring-boot:run
```

或直接运行构建好的 JAR 包：
```bash
java -jar target/sys-0.0.1-SNAPSHOT.jar
```

### 3. 打开浏览器

访问 `http://localhost:8080`

如需修改端口，编辑 `src/main/resources/application.properties`：
```properties
server.port=8080
```

## 使用说明

### 登录
1. 在浏览器中打开应用
2. 输入用户名，点击「进入加密聊天」
3. 同一用户名只能登录一个实例

### 发起加密会话
1. 在左侧搜索框输入对方的用户名
2. 点击搜索结果，发送会话请求
3. 对方会弹出确认窗口，点击「接受」开始密钥协商
4. 密钥交换完成后，即可发送加密消息

### 发送消息
- 输入文字后按回车或点击发送按钮
- 消息自动加密后传输
- 点击图片/视频按钮可以发送多媒体文件

## 系统架构

```
用户A                           服务器                          用户B
  |                               |                              |
  |--- 会话请求(SESSION_REQUEST) →|----------------------------->|
  |                               |                              |
  |<----------------------------- |←--- 接受会话(SESSION_ACCEPT) -|
  |                               |                              |
  |--- 密钥交换(公钥A) ---------→|----------------------------->|
  |                               |                              |
  |<----------------------------- |←--- 密钥交换(公钥B) ---------|
  |                               |                              |
  |=== DH 计算共享密钥 ==========|=== DH 计算共享密钥 ==========|
  |                               |                              |
  |--- 聊天气泡(AES加密) -------→|----------------------------->|
```

### 密钥协商流程
1. **DH 密钥交换**：2048 位素数（RFC 3526 Group 14），客户端本地生成密钥对
2. **密钥派生（KDF）**：SHA-256(共享密钥 || 会话ID) → 派生 AES 密钥和 HMAC 密钥
3. **AES-128-CBC**：CBC 模式加密 + HMAC-SHA256 完整性校验
4. **AES-128-GCM**：GCM 模式加密（内置认证标签，无需额外 HMAC）

## 项目结构

```
sys/
├── pom.xml                              # Maven 配置
├── README.md                            # 本文件
├── uploads/                             # 上传文件目录（已加入 .gitignore）
│   ├── images/
│   └── videos/
└── src/
    ├── main/
    │   ├── java/com/im/sys/
    │   │   ├── SysApplication.java              # Spring Boot 启动类
    │   │   ├── config/
    │   │   │   ├── WebSocketConfig.java         # WebSocket 端点注册
    │   │   │   └── WebMvcConfig.java            # 静态资源映射
    │   │   ├── handler/
    │   │   │   └── ChatWebSocketHandler.java     # 消息路由与会话管理
    │   │   ├── model/
    │   │   │   ├── ChatSession.java             # 会话数据模型
    │   │   │   └── WebSocketMessage.java        # 消息载荷模型
    │   │   └── controller/
    │   │       └── FileUploadController.java     # 图片/视频上传接口
    │   └── resources/
    │       ├── application.properties           # 服务配置
    │       └── static/
    │           ├── index.html                   # 主界面（单页应用）
    │           └── js/
    │               ├── websocket.js             # WebSocket 连接与用户管理
    │               ├── crypto.js                # DH 密钥协商 + AES 加密
    │               └── app.js                   # 会话管理与聊天 UI
    └── test/
        └── java/com/im/sys/
            └── SysApplicationTests.java         # 基础上下文加载测试
```

## 消息类型

| 消息类型 | 用途 | 流向 |
|----------|------|------|
| `REGISTER` | 用户注册/登录 | 客户端 → 服务端 |
| `ONLINE_USERS` | 在线用户列表 | 服务端 → 所有客户端 |
| `CREATE_SESSION` | 创建会话 | 客户端 A → 服务端 → 客户端 B |
| `SESSION_REQUEST` | 会话请求 | 客户端 A → 客户端 B |
| `SESSION_ACCEPT` | 接受会话 | 客户端 B → 客户端 A |
| `KEY_EXCHANGE` | DH 公钥交换 | 双向（RESPONSE / COMPLETE 两步） |
| `CHAT` | 加密聊天消息 | 双向（含文本/图片/视频） |

## 安全说明

- 加密密钥在客户端生成，不经过服务端传输
- 服务端仅负责消息转发，无法解密聊天内容
- 每个会话使用独立密钥（由 DH 共享密钥 + 会话ID 派生）
- CBC 模式使用 HMAC-SHA256 保证消息完整性
- GCM 模式内置认证加密，防止篡改

## 协议

本项目仅用于学习交流。
