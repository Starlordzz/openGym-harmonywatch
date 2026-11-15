import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, copy } from './helpers/watch.js'

test('rest uses the ordinary one-second clock with no canvas animation timer', t => {
  const f = mount(t)
  f.vm.done(); f.vm.onShow()
  assert.equal(f.intervals.some(i => i.active && i.ms === 100), false)
  f.time(11000)
  f.intervals.find(i => i.active && i.ms === 1000).fn()
  assert.equal(f.vm.digits, '1:29')
  assert.equal(Number.isInteger(f.vm.ringPercent), true)
})

test('watch +/-15 and pause/resume survive clock time and emit durable absolute state', t => {
  const f = mount(t, undefined, { radio: true })
  f.vm.done(); const original = f.app.state.workout.rest.endsAt
  f.vm.restMore()
  assert.equal(f.app.state.workout.rest.endsAt, original + 15000)
  assert.equal(f.stored.outbox.at(-1).type, 'restChange')
  f.vm.restLess(); assert.equal(f.app.state.workout.rest.endsAt, original)
  f.vm.restPause(); assert.equal(f.vm.screen, 'rest'); assert.equal(f.vm.restPaused, true)
  const left = f.app.state.workout.rest.left
  f.time(200000); f.vm.tickClock()
  assert.equal(f.vm.digits, '1:30'); assert.equal(f.vm.alarmOn, false)
  f.vm.restMore(); assert.equal(f.app.state.workout.rest.left, left + 15)
  f.vm.restPause(); assert.equal(f.app.state.workout.rest.endsAt, 305000)
  assert.equal(f.stored.workout.rest.paused, false)
})
test('pending watch rest edits survive late snapshots; newer priority controls survive older snapshot completion', t => {
  const f = mount(t, undefined, { radio: true })
  f.vm.done(); f.vm.restMore()
  const wanted = copy(f.app.state.workout.rest), active = copy(f.app.state.workout)
  active.rest = { endsAt: 30000 }
  f.receive({ kind: 'snapshot', session: 'phone', rev: 1, snapshot: { v: 1, active } })
  assert.deepEqual(f.app.state.workout.rest, wanted)
  f.receive({ kind: 'eventAck', ids: f.app.state.outbox.map(e => e.id) })
  f.receive({ kind: 'restState', session: 'phone', rev: 3, wid: 'other', rest: null })
  assert.deepEqual(f.app.state.workout.rest, wanted)
  f.receive({ kind: 'restState', session: 'phone', rev: 4, wid: 'w', rest: { paused: true, left: 40, total: 90, endsAt: 0 } })
  assert.equal(f.vm.restPaused, true)
  f.receive({ kind: 'snapshot', session: 'phone', rev: 2, snapshot: { v: 1, active } })
  assert.equal(f.app.state.workout.rest.paused, true)
  f.receive({ kind: 'restState', session: 'new-phone', rev: 1, wid: 'w', rest: { endsAt: 80000, total: 90 } })
  assert.equal(f.app.state.workout.rest.endsAt, 80000)
})
test('subtracting past zero skips rest and never stores a negative timer', t => {
  const f = mount(t)
  f.vm.done(); f.time(99000); f.vm.restLess()
  assert.equal(f.app.state.workout.rest, null)
  assert.equal(f.stored.outbox.at(-1).type, 'navigate')
  assert.equal(f.stored.outbox.at(-1).restSkip, true)
})
