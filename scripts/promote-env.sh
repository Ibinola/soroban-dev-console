#!/usr/bin/env bash
# DEVOPS-209: Configuration promotion helper.
# Copies non-secret env vars from one profile's .env.example to a target .env file.
#
# Usage:
#   ./scripts/promote-env.sh <source-profile> <target-profile> [--app api|web] [--dry-run]
#
# Profiles: local | demo | ci
# The script never copies variables whose names contain KEY, SECRET, or TOKEN.

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Argument parsing ──────────────────────────────────────────────────────────
SOURCE_PROFILE="${1:-}"
TARGET_PROFILE="${2:-}"
APP_FILTER=""
DRY_RUN=false

shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) APP_FILTER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) error "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$SOURCE_PROFILE" || -z "$TARGET_PROFILE" ]]; then
  echo "Usage: $0 <source-profile> <target-profile> [--app api|web] [--dry-run]"
  echo "Profiles: local | demo | ci"
  exit 1
fi

VALID_PROFILES=("local" "demo" "ci")
for p in "$SOURCE_PROFILE" "$TARGET_PROFILE"; do
  if [[ ! " ${VALID_PROFILES[*]} " =~ " $p " ]]; then
    error "Unknown profile '$p'. Valid profiles: ${VALID_PROFILES[*]}"
    exit 1
  fi
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Profile → env file mappings ───────────────────────────────────────────────
# Source is always the .env.example (template); target is the live .env file.
declare -A API_TARGET=( [local]="apps/api/.env" [demo]="apps/api/.env.demo" [ci]="apps/api/.env.ci" )
declare -A WEB_TARGET=( [local]="apps/web/.env.local" [demo]="apps/web/.env.demo" [ci]="apps/web/.env.ci" )

API_EXAMPLE="apps/api/.env.example"
WEB_EXAMPLE="apps/web/.env.example"

# ── Promotion logic ───────────────────────────────────────────────────────────
promote_app() {
  local app="$1"          # api | web
  local example_rel="$2"  # relative path to .env.example
  local target_rel="$3"   # relative path to target .env file

  local example="$ROOT/$example_rel"
  local target="$ROOT/$target_rel"

  if [[ ! -f "$example" ]]; then
    warn "Example file not found: $example_rel — skipping $app"
    return
  fi

  info "Promoting $app: $example_rel → $target_rel"

  local promoted=0
  local skipped=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Pass through comments and blank lines unchanged
    if [[ "$line" =~ ^[[:space:]]*# || -z "$line" ]]; then
      $DRY_RUN || echo "$line" >> "$target"
      continue
    fi

    # Extract variable name
    var_name="${line%%=*}"

    # Skip secrets
    if [[ "$var_name" =~ (KEY|SECRET|TOKEN) ]]; then
      warn "  Skipping secret: $var_name"
      skipped=$((skipped + 1))
      continue
    fi

    if $DRY_RUN; then
      echo "  [would set] $line"
    else
      echo "$line" >> "$target"
    fi
    promoted=$((promoted + 1))
  done < "$example"

  info "  Promoted: $promoted vars, skipped (secrets): $skipped"
}

# ── Main ──────────────────────────────────────────────────────────────────────
$DRY_RUN && warn "DRY RUN — no files will be written."
info "Promoting config: $SOURCE_PROFILE → $TARGET_PROFILE"
echo ""

if [[ -z "$APP_FILTER" || "$APP_FILTER" == "api" ]]; then
  target_file="${API_TARGET[$TARGET_PROFILE]}"
  if ! $DRY_RUN; then
    mkdir -p "$(dirname "$ROOT/$target_file")"
    # Write header
    cat > "$ROOT/$target_file" <<EOF
# Promoted from $SOURCE_PROFILE → $TARGET_PROFILE by scripts/promote-env.sh
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# RUNTIME_MODE=$TARGET_PROFILE

EOF
  fi
  promote_app "api" "$API_EXAMPLE" "$target_file"
fi

echo ""

if [[ -z "$APP_FILTER" || "$APP_FILTER" == "web" ]]; then
  target_file="${WEB_TARGET[$TARGET_PROFILE]}"
  if ! $DRY_RUN; then
    mkdir -p "$(dirname "$ROOT/$target_file")"
    cat > "$ROOT/$target_file" <<EOF
# Promoted from $SOURCE_PROFILE → $TARGET_PROFILE by scripts/promote-env.sh
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# RUNTIME_MODE=$TARGET_PROFILE

EOF
  fi
  promote_app "web" "$WEB_EXAMPLE" "$target_file"
fi

echo ""
if $DRY_RUN; then
  info "Dry run complete. Re-run without --dry-run to apply."
else
  info "Promotion complete. Review the generated files and fill in any secrets manually."
  info "Then run: npm run check-drift"
fi
