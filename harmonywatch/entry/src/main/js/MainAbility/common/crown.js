// A detent may arrive as more than one event, and a turn can send a second burst shortly after.
// Lock the crown for 450 ms after a step so one turn is one step, never two. No haptic here:
// the platform only offers notification-style short/long buzzes, which feel wrong per detent.
export function crown(page, evt) {
  if (page.dead || !page.visible) return false
  var d = evt && evt.degree
  if (typeof d !== 'number' || !isFinite(d) || !d || Math.abs(d) > 360) return false
  var now = Date.now()
  if (evt.timestamp > 0 && evt.timestamp === page.crownStamp) return true
  page.crownStamp = evt.timestamp
  if (page.alarmOn) { page.ackRest(); return true }
  if (now - (page.crownInput || 0) > 260 || d * (page.crownDeg || 0) < 0) page.crownDeg = 0
  page.crownInput = now
  page.crownDeg = (page.crownDeg || 0) + d
  if (Math.abs(page.crownDeg) < 24) return true
  page.crownDeg = 0
  if (now - (page.crownLast || 0) < 450) return true
  var dir = d > 0 ? 1 : -1, s = page.session
  if (page.screen === 'edit') page.editStepBy(dir)
  else if (page.screen === 'weigh') page.weighStep(dir)
  else if (page.screen === 'exercise' && s && s.workout) {
    var ei = s.entryIndex + dir
    if (ei < 0 || ei >= s.workout.entries.length) return true
    page.picked = -1; page.app.showEntry(ei)
  } else return false
  page.crownLast = now
  return true
}
