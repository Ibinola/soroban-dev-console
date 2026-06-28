# Debugging Helpers for Common Failures

## API won't start

```bash
# Check port conflicts
lsof -i :4000

# Check env file exists and is valid
npm run check-drift

# Check Prisma schema
cd apps/api && npx prisma validate && cd ../..
```

## Frontend build fails

```bash
# Clear Next.js cache
rm -rf apps/web/.next

# Verify TypeScript
npm run typecheck

# Check for dependency issues
npm run check-integrity
```

## Database migration errors

```bash
# Reset local DB
rm -f apps/api/dev.db apps/api/demo.db
cd apps/api && npx prisma db push && npx prisma db seed && cd ../..
```

## Contract tests fail

```bash
# Build contracts first
cargo build --manifest-path contracts/Cargo.toml

# Run specific contract tests
cargo test -p counter-fixture --manifest-path contracts/Cargo.toml
```

## CI jobs fail locally

Run the CI-equivalent command for the failing job:
- **Security**: `npm run security:scan`
- **DevOps**: `npm run check-drift && npm run check-integrity`
- **API**: `cd apps/api && npm run test && cd ../..`
- **Web**: `cd apps/web && npm run test:run && cd ../..`
- **Wave prep**: `npm run wave-prep`

## Common HTTP errors

| Error | Likely cause | Fix |
|-------|-------------|-----|
| 401 Unauthorized | Missing or invalid `x-owner-key` | Set the header to your workspace owner key |
| 403 Forbidden | Missing `x-verified-key` | Set the header to your verified identity key |
| 502 Bad Gateway | API not running or wrong URL | Run `npm run check-drift` to verify URLs |
| 504 Gateway Timeout | RPC endpoint unreachable | Check the RPC URL in your `.env` file |

## Logs and traces

```bash
# API logs (NestJS)
cd apps/api && npm run start:dev 2>&1 | tee api.log

# Frontend logs (Next.js)
cd apps/web && npm run dev 2>&1 | tee web.log

# Telemetry stack (Prometheus + Grafana)
bash scripts/telemetry-bootstrap.sh start
bash scripts/telemetry-bootstrap.sh logs
```
