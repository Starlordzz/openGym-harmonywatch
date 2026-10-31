// Huawei 5.0.2.306 sets client.version in an asynchronous native callback.
export function waitForSdk(client, schedule, done, fail) {
  var attempts = 0
  function check() {
    if (client.version != null) {
      if (Number(client.version) >= 302) done()
      else fail('无法取得可用的 Wear Engine 服务版本，请稍后重新打开应用')
      return
    }
    if (attempts++ >= 100) { fail('读取 Wear Engine 服务版本超时'); return }
    schedule(check, 50)
  }
  check()
}
