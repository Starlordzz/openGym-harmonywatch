#!/usr/bin/env node
// A demo plan for testing the watch. Two files, both checked here:
//   harmonywatch/testdata/demo-plan.json      what the phone's "Import plan" accepts
//   harmonywatch/testdata/demo-snapshot.json  what the phone would send the watch (ready + a run)
// and, with --bundle, a copy of the built app with an in-memory store seeded with that snapshot so the Lite
// previewer shows every screen without a phone.
//
// The snapshot is validated with the watch's own state machine (applySnapshot), and every exercise
// id in the plan is checked against catalogue/exercises/. The phone builds the same shape in
// frontend/src/lib/watch-sync.js (watchEntry/buildReady); this script exists because the Vite SSR
// load of the app is too slow over this repo's Windows mount to run as a helper.
import { writeFileSync, readFileSync, mkdirSync, cpSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = join(root, 'harmonywatch/testdata')
// Use the same naming core and generated Chinese pack as the phone, not hand-written English.
const { exerciseNameFor, _setLangState } = await import(pathToFileURL(join(root, 'frontend/src/lib/i18n-core.js')).href)
const { default: chineseNames } = await import(pathToFileURL(join(root, 'frontend/src/exercise-names/zh.js')).href)
_setLangState('zh', {}, null, chineseNames, false)


const ex = (id, mode, sets, extra = {}) => {
  const catalogue = JSON.parse(readFileSync(join(root, 'catalogue/exercises', id + '.json'), 'utf8'))
  return { id, name: exerciseNameFor({ id, n: catalogue.name }), mode, sets, ...extra }
}
const reps = (w, r, done = false) => ({ w, r, done })
const warm = (w, r) => ({ w, r, done: false, warmup: true })
const hold = sec => ({ sec, done: false })
const empty = () => ({})
const sides = (lw, lr, rw, rr) => ({ done: false, sides: { L: { w: lw, r: lr, done: false }, R: { w: rw, r: rr, done: false } } })

// 新手增肌 一周三练 (PPL 推拉腿) 计划：
// 专为新手肌肥大定制，大复合动作强化基础力量，器械与哑铃动作针对性刺激肌肉肥大。
// 周一推日、周三拉日、周五腿日，做一休一保证神经与肌肉充分恢复。
const push = [
  ex('0025', 'reps', [warm(30, 10), warm(40, 8), reps(50, 8), reps(50, 8), reps(50, 8)], { restSec: 120, step: 2.5, last: '50 kg × 8', best: { w: 50, r: 8 } }),
  ex('0314', 'reps', [reps(16, 10), reps(16, 10), reps(16, 10)], { restSec: 90, step: 2, last: '16 kg × 10' }),
  ex('0290', 'reps', [reps(12, 10), reps(12, 10), reps(12, 10)], { restSec: 90, step: 2, last: '12 kg × 10' }),
  ex('0334', 'reps', [reps(7.5, 12), reps(7.5, 12), reps(7.5, 12)], { restSec: 60, step: 1, last: '7.5 kg × 12' }),
  ex('0241', 'reps', [reps(20, 12), reps(20, 12), reps(20, 12)], { restSec: 60, step: 2.5, last: '20 kg × 12' })
]

const pull = [
  ex('0150', 'reps', [warm(25, 10), reps(40, 10), reps(40, 10), reps(40, 10), reps(40, 10)], { restSec: 90, step: 2.5, last: '40 kg × 10' }),
  ex('0292', 'reps', [sides(16, 10, 16, 10), sides(16, 10, 16, 10), sides(16, 10, 16, 10)], { restSec: 90, perSide: true, step: 2, last: '16 kg × 10' }),
  ex('0160', 'reps', [reps(35, 10), reps(35, 10), reps(35, 10)], { restSec: 90, step: 2.5, last: '35 kg × 10' }),
  ex('0380', 'reps', [reps(5, 12), reps(5, 12), reps(5, 12)], { restSec: 60, step: 1, last: '5 kg × 12' }),
  ex('0294', 'reps', [reps(10, 12), reps(10, 12), reps(10, 12)], { restSec: 60, step: 1, last: '10 kg × 12' })
]

const legs = [
  ex('0043', 'reps', [warm(40, 8), warm(50, 6), reps(60, 8), reps(60, 8), reps(60, 8)], { restSec: 120, step: 2.5, last: '60 kg × 8' }),
  ex('0085', 'reps', [warm(30, 8), reps(50, 10), reps(50, 10), reps(50, 10)], { restSec: 90, step: 2.5, last: '50 kg × 10' }),
  ex('0585', 'reps', [reps(30, 12), reps(30, 12), reps(30, 12)], { restSec: 60, step: 2.5, last: '30 kg × 12' }),
  ex('0586', 'reps', [reps(25, 12), reps(25, 12), reps(25, 12)], { restSec: 60, step: 2.5, last: '25 kg × 12' }),
  ex('3018', 'reps', [reps(0, 15), reps(0, 15), reps(0, 15)], { restSec: 60, bodyweight: true, last: '15 次' })
]

const routine = (id, name, entries) => ({ routineIds: [id], name, entries })
const today = new Date().toISOString().slice(0, 10)
const now = Date.now()

const snapshot = {
  v: 1,
  unit: 'kg',
  restSec: 90,
  ready: {
    today: routine('r-push', '推日训练 (胸/肩/三头)', push),
    others: [
      routine('r-pull', '拉日训练 (背/后束/二头)', pull),
      routine('r-legs', '腿日训练 (股四/腘绳/臀/小腿)', legs)
    ]
  },
  active: { id: 'demo-workout-1', name: '推日训练 (胸/肩/三头)', start: now - 10 * 60 * 1000, unit: 'kg', cur: 0, restSec: 90, rest: null, entries: push }
}

// The importable plan: same exercises, in the app's own routine/plan shape.
const plan = {
  opengym_plan: 1,
  name: '新手增肌一周三练 (PPL)',
  summary: '适合新手增肌的推拉腿三分化计划，每周训练3天（周一推、周三拉、周五腿），做一休一。精选经典基础动作，科学配置肌肥大组数与休息间隔。',
  unit: 'kg',
  exported: today,
  week: {
    '1': ['r-push'],
    '3': ['r-pull'],
    '5': ['r-legs']
  },
  routines: [
    {
      id: 'r-push',
      name: '推日训练 (胸/肩/三头)',
      ex: [
        { id: '0025', sets: 3, reps: 8, weight: 50, mode: 'reps', warmupSets: 2, restSec: 120 },
        { id: '0314', sets: 3, reps: 10, weight: 16, mode: 'reps', restSec: 90 },
        { id: '0290', sets: 3, reps: 10, weight: 12, mode: 'reps', restSec: 90 },
        { id: '0334', sets: 3, reps: 12, weight: 7.5, mode: 'reps', restSec: 60 },
        { id: '0241', sets: 3, reps: 12, weight: 20, mode: 'reps', restSec: 60 }
      ]
    },
    {
      id: 'r-pull',
      name: '拉日训练 (背/后束/二头)',
      ex: [
        { id: '0150', sets: 4, reps: 10, weight: 40, mode: 'reps', warmupSets: 1, restSec: 90 },
        { id: '0292', sets: 3, reps: 10, weight: 16, mode: 'reps', side: true, restSec: 90 },
        { id: '0160', sets: 3, reps: 10, weight: 35, mode: 'reps', restSec: 90 },
        { id: '0380', sets: 3, reps: 12, weight: 5, mode: 'reps', restSec: 60 },
        { id: '0294', sets: 3, reps: 12, weight: 10, mode: 'reps', restSec: 60 }
      ]
    },
    {
      id: 'r-legs',
      name: '腿日训练 (股四/腘绳/臀/小腿)',
      ex: [
        { id: '0043', sets: 3, reps: 8, weight: 60, mode: 'reps', warmupSets: 2, restSec: 120 },
        { id: '0085', sets: 3, reps: 10, weight: 50, mode: 'reps', warmupSets: 1, restSec: 90 },
        { id: '0585', sets: 3, reps: 12, weight: 30, mode: 'reps', restSec: 60 },
        { id: '0586', sets: 3, reps: 12, weight: 25, mode: 'reps', restSec: 60 },
        { id: '3018', sets: 3, reps: 15, weight: 0, mode: 'reps', restSec: 60 }
      ]
    }
  ],
  customEx: []
}

// ---- checks -------------------------------------------------------------------------------------
const ids = [...new Set(plan.routines.flatMap(r => r.ex.map(e => e.id)))]
const missing = ids.filter(id => !existsSync(join(root, 'catalogue/exercises', id + '.json')))
if (missing.length) throw Error('unknown catalogue ids: ' + missing.join(', '))

const { initialState, applySnapshot } = await import(pathToFileURL(join(root,
  'frontend/harmony/watch/entry/src/main/js/default/common/session.js')).href)
const state = applySnapshot(initialState(), snapshot)
if (!state.workout || state.workout.entries.length !== push.length) throw Error('the watch did not accept the snapshot')
if (!state.ready || !state.ready.today || state.ready.others.length !== 2) throw Error('ready routines did not survive')

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'demo-plan.json'), JSON.stringify(plan, null, 2) + '\n')
writeFileSync(join(out, 'demo-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n')
writeFileSync(join(out, 'beginner-ppl-plan.json'), JSON.stringify(plan, null, 2) + '\n')
writeFileSync(join(root, 'beginner-ppl-plan.json'), JSON.stringify(plan, null, 2) + '\n')
console.log('demo-plan.json      ' + plan.routines.length + ' routines, ' + ids.length + ' exercises (ids checked against catalogue/)')
console.log('demo-snapshot.json  today=' + snapshot.ready.today.name + ' (' + push.length + '), others=' + snapshot.ready.others.length +
  ', active=' + state.workout.entries.length + ' (accepted by the watch state machine)')

// ---- optional: a bundle the Lite previewer can run without a phone -------------------------------
if (process.argv.includes('--bundle')) {
  const built = join(root, 'harmonywatch/entry/build/default/intermediates/loader_out_lite/default/js/MainAbility')
  if (!existsSync(join(built, 'pages/index/index.js'))) throw Error('build the project first (release or debug)')
  const target = join(root, 'harmonywatch/.demo')
  cpSync(built, target, { recursive: true })
  // The Lite previewer fails native storage reads. Keep this workaround inside the preview copy:
  // the real controller still loads/saves, attach() remains live, and edits use an in-memory store.
  // Production sources, staged files and installable HAPs never receive this native-module wrapper.
  const file = join(target, 'app.js')
  const source = readFileSync(file, 'utf8').replace(/\n?\/\/# sourceMappingURL=[^\n]*/g, '').trim().replace(/;$/, '')
  const memory = JSON.stringify(JSON.stringify(state))
  writeFileSync(file, '(function(nativeModule){var saved=' + memory + ';' +
    'var requireNative=function(name){if(name==="system.storage")return {' +
    'get:function(o){o.success(saved)},set:function(o){saved=o.value;o.success()}};' +
    'return nativeModule(name)};return ' + source + '})(requireNative);\n')
  const size = f => statSync(join(built, f)).size
  const appBytes = size('app.js'), pageBytes = size('pages/index/index.js')
  console.log('harmonywatch/.demo  PREVIEW ONLY, in-memory storage; original page/controller retained (' + appBytes + ' + ' + pageBytes + ' B before the preview wrapper)')
  if (appBytes > 49152 || pageBytes > 49152) {
    console.log('note: this build is over 48 KB per file (a debug build): the previewer accepts it, a device does not. Use build-local.ps1 (release) for anything you install.')
  }
}
