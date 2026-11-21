import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { transform } from 'esbuild'
import ts from 'typescript'

export async function prepareNotebook() {
  const local = path => new URL(path, import.meta.url)
  const tsLib = new URL('./', import.meta.resolve('typescript'))
  const libraries = new Map()
  async function addLibrary(name) {
    if (libraries.has(name)) return
    const source = await readFile(new URL('lib.' + name + '.d.ts', tsLib), 'utf8')
    libraries.set(name, source.replace(/^\/\/\/ <reference[^\n]*$/gm, ''))
    for (const ref of ts.preProcessFile(source).libReferenceDirectives) await addLibrary(ref.fileName)
  }
  await addLibrary('es2022')
  const [compiler, worker, types, sdkTypes, license] = await Promise.all([
    readFile(new URL('typescript.js', tsLib), 'utf8'), readFile(local('notebook-compiler.worker.js'), 'utf8'),
    readFile(local('../docs/examples/notebook-types.ts'), 'utf8'), readFile(local('../dist/types.d.ts'), 'utf8'),
    readFile(new URL('../LICENSE.txt', tsLib)),
  ])
  const files = { '/lib.d.ts': [...libraries.values()].join('\n'), '/notebook-types.ts': types, '/loom-core.d.ts': sdkTypes }
  const source = compiler + '\nconst notebookFiles = ' + JSON.stringify(files) + ';\n' + worker
  const { code } = await transform(source, { minify: true, target: 'es2022', legalComments: 'eof' })
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 16)
  const filename = 'notebook-' + hash + '.js'
  const dir = local('public/playground/')
  await writeFile(new URL(filename, dir), code)
  await writeFile(new URL('typescript-LICENSE.txt', dir), license)
  await writeFile(local('.generated/notebook-compiler.json'), JSON.stringify({ filename }))
  const examples = ['saturn.ts', 'cassini.ts', 'notebook-types.ts', 'mount-notebook.ts', 'notebook.html']
  const sources = await Promise.all(examples.map(async name => [name, await readFile(local('../docs/examples/' + name), 'utf8')]))
  await writeFile(local('.generated/notebook-sources.json'), JSON.stringify(Object.fromEntries(sources)))
  for (const old of await readdir(dir)) if (/^notebook-[a-f0-9]{16}\.js$/.test(old) && old !== filename) await unlink(new URL(old, dir))
}
