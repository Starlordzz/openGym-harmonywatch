import vm from 'node:vm'

// Exercise the native sensor callbacks in the actual compiled app, including failure details.
export function checkHeartSubscription(source) {
  for (const permission of ['grant', 'deny', 'missing']) check(source, permission)
}
function check(source, permission) {
  let app, callbacks, permissionCalls = 0
  const quiet = { info() {}, error() {}, log() {}, warn() {} }
  const sensor = { subscribeHeartRate(o) { callbacks = o }, unsubscribeHeartRate() {} }
  vm.runInNewContext(source, {
    ViewModel: function(options) { app = this; Object.assign(this, options.data, options) },
    requireNative(name) {
      if (name === 'system.sensor') return sensor
      if (name === 'ohos.ability.featureAbility') {
        permissionCalls++
        if (permission === 'missing') return {}
        return { getContext: () => ({ requestPermissionsFromUser(names, id, done) {
          if (names[0] !== 'ohos.permission.READ_HEALTH_DATA') throw Error('Wrong heart permission')
          done(undefined, { authResults: [permission === 'grant' ? 0 : -1] })
        } }) }
      }
      if (name === 'system.storage') return { get(o) { o.success('') }, set(o) { o.success() } }
      if (name === 'system.file') return { delete(o) { o.success() }, writeText(o) { o.success() } }
      if (name === 'system.wearengine') return { getWearEngineVersion() {} }
      return {}
    },
    console: quiet, setTimeout() { return 0 }, clearTimeout() {}, setInterval() { return 0 }, clearInterval() {}
  }, { timeout: 3000 })
  app.onCreate()
  if (permissionCalls) throw Error('Permission module loaded on startup')
  app.sensor(true); app.heartStart()
  if (permissionCalls !== 1) throw Error('Missing deferred native heart permission request')
  if (permission !== 'grant') {
    const code = permission === 'deny' ? 'AUTHDENIED' : 'AUTHAPI'
    if (callbacks || app.heartError() !== code) throw Error('Heart subscription bypassed permission failure')
    app.onDestroy(); return
  }
  if (!callbacks || typeof callbacks.success !== 'function' || typeof callbacks.fail !== 'function') throw Error('Missing native heart sensor callbacks')
  callbacks.success({ heartRate: 128 })
  if (app.heartRate(0)?.current !== 128) throw Error('Compiled heart sample callback lost')
  callbacks.fail('native sensor rejected request', 201)
  if (app.heartError() !== '201' || !app.lastError.includes('201: native sensor rejected request')) throw Error('Compiled heart error callback lost')
  app.onDestroy()
}
