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
NO_CACHE=0
MAX_LOCK_AGE_MIN=10  # auto-limpiar locks huerfanos mas viejos que esto
IMAGE="postgrado-frontend"
ROLLBACK_TAG="${IMAGE}:rollback"

# Parse args
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=1 ;;
    --no-cache) NO_CACHE=1 ;;
    --help|-h)
      echo "Uso: $0 [--skip-build] [--no-cache]"
      echo ""
      echo "  --skip-build   solo reinicia el contenedor, sin reconstruir"
      echo "  --no-cache     build sin cache de Docker (lento: ~15 min)."
      echo "                 Ya NO es el default: ver F-DEPLOY-BUILD-THEN-SWAP."
      echo ""
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
# log: escribe a stdout Y al log file persistente.
# Asi podemos auditar todos los deploys aunque la sesion SSH se cierre.
log()  {
  local msg="[$(date -u +%H:%M:%S)] $*"
  echo "$msg"
  echo "$msg" >> "$LOG"
}

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
  # F-DEPLOY-BUILD-THEN-SWAP: esta limpieza corre SOLO despues de que el
  # health check paso. Hasta ese momento la imagen anterior se conserva
  # etiquetada como :rollback, que es lo que permite volver atras.
  log "Limpiando imagenes huerfanas (el deploy ya esta verificado)..."
  # Soltar la etiqueta de rollback: la version nueva ya demostro que sirve.
  sudo docker rmi -f "$ROLLBACK_TAG" 2>/dev/null || true

  # Borrar las imagenes viejas DE ESTE PROYECTO, dejando la actual.
  #
  # OJO: este VPS es compartido — corre tambien el proyecto `oys` con sus
  # propios contenedores. Por eso NO se hace un barrido global de
  # `dangling=true`: borraria imagenes huerfanas ajenas y podria dejar al
  # otro proyecto sin su propio rollback. La limpieza se acota a las
  # imagenes de postgrado-frontend por ID, que es lo unico nuestro.
  local actual
  actual="$(sudo docker images "$IMAGE" --format '{{.ID}}' | head -1)"
  sudo docker images "$IMAGE" --format '{{.ID}}' \
    | grep -v "^${actual}$" \
    | xargs -r sudo docker rmi -f 2>/dev/null || true
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

    # =====================================================================
    # F-DEPLOY-BUILD-THEN-SWAP (2026-08-18, Kevin)
    # =====================================================================
    # ANTES este bloque hacia, EN ESTE ORDEN:
    #   1. borrar el contenedor kyc-frontend
    #   2. borrar la imagen postgrado-frontend
    #   3. recien ahi construir, con --no-cache
    #
    # Dos consecuencias graves:
    #   - Produccion quedaba caida durante TODO el build (~15 min medidos,
    #     754 s en un solo paso), no unos segundos.
    #   - Si el build fallaba no quedaba NADA para volver atras: ni
    #     contenedor ni imagen. Eso fue exactamente lo que dejo el sitio
    #     caido 50 minutos el 2026-08-18, cuando el workflow de GitHub
    #     Actions corto la sesion SSH y mato el build.
    #
    # AHORA se construye PRIMERO, con el contenedor viejo sirviendo, y
    # recien cuando hay una imagen nueva buena se hace el swap. Si el build
    # falla, produccion ni se entera. La imagen anterior se conserva
    # etiquetada como :rollback hasta que el health check del nuevo pase.
    # =====================================================================

    # Sync codigo
    log "1. SYNC CODIGO"
    cd "$FRONTEND_DIR"
    sudo git fetch origin +refs/heads/develop_kevin:refs/remotes/origin/develop_kevin
    log "  SHA remoto: $(sudo git rev-parse origin/develop_kevin)"
    sudo git checkout develop_kevin
    sudo git reset --hard origin/develop_kevin
    sudo git clean -fd
    log "  HEAD: $(sudo git log -1 --oneline)"

    # Build (produccion sigue arriba durante todo este paso)
    if [ "$SKIP_BUILD" -eq 0 ]; then
      # Guardar la imagen actual como rollback ANTES de construir.
      if sudo docker image inspect "${IMAGE}:latest" >/dev/null 2>&1; then
        sudo docker tag "${IMAGE}:latest" "$ROLLBACK_TAG"
        log "  Imagen actual etiquetada como $ROLLBACK_TAG"
      else
        log "  AVISO: no hay imagen previa; este deploy no tendra rollback"
      fi

      # El --no-cache dejo de ser el default: el build pasaba de ~2 min a
      # ~15 solo por rehacer npm install en cada deploy. `git reset --hard`
      # arriba ya garantiza codigo fresco, y Docker invalida las capas que
      # dependen de archivos modificados. Queda como opt-in (--no-cache)
      # para cuando haga falta un build realmente limpio.
      if [ "$NO_CACHE" -eq 1 ]; then
        log "2. BUILD sin cache (--no-cache): puede tardar ~15 min..."
        BUILD_ARGS="--no-cache"
      else
        log "2. BUILD con cache (produccion sigue arriba)..."
        BUILD_ARGS=""
      fi

      cd "$COMPOSE_DIR"
      # shellcheck disable=SC2086
      if ! sudo docker compose build $BUILD_ARGS frontend; then
        log "ERROR: el build fallo. NO se toca el contenedor en produccion."
        log "       El sitio sigue sirviendo la version anterior."
        exit 1
      fi
      log "  Build OK"
    else
      log "2. SKIP BUILD (--skip-build)"
    fi

    # Swap: recien ahora se baja el contenedor viejo. Esta es la unica
    # ventana de indisponibilidad, y dura segundos en vez de todo el build.
    log "3. SWAP (bajando el contenedor viejo y levantando el nuevo)"
    pre_cleanup_container || {
      log "ERROR: no se pudo limpiar el contenedor previo. Abortando."
      exit 1
    }

    cd "$COMPOSE_DIR"
    sudo docker compose up -d --no-deps --force-recreate frontend

    # Wait + verify
    sleep 3
    log "4. ESTADO FINAL"
    sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'kyc-frontend|NAMES' || true

    # Health check + rollback automatico
    # F-DEPLOY-BUILD-THEN-SWAP: si la imagen nueva construyo bien pero no
    # levanta (variable de entorno faltante, error en runtime, puerto
    # ocupado), antes quedaba el sitio caido y habia que arreglarlo a mano.
    # Ahora se vuelve sola a la imagen anterior.
    if ! healthcheck; then
      log "ERROR: la version nueva no respondio 200."
      if sudo docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
        log "ROLLBACK: volviendo a la imagen anterior..."
        sudo docker tag "$ROLLBACK_TAG" "${IMAGE}:latest"
        sudo docker rm -f kyc-frontend 2>/dev/null || true
        cd "$COMPOSE_DIR"
        sudo docker compose up -d --no-deps --force-recreate frontend
        if healthcheck; then
          log "ROLLBACK OK: el sitio volvio con la version anterior."
        else
          log "ROLLBACK FALLIDO: el sitio sigue caido. Intervencion manual."
        fi
      else
        log "Sin imagen de rollback disponible. Intervencion manual."
      fi
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
