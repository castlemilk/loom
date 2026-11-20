import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Resolve re-exports and inferred controller methods exactly as a package consumer does.
const root = new URL('../', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const entries = Object.entries(pkg.exports).filter(([, entry]) => typeof entry === 'object' && entry.types)
const filename = entry => fileURLToPath(new URL(entry.types, root))
const program = ts.createProgram(entries.map(([, entry]) => filename(entry)), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, strict: true, skipLibCheck: true,
})
const checker = program.getTypeChecker()
const byName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0
const compact = node => node.getText().replace(/\s+/g, ' ').replace(/import\("\.\/[^"]+"\)\./g, '')
function signature(name, call, hasMethods = false) {
  const decl = call.getDeclaration()
  const generics = decl.typeParameters?.map(compact)
  // The method list below describes anonymous controller returns member by member.
  const result = decl.type && !(hasMethods && ts.isTypeLiteralNode(decl.type)) ? ': ' + compact(decl.type) : ''
  return name + (generics?.length ? '<' + generics.join(', ') + '>' : '') +
    '(' + decl.parameters.map(compact).join(', ') + ')' + result
}
function returnedMethods(calls) {
  const methods = new Map()
  for (const call of calls) for (const member of call.getReturnType().getProperties()) {
    const declaration = member.valueDeclaration ?? member.declarations?.[0]
    if (!declaration || program.isSourceFileDefaultLibrary(declaration.getSourceFile())) continue
    const signatures = checker.getTypeOfSymbolAtLocation(member, declaration).getCallSignatures()
    if (!signatures.length) continue
    const previous = methods.get(member.name) ?? []
    methods.set(member.name, [...new Set([...previous, ...signatures.map(s => signature(member.name, s))])])
  }
  return Array.from(methods, ([name, signatures]) => ({ name, signatures })).sort(byName)
}
const modules = entries.map(([subpath, entry]) => {
  const file = program.getSourceFile(filename(entry))
  const exports = []
  for (const symbol of checker.getExportsOfModule(checker.getSymbolAtLocation(file))) {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    if (target.getJsDocTags(checker).some(tag => tag.name === 'internal')) continue
    const name = symbol.getName(), flags = target.flags
    const kind = flags & ts.SymbolFlags.Class ? 'class' : flags & ts.SymbolFlags.Function ? 'function'
      : flags & ts.SymbolFlags.Value ? 'value' : 'type'
    const item = { name, kind }
    const summary = ts.displayPartsToString(target.getDocumentationComment(checker))
    if (summary) item.summary = summary
    if (kind === 'type') {
      const declaration = target.declarations?.find(d => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d))
      if (declaration) item.declaration = declaration.getText().replace(/^export /, '')
    }
    if (kind === 'function') {
      const calls = checker.getTypeOfSymbolAtLocation(target, file).getCallSignatures()
      const methods = returnedMethods(calls)
      item.signatures = calls.map(call => signature(name, call, methods.length > 0))
      if (methods.length) item.methods = methods
    }
    exports.push(item)
  }
  return { name: pkg.name + subpath.slice(1), declaration: entry.types.slice(2), exports: exports.sort(byName) }
})
const index = { formatVersion: 1, package: pkg.name, version: pkg.version, modules,
  assets: Object.entries(pkg.exports).filter(([, entry]) => typeof entry === 'string').map(([path]) => pkg.name + path.slice(1)) }
await writeFile(new URL('dist/api-index.json', root), JSON.stringify(index, null, 2) + '\n')
