import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRestRelay } from '../watch/entry/src/main/js/default/common/rest-relay.js'
import { assembler } from '../watch/entry/src/main/js/default/common/wire.js'
import { mount } from './helpers/watch.js'

function fixture() {
  let time = 1000
  const sent = [], s = { settings: {}, workout: null }
  const relay = createRestRelay(p => sent.push(p), () => time, 'boot-test')
  return { relay, sent, s, time(v) { time = v } }
}
test('relays a deadline, retries it, and cancels an early skip', () => {
  const f = fixture(); f.relay.update(f.s); assert.equal(f.sent.length, 0)
  f.s.workout = { id: 'w', rest: { endsAt: 91000 } }
  f.relay.update(f.s)
  assert.deepEqual(f.sent[0], { kind: 'restAlarm', boot: 'boot-test', at: 91000, rev: 1000, enabled: true })
  f.time(2000); f.relay.update(f.s); assert.equal(f.sent.length, 1)
  f.relay.reset(); f.relay.update(f.s); assert.equal(f.sent.length, 2)
  f.time(33000); f.relay.update(f.s); assert.equal(f.sent.length, 3)
  f.s.workout.rest = null; f.relay.update(f.s); assert.equal(f.sent.at(-1).at, 0)
})
test('normal expiry does not race and cancel the phone alarm at its deadline', () => {
  const f = fixture(); f.s.workout = { id: 'w', rest: { endsAt: 91000 } }
  f.relay.update(f.s)
  f.time(91000); f.s.workout.rest = null; f.relay.update(f.s)
  assert.equal(f.sent.length, 1)
  f.s.workout = null; f.relay.update(f.s)
  assert.equal(f.sent.at(-1).at, 0)
})
test('adding rest time replaces the deadline and disabling haptics cancels it', () => {
  const f = fixture(); f.s.workout = { id: 'w', rest: { endsAt: 91000 } }
  f.relay.update(f.s)
  f.s.workout.rest.endsAt += 15000; f.time(2000); f.relay.update(f.s)
  assert.equal(f.sent.at(-1).at, 106000)
  f.s.settings.restHaptics = false; f.relay.update(f.s)
  assert.equal(f.sent.at(-1).enabled, false)
})
test('the real page persists the set and sends its rest deadline through Wear Engine', t => {
  const f = mount(t, undefined, { radio: true }), decode = assembler()
  f.vm.done()
  const messages = f.sent.map(part => decode(part, Date.now())).filter(Boolean).map(m => m.payload)
  const alert = messages.find(m => m.kind === 'restAlarm')
  assert.ok(alert)
  assert.equal(alert.at, f.stored.workout.rest.endsAt)
  assert.ok(f.stored.outbox.some(e => e.type === 'setDone'))
  const before = f.sent.length
  f.vm.restSkip()
  const cancelled = f.sent.slice(before).map(part => decode(part, Date.now())).filter(Boolean).map(m => m.payload)
  assert.equal(cancelled.find(m => m.kind === 'restAlarm').at, 0)
})
