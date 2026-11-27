// Lite KV values are <128 bytes. Publish a small index only after the other file is complete.
export function stateStorage(store, file) {
  var key = 'opengym-fit-v1', base = 'internal://app/og-state', rBase = 'internal://app/og-ready'
  var slot = 0, rSlot = 0, lastReadyJson = null, lastReadyLen = 0
  function readChunks(uri, length, fail, done) {
    var text = ''
    function read() {
      file.readText({ uri: uri, position: text.length, length: Math.min(4096, length - text.length), fail: fail,
        success: function(r) {
          if (!r.text || text.length + r.text.length > length) { fail('Incomplete state file', 300); return }
          text += r.text
          if (text.length < length) read()
          else { try { done(decodeURIComponent(text)) } catch (e) { fail(String(e), 300) } }
        } })
    }
    read()
  }
  function writeChunks(uri, text, fail, done) {
    var position = 0
    function write() {
      file.writeText({ uri: uri, text: text.slice(position, position + 4096), append: position > 0, fail: fail,
        success: function() {
          position += 4096
          if (position < text.length) write()
          else done()
        } })
    }
    // Delete only the inactive file; this also avoids depending on overwrite truncation.
    file.delete({ uri: uri, success: write, fail: function(data, code) { if (code === 301) write(); else fail(data, code) } })
  }
  return {
    get: function(o) {
      if (o.key !== key) { store.get(o); return }
      store.get({ key: key, default: '', fail: o.fail, success: function(v) {
        if (!v || v.charAt(0) !== '@') { o.success(v); return }
        var parts = v.slice(1).split(':')
        if (parts.length !== 2 && parts.length !== 4) { o.fail('Invalid state index', 300); return }
        var sSlot = Number(parts[0]), sLen = Number(parts[1])
        if ((sSlot !== 0 && sSlot !== 1) || !isFinite(sLen) || sLen < 1 || sLen % 1) { o.fail('Invalid state index', 300); return }
        var hasReady = parts.length === 4, nextRSlot = 0, rLen = 0
        if (hasReady) {
          nextRSlot = Number(parts[2]); rLen = Number(parts[3])
          if ((nextRSlot !== 0 && nextRSlot !== 1) || !isFinite(rLen) || rLen < 1 || rLen % 1) { o.fail('Invalid state index', 300); return }
        }
        readChunks(base + sSlot, sLen, o.fail, function(sDecoded) {
          slot = sSlot
          if (!hasReady) { o.success(sDecoded); return }
          readChunks(rBase + nextRSlot, rLen, o.fail, function(rDecoded) {
            try {
              var obj = JSON.parse(sDecoded)
              obj.ready = JSON.parse(rDecoded)
              rSlot = nextRSlot; lastReadyJson = rDecoded; lastReadyLen = rLen
              o.success(JSON.stringify(obj))
            } catch (e) { o.fail(String(e), 300) }
          })
        })
      } })
    },
    set: function(o) {
      if (o.key !== key) { store.set(o); return }
      var sVal = o.value, rJson = null
      try {
        var parsed = JSON.parse(o.value)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.ready != null) {
          rJson = JSON.stringify(parsed.ready)
          parsed.ready = null
          sVal = JSON.stringify(parsed)
        }
      } catch (e) {}
      var nextS = 1 - slot, sText = encodeURIComponent(sVal)
      function commitState(targetR, rLen, rTextLen) {
        writeChunks(base + nextS, sText, o.fail, function() {
          var idx = rTextLen > 0 ? '@' + nextS + ':' + sText.length + ':' + targetR + ':' + rTextLen : '@' + nextS + ':' + sText.length
          store.set({ key: key, value: idx, fail: o.fail,
            success: function() {
              slot = nextS
              if (rJson == null) { lastReadyJson = null; lastReadyLen = 0 }
              else if (rLen != null) { rSlot = targetR; lastReadyJson = rJson; lastReadyLen = rLen }
              o.success()
            } })
        })
      }
      if (rJson == null) { commitState(0, null, 0); return }
      if (rJson === lastReadyJson && lastReadyLen > 0) { commitState(rSlot, null, lastReadyLen); return }
      var nextR = 1 - rSlot, rText = encodeURIComponent(rJson)
      writeChunks(rBase + nextR, rText, o.fail, function() {
        commitState(nextR, rText.length, rText.length)
      })
    }
  }
}
