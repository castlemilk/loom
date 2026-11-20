# Publishing loom-core

The [npm release workflow](https://github.com/castlemilk/loom/actions/workflows/npm.yml) builds the SDK, runs the type, unit, size and browser checks, and installs the packed archive in a clean TypeScript project. The archive includes the worker, SQLite/WASM runtime, declarations, schemas and examples.

## Prepare the first release

Run the workflow on `main` using **Run workflow**. A manual run performs an npm dry run and attaches `npm-package` with the archive and its SHA-512 checksum. Download that artifact from the run page, or use the run ID with the GitHub CLI.

```sh
gh run download RUN_ID --repo castlemilk/loom --name npm-package --dir release
cd release
shasum -a 512 -c SHA512SUMS
```

## Publish the first version

Sign in to the npm account that should own `loom-core`. Complete the npm two-factor prompt and publish the checked archive from the download directory.

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish ./loom-core-0.1.0.tgz --access public --registry=https://registry.npmjs.org/
```

In the package's **Settings → Trusted publishers**, add GitHub Actions. Enter owner `castlemilk`, repository `loom` and workflow filename `npm.yml`. Leave the environment field empty and enable direct publishing with `npm publish`. GitHub will then authenticate with its workflow identity. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

Tag the exact commit shown on the successful dry run with `v0.1.0` and push the tag. The workflow recognizes the matching public archive, verifies a clean registry install and refreshes Pages. If npm already holds different bytes for the same version, the workflow stops and reports the conflict.

## Release another version

Update the version and lockfile together with `npm version patch --no-git-tag-version` (or choose a minor, major or prerelease version). Commit and push the change. Tag the release commit with the package version prefixed by `v` and push that tag.

```sh
version=$(node -p "require('./package.json').version")
git tag "v$version"
git push origin "v$version"
```

The tag must match the package version. Stable releases use the `latest` dist-tag. Prereleases use `next`. The publish job sends the tested tarball to npm and records provenance. Verification compares SHA-512 and installs that exact name and version before triggering a Studio rebuild.

Studio exports and the SDK quickstart use a registry version when its archive matches the Studio package byte for byte. For other builds, they use the Pages archive for that revision. Previously downloaded projects keep their original dependency.

If a publish is interrupted, rerun the workflow for the same tag. If a published release needs a fix, bump the version and release the correction. [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
