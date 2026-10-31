// Display rules copied from the Apple Watch app (formatNumber, countdown, effort, dots, progress).
// Nothing here touches platform APIs, so the watch page and its tests share it.
import { key } from './model.js'

export function formatNumber(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '0'
  var tenths = Math.round(v * 10)
  if (tenths % 10 === 0) return String(tenths / 10)
  return (tenths / 10).toFixed(1)
}

// Source Han numeric advances are at most about 0.56em (decimal point 0.28em).
// Match SwiftUI's minimumScaleFactor(0.5) only when a long number cannot fit beside its unit.
function numberUnits(text) {
  var units = 0, s = String(text)
  for (var i = 0; i < s.length; i++) units += s.charAt(i) === '.' ? 0.28 : 0.56
  return Math.max(0.56, units)
}
export function numberFont(text, base, width) {
  return Math.max(base / 2, Math.min(base, Math.floor(width / numberUnits(text))))
}
export function numberWidth(text, size) { return Math.ceil(numberUnits(text) * size) }

// m:ss counting down (ceil), like SwiftUI's timerInterval readout.
export function clock(seconds) {
  var s = Math.max(0, Math.ceil(seconds))
  var m = Math.floor(s / 60)
  return m + ':' + ('0' + s % 60).slice(-2)
}

// 12,345: the summary's volume, grouped like the phone's number formatter.
export function grouped(n) {
  var text = String(Math.round(Math.abs(n)))
  var out = ''
  for (var i = 0; i < text.length; i++) {
    if (i > 0 && (text.length - i) % 3 === 0) out += ','
    out += text.charAt(i)
  }
  return (n < 0 ? '-' : '') + out
}

var NOTCHES = { rpe: [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10], rir: [5, 4, 3, 2, 1, 0] }
// lib/effort.js bands by RIR: 0 nothing left … 5 easy.
var BANDS = ['#bf5af2', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff']

export function effortNotches(kind) { return NOTCHES[kind] || null }
export function effortName(kind) { return kind === 'rpe' ? 'RPE' : 'RIR' }
export function effortValue(kind, position) {
  var n = NOTCHES[kind]
  if (!n || position < 1) return null
  return n[Math.min(position, n.length) - 1]
}
export function effortPosition(kind, value) {
  var n = NOTCHES[kind]
  if (!n || value == null) return 0
  var best = 0
  for (var i = 0; i < n.length; i++) if (Math.abs(n[i] - value) < Math.abs(n[best] - value)) best = i
  return best + 1
}
export function effortStart(kind) { return kind === 'rpe' ? 8 : 2 }
export function effortBand(kind, value) {
  var rir = kind === 'rpe' ? 10 - value : value
  var tops = [0.25, 0.75, 1.5, 2.5, 3.5]
  for (var i = 0; i < tops.length; i++) if (rir <= tops[i]) return i
  return tops.length
}
export function effortColor(kind, value) {
  return value == null ? '#ffffff' : BANDS[effortBand(kind, value)]
}

// The set dots: 6 px for a warm-up, 9 px otherwise, inside a 16 px tap box (9 + 7 = 16).
export function setDots(entry, current, skipped, ei) {
  var out = []
  entry.sets.forEach(function(row, i) {
    var half = !row.done && !!row.sides && (row.sides.L.done || row.sides.R.done)
    var colour = row.warmup ? '#ff9f0a' : '#ffffff'
    var size = row.warmup ? 6 : 9
    var isCurrent = i === current
    var isSkipped = !row.done && skipped.indexOf(key(entry.id, i, '', ei)) >= 0
    out.push({
      size: size, pad: (16 - size) / 2,
      fill: row.done ? colour : half ? colour : '#2c2c2e',
      opacity: half ? 0.5 : 1,
      border: isCurrent ? 1.5 : isSkipped ? 1 : 0,
      borderColor: isCurrent ? colour : '#9a9a9a',
      skipped: isSkipped
    })
  })
  return out
}

// %lld, %@, %1$lld, %1$@ — scanned by hand: lite's engine has no regular expressions.
export function fill(text, values) {
  text = String(text)
  var out = '', i = 0, next = 0
  while (i < text.length) {
    if (text.charAt(i) !== '%') { out += text.charAt(i); i++; continue }
    var j = i + 1, digits = ''
    while (j < text.length && text.charAt(j) >= '0' && text.charAt(j) <= '9') { digits += text.charAt(j); j++ }
    var positional = false
    if (digits && text.charAt(j) === '$') { positional = true; j++ }
    var width = text.slice(j, j + 3) === 'lld' ? 3 : text.charAt(j) === '@' ? 1 : 0
    if (!width) { out += text.charAt(i); i++; continue }
    var value = values[positional ? Number(digits) - 1 : next++]
    out += value == null ? '' : String(value)
    i = j + width
  }
  return out
}
