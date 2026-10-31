#!/usr/bin/env node
// The Lite device refuses any JS file over 48 KB (js_fwk_common.h FILE_CONTENT_LENGTH_MAX), and the
// previewer only warns, so a package that works in DevEco can still be a black screen on the watch.
// Run this after a RELEASE build; it fails the build instead of shipping a page that cannot load.
import { statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const limit = 1024 * 48
const files = process.argv.includes('--files')
  ? process.argv.slice(process.argv.indexOf('--files') + 1)
  : ['harmonywatch/entry/build/default/intermediates/loader_out_lite/default/js/MainAbility/app.js',
     'harmonywatch/entry/build/default/intermediates/loader_out_lite/default/js/MainAbility/pages/index/index.js']

let bad = 0
for (const file of files) {
  const path = resolve(root, file)
  let size
  try { size = statSync(path).size } catch { console.error('missing bundle: ' + file + ' (build release first)'); bad++; continue }
  const room = limit - size
  console.log((room < 0 ? 'OVER  ' : 'ok    ') + file + '  ' + size + ' / ' + limit + ' B' + (room < 0 ? '  (' + -room + ' B over)' : '  (' + room + ' B left)'))
  if (room < 0) bad++
}
if (bad) {
  console.error('A JS file is over the 48 KB the device will load. Drop a language in scripts/harmony/build-locales.mjs WATCH_LANGS or trim the page, then rebuild.')
  process.exit(1)
}
