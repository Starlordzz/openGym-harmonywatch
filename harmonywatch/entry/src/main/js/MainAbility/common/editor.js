// Dispatched by app.js: keep numeric mutations out of the page's separate 48 KB bundle.
// Reuse the page's formatters instead of bundling the entire formatting module a second time.
export function adjustNumber(page, delta, formatNumber, effortValue, effortColor) {
  var s = page.session
  if (!s.workout || !s.workout.entries[page.ei]) return
  if (page.editField === 'effort') {
    var kind = s.settings.effort
    page.editPos = Math.min(kind === 'rpe' ? 9 : 6, Math.max(0, page.editPos + (delta > 0 ? 1 : -1)))
    var v = effortValue(kind, page.editPos)
    page.editValue = v == null ? '–' : formatNumber(v)
    page.effort = v
    page.effortText = page.editValue
    page.effortColor = effortColor(kind, v)
    return
  }
  var step = page.editIncrement
  var current = Number(page.editValue) || 0
  var next = Math.round((current + (delta > 0 ? step : -step)) * 100) / 100
  next = Math.max(page.editField === 'seconds' ? 5 : 0, next)
  page.editValue = formatNumber(next)
  if (page.editField === 'weight') { page.live.weight = next; page.weight = page.editValue; page.edited = true }
  else if (page.editField === 'reps') { page.live.reps = next; page.reps = page.editValue; page.edited = true }
  else { page.live.seconds = next; page.seconds = page.editValue }
}
