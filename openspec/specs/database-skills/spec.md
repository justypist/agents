## Purpose
定义数据库持久化 skill 的核心能力、唯一命名、生命周期状态和查询服务。

## Requirements

### Requirement: 数据库持久化 Skill 定义
系统 SHALL 将 skill 定义持久化在数据库中，并将数据库记录作为运行时 skill 的唯一数据来源。

#### Scenario: 创建 Skill
- **WHEN** 用户提交合法的 skill 名称、标题、描述和内容
- **THEN** 系统 SHALL 在数据库中创建 skill 记录并返回创建后的完整记录

#### Scenario: 运行时不读取文件系统 Skill
- **WHEN** agent 需要查询或调用 skill
- **THEN** 系统 SHALL 从数据库读取 skill，不得依赖本地 skill 文件系统作为数据来源

### Requirement: Skill 名称唯一且可调用
系统 SHALL 为每个 skill 维护唯一的可调用名称，用于管理、检索和 `/{name}` 显式调用。

#### Scenario: 名称重复
- **WHEN** 用户创建或重命名 skill 时提交已存在的名称
- **THEN** 系统 SHALL 拒绝请求并返回可理解的重复名称错误

#### Scenario: 名称格式非法
- **WHEN** 用户提交包含非法字符的 skill 名称
- **THEN** 系统 SHALL 拒绝请求并说明名称必须使用安全 slug 格式

### Requirement: Skill 生命周期状态
系统 SHALL 支持启用和停用 skill，并仅让启用状态的 skill 参与聊天调用。

#### Scenario: 新 Skill 默认停用
- **WHEN** 用户创建或由 AI 生成一个新 skill
- **THEN** 系统 SHALL 将该 skill 默认保存为停用状态

#### Scenario: 停用 Skill
- **WHEN** 用户停用一个 skill
- **THEN** 系统 SHALL 保留该 skill 记录但从自动检索和显式调用结果中排除它

#### Scenario: 重新启用 Skill
- **WHEN** 用户重新启用一个已停用 skill
- **THEN** 系统 SHALL 允许该 skill 再次被检索和调用

### Requirement: Skill 查询服务
系统 SHALL 提供按名称、状态和文本匹配查询 skill 的服务能力，供 API、UI 和 agent 调用链路复用。

#### Scenario: 按名称读取
- **WHEN** 系统使用名称查询一个启用的 skill
- **THEN** 系统 SHALL 返回与该名称完全匹配的 skill 记录

#### Scenario: 文本检索候选 Skill
- **WHEN** agent 根据当前任务检索 skill
- **THEN** 系统 SHALL 返回与名称、标题、描述或内容匹配的启用 skill 候选列表
