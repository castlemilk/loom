import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dependencyNotices, writeInstallers } from '../mcp/distribution.mjs'

const root = new URL('../', import.meta.url)
const data = new URL('mcp/data/', root)
const wiki = new URL('web/public/examples/wikispeedia/', root)
await mkdir(data, { recursive: true })
const manifest = JSON.parse(await readFile(new URL('manifest.json', wiki), 'utf8'))
const { nodes, edges } = JSON.parse(await readFile(new URL('demo/knowledge.json', root), 'utf8'))
const app = await build({ absWorkingDir: fileURLToPath(root), entryPoints: ['mcp/app/app.js'], write: false,
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, metafile: true })
const shell = await readFile(new URL('mcp/app/index.html', root), 'utf8')
await Promise.all([
  writeFile(new URL('graph-browser-NOTICES.txt', data), await dependencyNotices(app.metafile.inputs)),
  writeFile(new URL('graph-browser.html', data), shell.replace('<script src="app.js"></script>',
    () => '<script>' + app.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>')),
  build({ entryPoints: [fileURLToPath(new URL('src/explore.ts', root))], outfile: fileURLToPath(new URL('explore.js', data)), bundle: true, format: 'esm' }),
  writeFile(new URL('knowledge.json', data), JSON.stringify({ nodes, links: edges })),
  copyFile(new URL('demo/atlases/bauhaus.json', root), new URL('bauhaus.json', data)),
  copyFile(new URL('demo/atlases/outer-solar-system.json', root), new URL('outer-solar-system.json', data)),
  copyFile(new URL('manifest.json', wiki), new URL('wikispeedia-manifest.json', data)),
  copyFile(new URL(manifest.full, wiki), new URL('wikispeedia.json', data)),
  cp(new URL('evidence/', wiki), new URL('evidence/', data), { recursive: true }),
  copyFile(new URL('web/public/illustrations/graph-mcp.png', root), new URL('icon.png', data)),
  copyFile(new URL('LICENSE', root), new URL('mcp/LICENSE', root)),
])
const destination = process.argv[2]
if (destination) {
  const { resolve } = await import('node:path')
  await mkdir(destination, { recursive: true })
  await writeInstallers(resolve(destination))
  execFileSync('npm', ['pack', '--ignore-scripts', '--quiet', '--pack-destination', resolve(destination)],
    { cwd: new URL('mcp/', root), stdio: 'inherit' })
}
