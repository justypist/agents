## Purpose
定义 skills 管理页面、通用 skill editor、导航入口和响应式管理体验。

## Requirements

### Requirement: Skills 管理页面
系统 SHALL 提供 `/skills` 页面，用于浏览和管理数据库中的 skills。

#### Scenario: 查看 Skill 列表
- **WHEN** 用户打开 `/skills`
- **THEN** 系统 SHALL 展示数据库中的 skill 列表，并显示名称、标题、描述、状态和更新时间

#### Scenario: 查看空状态
- **WHEN** 数据库中没有 skill
- **THEN** 系统 SHALL 展示空状态说明，并提供创建新 skill 的入口

### Requirement: 创建和编辑 Skill
系统 SHALL 在管理页面支持创建新 skill 和编辑已有 skill 的核心字段，并使用通用 skill editor 编辑正文。

#### Scenario: 创建新 Skill
- **WHEN** 用户在管理页面提交合法的新 skill 表单
- **THEN** 系统 SHALL 创建数据库记录并在列表中展示该 skill

#### Scenario: 编辑已有 Skill
- **WHEN** 用户修改已有 skill 的标题、描述、内容或状态并保存
- **THEN** 系统 SHALL 更新数据库记录并展示最新内容

#### Scenario: 表单校验失败
- **WHEN** 用户提交缺少必填字段或名称非法的表单
- **THEN** 系统 SHALL 阻止保存并展示字段级错误或明确错误说明

### Requirement: 通用 Skill Editor
系统 SHALL 提供通用 skill editor 组件，用于创建、编辑、聊天生成和聊天调整 skill 的正文编辑。

#### Scenario: 自由编辑正文
- **WHEN** 用户在 skill editor 中修改文本
- **THEN** 系统 SHALL 保留用户输入并允许用户继续手动编辑或保存

#### Scenario: 选中文本出现 AI 改写入口
- **WHEN** 用户在 skill editor 中用鼠标选中一段非空文本
- **THEN** 系统 SHALL 在编辑器右上角展示用于 AI 改写该选区的小 icon 或按钮

#### Scenario: 输入提示词改写选区
- **WHEN** 用户点击 AI 改写入口并输入提示词
- **THEN** 系统 SHALL 基于提示词、选中文本和必要上下文生成替换候选文本

#### Scenario: 手动修改候选文本
- **WHEN** 系统生成候选文本后
- **THEN** 用户 SHALL 能在确认前手动编辑候选文本

#### Scenario: 重新生成候选文本
- **WHEN** 用户对候选文本不满意并输入新的提示词
- **THEN** 系统 SHALL 重新生成候选文本，且不得自动覆盖原文

#### Scenario: 确认回填选区
- **WHEN** 用户确认候选文本
- **THEN** 系统 SHALL 用候选文本替换原正文中的选中片段

#### Scenario: 取消选区改写
- **WHEN** 用户取消 AI 改写流程
- **THEN** 系统 SHALL 保持原正文不变

### Requirement: Skills 页面导航入口
系统 SHALL 在页面右上角提供进入 skills 管理页的入口，并保持与现有 workspace 入口一致的可达性。

#### Scenario: 从首页进入 Skills
- **WHEN** 用户访问首页
- **THEN** 系统 SHALL 在右上角展示进入 `/skills` 的链接

#### Scenario: 从聊天页进入 Skills
- **WHEN** 用户访问聊天页面
- **THEN** 系统 SHALL 在页面右上角或 header 操作区展示进入 `/skills` 的链接

### Requirement: 响应式管理体验
系统 SHALL 保证 skills 管理页面在桌面和移动视口中均可完成浏览、创建和编辑操作。

#### Scenario: 移动端管理 Skill
- **WHEN** 用户在移动视口打开 `/skills`
- **THEN** 系统 SHALL 以适配窄屏的布局展示列表和表单，且主要操作不被遮挡
