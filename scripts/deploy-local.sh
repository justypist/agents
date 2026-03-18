#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
用法:
  pnpm deploy -- [options]

选项:
  --conn <value>              部署目标，格式: <user>@<host>:<port>:<compose_path>
  --registry <value>          覆盖默认镜像仓库主机
  --image-repository <value>  覆盖完整镜像仓库名，例如 ghcr.io/org/app
  --push-git                  执行 git push，默认关闭
  --push-image                推送镜像到远端 registry，默认关闭
  -h, --help                  显示帮助

默认行为:
  1. DEPLOY_CONN_STR 优先取 --conn，其次读取项目 .env
  2. SSH 直接使用本机默认配置、默认私钥或 ssh-agent
  3. 默认只构建本地镜像，并通过 SSH 传到远端 docker load
EOF
}

require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "缺少命令: ${command_name}"
  fi
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

parse_remote_host() {
  local remote_url="$1"

  case "${remote_url}" in
    git@*:* )
      printf '%s' "${remote_url#git@}" | cut -d ':' -f 1
      ;;
    ssh://* )
      local rest="${remote_url#ssh://}"
      rest="${rest#*@}"
      printf '%s' "${rest}" | cut -d '/' -f 1
      ;;
    http://* )
      local rest="${remote_url#http://}"
      printf '%s' "${rest}" | cut -d '/' -f 1
      ;;
    https://* )
      local rest="${remote_url#https://}"
      printf '%s' "${rest}" | cut -d '/' -f 1
      ;;
    * )
      fail "无法从 origin URL 解析仓库主机: ${remote_url}"
      ;;
  esac
}

parse_remote_repository() {
  local remote_url="$1"
  local repository=""

  case "${remote_url}" in
    git@*:* )
      repository="${remote_url#*:}"
      ;;
    ssh://* )
      local rest="${remote_url#ssh://}"
      rest="${rest#*@}"
      repository="${rest#*/}"
      ;;
    http://* )
      local rest="${remote_url#http://}"
      repository="${rest#*/}"
      ;;
    https://* )
      local rest="${remote_url#https://}"
      repository="${rest#*/}"
      ;;
    * )
      fail "无法从 origin URL 解析仓库路径: ${remote_url}"
      ;;
  esac

  printf '%s' "${repository%.git}"
}

parse_source_url() {
  local remote_url="$1"

  case "${remote_url}" in
    http://* | https://* )
      printf '%s' "${remote_url%.git}"
      ;;
    * )
      local host
      local repository
      host="$(parse_remote_host "${remote_url}")"
      repository="$(parse_remote_repository "${remote_url}")"
      printf 'https://%s/%s' "${host}" "${repository}"
      ;;
  esac
}

trim() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

unquote() {
  local value="$1"
  local first_char=""
  local last_char=""

  if [ "${#value}" -lt 2 ]; then
    printf '%s' "${value}"
    return
  fi

  first_char="${value:0:1}"
  last_char="${value: -1}"
  if { [ "${first_char}" = '"' ] && [ "${last_char}" = '"' ]; } || { [ "${first_char}" = "'" ] && [ "${last_char}" = "'" ]; }; then
    printf '%s' "${value:1:${#value}-2}"
    return
  fi

  printf '%s' "${value}"
}

read_dotenv_value() {
  local file_path="$1"
  local key="$2"
  local line=""
  local value=""

  if [ ! -f "${file_path}" ]; then
    return 1
  fi

  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "${file_path}" | tail -n 1 || true)"
  if [ -z "${line}" ]; then
    return 1
  fi

  value="${line#*=}"
  value="$(trim "${value}")"
  unquote "${value}"
}

push_git_refs() {
  local branch_name
  local exact_tags

  if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
    fail "工作区存在未提交变更，先提交后再执行部署"
  fi

  branch_name="$(git branch --show-current)"
  if [ -z "${branch_name}" ]; then
    fail "当前不在分支上，无法自动 git push"
  fi

  if git rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    log "推送分支到上游"
    git push
  else
    log "推送分支到 origin 并建立 upstream"
    git push -u origin "${branch_name}"
  fi

  exact_tags="$(git tag --points-at HEAD)"
  if [ -z "${exact_tags}" ]; then
    return
  fi

  while IFS= read -r tag_name; do
    if [ -z "${tag_name}" ]; then
      continue
    fi

    log "推送标签 ${tag_name}"
    git push origin "refs/tags/${tag_name}"
  done <<EOF
${exact_tags}
EOF
}

parse_deploy_target() {
  local deploy_conn_str="$1"
  local compose_path=""
  local deploy_rest=""
  local deploy_port=""
  local deploy_target=""
  local compose_dir=""
  local compose_file=""

  if [ -z "${deploy_conn_str}" ]; then
    fail "DEPLOY_CONN_STR 不能为空"
  fi

  compose_path="${deploy_conn_str##*:}"
  deploy_rest="${deploy_conn_str%:*}"
  deploy_port="${deploy_rest##*:}"
  deploy_target="${deploy_rest%:*}"

  if [ "${compose_path}" = "${deploy_conn_str}" ] || [ -z "${deploy_rest}" ]; then
    fail "DEPLOY_CONN_STR 格式错误，应为 <user>@<host>:<port>:<compose_path>"
  fi

  if [ -z "${deploy_target}" ] || [ -z "${deploy_port}" ] || [ -z "${compose_path}" ]; then
    fail "DEPLOY_CONN_STR 含有空字段"
  fi

  if ! printf '%s' "${deploy_target}" | grep -q '@'; then
    fail "DEPLOY_CONN_STR 中目标格式必须是 <user>@<host>"
  fi

  if ! printf '%s' "${deploy_port}" | grep -Eq '^[0-9]+$'; then
    fail "DEPLOY_CONN_STR 中端口必须为数字"
  fi

  case "${compose_path}" in
    *.yml|*.yaml)
      compose_dir="$(dirname "${compose_path}")"
      compose_file="$(basename "${compose_path}")"
      ;;
    *)
      compose_dir="${compose_path}"
      compose_file=""
      ;;
  esac

  printf '%s\n%s\n%s\n%s\n' \
    "${deploy_target}" \
    "${deploy_port}" \
    "${compose_dir}" \
    "${compose_file}"
}

build_image() {
  local source_url="$1"
  local revision="$2"
  local output_mode="$3"
  shift 2
  shift 1

  log "构建镜像"

  docker buildx build \
    --file ./Dockerfile \
    --label "org.opencontainers.image.source=${source_url}" \
    --label "org.opencontainers.image.revision=${revision}" \
    "${output_mode}" \
    "$@" \
    .
}

transfer_image() {
  local deploy_target="$1"
  local deploy_port="$2"
  local image_name="$3"

  log "传输本地镜像到远端"
  docker save "${image_name}" | ssh \
    -p "${deploy_port}" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${deploy_target}" \
    "docker load"
}

deploy_remote_from_registry() {
  local deploy_target="$1"
  local deploy_port="$2"
  local compose_dir="$3"
  local compose_file="$4"
  local image_name="$5"
  local remote_command=""

  if [ -n "${compose_file}" ]; then
    printf -v remote_command \
      "cd %q && IMAGE_NAME=%q docker compose -f %q pull && IMAGE_NAME=%q docker compose -f %q up -d" \
      "${compose_dir}" \
      "${image_name}" \
      "${compose_file}" \
      "${image_name}" \
      "${compose_file}"
  else
    printf -v remote_command \
      "cd %q && IMAGE_NAME=%q docker compose pull && IMAGE_NAME=%q docker compose up -d" \
      "${compose_dir}" \
      "${image_name}" \
      "${image_name}"
  fi

  log "执行远端部署"
  ssh \
    -p "${deploy_port}" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${deploy_target}" \
    "set -euo pipefail && ${remote_command}"
}

deploy_remote_from_local_image() {
  local deploy_target="$1"
  local deploy_port="$2"
  local compose_dir="$3"
  local compose_file="$4"
  local image_name="$5"
  local remote_command=""

  if [ -n "${compose_file}" ]; then
    printf -v remote_command \
      "cd %q && IMAGE_NAME=%q docker compose -f %q up -d --pull never" \
      "${compose_dir}" \
      "${image_name}" \
      "${compose_file}"
  else
    printf -v remote_command \
      "cd %q && IMAGE_NAME=%q docker compose up -d --pull never" \
      "${compose_dir}" \
      "${image_name}"
  fi

  log "使用远端本地镜像执行部署"
  ssh \
    -p "${deploy_port}" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    "${deploy_target}" \
    "set -euo pipefail && ${remote_command}"
}

parse_args() {
  local -n out_deploy_conn_str_ref="$1"
  local -n out_registry_ref="$2"
  local -n out_image_repository_ref="$3"
  local -n out_push_git_ref="$4"
  local -n out_push_image_ref="$5"

  shift 5

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --conn)
        shift
        [ "$#" -gt 0 ] || fail "--conn 缺少参数"
        out_deploy_conn_str_ref="$1"
        ;;
      --registry)
        shift
        [ "$#" -gt 0 ] || fail "--registry 缺少参数"
        out_registry_ref="$1"
        ;;
      --image-repository)
        shift
        [ "$#" -gt 0 ] || fail "--image-repository 缺少参数"
        out_image_repository_ref="$1"
        ;;
      --push-git)
        out_push_git_ref="true"
        ;;
      --push-image)
        out_push_image_ref="true"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "未知参数: $1"
        ;;
    esac

    shift
  done
}

main() {
  local input_deploy_conn_str=""
  local input_registry=""
  local input_image_repository=""
  local push_git="false"
  local push_image="false"
  local origin_url=""
  local repository_path=""
  local registry=""
  local image_repository=""
  local revision=""
  local short_sha=""
  local image_name=""
  local branch_name=""
  local source_url=""
  local deploy_conn_str=""
  local deploy_target=""
  local deploy_port=""
  local compose_dir=""
  local compose_file=""
  local -a build_tags=()
  local -a exact_tags=()
  local build_output_mode="--load"

  parse_args input_deploy_conn_str input_registry input_image_repository push_git push_image "$@"

  require_command git
  require_command docker
  require_command ssh

  origin_url="$(git remote get-url origin)"
  repository_path="$(lowercase "$(parse_remote_repository "${origin_url}")")"

  registry="${input_registry:-$(parse_remote_host "${origin_url}")}"
  registry="$(lowercase "${registry#https://}")"
  registry="$(lowercase "${registry#http://}")"
  if [ "${registry}" = "github.com" ]; then
    registry="ghcr.io"
  fi

  image_repository="${input_image_repository:-${registry}/${repository_path}}"

  revision="$(git rev-parse HEAD)"
  short_sha="$(printf '%s' "${revision}" | cut -c 1-12)"
  image_name="${image_repository}:sha-${short_sha}"
  branch_name="$(git branch --show-current)"
  source_url="$(parse_source_url "${origin_url}")"
  deploy_conn_str="${input_deploy_conn_str}"
  if [ -z "${deploy_conn_str}" ]; then
    deploy_conn_str="$(read_dotenv_value "${ROOT_DIR}/.env" "DEPLOY_CONN_STR" || true)"
  fi

  if [ "${push_git}" = "true" ]; then
    push_git_refs
  else
    log "跳过 git push"
  fi

  build_tags+=(--tag "${image_name}")
  if [ "${branch_name}" = "main" ]; then
    build_tags+=(--tag "${image_repository}:latest")
  fi

  mapfile -t exact_tags < <(git tag --points-at HEAD)
  for tag_name in "${exact_tags[@]}"; do
    if [ -n "${tag_name}" ]; then
      build_tags+=(--tag "${image_repository}:${tag_name}")
    fi
  done

  if [ "${push_image}" = "true" ]; then
    build_output_mode="--push"
  fi

  build_image "${source_url}" "${revision}" "${build_output_mode}" "${build_tags[@]}"

  mapfile -t deploy_parts < <(parse_deploy_target "${deploy_conn_str}")
  deploy_target="${deploy_parts[0]}"
  deploy_port="${deploy_parts[1]}"
  compose_dir="${deploy_parts[2]}"
  compose_file="${deploy_parts[3]}"

  if [ "${push_image}" = "true" ]; then
    deploy_remote_from_registry \
      "${deploy_target}" \
      "${deploy_port}" \
      "${compose_dir}" \
      "${compose_file}" \
      "${image_name}"
  else
    transfer_image \
      "${deploy_target}" \
      "${deploy_port}" \
      "${image_name}"
    deploy_remote_from_local_image \
      "${deploy_target}" \
      "${deploy_port}" \
      "${compose_dir}" \
      "${compose_file}" \
      "${image_name}"
  fi

  log "部署完成: ${image_name}"
}

main "$@"
