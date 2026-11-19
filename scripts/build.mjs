import { build } from 'esbuild'
const options = {
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
}
await build({ ...options, entryPoints: { index: 'src/index.ts', 'layout-worker': 'src/sim/worker.ts' } })
await build({ ...options, entryPoints: ['src/console.ts'], external: ['./index.js'] })
