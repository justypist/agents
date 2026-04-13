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
docker save agents:latest | ssh vps.56idc.fi 'docker load'
ssh vps.56idc.fi 'docker compose -f ~/.compose/agents/compose.yaml up -d'
```