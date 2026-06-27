#!/usr/bin/env bash
# scripts/telemetry-bootstrap.sh
# DX-206 / DX-628: Local telemetry bootstrap helpers for debugging and ops work.
#
# Starts a minimal local observability stack (Prometheus + Grafana via Docker)
# that mirrors the metrics and logging shape expected by operations workflows.
#
# Usage:
#   bash scripts/telemetry-bootstrap.sh start   — start the stack
#   bash scripts/telemetry-bootstrap.sh stop    — stop the stack
#   bash scripts/telemetry-bootstrap.sh restart — restart the stack
#   bash scripts/telemetry-bootstrap.sh status  — show container status
#   bash scripts/telemetry-bootstrap.sh logs    — tail API container logs
#   bash scripts/telemetry-bootstrap.sh clean   — stop and remove volumes
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

compose() {
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    echo -e "${RED} Docker Compose not found.${NC}"
    echo "    Install Docker Desktop: https://docs.docker.com/get-docker/"
    exit 1
  fi
}

ensure_compose_file() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo -e "${YELLOW} Compose file not found. Generating minimal stack at: $COMPOSE_FILE${NC}"
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
      - prometheus-data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: "devlocal"
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_INSTALL_PLUGINS: "grafana-piechart-panel"
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
YAML

    cat > "$(dirname "$COMPOSE_FILE")/prometheus.yml" <<'YAML'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "api"
    static_configs:
      - targets: ["host.docker.internal:4000"]
    metrics_path: "/metrics"

  - job_name: "node"
    static_configs:
      - targets: ["host.docker.internal:9100"]
    metrics_path: "/metrics"
YAML
    echo -e "${GREEN} Compose file generated.${NC}"
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

  restart)
    ensure_compose_file
    echo "Restarting telemetry stack…"
    compose down
    compose up -d
    echo -e "${GREEN}Restarted.${NC}"
    compose ps
    ;;

  status)
    ensure_compose_file
    compose ps
    ;;

  logs)
    echo "Tracing telemetry container logs (Ctrl-C to stop)…"
    compose logs -f
    ;;

  clean)
    ensure_compose_file
    echo "Stopping and removing telemetry volumes…"
    compose down -v
    echo -e "${GREEN}Cleaned.${NC}"
    ;;

  help|*)
    echo ""
    echo "Usage: bash $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start   Start local Prometheus + Grafana"
    echo "  stop    Stop the stack"
    echo "  restart Restart the stack"
    echo "  status  Show container status"
    echo "  logs    Tail container logs"
    echo "  clean   Stop and remove volumes"
    echo ""
    ;;
esac
