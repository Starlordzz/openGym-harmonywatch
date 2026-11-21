import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Two HAPs from one page template: entry stays the 408x480 rect build and the round module only
// adds the 466 circle CSS plus the compressed idle list. No runtime JS may differ.
const template = new URL('../watch/entry/src/main/js/default/', import.meta.url)

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

test('the round module stages the same page with only the circle CSS and list override', async t => {
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
  assert.match(roundCss, /\.restArc \{[^}]*center-x: 105px; center-y: 105px; radius: 91px;/)

  const roundHml = await readFile(join(round, 'pages/index/index.hml'), 'utf8')
  assert.match(roundHml, /style="height: \{\{todayName \? 64 : 150\}\}px"/)
  assert.equal(await readFile(join(entry, 'pages/index/index.hml'), 'utf8'), await readFile(new URL('pages/index/index.hml', template), 'utf8'))
  assert.equal(await readFile(join(entry, 'pages/index/index.css'), 'utf8'), await readFile(new URL('pages/index/index.css', template), 'utf8'))
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
