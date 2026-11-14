import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, savedState, copy } from './helpers/watch.js'

test('a new phone workout enters training and buzzes once after it is stored', t => {
  const f = mount(t, { ...savedState(), workout: null }, { radio: true })
  const snap = { v: 1, settings: { restHaptics: false }, active: savedState().workout }
  f.receive({ kind: 'snapshot', snapshot: snap })
  assert.equal(f.vm.screen, 'exercise')
  assert.deepEqual(f.vibrationModes, ['long'])
  f.receive({ kind: 'snapshot', snapshot: copy(snap) })
  assert.deepEqual(f.vibrationModes, ['long'])
  f.vm.onHide(); f.vm.onShow()
  assert.deepEqual(f.vibrationModes, ['long'])
})
test('echo of a workout started on the watch does not announce a new task', t => {
  const s = savedState(); s.startedHere = s.workout.id
  const f = mount(t, s, { radio: true })
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: copy(s.workout) } })
  assert.deepEqual(f.vibrationModes, [])
})

test('a new phone task replaces an old edit panel with the new training view', t => {
  const f = mount(t, savedState(), { radio: true })
  f.vm.edit('weight'); assert.equal(f.vm.screen, 'edit')
  const active = savedState().workout; active.id = 'new-task'
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active } })
  assert.equal(f.vm.screen, 'exercise')
  assert.equal(f.app.state.workout.id, 'new-task')
  assert.deepEqual(f.vibrationModes, ['long'])
})
