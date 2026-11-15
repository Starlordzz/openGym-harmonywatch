// Resolve the FA module only when the user enables collection. FIT support is checked at runtime.
export function heartPermission(load, done, later, cancel) {
  var settled = false, timer
  function finish(code, text) {
    if (settled) return
    settled = true; cancel(timer); done(code, text)
  }
  try {
    var api = load(), context = api && api.getContext && api.getContext()
    if (!context || !context.requestPermissionsFromUser) { finish('AUTHAPI', 'FA permission API unavailable'); return }
    timer = later(function() { finish('AUTHTIME', 'permission request timed out') }, 15000)
    context.requestPermissionsFromUser(['ohos.permission.READ_HEALTH_DATA'], 1, function(error, result) {
      var a = result && result.authResults
      finish(error ? 'AUTH' + (error.code || 'ERR') : a && a[0] === 0 ? '' : 'AUTHDENIED', error ? String(error.message || error) : 'authResults: ' + JSON.stringify(a))
    })
  } catch (e) { finish('AUTHAPI', String(e && e.message || e)) }
  if (!settled) return function() { settled = true; cancel(timer) }
}
