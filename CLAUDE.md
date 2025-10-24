# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Kortix 是一个开源 AI Agent 平台,包含旗舰产品 Suna(通用型 AI Worker)。该平台允许构建、管理和训练自主 AI 代理。

### 核心架构组件

1. **Backend API** (`backend/`) - Python/FastAPI 服务
   - REST API 端点
   - Agent 编排和线程管理
   - 通过 LiteLLM 集成多个 LLM 提供商(Anthropic, OpenAI, OpenRouter, Gemini, X.ai)
   - Agent 构建器和工具系统
   - 与 Daytona SDK 集成用于沙箱执行

2. **Background Worker** (`backend/`) - Dramatiq 异步任务处理
   - 后台 agent 任务执行
   - 工作流处理
   - 运行在独立进程中

3. **Frontend** (`frontend/`) - Next.js/React Web 应用
   - Agent 管理界面
   - 聊天界面
   - 工作流构建器
   - 监控和部署控制

4. **Mobile App** (`apps/mobile/`) - React Native/Expo 应用
   - 使用 NativeWind (Tailwind CSS for React Native)
   - Roobert 自定义字体
   - Lucide 图标
   - React Native Reanimated 动画

5. **Agent Runtime** - Daytona 沙箱
   - 隔离的 Docker 执行环境
   - 浏览器自动化
   - 代码解释器
   - 文件系统访问
   - 安全沙箱

6. **Database & Storage** - Supabase
   - 认证和用户管理
   - Agent 配置
   - 对话历史
   - 文件存储
   - 实时订阅

## 技术栈

### Backend
- **Python 3.11+** (使用 `uv` 作为包管理器)
- **FastAPI** - Web 框架
- **Dramatiq** - 后台任务队列
- **LiteLLM** - 统一 LLM API 接口
- **Supabase Client** - 数据库和认证
- **Redis** - 缓存和会话
- **Daytona SDK** - 沙箱执行

### Frontend
- **Next.js 14+** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式

### Mobile
- **React Native** (Expo)
- **NativeWind** - Tailwind for React Native
- **TypeScript** (strict mode)
- **Expo Router** - 路由
- **Lucide React Native** - 图标库

### 基础设施
- **Docker & Docker Compose** - 容器化
- **Supabase** - PostgreSQL 数据库 + Auth
- **Redis** - 内存缓存
- **Daytona** - Agent 沙箱平台

## 常用开发命令

### 快速启动(推荐)

```bash
# 首次安装 - 交互式安装向导(14步)
python setup.py

# 启动所有服务(Docker 模式)
python start.py

# 或使用 Docker Compose 直接启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 手动启动(开发模式)

**1. 启动 Redis**
```bash
docker compose up redis -d
```

**2. Backend API (终端 1)**
```bash
cd backend
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**3. Background Worker (终端 2)**
```bash
cd backend
uv run dramatiq --processes 4 --threads 4 run_agent_background
```

**4. Frontend (终端 3)**
```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:3000

### 移动端开发

```bash
cd apps/mobile
npm install
npx expo start

# 清除缓存启动
npx expo start --clear
```

### 测试

```bash
# Backend 测试
cd backend
uv run pytest

# Frontend 测试
cd frontend
npm test
```

### Supabase 数据库

```bash
# 登录 Supabase CLI
npx supabase login

# 链接项目
cd backend
npx supabase link --project-ref <project-ref>

# 推送迁移
npx supabase db push
```

## 必需的外部服务

在运行前需要配置以下服务:

### 1. Supabase (必需)
- 访问 https://supabase.com/ 创建项目
- 需要: Project URL, anon key, service role key, JWT secret
- **重要**: 在 Project Settings → Data API → Exposed schemas 中启用 `basejump` schema

### 2. Daytona (必需)
- 访问 https://app.daytona.io/ 创建账号
- 生成 API key
- 创建 snapshot: `kortix/suna:0.1.3.23`
  - Entrypoint: `/usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf`

### 3. LLM 提供商 (至少一个必需)
- OpenAI: https://platform.openai.com/
- Anthropic: https://console.anthropic.com/
- OpenRouter: https://openrouter.ai/
- Google Gemini: https://ai.google.dev/
- X.ai: https://x.ai/

### 4. 搜索和抓取 API (必需)
- Tavily (搜索): https://tavily.com/
- Firecrawl (网页抓取): https://firecrawl.dev/

### 5. 可选服务
- RapidAPI (LinkedIn 抓取等): https://rapidapi.com/
- Exa (人员/公司搜索): https://exa.ai/
- Semantic Scholar (学术论文): https://www.semanticscholar.org/
- Composio (工具集成): https://app.composio.dev/
- Morph (代码编辑): https://morphllm.com/
- Langfuse (可观测性): https://langfuse.com/

## 环境配置

### Backend (`backend/.env`)

从 `backend/.env.example` 复制并填写:

**核心配置**
```env
ENV_MODE=local

# Supabase (必需)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Redis (必需)
REDIS_HOST=redis  # Docker 模式用 "redis", 手动模式用 "localhost"
REDIS_PORT=6379
REDIS_SSL=false

# LLM 提供商 (至少配置一个)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=

# 搜索和抓取 (必需)
TAVILY_API_KEY=your_tavily_key
FIRECRAWL_API_KEY=your_firecrawl_key
FIRECRAWL_URL=https://api.firecrawl.dev

# Daytona 沙箱 (必需)
DAYTONA_API_KEY=your_daytona_key
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us

# 数据 API (必需)
RAPID_API_KEY=your_rapid_api_key

# 安全和 Webhooks (推荐)
MCP_CREDENTIAL_ENCRYPTION_KEY=generated_base64_key
TRIGGER_WEBHOOK_SECRET=random_secret_string
KORTIX_ADMIN_API_KEY=generated_hex_key
```

生成加密密钥:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend (`frontend/.env.local`)

从 `frontend/.env.example` 复制并填写:

```env
NEXT_PUBLIC_ENV_MODE=local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api
NEXT_PUBLIC_URL=http://localhost:3000
```

## 架构要点

### Agent 执行流程
1. 用户通过 Frontend 创建 agent/发送消息
2. Backend API 接收请求,创建 thread
3. LiteLLM 路由到配置的 LLM 提供商
4. Agent 决策需要使用的工具
5. Daytona SDK 在隔离沙箱中执行工具(浏览器、代码、文件等)
6. 结果返回给 LLM 继续推理
7. Worker 处理长时间运行的任务(异步)

### LLM 提供商集成
- 通过 LiteLLM 统一接口支持多提供商
- 自动重试和回退机制
- 模型配置在 backend 代码中定义

### 沙箱安全
- 所有 agent 代码执行都在 Daytona 沙箱中
- 隔离的 Docker 容器
- 网络和文件系统限制
- 自动资源清理

### 后台任务
- Dramatiq 作为任务队列
- Redis 作为 broker
- 支持任务重试和优先级
- 工作流长时间运行任务

## Mobile 应用开发规范

### 颜色系统 (关键)
**严格规则**: 仅使用 `global.css` 中的设计 tokens,禁止硬编码颜色

```tsx
// ✅ 正确 - 使用设计 tokens
<View className="bg-background">
  <Text className="text-foreground">Title</Text>
  <Text className="text-muted">Subtitle</Text>
</View>

// ❌ 错误 - 硬编码颜色
<View className="bg-[#F8F8F8]">
  <Text style={{ color: '#121215' }}>Title</Text>
</View>
```

常用 token:
- `bg-background` / `text-foreground` - 主背景/文字
- `bg-card` / `text-card-foreground` - 卡片
- `bg-primary` / `bg-secondary` / `bg-accent` - 交互色
- `text-muted` / `text-muted-foreground` - 次要文字
- `border-border` - 边框

### 字体系统
使用 Roobert 字体系列:

```tsx
font-roobert           // Regular (400)
font-roobert-light     // Light (300)
font-roobert-medium    // Medium (500)
font-roobert-semibold  // Semi-bold (600)
font-roobert-bold      // Bold (700)
```

### 组件模式
- **一个组件一个文件**
- **逻辑提取到自定义 hooks** (保持组件纯展示)
- **使用 Lucide 图标** - 禁止 PNG 图标
- **NativeWind 样式优先** - 仅在必要时使用 `style` prop

### 间距规范
始终使用 Tailwind 标准间距,禁止自定义像素值:

```tsx
// ✅ 正确
<View className="gap-3 p-4 mx-6 mb-8">

// ❌ 错误
<View style={{ gap: 11.25, padding: 15.5 }}>
```

### 主题系统
应用支持深色/浅色模式:

```tsx
import { useColorScheme } from 'nativewind';

const { colorScheme, toggleColorScheme } = useColorScheme();
// colorScheme === 'dark' | 'light'
```

## 故障排查

### Docker 服务启动失败
```bash
docker compose logs -f
# 检查端口冲突: 3000, 8000, 6379
```

### Supabase 错误
- 确认 URL 和密钥正确
- 检查 `basejump` schema 是否已暴露
- 验证数据库迁移已执行

### LLM 错误
- 确保至少配置一个 LLM API key
- 检查 API 配额和速率限制
- 查看 LiteLLM 日志

### Daytona 错误
- 验证 API key 和 URL
- 确认已创建 `kortix/suna:0.1.3.23` snapshot
- 检查 Daytona 配额

### Redis 连接错误
- Docker 模式: `REDIS_HOST=redis`
- 手动模式: `REDIS_HOST=localhost`
- 确保 Redis 容器正在运行

## 项目结构

```
suna/
├── backend/              # Python FastAPI 后端
│   ├── api.py           # API 入口点
│   ├── core/            # 核心业务逻辑
│   ├── services/        # 外部服务集成
│   ├── supabase/        # 数据库迁移
│   └── pyproject.toml   # Python 依赖
├── frontend/            # Next.js 前端
│   ├── app/            # App router
│   ├── components/     # React 组件
│   └── lib/            # 工具函数
├── apps/mobile/        # React Native 移动端
│   ├── app/           # Expo Router 屏幕
│   ├── components/    # RN 组件
│   └── .cursorrules   # 移动端开发规范
├── setup.py           # 安装向导
├── start.py           # 启动脚本
└── docker-compose.yaml # Docker 编排
```

## 参考文档

- 自托管指南: `docs/SELF-HOSTING.md`
- 贡献指南: `CONTRIBUTING.md`
- API 文档: 启动后访问 http://localhost:8000/docs
- 移动端规范: `apps/mobile/.cursorrules`
