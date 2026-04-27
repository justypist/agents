## Context

当前应用是 Next.js App Router 项目，聊天由 `useChat`、API route、`ToolLoopAgent` 和数据库中的 `chat_sessions` 共同支撑。现有 agent 能力来自代码内注册的工具和 instructions，workspace 页面已提供文件管理式的管理体验，但 skill 还没有应用内持久化模型。

本变更要让 skill 成为应用数据，而不是文件系统资源：创建、编辑、检索、启停、调用都以数据库记录为准。实现时需要沿用现有 Drizzle/Postgres、App Router API route、客户端组件和测试约定，并在编码前查阅项目所用 Next.js 版本的本地文档。

## Goals / Non-Goals

**Goals:**

- 用数据库表保存 skill 定义，运行时不从 `.agents/skills` 或其他本地目录读取 skill 内容。
- 提供 `/skills` 管理页，支持查看、创建、编辑、启用/停用 skill，并在现有页面右上角暴露入口。
- 提供通用 skill editor，支持直接编辑全文和基于选区的 AI 辅助改写。
- 提供基于用户选中的聊天消息生成新 skill、调整已有 skill 的后端能力和 UI 操作。
- 在聊天链路中支持两种调用方式：agent 自动按需使用已有 skill，用户通过 `/{name}` 显式指定 skill。
- 保持现有静态 agent 注册方式不被本变更替换，仅增加数据库 skill 作为可复用上下文/工具能力。

**Non-Goals:**

- 不迁移或兼容已有文件系统 skill 目录中的内容。
- 不实现多租户、权限模型或公开分享市场。
- 不让用户编辑底层 agent 代码、工具实现或模型配置。
- 不要求 skill 支持任意可执行代码；skill 内容应作为结构化说明和调用上下文使用。

## Decisions

1. 数据模型以 `skills` 单表起步。

   - 字段建议包含 `id`、`name`、`displayName`、`description`、`content`、`status`、`sourceSessionId`、`createdAt`、`updatedAt`。
   - `name` 使用 kebab-case 或安全 slug，并建立唯一约束，用于 `/{name}` 显式调用。
   - `status` 使用 `enabled`/`disabled` 字符串联合类型，新创建和 AI 生成的 skill 默认保存为 `disabled`，只有 enabled skill 参与聊天检索和调用。
   - 备选方案是拆分版本表或审计表；先不采用，避免在没有回滚、协作编辑等明确需求前增加复杂度。

2. 服务层集中封装数据库 skill 操作。

   - 新增 `lib/skills.ts` 或同级模块，提供 list/get/create/update/setStatus/search 等函数。
   - API route 和 agent 工具都通过服务层访问数据库，避免 UI、route、agent 各自拼装查询逻辑。
   - 搜索先使用名称、标题、描述和内容的轻量匹配；不新增向量库或 embedding 依赖，后续如有规模需求再演进。

3. 管理页面复用 workspace 的信息架构，但面向记录管理。

   - 新增 `/skills` 页面和 `components/skills` 组件，采用左侧/列表与详情编辑区或列表卡片加详情表单的响应式布局。
   - skill 正文编辑抽象为通用 `SkillEditor` 组件，用于管理页、创建流程和调整流程，避免不同入口产生不一致编辑体验。
   - `SkillEditor` 提供普通文本编辑能力，并监听 textarea/contenteditable 中的选区；当存在有效选区时，在编辑器右上角展示 AI 改写入口。
   - 点击 AI 改写入口后，用户输入提示词，后端只接收当前全文、选中文本、选区位置和提示词，返回替换候选；用户可继续输入提示词重新生成，也可手动编辑候选文本，确认后再回填原文。
   - 首页已有右上角 workspace 入口；新增 skills 入口应保持同一视觉语言。聊天页 header 提供 skills 入口和进入消息选择模式的操作，满足“页面右上角添加入口”的可达性要求。
   - 表单提交走 API route，客户端做基础校验，服务端做最终校验。

4. 聊天调用分为显式调用和自动调用。

   - 显式调用：在用户最后一条文本消息开头识别 `/{name}`，解析并加载对应 enabled skill；未找到时返回清晰错误或让 agent 明确说明不可用。
   - 自动调用：给 agent 增加数据库 skill 检索工具，agent 可根据当前任务查询可用 skill，再读取匹配 skill 的完整内容。
   - 为避免把所有 skill 注入上下文导致 token 浪费，默认只注入显式指定的 skill；自动场景由工具按需检索。

5. 从聊天记录生成或调整 skill 使用受控的后端生成流程。

   - API 接收 sessionId、用户选中的 messageIds、目标操作，以及可选的 name 和 description 输入。
   - 后端只读取用户选中的消息，并用这些消息作为生成或调整 skill 的依据；未选消息不得进入生成上下文。
   - 创建新 skill 时，如果用户提供 name 和 description，模型只需要结合它们与选中消息生成正文并可补全标题；如果用户未提供，则模型生成 name、description 和正文。生成后的新 skill 默认保存为 `disabled`，用户确认后手动启用。
   - 调整已有 skill 时以原 skill 内容、用户选中的消息和用户补充输入作为输入，生成更新后的内容并保存或进入可编辑草案。
   - 生成结果仍以数据库记录为准，不写入文件系统。

## Risks / Trade-offs

- 显式 `/{name}` 与普通消息冲突 → 仅识别消息开头的合法 slug，并允许用户转义或改写普通文本。
- 自动检索命中不准 → 先做简单匹配并让 agent 读取候选摘要，后续可增加 tags、使用统计或 embedding。
- Skill 内容过长影响上下文 → 管理页限制正文长度，显式调用时只注入必要字段，自动调用先返回摘要再按需读取详情。
- 模型生成的 skill 质量不稳定 → 生成后保存为可编辑草案或立即进入编辑页，让用户确认后启用。
- 选区改写误覆盖正文 → 改写结果先进入候选区，只有用户确认后才替换原文选区。
- 消息选择范围不明确 → UI 明确展示已选消息数量和预览，API 只接受 messageIds 并在服务端验证这些消息属于目标会话。
- 数据库迁移失败 → 使用 Drizzle 生成迁移；回滚时删除新增 route/UI 对新表的依赖，数据库可保留未使用表或按部署流程回滚。

## Migration Plan

1. 新增 `skills` schema 和 Drizzle migration。
2. 新增 skill 服务层及单元测试。
3. 新增 skills API route，并覆盖 CRUD、状态切换、名称校验。
4. 新增 `/skills` 页面和导航入口。
5. 新增聊天消息选择、生成/调整 skill 的 API 与 UI 操作。
6. 扩展聊天流处理，支持显式 `/{name}` 和 agent 自动 skill 工具。
7. 新增通用 skill editor 与选区 AI 改写能力。
8. 运行 lint、typecheck、unit/e2e 测试。

## Open Questions

- 暂无。
