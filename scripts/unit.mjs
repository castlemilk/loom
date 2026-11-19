import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
await build({
  entryPoints: ['tests/core.test.ts', 'tests/drilldown.test.ts', 'tests/editor.test.ts'],
  outdir: '.test-build',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
})
const result = spawnSync(process.execPath, ['--test', '.test-build/core.test.mjs', '.test-build/drilldown.test.mjs', '.test-build/editor.test.mjs'], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
