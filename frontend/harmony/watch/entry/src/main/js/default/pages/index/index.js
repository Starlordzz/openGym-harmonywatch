import { fill, formatNumber, numberFont, numberWidth, clock, effortName, effortPosition, effortValue, effortColor, effortStart } from '../../common/format.js'
import { tagsOf, numbers, dots, progress, setsOf, summaryStats } from '../../common/view.js'
import { setIndex, sideUp } from '../../common/model.js'
import { addSet } from '../../common/add-set.js'

// One page, one state at a time: the same precedence as the Apple Watch app's RootView. The state,
// the radio and every mutation live in app.js (getApp()); this file only draws and dispatches.
export default {
  data: { words: {}, line: '正在读取记录', screen: 'loading', error: '', pending: '', offline: '',
    restPaused: false, routines: [], todayName: '', others: [], idleTitle: '', idleHint: '',
    bwWhole: '70', bwTenth: '0', bwWholeColor: '#30d158', bwTenthColor: '#ffffff', bwWholeBg: '#262626', bwTenthBg: '#000000', unit: 'kg',
    remaining: 3, ringPercent: 100, digits: '3', restRing: true, nextText: '', holdName: '',
    pageNo: 1, pageCount: 1, exName: '', extras: '', clipSrc: '', warmup: false, left: false, right: false, superset: false,
    cardio: false, timed: false, bodyweight: false, weight: '0', added: '', reps: '0', seconds: '30', weightFont: 68, unitLeft: 108, repsFont: 68, secondsFont: 84, effortName: '', effortText: '–',
    effortColor: '#ffffff', last: '', dots: [], noSet: false, noSetText: '', noSetIcon: '',
    editField: '', editTitle: '', editValue: '0', editFont: 108, editSuffix: '', alarmOn: false,
    workoutName: '', setsLine: '', summaryName: '', savedTitle: '', stats: [], records: [],
    debugLines: [], confirm: false, skipConfirm: false, asking: false },
  onInit() {
    this.visible = true
    this.app = getApp()
    var page = this
    /*f*/
    this.app.traceRead(page)
    /*endf*/
    // Draw idle immediately while native storage settles; attach() then shows data or its error.
    this.words = this.app.words('zh-Hans')
    this.idleTitle = this.words.notSynced
    this.idleHint = this.words.phoneHint
    this.screen = 'idle'
    this.error = ''
    this.onState = function(s, error) {
      if (page.dead || !page.visible) return
      if (!s) page.ackRest()
      page.error = !s ? error || '' : ''; page.session = s; page.sync()
    }
    this.app.attach(this.onState)
  },
  onDestroy() { this.onHide(); this.dead = true },
  mark(t) {
    /*o*/
    var a = this.trace || (this.trace = [])
    a.push(Math.round(Date.now() % 100000) + ' ' + t)
    if (a.length > 7) a.shift()
    /*endo*/
    /*f*/
    this.app.mark(this, t)
    /*endf*/
  },
  onHide() {
    if (!this.visible) return
    /*o*/
    this.mark('hide')
    /*endo*/
    /*f*/
    // The exit mark carries what was still on: alarm, sensor, a workout on screen, recent jank.
    this.mark('h' + this.app.flag(this))
    /*endf*/
    this.visible = false
    this.stopClocks()
    /*f*/ this.mark('k') /*endf*/
    /*f*/ this.mark('c') /*endf*/
    this.ackRest()
    /*f*/ this.mark('r') /*endf*/
    this.clipSrc = ''
    if (this.app) {
      this.app.detach(this.onState)
      /*f*/ this.mark('d') /*endf*/
      /*f*/ this.mark('x') /*endf*/
      this.app.keepScreenOn(false)
      /*f*/ this.mark('p') /*endf*/
      /*f*/ this.app.probeLater() /*endf*/
    }
  },
  onShow() {
    if (this.dead || !this.app) return
    /*o*/
    this.mark('show')
    /*endo*/
    /*f*/
    this.mark('s')
    /*endf*/
    this.visible = true
    this.app.attach(this.onState)
    this.app.keepScreenOn(true)
    this.stopClocks()
    var page = this
    this.animationClock = setInterval(function() {
      if (page.dead || !page.visible) return
      /*f*/
      // The clock is the page's heartbeat: a gap between beats measures frozen JS on the real device.
      page.app.jank(page)
      /*endf*/
      var s = page.session, e = s && s.workout && s.workout.entries[page.ei]
      var src = page.screen === 'exercise' && e ? page.app.clipFrame(e.id, Date.now()) : ''
      if (src !== page.clipSrc) page.clipSrc = src
    }, 250)
    this.clock = setInterval(function() { if (!page.dead && page.visible) page.tickClock() }, 1000)
    if (this.session) this.tickClock()
  },
  stopClocks() { clearInterval(this.animationClock); clearInterval(this.clock) },

  // ---- state → screen -------------------------------------------------------------------------
  sync() {
    var s = this.session, now = Date.now(), debug = this.screen === 'debug'
    if (!s) return
    this.words = this.app.words(s.settings.lang)
    this.unit = s.unit || 'kg'
    this.pending = s.outbox.length ? this.words.savedLater : ''
    // Apple's rule: what is queued is only "offline" while the phone is not answering.
    this.offline = s.outbox.length && s.online === false ? this.words.savedLater : ''
    if (!s.workout) {
      this.clipSrc = ''; this.workoutId = ''
      this.ackRest()
      this.confirm = this.skipConfirm = this.asking = this.manualFinish = false
      if (debug) { this.openDebug(); return }
      if (this.screen === 'weigh' || this.screen === 'countdown') return
      if (s.summary) { this.summaryView(s.summary); this.screen = 'summary'; return }
      this.idleView(s)
      return
    }
    if (this.workoutId !== s.workout.id) {
      this.workoutId = s.workout.id; this.screen = 'exercise'; this.picked = -1; this.live = null
      this.confirm = this.skipConfirm = this.asking = this.manualFinish = false
    }
    if (debug) { this.openDebug(); return }
    if (this.screen === 'edit') { this.exerciseView(s, now); return }
    if (this.manualFinish) { this.asking = false; this.finishView(s); return }
    if (this.asking) { this.askingView(s); return }
    var r = s.workout.rest, restEnd = r && (r.paused || r.endsAt > now)
    this.screen = s.hold ? 'hold' : restEnd ? 'rest' : 'exercise'
    if (!this.exerciseView(s, now)) return
    if (this.screen === 'rest') this.restView(s)
    else if (this.screen === 'hold' && s.hold) this.holdView(s.hold, now)
  },
  idleView(s) {
    this.screen = 'idle'
    this.today = s.ready && s.ready.today ? s.ready.today : null
    this.routines = (this.today ? [this.today] : []).concat(s.ready && s.ready.others || [])
    this.todayName = this.today ? this.today.name : ''
    this.others = this.today ? (s.ready.others || []) : this.routines
    var fresh = !s.ready
    this.idleTitle = fresh ? this.words.notSynced : this.words.noWorkout
    this.idleHint = fresh ? this.words.phoneHint : this.words.phoneHint2
  },
  exerciseView(s, now) {
    var ei = s.entryIndex
    if (!s.workout.entries[ei]) { this.finishView(s); this.screen = 'finish'; return false }
    var si = setIndex(s, ei, this.picked)
    var e = s.workout.entries[ei]
    this.ei = ei; this.si = si
    this.exName = e.name; this.pageNo = ei + 1; this.pageCount = s.workout.entries.length
    if (si < 0) {
      // Apple keeps the page and lets a dot bring a skipped set back.
      this.noSet = true
      this.warmup = this.left = this.right = this.superset = false
      this.dots = dots(e, -1, s.skipped, ei)
      var left = e.sets.some(function(r) { return !r.done })
      this.noSetIcon = '/common/icons/' + (left ? 'retry' : 'check') + '.png'
      this.noSetText = left ? this.words.tapDot : this.words.allDone
      return true
    }
    this.noSet = false
    var row = e.sets[si]
    var tags = tagsOf(e, row)
    this.warmup = tags.warmup; this.left = tags.left; this.right = tags.right; this.superset = tags.superset
    var key = s.workout.id + '#' + ei + '#' + si + '#' + (sideUp(row) || '')
    if (key !== this.editKey) { this.editKey = key; this.live = null; this.effort = null }
    var n = numbers(e, row, this.live || {})
    this.cardio = n.cardio; this.timed = n.timed; this.bodyweight = n.bodyweight
    this.weight = n.weight; this.added = n.added; this.reps = n.reps; this.seconds = n.seconds
    this.weightFont = numberFont(n.weight, 68, 104, 72)
    this.unitLeft = 88 + Math.ceil(numberWidth(n.weight, this.weightFont) / 2)
    this.repsFont = numberFont(n.reps, n.bodyweight ? 84 : 68, 160, 72)
    this.secondsFont = numberFont(n.seconds, 84, 272, 82)
    this.effortName = s.settings.effort ? effortName(s.settings.effort) : ''
    this.effortText = this.effort == null ? '–' : formatNumber(this.effort)
    this.effortColor = s.settings.effort ? effortColor(s.settings.effort, this.effort) : '#ffffff'
    this.last = !s.settings.show || s.settings.show.last !== false ? (e.last ? fill(this.words.last, [e.last]) : '') : ''
    this.dots = dots(e, si, s.skipped, ei)
    this.extras = s.settings.show && s.settings.show.elapsed ? clock((now - s.workout.start) / 1000) : ''
    this.showNext = !s.settings.show || s.settings.show.next !== false
    return true
  },
  restView(s) {
    var r = s.workout.rest, left = r.paused ? r.left : (r.endsAt - Date.now()) / 1000, total = r.total || s.restDurationSec || s.workout.restSec
    this.restPaused = !!r.paused
    this.digits = clock(left)
    this.ringPercent = Math.min(100, Math.max(0, Math.round(100 * left / Math.max(1, total))))
    this.restRing = !s.settings.show || s.settings.show.rest !== 'plain'
    var e = s.workout.entries[s.entryIndex], si = setIndex(s, s.entryIndex, this.picked)
    this.nextText = this.showNext && e && si >= 0 ? fill(this.words.next, [e.name, si + 1]) : ''
  },
  holdView(hold, now) {
    var s = this.session, e = s.workout.entries[hold.ei]
    this.holdName = e ? e.name : ''
    this.digits = clock((hold.endsAt - now) / 1000)
    this.ringPercent = Math.min(100, Math.max(0, Math.round(100 * (hold.endsAt - now) / Math.max(1000, hold.endsAt - hold.start))))
  },
  finishView(s) {
    this.screen = 'finish'
    this.workoutName = s.workout ? s.workout.name : ''
    this.setsLine = setsOf(this.words.ofSets, progress(s))
  },
  summaryView(sum) {
    this.savedTitle = sum.endedOnPhone ? this.words.endedPhone : this.words.saved
    this.summaryName = sum.name
    this.stats = summaryStats(sum, this.words, this.unit)
    this.records = (sum.recordNames || []).map(function(n) { return { name: n } })
  },
  askingView(s) {
    this.screen = 'exercise'
    this.exerciseView(s, Date.now())
  },

  // ---- clocks ---------------------------------------------------------------------------------
  tickClock() {
    var s = this.session, now = Date.now()
    if (!s) return
    if (this.screen === 'countdown') {
      this.remaining = Math.max(0, Math.ceil((this.beginAt - now) / 1000))
      this.digits = String(this.remaining || 1)
      this.ringPercent = Math.min(100, Math.max(0, Math.round(100 * (this.beginAt - now) / 3000)))
      if (this.beginAt <= now && this.visible) this.begin()
      return
    }
    if (!s.workout) return
    var ends = s.hold ? s.hold.endsAt : s.workout.rest && !s.workout.rest.paused && s.workout.rest.endsAt
    if (ends && ends <= now) {
      if (s.hold) { this.complete(true); return }
      this.startRestAlarm(); this.app.closeRestAt(now); return
    }
    var state = this.screen === 'debug' || this.manualFinish || this.confirm || this.skipConfirm ? '' : this.app.idleAt(now)
    this.asking = state === 'ask'
    if (state === 'end') {
      var at = s.workout.start
      s.workout.entries.forEach(function(e) { e.sets.forEach(function(row) { at = Math.max(at, row.at || 0) }) })
      this.app.finishWorkout(at, false)
      return
    }
    if (this.screen === 'rest') this.restView(s)
    else if (this.screen === 'hold' && s.hold) this.holdView(s.hold, now)
    else if (this.screen === 'exercise' || this.screen === 'edit') {
      this.extras = s.settings.show && s.settings.show.elapsed ? clock((now - s.workout.start) / 1000) : ''
    }
  },

  // ---- idle -----------------------------------------------------------------------------------
  startToday() { if (this.today) this.startRoutine(this.today) },
  startOther(i) { if (this.others[i]) this.startRoutine(this.others[i]) },
  startRoutine(routine) {
    this.picked = -1
    this.choice = routine
    this.bw = this.session.settings.lastBw || (this.unit === 'lb' ? 160 : 70)
    this.bwActive = 'whole'
    this.weighParts()
    if (this.session.settings.weighIn === false) this.countdown()
    else this.screen = 'weigh'
  },
  openDebug() {
    // The forensic view must never be the thing that throws: with no session yet, show the empty
    // picture. This is the 2 s press on the idle screen (T12).
    var s = this.session || { outbox: [] }
    this.debugLines = this.app.debugLines(s, this)
    this.screen = 'debug'
  },
  closeDebug() { this.screen = 'idle'; this.sync() },
  /*f*/
  // 2 s press on the debug title: flip the screen-on probe, then redraw the panel in place.
  toggleProbe() { this.app.toggleProbe(this) },
  /*endf*/

  // ---- weigh-in -------------------------------------------------------------------------------
  weighParts() {
    var tenths = Math.round(Math.max(0, this.bw) * 10)
    this.bwWhole = String(Math.floor(tenths / 10))
    this.bwTenth = String(tenths % 10)
    this.bwWholeColor = this.bwActive === 'tenth' ? '#ffffff' : '#30d158'
    this.bwTenthColor = this.bwActive === 'tenth' ? '#30d158' : '#ffffff'
    this.bwWholeBg = this.bwActive === 'tenth' ? '#000000' : '#262626'
    this.bwTenthBg = this.bwActive === 'tenth' ? '#262626' : '#000000'
  },
  pickPart(part) { this.bwActive = part; this.weighParts() },
  weighStep(delta) {
    if (this.bwActive === 'tenth') {
      var tenths = Math.round(this.bw * 10) + (delta > 0 ? 1 : -1)
      this.bw = Math.max(0, tenths) / 10
    } else this.bw = Math.max(0, Math.round(this.bw * 10) + (delta > 0 ? 10 : -10)) / 10
    this.weighParts()
  },
  weighSave() { this.withBw = true; this.countdown() },
  weighSkip() { this.withBw = false; this.countdown() },
  weighCancel() { this.screen = 'idle'; this.sync() },

  // ---- countdown ------------------------------------------------------------------------------
  countdown() { this.screen = 'countdown'; this.beginAt = Date.now() + 3000; this.remaining = 3; this.digits = '3'; this.ringPercent = 100 },
  startNow() { if (this.screen === 'countdown') this.begin() },
  cancelCountdown() { this.screen = 'idle'; this.sync() },
  begin() {
    this.manualFinish = false; this.edited = false; this.screen = 'exercise'
    var bw = this.withBw ? this.bw : null
    this.withBw = false
    this.app.startWorkout(this.choice, bw)
  },

  // ---- editing a number -----------------------------------------------------------------------
  edit(field) {
    var s = this.session
    if (!s || !s.workout || !s.workout.entries[this.ei]) return
    var e = s.workout.entries[this.ei]
    if (!this.live) this.live = { weight: Number(this.weight) || 0, reps: Number(this.reps) || 0, seconds: Number(this.seconds) || 30 }
    this.editField = field
    this.editTitle = field === 'weight' ? (this.bodyweight ? this.words.addedWeight : this.words.weight)
      : field === 'reps' ? this.words.reps : field === 'seconds' ? this.words.hold : this.effortName
    this.editSuffix = field === 'weight' ? this.unit : field === 'seconds' ? 's' : ''
    this.editIncrement = field === 'seconds' ? 5 : 1
    if (field === 'effort') {
      var kind = s.settings.effort
      this.editPos = effortPosition(kind, this.effort == null ? effortStart(kind) : this.effort)
      var startValue = effortValue(kind, this.editPos)
      this.editValue = startValue == null ? '–' : formatNumber(startValue)
    } else {
      this.editValue = field === 'weight' ? this.weight : field === 'reps' ? this.reps : this.seconds
    }
    this.fitEdit(); this.screen = 'edit'
  },
  fitEdit() { this.editFont = numberFont(this.editValue, 108, 280, 132) },
  editStepBy(delta) { this.app.editNumber(this, delta, formatNumber, effortValue, effortColor); this.fitEdit() },
  editFineBy(delta) { if (this.editField === 'weight') this.app.editNumber(this, delta, formatNumber, effortValue, effortColor, 0.1); this.fitEdit() },
  editDone() { this.screen = 'exercise'; this.sync() },

  // ---- a set ----------------------------------------------------------------------------------
  done() {
    if (!this.session || !this.session.workout) return
    if (this.timed) {
      var seconds = Number(this.seconds) || 30
      this.app.startHold(this.ei, this.si, { w: Number(this.weight) || 0, sec: seconds }, seconds * 1000)
    } else this.complete()
  },
  complete(automatic) {
    if (!this.session) return
    var s = this.session, hold = s.hold
    var values = this.cardio ? {} : { w: Number(this.weight) || 0, r: Number(this.reps) || 0 }
    var now = hold && automatic === true ? Math.min(Date.now(), hold.endsAt) : Date.now()
    if (hold) values = { w: hold.values.w, sec: Math.max(1, Math.round((now - hold.start) / 1000)) }
    if (s.settings.effort && this.effort != null) values[s.settings.effort] = this.effort
    if (!hold && Date.now() - (this.lastTick || 0) < 700) return
    var ei = hold ? hold.ei : this.ei, si = hold ? hold.si : this.si
    var entry = s.workout && s.workout.entries[ei], row = entry && entry.sets[si]
    if (!row || row.done) { if (hold) this.app.clearHold(); return }
    this.picked = -1
    var completed = this.app.tickSet(ei, si, values, now)
    if (completed) { this.lastTick = Date.now(); this.app.vibrate(); this.effort = null }
  },
  askSkip() { if (!this.noSet && this.si >= 0) this.skipConfirm = true },
  skipConfirmed() { this.skipConfirm = false; if (!this.noSet && this.si >= 0) this.app.skipSet(this.ei, this.si) },
  cancelSkip() { this.skipConfirm = false },
  pickDot(i) { this.ackRest(); this.picked = i; this.screen = 'exercise'; this.sync() },
  onSwipe(evt) {
    if (!this.session || !this.session.workout || typeof this.ei !== 'number') return
    var dir = evt && evt.direction
    var ei = this.ei + (dir === 'down' || dir === 'right' ? -1 : 1)
    if (ei < 0 || ei >= this.session.workout.entries.length) return
    this.picked = -1
    this.app.showEntry(ei)
  },

  // ---- rest, hold -----------------------------------------------------------------------------
  // Long, separated pulses: the Lite API does not promise to queue overlapping requests.
  startRestAlarm() {
    this.ackRest()
    this.alarmOn = true
    this.pulse(0); this.pulse(2000); this.pulse(4000); this.pulse(6000)
    var page = this
    // Two rounds of four long pulses (about 16 s), then silence: the screen stays until touched,
    // but an unattended watch must not keep buzzing.
    this.alarmTimer = setTimeout(function () {
      page.alarmTimer = null
      if (!page.alarmOn) return
      page.pulse(0); page.pulse(2000); page.pulse(4000); page.pulse(6000)
    }, 10000)
  },
  pulse(delay) {
    var page = this
    if (!delay) { if (!page.dead && page.visible && page.alarmOn) page.app.vibrate('long'); return }
    if (!this.alarmPulses) this.alarmPulses = []
    this.alarmPulses.push(setTimeout(function() { if (!page.dead && page.visible && page.alarmOn) page.app.vibrate('long') }, delay))
  },
  ackRest() {
    this.alarmOn = false
    if (this.alarmPulses) this.alarmPulses.forEach(function(id) { clearTimeout(id) })
    this.alarmPulses = []
    if (this.alarmTimer) { clearTimeout(this.alarmTimer); this.alarmTimer = null }
  },
  restMore() { this.app.restMore(15000) },
  restLess() { this.app.restMore(-15000) },
  restPause() { this.app.restMore(0, true) },
  restSkip() { this.app.closeRestAt(Date.now()) },

  // ---- finish ---------------------------------------------------------------------------------
  finishPage() { if (!this.session || !this.session.workout) return; this.asking = false; this.manualFinish = true; this.finishView(this.session) },
  save() { if (!this.session || !this.session.workout) return; this.manualFinish = false; this.screen = 'summary'; this.app.finishWorkout(Date.now(), false) },
  discard() { if (!this.session || !this.session.workout) return; this.confirm = true },
  confirmDiscard() { this.confirm = false; this.screen = 'idle'; this.app.finishWorkout(Date.now(), true) },
  cancelDiscard() { this.confirm = false; this.finishView(this.session); this.screen = 'finish' },
  resume() { this.manualFinish = this.confirm = this.asking = false; this.screen = 'exercise'; this.app.snooze() },
  closeSummary() { this.app.clearSummary() },

  // ---- 20 minutes without a set ---------------------------------------------------------------
  keepGoing() { this.asking = false; this.app.snooze() },
  askFinish() { this.asking = false; this.finishPage() },

  addSet() {
    if (!this.session || !this.session.workout) return
    this.picked = -1; this.manualFinish = false
    var ei = this.ei, app = this.app
    app.change(function(s) { addSet(s, ei, Date.now(), app.recordEvent) })
  },
}
