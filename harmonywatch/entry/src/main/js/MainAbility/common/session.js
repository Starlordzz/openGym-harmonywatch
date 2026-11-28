// Plain JSON state; no platform APIs. Times and protocol match WatchCore (milliseconds).
import { setIndex, sideUp, key } from './model.js'
export { setIndex, sideUp }
export function initialState() {
  return { workout: null, ready: null, settings: {}, unit: 'kg', restSec: 90,
    startedHere: null, startId: null, finishedHere: [], pending: {}, skipped: [],
    entryIndex: 0, outbox: [], sequence: 0, clockOff: 0, restAt: 0, additions: {} }
}
function copy(v) { return JSON.parse(JSON.stringify(v)) }
export function restoreState(value) {
  if (!Array.isArray(value.outbox)) throw Error('Invalid state')
  var s = Object.assign(initialState(), value)
  delete s.touchLocked
  delete s.sensorEnabled
  if (typeof s.clockOff !== 'number' || !isFinite(s.clockOff)) s.clockOff = 0
  if (s.activity != null) s.activity = Number(s.activity) || 0
  s.restAt = Number(s.restAt) || 0
  if (!s.additions) s.additions = {}
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
  var keepSkip = false
  if (type === 'navigate' || type === 'restChange' || type === 'stillHere') {
    s.outbox = s.outbox.filter(function(e) {
      if (e.type === type && (!fields || !fields.wid || e.wid === fields.wid)) {
        if (e.restSkip) keepSkip = true
        return false
      }
      return true
    })
  }
  s.sequence += 1
  var ev = Object.assign({ id: 'fit-' + at + '-' + s.sequence, seq: s.sequence, type: type, at: at }, fields)
  if (keepSkip && !ev.restSkip) ev.restSkip = true
  if (s.clockOff) ev.off = s.clockOff
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
function shallowCloneState(state) {
  var s = initialState()
  Object.keys(state || {}).forEach(function(k) {
    if (k === 'ready' || k === 'clips') s[k] = state[k]
    else if (state[k] !== undefined) s[k] = copy(state[k])
  })
  return s
}
function findPendingKey(pending, sid, side) {
  if (!sid) return ''
  var keys = Object.keys(pending || {})
  for (var i = 0; i < keys.length; i++) {
    var p = pending[keys[i]]
    if (p && p.sid === sid && (p.side || '') === side) return keys[i]
  }
  return ''
}
export function applySnapshot(state, snap, at) {
  if (!snap || snap.v !== 1 || (snap.active && !Array.isArray(snap.active.entries))) throw Error('Unsupported snapshot')
  var s = shallowCloneState(state), next = copy(snap.active || null), now = at != null ? at : Date.now()
  s.ready = snap.ready || null
  if (snap.settings) s.settings = copy(snap.settings)
  if (snap.unit) s.unit = snap.unit
  if (snap.restSec > 0) s.restSec = snap.restSec
  if (typeof snap.now === 'number' && isFinite(snap.now) && snap.now > 0) s.clockOff = now - snap.now
  if (Array.isArray(snap.acked) && snap.acked.length) {
    acknowledge(s, snap.acked)
    if (s.startId && snap.acked.indexOf(s.startId) >= 0) { s.startId = null; s.startedHere = null }
    Object.keys(s.pending || {}).forEach(function(k) {
      var p = s.pending[k]
      if (p && p.id && snap.acked.indexOf(p.id) >= 0) delete s.pending[k]
    })
    Object.keys(s.additions || {}).forEach(function(k) {
      var a = s.additions[k]
      if (a && a.eventId && snap.acked.indexOf(a.eventId) >= 0) delete s.additions[k]
    })
  }
  var wid = s.workout && s.workout.id
  var dropped = !!(wid && (snap.discarded || []).indexOf(wid) >= 0)
  if (dropped && wid === s.startedHere) { s.startedHere = null; s.startId = null }
  var unconfirmed = s.workout && s.workout.id === s.startedHere
  if (!next || s.finishedHere.indexOf(next.id) >= 0) {
    if (!unconfirmed) {
      if (s.workout) {
        // The phone ended it: finished there leaves a summary here, discarded there leaves nothing.
        var ended = s.workout.id
        var droppedEnded = (snap.discarded || []).indexOf(ended) >= 0
        s.summary = droppedEnded ? null : summary(s, now)
        if (s.summary) s.summary.endedOnPhone = true
        s.finishedHere.push(ended); s.finishedHere = s.finishedHere.slice(-5)
      }
      s.workout = null; s.pending = {}; s.skipped = []; s.hold = null; s.restAfter = null; s.setStartedAt = null
      s.additions = {}; s.startId = null; s.startedHere = null; delete s.activity; s.restAt = 0
    }
    return s
  }
  if (s.clockOff) {
    if (next.start > 0) next.start += s.clockOff
    if (next.pausedAt > 0) next.pausedAt += s.clockOff
    if (next.activeAt > 0) next.activeAt += s.clockOff
    if (next.restAt > 0) next.restAt += s.clockOff
    if (next.rest && !next.rest.paused && next.rest.endsAt > 0) next.rest.endsAt += s.clockOff
    next.entries.forEach(function(e) {
      e.sets.forEach(function(row) {
        if (row.at > 0) row.at += s.clockOff
        if (row.sides) ['L', 'R'].forEach(function(side) { if (row.sides[side] && row.sides[side].at > 0) row.sides[side].at += s.clockOff })
      })
    })
  }
  if (!next.rest && next.restPaused && next.restLeft > 0) {
    next.rest = { endsAt: 0, paused: true, left: next.restLeft, total: Math.max(next.restLeft, s.restDurationSec || next.restSec || s.restSec || 90) }
  }
  var same = s.workout && next.id === s.workout.id
  if (next.id === s.startedHere) { s.startedHere = null; s.startId = null }
  if (!same && unconfirmed) return s
  if (!same) {
    s.pending = {}; s.skipped = []; s.entryIndex = next.cur || 0; s.hold = null; s.closedRestAt = 0
    s.additions = {}; if (next.activeAt) s.activity = next.activeAt; else delete s.activity; s.restAt = next.restAt || 0
  } else {
    if (next.activeAt && next.activeAt > (s.activity || 0)) s.activity = next.activeAt
    var hasPendingRest = s.outbox.some(function(e) { return e.type === 'restChange' })
    if (typeof next.restAt === 'number' && next.restAt > 0) {
      if (hasPendingRest || next.restAt <= (s.restAt || 0)) next.rest = copy(s.workout.rest)
      else s.restAt = next.restAt
    } else if (hasPendingRest) {
      next.rest = copy(s.workout.rest)
    }
  }
  if (same && next.rest && !next.rest.paused && next.rest.endsAt <= (s.closedRestAt || 0)) next.rest = null
  next.entries.forEach(function(e, ei) {
    var addition = same && s.additions && s.additions[ei], old = same && s.workout.entries[ei]
    if (addition && old && addition.id === e.id) {
      if (e.sets.length >= addition.count) delete s.additions[ei]
      else e.sets = e.sets.concat(copy(old.sets.slice(e.sets.length, addition.count)))
    }
    e.sets.forEach(function(row, i) {
      var prior = old && old.id === e.id && old.sets[i]
      if (prior && prior.done && (prior.at || 0) > (row.at || 0)) { row = copy(prior); e.sets[i] = row }
      ;['', 'L', 'R'].forEach(function(side) {
        var k = key(e.id, i, side, ei), p = s.pending[k]
        if (!p && row.sid) {
          var sk = findPendingKey(s.pending, row.sid, side)
          if (sk) { k = sk; p = s.pending[k] }
        }
        if (!p) return
        var have = side ? row.sides && row.sides[side] : row
        var stamp = !have ? null
          : !side ? (have.at != null ? have.at : row.at)
          : (have.at != null ? have.at : (have.done || (!row.sides.L.done && !row.sides.R.done) ? row.at : null))
        if (!have || (stamp != null ? stamp >= p.at : have.done)) delete s.pending[k]
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
  s.startedHere = wid; s.pending = {}; s.skipped = []; s.entryIndex = 0; s.hold = null; s.summary = null; s.additions = {}
  s.restAfter = null; s.setStartedAt = at; s.activity = at; s.restAt = 0
  if (bw > 0 && bw < 700) event(s, 'weighIn', { w: Math.round(bw * 10) / 10 }, at)
  var ev = event(s, 'start', { wid: wid, routineIds: routine.routineIds }, at)
  s.startId = ev.id
}
export function tick(s, ei, si, values, at) {
  var e = s.workout && s.workout.entries[ei], row = e && e.sets[si]
  if (!row || row.done) return false
  var side = sideUp(row), fields = { wid: s.workout.id, exId: e.id, entryIdx: ei, setIdx: si }
  if (row.sid) fields.sid = row.sid
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
  var next = nextSet(s, ei, si)
  var rest = e.restSec == null ? s.workout.restSec : e.restSec
  var nextRest = next.rest && rest > 0 ? { endsAt: at + rest * 1000 } : null
  ev.restEnd = nextRest ? nextRest.endsAt : 0
  s.pending[key(e.id, si, side, ei)] = copy(ev)
  s.entryIndex = next.entry; s.hold = null
  s.restDurationSec = rest
  s.workout.rest = nextRest
  s.activity = Math.max(s.activity || 0, at)
  if (nextRest) s.restAt = Math.max(s.restAt || 0, at)
  return true
}
export function skip(s, ei, si, at) {
  var e = s.workout && s.workout.entries[ei]
  if (!e || !e.sets[si] || e.sets[si].done) return
  s.skipped.push(key(e.id, si, '', ei))
  var next = nextSet(s, ei, si)
  // Skipping a unilateral row skips both sides.
  if (next.entry === ei && setIndex(s, ei) < 0) next.entry = s.workout.entries.length
  s.entryIndex = next.entry; s.hold = null
  if (at) s.activity = Math.max(s.activity || 0, at)
}
export function summary(s, at) {
  var w = s.workout, out = { name: w.name, seconds: Math.max(0, Math.round((at - w.start) / 1000)), sets: 0, volume: 0, records: 0, recordNames: [], endedOnPhone: false }
  var targetUnit = s.unit || w.unit || 'kg'
  w.entries.forEach(function(e) {
    var record = false
    var unit = e.unit || w.unit || targetUnit
    var factor = unit === targetUnit ? 1 : (targetUnit === 'lb' ? 1 / 0.45359237 : 0.45359237)
    e.sets.forEach(function(row) {
      if (row.warmup) return
      if (row.sides) ['L', 'R'].forEach(function(side) { var v = row.sides[side]; if (v.done) out.volume += (v.w || 0) * factor * (v.r || 0) })
      if (!row.done) return
      out.sets++
      if (!row.sides && e.mode === 'reps') out.volume += (row.w || 0) * factor * (row.r || 0)
      var best = e.best
      if (!best || e.mode === 'cardio') return
      if (e.mode === 'time') record = record || best.sec > 0 && row.sec > best.sec
      else if (best.w > 0 || best.r > 0) record = record || (row.w !== best.w ? row.w > 0 && (e.assisted ? row.w < best.w : row.w > best.w) : row.r > best.r)
    })
    if (record) { out.records++; if (out.recordNames.indexOf(e.name) < 0) out.recordNames.push(e.name) }
  })
  return out
}
export function finish(s, at, discard, isIdle) {
  if (!s.workout) return
  s.summary = discard ? null : summary(s, at)
  var fields = { wid: s.workout.id }
  if (isIdle && !discard) fields.idle = true
  event(s, discard ? 'discard' : 'finish', fields, at)
  s.finishedHere.push(s.workout.id); s.finishedHere = s.finishedHere.slice(-5)
  s.workout = null; s.pending = {}; s.skipped = []; s.startedHere = null; s.startId = null; s.hold = null
  s.restAfter = null; s.setStartedAt = null; s.additions = {}; delete s.activity; s.restAt = 0
}
export function acknowledge(s, ids) {
  s.outbox = s.outbox.filter(function(e) { return ids.indexOf(e.id) < 0 })
}
export function idle(s, now) {
  if (!s.workout) return ''
  if (s.hold && s.hold.endsAt > now || s.workout.rest && (s.workout.rest.paused || s.workout.rest.endsAt > now)) return ''
  var last = s.workout.start
  s.workout.entries.forEach(function(e) { e.sets.forEach(function(row) { last = Math.max(last, row.at || 0) }) })
  var elapsed = now - Math.max(last, s.activity || 0, s.snooze || 0)
  return elapsed >= 45 * 60000 ? 'end' : elapsed >= 20 * 60000 ? 'ask' : ''
}
