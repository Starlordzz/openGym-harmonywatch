// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
vi.mock('./mobile.js', async importOriginal => ({ ...await importOriginal(), MOBILE: true, nativePlatform: async () => 'android' }))
import { startWatchSync, _setWatchPluginForTest, _resetWatchSync } from './watch-sync.js'
let stop
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); _resetWatchSync() })
afterEach(() => { stop?.(); vi.useRealTimers() })
it('Huawei retries failed snapshots without Apple Health, clips or remote launch', async () => {
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue({ sent: true }),
    sendClips: vi.fn(), openOnWatch: vi.fn(), drain: vi.fn(async () => ({ events: [] })),
    ack: vi.fn(), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  let state = { S: { unit: 'kg', routines: [], workouts: [], active: null } }, listener
  const store = { getState: () => state, subscribe: fn => { listener = fn; return () => {} } }
  stop = await startWatchSync({ useStore: store, useUI: { getState: () => ({}), subscribe: () => () => {} } })
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(15500)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(2)
  const prev = state; state = { S: { ...state.S, active: { id: 'test', start: Date.now(), entries: [] } } }; listener(state, prev)
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendClips).not.toHaveBeenCalled(); expect(b.openOnWatch).not.toHaveBeenCalled()
  expect(JSON.parse(b.sendSnapshot.mock.calls.at(-1)[0].json).settings.health).toBe(false)
})
it('does not restart an animation transfer when another set updates during transmission', async () => {
  const { EXIDX } = await import('./exercises.js')
  const exId = Object.keys(EXIDX).find(id => EXIDX[id].gif)
  let finishClips
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(async () => ({ sent: true })),
    sendClips: vi.fn(() => new Promise(resolve => { finishClips = resolve })), openOnWatch: vi.fn(),
    drain: vi.fn(async () => ({ events: [] })), ack: vi.fn(), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  let state = { S: { unit: 'kg', routines: [], workouts: [], active: { id: 'w', start: Date.now(), entries: [{ id: exId, sets: [{ w: 20, r: 8 }] }] } } }, listener
  const store = { getState: () => state, subscribe: fn => { listener = fn; return () => {} } }
  stop = await startWatchSync({ useStore: store, useUI: { getState: () => ({}), subscribe: () => () => {} } })
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendClips).toHaveBeenCalledTimes(1)
  const prev = state; state = { S: { ...state.S, active: { ...state.S.active, entries: state.S.active.entries.map(e => ({ ...e, sets: [{ w: 22, r: 8 }] })) } } }; listener(state, prev)
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(2)
  expect(b.sendClips).toHaveBeenCalledTimes(1)
  finishClips({ sent: true }); await vi.advanceTimersByTimeAsync(0)
})
