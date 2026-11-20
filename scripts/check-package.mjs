import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sdk from '../package.json' with { type: 'json' }
import { fileIntegrity } from './npm-registry.mjs'

const [spec, checkedArchive] = process.argv.slice(2)
if (!spec) throw new Error('Pass a package archive, URL, or exact npm package version')
const source = spec.startsWith('.') || (spec.endsWith('.tgz') && !spec.includes('://')) ? resolve(spec) : spec
const root = fileURLToPath(new URL('../', import.meta.url))
const cwd = await mkdtemp(join(tmpdir(), 'loom-package-'))
const run = (cmd, args) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })
const load = async path => JSON.parse(await readFile(path, 'utf8'))
try {
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: 'loom-consumer', private: true, type: 'module' }))
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=' + sdk.publishConfig.registry, source])
  const installed = join(cwd, 'node_modules', sdk.name)
  const manifest = await load(join(installed, 'package.json'))
  assert.equal(manifest.name, sdk.name)
  assert.equal(manifest.version, sdk.version)
  assert.equal(manifest.license, sdk.license)
  assert.deepEqual(await readFile(join(installed, 'LICENSE')), await readFile(join(root, 'LICENSE')))
  assert.equal(manifest.repository.url, sdk.repository.url)
  assert.deepEqual(manifest.exports, sdk.exports)
  const lock = (await load(join(cwd, 'package-lock.json'))).packages['node_modules/' + sdk.name]
  const archive = checkedArchive || (isAbsolute(source) && source)
  if (archive) assert.equal(lock.integrity, await fileIntegrity(archive), 'Installed archive must match the tested bytes')
  await copyFile(join(root, 'tests/public-api.ts'), join(cwd, 'consumer.mts'))
  await copyFile(join(root, 'tests/installed-agent-tools.mjs'), join(cwd, 'check-agent.mjs'))
  await copyFile(join(root, 'tests/installed-sdk.mjs'), join(cwd, 'check-sdk.mjs'))
  await cp(join(installed, 'docs/examples'), join(cwd, 'examples'), { recursive: true })
  const tsc = join(root, 'node_modules/typescript/bin/tsc')
  const flags = ['--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext']
  run(process.execPath, [tsc, ...flags, '--noEmit', 'consumer.mts'])
  const examples = (await readdir(join(cwd, 'examples'))).filter(name => name.endsWith('.ts')).map(name => join('examples', name))
  run(process.execPath, [tsc, ...flags, '--outDir', 'compiled', ...examples])
  run(process.execPath, ['check-sdk.mjs'])
  console.log('Installed and verified ' + sdk.name + '@' + sdk.version + ' (' + lock.integrity + ')')
} finally {
  await rm(cwd, { recursive: true, force: true })
}
