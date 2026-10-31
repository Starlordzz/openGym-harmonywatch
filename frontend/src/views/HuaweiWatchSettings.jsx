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
  const [restNotifications, setRestNotifications] = useState(false)
  const [exact, setExact] = useState(false)
  const [prefs, setPrefs] = useState(readWatchPrefs)
  const update = patch => setPrefs(writeWatchPrefs(patch))
  useEffect(() => {
    bridge.status().then(s => {
      if (s.bundleName) setBundle(s.bundleName)
      if (s.fingerprint) setFingerprint(s.fingerprint)
      setRestNotifications(!!s.restNotifications); setExact(!!s.restNotificationExact)
      if (s.restNotificationError) setMessage(s.restNotificationError)
    }).catch(e => setMessage(String(e.message || e)))
  }, [])
  const connect = async () => {
    setBusy(true)
    try {
      await bridge.configure({ bundleName, fingerprint })
      const s = await bridge.connect()
      if (s) { setRestNotifications(!!s.restNotifications); setExact(!!s.restNotificationExact) }
      setMessage('已注册通信。请打开手表上的 openGym，等待计划同步。')
    } catch (e) { setMessage(String(e.message || e)) }
    finally { setBusy(false) }
  }
  const notifyRest = async enabled => {
    if (busy) return
    setBusy(true)
    try {
      const s = await bridge.setRestNotifications({ enabled })
      setRestNotifications(!!s.restNotifications); setExact(!!s.restNotificationExact)
      setMessage(enabled ? '通知授权已开启。请保持手机与手表连接，并确认手表允许通知响铃或振动。' : '已关闭休息系统通知。')
    } catch (e) { setMessage(String(e.message || e)) }
    finally { setBusy(false) }
  }
  const testNotification = async () => {
    setBusy(true)
    try { await bridge.testRestNotification(); setMessage('通知接口调用成功，请在手表上确认声音或振动。') }
    catch (e) { setMessage(String(e.message || e)) }
    finally { setBusy(false) }
  }
  return <>
    <Section title="HUAWEI FIT" footer={message}>
      <Row title="同步训练到手表"><Switch checked={prefs.enabled} onChange={v => update({ enabled: v })} /></Row>
      {SHOWS.map(([key, label]) => <Row key={key} title={label}><Switch checked={prefs.show[key]} onChange={v => update({ show: { [key]: v } })} /></Row>)}
      <SelectRow title="休息倒数样式" value={prefs.show.rest} onChange={v => update({ show: { rest: v } })}
        options={[{ value: 'ring', label: '圆环和倒数' }, { value: 'plain', label: '仅倒数' }]} />
      <Row title="休息结束震动"><Switch checked={prefs.restHaptics} onChange={v => update({ restHaptics: v })} /></Row>
      <Row title="休息结束系统通知"><Switch aria-label="休息结束系统通知" checked={restNotifications} disabled={busy} onChange={notifyRest} /></Row>
    </Section>
    {restNotifications && <div className="hw-acts">
      <button className="btn" disabled={busy} onClick={testNotification}>测试手表通知</button>
      {!exact && <button className="btn" onClick={async () => {
        try { await bridge.openRestAlarmSettings(); setMessage('请在系统中允许 openGym 设置闹钟和提醒，返回后重新打开此页。') }
        catch (e) { setMessage(String(e.message || e)) }
      }}>允许准时提醒</button>}
      <p className="sect-f">由手机定时发送通知，手表退到后台也可接收。需开启“休息结束震动”，并允许 Wear Engine 通知、保持手机连接；通知声音和振动跟随手表系统设置，勿扰或未佩戴时可能静音。{!exact && '尚未允许精确闹钟，提醒可能延迟。'}</p>
    </div>}

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
      <p className="sect-f">本项目为适配鸿蒙手表（HUAWEI FIT / WATCH）的 openGym 改进分支，配套 Android 客户端使用（不再支持 iPhone / Apple Watch）。当前为开发版本，训练同步和动作动画需真机验证。热量和华为运动健康写入暂未启用。</p>
    </div>
  </>
}
