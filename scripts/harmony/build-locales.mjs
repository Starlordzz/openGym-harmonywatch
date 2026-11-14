#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const source = join(root, 'frontend/ios/App/Watch')
const keys = { lock: 'Lock', today: 'Today', done: 'Done', warmup: 'Warm-up', reps: 'Reps', rest: 'Rest', skip: 'Skip',
  finish: 'Finish workout', save: 'Finish and save', discard: 'Discard workout', resume: 'Continue workout', cancel: 'Cancel',
  left: 'Left', right: 'Right', bodyweight: 'Bodyweight', weight: 'Weight', sets: 'Sets', volume: 'Volume', time: 'Time',
  skipSet: 'Skip set', records: 'Personal records', saveStart: 'Save & start workout', noWeight: 'Start without weighing in',
  bodyWeight: 'Body weight', last: 'Last time: %@', noWorkout: 'No workout running', notSynced: 'Not synced yet',
  phoneHint: 'Open openGym on your iPhone once and your routines show up here.',
  cardio: 'Log this one on your iPhone.', savedLater: 'Saved on the watch, syncs later',
  heart: 'Heart rate', hold: 'Hold', stop: 'Stop', startHold: 'Start hold', saved: 'Workout saved',
  setOf: 'Set %lld of %lld', restOver: 'Rest’s over. Next set!', next: 'Next: %@, set %lld',
  start: 'Start workout', quickCheckin: 'Quick check-in', superset: 'Superset', addedWeight: 'Added weight',
  endedPhone: 'Ended on your iPhone', ofSets: '%lld of %lld sets',
  finishQ: 'Finish workout?', skipQ: 'Skip this set?', allDoneQ: 'All done?',
  phoneHint2: 'Start one on your iPhone and it shows up here.',
  measuring: 'measuring', allDone: 'All sets done', tapDot: 'Tap a dot to do a skipped set.' }
const phones = { en: 'phone', 'zh-Hans': '手机', 'zh-Hant': '手機', de: 'Smartphone', fr: 'téléphone',
  es: 'móvil', it: 'telefono', pt: 'telemóvel', 'pt-PT': 'telemóvel', 'pt-BR': 'celular', ru: 'телефоне', uk: 'телефоні',
  ar: 'الهاتف', ko: '휴대전화', hi: 'फ़ोन', bn: 'ফোন', hu: 'telefon', pl: 'telefon', th: 'โทรศัพท์', tr: 'telefon' }
const unlock = { en: 'Hold to unlock', de: 'Zum Entsperren gedrückt halten', fr: 'Maintenir pour déverrouiller', es: 'Mantén pulsado para desbloquear', it: 'Tieni premuto per sbloccare', 'pt-PT': 'Mantenha premido para desbloquear', 'pt-BR': 'Toque e segure para desbloquear', ru: 'Удерживайте для разблокировки', uk: 'Утримуйте для розблокування', ar: 'اضغط مطولاً لإلغاء القفل', ko: '길게 눌러 잠금 해제', hi: 'अनलॉक करने के लिए दबाकर रखें', bn: 'আনলক করতে চেপে ধরে রাখুন', hu: 'Tartsa nyomva a feloldáshoz', pl: 'Przytrzymaj, aby odblokować', th: 'กดค้างเพื่อปลดล็อก', tr: 'Kilidi açmak için basılı tutun', 'zh-Hans': '长按解锁', 'zh-Hant': '長按解鎖' }
// The watch ships 12 of the Watch app's 19 languages: the device refuses a JS file over 48 KB and
// every pack costs about 1.3 KB in app.js. Arabic is out (Lite has no right-to-left layout), and
// Bengali, Hungarian, Thai, Turkish, Korean and Hindi fall back to English. Pass --langs=… to change.
const WATCH_LANGS = ['en', 'zh-Hans', 'zh-Hant', 'pt-PT', 'pt-BR', 'es', 'fr', 'de', 'it', 'ru', 'uk', 'pl']
const only = (args => {
  const eq = args.find(v => v.startsWith('--langs='))
  if (eq) return eq.slice(8).split(',')
  const i = args.indexOf('--langs')
  return i < 0 ? WATCH_LANGS : args[i + 1].split(',')
})(process.argv)
const packs = {}
for (const dir of (await readdir(source)).filter(v => v.endsWith('.lproj') && (!only || only.includes(v.slice(0, -6)))).sort()) {
  const lang = dir.slice(0, -6), raw = await readFile(join(source, dir, 'Localizable.strings'), 'utf8'), strings = {}
  for (const m of raw.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*=\s*("(?:[^"\\]|\\.)*")\s*;/gm)) strings[JSON.parse(m[1])] = JSON.parse(m[2])
  packs[lang] = Object.fromEntries(Object.entries(keys).map(([alias, key]) => [alias, (strings[key] || key).replaceAll('iPhone', phones[lang] || 'phone')]))
}
for (const lang of Object.keys(packs)) packs[lang].holdUnlock = unlock[lang] || unlock.en
for (const [lang, pack] of Object.entries(packs)) {
  const name = { 'zh-Hans': 'zh', 'zh-Hant': 'zh-TW', 'pt-PT': 'pt' }[lang] || lang
  const phone = lang === 'en' ? {} : (await import(pathToFileURL(join(root, 'frontend/src/locales', name + '.js')))).default
  for (const [alias, key] of Object.entries({ on: 'On', off: 'Off', pause: 'Pause', resumeRest: 'Resume' })) pack[alias] = phone[key] || key
}
// Positional packs: the key names are stored once, not once per language (the page bundle and the
// app bundle are capped at 48 KB each by the device loader).
const langs = Object.keys(packs)
const slotNames = Object.keys(packs[langs[0]])
const compact = { keys: slotNames, packs: Object.fromEntries(langs.map(l => [l, slotNames.map(k => packs[l][k] || '')])) }
// Portuguese variants share most strings. Preserve every translation while saving Lite JS bytes.
if (compact.packs['pt-PT'] && compact.packs['pt-BR']) {
  const values = compact.packs['pt-BR'], parent = compact.packs['pt-PT']
  compact.packs['pt-BR'] = { base: 'pt-PT', changes: Object.fromEntries(values.flatMap((v, i) => v === parent[i] ? [] : [[i, v]])) }
}
// Replace repeated text fragments with unused two-byte Unicode characters; the Lite decoder restores them.
// Keep all language packs, and verify decoded text against tests/locale-hashes.json.
const slots = []
for (const values of Object.values(compact.packs)) {
  const holder = Array.isArray(values) ? values : values.changes
  for (const key of Object.keys(holder)) slots.push({ holder, key, text: holder[key] })
}
if (slots.some(s => [...s.text].some(c => c.charCodeAt(0) >= 0x180 && c.charCodeAt(0) < 0x280))) throw Error('Reserved compression character in translation')
const counts = new Map()
for (const { text } of slots) {
  for (let size = 2; size <= Math.min(28, text.length); size++) {
    for (let i = 0; i + size <= text.length; i++) {
      const fragment = text.slice(i, i + size)
      counts.set(fragment, (counts.get(fragment) || 0) + 1)
    }
  }
}
const cost = text => Buffer.byteLength(text)
const score = text => (cost(text) - 2) * counts.get(text) - cost(JSON.stringify(text)) - 1
const candidates = [...counts.keys()].filter(k => counts.get(k) > 1).sort((a, b) => score(b) - score(a))
compact.fragments = []
for (const fragment of candidates) {
  if (compact.fragments.length >= 256) break
  const count = slots.reduce((n, s) => n + s.text.split(fragment).length - 1, 0)
  if ((cost(fragment) - 2) * count - cost(JSON.stringify(fragment)) - 1 < 6) continue
  const token = String.fromCharCode(0x180 + compact.fragments.length)
  compact.fragments.push(fragment)
  for (const slot of slots) slot.text = slot.text.split(fragment).join(token)
}
for (const { holder, key, text } of slots) holder[key] = text
const result = '// Generated by scripts/harmony/build-locales.mjs from existing Watch translations.\nexport default ' + JSON.stringify(compact) + '\n'
const output = join(root, 'frontend/harmony/watch/entry/src/main/js/default/common/locales.js')
// --out writes a staged copy for the U13 forensics build (fewer languages, more byte headroom);
// the committed template copy stays the full 12-language set.
const at = process.argv.indexOf('--out')
const target = at < 0 ? output : resolve(process.argv[at + 1])
if (process.argv.includes('--check')) { if (await readFile(output, 'utf8') !== result) throw Error('Watch locale output is stale') }
else { await writeFile(target, result); if (target !== output) console.log('Wrote ' + target) }
console.log(Object.keys(packs).length + ' watch language packs generated')
