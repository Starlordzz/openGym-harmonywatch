import { event } from './session.js'
export function setRest(s, rest) {
  s.workout.rest = rest
  if (rest && rest.total) s.restDurationSec = rest.total
  if (s.restAfter) s.restAfter.endsAt = rest && !rest.paused ? rest.endsAt : 0
}
export function changeRest(s, ms, pause, at) {
  var r = s.workout && s.workout.rest
  if (!r) return false
  var left = Math.min(900000, Math.max(0, (r.paused ? r.left * 1000 : r.endsAt - at) + ms))
  if (!left) return true
  var paused = pause ? !r.paused : !!r.paused
  r = { endsAt: paused ? 0 : at + left, paused: paused, left: Math.ceil(left / 1000), total: Math.max(r.total || s.restDurationSec || s.workout.restSec, Math.ceil(left / 1000)) }
  setRest(s, r)
  event(s, 'restChange', { wid: s.workout.id, rest: r }, at)
  return false
}
