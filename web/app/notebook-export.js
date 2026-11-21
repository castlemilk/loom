import { projectCommands, starterManifest } from './export-project.mjs'
import { downloadFile } from './download-file'
import sources from '../.generated/notebook-sources.json'
import sdk from '../.generated/sdk-package.json'

export async function downloadNotebook(name, source, imageBase) {
  const { strToU8, zipSync } = await import('fflate')
  const files = {
    'notebook.ts': source, 'index.html': sources['notebook.html'], 'notebook-types.ts': sources['notebook-types.ts'],
    'mount-notebook.ts': sources['mount-notebook.ts'],
    'package.json': JSON.stringify(starterManifest('loom-orbital-notebook', sdk.dependency, true), null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['*.ts'] }, null, 2),
    'README.md': '# Orbital notebook\n\nUse Node.js 22.12 or newer. From this folder run\n\n```sh\n' + projectCommands +
      '\n```\n\nEdit notebook.ts and select a card to inspect its metadata. Put custom relative image files in public/images/. Absolute image URLs load from their original hosts. Run npm run build for a static site in dist/.\n',
  }
  const bytes = Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)]))
  await Promise.all(['saturn.webp', 'titan.webp', 'enceladus.webp', 'cassini.webp', 'CREDITS.md'].map(async file => {
    const res = await fetch(new URL(file, imageBase))
    if (!res.ok) throw new Error('Could not download ' + file + '. Try again.')
    bytes['public/images/' + file] = new Uint8Array(await res.arrayBuffer())
  }))
  downloadFile('loom-' + name + '.zip', zipSync(bytes, { level: 1 }), 'application/zip')
}
