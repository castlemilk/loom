#!/bin/sh
set -eu

revision=$1
destination=$2
archive=$3
repo=castlemilk/loom
workflow=npm.yml

# Reuse a successful dry run for this exact commit while its artifact is available.
run=$(gh run list --repo "$repo" --workflow "$workflow" --commit "$revision" --event workflow_dispatch \
  --branch main --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty')
if [ -n "$run" ]; then
  available=$(gh api "repos/$repo/actions/runs/$run/artifacts" --jq '[.artifacts[] | select(.name == "npm-package" and (.expired | not))] | length')
  if [ "$available" = 0 ]; then run=''; fi
fi
if [ -z "$run" ]; then
  remote=$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)
  if [ "$remote" != "$revision" ]; then
    echo "Push the release commit to main before preparing its GitHub archive." >&2
    exit 1
  fi
  url=$(gh workflow run "$workflow" --repo "$repo" --ref main)
  echo "$url"
  run=${url##*/}
  gh run watch "$run" --repo "$repo" --compact --exit-status
fi
source=$(gh run view "$run" --repo "$repo" --json headSha --jq .headSha)
if [ "$source" != "$revision" ]; then echo "The workflow built a different commit: $source" >&2; exit 1; fi

mkdir -p "$destination"
staging=$(mktemp -d "$destination/.download.XXXXXX")
trap 'rm -rf "$staging"' EXIT
gh run download "$run" --repo "$repo" --name npm-package --dir "$staging"
(cd "$staging" && shasum -a 512 -c SHA512SUMS)
mv "$staging/$archive" "$destination/$archive"
mv "$staging/SHA512SUMS" "$destination/SHA512SUMS"
echo "Verified $destination/$archive from https://github.com/$repo/actions/runs/$run"
