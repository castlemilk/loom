// The build prepends the locked TypeScript compiler and the example's actual SDK declarations.
// This worker only checks and emits code. The opaque playground frame owns execution.
const sourceName = '/graph.ts'
const contractName = '/preview.ts'
const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true, noLib: true, skipLibCheck: true, types: [] }
const files = new Map(Object.entries(notebookFiles))
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
self.onmessage = ({ data: { id, source, operations, profile, afterModule } }) => {
  try {
    if (operations) source = rewriteGraphSource(ts, source, operations, profile, afterModule)
    const expected = profile === 'studio' ? "import('loom-core').GraphData" : "import('./notebook-types.js').Notebook"
    const contract = "import { graph } from './graph.js'; const preview: " + expected + " = graph"
    if (files.get(contractName) !== contract) { files.set(contractName, contract); parsed.delete(contractName) }
    files.set(sourceName, source)
    parsed.delete(sourceName)
    program = ts.createProgram(['/lib.d.ts', sourceName, contractName], options, host, program)
    const entry = program.getSourceFile(sourceName)
    const error = program.getSyntacticDiagnostics(entry)[0] ?? program.getSemanticDiagnostics(entry)[0]
      ?? program.getSemanticDiagnostics(program.getSourceFile(contractName))[0]
    if (error) {
      const pos = error.file.getLineAndCharacterOfPosition(error.start)
      const location = error.file === entry ? 'Line ' + (pos.line + 1) + ', column ' + (pos.character + 1) + '. ' : 'Check the exported graph. '
      throw new Error(location + ts.flattenDiagnosticMessageText(error.messageText, ' '))
    }
    let code
    program.emit(entry, (name, text) => { if (name.endsWith('.js')) code = text })
    self.postMessage({ id, code, source })
  } catch (error) { self.postMessage({ id, error: error.message }) }
}
