// Edit the initializer that owns a value. A computed collection remains an expression.
// This module runs alongside TypeScript inside the compiler worker.
export function rewriteGraphSource(ts, source, operations, profile, afterModule = false) {
  const graphType = "import('./notebook-types.js')." + (profile === 'studio' ? 'StudioGraph' : 'Notebook')
  // Some modules populate or overwrite their records after declaring the export.
  // Project those edits at the end, keeping the original binding available to its own code.
  if (afterModule) {
    const file = ts.createSourceFile('graph.ts', source, ts.ScriptTarget.Latest, true)
    let alias, declaration, local = 'graph', output = 'editedGraph'
    while (source.includes(output)) output += '_'
    for (const stmt of file.statements) {
      if (ts.isExportDeclaration(stmt) && !stmt.moduleSpecifier && stmt.exportClause && ts.isNamedExports(stmt.exportClause))
        alias ??= stmt.exportClause.elements.find(el => el.name.text === 'graph')
      if (ts.isVariableStatement(stmt) && stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
          stmt.declarationList.declarations.some(d => d.name.text === 'graph')) declaration = stmt
    }
    if (alias) {
      local = alias.propertyName?.text ?? 'graph'
      source = source.slice(0, alias.getStart(file)) + output + ' as graph' + source.slice(alias.end)
    } else if (declaration) {
      const keyword = declaration.modifiers.find(m => m.kind === ts.SyntaxKind.ExportKeyword)
      const names = []
      function collect(name) {
        if (ts.isIdentifier(name)) names.push(name.text)
        else for (const el of name.elements) if (el.name) collect(el.name)
      }
      for (const d of declaration.declarationList.declarations) collect(d.name)
      source = source.slice(0, keyword.getStart(file)) + source.slice(keyword.end).replace(/^ /, '') +
        '\nexport { ' + [output + ' as graph', ...names.filter(n => n !== 'graph')].join(', ') + ' }\n'
    } else throw Error('Export a local graph value to edit it visually.')
    source += '\nconst ' + output + ': ' + graphType + ' = { ...' + local + ', nodes: ' + local + '.nodes, links: ' +
      local + '.links } as unknown as ' + graphType + '\n'
  }
  const key = name => name === '__proto__' ? '["__proto__"]' : /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
  function literal(value) {
    if (Array.isArray(value)) return '[' + value.map(literal).join(', ') + ']'
    if (value !== null && typeof value === 'object') {
      const fields = Object.entries(value).map(([name, item]) => key(name) + ': ' + literal(item))
      return fields.length ? '{ ' + fields.join(', ') + ' }' : '{}'
    }
    return JSON.stringify(value)
  }
  for (const op of operations) {
    const fields = Object.entries(op.changes ?? {})
    if (op.op.endsWith('.update') && !op.unset?.length && fields.length > 1) {
      for (const [name, value] of fields) source = rewrite(source, { ...op, changes:{ [name]:value } })
    } else source = rewrite(source, op)
  }
  return source

  function rewrite(text, op) {
    const file = ts.createSourceFile('graph.ts', text, ts.ScriptTarget.Latest, true)
    const vars = new Map(), types = new Map()
    let binding = 'graph'
    for (const stmt of file.statements) {
      if (ts.isVariableStatement(stmt)) for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          vars.set(decl.name.text, decl.initializer)
          if (decl.type) types.set(decl.name.text, decl.type.getText(file))
        }
      }
      if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) if (el.name.text === 'graph') binding = el.propertyName?.text ?? 'graph'
      }
    }
    function resolve(node, seen = new Set()) {
      if (!node || seen.has(node)) return
      seen.add(node)
      if (ts.isIdentifier(node) && vars.has(node.text)) return resolve(vars.get(node.text), seen)
      if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return resolve(node.expression, seen)
      return node
    }
    const property = (obj, name) => obj && ts.isObjectLiteralExpression(obj) && obj.properties.findLast(p =>
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.text === name)
    const valueOf = p => p && (p.initializer ?? p.name)
    const replace = (node, value) => text.slice(0, node.getStart(file)) + value + text.slice(node.end)
    const put = (node, list, item, multiline = false) => {
      const at = list.length ? list.end : node.getStart(file) + 1
      const comma = list.length && !list.hasTrailingComma ? ',' : ''
      const space = multiline ? '\n' + (/^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', node.getStart(file)) + 1))[0]) + '  ' : ' '
      return text.slice(0, at) + comma + space + item + (list.hasTrailingComma ? ',' : '') + text.slice(at)
    }
    function rows(expr, seen = new Set()) {
      const array = resolve(expr)
      if (!array || !ts.isArrayLiteralExpression(array) || seen.has(array)) return []
      seen.add(array)
      return array.elements.flatMap(el => ts.isSpreadElement(el) ? rows(el.expression, seen) : [resolve(el)])
    }
    const collection = op.op.startsWith('node.') ? 'nodes' : 'links'
    const action = op.op.split('.')[1]
    const root = vars.get(binding)
    const type = types.get(binding) ?? graphType
    if (!root) throw Error('The visual editor needs a local graph value, such as export const graph = makeGraph().')
    const graph = resolve(root), field = property(graph, collection)
    const expression = valueOf(field), array = resolve(expression)
    const matches = rows(expression).filter(row => {
      const id = valueOf(property(row, 'id'))
      return id && ts.isStringLiteralLike(id) && id.text === op.id
    })
    if (action === 'update' && matches.length === 1 && !op.unset?.length) {
      const [[name, value]] = Object.entries(op.changes)
      const row = matches[0], prop = property(row, name)
      if (!prop) return put(row, row.properties, key(name) + ': ' + literal(value))
      if (!row.properties.slice(row.properties.indexOf(prop) + 1).some(ts.isSpreadAssignment)) {
        if (name === 'metadata' && op.previousMetadata && prop.initializer && ts.isObjectLiteralExpression(prop.initializer)) {
          const obj = prop.initializer
          if (obj.properties.every(p => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && typeof p.name.text === 'string')) {
            const changed = Object.entries(value).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(op.previousMetadata[k]))
            const kept = obj.properties.filter(p => Object.hasOwn(value, p.name.text))
            if (kept.length === obj.properties.length && changed.every(([k]) => property(obj, k))) {
              // Work backwards to keep the original ranges and all surrounding comments intact.
              const edits = changed.map(([k, v]) => [property(obj, k), literal(v)]).sort(([a], [b]) => b.pos - a.pos)
              for (const [p, v] of edits) {
                const expr = p.initializer ?? p
                text = text.slice(0, expr.getStart(file)) + (p.initializer ? v : p.name.getText(file) + ': ' + v) + text.slice(expr.end)
              }
              return text
            }
            const replacement = new Map(changed)
            const fields = kept.map(p => {
              const k = p.name.text
              if (!replacement.has(k)) return p.getText(file)
              replacement.delete(k)
              return key(k) + ': ' + literal(value[k])
            })
            for (const [k, v] of replacement) fields.push(key(k) + ': ' + literal(v))
            return replace(obj, '{ ' + fields.join(', ') + ' }')
          }
        }
        if (ts.isPropertyAssignment(prop)) return replace(prop.initializer, literal(value))
        return replace(prop, prop.name.getText(file) + ': ' + literal(value))
      }
    }
    if (action === 'add' && array && ts.isArrayLiteralExpression(array) && expression === array) {
      return put(array, array.elements, literal(op.value), true)
    }
    function transform(list) {
      if (action === 'identify') return '(' + list + ').map((row, index) => ({ ...row, id: row.id ?? ' + literal(op.ids) + '[index] }))'
      if (action === 'detach') return '(' + list + ').filter(row => row.source !== ' + literal(op.id) + ' && row.target !== ' + literal(op.id) + ')'
      if (action === 'add') return '[...(' + list + '), ' + literal(op.value) + ']'
      const match = 'row.id === ' + literal(op.id)
      if (action === 'remove') return '(' + list + ').filter(row => !(' + match + '))'
      const changes = Object.entries(op.changes ?? {}).map(([k,v]) => key(k) + ': ' + literal(v))
      const omit = (op.unset ?? []).map((k,i) => key(k) + ': omitted' + i)
      if (omit.length) return '(' + list + ').map(row => { if (!(' + match + ')) return row; const { ' +
        omit.join(', ') + ', ...rest } = row; return { ' + ['...rest', ...changes].join(', ') + ' } })'
      return '(' + list + ').map(row => ' + match + ' ? { ' + ['...row', ...changes].join(', ') + ' } : row)'
    }
    if (field && ts.isPropertyAssignment(field)) {
      // A type annotation prevents a narrowed empty array or heterogeneous tuple from losing context.
      return replace(expression, transform('(' + expression.getText(file) + ' as ' + type + "['" + collection + "'])"))
    }
    return replace(root, '((base: ' + type + ') => ({ ...base, ' + collection + ': ' + transform('base.' + collection) +
      ' }))(' + root.getText(file) + ')')
  }
}

/** Check the evaluated module against the fields a person actually edited. Other computed fields may change. */
export function hasVisualEdits(graph, operations, previous) {
  const expected = { node:new Map(), link:new Map() }, anonymous = new Map()
  const linked = (row, fields) => Object.keys(fields).every(k => JSON.stringify(row[k]) === JSON.stringify(fields[k]))
  for (const op of operations) {
    const [entity, action] = op.op.split('.')
    if (action === 'identify') continue
    if (action === 'detach') {
      for (const [id, fields] of expected.link) {
        const before = previous?.links.find(row => row.id === id)
        if ([fields?.source ?? before?.source, fields?.target ?? before?.target].includes(op.id)) expected.link.set(id, null)
      }
      for (const key of anonymous.keys()) {
        const edge = JSON.parse(key)
        if (edge.source === op.id || edge.target === op.id) anonymous.delete(key)
      }
      continue
    }
    const table = expected[entity], id = op.id ?? op.value?.id
    if (action === 'add' && entity === 'link' && id == null) {
      const key = JSON.stringify(op.value)
      anonymous.set(key, (anonymous.get(key) ?? 0) + 1)
    } else if (action === 'remove') table.set(id, null)
    else {
      const fields = action === 'add' ? { ...op.value } : { ...table.get(id), ...op.changes }
      for (const key of op.unset ?? []) Object.defineProperty(fields, key, { value:undefined, enumerable:true, configurable:true })
      table.set(id, fields)
    }
  }
  for (const [entity, table] of Object.entries(expected)) {
    if (!table.size) continue
    const rows = new Map(graph[entity === 'node' ? 'nodes' : 'links'].map((row, i) => [row.id ?? '@link:' + i, row]))
    for (const [id, fields] of table) {
      const row = rows.get(id)
      if (fields === null ? !!row : !row || !linked(row, fields)) return false
    }
  }
  for (const [key, count] of anonymous) {
    const fields = JSON.parse(key), matches = row => linked(row, fields)
    if (graph.links.filter(matches).length < (previous?.links.filter(matches).length ?? 0) + count) return false
  }
  return true
}
