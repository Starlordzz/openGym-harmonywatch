#!/usr/bin/env node
// Synthetic UI scenarios in a separate preview copy; installation bundles stay untouched.
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initialState } from '../../frontend/harmony/watch/entry/src/main/js/default/common/session.js'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const project = resolve(option('--project') || join(root, 'harmonywatch'))
const scene = option('--scene') || 'rest-offline'
if (!['rest-offline', 'exercise', 'zero-weight', 'decimal-weight', 'bodyweight', 'long-numbers', 'heart', 'heart-error', 'finish', 'ended'].includes(scene)) throw Error('Unknown UI scene')
const built = join(project, 'entry/build/default/intermediates/loader_out_lite/default/js/MainAbility')
const target = resolve(option('--out') || join(project, 'artifacts/ui-' + scene + '-bundle'))
cpSync(built, target, { recursive: true })
const state = initialState()
state.settings = { lang: 'zh-Hans', show: { next: true } }
state.online = false
state.sensorEnabled = scene === 'heart' || scene === 'heart-error'
state.workout = { id: 'synthetic-preview', name: 'Full Body A', start: Date.now() - 60000, restSec: 90,
  rest: scene === 'rest-offline' ? { endsAt: Date.now() + 90000, total: 90 } : null,
  entries: [{ id: 'preview', name: '哑铃上斜卧推（交替单侧）', mode: 'reps', sets: [{ w: 20, r: 8, done: false }] }] }
if (scene === 'zero-weight' || scene === 'decimal-weight') state.workout.entries[0].sets[0].w = scene === 'zero-weight' ? 0 : 102.5
if (scene === 'bodyweight' || scene === 'long-numbers') {
  const e = state.workout.entries[0]
  e.bodyweight = true; e.name = '俯卧撑'
  e.sets[0] = { w: 0, r: scene === 'long-numbers' ? 123456789 : 8, done: false }
}
state.outbox = [{ id: 'preview-offline', type: 'navigate', wid: 'synthetic-preview', at: Date.now() }]
if (scene === 'finish') state.entryIndex = state.workout.entries.length
if (scene === 'ended') {
  state.summary = { name: 'Full Body A', seconds: 600, sets: 3, volume: 480, endedOnPhone: true }
  state.workout = null
}
const source = readFileSync(join(built, 'app.js'), 'utf8').trim().replace(/;$/, '')
writeFileSync(join(target, 'app.js'), '(function(nativeModule){var saved=' + JSON.stringify(JSON.stringify(state)) + ';' +
  'var requireNative=function(name){if(name==="system.storage")return {' +
  'get:function(o){o.success(saved)},set:function(o){saved=o.value;o.success()}};' +
  (scene === 'heart' ? 'if(name==="system.sensor")return {subscribeHeartRate:function(o){o.success({heartRate:128})},unsubscribeHeartRate:function(){}};' : '') +
  (scene === 'heart-error' ? 'if(name==="system.sensor")return {subscribeHeartRate:function(o){o.fail("native sensor rejected request",201)},unsubscribeHeartRate:function(){}};' : '') +
  'return nativeModule(name)};return ' + source + '})(requireNative);\n')
writeFileSync(join(target, 'SCENE.json'), JSON.stringify({ scene, synthetic: true, previewOnly: true }, null, 2) + '\n')
console.log(target)
