#!/usr/bin/env bash
#
# deploy.sh —— 首次建仓 + 推送，触发 GitHub Actions 部署到 GitHub Pages
#
# 为什么要有这个脚本：部署卡在"本机没有任何 GitHub 凭证"上，
# 而这一步必须由人完成登录。把登录之后的动作全部固化下来，
# 登录后只要跑一条命令，不必回忆参数（仓库名、可见性、推送分支）。
#
# 用法：
#   bash scripts/deploy.sh            # 仓库名取默认值 buyi
#   bash scripts/deploy.sh my-repo    # 或指定仓库名
#
set -euo pipefail

REPO="${1:-buyi}"
cd "$(dirname "$0")/.."

echo "==> 检查 GitHub 登录状态"
if ! gh auth status >/dev/null 2>&1; then
  cat <<'MSG'
✗ 尚未登录 GitHub。请先执行：

    gh auth login

（选择 GitHub.com → HTTPS → 用浏览器登录即可。登录是一次性的，之后本脚本可直接复用。）
MSG
  exit 1
fi
echo "✓ 已登录：$(gh api user --jq .login)"

echo "==> 检查工作区是否干净"
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ 有未提交的改动，请先提交："
  git status --short
  exit 1
fi
echo "✓ 工作区干净"

echo "==> 检查必需文件"
for f in .github/workflows/deploy.yml package.json package-lock.json \
         public/resume/宋建豪-简历.pdf public/favicon.svg; do
  [ -e "$f" ] || { echo "✗ 缺少必需文件：$f"; exit 1; }
done
echo "✓ 必需文件齐全"

echo "==> 本地构建 + 类型检查（推之前先证明能构建出来）"
npx tsc -b
npm run build
echo "✓ 构建通过"

echo "==> 创建仓库并推送（$REPO）"
if git remote get-url origin >/dev/null 2>&1; then
  echo "  已有 origin，直接推送：$(git remote get-url origin)"
  git push -u origin HEAD
else
  gh repo create "$REPO" --public --source=. --remote=origin --push
fi

OWNER="$(gh api user --jq .login)"
echo
echo "✓ 已推送。接下来："
echo "  1. 仓库 Settings → Pages → Source 选 “GitHub Actions”"
echo "     （若用 gh 命令行：gh api -X POST repos/$OWNER/$REPO/pages -f build_type=workflow）"
echo "  2. 等 Actions 跑完（约 1 分钟）"
echo "  3. 站点地址：https://$OWNER.github.io/$REPO/"
echo
echo "  查看部署进度：gh run watch --repo $OWNER/$REPO"
