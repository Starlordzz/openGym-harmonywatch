import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount, savedState } from './helpers/watch.js'

test('retired Huawei heart controls ignore old enabled settings while keeping recorded data', t => {
  const saved = savedState(); saved.sensorEnabled = true
  saved.workout.entries[0].sets[0].hr = { avg: 120, max: 140 }
  saved.outbox = [{ id: 'old-hr', type: 'setHr', hr: { avg: 120, max: 140 } }]
  const f = mount(t, saved)
  assert.equal(f.vm.toggleSensor, undefined)
  assert.equal(f.app.sensor, undefined)
  assert.equal(f.app.heartStart, undefined)
  assert.equal(f.app.state.sensorEnabled, undefined)
  assert.deepEqual(f.sensorCalls, [])
  assert.deepEqual(f.app.state.workout.entries[0].sets[0].hr, { avg: 120, max: 140 })
  assert.equal(f.app.state.outbox[0].id, 'old-hr')
})

test('debug remains available without heart controls', t => {
  const f = mount(t)
  f.app.lastError = '连接中断'
  f.vm.openDebug(); f.vm.sync()
  assert.equal(f.vm.screen, 'debug')
  assert.match(f.vm.debugLines.map(v => v.text).join(''), /连接中断/)
  f.vm.closeDebug()
  assert.equal(f.vm.screen, 'exercise')
})
