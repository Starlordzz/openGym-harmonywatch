import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../watch/entry/src/main/js/default/common/controller.js'
import { packets, assembler } from '../watch/entry/src/main/js/default/common/wire.js'
import { event } from '../watch/entry/src/main/js/default/common/session.js'
function fixture({ offline = false, saved = '', silent = false } = {}) {
  var store = { 'opengym-fit-v1': saved }, current, errors = [], written = [], outgoing = [], timers = [], receiver, pendingGet, failWrite = false, sendFails = false, pingCode = 201, sensorCallback, now = 10000
  const decode = assembler()
  const platform = { available: !offline,
    // Keyed like the device's own storage: the runtime keeps its forensics stream in a second key.
    storage: { get: o => { if (silent) pendingGet = o; else o.success(store[o.key] || '') }, set: o => { if (failWrite) { o.fail(); return } store[o.key] = o.value; if (o.key === 'opengym-fit-v1') written.push(JSON.parse(o.value)); o.success() } },
    now: () => now,
    vibrator: { vibrate() {} }, sensor: { subscribeHeartRate(o) { sensorCallback = o.success }, unsubscribeHeartRate() {} },
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o; o.onSuccess() }, unregisterReceiver() {},
      send(m, cb) { const data = decode(m.builder.text, Date.now()); if (data) outgoing.push(data.payload); cb.onSendResult({ code: sendFails ? 206 : 207 }) },
      ping(o) { o.onPingResult({ code: pingCode }) } },
    peer: { phonePackage: 'test', phoneFingerprint: 'a' },
    Builder: class { setDescription(text) { this.text = text } }, Message: class {},
    setTimeout(fn) { timers.push(fn); return fn }, clearTimeout(fn) { timers = timers.filter(v => v !== fn) }, setInterval() {}, clearInterval() {}
  }
  if (offline) { delete platform.client; delete platform.Builder; delete platform.Message }
  const runtime = createRuntime(platform, s => { current = s }, e => errors.push(e))
  return { runtime, outgoing, written, errors, get state() { return current }, get saved() { return store['opengym-fit-v1'] },
    sample(value, at) { now = at; sensorCallback({ heartRate: value }) }, time(at) { now = at },
    fail(v) { failWrite = v }, sendFail(v) { sendFails = v }, ping(code) { pingCode = code }, retry() { const tasks = timers; timers = []; tasks.forEach(fn => fn()) },
    answer(text) { pendingGet.success(text) },
    receive(payload) { packets(payload, 'phone-' + Math.random()).forEach(p => receiver.onReceiveMessage(p)) } }
}
test('real runtime sends every fragment when Wear Engine returns communication-success 207', () => {
  const f = fixture(); f.runtime.load()
  assert.equal(f.outgoing[0].kind, 'hello')
  f.runtime.change(s => event(s, 'weighIn', { w: 70 }, 1000))
  assert.equal(f.outgoing.at(-1).kind, 'events'); assert.equal(f.outgoing.at(-1).events[0].w, 70)
  f.receive({ kind: 'eventAck', ids: [f.state.outbox[0].id] }); assert.equal(f.state.outbox.length, 0)
  f.runtime.stop()
})
test('failed storage cannot acknowledge snapshots or transmit newly recorded events', () => {
  const f = fixture(); f.runtime.load(); f.outgoing.length = 0; f.fail(true)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, ready: { others: [] }, active: null } })
  f.runtime.change(s => event(s, 'weighIn', { w: 72 }, 2000))
  assert.equal(f.outgoing.length, 0); assert.ok(f.errors.length)
  f.fail(false); f.retry()
  assert.ok(f.outgoing.some(v => v.kind === 'snapshotAck'))
  assert.ok(f.outgoing.some(v => v.kind === 'events'))
  assert.equal(f.written.at(-1).outbox.length, 1)
  f.runtime.stop()
})

test('a storage service that never answers still opens the app', () => {
  const f = fixture({ silent: true }); f.runtime.load()
  assert.equal(f.state, undefined)
  f.retry()
  assert.equal(f.state.outbox.length, 0)
  assert.equal(f.outgoing.length, 0)
  f.answer('')
  assert.equal(f.outgoing[0].kind, 'hello')
  f.runtime.stop()
})
test('a late storage answer replaces the empty state the watchdog opened', () => {
  const f = fixture({ silent: true }); f.runtime.load(); f.retry()
  f.answer(JSON.stringify({ outbox: [], workout: { id: 'w', entries: [], rest: null }, settings: { lang: 'zh-Hans' } }))
  assert.equal(f.state.workout.id, 'w')
  assert.equal(f.state.settings.lang, 'zh-Hans')
  f.runtime.stop()
})
test('corrupt saved data still stops the start instead of showing it as empty', () => {
  const f = fixture({ silent: true }); f.runtime.load(); f.answer('{"outbox":"broken"}')
  f.retry()
  assert.equal(f.state, undefined)
  assert.ok(f.errors.some(e => e.includes('记录损坏')))
})
test('offline build persists edits without providing a pretend successful SDK', () => {
  const f = fixture({ offline: true }); f.runtime.load()
  f.runtime.change(s => event(s, 'weighIn', { w: 75 }, 3000))
  assert.equal(f.outgoing.length, 0); assert.equal(f.written.at(-1).outbox.length, 1)
  assert.ok(f.errors.some(e => e.includes('通信 SDK')))
  assert.doesNotThrow(() => f.runtime.stop())
})
test('a new runtime restores a durably saved workout, timer and pending events', () => {
  const f = fixture(); f.runtime.load()
  f.runtime.change(s => { s.workout = { id: 'w', entries: [], rest: { endsAt: 40000 } }; s.hold = { start: 10000, endsAt: 30000, ei: 0, si: 0, values: { w: 10 } }; event(s, 'weighIn', { w: 70 }, 10000) })
  const saved = f.saved; f.runtime.stop()
  const restored = fixture({ saved }); restored.runtime.load()
  assert.equal(restored.state.hold.endsAt, 30000)
  assert.equal(restored.state.workout.rest.endsAt, 40000)
  assert.deepEqual(restored.state.outbox, JSON.parse(saved).outbox)
  assert.equal(restored.outgoing.at(-1).kind, 'events')
  restored.runtime.stop()
})
test('queued work is only offline while the phone stops answering', () => {
  const f = fixture(); f.runtime.load()
  assert.equal(f.state.online, true)
  f.time(200000); f.sendFail(true)
  f.runtime.change(s => event(s, 'weighIn', { w: 70 }, 200000))
  assert.equal(f.state.online, false)
  f.time(210000); f.sendFail(false)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: null } })
  assert.equal(f.state.online, true)
  f.runtime.stop()
})
test('the hello handshake is throttled, events are not', () => {
  const f = fixture(); f.runtime.load(); f.outgoing.length = 0
  f.runtime.change(s => event(s, 'weighIn', { w: 70 }, 1500))
  f.runtime.change(s => event(s, 'weighIn', { w: 71 }, 1600))
  assert.equal(f.outgoing.filter(v => v.kind === 'hello').length, 0)
  assert.equal(f.outgoing.filter(v => v.kind === 'events').length, 2)
  f.time(80000)
  f.runtime.change(s => event(s, 'weighIn', { w: 72 }, 80000))
  assert.equal(f.outgoing.filter(v => v.kind === 'hello').length, 1)
  f.runtime.stop()
})
test('a ping result is install state, not reachability', () => {
  const f = fixture(); f.sendFail(true); f.ping(201); f.runtime.load()
  f.time(200000)
  assert.equal(f.state.online, false)
  f.ping(204)
  assert.equal(f.state.online, false)
  f.runtime.stop()
})
test('a workout the phone ends keeps a local summary without watch HR sensor methods', () => {
  const f = fixture(); f.runtime.load()
  assert.equal(f.runtime.heartStart, undefined)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: { id: 'wp', name: 'Push', unit: 'kg', restSec: 90, start: 1000, entries: [{ id: 'a', name: 'Bench', mode: 'reps', sets: [{ w: 60, r: 8, done: true, warmup: false }] }] } } })
  f.time(10000)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: null } })
  assert.ok(f.state.summary)
  assert.equal(f.state.summary.endedOnPhone, true)
  assert.equal(f.state.summary.sets, 1)
  f.runtime.stop()
})
test('restState shifts endsAt by clockOff, flushes up to 20 events, and sweeps orphan clips on boot', () => {
  const removed = [], sentBatches = [], decode = assembler()
  const timers = []
  let receiver, state, now = 20000
  const saved = { outbox: Array.from({ length: 25 }, (_, i) => ({ id: 'e' + i, type: 'weighIn', w: 70, at: 1000 + i })),
    workout: { id: 'w1', name: 'A', unit: 'kg', restSec: 90, start: 10000, entries: [{ id: 'ex1', sets: [] }], rest: null },
    clips: { ex1: { wid: 'w1', names: ['og-aaaa-0.png'], paths: { 'og-aaaa-0.png': 'internal://app/og-aaaa-0.png' } } } }
  const rt = createRuntime({
    storage: { get(o) { o.success(JSON.stringify(saved)) }, set(o) { o.success() } },
    now: () => now,
    list(uri, cb) { cb([{ uri: 'internal://app/og-aaaa-0.png' }, { uri: 'internal://app/og-dead00-0.png' }, { uri: 'internal://app/og-state0' }, { uri: 'internal://app/og-ready0' }]) },
    remove(uri) { removed.push(uri) },
    vibrator: { vibrate() {} },
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o; o.onSuccess() }, unregisterReceiver() {},
      send(m, cb) { const d = decode(m.builder.text, now); if (d && d.payload.kind === 'events') sentBatches.push(d.payload.events.length); cb.onSendResult({ code: 207 }) } },
    peer: { phonePackage: 'test', phoneFingerprint: 'a' },
    Builder: class { setDescription(text) { this.text = text } }, Message: class {},
    setTimeout(fn) { timers.push(fn); return fn }, clearTimeout() {}, setInterval() {}, clearInterval() {}
  }, s => { state = s }, () => {})
  rt.load()
  assert.deepEqual(removed, ['internal://app/og-dead00-0.png'])
  assert.equal(sentBatches[0], 20)
  // clockOff = 20000 - 15000 = 5000; restState endsAt 40000 -> 45000 on watch clock
  for (const p of packets({ kind: 'snapshot', snapshot: { v: 1, now: 15000, active: saved.workout } }, 's1')) receiver.onReceiveMessage(p)
  for (const p of packets({ kind: 'restState', wid: 'w1', rest: { endsAt: 40000, total: 90 } }, 'r1')) receiver.onReceiveMessage(p)
  assert.equal(state.workout.rest.endsAt, 45000)
  rt.stop()
})
test('save cancels any pending retryTimer so a subsequent change does not replay a stale retry', () => {
  const f = fixture(); f.runtime.load()
  f.fail(true)
  f.runtime.change(s => event(s, 'weighIn', { w: 70 }, 1000))
  f.fail(false)
  f.runtime.change(s => event(s, 'weighIn', { w: 71 }, 2000))
  const writesAfterRecovery = f.written.length
  f.retry()
  assert.equal(f.written.length, writesAfterRecovery)
  f.runtime.stop()
})
