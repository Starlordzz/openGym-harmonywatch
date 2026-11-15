import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './helpers/watch.js'
import { fileCleaner } from '../watch/entry/src/main/js/default/common/file-cleaner.js'
import { numberWidth } from '../watch/entry/src/main/js/default/common/format.js'

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
