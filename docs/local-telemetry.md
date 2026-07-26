# Local Telemetry Bootstrap

The telemetry bootstrap script (`scripts/telemetry-bootstrap.sh`) starts a minimal local Prometheus + Grafana stack so you can observe audit logs, metrics, and queue state with the same shape used in production operations.

## Requirements

- Docker Desktop (or Docker Engine + Compose plugin)

## Quick start

```bash
# Start Prometheus and Grafana
bash scripts/telemetry-bootstrap.sh start

# Open dashboards
open http://localhost:9090   # Prometheus
open http://localhost:3001   # Grafana (admin / devlocal)
```

## Commands

| Command | Effect |
|---|---|
| `start` | Start the stack in the background |
| `stop` | Stop and remove containers |
| `status` | Show running containers |
| `logs` | Tail API log file |

## What it starts

| Service | Port | Purpose |
|---|---|---|
| Prometheus | 9090 | Scrapes `/metrics` from the local API |
| Grafana | 3001 | Dashboards for audit and ops metrics |

The default Prometheus config scrapes `host.docker.internal:4000/metrics` every 15 seconds. Adjust `docker/telemetry/prometheus.yml` if you run the API on a different port.

## Grafana login

- Username: `admin`
- Password: `devlocal`
- Anonymous read access is also enabled for quick lookups.

## Connecting to the API

The API must expose a `/metrics` endpoint (NestJS + `@willsoto/nestjs-prometheus` or similar). If the API does not expose metrics, Prometheus will show a scrape error — this is non-blocking for dashboard work.

## Stopping

```bash
bash scripts/telemetry-bootstrap.sh stop
```
