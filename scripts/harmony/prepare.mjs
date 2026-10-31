#!/usr/bin/env node
// Preserve the generated FA ability and toolchain. The bundled official SDK enables radio by default.
import { cp, mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configurePermissions } from './lite-config.mjs'
const args = process.argv.slice(2)
const get = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
if (!get('--project')) {
  console.error('Usage: node scripts/harmony/prepare.mjs --project <Lite project> [--bundle <watch bundle>] [--builtin-plan] [--offline] [--sdk <official SDK directory> --phone-package <Android applicationId> --phone-fingerprint <SHA256>]')
  process.exit(1)
}
const project = resolve(get('--project'))
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const template = join(root, 'frontend/harmony/watch/entry/src/main')
const sdk = args.includes('--offline') ? null : get('--sdk') ? resolve(get('--sdk')) : join(template, 'js/default/vendor')
let identity = {}
try {
  identity = JSON.parse(await readFile(join(root, 'harmonywatch/phone-debug-identity.json'), 'utf8'))
} catch {
  try { identity = JSON.parse(await readFile(join(root, 'harmonywatch/phone-debug-identity.example.json'), 'utf8')) } catch {}
}
if (project.startsWith(join(root, 'frontend/harmony/watch'))) throw Error('Use a separate DevEco-generated project')
const configFile = join(project, 'entry/src/main/config.json')
const config = JSON.parse(await readFile(configFile, 'utf8'))
if (!config.module?.deviceType?.includes('liteWearable')) throw Error('Target project must use liteWearable')
const bundle = get('--bundle') || config.app.bundleName
const validPackage = v => /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/.test(v || '')
if (!validPackage(bundle)) throw Error('Invalid watch bundle')
const phonePackage = get('--phone-package') || identity.phoneApplicationId, phoneFingerprint = (get('--phone-fingerprint') || identity.phoneCertificateSha256 || '').replaceAll(':', '').toUpperCase()
if (sdk) {
  if (!validPackage(phonePackage) || !/^[A-F0-9]{64}$/.test(phoneFingerprint)) throw Error('Provide actual phone package and certificate fingerprint with the SDK')
  await stat(join(sdk, 'wearengine.js'))
}
try { await stat(join(project, 'node_modules')); throw Error('Remove node_modules from the Lite project root') } catch (e) { if (e.code !== 'ENOENT') throw e }
const ability = config.module.abilities.find(a => a.type === 'page' && (!a.srcLanguage || a.srcLanguage === 'js'))
if (!ability) throw Error('Generated JS page ability required')
const js = config.module.js.find(j => j.name === ability.name)
if (!js) throw Error('Cannot match generated JS configuration to ability')
const source = ability.srcPath || js.name
if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(source)) throw Error('Unsafe generated srcPath')
const destination = join(project, 'entry/src/main/js', source)
config.app.bundleName = bundle
config.app.vendor = 'openGym'
js.pages = ['pages/index/index']
js.window = { ...(js.window || {}), designWidth: 408, autoDesignWidth: false }
configurePermissions(config.module, ability.name)
await cp(join(template, 'js/default'), destination, { recursive: true })
// Personal offline testing variant; leave the normal source/default state empty.
if (args.includes('--builtin-plan')) {
  const sessionFile = join(destination, 'common/session.js')
  const session = await readFile(sessionFile, 'utf8')
  if (!session.includes('ready: null')) throw Error('Cannot seed the built-in plan in this session source')
  await writeFile(sessionFile, "import { builtinReady } from './builtin-plan.js'\n" + session.replace('ready: null', 'ready: builtinReady()'))
}
await mkdir(join(project, 'entry/src/main/resources/base/media'), { recursive: true })
await cp(join(template, 'resources/base/media/icon.png'), join(project, 'entry/src/main/resources/base/media/icon.png'))
await cp(join(template, 'resources/base/media/icon_small.png'), join(project, 'entry/src/main/resources/base/media/icon_small.png'))
if (sdk) {
  if (resolve(sdk) !== resolve(join(destination, 'vendor'))) await cp(sdk, join(destination, 'vendor'), { recursive: true })
  await writeFile(join(destination, 'common/peer.js'), 'export default ' + JSON.stringify({ phonePackage, phoneFingerprint }) + '\n')
} else {
  // A real offline build. No SDK impersonation or successful radio callbacks are supplied.
  await writeFile(join(destination, 'common/runtime.js'), `import storage from '@system.storage'
import vibrator from '@system.vibrator'
import sensor from '@system.sensor'
import brightness from '@system.brightness'
import file from '@system.file'
import { createRuntime } from './controller.js'
export function runtime(changed, failure) {
  return createRuntime({ available: false, storage: storage, vibrator: vibrator, sensor: sensor, brightness: brightness,
    remove: function(uri) { file.delete({ uri: uri, fail: function() {} }) },
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval }, changed, failure)
}
`)
}
const stringsFile = join(project, 'entry/src/main/resources/base/element/string.json')
const strings = JSON.parse(await readFile(stringsFile, 'utf8'))
const label = (ability.label || '').replace('$string:', '')
for (const row of strings.string || []) if (row.name === label) row.value = 'openGym'
await writeFile(stringsFile, JSON.stringify(strings, null, 2) + '\n')
await writeFile(configFile, JSON.stringify(config, null, 2) + '\n')
console.log('Staged ' + relative(root, destination) + '; retained generated ability, SDK and build configuration.')
console.log(sdk ? 'Official SDK configured; sign and verify locally before installation.' : 'Offline build only: radio explicitly disabled until the official Wear Engine JS SDK and peer identity are configured.')
