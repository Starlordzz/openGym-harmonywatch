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
  useEffect(() => {
    bridge.status().then(s => {
      if (s.bundleName) setBundle(s.bundleName)
      if (s.fingerprint) setFingerprint(s.fingerprint)
    }).catch(e => setMessage(String(e.message || e)))
  }, [])
  const connect = async () => {
    setBusy(true)
    try {
      await bridge.configure({ bundleName, fingerprint })
      await bridge.connect()
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
        <span>手表签名证书 SHA-256 指纹</span>
        <input className="input hw-mono" aria-label="手表签名证书指纹" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          value={fingerprint} onChange={e => setFingerprint(e.target.value)} placeholder="64 位十六进制，可留空后由手表应用提供" />
      </label>
    </div>
    <div className="hw-acts">
      <button className="btn primary" disabled={busy} onClick={connect}>{busy ? '正在连接…' : '授权并连接'}</button>
      <p className="sect-f">当前为开发版本，训练同步和动作动画需真机验证。热量和华为运动健康写入暂未启用。</p>
    </div>
  </>
}
