#!/usr/bin/env bash
# scripts/telemetry-bootstrap.sh
# DX-206: Local telemetry bootstrap helpers for audit and ops work.
#
# Starts a minimal local observability stack (Prometheus + Grafana via Docker)
# that mirrors the metrics and logging shape expected by operations workflows.
#
# Usage:
#   bash scripts/telemetry-bootstrap.sh start   — start the stack
#   bash scripts/telemetry-bootstrap.sh stop    — stop the stack
#   bash scripts/telemetry-bootstrap.sh status  — show container status
#   bash scripts/telemetry-bootstrap.sh logs    — tail API container logs
#
# Requirements:
#   - Docker and Docker Compose (docker compose v2 or docker-compose v1)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT/docker/telemetry/docker-compose.yml"

cmd="${1:-help}"

# ── Docker Compose wrapper ────────────────────────────────────────────────────
compose() {
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo -e "${RED}❌  Docker Compose not found.${NC}"
    echo "    Install Docker Desktop: https://docs.docker.com/get-docker/"
    exit 1
  fi
}

ensure_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo -e "${YELLOW}⚠️  Compose file not found. Generating minimal stack at: $COMPOSE_FILE${NC}"
    mkdir -p "$(dirname "$COMPOSE_FILE")"
    cat > "$COMPOSE_FILE" <<'YAML'
version: "3.9"
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "devlocal"
      GF_AUTH_ANONYMOUS_ENABLED: "true"
    restart: unless-stopped
YAML

    cat > "$(dirname "$COMPOSE_FILE")/prometheus.yml" <<'YAML'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "api"
    static_configs:
      - targets: ["host.docker.internal:4000"]
    metrics_path: "/metrics"
YAML
    echo -e "${GREEN}✅  Compose file generated.${NC}"
  fi
}

case "$cmd" in
  start)
    ensure_compose_file
    echo -e "${GREEN}Starting telemetry stack…${NC}"
    compose up -d
    echo ""
    echo -e "${GREEN}Telemetry stack running:${NC}"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana:    http://localhost:3001  (admin / devlocal)"
    echo ""
    echo "  Tail API logs: bash $0 logs"
    ;;

  stop)
    ensure_compose_file
    echo "Stopping telemetry stack…"
    compose down
    echo -e "${GREEN}Stopped.${NC}"
    ;;

  status)
    ensure_compose_file
    compose ps
    ;;

  logs)
    cd "$ROOT"
    echo "Tailing API process logs (Ctrl-C to stop)…"
    if [[ -f apps/api/logs/api.log ]]; then
      tail -f apps/api/logs/api.log
    else
      echo -e "${YELLOW}⚠️  No log file found at apps/api/logs/api.log${NC}"
      echo "    Start the API first: cd apps/api && npm run start:dev"
    fi
    ;;

  help|*)
    echo ""
    echo "Usage: bash $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start   Start local Prometheus + Grafana"
    echo "  stop    Stop the stack"
    echo "  status  Show container status"
    echo "  logs    Tail API logs"
    echo ""
    ;;
esac
