import { readFile } from 'node:fs/promises'
import path from 'node:path'

export function readExample(name) {
  if (!/^[\w-]+\.(ts|html|json)$/.test(name)) throw new Error('Unknown example file ' + name)
  return readFile(path.resolve(process.cwd(), '../docs/examples', name), 'utf8')
}
