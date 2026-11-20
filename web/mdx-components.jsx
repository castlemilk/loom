import { CodeFence, ExampleFile, InstallLoom } from './docs/code-block'
import { chapterURL } from './docs/catalog'
import { homeURL, studioURL } from './site'

function DocLink({ guide, children }) { return <a href={chapterURL(guide)}>{children}</a> }
function StudioLink({ path = '', children }) { return <a href={studioURL + path}>{children}</a> }
function AssetLink({ path, children }) { return <a href={homeURL + path}>{children}</a> }
function Heading({ id, children }) {
  return <h2 id={id}>{children}<a className="docs-permalink" href={'#' + id} aria-label={'Link to ' + id.replaceAll('-', ' ')}>#</a></h2>
}
const components = { h2: Heading, pre: CodeFence, ExampleFile, InstallLoom, DocLink, StudioLink, AssetLink }
export function useMDXComponents() { return components }
