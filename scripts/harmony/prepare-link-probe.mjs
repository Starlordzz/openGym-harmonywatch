#!/usr/bin/env node
// Minimal foreground Wear Engine comparison, using the same signed identity and wire protocol.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const args = process.argv.slice(2), i = args.indexOf('--project')
if (i < 0 || !args[i + 1]) throw Error('Usage: node scripts/harmony/prepare-link-probe.mjs --project <Lite project> [--raw]')
const project = resolve(args[i + 1])
execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'prepare.mjs'), '--project', project], { stdio: 'inherit' })
const config = JSON.parse(readFileSync(join(project, 'entry/src/main/config.json'), 'utf8'))
const ability = config.module.abilities.find(a => a.type === 'page' && (!a.srcLanguage || a.srcLanguage === 'js'))
const base = join(project, 'entry/src/main/js', ability.srcPath || ability.name)
writeFileSync(join(base, 'app.js'), 'export default { data: {} }\n')
writeFileSync(join(base, 'pages/index/index.js'), `import brightness from '@system.brightness'
import { P2pClient, Builder, Message } from '../../vendor/wearengine.js'
import peer from '../../common/peer.js'
import { waitForSdk } from '../../common/sdk-ready.js'
import { packets, assembler } from '../../common/wire.js'
export default {
  data: { sdk: 'sdk:?', rx: 'rx:off', tx: 'tx:-', received: '收到:0', error: '' },
  onShow() {
    if (this.live) return
    this.live = true; this.count = 0; this.decode = assembler()
    try { brightness.setKeepScreenOn({ keepScreenOn: true, fail: function() {} }) } catch (e) {}
    var page = this
    // Create the native client only after this page has entered the foreground.
    this.launch = setTimeout(function() {
      if (!page.live) return
      page.client = new P2pClient()
      page.cancel = waitForSdk(page.client, setTimeout, function() {
        page.sdk = 'sdk:' + page.client.version
        page.client.setPeerPkgName(peer.phonePackage)
        page.client.setPeerFingerPrint(peer.phoneFingerprint)
        page.rx = 'rx:wait'
        page.client.registerReceiver({
          onSuccess: function() {
            if (!page.live) { page.close(); return }
            page.registered = true; page.rx = 'rx:ok'
            page.firstSend = setTimeout(function() { page.hello() }, 500)
          },
          onFailure: function(data, code) { if (page.live) { page.rx = 'rx:fail'; page.error = String(code || '') + ' ' + String(data || '') } },
          onReceiveMessage: function(raw) {
            if (!page.live) return
            page.count++; page.received = '收到:' + page.count
            try {
              var result = page.decode(String(raw), Date.now())
              if (!result) return
              if (result.payload.kind === 'helloRequest') page.hello()
              if (result.payload.kind === 'snapshot') page.send({ kind: 'snapshotAck', id: result.id })
            } catch (e) { page.error = String(e.message || e) }
          }
        })
      }, function(e) { if (page.live) { page.sdk = 'sdk:' + page.client.version; page.error = String(e) } }, clearTimeout)
    }, 200)
  },
  hello() { if (this.live) this.send({ kind: 'hello', boot: 'foreground-probe' }) },
  send(payload) {
    if (!this.live || !this.registered) return
    var page = this, frames = packets(payload, 'probe-' + Date.now()), builder = new Builder(), message = new Message()
    if (frames.length !== 1) { this.error = 'probe payload too large'; return }
    builder.setDescription(${args.includes('--raw') ? "payload.kind === 'hello' ? 'Hello, Wear Engine!' : frames[0]" : 'frames[0]'}); message.builder = builder; this.tx = 'tx:wait'
    this.client.send(message, { onSuccess: function() {}, onFailure: function() { if (page.live) page.tx = 'tx:fail' },
      onSendResult: function(r) { if (page.live) { page.tx = 'tx:' + (typeof r === 'number' ? r : r.code); if (r && r.data) page.error = String(r.data) } },
      onSendProgress: function() {} })
  },
  close() {
    if (!this.client) return
    try { this.client.unregisterReceiver({ onSuccess: function() {}, onFailure: function() {} }) } catch (e) {}
    this.registered = false
  },
  onHide() {
    if (!this.live) return
    this.live = false
    clearTimeout(this.launch); clearTimeout(this.firstSend)
    if (this.cancel) this.cancel()
    this.close()
    try { brightness.setKeepScreenOn({ keepScreenOn: false, fail: function() {} }) } catch (e) {}
  },
  onDestroy() { this.onHide() }
}
`)
writeFileSync(join(base, 'pages/index/index.hml'), `<div class="page">
  <text class="title">openGym ${args.includes('--raw') ? '原始消息' : '前台通信'}自检</text>
  <text class="line">{{sdk}} {{rx}} {{tx}}</text>
  <text class="line">{{received}}</text>
  <text class="error">{{error}}</text>
  <div class="button" onclick="hello"><text class="line">发送短消息</text></div>
  <text class="credit">基于 Duarte Santos 的 openGym</text>
  <text class="credit">第三方华为 FIT 适配</text>
</div>\n`)
writeFileSync(join(base, 'pages/index/index.css'), `.page { width: 408px; height: 408px; flex-direction: column; justify-content: center; align-items: center; background-color: #000000; }
.title { width: 376px; height: 44px; font-size: 26px; color: #ffffff; text-align: center; }
.line { width: 376px; height: 40px; font-size: 22px; color: #ffffff; text-align: center; }
.error { width: 376px; height: 80px; font-size: 18px; color: #ffffff; text-align: center; }
.button { width: 376px; height: 44px; justify-content: center; align-items: center; }
.credit { width: 376px; height: 28px; font-size: 18px; color: #aaaaaa; text-align: center; }\n`)
console.log('Foreground P2P probe: original SDK and peers; registration in onShow; foreground stay-awake and manual resend. Message mode: ' + (args.includes('--raw') ? 'official plain-text sample' : 'packet protocol'))
