# Agents

## docker

### build

```shell
docker compose -f compose.build.yaml build
```

### deploy

```shell
cp .env.example .env
docker compose -f compose.deploy.yaml up -d
```