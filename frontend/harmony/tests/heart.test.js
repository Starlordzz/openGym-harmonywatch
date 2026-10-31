import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialState, start, tick } from '../watch/entry/src/main/js/default/common/session.js'
import { localTick, afterTick, closeRest, phoneTicks, mergeHeart, stats } from '../watch/entry/src/main/js/default/common/heart.js'
const samples = [{ at: 1500, value: 80 }, { at: 1900, value: 100 }, { at: 2500, value: 120 }, { at: 2900, value: 130 }, { at: 2700, value: 255 }]
function state() { var s = initialState(); start(s, { name: 'test', entries: [{ id: 'a', sets: [{}, {}] }], routineIds: ['r'] }, 1000); return s }
test('filters invalid sensor values and restricts both time boundaries', () => {
  assert.deepEqual(stats(samples, 2000, 3000), { avg: 125, max: 130 })
  assert.equal(stats(samples, 3000, 4000), null)
})
test('set and rest windows attach to their own set, rest closes once', () => {
  const s = state(), hr = localTick(s, samples, 2000)
  assert.deepEqual(hr, { avg: 90, max: 100 })
  tick(s, 0, 0, { hr }, 2000); afterTick(s, 0, 0, 2000)
  closeRest(s, samples, 3000); closeRest(s, samples, 3000)
  assert.equal(s.outbox.filter(e => e.type === 'setHr').length, 1)
  assert.deepEqual(s.outbox.at(-1).restHr, { avg: 125, max: 130 })
  assert.equal(s.outbox.at(-1).setIdx, 0)
})
test('phone-ticked sets produce sensor events once and ignore future/old ticks', () => {
  const s = state(), before = JSON.parse(JSON.stringify(s.workout))
  s.workout.entries[0].sets[0] = { done: true, at: 2000 }
  assert.equal(phoneTicks(before, s.workout).length, 1)
  mergeHeart(s, before, samples, 3000)
  assert.deepEqual(s.outbox.at(-1).hr, { avg: 90, max: 100 })
  const count = s.outbox.length
  mergeHeart(s, s.workout, samples, 3000); assert.equal(s.outbox.length, count)
})
test('late rest recovery caps its heart samples at the saved deadline', () => {
  const s = state(); tick(s, 0, 0, {}, 2000); afterTick(s, 0, 0, 2000)
  s.workout.rest.endsAt = 3000
  closeRest(s, samples.concat([{ at: 4000, value: 200 }]), 5000)
  assert.deepEqual(s.outbox.at(-1).restHr, { avg: 125, max: 130 })
  assert.equal(s.setStartedAt, 3000)
})
test('the next set window excludes the preceding rest when it closes at the tick', () => {
  const s = state(); tick(s, 0, 0, {}, 2000); afterTick(s, 0, 0, 2000)
  s.workout.rest.endsAt = 3000
  assert.deepEqual(localTick(s, samples.concat([{ at: 4000, value: 160 }]), 4500), { avg: 160, max: 160 })
})
