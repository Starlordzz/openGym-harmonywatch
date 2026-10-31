import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, start, tick, finish, applySnapshot, acknowledge, setIndex, skip, summary, idle } from '../watch/entry/src/main/js/default/common/session.js'
import { packets, assembler } from '../watch/entry/src/main/js/default/common/wire.js'
import { afterTick } from '../watch/entry/src/main/js/default/common/heart.js'
const entry = (id, extra = {}) => ({ id, name: id, mode: 'reps', sets: [{ w: 20, r: 10, done: false }, { w: 20, r: 10, done: false }], ...extra })
function session(entries = [entry('a')]) { const s = initialState(); start(s, { name: '训练', routineIds: ['r'], entries }, 1000); return s }
test('offline start, stale snapshots, ticks and finish survive persistence', () => {
  let s = session(); const wid = s.workout.id
  s = applySnapshot(s, { v: 1, active: null }); assert.equal(s.workout.id, wid)
  const stale = JSON.parse(JSON.stringify(s.workout))
  tick(s, 0, 0, { w: 22, r: 8 }, 2000)
  s = JSON.parse(JSON.stringify(s)); s = applySnapshot(s, { v: 1, active: stale })
  assert.equal(s.workout.entries[0].sets[0].w, 22)
  assert.equal(s.outbox[1].type, 'setDone')
  const fresh = JSON.parse(JSON.stringify(s.workout)); fresh.entries[0].sets[0].at = 3000; fresh.entries[0].sets[0].w = 25
  s = applySnapshot(s, { v: 1, active: fresh }); assert.equal(s.workout.entries[0].sets[0].w, 25); assert.deepEqual(s.pending, {})
  finish(s, 4000); s = applySnapshot(s, { v: 1, active: fresh }); assert.equal(s.workout, null)
  assert.deepEqual(s.outbox.map(e => e.type), ['start', 'setDone', 'finish'])
  acknowledge(s, [s.outbox[0].id]); assert.equal(s.outbox.length, 2)
})
test('a workout the phone ends becomes the summary, marked ended on the phone', () => {
  let s = initialState()
  s = applySnapshot(s, { v: 1, active: { id: 'wp', name: 'Push', unit: 'kg', restSec: 90, start: 1000, entries: [entry('a')] } })
  assert.equal(s.workout.id, 'wp')
  tick(s, 0, 0, { w: 60, r: 8 }, 2000)
  s = applySnapshot(s, { v: 1, active: null })
  assert.equal(s.workout, null)
  assert.ok(s.summary)
  assert.equal(s.summary.endedOnPhone, true)
  assert.equal(s.summary.sets, 1)
})
test('a workout the phone ends closes its open rest window', () => {
  let s = initialState()
  s = applySnapshot(s, { v: 1, active: { id: 'wr', name: 'Push', unit: 'kg', restSec: 90, start: 1000, entries: [entry('a')] } })
  tick(s, 0, 0, { w: 60, r: 8 }, 2000)
  afterTick(s, 0, 0, 2000)
  assert.ok(s.restAfter)
  s = applySnapshot(s, { v: 1, active: null })
  assert.equal(s.workout, null)
  assert.equal(s.restAfter, null)
  assert.equal(s.setStartedAt, null)
})
test('a workout the phone discarded leaves no summary', () => {
  let s = initialState()
  s = applySnapshot(s, { v: 1, active: { id: 'wd', name: 'Push', unit: 'kg', restSec: 90, start: 1000, entries: [entry('a')] } })
  s = applySnapshot(s, { v: 1, active: null, discarded: ['wd'] })
  assert.equal(s.workout, null)
  assert.equal(s.summary, null)
})
test('unilateral sets aggregate both sides and have no intervening rest', () => {
  const s = session([entry('a', { sets: [{ sides: { L: { w: 10, r: 5 }, R: { w: 12, r: 6 } } }] })])
  tick(s, 0, 0, { w: 10, r: 5 }, 2000); assert.equal(s.workout.rest, null); assert.equal(s.entryIndex, 0)
  tick(s, 0, 0, { w: 12, r: 6 }, 3000)
  const row = s.workout.entries[0].sets[0]; assert.equal(row.r, 11); assert.equal(row.w, 12); assert.equal(row.done, true)
  assert.equal(summary(s, 4000).volume, 122)
})
test('superset alternates with rest only at round boundary', () => {
  const s = session([entry('a', { group: 'g' }), entry('b', { group: 'g' })])
  tick(s, 0, 0, {}, 2000); assert.equal(s.entryIndex, 1); assert.equal(s.workout.rest, null)
  tick(s, 1, 0, {}, 3000); assert.equal(s.entryIndex, 0); assert.equal(s.workout.rest.endsAt, 93000)
})
test('timed sets, effort, skip, warmups, PRs and discard', () => {
  const s = session([entry('a', { mode: 'time', best: { sec: 20 }, sets: [{ warmup: true }, {}, {}] })]); s.settings.effort = 'rpe'
  skip(s, 0, 0); assert.equal(setIndex(s, 0), 1)
  tick(s, 0, 1, { sec: 35, rpe: 8.6 }, 2000); tick(s, 0, 2, { sec: 40 }, 3000)
  assert.equal(s.outbox[1].rpe, 8.5); assert.equal(summary(s, 4000).records, 1)
  finish(s, 4000, true); assert.equal(s.summary, null); assert.equal(s.outbox.at(-1).type, 'discard')
})
test('idle thresholds and explicit recovery failures', () => {
  const s = session(); assert.equal(idle(s, 1000 + 20 * 60000), 'ask'); assert.equal(idle(s, 1000 + 45 * 60000), 'end')
  assert.throws(() => applySnapshot(s, { v: 7 })); assert.throws(() => start(s, {}, 2000))
})
test('Chinese payload packets fit 1KiB and reassemble out of order with duplicates', () => {
  const payload = { kind: 'snapshot', name: '哑铃训练💪'.repeat(1000) }, parts = packets(payload, 'x'), receive = assembler()
  for (const p of parts) assert.ok(Buffer.byteLength(p) < 1024)
  assert.equal(receive(parts.at(-1), 1), null); assert.equal(receive(parts.at(-1), 2), null)
  let result; for (const part of parts.slice(0, -1).reverse()) result = receive(part, 3)
  assert.deepEqual(result.payload, payload)
  assert.throws(() => receive('{"v":1,"id":"bad","n":999999,"i":0,"data":""}', 4))
})
test('unilateral ticks with no new numbers retain the planned side values', () => {
  const s = session([entry('a', { sets: [{ sides: { L: { w: 10, r: 5 }, R: { w: 12, r: 6 } } }] })])
  tick(s, 0, 0, {}, 2000)
  assert.equal(s.workout.entries[0].sets[0].sides.L.w, 10)
  assert.equal(s.workout.entries[0].sets[0].sides.L.r, 5)
})
test('a running hold or rest prevents the idle policy ending an active timer', () => {
  const s = session(), now = 1000 + 50 * 60000
  s.hold = { endsAt: now + 5000 }; assert.equal(idle(s, now), '')
  s.hold = null; s.workout.rest = { endsAt: now + 5000 }; assert.equal(idle(s, now), '')
})
