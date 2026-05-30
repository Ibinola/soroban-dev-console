#!/usr/bin/env bash
# scripts/wave-branch-helper.sh
# DX-211: Branch and PR scaffolding helpers for Wave work.
#
# Usage:
#   bash scripts/wave-branch-helper.sh start <track> <id> <slug>
#     e.g. bash scripts/wave-branch-helper.sh start feat dx-201 wave-simulator
#
#   bash scripts/wave-branch-helper.sh pr <issue-numbers...>
#     e.g. bash scripts/wave-branch-helper.sh pr 376 377 378 379
#
# start: creates and checks out a consistently named branch
# pr:    prints a ready-to-paste gh pr create command with closing keywords

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
  echo "Usage:"
  echo "  bash $0 start <track> <id> <slug>"
  echo "  bash $0 pr <issue-number> [<issue-number> ...]"
  exit 1
}

cmd="${1:-}"
shift || true

case "$cmd" in
  start)
    track="${1:-}"
    id="${2:-}"
    slug="${3:-}"
    [[ -z "$track" || -z "$id" || -z "$slug" ]] && usage

    branch="${track}/${id}-${slug}"
    echo -e "${GREEN}Creating branch:${NC} $branch"
    git checkout main
    git pull origin main
    git checkout -b "$branch"
    echo -e "${GREEN}Done.${NC} You are now on branch: $branch"
    ;;

  pr)
    [[ $# -eq 0 ]] && usage

    branch=$(git rev-parse --abbrev-ref HEAD)
    closes=""
    for issue in "$@"; do
      closes+="Closes #${issue}"$'\n'
    done

    # Build a short title from the branch name
    title=$(echo "$branch" | sed 's|.*/||;s/-/ /g')

    echo ""
    echo -e "${YELLOW}Copy and run this to open the PR:${NC}"
    echo ""
    echo "gh pr create \\"
    echo "  --repo Ibinola/soroban-dev-console \\"
    echo "  --head \"$(git config user.login 2>/dev/null || echo YOUR_FORK):${branch}\" \\"
    echo "  --base main \\"
    echo "  --title \"${title}\" \\"
    printf "  --body \"\$(cat <<'EOF'\n%sEOF\n)\"\n" "$closes"
    ;;

  *)
    usage
    ;;
esac
