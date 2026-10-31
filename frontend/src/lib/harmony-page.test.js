import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const port = vi.hoisted(() => ({ changed: null, state: null }))
vi.mock('../../harmony/watch/entry/src/main/js/default/common/runtime.js', () => ({
  runtime(changed) {
    port.changed = changed
    return { load() { changed(port.state) }, change(fn) { fn(port.state); changed(port.state); changed(port.state) },
      samples: () => [], heart: () => null, heartStart: vi.fn(), heartStop: vi.fn(), vibrate: vi.fn(), stop() {} }
  }
}))
import page from '../../harmony/watch/entry/src/main/js/default/pages/index/index.js'
import appOptions from '../../harmony/watch/entry/src/main/js/default/app.js'
let vm, app
function adjust(field) {
  vm.edit(field)
  if (vm.screen === 'edit') { vm.editStepBy(1); vm.editDone() }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(10000)
  port.state = { settings: {}, unit: 'kg', outbox: [], sequence: 0, skipped: [], pending: {}, finishedHere: [], entryIndex: 0,
    workout: { id: 'w', name: 'test', start: 1000, restSec: 90, entries: [{ id: 'a', name: 'a', step: 2, mode: 'reps', sets: [{ w: 20, r: 8 }, { w: 20, r: 8 }] }] } }
  app = { ...appOptions.data }
  for (const [key, fn] of Object.entries(appOptions)) if (typeof fn === 'function') app[key] = fn.bind(app)
  app.onCreate()
  vi.stubGlobal('getApp', () => app)
  vm = { ...page.data }
  for (const [key, fn] of Object.entries(page)) if (typeof fn === 'function') vm[key] = fn.bind(vm)
  vm.onInit()
})
afterEach(() => { vm.onDestroy(); app.onDestroy(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('incoming state updates preserve in-progress touch edits', () => {
  adjust('weight'); adjust('reps'); port.changed(port.state)
  expect(vm.weight).toBe('22'); expect(vm.reps).toBe('9')
})
it('snapshot or disk callbacks do not dismiss finish/discard confirmation', () => {
  vm.finishPage(); vm.discard(); port.changed(port.state)
  expect(vm.screen).toBe('finish'); expect(vm.confirm).toBe(true)
  vm.resume(); expect(vm.screen).toBe('exercise'); expect(vm.confirm).toBe(false)
})
it('a repeated tap cannot complete the following set', () => {
  vm.complete(); vm.complete()
  expect(port.state.outbox.filter(e => e.type === 'setDone')).toHaveLength(1)
  expect(port.state.workout.entries[0].sets[1].done).not.toBe(true)
})
it('app touch lock blocks edits and set completion until unlocked', () => {
  vm.lockPage(); const weight = vm.weight
  expect(vm.touchLocked).toBe(true)
  adjust('weight'); vm.complete()
  expect(vm.weight).toBe(weight); expect(port.state.outbox).toHaveLength(0)
  vm.unlockPage(); adjust('weight'); vm.complete()
  expect(port.state.outbox.filter(e => e.type === 'setDone')).toHaveLength(1)
})
it('a timed hold still finishes automatically while touch is locked', async () => {
  port.state.workout.entries[0].mode = 'time'; port.changed(port.state)
  vm.seconds = 2; vm.done(); vm.lockPage()
  await vi.advanceTimersByTimeAsync(2500)
  expect(port.state.workout.entries[0].sets[0].done).toBe(true)
  expect(port.state.workout.entries[0].sets[0].sec).toBe(2)
  expect(vm.touchLocked).toBe(true)
})
it('late resume records a timed hold at its deadline and alerts only once', () => {
  port.state.workout.entries[0].mode = 'time'; port.changed(port.state)
  vm.seconds = 2; vm.done(); vm.onHide()
  vi.setSystemTime(20000); vm.onShow(); vm.tickClock()
  const events = port.state.outbox.filter(e => e.type === 'setDone')
  expect(events).toHaveLength(1)
  expect(events[0].sec).toBe(2); expect(events[0].at).toBe(12000)
  expect(port.state.workout.rest.endsAt).toBe(102000)
  expect(app.rt.vibrate).toHaveBeenCalledTimes(1)
})
it('a restored hold whose set is already complete is cleared without repeated alerts', () => {
  port.state.workout.entries[0].mode = 'time'; port.changed(port.state)
  vm.seconds = 2; vm.done(); port.state.workout.entries[0].sets[0].done = true
  vi.setSystemTime(20000); vm.onShow(); vm.tickClock()
  expect(port.state.hold).toBe(null)
  expect(port.state.outbox.filter(e => e.type === 'setDone')).toHaveLength(0)
  expect(app.rt.vibrate).not.toHaveBeenCalled()
})
it('turning off heart rate during a workout unsubscribes immediately', () => {
  port.state.sensorEnabled = true; port.changed(port.state)
  expect(app.rt.heartStart).toHaveBeenCalledTimes(1)
  port.state.sensorEnabled = false; port.changed(port.state)
  expect(app.rt.heartStop).toHaveBeenCalledTimes(1)
})
it('an initial countdown does not start a workout while its page is hidden', () => {
  port.state.ready = { today: { name: 'test', routineIds: ['r'], entries: port.state.workout.entries } }
  port.state.workout = null; port.state.settings.weighIn = false; port.changed(port.state)
  vm.startToday(); vm.onHide(); vi.setSystemTime(20000); vm.tickClock()
  expect(port.state.workout).toBe(null)
  vm.onShow(); expect(port.state.workout).toBeTruthy()
})
