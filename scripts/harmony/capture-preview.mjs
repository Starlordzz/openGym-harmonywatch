#!/usr/bin/env node
// Capture real Lite previewer frames, without touching DevEco's running preview or device storage.
import { createServer } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] }
if (args.includes('--help')) {
  console.log('Windows Node: capture-preview.mjs --deveco <DevEco directory> [--bundle <compiled MainAbility or .demo>] [--out <capture directory>]')
  process.exit(0)
}
if (process.platform !== 'win32') throw Error('Run with Windows Node (DevEco tools/node/node.exe), including when called from WSL')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const deveco = option('--deveco')
if (!deveco) throw Error('--deveco is required')
const sdk = join(resolve(deveco), 'sdk/default/hms/previewer/liteWearable')
const bundle = resolve(option('--bundle') || join(root, 'harmonywatch/entry/build/default/intermediates/loader_out_lite/default/js/MainAbility'))
const out = resolve(option('--out') || join(root, 'harmonywatch/artifacts/preview-capture'))
const simulator = join(sdk, 'bin/Simulator.exe')
const config = join(root, 'harmonywatch/.idea/previewer/liteWearable/liteWearableSettingConfig_rd.json')
for (const path of [simulator, config, join(bundle, 'app.js'), join(bundle, 'pages/index/index.js')]) {
  if (!existsSync(path)) throw Error('Missing preview input: ' + path)
}
mkdirSync(out, { recursive: true })
const name = 'opengym_capture_' + randomUUID().replaceAll('-', '')
const sid = randomUUID().replaceAll('-', '')
const pipes = [], sockets = []
let log = '', frames = 0, child, ws, finished = false, deadline, retry
function cleanup() {
  finished = true
  clearTimeout(deadline); clearTimeout(retry)
  if (ws) ws.close()
  if (child) child.kill()
  for (const socket of sockets) socket.destroy()
  for (const pipe of pipes) pipe.close()
}
try {
  for (const suffix of ['_commandPipe', '_imagePipe', '_trace']) {
    const server = createServer(socket => {
      sockets.push(socket)
      socket.on('data', b => { if (suffix !== '_imagePipe') log += b.toString() })
      socket.on('error', () => {})
    })
    pipes.push(server)
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen('\\\\.\\pipe\\' + name + suffix, resolve)
    })
  }
  const portServer = createServer()
  await new Promise((resolve, reject) => { portServer.once('error', reject); portServer.listen(0, '127.0.0.1', resolve) })
  const port = portServer.address().port
  await new Promise(resolve => portServer.close(resolve))
  const simulatorArgs = ['-refresh', 'full', '-projectID', '86761050', '-ts', name + '_trace',
    '-j', bundle, '-s', name, '-cpm', 'false', '-device', 'liteWearable', '-shape', 'rect', '-sd', '160',
    '-pjId', sid + sid.slice(0, 24), '-bn', 'host.msknet.opengym.fit', '-sid', sid,
    '-or', '408', '480', '-cr', '408', '480', '-hs', '524288', '-f', config,
    '-n', 'entry', '-url', 'pages/index/index', '-ilt', 'false', '-lws', String(port)]
  // The engine resolves ../config/SourceHanSansSC-Regular.otf against its working directory.
  child = spawn(simulator, simulatorArgs, { cwd: join(sdk, 'bin'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', b => { log += b.toString() })
  child.stderr.on('data', b => { log += b.toString() })
  await new Promise((resolve, reject) => {
    child.once('error', reject)
    function connect() {
      if (finished) return
      ws = new WebSocket('ws://127.0.0.1:' + port + '/' + sid)
      ws.binaryType = 'arraybuffer'
      ws.onmessage = event => {
        const b = Buffer.from(event.data)
        const start = b.indexOf(Buffer.from([255, 216, 255]))
        const end = b.lastIndexOf(Buffer.from([255, 217]))
        if (start < 0 || end < start) return
        frames++
        const jpeg = b.subarray(start, end + 2)
        writeFileSync(join(out, 'frame-' + frames + '.jpg'), jpeg)
        writeFileSync(join(out, 'latest.jpg'), jpeg)
      }
      ws.onerror = () => { if (!finished) retry = setTimeout(connect, 100) }
    }
    retry = setTimeout(connect, 25)
    deadline = setTimeout(resolve, 3500)
  })
} finally {
  cleanup()
  writeFileSync(join(out, 'engine.log'), log)
}
let pixels = null
if (frames) {
  // Decode the actual JPEG; desktop borders, overlays and IDE toolbars cannot affect this check.
  const script = `Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new($env:OPENGYM_CAPTURE_FRAME)
try {
  $visible = 0
  for ($y=0; $y -lt $bitmap.Height; $y++) {
    for ($x=0; $x -lt $bitmap.Width; $x++) {
      $c=$bitmap.GetPixel($x,$y)
      if ($c.R -gt 48 -or $c.G -gt 48 -or $c.B -gt 48) { $visible++ }
    }
  }
  @{width=$bitmap.Width; height=$bitmap.Height; visiblePixels=$visible} | ConvertTo-Json -Compress
} finally { $bitmap.Dispose() }`
  const checked = spawnSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, OPENGYM_CAPTURE_FRAME: join(out, 'latest.jpg') }
  })
  if (checked.status !== 0) throw Error('Frame decoding failed: ' + checked.stderr)
  pixels = JSON.parse(checked.stdout.trim())
}
const result = { capturedAt: new Date().toISOString(), bundle, frames, pixels,
  fontError: log.includes('Open font path failed'), evalError: log.includes('Eval JS file failed') }
result.passed = !!pixels && pixels.width === 408 && pixels.height === 480 && pixels.visiblePixels > 100 && !result.fontError && !result.evalError
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (!result.passed) process.exitCode = 1
