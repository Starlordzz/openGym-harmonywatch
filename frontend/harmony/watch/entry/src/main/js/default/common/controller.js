import { initialState, restoreState, applySnapshot, acknowledge } from './session.js'
import { mergeHeart, stats } from './heart.js'
import { clipPlan, acceptFile, clearClips, isClipUri, clipReady } from './clips.js'
import { packets, assembler } from './wire.js'
import { setRest } from './rest-control.js'

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
  var saves = [], queue = [], sending = false, timer, stopped = false, hr = [], heartOn = false, heartSince = 0, loaded = false, registered = false, registering = false
  var sendTimer, retryTimer, readWatchdog, cancelReady, screenOn = false, lastSend = '-', heartFailure = ''
  /*f*/
  // U13 forensics, second stream: the app side outlives the page, so its events (SDK readiness,
  // receiver registration, the 15 s tick, stop and unregister) go to their own key with the page
  // as a second reader. Writes are buffered until the seed read lands, so a new session never
  // clobbers the previous run's tail. Q1/Q2 bracket flush; the previous run's tail is copied to
  // its own key and drawn as `last:`.
  var tbuf = '', tseed = false, ksoOff = false
  function tflush() {
    if (!tseed || !tbuf) return
    try { storage.set({ key: 'opengym-fit-boot', value: tbuf.slice(-200), success: function() {}, fail: function() {} }) } catch (e) {}
  }
  function tnote(t) {
    var s = (Date.now() % 1000000) + ':' + t
    tbuf = tbuf ? tbuf + ' ' + s : s
    tflush()
  }
  try { storage.get({ key: 'opengym-fit-boot', default: '', success: function(v) {
    if (tseed) return
    tseed = true
    // The previous run's tail is prepended, then pushed out of the 200 character window by this
    // run's own notes after about fifteen of them. Keep a copy under its own key so one photo of
    // the debug screen still shows the exit that froze.
    try { storage.set({ key: 'opengym-fit-boot-prev', value: String(v || '').slice(-120), success: function() {}, fail: function() {} }) } catch (e) {}
    if (v) tbuf = tbuf ? v + ' ' + tbuf : v
    tflush()
  }, fail: function() { if (tseed) return; tseed = true; tflush() } }) } catch (e) { tseed = true }
  /*endf*/
  // Reachability comes from traffic: a message or a successful send within the last 90 s.
  // Installation detection is unnecessary for this protocol and crosses another native boundary.
  var lastHeard = 0, lastOk = 0, traffic = false, lastHello = 0
  function report(e, fatal) { if (!stopped) failure(String(e && e.message || e), fatal) }
  function online() { return traffic && now() - Math.max(lastHeard, lastOk) < 90000 }
  function mark() {
    if (stopped) return
    var v = online()
    if (state.online !== v) { state.online = v; changed(state) }
  }
  function save(done) {
    var item = saves.length > (writing ? 1 : 0) ? saves[saves.length - 1] : null
    if (!item) { item = { done: [] }; saves.push(item) }
    if (done) item.done.push(done)
    writeNext()
  }
  function writeNext() {
    if (writing || !saves.length) return
    writing = true
    var item = saves[0]
    storage.set({ key: 'opengym-fit-v1', value: JSON.stringify(state),
      success: function() {
        saves.shift(); writing = false
        if (!stopped) { item.done.forEach(function(fn) { fn() }); changed(state); flush() }
        writeNext()
      },
      fail: function(data, code) { writing = false; if (stopped) return; report('存储失败' + (code == null ? '' : ' ' + code) + '，记录尚未同步'); retryTimer = setTimeout(writeNext, 3000) } })
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
      if (settled || stopped) return
      settled = true; clearTimeout(timeout); sending = false
      /*f*/ tnote(ok ? 'E7' : 'E0') /*endf*/
      if (ok) { queue.shift(); lastOk = now(); traffic = true; mark(); pump() }
      else { queue = []; mark(); report('连接中断，已保存的记录稍后重试') }
    }
    var timeout = setTimeout(function() { lastSend = 'timeout'; end(false) }, 10000)
    sendTimer = timeout
    try { client.send(m, { onSuccess: function() {}, onFailure: function() { end(false) },
      onSendResult: function(r) {
        lastSend = typeof r === 'number' ? r : r && r.code
        end(lastSend === 207)
        if (!stopped && lastSend !== 207 && r && r.data) report('发送失败 ' + lastSend + ': ' + String(r.data))
      }, onSendProgress: function() {} }) } catch (e) { end(false); report(e) }
  }
  /*f*/
  // Q1/Q2 bracket flush so a missing F2 can be compared with the send completion marks.
  /*endf*/
  function flush() {
    /*f*/ tnote('Q1') /*endf*/
    if (platform.available === false || !registered || !loaded || stopped || writing || saves.length || queue.length || sending) { /*f*/ tnote('Q2'); /*endf*/ return }
    if (!lastHello || now() - lastHello > 60000) { lastHello = now(); send({ kind: 'hello', boot: boot }) }
    if (state.outbox.length) send({ kind: 'events', events: state.outbox.slice(0, 10) })
    /*f*/ tnote('Q2') /*endf*/
  }
  function buzz(mode, force) {
      if (stopped || !force && state.settings.restHaptics === false) return
      try { vibrator.vibrate({ mode: mode || 'short', success: function() {}, fail: function(data, code) { report('振动不可用: ' + code) } }) }
      catch (e) { report(e) }
    }
  function onMessage(raw) {
    if (stopped) return
    try {
      lastHeard = now(); traffic = true; mark()
      if (raw && raw.isFileType) {
        if (acceptFile(state, raw.name)) {
          Object.keys(state.clips || {}).forEach(function(k) {
            var clip = state.clips[k]
            if (!clipReady(clip) || clip.saved) return
            clip.saved = true
            var previous = clip.previous; delete clip.previous
            save(function() {
              if (previous) Object.keys(previous.paths).forEach(function(n) { remove(previous.paths[n]) })
            })
          })
        }
        else if (isClipUri(raw.name)) remove(raw.name)
        return
      }
      var result = receive(String(raw), Date.now())
      if (!result) return
      var p = result.payload
      var stale = p.session && p.session === state.phoneSession && p.rev < state.restRev
      if (p.session && !stale) { state.phoneSession = p.session; state.restRev = p.rev }
      if (p.kind === 'restState') {
        if (state.workout && state.workout.id === p.wid && !stale && !state.outbox.some(function(e) { return e.type === 'restChange' })) {
          setRest(state, p.rest); save()
        }
      } else if (p.kind === 'helloRequest') {
        lastHello = 0; flush()
      } else if (p.kind === 'snapshot' || p.kind === 'workoutEnd') {
        var before = state.workout, hadSummary = state.summary
        if (p.kind === 'workoutEnd') {
          if (!before || before.id !== p.wid) return
          state.startedHere = null
          p.snapshot = { v: 1, active: null, ready: state.ready, discarded: p.discard ? [p.wid] : [] }
        }
        if (stale && before && p.snapshot.active && p.snapshot.active.id === before.id) p.snapshot.active.rest = before.rest
        var next = applySnapshot(state, p.snapshot)
        var retired = !next.workout || before && next.workout.id !== before.id ? { clips: state.clips } : null
        next.clips = retired ? {} : state.clips || {}
        state = next
        mergeHeart(state, before, hr, Date.now())
        if (state.summary && !hadSummary) {
          var hs = stats(hr, Date.now() - state.summary.seconds * 1000, Date.now())
          if (hs) { state.summary.hrAvg = hs.avg; state.summary.hrMax = hs.max }
        }
        var received = state.workout && (!before || before.id !== state.workout.id) && state.workout.id
        // Detach visible image and stop rest/heart UI before native file cleanup or slow writes.
        if (retired) {
          changed(state)
          setTimeout(function() { clearClips(retired, remove) }, 1000)
        }
        save(function() { if (received && state.workout && state.workout.id === received) buzz('long', true); send({ kind: 'snapshotAck', id: result.id }) })
      } else if (p.kind === 'clip') {
        if (clipPlan(state, p)) {
          save()
        }
      } else if (p.kind === 'eventAck' && Array.isArray(p.ids)) {
        acknowledge(state, p.ids); save()
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
        /*f*/ tnote('L1') /*endf*/
        if (platform.available === false) { report('通信 SDK 尚未配置，此构建仅用于离线界面验证'); return }
        function connect() {
          if (stopped || registering) return
          /*f*/ tnote('G0') /*endf*/
          try {
            client.setPeerPkgName(peer.phonePackage)
            client.setPeerFingerPrint(peer.phoneFingerprint)
            registering = true
            client.registerReceiver({ onSuccess: function() {
              if (stopped) { unregister(); return }
              registering = false; registered = true; /*f*/ tnote('G1'); /*endf*/ flush()
            }, onFailure: function() { /*f*/ tnote('G2'); /*endf*/ registering = false; registered = false; report('无法注册通信，请检查配对和授权') }, onReceiveMessage: onMessage })
          } catch (e) { /*f*/ tnote('G2'); /*endf*/ registering = false; registered = false; report(e) }
        }
        function ready() {
          if (stopped) return
          /*f*/ tnote('R0') /*endf*/
          connect()
          // Keep the registered receiver alive and retry durable traffic without native detect.
          timer = setInterval(function() { /*f*/ tnote('F1'); /*endf*/ if (registered) { flush() } else connect() /*f*/; tnote('F2') /*endf*/ }, 15000)
        }
        if (platform.ready) cancelReady = platform.ready(ready, report)
        else ready()
      }
      readWatchdog = setTimeout(function() { if (!settled && !stopped) changed(state) }, 1500)
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
    change: function(fn) { if (!loaded || stopped) return; fn(state); if (!state.workout) clearClips(state, remove); save(); changed(state) },
    vibrate: buzz,
    keepScreenOn: function(on) {
      if (screenOn === on) { /*f*/ tnote('ZC' + (on ? '1' : '0')); /*endf*/ return }
      screenOn = on
      /*f*/ if (ksoOff) { tnote('ZA' + (on ? '1' : '0')); return } /*endf*/
      /*f*/ tnote('Z' + (on ? '1' : '0') + 'C'); /*endf*/
      try {
        if (platform.brightness) platform.brightness.setKeepScreenOn({ keepScreenOn: on,
          /*f*/ success: function() { tnote('Z' + (on ? '1' : '0') + 'S') }, /*endf*/
          fail: function(data, code) { /*f*/ tnote('Z' + (on ? '1' : '0') + 'F' + code); /*endf*/ console.warn('keepScreenOn: ' + code) } })
      } catch (e) { /*f*/ tnote('Z' + (on ? '1' : '0') + 'T'); /*endf*/ console.warn('keepScreenOn unavailable') }
    },
    heartStart: function() {
      if (stopped || heartOn) return
      heartOn = true; heartSince = now(); heartFailure = ''
      try { sensor.subscribeHeartRate({ success: function(v) {
      if (stopped || !heartOn) return
      if (v.heartRate >= 25 && v.heartRate <= 250) hr.push({ at: now(), value: v.heartRate })
      hr = hr.slice(-600)
      }, fail: function(data, code) {
        heartOn = false; heartFailure = code == null ? '' : String(code)
        report('心率失败 ' + (heartFailure || '?') + ': ' + String(data || '').slice(0, 64))
      } }) }
      catch (e) { heartOn = false; heartFailure = e && e.code != null ? String(e.code) : 'JS'; report('心率异常 ' + heartFailure + ': ' + String(e && e.message || e).slice(0, 64)) }
    },
    heartStop: function(keep) { stopHeart(); if (!keep) hr = [] },
    heartState: function() { return !heartOn ? 'unavailable' : now() - (hr.length ? hr[hr.length - 1].at : heartSince) > 15000 ? 'noData' : 'measuring' },
    heartError: function() { return heartFailure },
    samples: function() { return hr.slice() },
    heart: function(since) {
      var at = now(), values = hr.filter(function(v) { return v.at >= since && v.at <= at })
      if (!values.length) return null
      // Lite's sensor normally calls back every five seconds. Never label a stalled stream current.
      if (at - values[values.length - 1].at > 15000) return null
      var result = stats(values, since, at)
      result.current = values[values.length - 1].value
      return result
    },
    /*f*/
    // U13 forensics trace: a tiny second storage key, written on every mark so a freeze keeps the
    // steps that ran. Never part of the shipping build (see scripts/harmony/strip-forensics.mjs).
    trace: function(text) {
      try { storage.set({ key: 'opengym-fit-trace', value: String(text).slice(-200), success: function() {}, fail: function() {} }) } catch (e) {}
    },
    traceRead: function(fn) {
      try {
        storage.get({ key: 'opengym-fit-trace', default: '', success: function(v) { fn(v || '') }, fail: function() { fn('') } })
      } catch (e) { fn('') }
    },
    // The app-side stream, read back the same way. The page displays it first: what the app
    // itself observed after the page hid (screen-on releases, ticks, probes, teardown) is the
    // part the exit trace can never hold.
    note: function(t) { tnote(t) },
    probe: function(kind, on) { if (kind === 'kso') { ksoOff = !!on; tnote('ZA' + (ksoOff ? '1' : '0')) } },
    bootRead: function(fn) {
      try {
        storage.get({ key: 'opengym-fit-boot', default: '', success: function(v) { fn(v || '') }, fail: function() { fn('') } })
      } catch (e) { fn('') }
    },
    // The tail the previous run left behind, kept apart from the live stream (see tnote's seed).
    prevBootRead: function(fn) {
      try {
        storage.get({ key: 'opengym-fit-boot-prev', default: '', success: function(v) { fn(v || '') }, fail: function() { fn('') } })
      } catch (e) { fn('') }
    },
    /*endf*/
    radioStatus: function() {
      return 'sdk:' + (client && client.version != null ? client.version : '?') +
        ' rx:' + (registered ? 'ok' : registering ? 'wait' : 'off') + ' tx:' + lastSend
    },
    stop: function() {
      if (stopped) return
      /*f*/ tnote('T1') /*endf*/
      stopped = true; clearInterval(timer)
      clearTimeout(sendTimer); clearTimeout(retryTimer); clearTimeout(readWatchdog)
      if (cancelReady) cancelReady()
      stopHeart()
      if (registered || registering) unregister()
      queue = []
      /*f*/ tnote('T2') /*endf*/
    }
  }
  function stopHeart() {
    if (!heartOn) return
    heartOn = false
    try { sensor.unsubscribeHeartRate() } catch (e) { report(e) }
  }
  function unregister() {
    registered = false; registering = false
    try { client.unregisterReceiver({ onSuccess: function() { /*f*/ tnote('U1') /*endf*/ }, onFailure: function() { /*f*/ tnote('U2') /*endf*/ } }) } catch (e) { /*f*/ tnote('U3'); /*endf*/ report(e) }
  }
}
