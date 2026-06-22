#!/usr/bin/env bash
# Quick log viewer for TicketHub services

set -euo pipefail

cd "$(dirname "$0")"

SERVICE="${1:-}"
LINES="${2:-50}"

if [ -z "$SERVICE" ]; then
    echo "Usage: $0 <service-name> [lines]"
    echo ""
    echo "Available services:"
    docker compose ps --format "table {{.Service}}" | tail -n +2 | grep -v '^$' | sed 's/^/  /'
    echo ""
    echo "Examples:"
    echo "  $0 ticket-service        # last 50 lines"
    echo "  $0 notification-service 100"
    echo "  $0 kafka                 # check kafka health"
    echo "  $0 --all                 # all services"
    exit 1
fi

if [ "$SERVICE" == "--all" ]; then
    docker compose logs -f --tail="$LINES"
else
    docker compose logs -f --tail="$LINES" "$SERVICE"
fi
