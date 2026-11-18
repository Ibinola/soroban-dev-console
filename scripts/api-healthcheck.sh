#!/bin/sh
# #1411: container health check for the API image.
# Dockerfile usage:
#   HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
#     CMD ["/app/healthcheck.sh"]
set -e
URL="${HEALTHCHECK_URL:-http://localhost:${PORT:-3001}/health}"
wget -qO- --timeout=4 "$URL" >/dev/null 2>&1 || exit 1
