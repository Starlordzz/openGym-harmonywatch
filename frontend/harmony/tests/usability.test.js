import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, savedState } from './helpers/watch.js'

test('weight fine adjustment survives refresh and is recorded in the completed set', t => {
  const f = mount(t)
  f.vm.edit('weight')
  f.vm.toggleStep()
  assert.equal(f.vm.editIncrement, 0.1)
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '20.1')
  f.app.change(s => { s.online = true })
  f.vm.editStepBy(1)
  f.vm.editDone()
  f.vm.done()
  assert.equal(f.app.state.workout.entries[0].sets[0].w, 20.2)
  assert.equal(f.app.state.outbox.find(e => e.type === 'setDone').w, 20.2)
})

test('quarter-unit steps preserve their decimal precision', t => {
  const s = savedState()
  s.workout.entries[0].step = 0.25
  const f = mount(t, s)
  f.vm.edit('weight')
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '20.25')
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '20.5')
})

test('whole-unit weigh-in adjustments preserve the selected decimal and crown works before training', t => {
  const s = savedState(); s.workout = null
  const f = mount(t, s)
  f.vm.startRoutine({ name: 'Today', entries: [] })
  f.vm.bw = 70.3
  f.vm.pickPart('whole')
  f.vm.weighStep(1)
  assert.equal(f.vm.bw, 71.3)
  f.vm.pickPart('tenth')
  f.vm.crown({ degree: 24 })
  assert.equal(f.vm.bw, 71.4)
})

test('foreground requests stay-awake and releases it when hidden or destroyed', t => {
  const f = mount(t)
  f.vm.onShow()
  f.vm.onHide()
  f.vm.onShow()
  f.vm.onDestroy()
  assert.deepEqual(f.screenRequests, [true, false, true, false])
})

test('rest expiry emits three pulses and another pattern after five seconds, then a touch cancels it', t => {
  const s = savedState()
  s.workout.rest = { endsAt: 11000 }
  const f = mount(t, s)
  f.time(11000); f.vm.tickClock()
  for (const delay of [0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 3)
  f.fire(5000)
  for (const delay of [0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 6)
  f.fire(5000)
  for (const delay of [0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 9)
  f.vm.ackRest(); f.fire(5000)
  for (const delay of [0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 9)
})

test('disabled rest haptics never vibrate', t => {
  const s = savedState(); s.settings.restHaptics = false
  s.workout.rest = { endsAt: 11000 }
  const f = mount(t, s)
  f.time(11000); f.vm.tickClock()
  for (const delay of [0, 150, 300, 5000, 0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 0)
})

test('destroying the page cancels pending rest pulses and repeats', t => {
  const f = mount(t)
  f.vm.startRestAlarm()
  f.fire(0)
  assert.equal(f.vibrations.length, 1)
  f.vm.onDestroy()
  for (const delay of [150, 300, 5000, 0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 1)
})

test('ending the workout on the phone stops an outstanding rest alarm', t => {
  const f = mount(t)
  f.vm.startRestAlarm()
  f.app.change(s => { s.workout = null })
  for (const delay of [0, 150, 300, 5000, 0, 150, 300]) f.fire(delay)
  assert.equal(f.vibrations.length, 0)
})
