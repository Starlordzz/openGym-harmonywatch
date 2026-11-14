import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import { Section, Row, Switch, SelectRow } from '../components/ui.jsx'
import { readWatchPrefs, writeWatchPrefs } from '../lib/watch-settings.js'

const bridge = registerPlugin('HuaweiWatch')
// Identity setup belongs here because the two signed applications must trust each other.

const SHOWS = [
  ['clip', '显示动作动画'], ['hr', '显示心率'], ['last', '显示上次记录'],
  ['elapsed', '显示训练时长'], ['next', '休息时显示下一组'],
]

export default function HuaweiWatchSettings() {
  const [bundleName, setBundle] = useState(import.meta.env.VITE_HUAWEI_WATCH_BUNDLE || 'host.msknet.opengym.fit')
  const [fingerprint, setFingerprint] = useState(import.meta.env.VITE_HUAWEI_WATCH_FINGERPRINT || '')
  const [message, setMessage] = useState('请先在华为运动健康中配对，再打开手表上的 openGym。')
  const [busy, setBusy] = useState(false)
  const [prefs, setPrefs] = useState(readWatchPrefs)
  const update = patch => setPrefs(writeWatchPrefs(patch))
  // Which half of the link is missing decides everything the user can do next: pairing is the
  // phone's business, "installed" only becomes true once the watch app sends its first hello, and
  // the plan only leaves the phone while both are true.
  const [link, setLink] = useState(null)
  const refresh = async () => {
    try { setLink(await bridge.status()) } catch (e) { setLink(null); setMessage(String(e.message || e)) }
  }
  useEffect(() => {
    let active = true, subscription, updates = 0
    const apply = s => {
      setLink(s)
      if (s.communicationError) setMessage(s.communicationError)
    }
    Promise.resolve(bridge.addListener('watchState', s => {
      if (active) { updates++; apply(s) }
    })).then(handle => {
      if (active) subscription = handle
      else handle.remove()
    }).catch(e => { if (active) setMessage(String(e.message || e)) })
    bridge.status().then(s => {
      if (!active) return
      if (!updates) apply(s)
      if (s.bundleName) setBundle(s.bundleName)
      if (s.fingerprint) setFingerprint(s.fingerprint)
    }).catch(e => { if (active) setMessage(String(e.message || e)) })
    return () => { active = false; subscription?.remove() }
  }, [])
  const connect = async () => {
    setBusy(true)
    try {
      await bridge.configure({ bundleName, fingerprint })
      const s = await bridge.connect()
      if (s) { setLink(s) }
      setMessage('已注册通信。请打开手表上的 openGym，等待计划同步。')
    } catch (e) { setMessage(String(e.message || e)) }
    finally { setBusy(false) }
  }
  return <>
    <Section title="HUAWEI FIT" footer={message}>
      <Row title="同步训练到手表"><Switch checked={prefs.enabled} onChange={v => update({ enabled: v })} /></Row>
      {SHOWS.map(([key, label]) => <Row key={key} title={label}><Switch checked={prefs.show[key]} onChange={v => update({ show: { [key]: v } })} /></Row>)}
      <SelectRow title="休息倒数样式" value={prefs.show.rest} onChange={v => update({ show: { rest: v } })}
        options={[{ value: 'ring', label: '圆环和倒数' }, { value: 'plain', label: '仅倒数' }]} />
      <Row title="休息结束震动"><Switch checked={prefs.restHaptics} onChange={v => update({ restHaptics: v })} /></Row>
    </Section>

    <h2 className="sect-t">手表应用</h2>
    <div className="hw-form">
      <label className="measure-field">
        <span>手表应用包名</span>
        <input className="input" aria-label="手表应用包名" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={bundleName} onChange={e => setBundle(e.target.value)} placeholder="host.msknet.opengym.fit" />
      </label>
      <label className="measure-field">
        <span>手表应用指纹（包名与公钥）</span>
        <input className="input hw-mono" aria-label="手表签名证书指纹" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={fingerprint} onChange={e => setFingerprint(e.target.value)} placeholder="应用包名_Base64 公钥" />
      </label>
    </div>
    <div className="hw-acts">
      <button className="btn primary" disabled={busy} onClick={connect}>{busy ? '正在连接…' : '授权并连接'}</button>
      <button className="btn" disabled={busy} onClick={refresh}>刷新状态</button>
      {link && <p className="sect-f" aria-live="polite">
        手机侧状态：{link.paired ? '手表已连接' : '手表未连接'} · {link.installed ? '手表应用已应答' : '手表应用未应答'} · 身份{link.configured ? '已配置' : '未配置'}
      </p>}
      {link && <p className="sect-f" aria-live="polite">
        通信诊断：{link.receiverRegistered ? '接收器已就绪' : '接收器未就绪'} · 已接收 {link.receivedPackets || 0} 条消息
        {' · 连接权限'}{link.managerGranted == null ? '待核验' : link.managerGranted ? '已授权' : '未授权'}
        {link.lastPingCode != null && ` · 应用探测 ${link.lastPingCode}${({ 200: '（未安装）', 201: '（未运行）', 202: '（运行中）' })[link.lastPingCode] || ''}`}
        {link.watchVersion != null && ` · 应用版本 ${link.watchVersion}`}
        {link.lastSendCode != null && ` · 最近发送返回码 ${link.lastSendCode}`}
        {link.probeError && ` · 探测错误 ${link.probeError}`}
        {link.communicationError && ` · ${link.communicationError}`}
      </p>}
      {link?.deviceName && <p className="sect-f">当前设备：{link.deviceName} · 通信能力{link.p2pCapability === 0 ? '支持' : link.p2pCapability === 1 ? '不支持' : '未知'}</p>}
      <p className="sect-f">本项目为适配鸿蒙手表（HUAWEI FIT / WATCH）的 openGym 改进分支，配套 Android 客户端使用（不再支持 iPhone / Apple Watch）。当前为开发版本，训练同步和动作动画需真机验证。热量和华为运动健康写入暂未启用。</p>
    </div>
  </>
}
