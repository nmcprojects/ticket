#!/usr/bin/env bash
# TicketHub Dev Stack — lightweight startup script.
# Only essential services (no observability stack) to prevent OOM on laptops.
#
# Usage:
#   ./start-dev.sh              # start everything
#   ./start-dev.sh --build      # force rebuild images
#   ./start-dev.sh --logs       # start and tail logs
#   ./start-dev.sh --stop       # stop all services
#   ./start-dev.sh --down       # stop and remove volumes
#   ./start-dev.sh --status     # show running containers

set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-}" in
  --build)
    echo "Building and starting TicketHub dev stack..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    ;;
  --logs)
    echo "Starting and tailing logs..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    docker compose -f "$COMPOSE_FILE" logs -f
    ;;
  --stop)
    echo "Stopping TicketHub dev stack..."
    docker compose -f "$COMPOSE_FILE" stop
    ;;
  --down)
    echo "Stopping and removing TicketHub dev stack..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  --status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  "")
    echo "Starting TicketHub dev stack..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "Services starting. Key URLs:"
    echo "  Frontend:    http://localhost:5173"
    echo "  API Gateway: http://localhost:8080"
    echo "  Eureka:      http://localhost:8761"
    echo ""
    echo "Wait ~60s for all services to register, then:"
    echo "  curl http://localhost:8761/eureka/apps"
    ;;
  *)
    echo "Unknown option: $1"
    echo "Usage: $0 [--build|--logs|--stop|--down|--status]"
    exit 1
    ;;
esac
