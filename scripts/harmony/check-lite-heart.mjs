import vm from 'node:vm'

// Heart collection is retired: no native entry point or public collection control.
export function checkHeartSubscription(source) {
  for (const name of ['requestPermissionsFromUser', 'ohos.ability.featureAbility', 'system.sensor']) {
    if (source.includes(name)) throw Error('Quarantined native heart module remains: ' + name)
  }
  let app, nativeCalls = 0
  const quiet = { info() {}, error() {}, log() {}, warn() {} }
  vm.runInNewContext(source, {
    ViewModel: function(options) { app = this; Object.assign(this, options.data, options) },
    requireNative(name) {
      if (name === 'system.sensor' || name === 'ohos.ability.featureAbility') { nativeCalls++; throw Error('Quarantined heart API loaded') }
      if (name === 'system.storage') return { get(o) { o.success('') }, set(o) { o.success() } }
      if (name === 'system.file') return { delete(o) { o.success() }, writeText(o) { o.success() } }
      if (name === 'system.wearengine') return { getWearEngineVersion() {} }
      return {}
    },
    console: quiet, setTimeout() { return 0 }, clearTimeout() {}, setInterval() { return 0 }, clearInterval() {}
  }, { timeout: 3000 })
  app.onCreate()
  if (app.sensor || app.heartStart || app.heartRate) throw Error('Retired heart controls remain in watch app')
  if (nativeCalls) throw Error('Watch app loaded a retired heart API')
  app.onDestroy()
}
