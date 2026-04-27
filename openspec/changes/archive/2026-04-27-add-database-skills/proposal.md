## Why

当前 agent 的能力主要由代码和文件系统中的工具、说明决定，用户无法在应用内持久化、管理和复用自定义 skill。引入纯数据库驱动的 skills 能让用户从聊天经验沉淀可复用能力，并在后续对话中由 agent 自动或显式调用。

## What Changes

- 新增纯数据库 skills 存储与服务层，不依赖本地 skill 文件系统作为数据来源。
- 新增 skills 管理页面，提供类似 workspace 的列表、详情、创建、编辑和启停管理体验。
- 在页面右上角增加 skills 入口，便于从首页或聊天界面进入管理页。
- 支持用户从聊天记录中自由选择具体消息来创建新 skill，或将选中消息中的经验合并调整到已有 skill。
- 创建 skill 时允许用户预填 skill name 和 description，再由 AI 基于选中消息与用户输入生成正文；也允许完全不填，由 AI 同时生成 name、description 和正文。
- 新增通用 skill editor 组件，支持自由编辑全文，并支持选中文本后用提示词让 AI 反复改写选区，确认后回填原文。
- 扩展聊天请求处理，让 agent 能按需要检索并调用已有 skill。
- 支持用户在输入中通过 `/{name}` 直接调用指定 skill。

## Capabilities

### New Capabilities
- `database-skills`: 管理存储于数据库中的 skill 定义、生命周期和查询能力。
- `skill-management-ui`: 提供 skills 页面入口、列表、详情、创建、编辑、启停操作和通用 skill editor。
- `chat-skill-usage`: 支持从用户选择的聊天消息生成或调整 skill，并支持 agent 自动调用或用户显式 `/{name}` 调用。

### Modified Capabilities

## Impact

- 数据库：新增 skills 相关表和迁移，可能包含名称、描述、内容、状态、来源会话、审计时间等字段。
- API：新增 skills 管理接口、基于选中聊天消息生成/调整 skill 的接口、选区 AI 改写接口，并扩展聊天请求中的显式 skill 调用解析。
- Agent：新增数据库 skill 检索/调用工具或上下文注入流程，确保运行时不依赖文件系统读取 skill。
- UI：新增 `/skills` 页面、右上角导航入口、聊天页中的消息选择与 skill 创建/调整入口，以及可复用的 skill editor 与选区 AI 改写交互。
- 测试：覆盖数据库服务、API、聊天调用解析、UI 入口和关键端到端流程。
