# Hosted Graph MCP

The Pages browser client registers one exact callback, `https://castlemilk.github.io/loom/mcp/live/`. Loom Guest issues a five-minute access token for the public graphs after explicit consent. The service runs one Node process in the `loom-graph` namespace on omega-ha. Its SQLite volume preserves the signing identity, sessions, grants and consumed codes across restarts. [Public walkthrough](https://castlemilk.github.io/loom/mcp/live/) · [Service health and active source revision](https://loom-graph.apps.deephost.benebsworth.com/healthz)

From a clean, committed checkout with Node 22, Docker and the project dependencies installed, validate a release before publication.

```sh
task check:all
task mcp:test:oauth
task mcp:hosted:pack
node tests/mcp-hosted.mjs --archive "artifacts/hosted/$(git rev-parse HEAD)/loom-graph-hosted.tgz"
```

Push the checked commit to GitHub. Run `task mcp:hosted:deploy` with access to the management cluster and the GitHub repository. It publishes the tested archive under a commit-specific GitHub Release, compares GitHub’s SHA-256 receipt and applies the service through the HA kubeconfig. A fresh pod downloads that release, verifies its bytes and runs it under the pinned Node image. The deployment records the previous revision and waits for a Paprika Pipeline to verify the revision and public OAuth discovery. The first deployment provisions a 10 GiB block volume.

After the same commit reaches `main`, the existing Pages workflow publishes and tests the website. Run the complete public browser journey against a specific backend revision with `LOOM_EXPECTED_REVISION=$(git rev-parse HEAD) node tests/mcp-hosted.mjs --live`.

To restore an earlier deployment, use `kubectl --kubeconfig ~/projects/paprika/terraform/omega-ha.kubeconfig -n loom-graph rollout history deployment/loom-graph`, select the known-good revision, and run `rollout undo deployment/loom-graph --to-revision=NUMBER` with the same cluster and namespace. Verify the restored source at `/healthz` and repeat the public browser test.
