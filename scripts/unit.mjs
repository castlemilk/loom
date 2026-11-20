import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
const suites = ['core','drilldown','editor','wires','atlas','wikipedia-images']
await build({
  entryPoints: suites.map(name => 'tests/' + name + '.test.ts'),
  outdir: '.test-build',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
})
const result = spawnSync(process.execPath, ['--test', ...suites.map(name => '.test-build/' + name + '.test.mjs')], { stdio: 'inherit' })
process.exitCode = result.status ?? 1
