# Publishing loom-core

Run these commands from the repository root with Node.js 22.14 or later, Task and the GitHub CLI. Sign in to GitHub with an account that can run the repository's workflows. The SDK uses the MIT license. [Install Task](https://taskfile.dev/docs/installation/) · [Install the GitHub CLI](https://cli.github.com/)

## Publish the first version

Start on the release commit pushed to `main`. From a fresh checkout, run `task setup` once.

```sh
task release:prepare
task release:login
task release:publish
task release:trust
task release:tag
```

1. **Prepare** finds the successful GitHub build for this commit or starts one. GitHub builds the SDK, checks its types, size and browser behavior, and installs the archive in a clean project. Task downloads the archive and verifies its SHA-512 checksum under `artifacts/npm/<commit>/`. [GitHub release runs](https://github.com/castlemilk/loom/actions/workflows/npm.yml)
2. **Login** opens npm's sign-in for the account that will own `loom-core`.
3. **Publish** uploads the verified archive to the public npm registry. Complete npm's authentication prompt. Task compares the public checksum with the GitHub archive and installs that exact version in a clean consumer. You can repeat the command after an interruption. A matching release goes straight to verification. A different archive under the same version stops the release.
4. **Trust** authorizes `castlemilk/loom` and its `npm.yml` workflow to publish future tags. Do this once. To configure it in the npm website, open the package's **Settings → Trusted publishers**, select GitHub Actions, enter the same repository and workflow, leave the environment empty and enable direct publishing. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
5. **Tag** pushes the package version prefixed with `v` (initially `v0.1.0`). GitHub checks that tag against the manifest, verifies the existing registry release and refreshes Studio. [Follow the release](https://github.com/castlemilk/loom/actions/workflows/npm.yml)

## Release the next version

On `main`, choose a version increment and commit both manifests. Push the release commit, then push its version tag through Task.

```sh
task release:version BUMP=patch
git add package.json package-lock.json
git commit -m "Bump the SDK patch version"
git push origin main
task release:tag
```

Use `BUMP=minor` or `BUMP=major` for larger changes. Stable versions publish under `latest`. Prerelease increments such as `BUMP=preminor` publish under `next`. GitHub publishes the tested archive with provenance and verifies a clean registry install before rebuilding the site.

## Rehearse or check a release

| Command | Result |
| --- | --- |
| `task check:all` | Checks the SDK and exercises Studio and the exported starter projects in Chromium. |
| `task release:check` | Builds a local archive in `artifacts/npm-local/`, checks a clean install and runs npm's publish dry run for an unpublished version. |
| `task release:status` | Shows availability on npm for the current version and recent release runs. |
| `task release:verify` | Compares the published checksum to the GitHub archive for this commit and installs the public package. |

When the registry archive matches the Studio build, Studio exports and the quickstart reference the exact npm version. Other builds use their revision-specific Pages archive. Previously downloaded projects keep their original dependency.
