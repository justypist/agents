# Agents

## 手动准备数据库

```shell
docker exec -it postgres psql -U postgres -c "CREATE USER agents WITH PASSWORD 'agents';" -c "CREATE DATABASE agents OWNER agents;" -c "GRANT ALL PRIVILEGES ON DATABASE agents TO agents;"
```