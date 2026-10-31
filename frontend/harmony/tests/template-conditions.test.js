import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mount, savedState } from './helpers/watch.js'

const template = readFileSync(new URL('../watch/entry/src/main/js/default/pages/index/index.hml', import.meta.url), 'utf8')
const conditions = [...template.matchAll(/\bif="\{\{([^}]+)\}\}"/g)].map(m => m[1])
const evaluate = (expression, vm) => Function('vm', 'with (vm) { return (' + expression + ') }')(vm)

// Lite's native `if` accepts a boolean. A non-empty string is not a visible branch, unlike JSX.
// Read the actual template at the point the storage callback changes the real mounted page.
test('a storage failure leaves the native error branch visible and hides the main content', t => {
  const f = mount(t, savedState(), { silent: true })
  const errorCondition = conditions[0]
  const bodyCondition = template.match(/class="body" if="\{\{([^}]+)\}\}"/)[1]
  assert.equal(evaluate(errorCondition, f.vm), false)
  f.failRead()
  assert.match(f.vm.error, /无法读取/)
  assert.equal(evaluate(errorCondition, f.vm), true)
  assert.equal(evaluate(bodyCondition, f.vm), false)
  assert.equal(f.writes.length, 0)
})

test('all Lite if bindings return booleans for empty and populated page data', t => {
  const { vm } = mount(t)
  for (const expression of conditions) {
    assert.equal(typeof evaluate(expression, vm), 'boolean', expression)
  }
  Object.assign(vm, { error: 'Read failed', todayName: 'Push day', routines: [{}], pending: 'Queued',
    clipSrc: 'internal://app/frame.png', extras: '0:30', offline: 'Saved later', hr: '128',
    hrWaiting: 'Measuring', last: '20 kg × 8', effortName: 'RPE', editSuffix: 'kg', editStep: '2.5',
    lockDigits: '0:30', records: [{ name: 'Record' }] })
  for (const expression of conditions) {
    assert.equal(typeof evaluate(expression, vm), 'boolean', expression)
  }
})
