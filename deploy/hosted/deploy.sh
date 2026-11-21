#!/bin/sh
set -eu
root=$(git rev-parse --show-toplevel)
revision=$(git -C "$root" rev-parse HEAD)
short=$(git -C "$root" rev-parse --short=12 HEAD)
archive="$root/artifacts/hosted/$revision/loom-graph-hosted.tgz"
tag="hosted-mcp-$revision"
repo=castlemilk/loom
namespace=loom-graph
kubeconfig="${LOOM_HA_KUBECONFIG:-$HOME/projects/paprika/terraform/omega-ha.kubeconfig}"
k() { kubectl --kubeconfig "$kubeconfig" --namespace "$namespace" "$@"; }
test "$(k config current-context)" = 'admin@vke-40ee226a-9fd0-43fc-9571-e4a44668098d'
printf 'Target %s / %s\n' "$(k config current-context)" "$namespace"
k get namespace "$namespace" --ignore-not-found
k get pipelines.pipelines.paprika.io
test "$(k auth can-i create pipelines.pipelines.paprika.io)" = yes
previous=$(k get deploy loom-graph --ignore-not-found -o jsonpath='{.spec.template.metadata.annotations.loom\.github\.io/source}')
printf 'Previous deployment %s\n' "${previous:-none}"
test "$(gh api "repos/$repo/commits/$revision" --jq .sha)" = "$revision"
checksum=$(node --input-type=module - "$archive" <<'NODE'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
console.log(createHash('sha256').update(readFileSync(process.argv[2])).digest('hex'))
NODE
)
test "$checksum" = "$(cat "$archive.sha256")"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
printf 'Tested Node.js runtime and public graph data for %s. Archive SHA-256 %s.\n' "$revision" "$checksum" > "$stage/notes"
if ! gh release view "$tag" --repo "$repo" > /dev/null 2>&1; then
  gh release create "$tag" "$archive" --repo "$repo" --target "$revision" --latest=false --title "Hosted Graph MCP · $short" --notes-file "$stage/notes"
fi
receipt=$(gh api "repos/$repo/releases/tags/$tag" --jq '.assets[] | select(.name=="loom-graph-hosted.tgz") | .digest')
test "$receipt" = "sha256:$checksum"
printf 'Verified GitHub release asset %s\n' "$receipt"
sed -e "s/__REVISION__/$revision/g" -e "s/__CHECKSUM__/$checksum/g" "$root/deploy/hosted/resources.yaml" > "$stage/resources.yaml"
sed -e "s/__REVISION__/$revision/g" -e "s/__SHORT__/$short/g" "$root/deploy/hosted/verify.yaml" > "$stage/verify.yaml"
if [ -z "$(k get namespace "$namespace" --ignore-not-found -o name)" ]; then
  k create namespace "$namespace"
fi
k apply --dry-run=server -f "$stage/resources.yaml" -f "$stage/verify.yaml" > /dev/null
k apply -f "$stage/resources.yaml"
k rollout status deployment/loom-graph --timeout=7m
k apply -f "$stage/verify.yaml"
k wait "pipeline.pipelines.paprika.io/release-$short" --for=jsonpath='{.status.phase}'=Succeeded --timeout=5m
generation=$(k get pipeline "release-$short" -o jsonpath='{.metadata.generation}')
test "$(k get pipeline "release-$short" -o jsonpath='{.status.observedGeneration}')" = "$generation"
printf 'Verified %s with Pipeline release-%s generation %s\n' "$revision" "$short" "$generation"
