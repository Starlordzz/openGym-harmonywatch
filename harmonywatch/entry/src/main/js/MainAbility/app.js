// The app side of the watch: state, radio, storage and every mutation live here, so the page
// bundle (also capped at 48 KB by the device loader) only has to draw.
import { runtime } from './common/runtime.js'
import { wordsFor } from './common/i18n.js'
import { start, tick, skip, finish, summary, idle, event } from './common/session.js'
import { clipAt } from './common/clips.js'
import { adjustNumber } from './common/editor.js'
import { changeRest } from './common/rest-control.js'

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



  debugLines(s, page) {
    var lines = [
      { text: 'outbox: ' + s.outbox.length + ', clips: ' + Object.keys(s.clips || {}).length }
    ]
    var tr = page.trace || []
    for (var i = 0; i < tr.length; i++) lines.push({ text: tr[i] })
    return lines.concat(this.radioLines())
  },


  radioLines() {
    var lines = [{ text: 'HA6 ' + this.rt.radioStatus() }], error = this.lastError || ''
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
  clipFrame(exId, at) { return this.state ? clipAt(this.state, exId, at) : '' },
  summaryAt(at) { return this.state ? summary(this.state, at) : null },
  idleAt(now) { return this.state ? idle(this.state, now) : '' },

  startWorkout(routine, bw) { this.rt.change(function(s) { start(s, routine, Date.now(), bw) }) },
  tickSet(ei, si, values, at) {
    var done = false
    this.rt.change(function(s) {
      done = tick(s, ei, si, values, at)
    })
    return done
  },
  skipSet(ei, si) { var now = Date.now(); this.rt.change(function(s) { if (s.workout) skip(s, ei, si, now) }) },
  startHold(ei, si, values, ms) {
    var now = Date.now()
    this.rt.change(function(s) { if (!s.workout) return; s.hold = { start: now, endsAt: now + ms, ei: ei, si: si, values: values } })
  },
  clearHold() { this.rt.change(function(s) { s.hold = null }) },
  closeRestAt(at) { this.rt.change(function(s) {
    if (!s.workout) return
    if (s.workout.rest) s.closedRestAt = Math.max(s.closedRestAt || 0, s.workout.rest.endsAt)
    s.workout.rest = null
    s.restAt = Math.max(s.restAt || 0, at)
    s.activity = Math.max(s.activity || 0, at)
    var e = s.workout.entries[s.entryIndex]
    if (e) event(s, 'navigate', { wid: s.workout.id, exId: e.id, entryIdx: s.entryIndex, restSkip: true }, at)
  }) },
  restMore(ms, pause) {
    var ended = false, at = Date.now()
    this.rt.change(function(s) { ended = changeRest(s, ms, pause, at) })
    if (ended) this.closeRestAt(at)
  },
  finishWorkout(at, discard, isIdle) {
    this.rt.change(function(s) {
      if (!s.workout) return
      finish(s, at, discard, isIdle)
    })
  },
  showEntry(ei) { var now = Date.now(); this.rt.change(function(s) {
    if (!s.workout || !s.workout.entries[ei]) return
    s.entryIndex = ei
    s.activity = Math.max(s.activity || 0, now)
    event(s, 'navigate', { wid: s.workout.id, exId: s.workout.entries[ei].id, entryIdx: ei }, now)
  }) },
  recordEvent(s, type, fields, at) { return event(s, type, fields, at) },
  snooze(reportStillHere) { var now = Date.now(); this.rt.change(function(s) {
    s.snooze = now
    s.activity = Math.max(s.activity || 0, now)
    if (reportStillHere && s.workout) event(s, 'stillHere', { wid: s.workout.id }, now)
  }) },
  clearSummary() { this.rt.change(function(s) { s.summary = null }) }
}
