import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stateStorage } from '../watch/entry/src/main/js/default/common/state-storage.js'
import { createRuntime } from '../watch/entry/src/main/js/default/common/controller.js'
import { packets, assembler } from '../watch/entry/src/main/js/default/common/wire.js'

function disk() {
  const kv = {}, files = {}, reads = [], writes = []
  let failAppend = false, failCommit = false
  const storage = {
    get(o) { o.success(kv[o.key] || o.default || '') },
    set(o) {
      assert.ok(Buffer.byteLength(o.value) < 128, 'Lite storage values must stay below 128 bytes')
      if (failCommit) { o.fail('metadata I/O', 300); return }
      kv[o.key] = o.value; o.success()
    }
  }
  const file = {
    delete(o) { if (!(o.uri in files)) { o.fail('missing', 301); return }; delete files[o.uri]; o.success() },
    writeText(o) {
      assert.ok(Buffer.byteLength(o.text) <= 4096)
      writes.push(o.uri)
      if (failAppend && o.append) { o.fail('disk full', 300); return }
      files[o.uri] = (o.append ? files[o.uri] || '' : '') + o.text; o.success()
    },
    readText(o) {
      assert.ok(o.length > 0 && o.length <= 4096)
      reads.push(o.position)
      if (!(o.uri in files)) { o.fail('missing', 301); return }
      o.success({ text: files[o.uri].slice(o.position, o.position + o.length) })
    }
  }
  const read = () => { let value, error; stateStorage(storage, file).get({ key: 'opengym-fit-v1', success(v) { value = v }, fail(e) { error = e } }); return { value, error } }
  return { storage, file, kv, files, reads, writes, read,
    failAppend(v) { failAppend = v }, failCommit(v) { failCommit = v } }
}
function write(adapter, value) {
  let ok = false, error
  adapter.set({ key: 'opengym-fit-v1', value, success() { ok = true }, fail(e) { error = e } })
  return { ok, error }
}
test('large Unicode state survives fresh runtime storage with 128-byte KV and 4-KiB reads', () => {
  const d = disk(), s = stateStorage(d.storage, d.file)
  s.get({ key: 'opengym-fit-v1', success() {}, fail: assert.fail })
  const state = JSON.stringify({ ready: '深蹲🏋️'.repeat(1500), outbox: [{ id: 'unsent' }] })
  assert.equal(write(s, state).ok, true)
  assert.equal(d.read().value, state)
  assert.ok(d.reads.length > 1)
  assert.ok(Object.values(d.kv).every(v => Buffer.byteLength(v) < 128))
})
test('partial file write and failed index commit keep the previous complete state', () => {
  const d = disk(), s = stateStorage(d.storage, d.file)
  assert.equal(write(s, 'old state').ok, true)
  d.failAppend(true)
  assert.ok(write(s, '新记录'.repeat(1000)).error)
  assert.equal(d.read().value, 'old state')
  d.failAppend(false); d.failCommit(true)
  assert.ok(write(s, 'uncommitted').error)
  assert.equal(d.read().value, 'old state')
  d.failCommit(false)
  assert.equal(write(s, 'short').ok, true)
  assert.equal(d.read().value, 'short')
})
test('legacy JSON is read before migration and a truncated committed file fails visibly', () => {
  const d = disk(), legacy = '{"outbox":[]}'
  d.kv['opengym-fit-v1'] = legacy
  const s = stateStorage(d.storage, d.file)
  assert.equal(d.read().value, legacy)
  assert.equal(write(s, legacy).ok, true)
  const uri = d.writes.at(-1)
  d.files[uri] = d.files[uri].slice(0, -1)
  assert.ok(d.read().error)
})
test('real controller acknowledges a large snapshot only after file and small index commit', () => {
  const d = disk(), outgoing = [], decode = assembler(), tasks = [], errors = []
  let receiver, state
  const rt = createRuntime({
    storage: stateStorage(d.storage, d.file), peer: { phonePackage: 'test', phoneFingerprint: 'A' },
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o; o.onSuccess() }, unregisterReceiver() {},
      send(m, cb) { const p = decode(m.builder.text, Date.now()); if (p) outgoing.push(p.payload); cb.onSendResult({ code: 207 }) } },
    Builder: class { setDescription(text) { this.text = text } }, Message: class {},
    setTimeout(fn) { tasks.push(fn); return fn }, clearTimeout() {}, setInterval() {}, clearInterval() {}, sensor: {}, vibrator: {}
  }, s => { state = s }, e => errors.push(e))
  rt.load(); outgoing.length = 0; d.failCommit(true)
  const ready = { today: { name: '训练'.repeat(1000), entries: [] }, others: [] }
  for (const p of packets({ kind: 'snapshot', snapshot: { v: 1, active: null, ready } }, 'large-plan')) receiver.onReceiveMessage(p)
  assert.equal(outgoing.some(p => p.kind === 'snapshotAck'), false)
  assert.ok(errors.length)
  d.failCommit(false)
  for (const fn of tasks.splice(0)) fn()
  assert.ok(outgoing.some(p => p.kind === 'snapshotAck' && p.id === 'large-plan'))
  assert.deepEqual(JSON.parse(d.read().value).ready, ready)
  assert.deepEqual(state.ready, ready)
  rt.stop()
})
test('split ready storage skips rewriting og-ready when ready is unchanged across state saves', () => {
  const d = disk(), adapter = stateStorage(d.storage, d.file)
  const ready = { today: { name: 'Push', entries: [] }, others: [] }
  const first = JSON.stringify({ workout: null, ready, outbox: [] })
  assert.equal(write(adapter, first).ok, true)
  assert.match(d.kv['opengym-fit-v1'], /^@[01]:\d+:[01]:\d+$/)
  const writesBefore = d.writes.length
  const second = JSON.stringify({ workout: { id: 'w1', entries: [] }, ready, outbox: [{ id: 'e1' }] })
  assert.equal(write(adapter, second).ok, true)
  assert.equal(d.writes.length, writesBefore + 1)
  assert.match(d.writes.at(-1), /og-state/)
  assert.equal(d.read().value, second)
})
