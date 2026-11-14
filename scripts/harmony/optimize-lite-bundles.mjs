#!/usr/bin/env node
// Reuse the SDK's Terser; keep property names and ES5 syntax required by Lite bindings.
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleShape } from './check-lite-equivalence.mjs'
export async function optimizeBundles(project, sdk) {
  const require = createRequire(import.meta.url)
  const { minify } = require(join(resolve(sdk), 'js/build-tools/ace-loader/node_modules/terser/dist/bundle.min.js'))
  const loader = join(project, 'entry/build/default/intermediates/loader_out_lite/default/js/MainAbility')
  const packed = join(project, 'entry/build/default/intermediates/lite_source/default/assets/js/MainAbility')
  for (const name of ['app.js', 'pages/index/index.js']) {
    const source = await readFile(join(loader, name), 'utf8')
    if (source !== await readFile(join(packed, name), 'utf8')) throw Error('Compiled and packaged JS differ: ' + name)
    const result = await minify(source, { ecma: 5, compress: { unsafe: false }, mangle: false, format: { ecma: 5, comments: false } })
    if (!result.code) throw Error('Empty optimized bundle: ' + name)
    if (bundleShape(source) !== bundleShape(result.code)) throw Error('Optimized ViewModel changed: ' + name)
    for (const dir of [loader, packed]) await writeFile(join(dir, name), result.code)
    console.log(name + ': ' + Buffer.byteLength(source) + ' -> ' + Buffer.byteLength(result.code) + ' bytes')
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) throw Error('Usage: optimize-lite-bundles.mjs <project> <SDK openharmony>')
  await optimizeBundles(resolve(process.argv[2]), resolve(process.argv[3]))
}
