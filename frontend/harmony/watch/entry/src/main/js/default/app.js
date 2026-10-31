// The app side of the watch: state, radio, storage and every mutation live here, so the page
// bundle (also capped at 48 KB by the device loader) only has to draw.
import { runtime } from './common/runtime.js'
import { wordsFor } from './common/i18n.js'
import { start, tick, skip, finish, summary, idle } from './common/session.js'
import { localTick, afterTick, closeRest, stats } from './common/heart.js'
import { clipAt } from './common/clips.js'

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
  onDestroy() { if (this.rt) this.rt.stop() },

  attach(fn) { this.listener = fn; fn(this.state, this.lastError) },
  words(lang) { return wordsFor(lang) },
  change(fn) { this.rt.change(fn) },
  vibrate() { this.rt.vibrate() },
  samples() { return this.rt.samples() },
  heartRate(since) { return this.rt.heart(since) },
  heartStart() { this.rt.heartStart() },
  heartStop() { this.rt.heartStop() },
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
  closeRestAt(at) { var rt = this.rt; this.rt.change(function(s) { if (!s.workout) return; closeRest(s, rt.samples(), at); s.workout.rest = null }) },
  restMore(ms) {
    this.rt.change(function(s) {
      if (!s.workout || !s.workout.rest) return
      s.workout.rest.endsAt += ms
      if (s.restAfter) s.restAfter.endsAt = s.workout.rest.endsAt
      s.restDurationSec = (s.restDurationSec || s.workout.restSec) + ms / 1000
    })
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
  showEntry(ei) { this.rt.change(function(s) { s.entryIndex = ei }) },
  lock(on) { this.rt.change(function(s) { s.touchLocked = on }) },
  snooze() { this.rt.change(function(s) { s.snooze = Date.now() }) },
  sensor(on) { this.rt.change(function(s) { s.sensorEnabled = on }) },
  clearSummary() { this.rt.change(function(s) { s.summary = null }) }
}
