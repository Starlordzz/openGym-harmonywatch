import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './helpers/watch.js'
import { fileCleaner } from '../watch/entry/src/main/js/default/common/file-cleaner.js'
import { numberWidth } from '../watch/entry/src/main/js/default/common/format.js'

test('heart feedback shows off, measuring, real bpm, stale data and unavailable on training/rest screens', t => {
  const f = mount(t)
  assert.match(f.vm.hr, /关/)
  f.vm.toggleSensor()
  assert.match(f.vm.hr, /测量/)
  f.sampleHeart(128); f.time(11000); f.vm.tickClock()
  assert.match(f.vm.hr, /128 bpm/)
  f.vm.done()
  assert.equal(f.vm.screen, 'rest')
  assert.match(f.vm.hr, /128 bpm/)
  f.time(30000); f.vm.tickClock()
  assert.match(f.vm.hr, /暂无/)
  f.failHeart()
  assert.match(f.vm.hr, /不可用/)
})
test('animation cleanup waits for each native delete callback and spaces subsequent requests', () => {
  const requests = [], tasks = []
  const remove = fileCleaner({ delete(o) { requests.push(o) } }, fn => tasks.push(fn))
  remove('first'); remove('second')
  assert.equal(requests.length, 1)
  requests[0].success()
  assert.equal(requests.length, 1)
  tasks.shift()()
  assert.equal(requests[1].uri, 'second')
  requests[1].fail(); tasks.shift()()
  assert.equal(requests.length, 2)
})
test('turning heart collection off preserves existing samples for the workout summary', t => {
  const f = mount(t)
  f.vm.toggleSensor(); f.sampleHeart(128)
  f.vm.toggleSensor()
  assert.equal(f.app.samples().length, 1)
  f.app.finishWorkout(11000, false)
  assert.equal(f.app.state.summary.hrAvg, 128)
  assert.equal(f.app.state.summary.hrMax, 128)
})
test('heart subscription errors expose the native error code and message instead of a generic unavailable state', t => {
  const f = mount(t)
  f.vm.toggleSensor()
  f.failHeart('native sensor rejected request', 201)
  assert.match(f.vm.hr, /E201/)
  assert.match(f.app.lastError, /201.*native sensor rejected request/)
})
test('the numeric edit screen refits long values after each adjustment', t => {
  const f = mount(t)
  f.vm.reps = '123456789'; f.vm.edit('reps')
  assert.ok(numberWidth(f.vm.editValue, f.vm.editFont) <= 280)
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '123456790')
  assert.ok(numberWidth(f.vm.editValue, f.vm.editFont) <= 280)
})
