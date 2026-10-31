import { initialState, restoreState, applySnapshot, acknowledge } from './session.js'
import { mergeHeart, stats } from './heart.js'
import { clipPlan, acceptFile, clearClips, isClipUri } from './clips.js'
import { packets, assembler } from './wire.js'

// One serialized storage writer; radio never sees an event before its durable state.
export function createRuntime(platform, changed, failure) {
  var storage = platform.storage, vibrator = platform.vibrator, sensor = platform.sensor
  var client = platform.client, peer = platform.peer
  var setTimeout = platform.setTimeout, clearTimeout = platform.clearTimeout
  var setInterval = platform.setInterval, clearInterval = platform.clearInterval
  var now = platform.now || function() { return Date.now() }
  var state = initialState(), receive = assembler(), writing = false
  var boot = 'boot-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  var remove = platform.remove || function() {}
  var saves = [], queue = [], sending = false, timer, stopped = false, hr = [], loaded = false, registered = false
  // Reachability, the Wear Engine way: the SDK's ping only says whether the phone app is installed
  // (code 201 vs 204), so "online" comes from traffic — a message heard from the phone or a send
  // that returned 207 within the last 90 s. Apple's isReachable has no direct equivalent.
  var installed = null, lastHeard = 0, lastOk = 0, traffic = false, lastHello = 0
  function report(e, fatal) { failure(String(e && e.message || e), fatal) }
  function online() { return traffic && now() - Math.max(lastHeard, lastOk) < 90000 }
  function mark() {
    var v = online()
    if (state.online !== v) { state.online = v; changed(state) }
  }
  function pingPeer() {
    if (typeof client.ping !== 'function') return
    try {
      client.ping({ onSuccess: function() { installed = true; flush() }, onFailure: function() {},
        onPingResult: function(r) { installed = !(r && r.code === 204) } })
    } catch (e) { installed = null }
  }
  function save(done) {
    saves.push({ text: JSON.stringify(state), done: done })
    writeNext()
  }
  function writeNext() {
    if (writing || !saves.length) return
    writing = true
    var item = saves[0]
    storage.set({ key: 'opengym-fit-v1', value: item.text,
      success: function() { saves.shift(); writing = false; if (item.done) item.done(); writeNext() },
      fail: function() { writing = false; report('存储失败，记录尚未同步'); setTimeout(writeNext, 3000) } })
  }
  function send(payload) {
    queue = queue.concat(packets(payload, 'watch-' + Date.now() + '-' + Math.random().toString(16).slice(2)))
    pump()
  }
  function pump() {
    if (sending || !queue.length || stopped) return
    sending = true
    var b = new platform.Builder(), m = new platform.Message(), settled = false
    b.setDescription(queue[0]); m.builder = b
    function end(ok) {
      if (settled) return
      settled = true; clearTimeout(timeout); sending = false
      if (ok) { queue.shift(); lastOk = now(); traffic = true; mark(); pump() }
      else { queue = []; mark(); report('连接中断，已保存的记录稍后重试') }
    }
    var timeout = setTimeout(function() { end(false) }, 10000)
    try { client.send(m, { onSuccess: function() {}, onFailure: function() { end(false) },
      onSendResult: function(r) { end((typeof r === 'number' ? r : r && r.code) === 207) }, onSendProgress: function() {} }) } catch (e) { end(false); report(e) }
  }
  function flush() {
    if (platform.available === false || !registered || !loaded || stopped || writing || saves.length || queue.length || sending) return
    if (!lastHello || now() - lastHello > 60000) { lastHello = now(); send({ kind: 'hello', boot: boot }) }
    if (state.outbox.length) send({ kind: 'events', events: state.outbox.slice(0, 10) })
  }
  function onMessage(raw) {
    try {
      lastHeard = now(); traffic = true; mark()
      if (raw && raw.isFileType) {
        if (acceptFile(state, raw.name)) save(function() { changed(state) })
        else if (isClipUri(raw.name)) remove(raw.name)
        return
      }
      var result = receive(String(raw), Date.now())
      if (!result) return
      var p = result.payload
      if (p.kind === 'snapshot') {
        var before = state.workout, hadSummary = state.summary
        var next = applySnapshot(state, p.snapshot)
        if (!next.workout || before && next.workout.id !== before.id) clearClips(state, remove)
        next.clips = state.clips || {}
        state = next
        mergeHeart(state, before, hr, Date.now())
        if (state.summary && !hadSummary) {
          var hs = stats(hr, Date.now() - state.summary.seconds * 1000, Date.now())
          if (hs) { state.summary.hrAvg = hs.avg; state.summary.hrMax = hs.max }
        }
        save(function() { send({ kind: 'snapshotAck', id: result.id }); changed(state) })
      } else if (p.kind === 'clip') {
        var previous = state.clips && state.clips[p.exId]
        if (clipPlan(state, p)) {
          if (previous) Object.keys(previous.paths).forEach(function(n) { remove(previous.paths[n]) })
          save(function() { changed(state) })
        }
      } else if (p.kind === 'eventAck' && Array.isArray(p.ids)) {
        acknowledge(state, p.ids); save(function() { changed(state); flush() })
      }
    } catch (e) { report(e) }
  }
  return {
    load: function() {
      var started = false, settled = false
      // Show an empty view if native storage hangs, but do not write or connect until its read
      // settles. Otherwise a late read can replace and then overwrite freshly recorded events.
      function start() {
        if (started || stopped) return
        started = true; loaded = true; changed(state)
        if (platform.available === false) { report('通信 SDK 尚未配置，此构建仅用于离线界面验证'); return }
        function connect() {
          if (stopped) return
          try {
            client.setPeerPkgName(peer.phonePackage)
            client.setPeerFingerPrint(peer.phoneFingerprint)
            client.registerReceiver({ onSuccess: function() { registered = true; pingPeer(); flush() },
              onFailure: function() { registered = false; report('无法注册通信，请检查配对和授权') }, onReceiveMessage: onMessage })
          } catch (e) { registered = false; report(e) }
        }
        function ready() {
          if (stopped) return
          connect()
          pingPeer()
          timer = setInterval(function() { if (registered) { pingPeer(); flush() } else connect() }, 15000)
        }
        if (platform.ready) platform.ready(ready, report)
        else ready()
      }
      setTimeout(function() { if (!settled && !stopped) changed(state) }, 1500)
      storage.get({ key: 'opengym-fit-v1', default: '', success: function(text) {
        if (settled || stopped) return
        settled = true
        if (text) {
          try { state = restoreState(JSON.parse(text)) }
          catch (e) { report('记录损坏，已停止启动以保护原数据', true); return }
        }
        start()
      }, fail: function() { if (settled || stopped) return; settled = true; report('无法读取本地记录', true) } })
    },
    change: function(fn) { if (!loaded || stopped) return; fn(state); if (!state.workout) clearClips(state, remove); save(function() { changed(state); flush() }); changed(state) },
    vibrate: function() { if (state.settings.restHaptics !== false) vibrator.vibrate({ mode: 'short', success: function() {} }) },
    heartStart: function() { sensor.subscribeHeartRate({ success: function(v) {
      if (v.heartRate >= 25 && v.heartRate <= 250) hr.push({ at: now(), value: v.heartRate })
      hr = hr.slice(-600)
    }, fail: function() { report('心率不可用，请检查设备权限') } }) },
    heartStop: function() { sensor.unsubscribeHeartRate(); hr = [] },
    samples: function() { return hr.slice() },
    heart: function(since) {
      var at = now(), values = hr.filter(function(v) { return v.at >= since && v.at <= at })
      if (!values.length) return null
      // Lite's sensor normally calls back every five seconds. Never label a stalled stream current.
      if (at - values[values.length - 1].at > 15000) return null
      return { avg: Math.round(values.reduce(function(n, v) { return n + v.value }, 0) / values.length), max: Math.max.apply(null, values.map(function(v) { return v.value })) }
    },
    stop: function() { stopped = true; clearInterval(timer); sensor.unsubscribeHeartRate(); if (client && registered) client.unregisterReceiver({ onSuccess: function() {} }) }
  }
}
