// Lite's JS engine has no regular expressions (a literal anywhere fails the whole page eval),
// so clip names are checked character by character.
var CLIP_URI = 'internal://app/'
var HEX = '0123456789abcdef'
var DIGITS = '0123456789'
export function isClipName(name) {
  if (typeof name !== 'string' || name.length < 7) return false
  if (name.slice(0, 3) !== 'og-' || name.slice(name.length - 4) !== '.png') return false
  var core = name.slice(3, name.length - 4)
  var dash = core.indexOf('-')
  if (dash < 1 || dash !== core.lastIndexOf('-')) return false
  var hash = core.slice(0, dash), frame = core.slice(dash + 1)
  if (!hash.length || !frame.length) return false
  for (var i = 0; i < hash.length; i++) if (HEX.indexOf(hash.charAt(i)) < 0) return false
  for (var j = 0; j < frame.length; j++) if (DIGITS.indexOf(frame.charAt(j)) < 0) return false
  return true
}
export function clipPlan(s, p) {
  if (!s.workout || p.wid !== s.workout.id || !s.workout.entries.some(function(e) { return e.id === p.exId })) return false
  if (!Array.isArray(p.files) || p.files.length < 1 || p.files.length > 16 || !p.files.every(function(n) { return isClipName(n) })) return false
  s.clips = s.clips || {}
  s.clips[p.exId] = { wid: p.wid, names: p.files.slice(), paths: {}, interval: Math.max(100, Math.min(1000, p.interval || 125)) }
  return true
}
export function acceptFile(s, path) {
  if (typeof path !== 'string') return false
  var name = path.slice(path.lastIndexOf('/') + 1)
  if (!isClipName(name)) return false
  var uri = path.indexOf(CLIP_URI) === 0 ? path : CLIP_URI + name
  if (uri.indexOf('..') >= 0) return false
  var accepted = false
  Object.keys(s.clips || {}).forEach(function(k) {
    var c = s.clips[k]
    if (s.workout && c.wid === s.workout.id && c.names.indexOf(name) >= 0) { c.paths[name] = uri; accepted = true }
  })
  return accepted
}
export function clipAt(s, exId, time) {
  var clip = s.clips && s.clips[exId]
  if (!clip || !s.workout || clip.wid !== s.workout.id || s.settings.show && s.settings.show.clip === false) return ''
  if (!clip.names.every(function(n) { return !!clip.paths[n] })) return ''
  return clip.paths[clip.names[Math.floor(time / clip.interval) % clip.names.length]]
}
export function isClipUri(uri) {
  return typeof uri === 'string' && uri.indexOf(CLIP_URI) === 0 && isClipName(uri.slice(CLIP_URI.length))
}
export function clearClips(s, remove) {
  Object.keys(s.clips || {}).forEach(function(k) {
    var c = s.clips[k]; Object.keys(c.paths).forEach(function(n) { remove(c.paths[n]) })
  })
  s.clips = {}
}
