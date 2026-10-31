import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, entry, savedState, copy } from './helpers/watch.js'
import { initialState, start, skip, setIndex, tick, applySnapshot, restoreState } from '../watch/entry/src/main/js/default/common/session.js'
import { mergeHeart, closeRest, localTick } from '../watch/entry/src/main/js/default/common/heart.js'

test('saving populates the summary and Done returns to idle', t => {
  const { vm, app } = mount(t)
  vm.finishPage(); vm.save()
  assert.equal(vm.summaryName, 'Training')
  assert.ok(vm.stats.length > 0)
  assert.ok(app.state.summary)
  vm.closeSummary()
  assert.equal(app.state.summary, null)
  assert.equal(vm.screen, 'idle')
})

test('a corrupt stored workout displays its error instead of loading forever', t => {
  const { vm, app } = mount(t, savedState(), { corrupt: true })
  assert.match(app.lastError, /记录损坏/)
  assert.equal(vm.error, app.lastError)
})

test('a corruption error arriving after the loading watchdog still replaces the idle view', t => {
  const f = mount(t, savedState(), { silent: true })
  f.fire(1500)
  assert.equal(f.vm.screen, 'idle')
  f.answer('{bad json')
  assert.match(f.vm.error, /记录损坏/)
  f.app.change(s => { s.sensorEnabled = true })
  assert.equal(f.writes.length, 0)
})

test('a failed initial read cannot overwrite an unread workout', t => {
  const s = savedState()
  const f = mount(t, s, { silent: true })
  f.failRead(); f.fire(1500)
  assert.equal(f.app.state, null)
  assert.match(f.vm.error, /无法读取/)
  f.app.change(s => { s.sensorEnabled = true })
  assert.equal(f.writes.length, 0)
  assert.deepEqual(f.stored, s)
})

test('an empty set page cannot skip set -1 and keeps the dot recovery path', t => {
  const s = savedState([entry('e', 1)])
  s.skipped = ['e#0']
  const { vm, app } = mount(t, s)
  assert.equal(vm.noSet, true)
  vm.askSkip(); vm.skipConfirmed(); vm.resume()
  assert.equal(app.state.entryIndex, 0)
  assert.equal(vm.screen, 'exercise')
  assert.equal(app.state.skipped.length, 1)
  vm.pickDot(0)
  assert.equal(vm.noSet, false)
})

test('the loading watchdog opens a read-only view until the saved outbox is recovered', t => {
  const s = savedState()
  s.outbox = [{ id: 'saved-event', type: 'weighIn', w: 70, at: 1000 }]
  const f = mount(t, s, { silent: true, radio: true })
  f.fire(1500)
  let changed = false
  f.app.change(state => { changed = true; state.sensorEnabled = true })
  assert.equal(changed, false)
  assert.equal(f.writes.length, 0)
  assert.equal(f.sent.length, 0)
  f.answer(JSON.stringify(s))
  f.app.tickSet(0, 0, { w: 25, r: 8 }, 10000)
  assert.ok(f.stored.outbox.some(e => e.id === 'saved-event'))
  assert.ok(f.stored.outbox.some(e => e.type === 'setDone'))
})

function combined() {
  const s = initialState()
  start(s, { name: 'Heavy + Light', routineIds: ['heavy', 'light'], entries: [entry('same', 1), entry('same', 1)] }, 1000)
  return s
}
test('skipping an exercise does not skip a second entry with the same exercise id', () => {
  const s = combined()
  skip(s, 0, 0)
  assert.equal(setIndex(s, 1), 0)
  assert.equal(s.entryIndex, 1)
})
test('an unacknowledged completion is only merged into its matching exercise entry', () => {
  let s = combined()
  const stale = copy(s.workout)
  tick(s, 0, 0, { w: 60, r: 8 }, 2000)
  s = applySnapshot(s, { v: 1, active: stale })
  assert.equal(s.workout.entries[0].sets[0].done, true)
  assert.equal(s.workout.entries[1].sets[0].done, false)
})

test('old stored keys migrate without changing event ids or marking both duplicate entries', () => {
  const s = combined(), wid = s.workout.id
  s.skipped = ['same#0']
  const event = { id: 'old-pending', type: 'setDone', at: 2000, wid, exId: 'same', entryIdx: 1, setIdx: 0, w: 40, r: 15 }
  s.outbox.push(event); s.pending = { 'same#0': event }
  const restored = restoreState(copy(s))
  assert.equal(setIndex(restored, 0), -1)
  assert.equal(setIndex(restored, 1), 0)
  const next = applySnapshot(restored, { v: 1, active: copy(s.workout) })
  assert.equal(next.workout.entries[0].sets[0].done, false)
  assert.equal(next.workout.entries[1].sets[0].done, true)
  assert.ok(next.outbox.some(e => e.id === 'old-pending'))
  assert.deepEqual(restoreState(copy(restored)), restored)
})

test('starting a routine clears the set picked in the previous one', t => {
  const f = mount(t)
  f.vm.picked = 1
  f.vm.startRoutine({ name: 'Push', entries: [] })
  assert.equal(f.vm.picked, -1)
  assert.equal(f.vm.screen, 'weigh')
})
test('the lock screen only shows a clock while a rest or hold runs', t => {
  const f = mount(t)
  f.app.change(s => { s.touchLocked = true })
  assert.equal(f.vm.lockDigits, '')
  f.app.change(s => { s.workout = { id: 'w', name: 'Training', start: 1000, restSec: 90, rest: { endsAt: 70000 }, entries: [{ id: 'a', name: 'a', mode: 'reps', sets: [{ w: 20, r: 8, done: false }] }] } })
  assert.match(f.vm.lockDigits, /^\d+:\d\d$/)
})

test('a per-side set reloads its own numbers when the side changes', t => {
  const s = savedState([{ id: 'a', name: 'a', mode: 'reps', sets: [{ sides: { L: { w: 10, r: 5, done: false }, R: { w: 20, r: 6, done: false } } }] }])
  const f = mount(t, s)
  assert.equal(f.vm.weight, '10')
  f.vm.edit('weight'); f.vm.editStepBy(1); f.vm.editDone()
  assert.equal(f.vm.weight, '12.5')
  f.app.change(st => { st.workout.entries[0].sets[0].sides.L.done = true })
  assert.equal(f.vm.weight, '20')
  assert.equal(f.vm.reps, '6')
})

test('the countdown ring stays at zero while the screen is off', t => {
  const f = mount(t)
  f.vm.screen = 'countdown'; f.vm.beginAt = 5000; f.vm.visible = false
  f.vm.tickClock()
  assert.equal(f.vm.ringPercent, 0)
  assert.equal(f.vm.remaining, 0)
})

test('rest mutations ignore a workout the phone already ended', t => {
  const f = mount(t)
  f.app.change(s => { s.workout = null })
  assert.doesNotThrow(() => { f.app.closeRestAt(20000); f.app.restMore(15000); f.app.skipSet(0, 0); f.app.startHold(0, 0, {}, 30000) })
  assert.doesNotThrow(() => { f.vm.edit('weight'); f.vm.editStepBy(1) })
  assert.equal(f.app.state.workout, null)
})

test('skip dots use the entry index when the exercise appears twice', t => {
  const s = combined()
  skip(s, 0, 0)
  const { vm, app } = mount(t, s)
  app.showEntry(0)
  assert.equal(vm.dots[0].skipped, true)
  app.showEntry(1)
  assert.equal(vm.dots[0].skipped, false)
})

test('batched phone completions keep each set and rest heart window separate', () => {
  let s = savedState(); s.setStartedAt = 1000
  const before = copy(s.workout), after = copy(before)
  after.entries[0].sets[0] = { w: 20, r: 8, done: true, at: 100000 }
  after.entries[0].sets[1] = { w: 20, r: 8, done: true, at: 200000 }
  after.rest = { endsAt: 290000 }
  s = applySnapshot(s, { v: 1, active: after })
  mergeHeart(s, before, [{ at: 95000, value: 90 }, { at: 195000, value: 120 }], 210000)
  assert.ok(s.outbox.some(e => e.type === 'setHr' && e.setIdx === 1 && e.hr?.avg === 120))
  assert.ok(!s.outbox.some(e => e.setIdx === 0 && e.restHr?.avg === 120))
})
test('joining a phone workout during rest does not count rest samples in the next set', () => {
  const active = savedState().workout
  active.entries[0].sets[0] = { w: 20, r: 8, done: true, at: 2000 }
  active.rest = { endsAt: 5000 }
  const s = applySnapshot(initialState(), { v: 1, active })
  mergeHeart(s, null, [], 3000)
  closeRest(s, [{ at: 3000, value: 80 }], 5000)
  s.workout.rest = null
  assert.deepEqual(localTick(s, [{ at: 3000, value: 80 }, { at: 6000, value: 160 }], 7000), { avg: 160, max: 160 })
})

test('skipping the rest after joining starts the next heart window immediately', () => {
  const active = savedState().workout
  active.entries[0].sets[0] = { done: true, at: 2000 }
  active.rest = { endsAt: 5000 }
  const s = applySnapshot(initialState(), { v: 1, active })
  mergeHeart(s, null, [], 3000)
  const samples = [{ at: 3500, value: 80 }, { at: 4500, value: 160 }]
  closeRest(s, samples, 4000); s.workout.rest = null
  assert.deepEqual(localTick(s, samples, 4800), { avg: 160, max: 160 })
})
