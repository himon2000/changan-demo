#!/bin/zsh
cd "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  NODE_RUNNER="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  NODE_RUNNER="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  echo "请先安装 Node.js 18 或更新版本，再重新打开此文件。"
  read -k 1
  exit 1
fi
"$NODE_RUNNER" server.cjs --open
read -k 1
