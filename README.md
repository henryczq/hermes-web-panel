# Hermes Web Panel

Hermes Web Panel 是一个独立于 `openclaw-admin-suite` 的 Hermes 管理系统。

目标：

- 避免与现有 `openclaw-web-panel` 发生菜单、数据结构和运行时冲突
- 以后端 Python 为核心，优先复用 `hermes-agent` 现有工具、配置和 profile 体系
- 提供 Hermes 的管理面板、配置编辑、工作空间管理和渠道管理能力

## 设计原则

- 独立项目，不侵入 `openclaw-admin-suite`
- 后端以 Python 为主，方便直接复用 Hermes 代码和命令
- 前端保持单独工程，后续可独立演进
- 文档、契约、服务端、前端、共享逻辑分层清晰

## 初始范围

第一阶段聚焦以下模块：

- 渠道管理
- AI 配置
- 工作空间管理
- 配置文件编辑

## 目录结构

```text
hermes-web-panel/
├── apps/
│   ├── server/          # Python FastAPI 服务
│   └── web/             # React 前端应用
├── packages/
│   ├── admin_contract/  # 目录暂保留 admin_*，对外包名为 hermes_web_panel_contract
│   ├── admin_core/      # Hermes 管理核心逻辑
│   └── admin_ui/        # 目录暂保留 admin_*，对外包名为 hermes_web_panel_ui
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   └── tasks.md
└── pyproject.toml
```

## 开发

### 1. 创建虚拟环境

```bash
cd /home/zzgzczq/01-AI/03-openclaw-all/hermes-web-panel
python -m venv .venv
source .venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -e .
```

### 3. 启动开发服务

```bash
uvicorn apps.server.src.hermes_admin_server.main:app --reload --port 18931
```

### 4. 健康检查

```bash
curl http://127.0.0.1:18931/health
```

## 当前状态

当前仓库已包含：

- 项目骨架
- FastAPI 最小服务
- 内置 `vendor/openclaw-china-definitions` 中国渠道定义数据
- Hermes 管理面板方案文档
- 第一阶段任务清单

## 本地依赖说明

- `openclaw-china-definitions` 已内置到仓库，不再依赖 `openclaw-admin-suite`
- 如需临时切换到其他渠道定义目录，可设置环境变量 `HERMES_WEB_PANEL_CHINA_DEFINITIONS_ROOT`

后续可在此基础上继续实现 Hermes profile、配置、渠道和 AI 管理能力。
