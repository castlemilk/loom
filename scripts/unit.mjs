import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
await build({
  entryPoints: ['tests/core.test.ts'],
  outfile: '.test-build/core.test.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
})
const result = spawnSync(process.execPath, ['--test', '.test-build/core.test.mjs'], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
