// Append work targets only; completion, measured heart rate and effort belong to the old set.
export function addSet(s, ei, at, emit) {
  var e = s.workout && s.workout.entries[ei]
  if (!e || !e.sets.length || e.sets.length + (e.mode === 'time' && e.perSide ? 2 : 1) > 60) return
  var last = e.sets[e.sets.length - 1], row = { done: false }
  ;['w', 'r', 'sec', 'min', 'speed', 'incline', 'max'].forEach(function(k) { if (last[k] != null) row[k] = last[k] })
  if (last.sides) {
    row.sides = {}
    ;['L', 'R'].forEach(function(side) { var v = last.sides[side]; row.sides[side] = { w: v.w, r: v.r, done: false } })
  }
  var base = e.sets.length
  if (e.mode === 'time' && e.perSide) { row.side = 'L'; e.sets.push(row); row = JSON.parse(JSON.stringify(row)); row.side = 'R' }
  e.sets.push(row)
  var ev = emit(s, 'addSet', { wid: s.workout.id, exId: e.id, entryIdx: ei, count: e.sets.length, base: base }, at)
  s.additions = s.additions || {}
  s.additions[ei] = { id: e.id, count: e.sets.length, eventId: ev && ev.id }
  if (s.entryIndex >= s.workout.entries.length) s.entryIndex = ei
  s.activity = Math.max(s.activity || 0, at)
}
