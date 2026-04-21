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

## API

当前聊天页面路由：`/{agentId}/{sessionId}`

- 访问 `/` 会先跳转到 `/default`
- 访问 `/{agentId}` 会自动创建 session 并跳转到 `/{agentId}/{sessionId}`

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
