import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { configurePermissions, checkPermissions } from '../../../scripts/harmony/lite-config.mjs'

const name = 'ohos.permission.READ_HEALTH_DATA'
const original = () => ({ module: { deviceType: ['liteWearable'], abilities: [{ name: '.MainAbility', type: 'page' }], reqPermissions: [{ name }] } })

test('a name-only permission which compiles in the SDK is repaired for the Lite installer', () => {
  const config = original()
  assert.throws(() => checkPermissions(config), /reason.*46/)
  configurePermissions(config.module, '.MainAbility')
  assert.doesNotThrow(() => checkPermissions(config))
  assert.equal(config.module.reqPermissions.length, 2)
  for (const permission of config.module.reqPermissions) {
    assert.ok(permission.reason.length > 0)
    assert.equal(permission.usedScene.when, 'inuse')
    assert.deepEqual(permission.usedScene.ability, ['.MainAbility'])
  }
  const before = JSON.stringify(config)
  configurePermissions(config.module, '.MainAbility')
  assert.equal(JSON.stringify(config), before)
})

test('missing or invalid usage timing cannot silently pass the permission check', () => {
  const config = original()
  config.module.reqPermissions[0].reason = 'Read workout heart rate'
  assert.throws(() => checkPermissions(config), /usedScene.when.*46/)
  config.module.reqPermissions[0].usedScene = { when: 'foreground' }
  assert.throws(() => checkPermissions(config), /usedScene.when.*46/)
  config.module.reqPermissions[0].usedScene.when = 'inuse'
  assert.doesNotThrow(() => checkPermissions(config))
})

test('the build CLI rejects the old configuration and accepts the repaired configuration', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-permissions-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'config.json')
  const checker = fileURLToPath(new URL('../../../scripts/harmony/check-lite-config.mjs', import.meta.url))
  const config = original()
  await writeFile(path, JSON.stringify(config))
  const bad = spawnSync(process.execPath, [checker, path], { encoding: 'utf8' })
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, /reason.*46/)
  configurePermissions(config.module, '.MainAbility')
  await writeFile(path, JSON.stringify(config))
  const good = spawnSync(process.execPath, [checker, path], { encoding: 'utf8' })
  assert.equal(good.status, 0, good.stderr)
})

test('staging pins the same phone identity in the Lite manifest and runtime without losing other metadata', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-peer-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const main = join(dir, 'entry/src/main')
  await mkdir(join(main, 'resources/base/element'), { recursive: true })
  const config = { app: { bundleName: 'ch.example.fit' }, module: {
    deviceType: ['liteWearable'], abilities: [{ name: '.MainAbility', srcPath: 'MainAbility', type: 'page', label: '$string:app_name' }],
    js: [{ name: '.MainAbility' }], metaData: { customizeData: [{ name: 'unrelated', value: 'preserved' }] }
  } }
  await writeFile(join(main, 'config.json'), JSON.stringify(config))
  await writeFile(join(main, 'resources/base/element/string.json'), JSON.stringify({ string: [{ name: 'app_name', value: '' }] }))
  const prepare = fileURLToPath(new URL('../../../scripts/harmony/prepare.mjs', import.meta.url))
  const stage = fingerprint => {
    const r = spawnSync(process.execPath, [prepare, '--project', dir, '--phone-package', 'ch.example.phone', '--phone-fingerprint', fingerprint], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  }
  stage('A'.repeat(64))
  let rows = JSON.parse(await readFile(join(main, 'config.json'), 'utf8')).module.metaData.customizeData
  assert.equal(rows.find(r => r.name === 'supportLists')?.value, 'ch.example.phone:' + 'A'.repeat(64))
  stage('B'.repeat(64))
  rows = JSON.parse(await readFile(join(main, 'config.json'), 'utf8')).module.metaData.customizeData
  assert.equal(rows.filter(r => r.name === 'supportLists').length, 1)
  assert.equal(rows.find(r => r.name === 'supportLists').value, 'ch.example.phone:' + 'B'.repeat(64))
  assert.equal(rows.find(r => r.name === 'unrelated').value, 'preserved')
  const peer = await readFile(join(main, 'js/MainAbility/common/peer.js'), 'utf8')
  assert.ok(peer.includes('ch.example.phone') && peer.includes('B'.repeat(64)))
})
