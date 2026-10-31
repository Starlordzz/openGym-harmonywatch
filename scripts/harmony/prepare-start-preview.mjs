#!/usr/bin/env node
// Fresh storage only: the compiled app decides its own initial state. Never inject a phone snapshot.
import { cpSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const project = resolve(option('--project') || join(root, 'harmonywatch'))
const variant = option('--variant') || 'test-plan'
if (!['first-launch', 'test-plan'].includes(variant)) throw Error('--variant must be first-launch or test-plan')
const staged = readFileSync(join(project, 'entry/src/main/js/MainAbility/common/session.js'), 'utf8')
const builtin = staged.includes('ready: builtinReady()')
if (builtin !== (variant === 'test-plan')) throw Error('Build the matching test scenario before creating its preview')
const built = join(project, 'entry/build/default/intermediates/loader_out_lite/default/js/MainAbility')
const target = resolve(option('--out') || join(project, 'artifacts', 'startup-' + variant + '-bundle'))
cpSync(built, target, { recursive: true })
const appPath = join(built, 'app.js'), pagePath = join(built, 'pages/index/index.js')
const source = readFileSync(appPath, 'utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*/g, '').trim().replace(/;$/, '')
const appBytes = statSync(appPath).size, pageBytes = statSync(pagePath).size
if (appBytes > 49152 || pageBytes > 49152) throw Error('Production JS exceeds the 48 KB limit')
writeFileSync(join(target, 'app.js'), '(function(nativeModule){var saved="";' +
  'var requireNative=function(name){if(name==="system.storage")return {' +
  'get:function(o){o.success(saved)},set:function(o){saved=o.value;o.success()}};' +
  'return nativeModule(name)};return ' + source + '})(requireNative);\n')
writeFileSync(join(target, 'STARTUP_PREVIEW.json'), JSON.stringify({ variant, builtinPlan: builtin,
  initialStorage: '', phoneSnapshotInjected: false, previewStorageOnly: true, appBytes, pageBytes,
  compiledAppSha256: createHash('sha256').update(readFileSync(appPath)).digest('hex') }, null, 2) + '\n')
console.log('Fresh-start preview: ' + target + '\nNo phone snapshot or device storage changes; mode=' + variant)
