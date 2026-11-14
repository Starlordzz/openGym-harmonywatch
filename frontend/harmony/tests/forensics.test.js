// U13 forensics: the shipping build must stay exactly the shipping build, and the forensics build
// must carry an exit trace that survives a freeze at any step. These tests pin both halves.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { mount, savedState } from './helpers/watch.js'
import { keepForensics, stripForensics } from '../../../scripts/harmony/strip-forensics.mjs'

const root = new URL('../watch/entry/src/main/js/default/', import.meta.url)

for (const file of ['app.js', 'common/controller.js', 'pages/index/index.js']) {
  test(file + ' carries the U13 markings and stages cleanly in both modes', async () => {
    const url = new URL(file, root)
    const source = await readFile(url, 'utf8')
    assert.ok(source.includes('/*f*/') && source.includes('/*endf*/'), 'forensics block missing')
    const kept = keepForensics(source)
    const stripped = stripForensics(source)
    for (const out of [kept, stripped]) assert.doesNotMatch(out, /\/\*(?:f|o|endf|endo)\*\//)
    assert.doesNotMatch(stripped, /traceRead|opengym-fit-trace|opengym-fit-boot|bootRead|markAt|crownAt|tnote|lastBoot|probeLater|toggleProbe|ksoOff/)
    // Both variants must stay importable modules, or one of the two builds dies at stage time.
    for (const out of [kept, stripped]) {
      let src = out
      if (file === 'app.js') src = src.replace("import { runtime } from './common/runtime.js'", 'function runtime() { return { load() {}, keepScreenOn() {}, stop() {} } }')
      src = src.replace(/from '(\.[^']+)'/g, (_, p) => "from '" + new URL(p, url).href + "'")
      const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
      const exported = file === 'common/controller.js' ? mod.createRuntime : mod.default
      assert.ok(exported, file + ' exports nothing after staging')
    }
  })
}

test('the exit is written step by step, so a freeze mid-exit keeps the steps before it', t => {
  const f = mount(t)
  f.time(20000)
  f.vm.onShow()
  f.time(20300)
  f.vm.onHide()
  assert.ok(f.traces.length >= 7, 'every mark must reach storage on its own')
  const last = f.traces[f.traces.length - 1]
  assert.match(last, /300:h/, 'the exit start records its own delay')
  const tags = ['s', 'h', 'k', 'c', 'r', 'd', 'x', 'p']
  let at = -1
  for (const tag of tags) {
    const i = last.indexOf(':' + tag)
    assert.ok(i > at, 'missing or misplaced ' + tag + ' in "' + last + '"')
    at = i
  }
})

test('a trace that never reaches the exit keeps the last show on record', t => {
  const f = mount(t)
  f.time(15000)
  f.vm.onShow()
  const last = f.traces[f.traces.length - 1]
  assert.match(last, /:s/)
  assert.doesNotMatch(last, /:h/)
})

test('the exit start mark carries what was still on and how janky the page was', t => {
  const f = mount(t)
  f.time(1000)
  f.vm.onShow()
  f.vm.alarmOn = true; f.vm.sensing = true; f.vm.lag = 900
  f.time(1100)
  f.vm.onHide()
  assert.match(f.traces[f.traces.length - 1], /:haswL900/)
})

test('a stalled animation clock is recorded and reported on the next exit', t => {
  const f = mount(t)
  f.time(10000)
  f.vm.onShow()
  const heartbeat = f.intervals.find(i => i.ms === 250)
  heartbeat.fn()
  f.time(10900)
  heartbeat.fn()
  assert.equal(f.vm.lag, 900)
  f.vm.onHide()
  assert.match(f.traces[f.traces.length - 1], /L900/)
})

test('the exit start records the JS quiet gap and the clock the app stream stamps with', t => {
  const f = mount(t)
  f.time(30000)
  f.vm.onShow()
  const heartbeat = f.intervals.find(i => i.ms === 250)
  heartbeat.fn()
  f.time(34200)
  f.vm.onHide()
  assert.match(f.traces[f.traces.length - 1], /h[asw]*J4200T34200/)
})

test('a degree-less crown event is timed from its own arrival to the exit', t => {
  const f = mount(t)
  f.time(50000)
  f.vm.onShow()
  f.vm.crown({ timestamp: 1, degree: 0 })
  assert.equal(f.vm.crownAt, 50000)
  f.vm.crown({ timestamp: 2, degree: 30 })
  assert.equal(f.vm.crownAt, 50000, 'a rotation must not overwrite the press clock')
  f.time(63100)
  f.vm.onHide()
  assert.match(f.traces[f.traces.length - 1], /C13100/)
})

test('a long previous exit wraps so the whole line stays readable', t => {
  const long = '0:s 14880:hwJ13000C12800 23:k 24:c 28:r 20:d 5:x 2:p'
  const f = mount(t, savedState(), { lastTrace: long })
  f.vm.openDebug()
  const texts = f.vm.debugLines.map(l => l.text)
  assert.equal(texts[6], 'boot: 10000:L1')
  assert.equal(texts[7], 'last: -')
  assert.equal(texts[8], 'prev: 0:s 14880:hwJ13000C12800')
  assert.equal(texts[9], '23:k 24:c 28:r 20:d 5:x 2:p')
  for (const line of texts) assert.ok(line.length <= 32, 'line must fit the watch width: ' + line)
})

test('the debug page shows the previous exit beside the current trace', t => {
  const f = mount(t, savedState(), { lastTrace: '0:s 5:a 900:hL900' })
  assert.equal(f.vm.lastExit, '0:s 5:a 900:hL900')
  f.vm.openDebug()
  const texts = f.vm.debugLines.map(l => l.text)
  assert.equal(texts[0], 'workout: w')
  assert.equal(texts[6], 'boot: 10000:L1')
  assert.equal(texts[8], 'prev: 0:s 5:a 900:hL900')
  assert.equal(f.vm.screen, 'debug')
})

test('the app-side stream is shown first, wrapped to the watch width', t => {
  const boot = '123456:L1 123600:G0 124000:G1 130000:F1 131000:F2 150000:T1'
  const f = mount(t, savedState(), { lastBoot: boot })
  assert.ok(f.vm.lastBoot.includes('150000:T1'), 'the previous run must be read back: ' + f.vm.lastBoot)
  assert.ok(f.vm.lastBoot.includes(':L1'), 'this session appends its own start')
  f.vm.openDebug()
  const texts = f.vm.debugLines.map(l => l.text)
  assert.ok(texts[6].startsWith('boot: '), 'boot lines come first: ' + texts[6])
  for (const line of texts) assert.ok(line.length <= 32, 'line must fit the watch width: ' + line)
})

test('the previous app-side tail keeps its own key and line', t => {
  const prev = '100000:T1 100010:T2 100100:NP10'
  const f = mount(t, savedState(), { lastBoot: prev })
  assert.equal(f.bootsPrev.at(-1), prev, 'the seed must be copied under its own key: ' + f.bootsPrev.join(' | '))
  for (let i = 0; i < 20; i++) { f.time(20000 + i); f.app.note('X' + i) }
  assert.ok(f.boots.at(-1).includes('X19'), 'the live stream keeps this session: ' + f.boots.at(-1))
  assert.equal(f.bootsPrev.at(-1), prev, 'this session must not overwrite the previous tail')
  f.vm.openDebug()
  const lines = f.vm.debugLines.map(l => l.text)
  assert.ok(lines.join(' ').includes('last: 100000:T1 100010:T2 100100:NP10'), 'the panel shows it: ' + lines.join(' | '))
})

test('a hide schedules app-side liveness probes that land in the stream', t => {
  const f = mount(t)
  f.vm.onShow()
  f.vm.onHide()
  f.fire(10000)
  f.fire(25000)
  assert.ok(f.boots.some(v => v.includes(':NP10')), 'the 10 s probe must land: ' + f.boots.join(' | '))
  assert.ok(f.boots.some(v => v.includes(':NP25')), 'the 25 s probe must land')
})

test('the screen-on probe logs instead of locking, and stop traces the teardown', t => {
  const f = mount(t)
  f.vm.onShow()
  assert.ok(f.boots.some(v => v.includes(':Z1C')), 'the lock request must be logged')
  assert.ok(f.boots.some(v => v.includes(':Z1S')), 'the lock result must be logged')
  const before = f.screenRequests.length
  f.app.toggleProbe(f.vm)
  assert.ok(f.boots.some(v => v.includes(':ZA1')), 'flipping the probe must be logged')
  assert.ok(f.vm.debugLines.some(l => l.text === 'online: no KSO-OFF'), 'the probe state must be visible on the panel')
  f.vm.onHide()
  assert.ok(f.boots.some(v => v.includes(':ZA0')), 'a gated release is logged, not sent')
  assert.equal(f.screenRequests.length, before, 'the probe must keep the platform untouched')
  f.app.onDestroy()
  assert.ok(f.boots.some(v => v.includes(':T1')), 'the start of stop must be on the record')
  assert.ok(f.boots.some(v => v.includes(':T2')), 'the completed teardown must be on the record')
})

test('mark entries carry a delay and a tag', t => {
  const f = mount(t)
  f.vm.mark('z')
  f.time(11000)
  f.vm.mark('y')
  assert.equal(f.traces[f.traces.length - 1], '0:z 1000:y')
})
