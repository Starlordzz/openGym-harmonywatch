import { fill, formatNumber, numberFont, numberWidth, clock, effortName, effortPosition, effortValue, effortColor, effortStart } from '../../common/format.js'
import { tagsOf, numbers, dots, progress, setsOf, summaryStats } from '../../common/view.js'
import { setIndex, sideUp } from '../../common/model.js'

// One page, one state at a time: the same precedence as the Apple Watch app's RootView. The state,
// the radio and every mutation live in app.js (getApp()); this file only draws and dispatches.
export default {
  data: { words: {}, title: 'openGym', line: '正在读取记录', screen: 'loading', error: '', pending: '', offline: '',
    routines: [], todayName: '', others: [], idleTitle: '', idleHint: '',
    bwWhole: '70', bwTenth: '0', bwWholeColor: '#30d158', bwTenthColor: '#ffffff', bwWholeBg: '#262626', bwTenthBg: '#000000', unit: 'kg',
    remaining: 3, ringPercent: 100, ringColor: '#30d158', digits: '3', restRing: true, nextText: '', holdName: '',
    pageNo: 1, pageCount: 1, exName: '', extras: '', hr: '', clipSrc: '', warmup: false, left: false, right: false, superset: false,
    cardio: false, timed: false, bodyweight: false, weight: '0', added: '', reps: '0', seconds: '30', weightFont: 68, repsFont: 68, secondsFont: 84, weightWidth: 76, secondsWidth: 94, effortName: '', effortText: '–',
    effortColor: '#ffffff', last: '', dots: [], noSet: false, noSetText: '', noSetIcon: '', hrWaiting: '', hrWanted: true, offlineMark: '⟳',
    editField: '', editTitle: '', editValue: '0', editSuffix: '', editStep: '',
    workoutName: '', setsLine: '', summaryName: '', savedTitle: '', stats: [], records: [],
    debugLines: [], lockDigits: '', touchLocked: false, confirm: false, skipConfirm: false, asking: false },
  onInit() {
    this.visible = true
    this.app = getApp()
    var page = this
    // Draw idle immediately while native storage settles; attach() then shows data or its error.
    this.words = this.app.words('zh-Hans')
    this.idleTitle = this.words.notSynced
    this.idleHint = this.words.phoneHint
    this.screen = 'idle'
    this.error = ''
    this.app.attach(function(s, error) { page.error = !s ? error || '' : ''; page.session = s; page.sync() })
    this.animationClock = setInterval(() => {
      var s = this.session, e = s && s.workout && s.workout.entries[this.ei]
      this.clipSrc = this.visible && this.screen === 'exercise' && e ? this.app.clipFrame(e.id, Date.now()) : ''
    }, 125)
    this.clock = setInterval(() => this.tickClock(), 1000)
    // The FIT 5 Pro's crown, exposed by ACELite as a global monitor (one object per turn:
    // { timestamp, angularVelocity, degree }). Guarded: the previewer and older builds lack it.
    this.crownDeg = 0
    if (typeof setMonitorForCrownEvents === 'function') {
      setMonitorForCrownEvents(function (evt) { return page.crown(evt) })
    }
  },
  onDestroy() {
    this.ackRest()
    clearInterval(this.animationClock); clearInterval(this.clock)
    if (typeof clearMonitorForCrownEvents === 'function') clearMonitorForCrownEvents()
  },
  onHide() { this.visible = false; this.clipSrc = '' },
  onShow() { this.visible = true; if (this.session) this.tickClock() },

  // ---- state → screen -------------------------------------------------------------------------
  sync() {
    var s = this.session, now = Date.now()
    if (!s) return
    this.words = this.app.words(s.settings.lang)
    this.unit = s.unit || 'kg'
    this.title = s.workout ? s.workout.name : 'openGym'
    this.pending = s.outbox.length ? this.words.savedLater : ''
    // Apple's rule: what is queued is only "offline" while the phone is not answering.
    this.offline = s.outbox.length && s.online === false ? this.words.savedLater : ''
    this.touchLocked = !!s.touchLocked && !!s.workout
    if (!s.workout) {
      if (this.sensing) this.app.heartStop()
      this.sensing = false
      this.confirm = this.skipConfirm = this.asking = this.manualFinish = false
      if (this.screen === 'weigh' || this.screen === 'countdown') return
      if (s.summary) { this.summaryView(s.summary); this.screen = 'summary'; return }
      this.idleView(s)
      return
    }
    if (this.sensing && !s.sensorEnabled) { this.sensing = false; this.app.heartStop() }
    if (!this.sensing && s.sensorEnabled) { this.sensing = true; this.app.heartStart() }
    if (this.screen === 'edit') { this.exerciseView(s, now); return }
    if (this.asking) { this.askingView(s); return }
    if (this.manualFinish) { this.finishView(s); this.screen = 'finish'; return }
    var restEnd = s.workout.rest && s.workout.rest.endsAt
    this.screen = s.hold ? 'hold' : restEnd && restEnd > now ? 'rest' : 'exercise'
    if (!this.exerciseView(s, now)) return
    if (this.screen === 'rest') this.restView(s)
    else if (this.screen === 'hold' && s.hold) this.holdView(s.hold, now)
    this.lockDigits = this.screen === 'rest' || this.screen === 'hold' ? this.digits : ''
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
      this.noSetIcon = left ? '↻' : '✓'
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
    this.weightFont = numberFont(n.weight, 68, 124)
    this.repsFont = numberFont(n.reps, n.bodyweight ? 84 : 68, 160)
    this.secondsFont = numberFont(n.seconds, 84, 280)
    this.weightWidth = numberWidth(n.weight, this.weightFont)
    this.secondsWidth = numberWidth(n.seconds, this.secondsFont)
    this.exName = e.name; this.pageNo = ei + 1; this.pageCount = s.workout.entries.length
    this.effortName = s.settings.effort ? effortName(s.settings.effort) : ''
    this.effortText = this.effort == null ? '–' : formatNumber(this.effort)
    this.effortColor = s.settings.effort ? effortColor(s.settings.effort, this.effort) : '#ffffff'
    this.last = !s.settings.show || s.settings.show.last !== false ? (e.last ? fill(this.words.last, [e.last]) : '') : ''
    this.dots = dots(e, si, s.skipped, ei)
    this.extras = s.settings.show && s.settings.show.elapsed ? clock((now - s.workout.start) / 1000) : ''
    var h = this.app.heartRate(this.lastTick || s.workout.start)
    this.hrWanted = !s.settings.show || s.settings.show.hr !== false
    this.hr = h && this.hrWanted ? '♥ ' + h.avg : ''
    this.hrWaiting = !h && this.hrWanted && s.sensorEnabled && this.sensing ? '♥ ' + this.words.measuring : ''
    this.showNext = !s.settings.show || s.settings.show.next !== false
    return true
  },
  restView(s) {
    var now = Date.now(), ends = s.workout.rest.endsAt, total = s.restDurationSec || s.workout.restSec
    this.ringColor = '#30d158'
    this.digits = clock((ends - now) / 1000)
    this.ringPercent = Math.min(100, Math.max(0, Math.round(100 * (ends - now) / Math.max(1000, total * 1000))))
    this.restRing = !s.settings.show || s.settings.show.rest !== 'plain'
    var e = s.workout.entries[s.entryIndex], si = setIndex(s, s.entryIndex, this.picked)
    this.nextText = this.showNext && e && si >= 0 ? fill(this.words.next, [e.name, si + 1]) : ''
  },
  holdView(hold, now) {
    var s = this.session, e = s.workout.entries[hold.ei]
    this.holdName = e ? e.name : ''
    this.digits = clock((hold.endsAt - now) / 1000)
    this.ringPercent = Math.min(100, Math.max(0, Math.round(100 * (hold.endsAt - now) / Math.max(1000, hold.endsAt - hold.start))))
    this.ringColor = '#64d2ff'
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

  // ---- crown ----------------------------------------------------------------------------------
  // 24° per notch (a full turn is 15): the numbers move in their own steps, the exercise page turns.
  crown(evt) {
    var deg = evt && typeof evt.degree === 'number' ? evt.degree : 0
    if (!deg) return true
    this.crownDeg += deg
    var notches = this.crownDeg > 0 ? Math.floor(this.crownDeg / 24) : Math.ceil(this.crownDeg / 24)
    if (!notches) return true
    this.crownDeg -= notches * 24
    var dir = notches > 0 ? 1 : -1, times = Math.min(4, Math.abs(notches))
    for (var i = 0; i < times; i++) this.crownStep(dir)
    return true
  },
  crownStep(dir) {
    if (this.touchLocked || typeof this.ei !== 'number') return
    if (this.screen === 'edit') { this.editStepBy(dir); return }
    if (this.screen === 'weigh') { this.weighStep(dir); return }
    if (this.screen === 'exercise') {
      var s = this.session
      if (!s || !s.workout) return
      var ei = this.ei + dir
      if (ei < 0 || ei >= s.workout.entries.length) return
      this.picked = -1
      this.app.showEntry(ei)
    }
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
    var ends = s.hold ? s.hold.endsAt : s.workout.rest && s.workout.rest.endsAt
    if (ends && ends <= now) {
      if (s.hold) { this.complete(true); return }
      this.app.closeRestAt(now); this.startRestAlarm(); return
    }
    var state = this.app.idleAt(now)
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
      var h = this.app.heartRate(this.lastTick || s.workout.start)
      this.hr = h && this.hrWanted ? '♥ ' + h.avg : ''
      this.hrWaiting = !h && this.hrWanted && s.sensorEnabled && this.sensing ? '♥ ' + this.words.measuring : ''
    }
    this.lockDigits = this.screen === 'rest' || this.screen === 'hold' ? this.digits : ''
  },

  // ---- idle -----------------------------------------------------------------------------------
  startToday() { if (this.today) this.startRoutine(this.today) },
  startOther(i) { if (this.others[i]) this.startRoutine(this.others[i]) },
  startRoutine(routine) {
    if (this.touchLocked) return
    this.picked = -1
    this.choice = routine
    this.bw = this.session.settings.lastBw || (this.unit === 'lb' ? 160 : 70)
    this.weighParts()
    if (this.session.settings.weighIn === false) this.countdown()
    else this.screen = 'weigh'
  },
  openDebug() {
    var s = this.session
    this.debugLines = [
      { text: 'workout: ' + (s.workout ? s.workout.id : 'none') },
      { text: 'pending ticks: ' + Object.keys(s.pending || {}).length },
      { text: 'started here: ' + (s.startedHere || '-') },
      { text: 'clips: ' + Object.keys(s.clips || {}).length },
      { text: 'ready: ' + (s.ready ? 'yes' : 'no') + ', outbox: ' + s.outbox.length },
      { text: 'online: ' + (s.online ? 'yes' : 'no') }
    ]
    this.screen = 'debug'
  },
  closeDebug() { this.screen = 'idle'; this.sync() },

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
    } else this.bw = Math.max(0, Math.round(this.bw) + (delta > 0 ? 1 : -1))
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
    if (this.touchLocked || !s.workout || !s.workout.entries[this.ei]) return
    var e = s.workout.entries[this.ei]
    if (!this.live) this.live = { weight: Number(this.weight) || 0, reps: Number(this.reps) || 0, seconds: Number(this.seconds) || 30 }
    this.editField = field
    this.editTitle = field === 'weight' ? (this.bodyweight ? this.words.addedWeight : this.words.weight)
      : field === 'reps' ? this.words.reps : field === 'seconds' ? this.words.hold : this.effortName
    this.editSuffix = field === 'weight' ? this.unit : field === 'seconds' ? 's' : ''
    var step = field === 'weight' ? (e.step > 0 ? e.step : this.unit === 'lb' ? 5 : 2.5) : field === 'seconds' ? 5 : 1
    this.editStep = '± ' + formatNumber(step) + (field === 'weight' ? ' ' + this.unit : field === 'seconds' ? ' s' : '')
    if (field === 'effort') {
      var kind = s.settings.effort
      this.editPos = effortPosition(kind, this.effort == null ? effortStart(kind) : this.effort)
      var startValue = effortValue(kind, this.editPos)
      this.editValue = startValue == null ? '–' : formatNumber(startValue)
    } else {
      this.editValue = field === 'weight' ? this.weight : field === 'reps' ? this.reps : this.seconds
    }
    this.screen = 'edit'
  },
  editStepBy(delta) {
    var s = this.session
    if (!s.workout || !s.workout.entries[this.ei]) return
    if (this.editField === 'effort') {
      var kind = s.settings.effort
      this.editPos = Math.min(kind === 'rpe' ? 9 : 6, Math.max(0, this.editPos + (delta > 0 ? 1 : -1)))
      var v = effortValue(kind, this.editPos)
      this.editValue = v == null ? '–' : formatNumber(v)
      this.effort = v
      this.effortText = this.editValue
      this.effortColor = effortColor(kind, v)
      return
    }
    var e = s.workout.entries[this.ei]
    var step = this.editField === 'weight' ? (e.step > 0 ? e.step : this.unit === 'lb' ? 5 : 2.5) : this.editField === 'seconds' ? 5 : 1
    var current = Number(this.editValue) || 0
    var next = Math.round((current + (delta > 0 ? step : -step)) / step) * step
    if (this.editField === 'seconds') next = Math.max(5, next)
    else next = Math.max(0, next)
    this.editValue = formatNumber(next)
    if (this.editField === 'weight') { this.live.weight = next; this.weight = this.editValue; this.edited = true }
    else if (this.editField === 'reps') { this.live.reps = next; this.reps = this.editValue; this.edited = true }
    else { this.live.seconds = next; this.seconds = this.editValue }
  },
  editDone() { this.screen = 'exercise'; this.sync() },

  // ---- a set ----------------------------------------------------------------------------------
  done() {
    if (this.touchLocked) return
    if (this.timed) {
      var seconds = Number(this.seconds) || 30
      this.app.startHold(this.ei, this.si, { w: Number(this.weight) || 0, sec: seconds }, seconds * 1000)
    } else this.complete()
  },
  complete(automatic) {
    if (this.touchLocked && automatic !== true) return
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
  askSkip() { if (!this.touchLocked && !this.noSet && this.si >= 0) this.skipConfirm = true },
  skipConfirmed() { this.skipConfirm = false; if (!this.touchLocked && !this.noSet && this.si >= 0) this.app.skipSet(this.ei, this.si) },
  cancelSkip() { this.skipConfirm = false },
  pickDot(i) { if (this.touchLocked) return; this.ackRest(); this.picked = i; this.screen = 'exercise'; this.sync() },
  onSwipe(evt) {
    if (this.touchLocked || !this.session.workout || typeof this.ei !== 'number') return
    var dir = evt && evt.direction
    var ei = this.ei + (dir === 'down' || dir === 'right' ? -1 : 1)
    if (ei < 0 || ei >= this.session.workout.entries.length) return
    this.picked = -1
    this.app.showEntry(ei)
  },

  // ---- rest, hold -----------------------------------------------------------------------------
  // Rest is over: three pulses, one repeat after 5 s unless the wrist notices (Apple's pattern).
  startRestAlarm() {
    this.alarmOn = true
    this.pulse(0); this.pulse(150); this.pulse(300)
    var page = this
    this.alarmTimer = setTimeout(function () {
      if (!page.alarmOn) return
      page.pulse(0); page.pulse(150); page.pulse(300)
    }, 5000)
  },
  pulse(delay) { var page = this; setTimeout(function() { if (page.alarmOn) page.app.vibrate() }, delay) },
  ackRest() {
    this.alarmOn = false
    if (this.alarmTimer) { clearTimeout(this.alarmTimer); this.alarmTimer = null }
  },
  restMore() { if (!this.touchLocked) this.app.restMore(15000) },
  endRest() { this.app.closeRestAt(Date.now()) },
  restSkip() { if (!this.touchLocked) this.endRest() },

  // ---- finish ---------------------------------------------------------------------------------
  finishPage() { if (this.touchLocked || !this.session || !this.session.workout) return; this.manualFinish = true; this.finishView(this.session); this.screen = 'finish' },
  save() { if (this.touchLocked || !this.session || !this.session.workout) return; this.manualFinish = false; this.screen = 'summary'; this.app.finishWorkout(Date.now(), false) },
  discard() { if (this.touchLocked || !this.session || !this.session.workout) return; this.confirm = true },
  confirmDiscard() { this.confirm = false; this.screen = 'idle'; this.app.finishWorkout(Date.now(), true) },
  cancelDiscard() { this.confirm = false; this.finishView(this.session); this.screen = 'finish' },
  resume() { this.manualFinish = false; this.confirm = false; this.screen = 'exercise'; this.sync() },
  closeSummary() { this.app.clearSummary() },

  // ---- 20 minutes without a set ---------------------------------------------------------------
  keepGoing() { this.asking = false; this.app.snooze() },
  askFinish() { this.asking = false; this.finishPage() },

  // ---- lock -----------------------------------------------------------------------------------
  lockPage() { if (this.session.workout) this.app.lock(true) },
  unlockPage() { this.app.lock(false) },
  toggleSensor() { this.app.sensor(!this.session.sensorEnabled) }
}
