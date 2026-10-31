// Set selection and the side up next: shared by the session mutations (app bundle) and the view
// (page bundle), so neither has to carry the whole of session.js.
function key(e, i, side, entry) { return (entry == null ? '' : entry + ':') + e + '#' + i + (side ? '#' + side : '') }
export { key }
export function sideUp(row) {
  return row.sides ? (!row.sides.L.done ? 'L' : !row.sides.R.done ? 'R' : null) : null
}
export function setIndex(s, ei, picked) {
  var e = s.workout && s.workout.entries[ei]
  if (!e) return -1
  if (picked >= 0 && e.sets[picked] && !e.sets[picked].done) return picked
  for (var i = 0; i < e.sets.length; i++) {
    if (!e.sets[i].done && s.skipped.indexOf(key(e.id, i, '', ei)) < 0) return i
  }
  return -1
}
