// Lite KV values are <128 bytes. Publish a small index only after the other file is complete.
export function stateStorage(store, file) {
  var key = 'opengym-fit-v1', base = 'internal://app/og-state', slot = 0
  return {
    get: function(o) {
      if (o.key !== key) { store.get(o); return }
      store.get({ key: key, default: '', fail: o.fail, success: function(v) {
        if (!v || v.charAt(0) !== '@') { o.success(v); return }
        slot = Number(v.charAt(1))
        var length = Number(v.slice(3)), text = ''
        if ((slot !== 0 && slot !== 1) || v.charAt(2) !== ':' || !isFinite(length) || length < 1 || length % 1) { o.fail('Invalid state index', 300); return }
        function read() {
          file.readText({ uri: base + slot, position: text.length, length: Math.min(4096, length - text.length), fail: o.fail,
            success: function(r) {
              if (!r.text || text.length + r.text.length > length) { o.fail('Incomplete state file', 300); return }
              text += r.text
              if (text.length < length) read()
              else { try { o.success(decodeURIComponent(text)) } catch (e) { o.fail(String(e), 300) } }
            } })
        }
        read()
      } })
    },
    set: function(o) {
      if (o.key !== key) { store.set(o); return }
      var next = 1 - slot, uri = base + next, text = encodeURIComponent(o.value), position = 0
      function write() {
        file.writeText({ uri: uri, text: text.slice(position, position + 4096), append: position > 0, fail: o.fail,
          success: function() {
            position += 4096
            if (position < text.length) write()
            else store.set({ key: key, value: '@' + next + ':' + text.length, fail: o.fail,
              success: function() { slot = next; o.success() } })
          } })
      }
      // Delete only the inactive file; this also avoids depending on overwrite truncation.
      file.delete({ uri: uri, success: write, fail: function(data, code) { if (code === 301) write(); else o.fail(data, code) } })
    }
  }
}
