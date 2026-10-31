import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipPlan, acceptFile, clipAt, clearClips, isClipName, isClipUri } from '../watch/entry/src/main/js/default/common/clips.js'
test('clip names are checked without regular expressions', () => {
  assert.equal(isClipName('og-a-0.png'), true)
  assert.equal(isClipName('og-0123456789abcdef-12.png'), true)
  assert.equal(isClipName('og-a-.png'), false)
  assert.equal(isClipName('og--0.png'), false)
  assert.equal(isClipName('og-a-0-1.png'), false)
  assert.equal(isClipName('OG-a-0.png'), false)
  assert.equal(isClipName('og-A-0.png'), false)
  assert.equal(isClipName('og-a-0.PNG'), false)
  assert.equal(isClipName('og-a-0.png.png'), false)
  assert.equal(isClipName(''), false)
  assert.equal(isClipName(null), false)
  assert.equal(isClipUri('internal://app/og-a-0.png'), true)
  assert.equal(isClipUri('internal://app/../og-a-0.png'), false)
  assert.equal(isClipUri('internal://app2/og-a-0.png'), false)
  assert.equal(isClipUri('/data/og-a-0.png'), false)
  assert.equal(isClipUri(undefined), false)
})
test('only complete current-workout frames animate; files are cleaned on finish', () => {
  const s = { workout: { id: 'w', entries: [{ id: 'a' }] }, settings: {} }
  assert.equal(clipPlan(s, { wid: 'old', exId: 'a', files: ['og-a-0.png'] }), false)
  assert.equal(clipPlan(s, { wid: 'w', exId: 'a', files: ['../bad.png'] }), false)
  assert.equal(clipPlan(s, { wid: 'w', exId: 'a', files: ['og-a-0.png', 'og-a-1.png'], interval: 125 }), true)
  acceptFile(s, 'internal://app/og-a-0.png'); assert.equal(clipAt(s, 'a', 0), '')
  acceptFile(s, 'internal://app/og-a-1.png'); assert.equal(clipAt(s, 'a', 125), 'internal://app/og-a-1.png')
  assert.equal(acceptFile(s, 'internal://app/../og-a-0.png'), false)
  s.settings.show = { clip: false }; assert.equal(clipAt(s, 'a', 0), '')
  const removed = []; clearClips(s, path => removed.push(path)); assert.equal(removed.length, 2); assert.equal(clipAt(s, 'a', 0), '')
})
