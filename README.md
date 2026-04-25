# Agents

## docker

### build

```shell
docker compose -f compose.build.yaml build
```

### deploy

```shell
cp .env.example .env
docker compose -f compose.prod.yaml up -d
```

生产 compose 只启动应用容器。`exec` 直接在应用容器内运行命令，生产镜像启动时会自动执行数据库迁移。

### exec workspace

`exec` 工具在当前运行环境内执行命令，并将工作目录限制在持久 workspace 中。

- 默认工作目录：`/workspace`
- 本地默认目录：`.data/workspace`
- Docker 部署默认挂载：`/workspace`
- 可通过 `EXEC_WORKSPACE_PATH` 调整实际目录

生产镜像基于 Debian，容器以 root 用户运行，因此 exec 中可以直接使用 `apt install`。镜像预装 bash、Node.js、pnpm、Python 3、uv、git、jq、build-essential 等常用工具。

注意：`exec` 不是安全沙箱。命令会在应用容器内执行，能访问容器文件系统和进程环境；不要把该能力暴露给不受信任的用户或模型提示。

`compose.prod.yaml` 只挂载一个 exec 持久化卷到 `/persist`，启动时会把常用目录软链到其中，并通过环境变量把主流工具缓存指向 `/persist`：

- `/workspace`：agent 工作区，独立持久化
- `/root` -> `/persist/home`：root home、CLI 配置和用户级缓存
- `/opt/agents/bin` -> `/persist/bin`：exec 下载的可执行文件，已加入 `PATH`
- `/opt/agents/tools` -> `/persist/tools`：exec 下载的工具目录
- `/var/cache/apt`、`/var/lib/apt/lists` -> `/persist/apt/*`：apt 下载缓存和索引
- npm、pnpm、pip、uv、cargo、rustup、go、composer、maven、gradle、dotnet、playwright、huggingface 等缓存和全局工具目录会落到 `/persist/*`

注意：apt 安装到系统目录的文件属于容器 writable layer，容器不重建时会保留；如果重新创建容器，通常需要重新执行 `apt install`，但会复用已缓存的 apt 包和索引，避免重复下载。

## API

当前聊天页面路由：`/{agentId}/{sessionId}`

- 访问 `/` 会先跳转到 `/default`
- 访问 `/{agentId}` 会在请求时创建新 session，再跳转到 `/{agentId}/{sessionId}`

### Create Session

直接调用 API 时，需要先创建 session：

```shell
curl -X POST 'http://localhost:3000/api/competitive-intelligence/sessions'
```

返回示例：

```json
{
  "agentId": "competitive-intelligence",
  "sessionId": "...",
  "chatPath": "/competitive-intelligence/...",
  "apiPath": "/api/competitive-intelligence/..."
}
```

推荐直接使用 `useChat` 调用会话 API：

```ts
import { useChat } from '@ai-sdk/react' 
import { DefaultChatTransport } from 'ai';


const { messages } = useChat({
  id: sessionId,
  transport: new DefaultChatTransport({
    api: `/api/competitive-intelligence/${sessionId}`,
  }),
});
```

### API 请求格式

```shell
curl -N \
-X POST 'http://localhost:3000/api/competitive-intelligence/<sessionId>' \
-H 'Content-Type: application/json' \
-d '{
  "id": "<sessionId>",
  "messages": [
    {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "c–met当前管线，有哪些公司，分别在什么进展"
        }
      ]
    }
  ]
}' > docs/competitive-intelligence.jsonl
```

### API响应格式

https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message
