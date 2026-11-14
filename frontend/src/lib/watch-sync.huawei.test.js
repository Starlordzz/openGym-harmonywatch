// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
vi.mock('./mobile.js', async importOriginal => ({ ...await importOriginal(), MOBILE: true, nativePlatform: async () => 'android' }))
import { buildReady, fitSnapshot, startWatchSync, _setWatchPluginForTest, _resetWatchSync } from './watch-sync.js'
let stop
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); _resetWatchSync() })
afterEach(() => { stop?.(); vi.useRealTimers() })
it('Huawei retries failed snapshots and requests a single launch for a new phone workout', async () => {
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
  expect(b.sendClips).not.toHaveBeenCalled(); expect(b.openOnWatch).toHaveBeenCalledTimes(1)
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

it('refreshes the watch today plan when only the phone rotation queue changes', async () => {
  vi.setSystemTime(new Date('2026-09-09T12:00:00'))
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(async () => ({ sent: true })), sendClips: vi.fn(),
    drain: vi.fn(async () => ({ events: [] })), ack: vi.fn(), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  let state = { S: { unit: 'kg', routines: ['d1', 'd2', 'own'].map(id => ({ id, name: id, ex: [] })),
    week: { 3: ['own'] }, dayPlan: {}, workouts: [], queue: null, active: null } }, listener
  const store = { getState: () => state, subscribe: fn => { listener = fn; return () => {} } }
  stop = await startWatchSync({ useStore: store, useUI: { getState: () => ({}), subscribe: () => () => {} } })
  const today = () => JSON.parse(b.sendSnapshot.mock.calls.at(-1)[0].json).ready.today.routineIds
  await vi.advanceTimersByTimeAsync(500)
  expect(today()).toEqual(['own'])
  const prev = state
  state = { S: { ...state.S, queue: { ids: ['d1', 'd2'], since: new Date('2026-09-07T00:00:00').getTime(), startsOn: '2026-09-07' } } }
  listener(state, prev)
  await vi.advanceTimersByTimeAsync(500)
  expect(today()).toEqual(['d1', 'own'])
  const queued = state
  state = { S: { ...state.S, queue: null } }
  listener(state, queued)
  await vi.advanceTimersByTimeAsync(500)
  expect(today()).toEqual(['own'])
})

it('prioritizes scheduled Full Body routines over older PPL on a rest day and under a tight payload budget', () => {
  const ids = ['push', 'pull', 'legs', 'old1', 'old2', 'fullA', 'fullB', 'fullC']
  const S = { routines: ids.map(id => ({ id, name: id, ex: [] })), workouts: [],
    week: { 1: ['fullA'], 3: ['fullB'], 5: ['fullC'] }, dayPlan: {}, queue: null }
  const ready = buildReady(S, '2026-11-14')
  expect(ready.today).toBeNull()
  expect(ready.others.slice(0, 3).map(r => r.routineIds[0])).toEqual(['fullA', 'fullB', 'fullC'])
  expect(ready.others.map(r => r.routineIds[0])).toContain('push')
  const snap = { v: 1, active: null, ready }
  const firstThreeBytes = new TextEncoder().encode(JSON.stringify({ ...snap, ready: { ...ready, others: ready.others.slice(0, 3) } })).length
  expect(fitSnapshot(snap, firstThreeBytes).ready.others.map(r => r.routineIds[0])).toEqual(['fullA', 'fullB', 'fullC'])
})

it('does not enqueue duplicate snapshots while the watch is still persisting the first one', async () => {
  let finish, state = { S: { unit: 'kg', routines: [], workouts: [], active: null } }, listener
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(() => new Promise(resolve => { finish = resolve })), sendClips: vi.fn(),
    drain: vi.fn(async () => ({ events: [] })), ack: vi.fn(), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  stop = await startWatchSync({ useStore: { getState: () => state, subscribe: fn => { listener = fn; return () => {} } },
    useUI: { getState: () => ({}), subscribe: () => () => {} } })
  await vi.advanceTimersByTimeAsync(16000)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(1)
  const prev = state; state = { S: { ...state.S, unit: 'lb' } }; listener(state, prev)
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(1)
  const complete = finish; b.sendSnapshot.mockResolvedValue({ sent: true }); complete({ sent: true })
  await vi.advanceTimersByTimeAsync(500)
  expect(b.sendSnapshot).toHaveBeenCalledTimes(2)
  expect(JSON.parse(b.sendSnapshot.mock.calls.at(-1)[0].json).unit).toBe('lb')
})

it('sends priority rest controls while a full snapshot is pending, including paused changes', async () => {
  let uiListener, ui = { timer: { endsAt: Date.now() + 90000, total: 90 } }
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(() => new Promise(() => {})), sendRest: vi.fn(async () => ({ queued: true })),
    drain: vi.fn(async () => ({ events: [] })), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  stop = await startWatchSync({ useStore: { getState: () => ({ S: { active: { id: 'w', entries: [] }, routines: [] } }), subscribe: () => () => {} },
    useUI: { getState: () => ui, subscribe: fn => { uiListener = fn; return () => {} } } })
  await vi.advanceTimersByTimeAsync(500)
  const prev = ui; ui = { timer: { ...ui.timer, endsAt: ui.timer.endsAt + 15000, total: 105 } }; uiListener(ui, prev)
  expect(b.sendRest).toHaveBeenLastCalledWith({ wid: 'w', rest: { endsAt: ui.timer.endsAt, total: 105 } })
  const running = ui; ui = { timer: { ...ui.timer, paused: true, left: 75 } }; uiListener(ui, running)
  const paused = ui; ui = { timer: { ...ui.timer, left: 90 } }; uiListener(ui, paused)
  expect(b.sendRest).toHaveBeenLastCalledWith({ wid: 'w', rest: { endsAt: 0, paused: true, left: 90, total: 105 } })
  expect(b.sendSnapshot).toHaveBeenCalledTimes(1)
})

it('sends an explicit workout end immediately while an older snapshot is waiting for disk acknowledgement', async () => {
  let listener, state = { S: { unit: 'kg', active: { id: 'w', start: Date.now(), entries: [] }, routines: [], workouts: [] } }
  const b = { status: vi.fn(async () => ({ paired: true, installed: true })),
    sendSnapshot: vi.fn(() => new Promise(() => {})), endWorkout: vi.fn(async () => ({ queued: true })),
    drain: vi.fn(async () => ({ events: [] })), addListener: vi.fn(async () => ({ remove() {} })) }
  _setWatchPluginForTest(b)
  stop = await startWatchSync({ useStore: { getState: () => state, subscribe: fn => { listener = fn; return () => {} } },
    useUI: { getState: () => ({}), subscribe: () => () => {} } })
  await vi.advanceTimersByTimeAsync(500)
  const prev = state; state = { S: { ...state.S, active: null, workouts: [{ id: 'w' }] } }; listener(state, prev)
  await vi.advanceTimersByTimeAsync(0)
  expect(b.endWorkout).toHaveBeenCalledWith({ wid: 'w', discard: false })
  expect(b.sendSnapshot).toHaveBeenCalledTimes(1)
})
