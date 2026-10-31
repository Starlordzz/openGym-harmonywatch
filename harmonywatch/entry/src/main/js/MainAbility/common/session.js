// Plain JSON state; no platform APIs. Times and protocol match WatchCore (milliseconds).
import { setIndex, sideUp, key } from './model.js'
export { setIndex, sideUp }
export function initialState() {
  return { workout: null, ready: null, settings: {}, unit: 'kg', restSec: 90,
    startedHere: null, finishedHere: [], pending: {}, skipped: [], entryIndex: 0, outbox: [], sequence: 0 }
}
function copy(v) { return JSON.parse(JSON.stringify(v)) }
export function restoreState(value) {
  if (!Array.isArray(value.outbox)) throw Error('Invalid state')
  var s = Object.assign(initialState(), value)
  // Old keys omitted the entry index. Recover pending events from their recorded entryIdx;
  // an ambiguous old skip belongs only to its first occurrence, never every duplicate.
  if (s.workout) s.workout.entries.forEach(function(e, ei) {
    e.sets.forEach(function(row, si) {
      var i = s.skipped.indexOf(key(e.id, si))
      if (i >= 0) s.skipped[i] = key(e.id, si, '', ei)
    })
  })
  Object.keys(s.pending).forEach(function(k) {
    var p = s.pending[k]
    if (p.entryIdx == null) return
    var next = key(p.exId, p.setIdx, p.side, p.entryIdx)
    if (next !== k) { s.pending[next] = p; delete s.pending[k] }
  })
  return s
}
export function event(s, type, fields, at) {
  s.sequence += 1
  var ev = Object.assign({ id: 'fit-' + at + '-' + s.sequence, type: type, at: at }, fields)
  s.outbox.push(ev)
  return ev
}
function mark(row, tick) {
  if (tick.side && row.sides) {
    var one = row.sides[tick.side]
    one.done = true
    if (tick.w != null) one.w = tick.w
    if (tick.r != null) one.r = tick.r
    row.done = row.sides.L.done && row.sides.R.done
    row.r = (row.sides.L.r || 0) + (row.sides.R.r || 0)
    row.w = Math.max(row.sides.L.w || 0, row.sides.R.w || 0)
  } else {
    row.done = true
    ;['w', 'r', 'sec'].forEach(function(k) { if (tick[k] != null) row[k] = tick[k] })
  }
  row.at = Math.max(row.at || 0, tick.at)
}
export function applySnapshot(state, snap) {
  if (!snap || snap.v !== 1 || (snap.active && !Array.isArray(snap.active.entries))) throw Error('Unsupported snapshot')
  var s = copy(state), next = copy(snap.active || null)
  s.ready = snap.ready || null
  if (snap.settings) s.settings = copy(snap.settings)
  if (snap.unit) s.unit = snap.unit
  if (snap.restSec > 0) s.restSec = snap.restSec
  var unconfirmed = s.workout && s.workout.id === s.startedHere
  if (!next || s.finishedHere.indexOf(next.id) >= 0) {
    if (!unconfirmed) {
      if (s.workout) {
        // The phone ended it: finished there leaves a summary here, discarded there leaves nothing.
        var ended = s.workout.id
        var dropped = (snap.discarded || []).indexOf(ended) >= 0
        s.summary = dropped ? null : summary(s, Date.now())
        if (s.summary) s.summary.endedOnPhone = true
        s.finishedHere.push(ended); s.finishedHere = s.finishedHere.slice(-5)
      }
      s.workout = null; s.pending = {}; s.hold = null; s.restAfter = null; s.setStartedAt = null
    }
    return s
  }
  var same = s.workout && next.id === s.workout.id
  if (next.id === s.startedHere) s.startedHere = null
  if (!same && unconfirmed) return s
  if (!same) { s.pending = {}; s.skipped = []; s.entryIndex = next.cur || 0; s.hold = null; s.touchLocked = false }
  next.entries.forEach(function(e, ei) {
    e.sets.forEach(function(row, i) {
      ;['', 'L', 'R'].forEach(function(side) {
        var k = key(e.id, i, side, ei), p = s.pending[k]
        if (!p) return
        var have = side ? row.sides && row.sides[side] : row
        if (!have || (have.done && (row.at == null || row.at >= p.at))) delete s.pending[k]
        else mark(row, p)
      })
    })
  })
  s.entryIndex = Math.min(Math.max(s.entryIndex, 0), next.entries.length)
  s.workout = next
  return s
}
export function nextSet(s, ei, si) {
  var entries = s.workout.entries, e = entries[ei], candidates = [], i
  if (s.skipped.indexOf(key(e.id, si, '', ei)) < 0 && sideUp(e.sets[si])) return { entry: ei, rest: false }
  if (e.group) {
    var lo = ei, hi = ei
    while (lo > 0 && entries[lo - 1].group === e.group) lo--
    while (hi + 1 < entries.length && entries[hi + 1].group === e.group) hi++
    if (hi > lo) {
      for (i = ei + 1; i <= hi; i++) candidates.push(i)
      for (i = lo; i <= ei; i++) candidates.push(i)
      for (i = 0; i < candidates.length; i++) if (setIndex(s, candidates[i]) >= 0) return { entry: candidates[i], rest: candidates[i] <= ei }
      candidates = []
      for (i = hi + 1; i < entries.length; i++) candidates.push(i)
      for (i = 0; i < lo; i++) candidates.push(i)
    }
  }
  if (!candidates.length) {
    for (i = ei; i < entries.length; i++) candidates.push(i)
    for (i = 0; i < ei; i++) candidates.push(i)
  }
  for (i = 0; i < candidates.length; i++) if (setIndex(s, candidates[i]) >= 0) return { entry: candidates[i], rest: true }
  return { entry: entries.length, rest: true }
}
export function start(s, routine, at, bw) {
  if (s.workout) throw Error('Workout already running')
  var wid = 'fit-workout-' + at + '-' + (s.sequence + 1)
  s.workout = { id: wid, name: routine.name, unit: s.unit, start: at, cur: 0,
    restSec: s.restSec, entries: copy(routine.entries), rest: null, healthType: routine.healthType || null }
  s.startedHere = wid; s.pending = {}; s.skipped = []; s.entryIndex = 0; s.hold = null; s.touchLocked = false; s.summary = null
  s.restAfter = null; s.setStartedAt = at
  if (bw > 0 && bw < 700) event(s, 'weighIn', { w: Math.round(bw * 10) / 10 }, at)
  event(s, 'start', { wid: wid, routineIds: routine.routineIds }, at)
}
export function tick(s, ei, si, values, at) {
  var e = s.workout && s.workout.entries[ei], row = e && e.sets[si]
  if (!row || row.done) return false
  var side = sideUp(row), fields = { wid: s.workout.id, exId: e.id, entryIdx: ei, setIdx: si }
  if (side) fields.side = side
  ;['w', 'r', 'sec'].forEach(function(k) {
    if (typeof values[k] === 'number' && isFinite(values[k]) && values[k] >= 0) fields[k] = values[k]
  })
  var effort = s.settings.effort
  if ((effort === 'rpe' || effort === 'rir') && values[effort] != null) {
    fields[effort] = Math.min(10, Math.max(effort === 'rpe' ? 1 : 0, Math.round(values[effort] * 2) / 2))
  }
  if (values.hr) fields.hr = values.hr
  var ev = event(s, 'setDone', fields, at)
  mark(row, ev)
  s.pending[key(e.id, si, side, ei)] = copy(ev)
  var next = nextSet(s, ei, si)
  s.entryIndex = next.entry; s.hold = null
  var rest = e.restSec == null ? s.workout.restSec : e.restSec
  s.restDurationSec = rest
  s.workout.rest = next.rest && rest > 0 ? { endsAt: at + rest * 1000 } : null
  return true
}
export function skip(s, ei, si) {
  var e = s.workout && s.workout.entries[ei]
  if (!e || !e.sets[si] || e.sets[si].done) return
  s.skipped.push(key(e.id, si, '', ei))
  var next = nextSet(s, ei, si)
  // Skipping a unilateral row skips both sides.
  if (next.entry === ei && setIndex(s, ei) < 0) next.entry = s.workout.entries.length
  s.entryIndex = next.entry; s.hold = null
}
export function summary(s, at) {
  var w = s.workout, out = { name: w.name, seconds: Math.max(0, Math.round((at - w.start) / 1000)), sets: 0, volume: 0, records: 0, recordNames: [], endedOnPhone: false }
  w.entries.forEach(function(e) {
    var record = false
    e.sets.forEach(function(row) {
      if (row.warmup) return
      if (row.sides) ['L', 'R'].forEach(function(side) { var v = row.sides[side]; if (v.done) out.volume += (v.w || 0) * (v.r || 0) })
      if (!row.done) return
      out.sets++
      if (!row.sides && e.mode === 'reps') out.volume += (row.w || 0) * (row.r || 0)
      var best = e.best
      if (!best || e.mode === 'cardio') return
      if (e.mode === 'time') record = record || best.sec > 0 && row.sec > best.sec
      else if (best.w > 0 || best.r > 0) record = record || (row.w !== best.w ? row.w > 0 && (e.assisted ? row.w < best.w : row.w > best.w) : row.r > best.r)
    })
    if (record) { out.records++; if (out.recordNames.indexOf(e.name) < 0) out.recordNames.push(e.name) }
  })
  return out
}
export function finish(s, at, discard) {
  if (!s.workout) return
  s.summary = discard ? null : summary(s, at)
  event(s, discard ? 'discard' : 'finish', { wid: s.workout.id }, at)
  s.finishedHere.push(s.workout.id); s.finishedHere = s.finishedHere.slice(-5)
  s.workout = null; s.pending = {}; s.skipped = []; s.startedHere = null; s.hold = null; s.touchLocked = false
  s.restAfter = null; s.setStartedAt = null
}
export function acknowledge(s, ids) {
  s.outbox = s.outbox.filter(function(e) { return ids.indexOf(e.id) < 0 })
}
export function idle(s, now) {
  if (!s.workout) return ''
  if (s.hold && s.hold.endsAt > now || s.workout.rest && s.workout.rest.endsAt > now) return ''
  var last = s.workout.start
  s.workout.entries.forEach(function(e) { e.sets.forEach(function(row) { last = Math.max(last, row.at || 0) }) })
  var elapsed = now - Math.max(last, s.activity || 0, s.snooze || 0)
  return elapsed >= 45 * 60000 ? 'end' : elapsed >= 20 * 60000 ? 'ask' : ''
}
