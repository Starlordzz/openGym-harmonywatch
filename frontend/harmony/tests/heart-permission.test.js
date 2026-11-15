import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './helpers/watch.js'
import { heartPermission } from '../watch/entry/src/main/js/default/common/heart-permission.js'

function permissionFixture(api) {
  const timers = [], results = []
  const cancel = heartPermission(() => api, (...args) => results.push(args), (fn, ms) => {
    const task = { fn, ms, active: true }; timers.push(task); return task
  }, task => { if (task) task.active = false })
  return { results, cancel, expire() { for (const task of timers) if (task.active) task.fn() } }
}

test('FA permission request uses the declared health permission and the callback result', () => {
  let reply
  const f = permissionFixture({ getContext: () => ({ requestPermissionsFromUser(names, id, done) {
    assert.deepEqual(names, ['ohos.permission.READ_HEALTH_DATA']); assert.equal(id, 1); reply = done
  } }) })
  assert.equal(f.results.length, 0)
  reply(undefined, { authResults: [0] }); f.expire()
  assert.deepEqual(f.results, [['', 'authResults: [0]']])
})

test('missing FA permission APIs report an actionable error without throwing', () => {
  const f = permissionFixture({})
  assert.deepEqual(f.results, [['AUTHAPI', 'FA permission API unavailable']])
})

test('permission timeout and cancellation ignore late native answers', () => {
  let reply
  const api = { getContext: () => ({ requestPermissionsFromUser(p, id, done) { reply = done } }) }
  const f = permissionFixture(api)
  f.expire(); reply(undefined, { authResults: [0] })
  assert.deepEqual(f.results, [['AUTHTIME', 'permission request timed out']])
  const cancelled = permissionFixture(api)
  cancelled.cancel(); reply(undefined, { authResults: [0] }); cancelled.expire()
  assert.equal(cancelled.results.length, 0)
})

test('manually enabling heart collection requests permission before subscribing', t => {
  let answer
  const f = mount(t, undefined, { heartPermission(done) { answer = done } })
  assert.equal(answer, undefined)
  f.vm.toggleSensor()
  assert.equal(typeof answer, 'function')
  assert.equal(f.sensorCalls.includes('start'), false)
  answer('', '')
  assert.equal(f.sensorCalls.at(-1), 'start')
})

test('denied heart permission is visible and never starts the sensor', t => {
  const f = mount(t, undefined, { heartPermission(done) { done('AUTHDENIED', 'authResults: -1') } })
  f.vm.toggleSensor()
  assert.equal(f.sensorCalls.includes('start'), false)
  assert.match(f.vm.hr, /EAUTHDENIED/)
  assert.match(f.app.lastError, /authResults: -1/)
})

test('permission results arriving after collection was disabled cannot restart it', t => {
  const answers = []
  const f = mount(t, undefined, { heartPermission(done) { answers.push(done); return () => {} } })
  f.vm.toggleSensor(); f.vm.toggleSensor()
  assert.deepEqual(f.sensorCalls, [])
  f.vm.toggleSensor()
  assert.equal(answers.length, 2)
  answers[0]('', '')
  assert.equal(f.sensorCalls.includes('start'), false)
  answers[1]('', '')
  assert.equal(f.sensorCalls.at(-1), 'start')
})
