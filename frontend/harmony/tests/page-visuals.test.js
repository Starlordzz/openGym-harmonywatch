import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './helpers/watch.js'
import { fileCleaner } from '../watch/entry/src/main/js/default/common/file-cleaner.js'
import { numberFont, numberWidth, setDots } from '../watch/entry/src/main/js/default/common/format.js'

test('animation cleanup waits for each native delete callback and spaces subsequent requests', () => {
  const requests = [], tasks = []
  const remove = fileCleaner({ delete(o) { requests.push(o) } }, fn => tasks.push(fn))
  remove('first'); remove('second')
  assert.equal(requests.length, 1)
  requests[0].success()
  assert.equal(requests.length, 1)
  tasks.shift()()
  assert.equal(requests[1].uri, 'second')
  requests[1].fail(); tasks.shift()()
  assert.equal(requests.length, 2)
})
test('the numeric edit screen refits long values after each adjustment', t => {
  const f = mount(t)
  f.vm.reps = '123456789'; f.vm.edit('reps')
  assert.ok(numberWidth(f.vm.editValue, f.vm.editFont) <= 280)
  f.vm.editStepBy(1)
  assert.equal(f.vm.editValue, '123456790')
  assert.ok(numberWidth(f.vm.editValue, f.vm.editFont) <= 280)
})
test('round FIT box constants keep weight, unit, reps, hold, edit, and dotbox values inside round.css boxes', () => {
  const roundFit = { ww: 88, wh: 56, uc: 74, um: 118, rw: 136, rh: 56, sw: 240, sh: 60, ew: 220, eh: 104, dw: 144 }
  for (const w of ['0', '20', '102.5', '1000.25']) {
    const wf = numberFont(w, 68, roundFit.ww, roundFit.wh)
    const unitLeft = Math.min(roundFit.um, roundFit.uc + Math.ceil(numberWidth(w, wf) / 2))
    assert.ok(wf * 1.2 <= roundFit.wh, w)
    assert.ok(numberWidth(w, wf) <= roundFit.ww, w)
    assert.ok(unitLeft + 26 <= 144, w)
  }
  assert.ok(numberWidth('123456789', numberFont('123456789', 68, roundFit.rw, roundFit.rh)) <= roundFit.rw)
  assert.ok(numberFont('30', 84, roundFit.sw, roundFit.sh) * 1.2 <= roundFit.sh)
  assert.ok(numberFont('10', 108, roundFit.ew, roundFit.eh) * 1.2 <= roundFit.eh)
  const d = setDots({ id: '0025', sets: Array.from({ length: 24 }, () => ({ done: false, warmup: false })) }, 0, [], 0, roundFit.dw)
  assert.equal(d.length, 18)
  assert.ok(18 * (d[0].box + 2) <= 180)
})
