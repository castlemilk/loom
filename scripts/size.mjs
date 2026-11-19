import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
let total = 0
for (const file of ['index', 'layout-worker']) {
  const bytes = gzipSync(await readFile(new URL('../dist/' + file + '.js', import.meta.url)), {
    level: 9,
  }).length
  console.log(file + '.js: ' + bytes + ' bytes min+gzip')
  total += bytes
}
console.log('Core including optional worker: ' + total + ' / 25000 bytes')
if (total > 25000) process.exitCode = 1
