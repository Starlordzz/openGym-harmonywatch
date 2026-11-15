import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, savedState, entry } from './helpers/watch.js'
import { createRuntime } from '../watch/entry/src/main/js/default/common/controller.js'
import { waitForSdk } from '../watch/entry/src/main/js/default/common/sdk-ready.js'

test('showing and hiding the page never registers a native crown listener', t => {
  let calls = 0
  const previous = globalThis.setMonitorForCrownEvents
  globalThis.setMonitorForCrownEvents = () => calls++
  t.after(() => { if (previous === undefined) delete globalThis.setMonitorForCrownEvents; else globalThis.setMonitorForCrownEvents = previous })
  const f = mount(t, savedState([entry('a'), entry('b')]))
  f.vm.onShow(); f.vm.onHide(); f.vm.onShow()
  assert.equal(calls, 0)
  f.vm.onSwipe({ direction: 'up' })
  assert.equal(f.app.state.entryIndex, 1)
})

test('hidden pages detach and stop clocks until shown', t => {
  const f = mount(t, savedState([entry('a'), entry('b')]))
  f.vm.onShow()
  f.vm.onHide()
  assert.equal(f.app.listener, null)
  assert.ok(f.intervals.every(v => !v.active))
  assert.equal(f.app.state.entryIndex, 0)
  f.app.showEntry(1)
  assert.equal(f.vm.exName, 'a')
  f.vm.onShow()
  assert.equal(f.vm.exName, 'b')
})

test('destroyed pages never redraw from later app updates', t => {
  const f = mount(t)
  f.vm.onDestroy()
  assert.equal(f.app.listener, null)
  const screen = f.vm.screen
  f.app.change(s => { s.workout = null })
  assert.equal(f.vm.screen, screen)
})

test('integer and tenth buttons work separately and retain quarter weights', t => {
  const s = savedState(); s.workout.entries[0].sets[0].w = 20.25
  const f = mount(t, s)
  f.vm.edit('weight'); f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '21.25')
  f.vm.editFineBy(1)
  assert.equal(f.vm.editValue, '21.35')
  f.vm.editStepBy(-1); f.vm.editFineBy(-1)
  assert.equal(f.vm.editValue, '20.25')
})

test('rest ends with a visible notice and spaced long pulses that acknowledgement cancels', t => {
  const s = savedState(); s.workout.rest = { endsAt: 11000 }
  const f = mount(t, s); f.time(11000); f.vm.tickClock()
  assert.equal(f.vm.alarmOn, true)
  for (const delay of [0, 2000, 4000]) f.fire(delay)
  assert.deepEqual(f.vibrationModes, ['long', 'long', 'long'])
  f.vm.ackRest()
  for (const delay of [10000, 0, 2000, 4000]) f.fire(delay)
  assert.equal(f.vibrations.length, 3)
})

test('stopping during registration unregisters the late receiver without sending', () => {
  let receiver, sends = 0, unregistered = 0, notifications = 0
  const rt = createRuntime({ storage: { get(o) { o.success('') }, set(o) { o.success() } },
    sensor: { unsubscribeHeartRate() {} }, vibrator: { vibrate() {} },
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o },
      unregisterReceiver() { unregistered++ }, ping() {}, send() { sends++ } },
    peer: {}, Builder: class { setDescription() {} }, Message: class {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {} }, () => notifications++, () => {})
  rt.load(); rt.stop(); const before = notifications
  receiver.onSuccess(); receiver.onReceiveMessage('invalid late message')
  assert.ok(unregistered > 0)
  assert.equal(sends, 0); assert.equal(notifications, before)
})

test('SDK version polling can be cancelled before a page is destroyed', () => {
  let callback, cleared = false, reads = 0, done = false
  const client = { get version() { reads++; return null } }
  const cancel = waitForSdk(client, fn => { callback = fn; return 7 }, () => { done = true }, assert.fail, id => { cleared = id === 7 })
  cancel(); const before = reads; callback()
  assert.equal(reads, before); assert.equal(cleared, true); assert.equal(done, false)
})

test('show/hide/destroy request one screen release rather than repeat native calls', t => {
  const f = mount(t)
  f.vm.onShow(); f.vm.onShow(); f.vm.onHide(); f.vm.onHide(); f.vm.onDestroy(); f.app.onDestroy()
  assert.deepEqual(f.screenRequests, [true, false])
})

test('a failing sensor cleanup cannot skip P2P cleanup or accept late heart samples', () => {
  let receiver, sample, unregistered = 0
  const rt = createRuntime({ storage: { get(o) { o.success('') }, set(o) { o.success() } },
    sensor: { subscribeHeartRate(o) { sample = o.success }, unsubscribeHeartRate() { throw Error('native failure') } },
    vibrator: { vibrate() {} }, client: { setPeerPkgName() {}, setPeerFingerPrint() {},
      registerReceiver(o) { receiver = o }, unregisterReceiver() { unregistered++ }, ping() {} }, peer: {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {} }, () => {}, () => {})
  rt.load(); rt.heartStart()
  assert.doesNotThrow(() => rt.stop())
  receiver.onSuccess(); sample({ heartRate: 120 })
  assert.ok(unregistered > 0); assert.deepEqual(rt.samples(), [])
})

test('the idle heart link and the debug entry survive a session that has not arrived', t => {
  const saved = savedState()
  const f = mount(t, saved, { silent: true })
  // The idle screen is drawn from the first frame, while native storage is still being read.
  assert.ok(!f.vm.session)
  assert.doesNotThrow(() => f.vm.toggleSensor())
  f.vm.openDebug()
  assert.equal(f.vm.screen, 'debug')
  assert.equal(f.vm.debugLines[0].text, 'workout: none')
  f.vm.closeDebug()
  // The watchdog draws the empty view without settling the read, so writes stay refused until it
  // does: a late read must not overwrite what a tap recorded in between.
  f.fire(1500)
  assert.ok(f.vm.session)
  f.vm.toggleSensor()
  assert.equal(f.vm.session.sensorEnabled, undefined)
  f.answer(JSON.stringify(saved))
  f.vm.toggleSensor()
  assert.equal(f.vm.session.sensorEnabled, true)
})

test('hide followed by destroy cleans the page once and does not write to the hidden view again', t => {
  const f = mount(t)
  f.vm.onShow()
  const stopClocks = t.mock.method(f.vm, 'stopClocks')
  const ackRest = t.mock.method(f.vm, 'ackRest')
  f.vm.onHide()
  const traceCount = f.traces.length
  f.vm.onDestroy()
  assert.equal(stopClocks.mock.callCount(), 1)
  assert.equal(ackRest.mock.callCount(), 1)
  assert.equal(f.traces.length, traceCount)
  assert.equal(f.vm.dead, true)
})

test('queued storage writes still finish after stop without notifying a dead page', () => {
  const writes = []; let notifications = 0
  // The forensics build also writes its boot stream to a second key; the queue is the state key's.
  const rt = createRuntime({ available: false, storage: { get(o) { o.success('') }, set(o) { if (o.key === 'opengym-fit-v1') writes.push(o) } },
    sensor: {}, vibrator: {}, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {} }, () => notifications++, () => {})
  rt.load(); rt.change(s => { s.unit = 'lb' }); rt.change(s => { s.restSec = 120 })
  rt.stop(); const before = notifications
  writes[0].success(); writes[1].success()
  assert.equal(JSON.parse(writes[1].value).restSec, 120)
  assert.equal(notifications, before)
})
