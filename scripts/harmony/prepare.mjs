#!/usr/bin/env node
// Preserve the generated FA ability and toolchain. The bundled official SDK enables radio by default.
// Two shapes ship from one template: the entry module is the rect HAP and an optional second module
// is the 466x466 circle HAP. AppGallery picks a module by module.distroFilter.screenShape.
import { cp, mkdir, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configurePermissions } from './lite-config.mjs'
import { keepForensics, stripForensics } from './strip-forensics.mjs'
const args = process.argv.slice(2)
const get = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
if (!get('--project')) {
  console.error('Usage: node scripts/harmony/prepare.mjs --project <Lite project> [--round-project <round module>] [--bundle <watch bundle>] [--offline] [--forensics] [--sdk <official SDK directory> --phone-package <Android applicationId> --phone-fingerprint <SHA256>]')
  process.exit(1)
}
const project = resolve(get('--project'))
const roundProject = get('--round-project') ? resolve(get('--round-project')) : null
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const template = join(root, 'frontend/harmony/watch/entry/src/main')
const sdk = args.includes('--offline') ? null : get('--sdk') ? resolve(get('--sdk')) : join(template, 'js/default/vendor')
const roundCssFile = join(template, 'js/default/pages/index/round.css')
const rectListHeight = 'style="height: {{todayName ? 76 : 220}}px"'
const roundListHeight = 'style="height: {{todayName ? 64 : 150}}px"'
const rectFitBox = 'var FIT = { ww: 104, wh: 72, uc: 88, rw: 160, rh: 72, sw: 272, sh: 82, ew: 280, eh: 132 }'
const roundFitBox = 'var FIT = { ww: 88, wh: 56, uc: 74, rw: 136, rh: 56, sw: 240, sh: 60, ew: 220, eh: 104 }'
let identity = {}
try {
  identity = JSON.parse(await readFile(join(root, 'harmonywatch/phone-debug-identity.json'), 'utf8'))
} catch {
  try { identity = JSON.parse(await readFile(join(root, 'harmonywatch/phone-debug-identity.example.json'), 'utf8')) } catch {}
}
if (project.startsWith(join(root, 'frontend/harmony/watch'))) throw Error('Use a separate DevEco-generated project')
if (roundProject && (roundProject === join(project, 'entry') || roundProject.startsWith(join(root, 'frontend/harmony/watch')))) throw Error('Use a separate module directory for --round-project')
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
for (const dir of [project, ...(roundProject ? [roundProject] : [])]) {
  try { await stat(join(dir, 'node_modules')); throw Error('Remove node_modules from the Lite project root: ' + relative(root, dir)) } catch (e) { if (e.code !== 'ENOENT') throw e }
}
const forensics = args.includes('--forensics')

// Each module owns its config.json but shares the portable template, icons, SDK and peer identity.
async function stage(moduleDir, options) {
  const file = join(moduleDir, 'src/main/config.json')
  try { await stat(file) } catch { throw Error('Missing module scaffold: ' + relative(root, file)) }
  const config = JSON.parse(await readFile(file, 'utf8'))
  if (!config.module?.deviceType?.includes('liteWearable')) throw Error(relative(root, file) + ': module.deviceType must include liteWearable')
  const ability = (config.module.abilities || []).find(a => a.type === 'page' && (!a.srcLanguage || a.srcLanguage === 'js'))
  if (!ability) throw Error(relative(root, file) + ': generated JS page ability required')
  const js = (config.module.js || []).find(j => j.name === ability.name)
  if (!js) throw Error(relative(root, file) + ': cannot match generated JS configuration to ability')
  const source = ability.srcPath || js.name
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(source)) throw Error('Unsafe generated srcPath')
  const destination = join(moduleDir, 'src/main/js', source)
  config.app.bundleName = bundle
  config.app.vendor = 'openGym'
  js.pages = ['pages/index/index']
  js.window = { ...(js.window || {}), designWidth: options.designWidth, autoDesignWidth: false }
  if (config.module.distro) config.module.distro.moduleName = options.moduleName
  config.module.distroFilter = { ...(config.module.distroFilter || {}), screenShape: { policy: 'include', value: [options.screenShape] } }
  configurePermissions(config.module, ability.name)
  if (sdk) {
    // Install-time peer trust complements the runtime setters (Wear Engine 206 FAQ).
    const value = phonePackage + ':' + phoneFingerprint
    if (value.length > 255) throw Error('Wear Engine supportLists exceeds 255 characters')
    const metadata = config.module.metaData || (config.module.metaData = {})
    const rows = metadata.customizeData || (metadata.customizeData = [])
    if (!Array.isArray(rows)) throw Error('module.metaData.customizeData must be an array')
    let peer = rows.find(row => row.name === 'supportLists')
    if (!peer) { peer = { name: 'supportLists' }; rows.push(peer) }
    Object.assign(peer, { value, extra: '' })
  }
  // Regenerate the page tree from the template so stale staging leftovers cannot leak into a module.
  await rm(destination, { recursive: true, force: true })
  await cp(join(template, 'js/default'), destination, { recursive: true })
  await rm(join(destination, 'common/rest-relay.js'), { force: true })
  if (options.round) {
    // Shape differences stay in staged CSS/HML and build-time fit constants: no runtime shape branches.
    const cssFile = join(destination, 'pages/index/index.css')
    const base = await readFile(cssFile, 'utf8')
    await writeFile(cssFile, base + (base.endsWith('\n') ? '\n' : '\n\n') + await readFile(roundCssFile, 'utf8'))
    const hmlFile = join(destination, 'pages/index/index.hml')
    const hml = await readFile(hmlFile, 'utf8')
    if (hml.split(rectListHeight).length !== 2) throw Error('Cannot locate the idle list height in index.hml')
    await writeFile(hmlFile, hml.replace(rectListHeight, roundListHeight))
    const jsFile = join(destination, 'pages/index/index.js')
    const pageJs = await readFile(jsFile, 'utf8')
    if (pageJs.split(rectFitBox).length !== 2) throw Error('Cannot locate the numeric fit box constants in index.js')
    await writeFile(jsFile, pageJs.replace(rectFitBox, roundFitBox))
  }
  // round.css is a build-time override; it must not appear in a staged module tree.
  await rm(join(destination, 'pages/index/round.css'), { force: true })
  // One template, two builds (scripts/harmony/strip-forensics.mjs): --forensics keeps the U13
  // exit-trace instrumentation, the normal build strips it back to the shipping bytes.
  const staged = ['app.js', 'pages/index/index.js', ...(await readdir(join(destination, 'common'))).filter(f => f.endsWith('.js')).map(f => 'common/' + f)]
  for (const file of staged) {
    const path = join(destination, file)
    await writeFile(path, (forensics ? keepForensics : stripForensics)(await readFile(path, 'utf8')))
  }
  // The watch ships with an empty initial state: the phone's snapshot supplies the plan, and
  // nothing local stands in for it.
  await mkdir(join(moduleDir, 'src/main/resources/base/media'), { recursive: true })
  await cp(join(template, 'resources/base/media/icon.png'), join(moduleDir, 'src/main/resources/base/media/icon.png'))
  await cp(join(template, 'resources/base/media/icon_small.png'), join(moduleDir, 'src/main/resources/base/media/icon_small.png'))
  if (sdk) {
    if (resolve(sdk) !== resolve(join(destination, 'vendor'))) await cp(sdk, join(destination, 'vendor'), { recursive: true })
    await writeFile(join(destination, 'common/peer.js'), 'export default ' + JSON.stringify({ phonePackage, phoneFingerprint }) + '\n')
  } else {
    // A real offline build. No SDK impersonation or successful radio callbacks are supplied.
    await writeFile(join(destination, 'common/runtime.js'), `import storage from '@system.storage'
import vibrator from '@system.vibrator'
import brightness from '@system.brightness'
import file from '@system.file'
import { createRuntime } from './controller.js'
import { stateStorage } from './state-storage.js'
export function runtime(changed, failure) {
  return createRuntime({ available: false, storage: stateStorage(storage, file), vibrator: vibrator, brightness: brightness,
    remove: function(uri) { file.delete({ uri: uri, fail: function() {} }) },
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval }, changed, failure)
}
`)
  }
  const stringsFile = join(moduleDir, 'src/main/resources/base/element/string.json')
  const strings = JSON.parse(await readFile(stringsFile, 'utf8'))
  const label = (ability.label || '').replace('$string:', '')
  for (const row of strings.string || []) if (row.name === label) row.value = 'openGym'
  await writeFile(stringsFile, JSON.stringify(strings, null, 2) + '\n')
  await writeFile(file, JSON.stringify(config, null, 2) + '\n')
  console.log('Staged ' + relative(root, destination) + ' (' + options.moduleName + ', ' + options.screenShape + '); retained generated ability, SDK and build configuration.')
  return destination
}

const entryDestination = await stage(join(project, 'entry'), { moduleName: 'entry', designWidth: 408, screenShape: 'rect', round: false })
if (roundProject) await stage(roundProject, { moduleName: 'round', designWidth: 466, screenShape: 'circle', round: true })
if (forensics) console.log('Forensics build: the exit trace is kept; stage the smaller locale set with build-locales.mjs --langs en,zh-Hans --out ' + join(entryDestination, 'common/locales.js'))
console.log(sdk ? 'Official SDK configured; sign and verify locally before installation.' : 'Offline build only: radio explicitly disabled until the official Wear Engine JS SDK and peer identity are configured.')
