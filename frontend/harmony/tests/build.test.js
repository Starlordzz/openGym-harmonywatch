import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkBundles } from '../../../scripts/harmony/check-bundles.mjs'
import { checkBinIdentity } from '../../../scripts/harmony/lite-config.mjs'

test('the device JS size guard accepts the limit and rejects one extra byte', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-bundle-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(join(dir, 'app.js'), Buffer.alloc(49152, 32))
  assert.equal((await checkBundles(dir))[0].bytes, 49152)
  await writeFile(join(dir, 'app.js'), Buffer.alloc(49153, 32))
  await assert.rejects(checkBundles(dir), /app.js \(49153\)/)
})

test('prepare rejects placeholder identity without --placeholder, cleans stale common files, and strips probe HML', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-prep-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'entry/src/main/js/MainAbility/common'), { recursive: true })
  await mkdir(join(dir, 'entry/src/main/resources/base/element'), { recursive: true })
  await writeFile(join(dir, 'entry/src/main/js/MainAbility/common/builtin-plan.js'), 'stale')
  await writeFile(join(dir, 'entry/src/main/resources/base/element/string.json'), JSON.stringify({ string: [{ name: 'MainAbility_label', value: 'old' }] }))
  const cfg = {
    app: { bundleName: 'host.msknet.opengym.fit', version: { code: 1, name: '1.4.5' } },
    module: { deviceType: ['liteWearable'], abilities: [{ name: '.MainAbility', type: 'page', srcLanguage: 'js', srcPath: 'MainAbility', label: '$string:MainAbility_label' }], js: [{ name: '.MainAbility' }] }
  }
  await writeFile(join(dir, 'entry/src/main/config.json'), JSON.stringify(cfg))
  assert.throws(() => execFileSync('node', ['scripts/harmony/prepare.mjs', '--project', dir, '--phone-package', 'example.opengym.phone', '--phone-fingerprint', '0'.repeat(64)], { stdio: 'pipe' }))
  execFileSync('node', ['scripts/harmony/prepare.mjs', '--project', dir, '--placeholder'], { stdio: 'pipe' })
  await assert.rejects(access(join(dir, 'entry/src/main/js/MainAbility/common/builtin-plan.js')))
  const stagedHml = await readFile(join(dir, 'entry/src/main/js/MainAbility/pages/index/index.hml'), 'utf8')
  assert.equal(stagedHml.includes('toggleProbe'), false)
  const stagedCfg = JSON.parse(await readFile(join(dir, 'entry/src/main/config.json'), 'utf8'))
  assert.equal(stagedCfg.app.bundleName, 'host.msknet.opengym.fit')
  assert.match(stagedCfg.module.metaData.customizeData.find(r => r.name === 'supportLists').value, /^example\.opengym\.phone:0{64}$/)
})

test('checkBinIdentity rejects placeholder identities and accepts real package + SHA-256 metadata', () => {
  assert.throws(() => checkBinIdentity({ app: { bundleName: 'example.opengym.fit' }, module: { metaData: { customizeData: [{ name: 'supportLists', value: 'a.b:' + 'A'.repeat(64) }] } } }))
  assert.throws(() => checkBinIdentity({ app: { bundleName: 'host.msknet.opengym.fit' }, module: { metaData: { customizeData: [{ name: 'supportLists', value: 'example.opengym.phone:' + 'A'.repeat(64) }] } } }))
  assert.throws(() => checkBinIdentity({ app: { bundleName: 'host.msknet.opengym.fit' }, module: { metaData: { customizeData: [{ name: 'supportLists', value: 'ch.real.phone:' + '0'.repeat(64) }] } } }))
  assert.doesNotThrow(() => checkBinIdentity({ app: { bundleName: 'host.msknet.opengym.fit' }, module: { metaData: { customizeData: [{ name: 'supportLists', value: 'ch.real.phone:' + 'A'.repeat(64) }] } } }))
})
