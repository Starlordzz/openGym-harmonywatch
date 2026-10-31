// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const listeners = vi.hoisted(() => new Set())
vi.mock('./mobile.js', async original => ({ ...await original(), MOBILE: true, nativePlatform: async () => 'android' }))
vi.mock('./i18n.js', async original => ({ ...await original(), onLangChange: fn => { listeners.add(fn); return () => listeners.delete(fn) } }))
import { _setLangState } from './i18n-core.js'
import { exerciseNameText } from './format.js'
import zhNames from '../exercise-names/zh.js'
import { EXIDX } from './exercises.js'
import { buildReady, buildSnapshot, startWatchSync, _setWatchPluginForTest, _resetWatchSync } from './watch-sync.js'
let stop
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); _resetWatchSync(); _setLangState('en'); listeners.clear() })
afterEach(() => { stop?.(); stop = null; _setLangState('en'); vi.useRealTimers() })
const plan = () => ({ unit: 'kg', workouts: [], routines: [{ id: 'push', name: '推日', ex: [{ id: '0025', sets: 3, reps: 8, weight: 60 }] }], active: { id: 'w', name: '推日', start: Date.now(), entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 8 }] }] } })
it('active and ready names follow the phone Chinese naming and English-parentheses preference', () => {
  const s = plan()
  for (const showEnglish of [false, true]) {
    _setLangState('zh', {}, null, zhNames, showEnglish)
    const expected = exerciseNameText(EXIDX['0025'])
    expect(buildSnapshot(s).active.entries[0].name).toBe(expected)
    expect(buildReady(s).others[0].entries[0].name).toBe(expected)
    expect(expected).toContain('杠铃卧推')
  }
})
it('changing the phone language and name preference refreshes cached ready names without editing the plan', async () => {
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(async () => ({ sent: true })), sendClips: vi.fn(), drain: vi.fn(async () => ({ events: [] })),
    ack: vi.fn(), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  const state = { S: plan() }
  const store = { getState: () => state, subscribe: () => () => {} }
  stop = await startWatchSync({ useStore: store, useUI: { getState: () => ({}), subscribe: () => () => {} } })
  const names = () => JSON.parse(b.sendSnapshot.mock.calls.at(-1)[0].json)
  await vi.advanceTimersByTimeAsync(500)
  expect(names().ready.others[0].entries[0].name).toContain('Barbell')
  for (const showEnglish of [false, true]) {
    _setLangState('zh', {}, null, zhNames, showEnglish)
    listeners.forEach(fn => fn())
    await vi.advanceTimersByTimeAsync(500)
    const expected = exerciseNameText(EXIDX['0025'])
    expect(names().active.entries[0].name).toBe(expected)
    expect(names().ready.others[0].entries[0].name).toBe(expected)
  }
})
