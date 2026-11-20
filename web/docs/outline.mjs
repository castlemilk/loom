// Produce a linked outline in the static HTML from the same headings that get permalinks.
export function docsOutline() {
  return tree => {
    const element = (tagName, properties, children) => ({ type: 'element', tagName, properties, children })
    const text = value => ({ type: 'text', value })
    const plain = node => node.type === 'text' ? node.value : (node.children ?? []).map(plain).join('')
    const body = tree.children.filter(node => node.type !== 'mdxjsEsm')
    const links = body.filter(node => node.tagName === 'h2' && node.properties?.id).map(node =>
      element('li', {}, [element('a', { href: '#' + node.properties.id }, [text(plain(node))])]))
    tree.children = tree.children.filter(node => node.type === 'mdxjsEsm')
    if (links.length) tree.children.push(element('nav', { className: ['docs-outline'], ariaLabel: 'On this page' }, [
      element('p', {}, [text('On this page')]), element('ul', {}, links),
    ]))
    tree.children.push(element('div', { className: ['docs-prose'] }, body))
  }
}
