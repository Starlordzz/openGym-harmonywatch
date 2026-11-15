import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const port = vi.hoisted(() => ({ changed: null, state: null }))
vi.mock('../../harmony/watch/entry/src/main/js/default/common/runtime.js', () => ({
  runtime(changed) {
    port.changed = changed
    return { load() { changed(port.state) }, change(fn) { fn(port.state); changed(port.state); changed(port.state) },
      samples: () => [], heart: () => null, heartState: () => 'measuring', heartError: () => '', heartStart: vi.fn(), heartStop: vi.fn(), vibrate: vi.fn(),
      // The page holds the screen on while it is shown (pages/index/index.js onShow/onHide) and the
      // app releases it on teardown; both go through the runtime's brightness call.
      keepScreenOn: vi.fn(), stop() {} }
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
  // onInit only draws the first frame; the page's clock — the one that ends a hold and the
  // countdown on its own — starts in onShow, which the device calls right after onInit. Without
  // it no interval exists and a timed hold never reaches its deadline.
  vm.onShow()
})
afterEach(() => { vm.onDestroy(); app.onDestroy(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('incoming state updates preserve in-progress touch edits', () => {
  // Coarse edit: the wheel/± key steps weight and reps by 1 (pages/index/index.js edit() sets
  // editIncrement to 1; the 0.1 fine key is editFineBy), so 20 → 21 and 8 → 9 and the state
  // callbacks below must not roll either back to the set's own 20/8.
  adjust('weight'); adjust('reps'); port.changed(port.state)
  expect(vm.weight).toBe('21'); expect(vm.reps).toBe('9')
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
it('a timed hold finishes automatically with the touch lock feature removed', async () => {
  port.state.workout.entries[0].mode = 'time'; port.changed(port.state)
  vm.seconds = 2; vm.done()
  await vi.advanceTimersByTimeAsync(2500)
  expect(port.state.workout.entries[0].sets[0].done).toBe(true)
  expect(port.state.workout.entries[0].sets[0].sec).toBe(2)
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
