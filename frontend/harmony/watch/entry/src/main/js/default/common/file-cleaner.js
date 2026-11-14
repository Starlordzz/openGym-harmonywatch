// Avoid a burst of native deletes while the renderer releases the previous animation.
export function fileCleaner(file, schedule) {
  var queue = [], busy = false
  function pump() {
    if (busy || !queue.length) return
    busy = true
    function next() { busy = false; schedule(pump, 50) }
    file.delete({ uri: queue.shift(), success: next, fail: next })
  }
  return function(uri) { queue.push(uri); pump() }
}
