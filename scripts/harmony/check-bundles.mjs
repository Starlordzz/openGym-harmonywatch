import { readdir, stat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function checkBundles(directory) {
  const root = resolve(directory), files = [], limit = 48 * 1024
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, item.name)
      if (item.isDirectory()) await visit(path)
      else if (item.name.endsWith('.js')) files.push({ path: relative(root, path), bytes: (await stat(path)).size })
    }
  }
  await visit(root)
  if (!files.some(file => file.path === 'app.js')) throw Error('Missing compiled app.js')
  const large = files.filter(file => file.bytes > limit)
  if (large.length) throw Error('Lite JS exceeds 49152 bytes: ' + large.map(file => file.path + ' (' + file.bytes + ')').join(', '))
  return files
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw Error('Usage: node check-bundles.mjs <compiled MainAbility directory>')
    for (const file of await checkBundles(process.argv[2])) console.log(file.path + ': ' + file.bytes + '/49152 bytes')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
