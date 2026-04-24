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

生产 compose 会同时启动应用容器和 exec 沙箱容器，沙箱镜像需先通过 build 步骤构建。生产镜像启动时会自动执行数据库迁移。

### exec 沙箱

`exec` 工具不会直接在应用容器内运行命令，而是通过挂载的 Docker socket 创建并复用一个持久容器。

- 默认容器名：`agents-exec-sandbox`
- 默认镜像：`agents-exec-sandbox:latest`
- 默认工作目录：`/workspace`
- 默认网络：`bridge`
- workspace volume：`agents-exec-workspace`
- home volume：`agents-exec-home`

沙箱镜像由 `Dockerfile.exec-sandbox` 构建，预装 Node.js Current、最新 pnpm、Python 3.14、uv、git、jq、sqlite3、build-essential 等常用工具。容器会被保留，系统或应用重启后会重新 `start`，因此容器 writable layer、`/workspace` 和 `/home/agent` 里的内容都会继续存在。需要调整镜像、网络或 volume 时，修改 `Dockerfile.exec-sandbox` 或 `config.ts` 里的 `execSandbox`，重新构建镜像，并删除旧沙箱容器让它按新配置重建：

```shell
docker rm -f agents-exec-sandbox
```

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
