import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Two HAPs from one page template: entry stays the 408x480 rect build and the round module only
// adds the 466 circle CSS, compressed idle list height, and build-time FIT box constants.
const template = new URL('../watch/entry/src/main/js/default/', import.meta.url)
const rectFit = 'var FIT = { ww: 104, wh: 72, uc: 88, um: 140, rw: 160, rh: 72, sw: 272, sh: 82, ew: 280, eh: 132, dw: 340 }'
const roundFit = 'var FIT = { ww: 88, wh: 56, uc: 74, um: 118, rw: 136, rh: 56, sw: 240, sh: 60, ew: 220, eh: 104, dw: 144 }'

async function scaffold(dir, name, window) {
  const main = join(dir, name, 'src/main')
  await mkdir(join(main, 'resources/base/element'), { recursive: true })
  const config = { app: { bundleName: 'ch.example.fit' }, module: {
    deviceType: ['liteWearable'],
    distro: { deliveryWithInstall: true, moduleName: name, moduleType: 'entry' },
    abilities: [{ name: '.MainAbility', srcPath: 'MainAbility', type: 'page', label: '$string:app_name' }],
    js: [{ name: '.MainAbility', window }]
  } }
  await writeFile(join(main, 'config.json'), JSON.stringify(config))
  await writeFile(join(main, 'resources/base/element/string.json'), JSON.stringify({ string: [{ name: 'app_name', value: '' }] }))
}

test('the round module stages the same page with circle CSS, list height, and FIT box constants', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-round-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await scaffold(dir, 'entry', { designWidth: 408, autoDesignWidth: false })
  await scaffold(dir, 'round', { designWidth: 466, autoDesignWidth: false })
  const prepare = fileURLToPath(new URL('../../../scripts/harmony/prepare.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [prepare, '--project', dir, '--round-project', join(dir, 'round'), '--offline'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const entry = join(dir, 'entry/src/main/js/MainAbility'), round = join(dir, 'round/src/main/js/MainAbility')
  const config = name => readFile(join(dir, name, 'src/main/config.json'), 'utf8').then(JSON.parse)

  const entryConfig = await config('entry'), roundConfig = await config('round')
  assert.deepEqual(entryConfig.module.distroFilter.screenShape, { policy: 'include', value: ['rect'] })
  assert.deepEqual(roundConfig.module.distroFilter.screenShape, { policy: 'include', value: ['circle'] })
  assert.equal(entryConfig.module.distro.moduleName, 'entry')
  assert.equal(roundConfig.module.distro.moduleName, 'round')
  assert.equal(entryConfig.module.js[0].window.designWidth, 408)
  assert.equal(roundConfig.module.js[0].window.designWidth, 466)
  assert.equal(roundConfig.module.js[0].window.autoDesignWidth, false)
  assert.equal(roundConfig.app.bundleName, entryConfig.app.bundleName)

  const override = await readFile(new URL('pages/index/round.css', template), 'utf8')
  const roundCss = await readFile(join(round, 'pages/index/index.css'), 'utf8')
  assert.equal(roundCss, await readFile(join(entry, 'pages/index/index.css'), 'utf8') + '\n' + override)
  assert.match(roundCss, /\.page \{ width: 466px; height: 466px; \}/)
  assert.match(roundCss, /\.restArc \{[^}]*center-x: 102px; center-y: 102px; radius: 88px;/)

  const templateHml = await readFile(new URL('pages/index/index.hml', template), 'utf8')
  const roundHml = await readFile(join(round, 'pages/index/index.hml'), 'utf8')
  const entryHml = await readFile(join(entry, 'pages/index/index.hml'), 'utf8')
  assert.match(roundHml, /style="height: \{\{todayName \? 64 : 150\}\}px"/)
  assert.equal(entryHml, templateHml.replace(/ onlongpress="toggleProbe"/g, ''))
  assert.equal(entryHml.includes('toggleProbe'), false)
  assert.equal(roundHml.includes('toggleProbe'), false)
  assert.equal(await readFile(join(entry, 'pages/index/index.css'), 'utf8'), await readFile(new URL('pages/index/index.css', template), 'utf8'))

  const entryJs = await readFile(join(entry, 'pages/index/index.js'), 'utf8')
  const roundJs = await readFile(join(round, 'pages/index/index.js'), 'utf8')
  assert.ok(entryJs.includes(rectFit))
  assert.ok(roundJs.includes(roundFit))
  assert.equal(roundJs, entryJs.replace(rectFit, roundFit))
  assert.equal(await readFile(join(round, 'app.js'), 'utf8'), await readFile(join(entry, 'app.js'), 'utf8'))

  await assert.rejects(stat(join(round, 'pages/index/round.css')), /ENOENT/)
  await assert.rejects(stat(join(entry, 'pages/index/round.css')), /ENOENT/)
})

test('a round module is only staged on request', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opengym-round-only-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await scaffold(dir, 'entry', { designWidth: 408, autoDesignWidth: false })
  const prepare = fileURLToPath(new URL('../../../scripts/harmony/prepare.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [prepare, '--project', dir, '--offline'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const entry = join(dir, 'entry/src/main/js/MainAbility')
  assert.equal(await readFile(join(entry, 'pages/index/index.css'), 'utf8'), await readFile(new URL('pages/index/index.css', template), 'utf8'))
  assert.match(await readFile(join(dir, 'entry/src/main/config.json'), 'utf8'), /"rect"/)
})
