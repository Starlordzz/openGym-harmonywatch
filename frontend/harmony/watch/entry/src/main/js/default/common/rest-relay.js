// The phone schedules the system notification before the Lite page can be suspended.
export function createRestRelay(send, now, boot) {
  var key = '', last = 0, deadline = 0
  return {
    reset: function() { key = '' },
    update: function(s) {
      var w = s.workout, at = w && w.rest && w.rest.endsAt || 0, enabled = s.settings.restHaptics !== false
      if (!at && !deadline && !key) return
      var next = (w ? w.id : '') + ':' + at + ':' + enabled, time = now()
      if (next === key && time - last < 30000) return
      // At normal expiry the phone alarm is already due; do not cancel its async delivery.
      var expired = !at && deadline && deadline <= time && w && enabled
      key = next; last = time; deadline = at
      if (!expired) send({ kind: 'restAlarm', boot: boot, at: at, rev: time, enabled: enabled })
    }
  }
}
