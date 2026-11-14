import data from './locales.js'
var cache = {}
function expand(text) {
  var out = ''
  for (var i = 0; i < text.length; i++) {
    var n = text.charCodeAt(i) - 384
    out += n >= 0 && n < data.fragments.length ? data.fragments[n] : text.charAt(i)
  }
  return out
}
function pack(lang) {
  var values = data.packs[lang]
  if (!values) return null
  var parent = values.base ? data.packs[values.base] : null
  var out = {}
  for (var i = 0; i < data.keys.length; i++) out[data.keys[i]] = expand(parent ? (values.changes[i] != null ? values.changes[i] : parent[i]) : values[i] || '')
  return out
}
export function wordsFor(lang) {
  var key = lang || 'zh-Hans'
  if (key === 'zh' || key === 'zh-CN') key = 'zh-Hans'
  if (key === 'pt') key = 'pt-PT'
  if (key === 'zh-TW') key = 'zh-Hant'
  if (!cache[key]) {
    var exact = pack(key)
    if (!exact) {
      var base = String(key).split('-')[0]
      exact = pack(base) || pack('en')
    }
    cache[key] = exact
  }
  return cache[key]
}
