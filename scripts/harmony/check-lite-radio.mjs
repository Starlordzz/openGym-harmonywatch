import vm from 'node:vm'

// Run the compiled app across the asynchronous native version boundary, then register RX
// and send hello. Source-only SDK tests cannot detect callbacks lost during compression.
export function checkRadioStartup(source) {
  let app, probe, subscribed = false, sent = false, nextId = 0
  const timers = new Map(), quiet = { info() {}, error() {}, log() {}, warn() {} }
  const native = {
    getWearEngineVersion(o) { probe = o.complete },
    setPackageName(o) { o.complete() }, setFingerprint(o) { o.complete() },
    unsubscribeMsg() {},
    subscribeMsg(o) { subscribed = true; o.success({ isRegister: true }) },
    sendMsg(o) { sent = true; o.success() }
  }
  const storage = { get(o) { o.success('') }, set(o) { o.success() } }
  vm.runInNewContext(source, {
    ViewModel: function(options) { app = this; Object.assign(this, options.data, options) },
    requireNative(name) { return name === 'system.wearengine' ? native : name === 'system.storage' ? storage : {} },
    console: quiet,
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) }, setInterval() { return ++nextId }, clearInterval() {}
  }, { timeout: 3000 })
  if (!app || !app.onCreate) throw Error('Compiled app has no onCreate')
  app.onCreate()
  if (typeof probe !== 'function') throw Error('Missing native SDK version callback')
  if (subscribed || sent) throw Error('Radio started before SDK version returned')
  probe('1.0.0.402')
  for (let step = 0; timers.size && !subscribed && step < 110; step++) {
    const [id, fn] = timers.entries().next().value
    timers.delete(id); fn()
  }
  const status = app.rt.radioStatus()
  if (!subscribed || !sent || status !== 'sdk:402 rx:ok tx:207') {
    throw Error('Compiled native radio startup failed: ' + status + '; ' + (app.lastError || ''))
  }
  app.onDestroy()
  return status
}
