# Seedance2 Storyboard Generator — Web GUI 实现计划

## Context

当前项目是一个纯 Markdown 文档工作流项目，用于将故事/小说转化为 Seedance 2.0 AI 视频。用户需要一个 Web GUI 来管理项目、素材和分镜，并通过 Claude Agent SDK 封装 AI 生成能力。目前项目中没有任何代码，有 5 个示例项目可作为数据源。

---

## 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| 前端框架 | Next.js 14 (App Router) | 前后端统一 TypeScript，API Routes 充当后端 |
| UI 组件库 | Ant Design 5.x | 中文友好，表格/表单/拖拽组件丰富 |
| 状态管理 | Zustand | 轻量、TypeScript 友好 |
| 拖拽 | @dnd-kit/core | 素材拖拽到时间轴 |
| Markdown | react-markdown + @uiw/react-md-editor | 渲染预览 + 编辑 |
| 数据库 | SQLite (better-sqlite3) + Drizzle ORM | 零配置嵌入式，作为结构化索引层 |
| AI 集成 | @anthropic-ai/claude-agent-sdk | 封装 Claude Code CLI 能力 |
| 流式输出 | SSE (Server-Sent Events) | Claude 生成过程实时展示 |

---

## 项目结构

所有 GUI 代码放在 `web/` 子目录下，不干扰现有项目文件：

```
web/
├── src/
│   ├── app/                    # 页面
│   │   ├── page.tsx            # 项目列表仪表板
│   │   ├── projects/[id]/      # 项目详情（Tab：概览/剧本/素材/分镜/流程）
│   │   │   ├── assets/         # 素材管理
│   │   │   ├── storyboard/[ep] # 分镜可视化编辑器
│   │   │   └── pipeline/       # 全流程看板
│   │   └── new/                # 新建项目向导
│   ├── api/                    # 后端 API Routes
│   │   ├── projects/           # 项目 CRUD + 导入
│   │   ├── claude/             # Claude Agent SDK SSE 端点
│   │   └── files/              # 静态文件代理（图片）
│   ├── components/             # 组件
│   │   ├── storyboard/         # TimelineEditor, TimeSlot, AssetSlotPanel 等
│   │   ├── assets/             # AssetGrid, AssetCard, AssetFilter 等
│   │   ├── pipeline/           # PipelineBoard 看板
│   │   └── claude/             # GenerationPanel 流式输出面板
│   ├── lib/
│   │   ├── db/schema.ts        # Drizzle ORM schema
│   │   ├── claude/agent.ts     # Claude Agent SDK 封装
│   │   └── markdown/parser.ts  # Markdown ↔ 结构化数据解析/序列化
│   ├── hooks/                  # useClaudeStream, useProject 等
│   ├── store/                  # Zustand stores
│   └── types/                  # TypeScript 类型
└── data/seedance.db            # SQLite 数据库文件
```

---

## 核心页面设计

### 1. 项目列表仪表板 (`/`)
- 卡片网格展示所有项目（名称、风格、集数、素材数、进度条）
- "导入现有项目"按钮：扫描根目录 `*项目/` 文件夹，解析 Markdown 入库
- "新建项目"按钮

### 2. 素材管理 (`/projects/[id]/assets`)
- 三栏分类 Tab：角色(C) / 场景(S) / 道具(P)
- 素材卡片：缩略图 + 编号 + 名称 + 英文 prompt（可复制）+ 引用集数标签
- 点击素材显示引用关系面板（被哪些集的哪个时段引用）
- 图片上传、批量导出 prompt

### 3. 分镜可视化编辑器 (`/projects/[id]/storyboard/[ep]`)（核心页面）

三栏布局：
```
┌─────────┬──────────────────────────────────┬──────────┐
│ 素材面板 │           时间轴编辑器             │ 属性面板 │
│（可拖拽）│                                   │（详细编辑）│
│         │ [风格描述行]                       │          │
│ C01 林冲│ ┌──────┬──────┬──────┬──────┬──────┐│          │
│ C02 背影│ │ 0-3s │ 3-6s │ 6-9s │9-12s │12-15s││ 镜头运动 │
│ S01 草场│ │ 推镜头│ 环绕 │ 特写 │ 摇   │ 拉  ││ 画面描述 │
│ P01 长枪│ └──────┴──────┴──────┴──────┴──────┘│ 素材引用 │
│         │ [声音设计] [参考列表] [尾帧描述]     │          │
└─────────┴──────────────────────────────────┴──────────┘
```

- 素材从左栏拖入时间轴时段，自动插入 `@图片X` 引用
- 镜头运动下拉选择器（推/拉/摇/移/跟/环绕/升降等）
- "生成完整 Prompt" + "一键复制"按钮
- 集衔接预览：上一集尾帧 vs 本集首帧对比

### 4. 全流程看板 (`/projects/[id]/pipeline`)

横向 5 列看板：`剧本开发 → 素材规划 → 图片生成 → 分镜脚本 → 视频生成`

每列包含对应条目的状态卡片（未开始/进行中/已完成/需修改），点击可跳转。

---

## 数据模型（SQLite）

核心表：
- **projects** — 项目元数据（名称、风格、画幅、状态）
- **scripts** — 剧本（原始 Markdown + 文件路径）
- **script_episodes** — 剧本中各集摘要（情感基调、首尾帧）
- **assets** — 素材（编号、类型、prompt、图片路径、引用集数）
- **episodes** — 分镜集（原始 Markdown、风格行、声音设计、尾帧描述）
- **time_slots** — 时段（每集 5 个，镜头运动、画面描述、素材引用）
- **asset_slots** — 素材槽位（每集最多 9 图 + 3 视频）
- **pipeline_stages** — 流程状态追踪

Markdown 双向同步策略：GUI 修改 → 更新 SQLite → 写回 Markdown 文件。外部修改检测后重新解析入库。

---

## Claude Agent SDK 集成

### 封装方式 (`lib/claude/agent.ts`)
- 使用 `@anthropic-ai/claude-agent-sdk` 的 `query()` 函数
- 配置 `allowed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Skill"]`
- 工作目录限定到项目目录

### SSE 流式端点 (`api/claude/generate/route.ts`)
- 接收任务类型：`generate_script` | `generate_assets` | `generate_episode` | `refine_prompt`
- 流式返回 Claude 输出（文本流 + 工具调用状态）
- 前端通过 `useClaudeStream` hook 消费

### 支持的 AI 操作
1. 从故事文本生成四幕剧本（调用 Skill 完整流程）
2. 从剧本生成素材清单
3. 从剧本+素材生成单集分镜
4. AI 优化/改写某个时段的 Prompt

---

## 后端 API 概览

| 模块 | 端点 | 说明 |
|------|------|------|
| 项目 | `GET/POST /api/projects` | 列表 + 创建 |
| 项目 | `POST /api/projects/import` | 导入现有 Markdown 项目 |
| 剧本 | `GET/PUT /api/projects/[id]/script` | 读取/更新剧本 |
| 素材 | `GET/POST /api/projects/[id]/assets` | 素材 CRUD（支持 type 筛选） |
| 素材 | `POST .../assets/[id]/upload` | 图片上传 |
| 分镜 | `GET/PUT /api/projects/[id]/episodes/[ep]` | 分镜 CRUD |
| 分镜 | `GET .../episodes/[ep]/prompt` | 导出可复制的纯文本 Prompt |
| 流程 | `GET/PUT /api/projects/[id]/pipeline` | 流程状态 |
| AI | `POST /api/claude/generate` | SSE 流式 Claude 生成 |
| 文件 | `GET /api/files/[...path]` | 图片文件代理 |

---

## Markdown 解析器

需要兼容解析三种文件格式：
- **剧本** (`_剧本.md`)：制作参数表格 + 各集结构（情感基调、关键情节、首尾帧）
- **素材清单** (`_素材清单.md`)：风格前缀 + C/S/P 编号素材条目（兼容纯英文和中英混合两种格式）
- **分镜** (`_EXX_分镜.md`)：素材上传清单表格 + 时间轴 5 段描述 + 声音设计 + 尾帧描述

关键参考文件：
- `林冲项目/林教头风雪山神庙_素材清单.md` — 素材清单标准格式
- `林冲项目/林教头风雪山神庙_E01_分镜.md` — 分镜标准格式
- `崖山海战项目/崖山海战_素材清单.md` — 第二种素材清单格式
- `.claude/skills/seedance-storyboard-generator/SKILL.md` — Skill 定义

---

## 分阶段实施

### Phase 1: MVP — 数据展示
- 初始化 Next.js + Ant Design + Drizzle + SQLite 项目
- 实现 Markdown 解析器（三种格式）
- 项目导入 API（扫描文件系统 → 解析 → 入库）
- 项目列表页、项目详情页（只读）
- 素材浏览页（分类 + 图片展示）
- 分镜只读预览（时间轴可视化）

### Phase 2: 编辑能力
- Markdown 序列化器（结构化数据 → Markdown 回写）
- 剧本编辑器（可视化 + 原始 Markdown 双模式）
- 素材编辑、图片上传
- 分镜时间轴编辑器
- 新建项目向导

### Phase 3: AI 集成
- Claude Agent SDK 封装 + SSE 流式端点
- 从故事生成剧本、素材清单、分镜脚本
- AI 优化 Prompt 功能
- 生成结果自动解析入库

### Phase 4: 高级功能
- 素材拖拽到时间轴/槽位（@dnd-kit）
- 全流程看板
- 集衔接预览
- 一键导出、批量操作
- 主题切换

---

## 验证方式

1. `pnpm dev` 启动后访问 `localhost:3000`
2. 点击"导入项目"，确认 5 个现有项目全部正确导入
3. 浏览林冲项目的素材页，确认 C/S/P 分类正确、图片显示正常
4. 打开 E01 分镜编辑器，确认时间轴 5 段内容与原始 Markdown 一致
5. 使用 AI 生成功能创建新项目，确认生成的 Markdown 文件格式正确
6. 修改分镜内容后检查对应 Markdown 文件是否同步更新
