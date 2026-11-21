#!/bin/sh
set -eu
root=$(git rev-parse --show-toplevel)
revision=$(git -C "$root" rev-parse HEAD)
out="$root/artifacts/hosted/$revision"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$out"
# Use committed source and graph assets. The archive never includes local provider state.
git -C "$root" archive -o "$stage/source.tar" "$revision" LICENSE mcp/hosted mcp/package.json mcp/package-lock.json \
  mcp/server.js mcp/http.js mcp/catalog.js mcp/query.js mcp/data-licenses plugins/loom-graph/server/data
tar -xf "$stage/source.tar" -C "$stage"
mv "$stage/plugins/loom-graph/server/data" "$stage/mcp/data"
cp "$stage/LICENSE" "$stage/mcp/"
npm --prefix "$stage/mcp" ci --include=dev --ignore-scripts --no-audit --no-fund
printf '{"revision":"%s"}\n' "$revision" > "$stage/mcp/release.json"
COPYFILE_DISABLE=1 tar -czf "$out/loom-graph-hosted.tgz" -C "$stage/mcp" .
node --input-type=module - "$out" <<'NODE'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const path = process.argv[2] + '/loom-graph-hosted.tgz'
const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
writeFileSync(path + '.sha256', digest + '\n')
console.log(path + '  sha256:' + digest)
NODE
