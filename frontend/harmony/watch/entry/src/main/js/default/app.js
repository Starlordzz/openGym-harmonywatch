// The app side of the watch: state, radio, storage and every mutation live here, so the page
// bundle (also capped at 48 KB by the device loader) only has to draw.
import { runtime } from './common/runtime.js'
import { wordsFor } from './common/i18n.js'
import { start, tick, skip, finish, summary, idle, event } from './common/session.js'
import { localTick, afterTick, closeRest, stats } from './common/heart.js'
import { clipAt } from './common/clips.js'
import { adjustNumber } from './common/editor.js'
import { changeRest } from './common/rest-control.js'

// watchOS takes the summary's heart rate from the HealthKit workout; here it comes from the
// sensor samples of the session itself.
function attachHr(summary, samples, from, to) {
  var h = stats(samples, from, to)
  if (h) { summary.hrAvg = h.avg; summary.hrMax = h.max }
}

export default {
  // getApp() only returns the app when its data object exists (app_data_module.cpp).
  data: { ready: false },
  onCreate() {
    var app = this
    this.state = null
    this.lastError = ''
    this.listener = null
    this.rt = runtime(
      function(s) { app.state = s; if (app.listener) app.listener(s) },
      function(e, fatal) { app.lastError = e; if (fatal) app.state = null; if (app.listener) app.listener(app.state, e) }
    )
    this.rt.load()
  },
  onDestroy() { this.listener = null; if (this.rt) { this.rt.keepScreenOn(false); this.rt.stop() } },
  /*f*/
  // U13 forensics: the page's exit trace goes straight to its own storage key so it survives
  // whatever freezes next; traceRead hands the previous run's tail back to the debug screen.
  // The steps live here, not in the page: the device loads a page bundle out of a 48 KB slot.
  trace(t) { var rt = this.rt; if (rt && rt.trace) rt.trace(t) },
  traceRead(page) {
    var rt = this.rt
    if (rt && rt.traceRead) rt.traceRead(function(v) { page.lastExit = v })
    else page.lastExit = ''
    if (rt && rt.bootRead) rt.bootRead(function(v) { page.lastBoot = v })
    else page.lastBoot = ''
    if (rt && rt.prevBootRead) rt.prevBootRead(function(v) { page.lastBootPrev = v })
    else page.lastBootPrev = ''
  },
  // The app-side stream notes: keep-screen-on results, probes, teardown (common/controller.js).
  note(t) { if (this.rt && this.rt.note) this.rt.note(t) },
  probe(kind, on) { this.ksoOff = !!on; if (this.rt && this.rt.probe) this.rt.probe(kind, on) },
  // The screen-on probe: with it on, keepScreenOn only logs. One exit with the probe on and one
  // with it off tell whether the freeze follows the lock itself or something else.
  toggleProbe(page) {
    this.probe('kso', !this.ksoOff)
    page.openDebug()
    // The tap that ends a 2 s press may still close the panel; reopen it once the dust settles.
    setTimeout(function() { page.openDebug() }, 80)
  },
  probeLater() {
    // Two probes from the page's own clock: if the app's JS kept running through the freeze,
    // both notes land with honest timestamps; a late or missing note dates the suspension.
    var app = this
    setTimeout(function() { app.note('NP10') }, 10000)
    setTimeout(function() { app.note('NP25') }, 25000)
  },
  mark(page, t) {
    var n = Date.now() % 1e6, a = page.trace || (page.trace = [])
    a.push((page.markAt ? n - page.markAt : 0) + ':' + t)
    page.markAt = n
    if (a.length > 14) a.shift()
    this.trace(a.join(' '))
  },
  flag(page) {
    var q = Date.now()
    return (page.alarmOn ? 'a' : '') + (page.sensing ? 's' : '') +
      (page.session && page.session.workout ? 'w' : '') +
      // J: idle gap since the page's last 125 ms heartbeat (is the JS thread alive at exit?).
      // C: gap since the last degree-less crown event (did the crown press itself reach JS?).
      (page.seen ? 'J' + (q - page.seen) : '') + (page.crownAt ? 'C' + (q - page.crownAt) : '') +
      (page.lag ? 'L' + page.lag : '') +
      // T: the same clock the app-side stream stamps its notes with, so the two line up.
      'T' + (q % 1e6)
  },
  jank(page) {
    var q = Date.now()
    if (page.seen && q - page.seen > 700) page.lag = q - page.seen
    page.seen = q
  },
  debugLines(s, page) {
    s = s || { outbox: [] }
    var lines = [
      { text: 'workout: ' + (s.workout ? s.workout.id : 'none') },
      { text: 'pending ticks: ' + Object.keys(s.pending || {}).length },
      { text: 'started here: ' + (s.startedHere || '-') },
      { text: 'clips: ' + Object.keys(s.clips || {}).length },
      { text: 'ready: ' + (s.ready ? 'yes' : 'no') + ', outbox: ' + s.outbox.length },
      { text: 'online: ' + (s.online ? 'yes' : 'no') + (this.ksoOff ? ' KSO-OFF' : '') }
    ]
    // The watch clips a text line at its right edge; wrap at 32 characters so every step stays
    // readable. The app-side stream comes first: what the app kept doing after the page hid is
    // the part the exit trace can never hold.
    function wrap(label, text) {
      var out = [], v = label + (text || '-')
      while (v.length > 32) {
        var at = v.lastIndexOf(' ', 32)
        if (at < 8) at = 32
        out.push({ text: v.slice(0, at) })
        v = v.slice(at + (v.charAt(at) === ' ' ? 1 : 0))
      }
      out.push({ text: v })
      return out
    }
    wrap('boot: ', String(page.lastBoot || '').slice(-192)).forEach(function(l) { lines.push(l) })
    // The frozen run's own app-side tail: the live stream above holds this run and would push it
    // out of its own window within about fifteen notes.
    wrap('last: ', String(page.lastBootPrev || '-').slice(-120)).forEach(function(l) { lines.push(l) })
    wrap('prev: ', page.lastExit).forEach(function(l) { lines.push(l) })
    if (page.lag) lines.push({ text: 'lag: ' + page.lag + 'ms' })
    var tr = page.trace || []
    for (var i = 0; i < tr.length; i++) lines.push({ text: tr[i] })
    return lines.concat(this.radioLines())
  },
  /*endf*/

  /*o*/
  debugLines(s, page) {
    var lines = [
      { text: 'outbox: ' + s.outbox.length + ', clips: ' + Object.keys(s.clips || {}).length }
    ]
    var tr = page.trace || []
    for (var i = 0; i < tr.length; i++) lines.push({ text: tr[i] })
    return lines.concat(this.radioLines())
  },
  /*endo*/

  radioLines() {
    var lines = [{ text: this.rt.radioStatus() }], error = this.lastError || ''
    for (var i = 0; i < Math.min(error.length, 112); i += 28) lines.push({ text: error.slice(i, i + 28) })
    return lines
  },

  attach(fn) { this.listener = fn; fn(this.state, this.lastError) },
  detach(fn) { if (this.listener === fn) this.listener = null },
  words(lang) { return wordsFor(lang) },
  change(fn) { this.rt.change(fn) },
  vibrate(mode, force) { this.rt.vibrate(mode, force) },
  keepScreenOn(on) { this.rt.keepScreenOn(on) },
  editNumber(page, delta, number, effort, color, step) { adjustNumber(page, delta, number, effort, color, step) },
  samples() { return this.rt.samples() },
  heartRate(since) { return this.rt.heart(since) },
  heartStart() { this.rt.heartStart() },
  heartStop(keep) { this.rt.heartStop(keep) },
  heartState() { return this.rt.heartState() },
  heartError() { return this.rt.heartError() },
  clipFrame(exId, at) { return this.state ? clipAt(this.state, exId, at) : '' },
  summaryAt(at) { return this.state ? summary(this.state, at) : null },
  idleAt(now) { return this.state ? idle(this.state, now) : '' },

  startWorkout(routine, bw) { this.rt.change(function(s) { start(s, routine, Date.now(), bw) }) },
  tickSet(ei, si, values, at) {
    var done = false, rt = this.rt
    rt.change(function(s) {
      var h = localTick(s, rt.samples(), at)
      if (h) values.hr = h
      done = tick(s, ei, si, values, at)
      if (done) afterTick(s, ei, si, at)
    })
    return done
  },
  skipSet(ei, si) { this.rt.change(function(s) { if (s.workout) skip(s, ei, si) }) },
  startHold(ei, si, values, ms) {
    var now = Date.now()
    this.rt.change(function(s) { if (!s.workout) return; s.hold = { start: now, endsAt: now + ms, ei: ei, si: si, values: values } })
  },
  clearHold() { this.rt.change(function(s) { s.hold = null }) },
  closeRestAt(at) { var rt = this.rt; this.rt.change(function(s) {
    if (!s.workout) return
    if (s.workout.rest) s.closedRestAt = Math.max(s.closedRestAt || 0, s.workout.rest.endsAt)
    closeRest(s, rt.samples(), at); s.workout.rest = null
    var e = s.workout.entries[s.entryIndex]
    if (e) event(s, 'navigate', { wid: s.workout.id, exId: e.id, entryIdx: s.entryIndex, restSkip: true }, at)
  }) },
  restMore(ms, pause) {
    var ended = false, at = Date.now()
    this.rt.change(function(s) { ended = changeRest(s, ms, pause, at) })
    if (ended) this.closeRestAt(at)
  },
  finishWorkout(at, discard) {
    var rt = this.rt
    this.rt.change(function(s) {
      if (!s.workout) return
      var start = s.workout.start
      closeRest(s, rt.samples(), at)
      finish(s, at, discard)
      if (s.summary) attachHr(s.summary, rt.samples(), start, at)
    })
  },
  showEntry(ei) { this.rt.change(function(s) {
    if (!s.workout || !s.workout.entries[ei]) return
    s.entryIndex = ei
    event(s, 'navigate', { wid: s.workout.id, exId: s.workout.entries[ei].id, entryIdx: ei }, Date.now())
  }) },
  recordEvent(s, type, fields, at) { return event(s, type, fields, at) },
  snooze() { this.rt.change(function(s) { s.snooze = Date.now() }) },
  sensor(on) { this.rt.change(function(s) { s.sensorEnabled = on }) },
  clearSummary() { this.rt.change(function(s) { s.summary = null }) }
}
