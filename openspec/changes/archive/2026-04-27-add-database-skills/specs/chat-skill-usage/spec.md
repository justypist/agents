## ADDED Requirements

### Requirement: 从聊天记录创建 Skill
系统 SHALL 支持基于用户从指定聊天会话中选择的消息生成新 skill 草案并保存到数据库。

#### Scenario: 根据选中消息生成完整 Skill
- **WHEN** 用户选择一组聊天消息并请求创建 skill，且未提供 name 和 description
- **THEN** 系统 SHALL 仅基于选中的消息生成 skill name、description 和正文，并保存为数据库 skill

#### Scenario: 根据用户输入生成 Skill 正文
- **WHEN** 用户选择一组聊天消息并提供 skill name 和 description
- **THEN** 系统 SHALL 保留用户提供的 name 和 description，并基于选中消息生成 skill 正文

#### Scenario: 未选择消息
- **WHEN** 用户请求从聊天记录创建 skill 但没有选择任何消息
- **THEN** 系统 SHALL 拒绝请求并提示用户至少选择一条消息

#### Scenario: 选中消息不属于会话
- **WHEN** 用户提交的 messageId 不属于指定会话
- **THEN** 系统 SHALL 拒绝请求并不得使用该消息生成 skill

#### Scenario: 会话不存在
- **WHEN** 用户请求从不存在的会话创建 skill
- **THEN** 系统 SHALL 拒绝请求并返回会话不存在错误

### Requirement: 从聊天记录调整已有 Skill
系统 SHALL 支持使用用户从指定聊天会话中选择的消息更新已有 skill 的描述和内容。

#### Scenario: 调整已有 Skill
- **WHEN** 用户选择已有 skill 和一组聊天消息并请求调整它
- **THEN** 系统 SHALL 仅结合选中的消息和原 skill 内容生成更新后的数据库记录或可编辑草案

#### Scenario: 调整时提供补充说明
- **WHEN** 用户调整已有 skill 时提供额外提示或描述
- **THEN** 系统 SHALL 将该提示与选中消息、原 skill 内容一起用于生成更新结果

#### Scenario: 目标 Skill 不存在
- **WHEN** 用户请求调整不存在的 skill
- **THEN** 系统 SHALL 拒绝请求并返回 skill 不存在错误

### Requirement: 聊天消息选择
系统 SHALL 允许用户在聊天页面选择具体消息作为创建或调整 skill 的上下文。

#### Scenario: 进入消息选择模式
- **WHEN** 用户在聊天页 header 中发起从当前会话创建或调整 skill
- **THEN** 系统 SHALL 进入消息选择模式，并允许用户在消息列表中选择一条或多条具体消息

#### Scenario: 展示已选消息
- **WHEN** 用户选择消息
- **THEN** 系统 SHALL 展示已选消息数量或预览，并允许用户取消选择

### Requirement: 用户显式调用 Skill
系统 SHALL 支持用户在聊天输入开头通过 `/{name}` 显式调用启用状态的 skill。

#### Scenario: 显式调用成功
- **WHEN** 用户发送以合法 `/{name}` 开头的消息且该 skill 已启用
- **THEN** 系统 SHALL 将该 skill 的内容提供给 agent 用于本轮回复

#### Scenario: 显式调用不存在或停用的 Skill
- **WHEN** 用户发送以 `/{name}` 开头的消息但没有可用 skill 匹配该名称
- **THEN** 系统 SHALL 返回清晰错误或让 agent 明确说明该 skill 不可用

### Requirement: Agent 自动调用 Skill
系统 SHALL 允许 agent 在需要时检索和读取数据库中的启用 skill，以辅助完成当前用户任务。

#### Scenario: 自动检索候选 Skill
- **WHEN** agent 判断当前任务可能受益于已有 skill
- **THEN** 系统 SHALL 提供工具或服务让 agent 查询相关启用 skill 候选

#### Scenario: 自动读取 Skill 详情
- **WHEN** agent 选择使用某个候选 skill
- **THEN** 系统 SHALL 提供该 skill 的完整内容给 agent 用于后续推理和回复

### Requirement: Skill 调用不污染原始聊天语义
系统 SHALL 保留用户消息的实际任务内容，并在处理显式调用前缀后将剩余文本作为用户请求传递给 agent。

#### Scenario: 去除显式调用前缀
- **WHEN** 用户发送 `/research-plan 帮我整理这段信息`
- **THEN** 系统 SHALL 使用 `research-plan` skill，并将 `帮我整理这段信息` 作为用户的任务内容
