import { test } from 'node:test'
import assert from 'node:assert/strict'
import data from '../watch/entry/src/main/js/default/common/locales.js'
import { wordsFor } from '../watch/entry/src/main/js/default/common/i18n.js'
import { fill } from '../watch/entry/src/main/js/default/common/format.js'
test('existing watch translations map phone locale and keep the Apple-only copy out', () => {
  // The watch ships 12 packs (scripts/harmony/build-locales.mjs WATCH_LANGS); the rest fall back to English.
  assert.equal(Object.keys(data.packs).length, 12)
  assert.equal(wordsFor('zh').done, '完成')
  assert.equal(wordsFor('zh-TW').done, wordsFor('zh-Hant').done)
  assert.equal(wordsFor('pt').done, wordsFor('pt-PT').done)
  assert.equal(wordsFor('fr-FR').done, wordsFor('fr').done)
  assert.equal(wordsFor('unknown').done, wordsFor('en').done)
  assert.equal(wordsFor('th').done, wordsFor('en').done)
  assert.equal(wordsFor('ar').done, wordsFor('en').done)
  assert.equal(wordsFor('ko').done, wordsFor('en').done)
  assert.equal(wordsFor('hi').done, wordsFor('en').done)
  for (const lang of Object.keys(data.packs)) {
    const pack = wordsFor(lang)
    assert.ok(pack.done, lang)
    assert.ok(!pack.phoneHint.includes('iPhone'), lang)
  }
  assert.equal(data.keys.length, Object.keys(wordsFor('en')).length)
  assert.equal(wordsFor('en'), wordsFor('en'))
})
test('formats normal and translated positional placeholders', () => {
  assert.equal(fill('Set %lld of %lld', [1, 3]), 'Set 1 of 3')
  assert.equal(fill('%2$@ / %1$lld', [2, 'test']), 'test / 2')
})
