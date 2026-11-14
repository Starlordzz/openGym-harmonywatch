import { readFile } from 'node:fs/promises'
import { createRuntime } from '../../watch/entry/src/main/js/default/common/controller.js'
import { initialState } from '../../watch/entry/src/main/js/default/common/session.js'
import { packets } from '../../watch/entry/src/main/js/default/common/wire.js'
import { keepForensics } from '../../../../scripts/harmony/strip-forensics.mjs'

const root = new URL('../../watch/entry/src/main/js/default/', import.meta.url)
const staged = async path => keepForensics(await readFile(new URL(path, root), 'utf8'))
// The harness mounts the forensics build (the U13 package on the device), with the markers
// resolved exactly the way scripts/harmony/prepare.mjs --forensics resolves them.
let source = await staged('app.js')
source = source.replace("import { runtime } from './common/runtime.js'",
  'function runtime(changed, failure) { return globalThis.__watchTestRuntime(changed, failure) }')
source = source.replace(/from '(\.\.?\/[^']+)'/g, (_, path) => "from '" + new URL(path, root).href + "'")
const { default: appOptions } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const pageUrl = new URL('pages/index/index.js', root)
source = (await staged('pages/index/index.js')).replace(/from '(\.\.?\/[^']+)'/g, (_, path) => "from '" + new URL(path, pageUrl).href + "'")
const { default: page } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

export const copy = value => JSON.parse(JSON.stringify(value))
export const entry = (id = 'a', count = 2) => ({ id, name: id, mode: 'reps', sets: Array.from({ length: count }, () => ({ w: 20, r: 8, done: false })) })
export function savedState(entries = [entry()]) {
  return { ...initialState(), workout: { id: 'w', name: 'Training', start: 1000, restSec: 90, rest: null, entries } }
}

// Real app + controller + page. Only native I/O, timers and the framework's getApp are replaced.
export function mount(t, saved = savedState(), { silent = false, corrupt = false, radio = false, lastTrace = '', lastBoot = '', lastBootPrev = '' } = {}) {
  let now = 10000, stored = corrupt ? '{bad json' : JSON.stringify(saved), get, receiver, heartCallbacks
  const timers = [], intervals = [], writes = [], traces = [], boots = [], bootsPrev = [], sent = [], vibrations = [], vibrationModes = [], sensorCalls = [], screenRequests = []
  const extra = new Map([['opengym-fit-trace', lastTrace], ['opengym-fit-boot', lastBoot], ['opengym-fit-boot-prev', lastBootPrev]])
  const schedule = (fn, ms) => { const task = { fn, ms, active: true }; timers.push(task); return task }
  const cancel = task => { if (task) task.active = false }
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setTimeout', schedule)
  t.mock.method(globalThis, 'clearTimeout', cancel)
  t.mock.method(globalThis, 'setInterval', (fn, ms) => { const task = { fn, ms, active: true }; intervals.push(task); return task })
  t.mock.method(globalThis, 'clearInterval', cancel)
  const platform = { available: radio, now: () => now,
    storage: { get(o) { if (o.key === 'opengym-fit-v1') { get = o; if (!silent) o.success(stored) } else o.success(extra.get(o.key) || o.default || '') },
      set(o) { if (o.key === 'opengym-fit-v1') { stored = o.value; writes.push(copy(JSON.parse(stored))) } else { extra.set(o.key, o.value); (o.key === 'opengym-fit-boot' ? boots : o.key === 'opengym-fit-boot-prev' ? bootsPrev : traces).push(o.value) } o.success() } },
    vibrator: { vibrate(o) { vibrations.push(now); vibrationModes.push(o.mode) } },
    brightness: { setKeepScreenOn(o) { screenRequests.push(o.keepScreenOn); if (o.success) o.success() } },
    sensor: { subscribeHeartRate(o) { heartCallbacks = o; sensorCalls.push('start') }, unsubscribeHeartRate() { sensorCalls.push('stop') } },
    setTimeout: schedule, clearTimeout: cancel, setInterval: () => null, clearInterval() {},
    client: { setPeerPkgName() {}, setPeerFingerPrint() {}, registerReceiver(o) { receiver = o; o.onSuccess() }, unregisterReceiver(o) { o.onSuccess() },
      ping(o) { o.onPingResult({ code: 201 }) }, send(message, o) { sent.push(message.builder.text); o.onSendResult({ code: 207 }) } },
    peer: { phonePackage: 'test', phoneFingerprint: 'test' }, Builder: class { setDescription(text) { this.text = text } }, Message: class {} }
  const oldRuntime = globalThis.__watchTestRuntime, oldGetApp = globalThis.getApp
  globalThis.__watchTestRuntime = (changed, failure) => createRuntime(platform, changed, failure)
  const app = copy(appOptions.data)
  for (const [name, fn] of Object.entries(appOptions)) if (typeof fn === 'function') app[name] = fn.bind(app)
  app.onCreate()
  globalThis.getApp = () => app
  const vm = copy(page.data)
  for (const [name, fn] of Object.entries(page)) if (typeof fn === 'function') vm[name] = fn.bind(vm)
  vm.onInit()
  t.after(() => {
    vm.onDestroy(); app.onDestroy()
    if (oldGetApp === undefined) delete globalThis.getApp; else globalThis.getApp = oldGetApp
    if (oldRuntime === undefined) delete globalThis.__watchTestRuntime; else globalThis.__watchTestRuntime = oldRuntime
  })
  return { app, vm, writes, traces, boots, bootsPrev, sent, vibrations, vibrationModes, sensorCalls, screenRequests, intervals, get stored() { return JSON.parse(stored) },
    sampleHeart(value) { heartCallbacks.success({ heartRate: value }) }, failHeart() { heartCallbacks.fail() },
    time(at) { now = at },
    fire(ms) { for (const task of timers.slice()) if (task.active && task.ms === ms) { task.active = false; task.fn() } },
    answer(text) { get.success(text) }, failRead() { get.fail() },
    receive(payload) { for (const part of packets(payload, 'phone-test')) receiver.onReceiveMessage(part) } }
}
