// Samples are milliseconds and bpm; no platform or permission assumptions.
import { event } from './session.js'
export function stats(samples, from, to) {
  var count = 0, total = 0, peak = 0
  samples.forEach(function(v) {
    if (v.at < from || v.at > to || v.value < 25 || v.value > 250) return
    count++; total += v.value; peak = Math.max(peak, v.value)
  })
  return count ? { avg: Math.round(total / count), max: peak } : null
}
export function closeRest(s, samples, at) {
  var r = s.restAfter
  if (!r) return
  var rest = s.workout && s.workout.rest
  var deadline = r.endsAt
  if (rest) deadline = deadline ? Math.min(deadline, rest.endsAt) : rest.endsAt
  var end = deadline ? Math.min(at, deadline) : at
  var hr = stats(samples, r.from, end)
  if (hr) event(s, 'setHr', { wid: r.wid, exId: r.exId, entryIdx: r.entryIdx, setIdx: r.setIdx, restHr: hr }, end)
  s.restAfter = null; s.setStartedAt = end
}
export function localTick(s, samples, at) {
  closeRest(s, samples, at)
  return stats(samples, s.setStartedAt || s.workout.start, at)
}
export function afterTick(s, ei, si, at, endsAt) {
  s.setStartedAt = at
  if (endsAt == null) endsAt = s.workout.rest && s.workout.rest.endsAt
  s.restAfter = endsAt > at ? { wid: s.workout.id, exId: s.workout.entries[ei].id, entryIdx: ei, setIdx: si, from: at, endsAt: endsAt } : null
}
export function phoneTicks(before, after) {
  if (!before || !after || before.id !== after.id) return []
  var out = []
  after.entries.forEach(function(e, ei) {
    var old = before.entries[ei]
    if (!old || old.id !== e.id) return
    e.sets.forEach(function(row, si) {
      var was = old.sets[si]
      if (!was || !(row.at > 0)) return
      var side = row.sides && ['L', 'R'].some(function(k) { return row.sides[k].done && !(was.sides && was.sides[k].done) })
      if (row.done && !was.done || side) out.push({ exId: e.id, entryIdx: ei, setIdx: si, at: row.at })
    })
  })
  return out.sort(function(a, b) { return a.at - b.at })
}
export function mergeHeart(s, before, samples, now) {
  var w = s.workout
  if (!w) { closeRest(s, samples, now); return }
  if (!before || before.id !== w.id) {
    s.restAfter = null; s.setStartedAt = now
    if (w.rest && w.rest.endsAt > now) {
      var latest
      w.entries.forEach(function(e, ei) { e.sets.forEach(function(row, si) {
        if (row.at > 0 && row.at <= now && (!latest || row.at > latest.at)) latest = { ei: ei, si: si, at: row.at }
      }) })
      if (latest) { afterTick(s, latest.ei, latest.si, now, w.rest.endsAt) }
      else s.setStartedAt = w.rest.endsAt
    }
    return
  }
  var ticks = phoneTicks(before, w)
  ticks.forEach(function(t, i) {
    var from = s.setStartedAt || s.workout.start
    if (t.at <= from || t.at > now + 60000) return
    closeRest(s, samples, t.at)
    var hr = stats(samples, s.setStartedAt || s.workout.start, t.at)
    if (hr) event(s, 'setHr', { wid: s.workout.id, exId: t.exId, entryIdx: t.entryIdx, setIdx: t.setIdx, hr: hr }, now)
    var next = ticks[i + 1], e = w.entries[t.entryIdx]
    var ends = w.rest && w.rest.endsAt
    if (next) {
      var noRest = e.group && w.entries[next.entryIdx].group === e.group && next.entryIdx > t.entryIdx
      var seconds = noRest ? 0 : e.restSec == null ? w.restSec : e.restSec
      ends = Math.min(next.at, t.at + seconds * 1000)
    }
    afterTick(s, t.entryIdx, t.setIdx, t.at, ends || 0)
  })
}
