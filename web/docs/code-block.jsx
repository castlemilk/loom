import { readExample } from './examples.mjs'
import { common, createLowlight } from 'lowlight'
import { CopyButton } from './copy-button'
import sdk from '../.generated/sdk-package.json'

const highlighter = createLowlight(common)
const languages = { ts: 'TypeScript', js: 'JavaScript', bash: 'Terminal', sh: 'Terminal', html: 'HTML', json: 'JSON', text: 'Plain text' }
function token(node, index) {
  if (node.type === 'text') return node.value
  return <span key={index} className={node.properties.className?.join(' ')}>{node.children.map(token)}</span>
}
function CodeBlock({ name, language, source }) {
  const code = source.trimEnd()
  const highlighted = highlighter.registered(language) ? highlighter.highlight(language, code).children.map(token) : code
  return <figure className="docs-code" data-language={language}>
    <figcaption><span>{name}</span><CopyButton name={name} /></figcaption>
    <pre tabIndex={0} aria-label={name}><code>{highlighted}</code></pre>
  </figure>
}
export function CodeFence({ children }) {
  const language = children.props.className?.replace('language-', '') ?? 'text'
  return <CodeBlock name={languages[language] ?? language} language={language} source={children.props.children} />
}
export function InstallLoom() {
  return <CodeBlock name="Terminal" language="bash" source={sdk.installCommands} />
}
export async function ExampleFile({ name }) {
  const source = await readExample(name)
  return <CodeBlock name={name} language={name.split('.').pop()} source={source} />
}
