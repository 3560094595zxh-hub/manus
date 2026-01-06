# Manus API Client

一个功能完整的 Manus API 客户端 Web 应用，支持对话、文件管理和任务历史查询。

## 功能特性

- 🔑 **API Key 管理** - 安全保存和管理 API Key，支持历史记录
- 🤖 **模型选择** - 支持 manus-1.6、manus-1.6-max、manus-1.6-lite 三种模型
- 💬 **对话功能** - 发送消息、实时轮询获取结果、支持多轮对话
- 📁 **文件管理** - 上传文件、查看已上传文件列表、添加文件到对话
- 📜 **任务历史** - 通过任务 ID 查询完整对话历史
- ⚙️ **轮询设置** - 可配置轮询间隔（1-30秒）
- 📱 **响应式设计** - 支持桌面和移动设备

## 快速开始

### 本地运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 打开浏览器访问：`http://localhost:3000`

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 3000 |

## 部署指南

### 部署到 Render

1. 在 [Render](https://render.com) 创建账号
2. 点击 "New +" -> "Web Service"
3. 连接你的 GitHub 仓库或使用公开仓库
4. 配置：
   - **Name**: manus-api-client
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 点击 "Create Web Service"

### 部署到 Vercel

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 在项目目录运行：
```bash
vercel
```

3. 按提示完成部署

### 部署到 Heroku

1. 安装 [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

2. 登录并创建应用：
```bash
heroku login
heroku create your-app-name
```

3. 部署：
```bash
git push heroku main
```

### 部署到 Railway

1. 在 [Railway](https://railway.app) 创建账号
2. 点击 "New Project" -> "Deploy from GitHub repo"
3. 选择你的仓库
4. Railway 会自动检测并部署

### 使用 Docker 部署

1. 构建镜像：
```bash
docker build -t manus-api-client .
```

2. 运行容器：
```bash
docker run -p 3000:3000 manus-api-client
```

## 项目结构

```
manus-api-client/
├── server.js          # 后端服务器（Express）
├── package.json       # 项目配置和依赖
├── Dockerfile         # Docker 配置
├── .gitignore         # Git 忽略文件
├── README.md          # 项目说明
└── public/
    └── index.html     # 前端页面
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/create-task` | POST | 创建新任务 |
| `/api/get-task/:taskId` | POST | 获取任务详情 |
| `/api/upload-file` | POST | 上传文件 |
| `/api/list-files` | POST | 获取文件列表 |
| `/api/delete-file/:fileId` | DELETE | 删除文件 |
| `/health` | GET | 健康检查 |

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML + CSS + JavaScript
- **API**: Manus API (https://api.manus.im/v1)

## 许可证

MIT License
