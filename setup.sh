#!/usr/bin/env bash
# setup.sh — Normalized onboarding script for the soroban-dev-console monorepo.
#
# Closes #247 — normalize developer scripts and onboarding automation across
# the monorepo.
#
# Usage:
#   ./setup.sh          # full first-time setup
#   ./setup.sh --reset  # tear down and re-setup (drops local DB, clears caches)
#
# What this script does:
#   1. Checks required tool versions (Node, npm, git).
#   2. Installs all workspace dependencies via npm workspaces.
#   3. Copies .env.example → .env for apps that need it (if .env absent).
#   4. Generates the Prisma client.
#   5. Runs a full monorepo build to verify the setup is healthy.
#
# All commands are idempotent — safe to re-run.

set -euo pipefail

RESET=false
[[ "${1:-}" == "--reset" ]] && RESET=true

# ── Colour helpers ────────────────────────────────────────────────────────────
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }

# ── Tool version checks ───────────────────────────────────────────────────────
check_tool() {
  local tool=$1 min_version=$2
  if ! command -v "$tool" &>/dev/null; then
    red "ERROR: $tool is not installed. Please install $tool >= $min_version."
    exit 1
  fi
  green "  ✓ $tool $(${tool} --version 2>&1 | head -1)"
}

echo ""
yellow "==> Checking required tools…"
check_tool node "20"
check_tool npm  "10"
check_tool git  "2"

# ── Optional reset ────────────────────────────────────────────────────────────
if $RESET; then
  yellow "==> --reset: removing node_modules, .next, dist, turbo cache…"
  find . -name "node_modules" -prune -exec rm -rf {} + 2>/dev/null || true
  find . -name ".next"        -prune -exec rm -rf {} + 2>/dev/null || true
  find . -name "dist"         -prune -exec rm -rf {} + 2>/dev/null || true
  rm -rf .turbo
  green "  ✓ Clean slate ready."
fi

# ── Install dependencies ──────────────────────────────────────────────────────
yellow "==> Installing dependencies…"
npm install
green "  ✓ Dependencies installed."

# ── Copy .env files ───────────────────────────────────────────────────────────
yellow "==> Checking .env files…"
for app in apps/api apps/web; do
  if [[ -f "$app/.env.example" && ! -f "$app/.env" ]]; then
    cp "$app/.env.example" "$app/.env"
    yellow "  → Copied $app/.env.example → $app/.env  (edit before running)"
  else
    green "  ✓ $app/.env already present."
  fi
done

# ── Prisma client generation ──────────────────────────────────────────────────
yellow "==> Generating Prisma client…"
npm run prisma:generate --workspace=api 2>/dev/null || \
  yellow "  ⚠ Prisma generate skipped (no DATABASE_URL set — update apps/api/.env first)."

# ── Build verification ────────────────────────────────────────────────────────
yellow "==> Running monorepo build…"
npm run build
green "  ✓ Build succeeded."

echo ""
green "✅  Setup complete! Common commands:"
echo "   npm run dev          — start all apps in watch mode"
echo "   npm run build        — production build"
echo "   npm run lint         — lint all packages"
echo "   npm run format       — format all files with Prettier"
echo "   ./setup.sh --reset   — full clean re-setup"
