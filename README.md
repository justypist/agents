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

### transfer

```shell
docker save agents:latest | ssh master 'docker load'
ssh master 'docker compose -f ~/.compose/agents/compose.yaml up -d'
```