import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { hasVisualEdits, rewriteGraphSource } from '../web/notebook-rewrite.mjs'

const sample = name => readFileSync(new URL('../docs/examples/'+name+'.ts', import.meta.url),'utf8')
function value(source) {
  const {outputText,diagnostics} = ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
  assert.deepEqual(diagnostics.map(d=>d.messageText),[])
  return JSON.parse(runInNewContext(outputText+'\nJSON.stringify(exports.graph)',{exports:{}},{timeout:1000}))
}
test('a card drag changes only the two coordinate expressions in handwritten TypeScript', () => {
  const text = sample('saturn')
  assert.equal(rewriteGraphSource(ts,text,[{op:'node.update',id:'titan',changes:{x:-109.25,y:84}}]),text.replace('x: -143, y: 65','x: -109.25, y: 84'))
})
test('a metadata edit reaches the input to a computed link and a new connection preserves its mapping', () => {
  const text=sample('cassini'), probe={id:'probe',label:'Probe',kind:'Probe'}, edge={source:'titan',target:'probe',kind:'hosts'}
  const next=rewriteGraphSource(ts,text,[{op:'node.update',id:'titan',changes:{metadata:{'Targeted flybys':128}}},
    {op:'node.add',value:probe},{op:'link.add',value:edge}])
  const graph=value(next)
  assert.match(next,/moons\.map\(/)
  assert.deepEqual(graph.nodes.at(-1),probe)
  assert.deepEqual(graph.links.at(-1),edge)
  assert.match(graph.links[0].note,/128 targeted flybys/)
})
test('a frozen computed graph with an exported alias stays editable without mutating the original value', () => {
  const text="const make = () => Object.freeze({ nodes: [{id:'a', x:0}], links:[] }); const data = make(); export { data as graph }"
  const next=rewriteGraphSource(ts,text,[{op:'node.update',id:'a',changes:{x:4,y:-3}},{op:'link.add',value:{source:'a',target:'a'}}],'studio')
  assert.match(next,/const make = \(\) => Object.freeze/)
  assert.deepEqual(value(next),{ nodes:[{id:'a',x:4,y:-3}],links:[{source:'a',target:'a'}] })
})
test('empty arrays, literal text resembling code, and metadata keys round trip', () => {
  const record={id:'new',label:"A 'test'\n[]",metadata:JSON.parse('{"__proto__":{"ink":false}}')}
  const next=rewriteGraphSource(ts,'export const graph = { nodes: [], links: [] }',[{op:'node.add',value:record}],'studio')
  assert.deepEqual(value(next).nodes,[record])
})
test('editing one metadata field keeps calculations and comments on its siblings', () => {
  const text="const radius = 2; export const graph = { nodes: [{id:'a', metadata: { area: radius ** 2, /* note */ colour: 'blue' }}], links: [] }"
  const op={op:'node.update',id:'a',previousMetadata:{area:4,colour:'blue'},changes:{metadata:{area:4,colour:'green'}}}
  const next=rewriteGraphSource(ts,text,[op],'studio')
  assert.equal(next,text.replace("'blue'",'"green"'))
  assert.ok(hasVisualEdits(value(next),[op]))
})
test('late assignments project onto the final export and preserve the original binding and other named exports', () => {
  const base="export const graph = { nodes: [{id:'a', x:0}], links:[] }, title='Sketch'; graph.nodes[0].x=12"
  const aliased="const model = { nodes: [{id:'a', x:0}], links:[] }; export { model as graph }; model.nodes[0].x=12"
  const ops=[{op:'node.update',id:'a',changes:{x:42}}]
  for (const text of [base,aliased]) {
    assert.equal(hasVisualEdits(value(rewriteGraphSource(ts,text,ops,'studio')),ops),false)
    const written=rewriteGraphSource(ts,text,ops,'studio',true)
    assert.ok(hasVisualEdits(value(written),ops))
    if(text===base) assert.match(written,/as graph, title/)
  }
})
