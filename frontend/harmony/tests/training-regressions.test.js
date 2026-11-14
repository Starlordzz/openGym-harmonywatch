import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRuntime } from '../watch/entry/src/main/js/default/common/controller.js'
import { event } from '../watch/entry/src/main/js/default/common/session.js'
import { packets, assembler } from '../watch/entry/src/main/js/default/common/wire.js'
import { mount, savedState, entry } from './helpers/watch.js'

function io(deferred = false) {
  let receiver, current, saved
  const writes = [], pending = [], buzzes = []
  const rt = createRuntime({
    storage: { get(o) { o.success('') }, set(o) { if (o.key !== 'opengym-fit-v1') { o.success(); return }
      writes.push(o.value); const finish = () => { saved = JSON.parse(o.value); o.success() }; if (deferred) pending.push(finish); else finish() } },
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o; o.onSuccess() }, unregisterReceiver() {},
      send(m, cb) { cb.onSendResult({ code: 207 }) } }, peer: { phonePackage: 'test', phoneFingerprint: 'A' },
    Builder: class { setDescription(text) { this.text = text } }, Message: class {},
    setTimeout(fn) { return fn }, clearTimeout() {}, setInterval() {}, clearInterval() {}, sensor: {}, vibrator: { vibrate(o) { buzzes.push(o.mode) } }
  }, s => { current = s }, () => {})
  rt.load()
  return { rt, writes, pending, buzzes, get saved() { return saved }, get state() { return current },
    receive(p) { for (const frame of packets(p, 'test')) receiver.onReceiveMessage(frame) },
    file(path) { receiver.onReceiveMessage({ isFileType: true, name: path }) } }
}
test('slow storage coalesces pending saves and persists every local event before transmitting', () => {
  const f = io(true)
  for (let i = 0; i < 12; i++) f.rt.change(s => event(s, 'weighIn', { w: i + 60 }, i + 100))
  assert.equal(f.writes.length, 1)
  f.pending.shift()()
  assert.equal(f.writes.length, 2)
  f.pending.shift()()
  assert.equal(f.pending.length, 0)
  assert.equal(f.saved.outbox.length, 12)
  f.rt.stop()
})
test('a 16-frame animation persists at completion instead of rewriting the whole plan per frame', () => {
  const f = io()
  f.rt.change(s => { s.workout = { id: 'w', entries: [{ id: 'a', sets: [] }] } })
  const files = Array.from({ length: 16 }, (_, i) => `og-a-${i}.png`)
  f.receive({ kind: 'clip', wid: 'w', exId: 'a', files })
  const before = f.writes.length
  for (const file of files.slice(0, -1)) f.file('internal://app/' + file)
  assert.equal(f.writes.length, before)
  f.file('internal://app/' + files.at(-1))
  assert.equal(f.writes.length, before + 1)
  f.rt.stop()
})
test('late clicks after state loss do not dereference a missing workout', t => {
  const f = mount(t)
  f.vm.onState(null, '')
  assert.doesNotThrow(() => f.vm.edit('weight'))
  assert.doesNotThrow(() => f.vm.editStepBy(1))
  assert.doesNotThrow(() => f.vm.done())
  assert.doesNotThrow(() => f.vm.complete())
  assert.doesNotThrow(() => f.vm.onSwipe({ direction: 'up' }))
})
test('a refresh that cleared the live edit cache does not crash the first weight increment', t => {
  const f = mount(t)
  f.vm.edit('weight'); f.vm.live = null
  assert.doesNotThrow(() => f.vm.editStepBy(1))
  assert.equal(f.vm.weight, '21')
})
test('a stale snapshot cannot undo an acknowledged completed row and reenter a skipped rest', t => {
  const f = mount(t, savedState([entry('a', 1), entry('b', 1)]), { radio: true })
  f.vm.done()
  const completed = JSON.parse(JSON.stringify(f.stored.workout))
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: completed } })
  f.receive({ kind: 'eventAck', ids: f.stored.outbox.map(e => e.id) })
  f.vm.restSkip()
  const stale = JSON.parse(JSON.stringify(completed))
  stale.entries[0].sets[0].done = false; stale.entries[0].sets[0].at = 0
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: stale } })
  assert.equal(f.app.state.workout.entries[0].sets[0].done, true)
  assert.equal(f.app.state.workout.rest, null)
  assert.equal(f.vm.ei, 1)
})
test('watch navigation and rest skip are durably queued and sent without background notification messages', t => {
  const s = savedState([entry('a'), entry('b')]); s.workout.rest = { endsAt: 30000 }
  const f = mount(t, s, { radio: true }), decode = assembler()
  f.vm.onSwipe({ direction: 'up' }); f.vm.restSkip()
  const messages = f.sent.map(raw => decode(raw, Date.now())).filter(Boolean).map(r => r.payload)
  const events = messages.filter(p => p.kind === 'events').flatMap(p => p.events)
  assert.ok(events.some(e => e.type === 'navigate' && e.entryIdx === 1 && e.exId === 'b' && e.restSkip === true))
  assert.ok(f.stored.outbox.some(e => e.type === 'navigate' && e.entryIdx === 1))
  assert.equal(messages.some(p => p.kind === 'restAlarm'), false)
})

test('incoming task buzz waits for durable commit and is suppressed if the task already ended', () => {
  const f = io(true)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: savedState().workout } })
  assert.deepEqual(f.buzzes, [])
  f.pending.shift()(); assert.deepEqual(f.buzzes, ['long'])
  const active = savedState().workout; active.id = 'new'
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active } })
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: null } })
  while (f.pending.length) f.pending.shift()()
  assert.deepEqual(f.buzzes, ['long'])
  f.rt.stop()
})

test('remote finish publishes summary before slow disk commits, then acknowledges durably', () => {
  const f = io(true)
  const active = savedState().workout
  active.rest = { endsAt: Date.now() + 90000 }
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active } })
  f.pending.shift()()
  f.receive({ kind: 'workoutEnd', wid: active.id })
  assert.equal(f.state.workout, null)
  assert.equal(f.state.summary.endedOnPhone, true)
  while (f.pending.length) f.pending.shift()()
  assert.equal(f.saved.workout, null)
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active } })
  assert.equal(f.state.workout, null)
  f.rt.stop()
})
