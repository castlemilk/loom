// The build prepends the locked TypeScript compiler and the example's actual SDK declarations.
// This worker only checks and emits code. The opaque playground frame owns execution.
const sourceName = '/graph.ts'
const contractName = '/preview.ts'
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true, noLib: true, skipLibCheck: true, types: [] }
const files = new Map(Object.entries(notebookFiles))
files.set(contractName, "import { graph } from './graph.js'; import type { Notebook } from './notebook-types.js'; const preview: Notebook = graph")
const parsed = new Map()
const modules = new Map([['./graph.js', sourceName], ['./notebook-types.js', '/notebook-types.ts'], ['loom-core', '/loom-core.d.ts']])
const host = {
  getDefaultLibFileName: () => '/lib.d.ts', getCurrentDirectory: () => '/', getCanonicalFileName: file => file,
  useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  readFile: name => files.get(name), fileExists: name => files.has(name),
  getSourceFile(name) {
    if (!parsed.has(name) && files.has(name)) parsed.set(name, ts.createSourceFile(name, files.get(name), options.target, true))
    return parsed.get(name)
  },
  resolveModuleNames: names => names.map(name => modules.has(name) ? { resolvedFileName: modules.get(name) } : undefined),
  writeFile() {},
}
let program
self.onmessage = ({ data: { id, source } }) => {
  try {
    files.set(sourceName, source)
    parsed.delete(sourceName)
    program = ts.createProgram(['/lib.d.ts', sourceName, contractName], options, host, program)
    const entry = program.getSourceFile(sourceName)
    const error = program.getSyntacticDiagnostics(entry)[0] ?? program.getSemanticDiagnostics(entry)[0]
      ?? program.getSemanticDiagnostics(program.getSourceFile(contractName))[0]
    if (error) {
      const pos = error.file.getLineAndCharacterOfPosition(error.start)
      const location = error.file === entry ? 'Line ' + (pos.line + 1) + ', column ' + (pos.character + 1) + '. ' : 'Export a graph that matches Notebook. '
      throw new Error(location + ts.flattenDiagnosticMessageText(error.messageText, ' '))
    }
    let code
    program.emit(entry, (name, text) => { if (name.endsWith('.js')) code = text })
    self.postMessage({ id, code })
  } catch (error) { self.postMessage({ id, error: error.message }) }
}
