## 1. 数据模型与迁移

- [ ] 1.1 查阅项目 Next.js 本地文档中与 App Router、route handler、server/client component 相关的当前版本约定
- [ ] 1.2 在 Drizzle schema 中新增 `skills` 表，包含 id、name、displayName、description、content、status、sourceSessionId、createdAt、updatedAt 字段和唯一名称约束，并将新 skill 默认状态设为 disabled
- [ ] 1.3 生成并检查数据库迁移，确保新增表不影响现有 `chat_sessions`

## 2. Skill 服务层

- [ ] 2.1 新增 skill 类型、名称校验和输入校验逻辑，避免使用 `any`
- [ ] 2.2 实现创建、列表、按 id 读取、按 name 读取、更新、启停服务函数
- [ ] 2.3 实现仅查询 enabled skill 的显式调用读取和文本候选检索函数
- [ ] 2.4 为名称唯一、非法名称、启停过滤、文本检索补充单元测试

## 3. Skills API

- [ ] 3.1 新增 `/api/skills` route，支持列表和创建 skill
- [ ] 3.2 新增 `/api/skills/[skillId]` route，支持读取、更新和启停 skill
- [ ] 3.3 新增从聊天会话创建 skill 的 API，接收 sessionId、messageIds、可选 name 和 description，并仅基于选中消息生成可编辑 skill 草案
- [ ] 3.4 新增根据聊天会话调整已有 skill 的 API，接收目标 skill、messageIds 和可选补充提示，并仅合并原 skill 内容与选中消息后保存或返回草案
- [ ] 3.5 新增 skill editor 选区 AI 改写 API，接收全文、选区、提示词并返回可编辑替换候选
- [ ] 3.6 为 API 成功路径、校验失败、重复名称、未选消息、消息不属于会话、会话不存在、skill 不存在补充测试

## 4. Skills 管理页面

- [ ] 4.1 新增 `/skills` 页面和服务端入口，加载初始 skill 列表
- [ ] 4.2 新增通用 `SkillEditor` 组件，支持正文自由编辑并向创建、编辑、聊天生成和聊天调整流程复用
- [ ] 4.3 在 `SkillEditor` 中实现鼠标选中文本后展示右上角 AI 改写入口
- [ ] 4.4 在 `SkillEditor` 中实现提示词输入、候选文本展示、候选手动编辑、重新生成、确认回填和取消流程
- [ ] 4.5 新增 `components/skills` 管理组件，支持列表、空状态、详情编辑和创建表单，并接入 `SkillEditor`
- [ ] 4.6 在管理组件中接入创建、编辑、启停 API，并展示保存中、错误和成功后的最新状态
- [ ] 4.7 保证 `/skills` 页面在桌面和移动视口都能完成浏览、创建和编辑
- [ ] 4.8 在首页右上角添加 `/skills` 入口，并保持与 workspace 入口一致的视觉语言
- [ ] 4.9 在聊天页 header 添加 `/skills` 入口

## 5. 聊天 Skill 调用集成

- [ ] 5.1 实现解析用户消息开头 `/{name}` 的工具函数，并保留剩余文本作为任务内容
- [ ] 5.2 在聊天流服务中处理显式 skill 调用，未匹配 enabled skill 时返回清晰错误或可理解回复
- [ ] 5.3 为 agent 增加数据库 skill 检索和读取工具，使 agent 可按需自动调用 enabled skill
- [ ] 5.4 调整 agent 调用链路，确保运行时 skill 内容只来自数据库而不是文件系统
- [ ] 5.5 为显式调用成功、skill 不存在、skill 停用、前缀解析和自动检索补充测试

## 6. 聊天记录生成与调整入口

- [ ] 6.1 在聊天页 header 添加创建/调整 skill 的入口，进入消息选择模式后允许用户自由选择一条或多条具体消息并取消选择
- [ ] 6.2 在创建 skill 流程中支持用户预填 name 和 description，未填写时由 AI 根据选中消息生成 name、description 和正文
- [ ] 6.3 在调整 skill 流程中支持选择目标 skill、选中消息和可选补充提示后生成更新草案
- [ ] 6.4 将聊天生成和调整结果接入通用 `SkillEditor`，允许用户保存前自由编辑和选区 AI 改写
- [ ] 6.5 确保新建或生成后的 skill 保存到数据库时默认 disabled，用户确认后可手动启用
- [ ] 6.6 为聊天消息选择、预填 name/description、自动生成全部字段、调整已有 skill 和编辑器回填流程补充测试

## 7. 验证与收尾

- [ ] 7.1 运行 `pnpm lint` 并修复问题
- [ ] 7.2 运行 `pnpm typecheck` 并修复问题
- [ ] 7.3 运行 `pnpm test:unit` 并修复问题
- [ ] 7.4 运行相关 e2e 测试或 `pnpm test:e2e`，验证首页入口、skills 页面和聊天调用流程
- [ ] 7.5 更新必要的说明文档或测试夹具，确认 OpenSpec 任务与实现一致
