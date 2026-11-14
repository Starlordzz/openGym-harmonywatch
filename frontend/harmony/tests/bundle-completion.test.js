import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bundleShape } from '../../../scripts/harmony/check-lite-equivalence.mjs'

const model = 'new ViewModel({data:{ready:false}})'
test('Lite bundle evaluation returns its ViewModel, not just the same constructor arguments', () => {
  assert.doesNotThrow(() => bundleShape('(function(){return ' + model + '})();'))
  assert.throws(() => bundleShape('!function(){' + model + '}();'), /return.*ViewModel/)
  assert.throws(() => bundleShape('void ' + model + ';'), /return.*ViewModel/)
})
