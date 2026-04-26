# Words 后端服务

Chrome 扩展 - 英语学习助手的后端 API 服务，使用 FastAPI 构建。

## 功能

- **用户认证**: 支持 GitHub OAuth 和自定义 OAuth 提供商
- **数据同步**: 同步用户的分类、单词和收藏数据
- **数据持久化**: 使用 MySQL 数据库存储

## 快速开始

### 1. 准备 MySQL 数据库

```sql
CREATE DATABASE words CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置环境变量

创建 `.env` 文件或设置环境变量：

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=words
```

### 3. 安装依赖 (使用 uv)

```bash
cd backend

# 安装 uv (如果还没有)
# Windows: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
# Linux/Mac: curl -LsSf https://astral.sh/uv/install.sh | sh

# 同步依赖
uv sync
```

或使用 pip：

```bash
pip install -r requirements.txt
```

### 4. 启动服务

```bash
# 使用 uv 运行
uv run python main.py

# 或使用 uvicorn
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 端点

### GitHub OAuth 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/github/login` | 获取 GitHub 授权 URL |
| POST | `/api/auth/github/callback` | 用授权码换取 JWT token |
| POST | `/api/auth/verify` | 验证 token 有效性 |
| GET | `/api/auth/me` | 获取当前用户信息 |

**认证流程**：

1. 前端调用 `/api/auth/github/login`，传入 `redirect_uri`
2. 后端返回 GitHub 授权 URL 和 state
3. 前端引导用户授权，获取授权码
4. 前端调用 `/api/auth/github/callback`，传入 code 和 state
5. 后端用授权码换取 access token，获取用户信息，返回 JWT token
6. 后续请求使用 `Authorization: Bearer <jwt_token>`

### 数据同步

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync` | 上传/同步用户数据 |
| GET | `/api/sync` | 获取已同步的数据 |

**同步数据格式**：

```json
{
  "categories": [
    { "id": "default", "name": "General", "color": "#ffd54f" }
  ],
  "words": [
    { "text": "example", "categoryId": "default", "addedAt": 1714000000000 }
  ],
  "collections": [
    {
      "id": "uuid",
      "text": "collected text",
      "categoryId": "default",
      "sourceUrl": "https://example.com",
      "sourceTitle": "Example Page",
      "context": "surrounding context",
      "collectedAt": 1714000000000
    }
  ]
}
```

## 数据库

使用 MySQL，首次启动时自动创建表。

**环境变量配置**：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_HOST` | localhost | 数据库主机 |
| `MYSQL_PORT` | 3306 | 数据库端口 |
| `MYSQL_USER` | root | 数据库用户 |
| `MYSQL_PASSWORD` | (空) | 数据库密码 |
| `MYSQL_DATABASE` | words | 数据库名 |

### 数据表

- `users` - 用户信息
- `categories` - 单词分类
- `words` - 单词列表
- `collections` - 收藏列表

## 在扩展中配置

1. 打开扩展的设置页面
2. 在「后端服务」部分输入 API 地址: `http://localhost:8000`
3. 登录 GitHub（或配置自定义 OAuth）
4. 开启自动同步

## 生产部署

建议使用 Docker 或直接部署到云服务：

```bash
# 生产环境启动
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 目录结构

```
backend/
├── main.py               # 入口文件
├── pyproject.toml        # uv 项目配置
├── requirements.txt      # pip 依赖 (备用)
├── README.md
├── .env.example          # 环境变量示例
└── app/
    ├── __init__.py
    ├── main.py           # FastAPI 应用工厂
    ├── config.py         # 配置管理 (pydantic-settings)
    ├── database.py       # 数据库连接
    ├── dependencies.py   # 依赖注入
    ├── models/           # SQLAlchemy ORM 模型
    │   ├── __init__.py
    │   ├── user.py
    │   ├── category.py
    │   ├── word.py
    │   └── collection.py
    ├── schemas/          # Pydantic 数据模式
    │   ├── __init__.py
    │   ├── user.py
    │   ├── category.py
    │   ├── word.py
    │   ├── collection.py
    │   ├── sync.py
    │   └── auth.py
    ├── services/         # 业务逻辑层
    │   ├── __init__.py
    │   ├── user.py
    │   ├── auth.py
    │   └── sync.py
    └── routers/          # API 路由
        ├── __init__.py
        ├── auth.py
        └── sync.py
```
