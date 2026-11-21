#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
if [ "${1:-}" = --test ]; then
  unset LOOM_DEMO_ISSUER LOOM_DEMO_CLIENT_ID LOOM_DEMO_PROVIDER
fi

if [ -z "${LOOM_DEMO_ISSUER:-}" ] && [ "${LOOM_DEMO_PROFILE:-keycloak}" = keycloak ]; then
  port=${LOOM_DEMO_PORT:-7341}
  provider_port=${LOOM_DEMO_PROVIDER_PORT:-8180}
  case "$port$provider_port" in *[!0-9]*) echo 'Demo ports must be numeric.' >&2; exit 1;; esac
  realm_dir=$(mktemp -d)
  container=''
  stop_keycloak() {
    result=$?
    if [ -n "$container" ]; then
      if [ "$result" != 0 ] && [ "$result" != 130 ]; then docker logs --tail 15 "$container" >&2 || true; fi
      docker stop "$container" >/dev/null || true
    fi
    rm -f "$realm_dir/loom-realm.json"
    rmdir "$realm_dir"
  }
  trap stop_keycloak EXIT
  trap 'exit 130' INT TERM
  sed "s/127\.0\.0\.1:7341/127.0.0.1:$port/g" mcp/demo/loom-realm.json > "$realm_dir/loom-realm.json"
  container=$(docker run --rm --detach --cpus 2 --memory 1g --publish "127.0.0.1:$provider_port:8080" \
    --mount "type=bind,source=$realm_dir/loom-realm.json,target=/opt/keycloak/data/import/loom-realm.json,readonly" \
    quay.io/keycloak/keycloak:26.8.2 start-dev --import-realm)
  echo "Starting a temporary Keycloak realm on port ${provider_port}…"
fi
node mcp/demo/serve.mjs "$@"
