#!/usr/bin/env node
// B1 hardware comparisons: no crown, minimal app, or original offline app with a static page.
// Restage with prepare.mjs (or build-test.ps1) after building this diagnostic package.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const projectIndex = args.indexOf('--project')
if (projectIndex < 0 || !args[projectIndex + 1]) throw Error('Usage: node scripts/harmony/prepare-exit-probe.mjs --project <Lite project> [--minimal | --static-page]')
const project = resolve(args[projectIndex + 1])
execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'prepare.mjs'), '--project', project, '--offline'], { stdio: 'inherit' })
const config = JSON.parse(readFileSync(join(project, 'entry/src/main/config.json'), 'utf8'))
const ability = config.module.abilities.find(a => a.type === 'page' && (!a.srcLanguage || a.srcLanguage === 'js'))
const base = join(project, 'entry/src/main/js', ability.srcPath || ability.name)
const page = join(base, 'pages/index/index.js')
if (args.includes('--minimal') || args.includes('--static-page')) {
  if (args.includes('--minimal')) writeFileSync(join(base, 'app.js'), 'export default { data: {} }\n')
  writeFileSync(page, 'export default { data: {} }\n')
  writeFileSync(join(base, 'pages/index/index.hml'), `<div class="page">
  <text class="title">openGym 退出诊断</text>
  <text class="line">按表冠测试退出</text>
  <text class="credit">基于 Duarte Santos 的 openGym</text>
  <text class="credit">第三方华为 FIT 适配</text>
</div>\n`)
  writeFileSync(join(base, 'pages/index/index.css'), `.page { width: 408px; height: 408px; flex-direction: column; justify-content: center; align-items: center; background-color: #000000; }
.title { width: 376px; height: 48px; font-size: 28px; color: #ffffff; text-align: center; }
.line { width: 376px; height: 48px; font-size: 24px; color: #ffffff; text-align: center; }
.credit { width: 376px; height: 32px; font-size: 18px; color: #aaaaaa; text-align: center; }\n`)
  console.log(args.includes('--minimal')
    ? 'B1 minimal probe: static text only; no app imports, lifecycle handlers, timers, storage or native APIs.'
    : 'B1 static-page probe: original offline app startup and storage, with the minimal static page.')
} else {
  let source = readFileSync(page, 'utf8')
  const patterns = [
    /    try \{ if \(!this\.crownWatching && typeof setMonitorForCrownEvents === 'function'\) \{\r?\n      setMonitorForCrownEvents\(function\(evt\) \{ return page\.crown\(evt\) \}\); this\.crownWatching = true\r?\n    \} \} catch \(e\) \{\}/,
    /    try \{ if \(this\.crownWatching && typeof clearMonitorForCrownEvents === 'function'\) clearMonitorForCrownEvents\(\) \} catch \(e\) \{\}/
  ]
  for (const pattern of patterns) {
    if (!pattern.test(source)) throw Error('Crown lifecycle source changed; review this diagnostic overlay before rebuilding')
    source = source.replace(pattern, '')
  }
  writeFileSync(page, source)
  console.log('B1 exit probe: offline app with both native digital-crown monitor calls removed; timers, page and brightness retained.')
}
