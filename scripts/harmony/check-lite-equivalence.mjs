import vm from 'node:vm'
// Probe the real compiled module boundary without invoking native services.
export function bundleShape(source) {
  let options, model
  const value = vm.runInNewContext(source, { ViewModel: function(o) { options = o; model = this }, requireNative: () => ({}),
    console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} }, { timeout: 3000 })
  if (!options) throw Error('Bundle did not register a ViewModel')
  if (value !== model) throw Error('Bundle must return its ViewModel')
  const shape = { names: Object.keys(options).sort(), data: options.data, style: options.styleSheet, words: [] }
  if (options.words) for (const lang of ['en', 'zh-Hans', 'zh-Hant', 'pt-PT', 'pt-BR', 'es', 'fr', 'de', 'it', 'ru', 'uk', 'pl']) shape.words.push(options.words(lang))
  if (options.restView) {
    const page = { ...options.data, words: { next: 'Next: %@, set %lld' }, app: { drawRest() {} }, picked: -1, showNext: true }
    options.restView.call(page, { workout: { rest: { paused: true, left: 75, total: 90 }, entries: [], restSec: 90 }, entryIndex: 0, settings: {}, skipped: [] })
    shape.rest = { digits: page.digits, paused: page.restPaused, percent: page.ringPercent }
  }
  return JSON.stringify(shape)
}
