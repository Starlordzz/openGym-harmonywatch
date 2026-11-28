import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mount, savedState } from './helpers/watch.js'
import { setDots } from '../watch/entry/src/main/js/default/common/format.js'

test('weight fine adjustment survives refresh and is recorded in the completed set', t => {
  const f = mount(t)
  f.vm.edit('weight')
  f.vm.editFineBy(1)
  assert.equal(f.vm.editValue, '20.1')
  f.app.change(s => { s.online = true })
  f.vm.editFineBy(1)
  f.vm.editDone()
  f.vm.done()
  assert.equal(f.app.state.workout.entries[0].sets[0].w, 20.2)
  assert.equal(f.app.state.outbox.find(e => e.type === 'setDone').w, 20.2)
})

test('whole-unit changes retain an existing quarter-unit weight', t => {
  const s = savedState()
  s.workout.entries[0].step = 0.25
  s.workout.entries[0].sets[0].w = 20.25
  const f = mount(t, s)
  f.vm.edit('weight')
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '21.25')
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '22.25')
})

test('weigh-in buttons adjust whole and fractional values before training', t => {
  const s = savedState(); s.workout = null
  const f = mount(t, s)
  f.vm.startRoutine({ name: 'Today', entries: [] })
  f.vm.bw = 70.3
  f.vm.pickPart('whole')
  f.vm.weighStep(1)
  assert.equal(f.vm.bw, 71.3)
  f.vm.pickPart('tenth')
  f.vm.weighStep(1)
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

test('rest expiry emits two rounds of long pulses and then stops on its own', t => {
  const s = savedState()
  s.workout.rest = { endsAt: 11000 }
  const f = mount(t, s)
  f.time(11000); f.vm.tickClock()
  for (const delay of [0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 4)
  f.fire(10000)
  for (const delay of [0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 8)
  // No further round is scheduled: an untouched watch goes quiet after about 16 s.
  f.fire(10000)
  for (const delay of [0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 8)
  f.vm.ackRest()
  for (const delay of [0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 8)
})

test('disabled rest haptics never vibrate', t => {
  const s = savedState(); s.settings.restHaptics = false
  s.workout.rest = { endsAt: 11000 }
  const f = mount(t, s)
  f.time(11000); f.vm.tickClock()
  for (const delay of [0, 2000, 4000, 6000, 10000, 0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 0)
})

test('destroying the page cancels pending rest pulses and repeats', t => {
  const f = mount(t)
  f.vm.startRestAlarm()
  f.fire(0)
  assert.equal(f.vibrations.length, 1)
  f.vm.onDestroy()
  for (const delay of [2000, 4000, 6000, 10000, 0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, 1)
})

test('ending the workout on the phone stops an outstanding rest alarm', t => {
  const f = mount(t)
  f.vm.startRestAlarm()
  const alreadyStarted = f.vibrations.length
  f.app.change(s => { s.workout = null })
  for (const delay of [0, 2000, 4000, 6000, 10000, 0, 2000, 4000, 6000]) f.fire(delay)
  assert.equal(f.vibrations.length, alreadyStarted)
})

test('setDots windows long set lists to 18 dots with real indices and dynamic box width', () => {
  const entry = { id: '0025', sets: Array.from({ length: 30 }, (_, i) => ({ done: i < 20, warmup: false })) }
  const windowed = setDots(entry, 25, [], 0)
  assert.equal(windowed.length, 18)
  assert.ok(windowed[0].index > 0)
  assert.equal(windowed.at(-1).index, 29)
  assert.ok(windowed[0].box >= 14 && windowed[0].box <= 20)
  assert.equal(windowed.find(d => d.index === 25).border, 1.5)
})

test('viewing edit without stepping does not freeze live values across phone snapshots, and pausedAt pauses elapsed clock', t => {
  const s = savedState()
  s.settings.show = { elapsed: true }
  s.workout.pausedAt = 7000
  const f = mount(t, s, { radio: true })
  f.time(25000); f.vm.sync()
  assert.equal(f.vm.extras, '0:06')
  f.vm.edit('weight')
  assert.equal(f.vm.live, null)
  f.vm.editDone()
  assert.equal(f.vm.live, null)
  const updated = JSON.parse(JSON.stringify(f.app.state.workout))
  updated.entries[0].sets[0].w = 35
  f.receive({ kind: 'snapshot', snapshot: { v: 1, active: updated } })
  assert.equal(f.vm.weight, '35')
})

test('finish flag calls save directly, debug returns to prior screen, keepGoing sends stillHere, idle sends idle flag', t => {
  const s = savedState()
  const f = mount(t, s, { radio: true })
  f.vm.startRestAlarm()
  f.vm.openDebug()
  assert.equal(f.vm.screen, 'debug')
  f.vm.closeDebug()
  assert.equal(f.vm.screen, 'exercise')
  f.vm.keepGoing()
  assert.ok(f.app.state.outbox.some(e => e.type === 'stillHere'))
  f.time(1000 + 46 * 60000)
  f.vm.tickClock()
  assert.equal(f.app.state.outbox.find(e => e.type === 'finish').idle, true)
  const hml = readFileSync(new URL('../watch/entry/src/main/js/default/pages/index/index.hml', import.meta.url), 'utf8')
  assert.match(hml, /finishRound"[^>]*onclick="save"/)
  assert.match(hml, /doneWrap" if="\{\{!cardio\}\}"/)
  assert.match(hml, /style="width: \{\{\$item\.box\}\}px" onclick="pickDot\(\$item\.index\)"/)
})
