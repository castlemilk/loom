import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createProcessor } from '@mdx-js/mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import { chapters, chapterFile } from './catalog.js'
import { readExample } from './examples.mjs'
import { publicMarkdown } from './public-markdown.mjs'
import { siteOrigin } from '../site.js'

const parser = createProcessor({ format: 'mdx' })
const text = value => ({ type: 'text', value })
const paragraph = (...children) => ({ type: 'paragraph', children })
const heading = (depth, title) => ({ type: 'heading', depth, children: [text(title)] })
const link = (url, children) => ({ type: 'link', url: String(url), children })

function moduleReference(index) {
  return index.modules.flatMap(mod => {
    const lines = mod.exports.flatMap(item => [
      ...(item.signatures ?? [item.kind + ' ' + item.name]),
      ...(item.methods ?? []).flatMap(method => method.signatures.map(signature => '  .' + signature)),
    ])
    return [heading(3, mod.name), { type: 'code', lang: 'text', value: lines.join('\n') }]
  })
}

// Convert the same parsed MDX used by the website. Example code comes from the package sources.
async function markdownChapter(chapter, site, index, installCommands) {
  const filename = chapter.slug || 'first-graph'
  const source = await readFile(new URL('./guides/' + filename + '.mdx', import.meta.url), 'utf8')
  const html = new URL('docs/' + (chapter.slug ? chapter.slug + '/' : ''), site)
  async function convert(node) {
    if (node.type === 'mdxjsEsm') return []
    const children = node.children && (await Promise.all(node.children.map(convert))).flat()
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const attrs = Object.fromEntries(node.attributes.map(a => [a.name, a.value]))
      const asLink = url => {
        const item = link(url, children)
        return node.type === 'mdxJsxFlowElement' ? paragraph(item) : item
      }
      switch (node.name) {
        case 'DocLink': return asLink(new URL('docs/' + chapterFile(attrs.guide), site))
        case 'StudioLink': return asLink(new URL('studio/' + (attrs.path || ''), site))
        case 'AssetLink': return asLink(new URL(attrs.path, site))
        case 'ExampleFile': return [
          paragraph({ type: 'inlineCode', value: attrs.name }),
          { type: 'code', lang: attrs.name.split('.').pop(), value: (await readExample(attrs.name)).trimEnd() },
        ]
        case 'ApiExplorer': return moduleReference(index)
        case 'InstallLoom': return { type: 'code', lang: 'bash', value: installCommands }
        case 'SignalPreview': return paragraph(link(html, [text('Try the interactive signal path')]))
        case 'CardPreview': return paragraph(link(new URL('#open-relationship-cards', html), [text('Try the relationship cards')]))
        case 'PerformancePreview': return paragraph(link(new URL('#watch-a-graph-draw-and-settle', html), [text('See live timing readings on your device')]))
        default: throw new Error('Add a Markdown representation for ' + node.name + ' in ' + filename)
      }
    }
    if (node.type === 'link') return link(new URL(node.url, html), children)
    return children ? { ...node, children } : node
  }
  const tree = await convert(parser.parse(source))
  tree.children.unshift(heading(1, chapter.title), paragraph(text(chapter.intro)),
    paragraph(link(html, [text('Open this chapter in Loom')])))
  return toMarkdown(tree, { bullet: '-', fences: true })
}

export async function writeAssistantDocs(publicDir, indexFile, installCommands) {
  const site = new URL((process.env.PAGES_BASE_PATH ?? '/loom') + '/', siteOrigin)
  const index = JSON.parse(await readFile(indexFile, 'utf8'))
  const pages = await Promise.all(chapters.map(async chapter => {
    const body = await markdownChapter(chapter, site, index, installCommands)
    const target = new URL('docs/' + chapterFile(chapter.slug), publicDir)
    await mkdir(new URL('./', target), { recursive: true })
    await writeFile(target, body)
    return body
  }))
  const publicPages = await publicMarkdown(site)
  await Promise.all(publicPages.map(async page => {
    const target = new URL(page.path + 'index.md', publicDir)
    await mkdir(new URL('./', target), { recursive: true })
    await writeFile(target, page.body)
  }))
  const connector = await readFile(new URL('../../mcp/README.md', import.meta.url), 'utf8')
  await mkdir(new URL('mcp/', publicDir), { recursive: true })
  await writeFile(new URL('mcp/index.md', publicDir), connector)
  const lines = ['# Loom SDK', '', '> Loom draws interactive graphs in WebGL2 and provides a headless, revision-checked graph editor.',
    '', 'These guides describe loom-core ' + index.version + '. The roadmap describes proposed additions.', '',
    '## Product and examples', '',
    ...publicPages.map(page => '- [' + page.title + '](' + new URL(page.path + 'index.md', site) + ')'), '']
  for (const group of new Set(chapters.map(c => c.group))) {
    lines.push('## ' + group, '')
    for (const c of chapters.filter(c => c.group === group)) lines.push('- [' + c.title + '](' + new URL('docs/' + chapterFile(c.slug), site) + ')')
    lines.push('')
  }
  lines.push('## Machine-readable reference', '',
    '- [Graph MCP server, tools and graph sources](' + new URL('mcp/index.md', site) + ')',
    '- [Public imports, types and controller methods](' + new URL('docs/api-index.json', site) + ')',
    '- [Editor transaction schema](' + new URL('editor.schema.json', site) + ')',
    '- [M2 Max benchmark samples and test conditions](' + new URL('benchmarks/m2-max.json', site) + ')',
    '- [All chapters with their code examples](' + new URL('llms-full.txt', site) + ')', '')
  await writeFile(new URL('llms.txt', publicDir), lines.join('\n'))
  await writeFile(new URL('llms-full.txt', publicDir), [...publicPages.map(page => page.body), ...pages, connector].join('\n---\n\n'))
}
