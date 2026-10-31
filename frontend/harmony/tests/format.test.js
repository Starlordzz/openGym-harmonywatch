import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatNumber, numberFont, numberWidth, clock, grouped, effortValue, effortPosition, effortBand, effortStart, effortColor, setDots } from '../watch/entry/src/main/js/default/common/format.js'
import { numbers, tagsOf, progress, setsOf, summaryStats } from '../watch/entry/src/main/js/default/common/view.js'

test('numbers omit trailing zeroes and preserve hundredths for fractional plates', () => {
  assert.equal(formatNumber(60), '60')
  assert.equal(formatNumber(62.5), '62.5')
  assert.equal(formatNumber(0), '0')
  assert.equal(formatNumber(79.95), '79.95')
  assert.equal(formatNumber(2.25), '2.25')
  assert.equal(formatNumber(0.1 + 0.2), '0.3')
  assert.equal(formatNumber(NaN), '0')
})

test('countdowns are m:ss counting down and volume is grouped', () => {
  assert.equal(clock(90), '1:30')
  assert.equal(clock(90.2), '1:31')
  assert.equal(clock(0), '0:00')
  assert.equal(clock(-3), '0:00')
  assert.equal(grouped(12345), '12,345')
  assert.equal(grouped(999), '999')
  assert.equal(grouped(0), '0')
})

test('effort uses the phone notches, bands and starting points', () => {
  assert.equal(effortValue('rpe', 0), null)
  assert.equal(effortValue('rpe', 1), 6)
  assert.equal(effortValue('rpe', 9), 10)
  assert.equal(effortValue('rir', 1), 5)
  assert.equal(effortValue('rir', 6), 0)
  assert.equal(effortPosition('rpe', null), 0)
  assert.equal(effortPosition('rpe', 8), 5)
  assert.equal(effortPosition('rir', 2), 4)
  assert.equal(effortPosition('rir', 9), 1)
  assert.equal(effortStart('rpe'), 8)
  assert.equal(effortStart('rir'), 2)
  assert.equal(effortBand('rpe', 10), 0)
  assert.equal(effortBand('rpe', 6), 5)
  assert.equal(effortBand('rir', 0), 0)
  assert.equal(effortColor('rpe', null), '#ffffff')
  assert.equal(effortColor('rpe', 10), '#bf5af2')
})

test('set dots mark done, half, current and skipped sets', () => {
  const entry = { id: 'a', sets: [
    { done: true, warmup: true },
    { done: false, sides: { L: { done: true }, R: { done: false } } },
    { done: false }
  ] }
  const dots = setDots(entry, 2, ['a#2'])
  assert.equal(dots.length, 3)
  assert.equal(dots[0].size, 6)
  assert.equal(dots[0].fill, '#ff9f0a')
  assert.equal(dots[1].size, 9)
  assert.equal(dots[1].opacity, 0.5)
  assert.equal(dots[0].opacity, 1)
  assert.equal(dots[2].border, 1.5)
  assert.equal(dots[2].borderColor, '#ffffff')
  const skipped = setDots({ id: 'a', sets: [{ done: false }, { done: false }] }, 0, ['a#1'])
  assert.equal(skipped[1].border, 1)
  assert.equal(skipped[1].borderColor, '#9a9a9a')
  assert.equal(setDots({ id: 'a', sets: [{ done: false }] }, -1, [])[0].border, 0)
})

test('an entry page reads the live number on the current set and the set value elsewhere', () => {
  const entry = { id: 'a', name: 'Squat', mode: 'reps', bodyweight: true, sets: [{ w: 5, r: 8 }] }
  const live = numbers(entry, entry.sets[0], { weight: 7.5, reps: 9, seconds: 30 })
  assert.deepEqual([live.weight, live.added, live.reps, live.bodyweight, live.timed], ['7.5', '+7.5 kg'.slice(0, 4), '9', true, false])
  const stored = numbers(entry, entry.sets[0], {})
  assert.deepEqual([stored.weight, stored.reps], ['5', '8'])
  const timed = numbers({ mode: 'time', sets: [{ sec: 45 }] }, { sec: 45 }, {})
  assert.deepEqual([timed.timed, timed.seconds], [true, '45'])
  const cardio = numbers({ mode: 'cardio', sets: [{}] }, {}, {})
  assert.equal(cardio.cardio, true)
})

test('tags come from the warm-up flag, the side up next and the superset group', () => {
  assert.deepEqual(tagsOf({ group: 'g' }, { warmup: true, sides: { L: { done: false }, R: { done: false } } }),
    { warmup: true, left: true, right: false, superset: true })
  assert.deepEqual(tagsOf({}, { sides: { L: { done: true }, R: { done: false } } }),
    { warmup: false, left: false, right: true, superset: false })
  assert.deepEqual(tagsOf({}, { done: false }), { warmup: false, left: false, right: false, superset: false })
})

test('progress counts non-warm-up sets and both sides count once', () => {
  const s = { workout: { entries: [
    { sets: [{ warmup: true }, { done: true }, { done: true, sides: { L: { done: true }, R: { done: true } } }] },
    { sets: [{ done: false }] }
  ] } }
  assert.deepEqual(progress(s), { done: 2, total: 3 })
  assert.deepEqual(progress({ workout: null }), { done: 0, total: 0 })
  assert.equal(setsOf('%lld of %lld sets', { done: 3, total: 12 }), '3 of 12 sets')
  assert.equal(setsOf('%lld of %lld sets', { done: 0, total: 0 }), '')
})

test('the summary lists time, sets, volume and heart rate', () => {
  const words = { time: 'Time', sets: 'Sets', volume: 'Volume', heart: 'Heart rate' }
  const stats = summaryStats({ seconds: 3120, sets: 12, volume: 12345, hrAvg: 128.4, hrMax: 165.6 }, words, 'kg')
  assert.deepEqual(stats.map(s => s.value), ['52:00', '12', '12,345 kg', '128 / 166'])
  assert.equal(stats[3].color, '#ff453a')
  assert.deepEqual(summaryStats({ seconds: 60, sets: 1, volume: 0 }, words, 'kg').map(s => s.key), ['time', 'sets'])
})


test('watch-size numbers stay large and long decimal weights shrink to fit beside their unit', () => {
  assert.equal(numberFont('60', 68, 124), 68)
  assert.equal(numberWidth('60', 68), 77)
  assert.ok(numberWidth('102.5', numberFont('102.5', 68, 124)) <= 124)
  assert.equal(numberFont('102.5', 68, 124), 49)
  assert.equal(numberFont('1500', 68, 124), 55)
  assert.equal(numberFont('3600', 84, 280), 84)
  assert.ok(numberFont('123456789', 68, 124) >= 34)
})
