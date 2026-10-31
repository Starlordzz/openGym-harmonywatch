// ASCII-only chunks stay below Wear Engine's 1 KiB message ceiling, including UTF-8 names.
export function packets(payload, id) {
  var data = encodeURIComponent(JSON.stringify(payload)), n = Math.ceil(data.length / 600), out = []
  for (var i = 0; i < n; i++) out.push(JSON.stringify({ v: 1, id: id, i: i, n: n, data: data.slice(i * 600, (i + 1) * 600) }))
  return out
}
export function assembler() {
  var pending = Object.create(null)
  return function(raw, now) {
    Object.keys(pending).forEach(function(k) { if (now - pending[k].at > 60000) delete pending[k] })
    var p = JSON.parse(raw)
    if (typeof p.n !== 'number' || typeof p.i !== 'number' || p.v !== 1 || typeof p.id !== 'string' || p.id.length > 100 || p.n < 1 || p.n > 1024 || p.n % 1 || p.i < 0 || p.i >= p.n || p.i % 1 || typeof p.data !== 'string' || p.data.length > 600) throw Error('Invalid packet')
    if (!pending[p.id]) {
      if (Object.keys(pending).length >= 4) throw Error('Too many transfers')
      pending[p.id] = { at: now, n: p.n, parts: {}, count: 0 }
    }
    var a = pending[p.id]
    if (a.n !== p.n) throw Error('Inconsistent packet')
    if (a.parts[p.i] == null) { a.parts[p.i] = p.data; a.count++ }
    if (a.count !== a.n) return null
    var text = ''
    for (var i = 0; i < a.n; i++) text += a.parts[i]
    delete pending[p.id]
    return { id: p.id, payload: JSON.parse(decodeURIComponent(text)) }
  }
}
