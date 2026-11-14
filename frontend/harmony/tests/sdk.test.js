import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { waitForSdk } from '../watch/entry/src/main/js/default/common/sdk-ready.js'
import { createRuntime } from '../watch/entry/src/main/js/default/common/controller.js'
import { packets, assembler } from '../watch/entry/src/main/js/default/common/wire.js'
const source = readFileSync(new URL('../watch/entry/src/main/js/default/vendor/wearengine.js', import.meta.url), 'utf8')
function loadSdk(native) {
  const body = source.replace('import wearengine from "@system.wearengine";', '')
    .replace('export { P2pClient, Message, Builder, PeerDeviceClient };', 'return { P2pClient, Message, Builder, PeerDeviceClient };')
  return new Function('wearengine', 'console', body)(native, { info() {}, error() {} })
}
test('vendored SDK is byte-for-byte the Huawei archive entry', () => {
  assert.equal(createHash('sha256').update(source).digest('hex'), '8c7f1100c840abdb237991b0d436ef9ab49a215269c5fecdb3dd59fe63a71471')
})
test('waits for the actual SDK asynchronous version probe before registering and sending', () => {
  let probe, subscription, sent, registered = false, received
  const native = { getWearEngineVersion(o) { probe = o.complete }, setPackageName(o) { o.complete() }, setFingerprint(o) { o.complete() },
    unsubscribeMsg() {}, subscribeMsg(o) { subscription = o; o.success({ isRegister: true }) },
    sendMsg(o) { sent = o; o.success() } }
  const { P2pClient, Builder, Message } = loadSdk(native), client = new P2pClient(), tasks = []
  waitForSdk(client, fn => tasks.push(fn), () => {
    client.setPeerPkgName('host.msknet.opengym.phone'); client.setPeerFingerPrint('A'.repeat(64))
    client.registerReceiver({ onSuccess() { registered = true }, onFailure() { assert.fail('unexpected failure') }, onReceiveMessage(v) { received = v } })
  }, assert.fail)
  assert.equal(registered, false)
  probe('1.0.0.401'); tasks.shift()(); assert.equal(registered, true)
  const builder = new Builder(), message = new Message(); builder.setDescription('wire-packet'); message.builder = builder
  let code
  client.send(message, { onSuccess() {}, onFailure() { assert.fail('send failed') }, onSendResult(v) { code = v.code }, onSendProgress() {} })
  assert.equal(code, 207); assert.equal(sent.message, 'wire-packet'); assert.equal(sent.bundleName, 'host.msknet.opengym.phone')
  subscription.success({ message: 'incoming packet' }); assert.equal(received, 'incoming packet')
  subscription.success({ isFileType: true, file: 'internal://app/og-a-0.png' }); assert.equal(received.name, 'internal://app/og-a-0.png')
})
test('an unavailable version fails explicitly and never registers a fake transport', () => {
  let done = 0, failed = 0
  waitForSdk({ version: 0 }, () => {}, () => done++, () => failed++)
  assert.equal(done, 0); assert.equal(failed, 1)
})

function watchLink() {
  let subscription, phoneReady = false, detects = 0, state, saved
  const received = [], decode = assembler(), tasks = new Set()
  const native = {
    getWearEngineVersion(o) { o.complete('1.0.0.401') },
    setPackageName(o) { o.complete() }, setFingerprint(o) { o.complete() },
    unsubscribeMsg() {}, subscribeMsg(o) { subscription = o; o.success({ isRegister: true }) },
    detect(o) { detects++; o.success() },
    sendMsg(o) {
      if (!phoneReady) { o.fail('phone receiver not ready', 206); return }
      const result = decode(o.message, Date.now())
      if (result) received.push(result.payload)
      o.success()
    }
  }
  const { P2pClient, Message, Builder } = loadSdk(native)
  const runtime = createRuntime({
    client: new P2pClient(), Message, Builder,
    peer: { phonePackage: 'host.msknet.opengym.phone', phoneFingerprint: 'A'.repeat(64) },
    storage: { get(o) { o.success('') }, set(o) { if (o.key === 'opengym-fit-v1') saved = JSON.parse(o.value); o.success() } },
    setTimeout(fn) { tasks.add(fn); return fn }, clearTimeout(fn) { tasks.delete(fn) },
    setInterval(fn) { tasks.add(fn); return fn }, clearInterval(fn) { tasks.delete(fn) },
    sensor: {}, vibrator: {}
  }, s => { state = s }, () => {})
  const deliver = (payload, id) => { for (const text of packets(payload, id)) subscription.success({ message: text }) }
  return { runtime, received, deliver, get detects() { return detects }, get state() { return state }, get saved() { return saved },
    openPhone() { phoneReady = true },
    request() { deliver({ kind: 'helloRequest' }, 'phone-ready') }
  }
}

test('phone registration recovers a hello sent before its receiver existed without waiting for a minute', () => {
  const f = watchLink()
  f.runtime.load()
  assert.equal(f.received.length, 0)
  assert.equal(f.runtime.radioStatus(), 'sdk:401 rx:ok tx:206')
  f.openPhone()
  f.request()
  assert.equal(f.received.length, 1)
  assert.equal(f.received[0].kind, 'hello')
  assert.ok(f.received[0].boot)
  assert.equal(f.runtime.radioStatus(), 'sdk:401 rx:ok tx:207')
  const ready = { today: { name: '下肢训练', entries: [] }, others: [] }
  f.deliver({ kind: 'snapshot', snapshot: { v: 1, unit: 'kg', active: null, ready } }, 'first-plan')
  assert.deepEqual(f.state.ready, ready)
  assert.deepEqual(f.saved.ready, ready)
  assert.ok(f.received.some(p => p.kind === 'snapshotAck' && p.id === 'first-plan'))
  f.runtime.stop()
})

test('the real runtime never uses native installation detection to register or send hello', () => {
  const f = watchLink()
  f.openPhone()
  f.runtime.load()
  assert.equal(f.received[0].kind, 'hello')
  assert.equal(f.detects, 0)
  f.runtime.stop()
})
