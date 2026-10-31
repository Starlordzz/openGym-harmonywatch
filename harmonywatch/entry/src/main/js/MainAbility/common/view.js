// What the page shows, derived from the session state. Pure: the page keeps only the numbers being
// edited and the clocks; the rules Apple's SwiftUI views apply live here.
import { formatNumber, clock, grouped, setDots } from './format.js'
import { sideUp } from './model.js'

export function tagsOf(entry, row) {
  var side = sideUp(row)
  return { warmup: !!row.warmup, left: side === 'L', right: side === 'R', superset: !!entry.group }
}

// The number a tile shows: the live value on the current page, the set's own value elsewhere.
export function numbers(entry, row, live) {
  var side = sideUp(row), value = side ? row.sides[side] : row
  var bodyweight = entry.bodyweight === true
  var weight = live.weight != null ? live.weight : (value.w || 0)
  return {
    weight: formatNumber(weight),
    added: bodyweight && weight > 0 ? '+' + formatNumber(weight) : '',
    reps: formatNumber(live.reps != null ? live.reps : (value.r || 0)),
    seconds: formatNumber(live.seconds != null ? live.seconds : (row.sec || 30)),
    bodyweight: bodyweight,
    timed: entry.mode === 'time',
    cardio: entry.mode === 'cardio'
  }
}

export function dots(entry, current, skipped, ei) { return setDots(entry, current, skipped || [], ei) }

// The summary's stat stack, in Apple's order: Time, Sets, Volume, Heart rate.
export function summaryStats(sum, words, unit) {
  var stats = [{ key: 'time', label: words.time, value: clock(sum.seconds), color: '#ffffff' }]
  stats.push({ key: 'sets', label: words.sets, value: String(sum.sets), color: '#ffffff' })
  if (sum.volume > 0) stats.push({ key: 'volume', label: words.volume, value: grouped(sum.volume) + ' ' + unit, color: '#ffffff' })
  if (sum.hrAvg && sum.hrMax) stats.push({ key: 'hr', label: words.heart, value: Math.round(sum.hrAvg) + ' / ' + Math.round(sum.hrMax), color: '#ff453a' })
  return stats
}

// Apple's progress: non-warm-up sets only, a per-side row counts once when both sides are done.
export function progress(s) {
  var done = 0, total = 0
  if (!s.workout) return { done: done, total: total }
  s.workout.entries.forEach(function(e) {
    e.sets.forEach(function(row) {
      if (row.warmup) return
      total++
      if (row.done) done++
    })
  })
  return { done: done, total: total }
}

// "3 of 12 sets" from the localised template "%lld of %lld sets".
export function setsOf(template, p) {
  return p.total ? template.replace('%lld', String(p.done)).replace('%lld', String(p.total)) : ''
}
