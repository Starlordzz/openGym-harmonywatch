import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, savedState, entry, copy } from './helpers/watch.js'

test('added sets persist, survive old snapshots after event ack, and can be completed offline', t => {
  const f = mount(t, undefined, { radio: true })
  const old = copy(f.app.state.workout)
  f.vm.addSet()
  assert.equal(f.stored.workout.entries[0].sets.length, 3)
  assert.equal(f.stored.outbox.at(-1).type, 'addSet')
  f.receive({ kind: 'eventAck', ids: f.stored.outbox.map(e => e.id) })
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: old } })
  assert.equal(f.app.state.workout.entries[0].sets.length, 3)
  f.vm.pickDot(2); f.vm.done()
  assert.equal(f.stored.workout.entries[0].sets[2].done, true)
})
test('additional unilateral timed sets form a clean left/right pair', t => {
  const e = entry(); e.mode = 'time'; e.perSide = true
  e.sets = [{ sec: 45, w: 10, side: 'L', done: true }, { sec: 44, w: 10, side: 'R', done: true, at: 9000 }]
  const f = mount(t, savedState([e]))
  f.vm.addSet()
  assert.deepEqual(f.stored.workout.entries[0].sets.slice(2), [{ sec: 44, w: 10, side: 'L', done: false }, { sec: 44, w: 10, side: 'R', done: false }])
})
test('adding a set from the finish screen returns to the last exercise and its new row', t => {
  const f = mount(t, savedState([entry('a', 1)]))
  f.vm.done(); f.vm.finishPage(); f.vm.addSet()
  assert.equal(f.vm.screen, 'rest')
  f.vm.restSkip()
  assert.equal(f.vm.screen, 'exercise')
  assert.equal(f.vm.ei, 0)
  assert.equal(f.vm.si, 1)
})
test('timed left/right additions stay inside the phone event limit', t => {
  const e = entry('a', 59); e.mode = 'time'; e.perSide = true
  const f = mount(t, savedState([e]))
  f.vm.addSet()
  assert.equal(f.stored.workout.entries[0].sets.length, 59)
  assert.equal(f.stored.outbox.length, 0)
})
