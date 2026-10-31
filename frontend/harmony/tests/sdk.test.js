import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { waitForSdk } from '../watch/entry/src/main/js/default/common/sdk-ready.js'
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
