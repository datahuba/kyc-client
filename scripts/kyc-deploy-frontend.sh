#!/bin/bash
# =============================================================================
# kyc-deploy-frontend.sh — Wrapper unificado para deploy del FRONTEND KYC.
#
# UBICACIÓN EN VPS: /usr/local/bin/kyc-deploy-frontend
# PERMISOS: 0755, root:root
#
# Usado por:
#   - GitHub Actions workflow (.github/workflows/deploy.yml)
#   - Deploys manuales SSH
#
# Características:
#   - Lock file con flock + timeout (15 min) -> GitHub Actions no se cuelga
#   - Cleanup automatico de imagenes huerfanas (kyc-frontend container conflict)
#   - Log persistente en /tmp/deploy-frontend.log (append) para auditoria
#   - trap para cleanup del container zombie en caso de error
#   - Health check al final: espera 30s a que kyc-frontend responda 200
#   - Auto-limpia locks huerfanos (>10 min sin uso) para evitar bloqueos
#
# Uso:
#   sudo /usr/local/bin/kyc-deploy-frontend                # deploy normal
#   sudo /usr/local/bin/kyc-deploy-frontend --skip-build   # solo restart sin rebuild
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
LOCK="/tmp/deploy-frontend.lock"
LOG="/tmp/deploy-frontend.log"
HEALTHCHECK_URL="http://127.0.0.1:3000/"
HEALTHCHECK_TIMEOUT=30
FLOCK_TIMEOUT="${FLOCK_TIMEOUT:-900}"  # 15 min default
FRONTEND_DIR="/root/postgrado/frontend"
COMPOSE_DIR="/root/postgrado"
SKIP_BUILD=0
MAX_LOCK_AGE_MIN=10  # auto-limpiar locks huerfanos mas viejos que esto

# Parse args
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=1 ;;
    --help|-h)
      echo "Uso: $0 [--skip-build]"
      echo "Variables de entorno:"
      echo "  FLOCK_TIMEOUT=segundos   (default 900 = 15 min)"
      exit 0
      ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log()  { echo "[$(date -u +%H:%M:%S)] $*"; }
log_to_file() { echo "[$(date -u +%H:%M:%S)] $*" >> "$LOG"; }

# -----------------------------------------------------------------------------
# Auto-clean locks huerfanos
# -----------------------------------------------------------------------------
# Si el lock existe, esta bloqueado por otro proceso, y tiene mas de X min,
# probablemente es un lock huerfano de un deploy que crasheo. Limpiamos.
cleanup_orphan_lock() {
  if [ ! -f "$LOCK" ]; then
    return 0
  fi
  # Si hay alguien usandolo, no hacer nada
  if fuser "$LOCK" 2>/dev/null; then
    return 0
  fi
  # Calcular edad
  local age_seconds
  age_seconds=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  local age_minutes=$(( age_seconds / 60 ))
  if [ "$age_minutes" -gt "$MAX_LOCK_AGE_MIN" ]; then
    log "WARN: lock huerfano detectado (${age_minutes} min sin uso). Auto-limpiando..."
    : > "$LOCK"  # truncate
    log "OK: lock huerfano limpiado"
  fi
}

# -----------------------------------------------------------------------------
# Pre-check: si hay container con el nombre que queremos, matarlo primero
# -----------------------------------------------------------------------------
# Esto evita el "Conflict. The container name '/kyc-frontend' is already in use"
# que pasa cuando un deploy anterior crashea y deja un container zombie.
pre_cleanup_container() {
  log "Pre-check: limpiando containers kyc-frontend zombies..."
  if sudo docker ps -a --format '{{.Names}}' | grep -q '^kyc-frontend$'; then
    log "  Container kyc-frontend existe. Deteniendo y removiendo..."
    sudo docker update --restart=no kyc-frontend 2>/dev/null || true
    sudo docker kill kyc-frontend 2>/dev/null || true
    sudo docker rm -f kyc-frontend 2>/dev/null || true
    sleep 1
  fi
  # Verificar
  if sudo docker ps -a --format '{{.Names}}' | grep -q '^kyc-frontend$'; then
    log "ERROR: kyc-frontend todavia existe despues del cleanup. Abortando."
    sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep kyc-frontend || true
    return 1
  fi
  log "  OK: no hay zombies"
}

# -----------------------------------------------------------------------------
# Cleanup imagenes huerfanas
# -----------------------------------------------------------------------------
cleanup_old_images() {
  log "Limpiando imagenes postgrado-frontend huerfanas..."
  # Borra todas las imagenes con tag latest que no sean la actual
  # (docker dangling = untagged)
  sudo docker images -f "dangling=true" -q | head -1 | xargs -r sudo docker rmi -f 2>/dev/null || true
  sudo docker images postgrado-frontend --format '{{.ID}}' | tail -n +2 | xargs -r sudo docker rmi -f 2>/dev/null || true
  log "  OK"
}

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
healthcheck() {
  log "Health check: esperando $HEALTHCHECK_TIMEOUT segundos a $HEALTHCHECK_URL..."
  local elapsed=0
  while [ "$elapsed" -lt "$HEALTHCHECK_TIMEOUT" ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$HEALTHCHECK_URL" 2>/dev/null | grep -q 200; then
      log "  OK: respondio 200 en ${elapsed}s"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  log "  ERROR: no respondio 200 despues de $HEALTHCHECK_TIMEOUT segundos"
  return 1
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
  log "=== INICIO DEPLOY FRONTEND $(date -u) ==="
  log "Triggered by: ${USER:-unknown} (PID $$)"

  # Auto-clean orphan lock antes de tomar el nuevo
  cleanup_orphan_lock || true

  # Lock file con flock + timeout
  log "Adquiriendo lock: $LOCK (timeout ${FLOCK_TIMEOUT}s)..."
  (
    flock -w "$FLOCK_TIMEOUT" 200 || {
      log "ERROR: no se pudo adquirir el lock en ${FLOCK_TIMEOUT}s. Otro deploy esta corriendo."
      exit 1
    }

    # Pre-cleanup container zombie
    pre_cleanup_container || {
      log "ERROR: pre-cleanup fallo. Abortando."
      exit 1
    }

    # Sync codigo
    log "1. SYNC CODIGO"
    cd "$FRONTEND_DIR"
    sudo git fetch origin +refs/heads/develop_kevin:refs/remotes/origin/develop_kevin
    log "  SHA remoto: $(sudo git rev-parse origin/develop_kevin)"
    sudo git checkout develop_kevin
    sudo git reset --hard origin/develop_kevin
    sudo git clean -fd
    log "  HEAD: $(sudo git log -1 --oneline)"

    # Build
    if [ "$SKIP_BUILD" -eq 0 ]; then
      log "2. BUILD (puede tardar 1-2 min)..."
      sudo docker rmi -f $(sudo docker images -q postgrado-frontend) 2>/dev/null || true
      cd "$COMPOSE_DIR"
      sudo docker compose build --no-cache frontend
    else
      log "2. SKIP BUILD (--skip-build)"
    fi

    # Up
    log "3. UP"
    cd "$COMPOSE_DIR"
    sudo docker compose up -d --no-deps --force-recreate frontend

    # Wait + verify
    sleep 3
    log "4. ESTADO FINAL"
    sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'kyc-frontend|NAMES' || true

    # Health check
    if ! healthcheck; then
      log "ERROR: health check fallo. Revisar logs."
      exit 1
    fi

    # Cleanup imagenes huerfanas
    cleanup_old_images || true

    log "=== DEPLOY COMPLETADO OK $(date -u) ==="
    log "SHA deployed: $(sudo git -C "$FRONTEND_DIR" rev-parse HEAD)"
  ) 200>"$LOCK"

  # Cleanup final del lock (en caso de que flock no lo haya liberado)
  : > "$LOCK" 2>/dev/null || true
}

main "$@"
